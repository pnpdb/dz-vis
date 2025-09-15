use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::process::Command;
use tokio::sync::{broadcast, RwLock};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamInfo {
    pub camera_id: i64,
    pub rtsp_url: String,
    pub hls_url: String,
    pub output_dir: PathBuf,
    pub is_active: bool,
}

#[derive(Debug, Clone)]
pub struct RTSPConverter {
    streams: Arc<RwLock<HashMap<i64, StreamInfo>>>,
    base_output_dir: PathBuf,
    status_sender: broadcast::Sender<(i64, String)>,
}

impl RTSPConverter {
    pub fn new(base_output_dir: PathBuf) -> Self {
        let (status_sender, _) = broadcast::channel(100);
        
        Self {
            streams: Arc::new(RwLock::new(HashMap::new())),
            base_output_dir,
            status_sender,
        }
    }

    /// 开始转换RTSP流到HLS
    pub async fn start_conversion(
        &self,
        camera_id: i64,
        rtsp_url: String,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        println!("🔄 开始RTSP到HLS转换: camera_id={}, rtsp_url={}", camera_id, rtsp_url);

        // 创建输出目录
        let output_dir = self.base_output_dir.join(format!("camera_{}", camera_id));
        tokio::fs::create_dir_all(&output_dir).await?;

        // HLS文件路径
        let playlist_file = output_dir.join("playlist.m3u8");
        let hls_url = format!("/hls/camera_{}/playlist.m3u8", camera_id);

        // 创建流信息
        let stream_info = StreamInfo {
            camera_id,
            rtsp_url: rtsp_url.clone(),
            hls_url: hls_url.clone(),
            output_dir: output_dir.clone(),
            is_active: true,
        };

        // 保存流信息
        {
            let mut streams = self.streams.write().await;
            streams.insert(camera_id, stream_info);
        }

        // 启动FFmpeg转换
        self.spawn_ffmpeg_process(camera_id, rtsp_url, playlist_file).await?;

        Ok(hls_url)
    }

    /// 停止转换
    pub async fn stop_conversion(&self, camera_id: i64) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        println!("🛑 停止RTSP转换: camera_id={}", camera_id);

        let mut streams = self.streams.write().await;
        if let Some(mut stream_info) = streams.remove(&camera_id) {
            stream_info.is_active = false;
            
            // 清理输出文件
            if stream_info.output_dir.exists() {
                tokio::fs::remove_dir_all(&stream_info.output_dir).await.ok();
            }
        }

        Ok(())
    }

    /// 获取流信息
    pub async fn get_stream_info(&self, camera_id: i64) -> Option<StreamInfo> {
        let streams = self.streams.read().await;
        streams.get(&camera_id).cloned()
    }

    /// 获取所有活跃流
    pub async fn get_active_streams(&self) -> Vec<StreamInfo> {
        let streams = self.streams.read().await;
        streams.values().filter(|s| s.is_active).cloned().collect()
    }

    /// 订阅状态更新
    pub fn subscribe_status(&self) -> broadcast::Receiver<(i64, String)> {
        self.status_sender.subscribe()
    }

    /// 启动FFmpeg进程
    async fn spawn_ffmpeg_process(
        &self,
        camera_id: i64,
        rtsp_url: String,
        playlist_file: PathBuf,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let status_sender = self.status_sender.clone();
        let streams = self.streams.clone();

        tokio::spawn(async move {
            let segment_pattern = playlist_file.parent().unwrap().join("segment_%03d.ts");
            
            println!("🎬 启动FFmpeg进程: camera_id={}", camera_id);
            
            // FFmpeg命令参数
            let mut cmd = Command::new("ffmpeg");
            cmd.args([
                "-i", &rtsp_url,                    // 输入RTSP流
                "-c:v", "libx264",                  // 视频编码器
                "-c:a", "aac",                      // 音频编码器
                "-preset", "ultrafast",             // 编码速度优先
                "-tune", "zerolatency",             // 低延迟调优
                "-f", "hls",                        // 输出格式HLS
                "-hls_time", "2",                   // 每个片段2秒
                "-hls_list_size", "6",              // 播放列表保持6个片段
                "-hls_flags", "delete_segments",    // 自动删除旧片段
                "-hls_segment_filename", &segment_pattern.to_string_lossy(),
                "-y",                               // 覆盖输出文件
                &playlist_file.to_string_lossy(),   // 输出播放列表
            ]);

            cmd.stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true);

            // 发送开始状态
            let _ = status_sender.send((camera_id, "starting".to_string()));

            match cmd.spawn() {
                Ok(mut child) => {
                    println!("✅ FFmpeg进程已启动: camera_id={}", camera_id);
                    let _ = status_sender.send((camera_id, "streaming".to_string()));

                    // 等待进程完成或被终止
                    match child.wait().await {
                        Ok(status) => {
                            if status.success() {
                                println!("🏁 FFmpeg进程正常结束: camera_id={}", camera_id);
                            } else {
                                println!("❌ FFmpeg进程异常结束: camera_id={}, 状态码: {:?}", camera_id, status.code());
                            }
                        }
                        Err(e) => {
                            println!("❌ FFmpeg进程等待失败: camera_id={}, 错误: {}", camera_id, e);
                        }
                    }
                }
                Err(e) => {
                    println!("❌ 启动FFmpeg进程失败: camera_id={}, 错误: {}", camera_id, e);
                    let _ = status_sender.send((camera_id, "error".to_string()));
                }
            }

            // 清理流状态
            {
                let mut streams_guard = streams.write().await;
                if let Some(stream_info) = streams_guard.get_mut(&camera_id) {
                    stream_info.is_active = false;
                }
            }

            let _ = status_sender.send((camera_id, "stopped".to_string()));
        });

        Ok(())
    }
}

impl Default for RTSPConverter {
    fn default() -> Self {
        let output_dir = std::env::temp_dir().join("dz_viz_hls");
        Self::new(output_dir)
    }
}
