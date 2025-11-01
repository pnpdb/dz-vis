use anyhow::{Context, Result};
use gstreamer as gst;
use gstreamer::prelude::*;
use gstreamer_app as gst_app;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use futures_util::StreamExt;

pub mod websocket;

/// GStreamer MJPEG 流管理器
/// 管理 RTSP 到 MJPEG 的转换和 WebSocket 分发
pub struct GStreamerStreamer {
    // 活动的 GStreamer pipeline
    pipelines: Arc<RwLock<HashMap<u32, gst::Pipeline>>>,
    // 广播通道：每个摄像头一个通道，用于分发 JPEG 数据
    broadcasters: Arc<RwLock<HashMap<u32, broadcast::Sender<Vec<u8>>>>>,
}

impl GStreamerStreamer {
    pub fn new() -> Result<Self> {
        // 初始化 GStreamer
        gst::init().context("GStreamer 初始化失败")?;
        log::info!("GStreamer 初始化成功");
        
        Ok(Self {
            pipelines: Arc::new(RwLock::new(HashMap::new())),
            broadcasters: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// 启动 RTSP → MJPEG 流
    pub async fn start_stream(&self, camera_id: u32, rtsp_url: String) -> Result<()> {
        // 停止旧流（如果存在）
        self.stop_stream(camera_id).await;

        log::info!("启动 GStreamer MJPEG 流: camera_id={}, rtsp_url={}", camera_id, rtsp_url);

        // 创建广播通道（容量 10 个 JPEG 帧，降低延迟）
        // 较小的缓冲区可以减少端到端延迟
        let (tx, _rx) = broadcast::channel::<Vec<u8>>(10);
        
        // 存储广播器
        {
            let mut broadcasters = self.broadcasters.write().await;
            broadcasters.insert(camera_id, tx.clone());
        }

        // 构建 GStreamer pipeline（优化性能和延迟）
        // rtspsrc → rtph264depay → avdec_h264 → videoscale → videoconvert → jpegenc → appsink
        // 只使用通用兼容的参数
        let pipeline_str = format!(
            "rtspsrc location={} protocols=tcp latency=0 buffer-mode=0 ! \
             rtph264depay ! \
             avdec_h264 max-threads=2 ! \
             videoscale ! video/x-raw,width=640,height=480 ! \
             videoconvert ! \
             jpegenc quality=80 ! \
             appsink name=sink emit-signals=true max-buffers=1 drop=true sync=false",
            rtsp_url
        );

        let pipeline = gst::parse::launch(&pipeline_str)
            .context("创建 GStreamer pipeline 失败")?
            .dynamic_cast::<gst::Pipeline>()
            .map_err(|_| anyhow::anyhow!("无法转换为 Pipeline"))?;

        // 获取 appsink
        let appsink = pipeline
            .by_name("sink")
            .context("无法找到 appsink")?
            .dynamic_cast::<gst_app::AppSink>()
            .map_err(|_| anyhow::anyhow!("无法转换为 AppSink"))?;

        // 设置 appsink 回调
        let tx_clone = tx.clone();
        let camera_id_clone = camera_id;
        appsink.set_callbacks(
            gst_app::AppSinkCallbacks::builder()
                .new_sample(move |appsink| {
                    match appsink.pull_sample() {
                        Ok(sample) => {
                            if let Some(buffer) = sample.buffer() {
                                if let Ok(map) = buffer.map_readable() {
                                    let jpeg_data = map.as_slice().to_vec();
                                    
                                    // 广播 JPEG 数据
                                    if tx_clone.send(jpeg_data).is_err() {
                                        log::debug!("没有订阅者 (camera_id={})", camera_id_clone);
                                    }
                                }
                            }
                            Ok(gst::FlowSuccess::Ok)
                        }
                        Err(_) => Err(gst::FlowError::Error),
                    }
                })
                .build(),
        );

        // 设置 bus 消息处理（带超时和取消机制）
        let bus = pipeline.bus().context("无法获取 bus")?;
        let camera_id_for_bus = camera_id;
        let pipeline_weak = pipeline.downgrade();
        
        // 创建一个可取消的任务（传递 pipelines 引用以检测停止）
        let pipelines_arc = Arc::clone(&self.pipelines);
        tokio::spawn(async move {
            let bus_stream = bus.stream();
            tokio::pin!(bus_stream);
            
            loop {
                // 使用超时防止僵尸任务
                let timeout = tokio::time::Duration::from_secs(30);
                match tokio::time::timeout(timeout, bus_stream.next()).await {
                    Ok(Some(msg)) => {
                        match msg.view() {
                            gst::MessageView::Error(err) => {
                                log::error!(
                                    "GStreamer 错误 (camera_id={}): {:?}",
                                    camera_id_for_bus,
                                    err.error()
                                );
                                
                                // 停止 pipeline
                                if let Some(pipeline) = pipeline_weak.upgrade() {
                                    let _ = pipeline.set_state(gst::State::Null);
                                }
                                break;
                            }
                            gst::MessageView::Eos(_) => {
                                log::info!("GStreamer EOS (camera_id={})", camera_id_for_bus);
                                break;
                            }
                            gst::MessageView::Warning(warn) => {
                                log::warn!(
                                    "GStreamer 警告 (camera_id={}): {:?}",
                                    camera_id_for_bus,
                                    warn.error()
                                );
                            }
                            gst::MessageView::StateChanged(state) => {
                                if let Some(src) = msg.src() {
                                    if src.name().starts_with("pipeline") {
                                        log::debug!(
                                            "GStreamer 状态变化 (camera_id={}): {:?} -> {:?}",
                                            camera_id_for_bus,
                                            state.old(),
                                            state.current()
                                        );
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                    Ok(None) => {
                        // Stream 结束
                        log::info!("GStreamer bus stream 已结束 (camera_id={})", camera_id_for_bus);
                        break;
                    }
                    Err(_) => {
                        // 超时：检查 pipeline 是否还存在
                        let pipelines = pipelines_arc.read().await;
                        if !pipelines.contains_key(&camera_id_for_bus) {
                            log::info!("Pipeline 已被移除，结束 bus 监听 (camera_id={})", camera_id_for_bus);
                            break;
                        }
                        // 否则继续监听
                    }
                }
            }
            
            log::debug!("GStreamer bus 监听任务结束 (camera_id={})", camera_id_for_bus);
        });

        // 启动 pipeline
        pipeline
            .set_state(gst::State::Playing)
            .context("启动 pipeline 失败")?;

        log::info!("GStreamer pipeline 已启动 (camera_id={})", camera_id);

        // 存储 pipeline
        {
            let mut pipelines = self.pipelines.write().await;
            pipelines.insert(camera_id, pipeline);
        }

        Ok(())
    }

    /// 停止流
    pub async fn stop_stream(&self, camera_id: u32) {
        log::info!("停止 GStreamer 流: camera_id={}", camera_id);

        // 移除 pipeline（这会触发 bus 监听任务退出）
        let pipeline = {
            let mut pipelines = self.pipelines.write().await;
            pipelines.remove(&camera_id)
        };

        // 先移除广播器（断开所有订阅者）
        {
            let mut broadcasters = self.broadcasters.write().await;
            broadcasters.remove(&camera_id);
        }

        if let Some(pipeline) = pipeline {
            // 先暂停，再停止（优雅关闭）
            let _ = pipeline.set_state(gst::State::Paused);
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            
            // 停止播放
            if let Err(e) = pipeline.set_state(gst::State::Null) {
                log::warn!("停止 pipeline 失败: {:?}", e);
            } else {
                log::info!("Pipeline 已停止 (camera_id={})", camera_id);
            }
            
            // 等待 pipeline 完全清理
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }

        log::info!("流已完全停止 (camera_id={})", camera_id);
    }

    /// 检查流是否活跃
    pub async fn is_stream_active(&self, camera_id: u32) -> bool {
        let pipelines = self.pipelines.read().await;
        if let Some(pipeline) = pipelines.get(&camera_id) {
            let (_, current_state, _) = pipeline.state(gst::ClockTime::ZERO);
            return current_state == gst::State::Playing;
        }
        false
    }

    /// 订阅流数据
    pub async fn subscribe(&self, camera_id: u32) -> Option<broadcast::Receiver<Vec<u8>>> {
        let broadcasters = self.broadcasters.read().await;
        broadcasters.get(&camera_id).map(|tx| tx.subscribe())
    }

    /// 获取活跃流列表
    pub async fn get_active_streams(&self) -> Vec<u32> {
        let pipelines = self.pipelines.read().await;
        pipelines.keys().copied().collect()
    }
}

// 全局实例
use once_cell::sync::Lazy;

pub static GSTREAMER_STREAMER: Lazy<Arc<RwLock<Option<GStreamerStreamer>>>> =
    Lazy::new(|| Arc::new(RwLock::new(None)));

/// 初始化全局 GStreamer 流管理器
pub async fn init_global_streamer() -> Result<()> {
    let mut global = GSTREAMER_STREAMER.write().await;
    if global.is_none() {
        *global = Some(GStreamerStreamer::new()?);
        log::info!("全局 GStreamer 流管理器已初始化");
    }
    Ok(())
}

/// 获取全局流管理器
pub async fn get_global_streamer() -> Result<Arc<RwLock<Option<GStreamerStreamer>>>> {
    Ok(GSTREAMER_STREAMER.clone())
}

