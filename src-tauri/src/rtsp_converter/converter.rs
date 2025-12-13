use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::process::{Command, Child};
use tokio::sync::{broadcast, RwLock, Mutex};
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
    processes: Arc<Mutex<HashMap<i64, Arc<Mutex<Option<Child>>>>>>,
    base_output_dir: PathBuf,
    status_sender: broadcast::Sender<(i64, String)>,
}

impl RTSPConverter {
    pub fn new(base_output_dir: PathBuf) -> Self {
        let (status_sender, _) = broadcast::channel(100);
        
        Self {
            streams: Arc::new(RwLock::new(HashMap::new())),
            processes: Arc::new(Mutex::new(HashMap::new())),
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
        log::info!("开始RTSP到HLS转换: camera_id={}, rtsp_url={}", camera_id, rtsp_url);

        // 检查是否已有该摄像头的转换在运行
        {
            let streams = self.streams.read().await;
            if let Some(existing) = streams.get(&camera_id) {
                if existing.is_active {
                    log::info!("摄像头 {} 的转换已在运行，返回现有HLS URL", camera_id);
                    return Ok(existing.hls_url.clone());
                }
            }
        }

        // 先停止可能存在的旧转换和进程
        log::debug!("🧹 清理摄像头 {} 可能存在的旧进程和文件", camera_id);
        let _ = self.kill_ffmpeg_process(camera_id).await;
        
        // 注意：不调用 stop_conversion，因为它会再次调用 kill_ffmpeg_process
        // 直接清理 streams 状态
        {
            let mut streams = self.streams.write().await;
            streams.remove(&camera_id);
        }

        // 跨平台依赖自检：FFmpeg 是否可用
        self.ensure_ffmpeg_available().await?;

        // 创建输出目录
        let output_dir = self.base_output_dir.join(format!("camera_{}", camera_id));
        
        // 如果目录已存在，先清理旧文件
        if output_dir.exists() {
            log::debug!("🧹 清理旧的HLS文件: {:?}", output_dir);
            let _ = tokio::fs::remove_dir_all(&output_dir).await;
        }
        
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
        log::info!("🛑 停止RTSP转换: camera_id={}", camera_id);

        // 先杀掉FFmpeg进程
        self.kill_ffmpeg_process(camera_id).await?;

        let mut streams = self.streams.write().await;
        if let Some(mut stream_info) = streams.remove(&camera_id) {
            stream_info.is_active = false;
            
            // 注意：不立即删除输出文件，因为FFmpeg进程可能还在写入
            // 文件会在下次启动时被清理，或者在应用关闭时统一清理
            log::debug!("🛑 已标记摄像头 {} 的转换为停止状态", camera_id);
        }

        Ok(())
    }

    /// 强制停止FFmpeg进程
    async fn kill_ffmpeg_process(&self, camera_id: i64) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut processes = self.processes.lock().await;
        
        if let Some(process_mutex) = processes.remove(&camera_id) {
            let mut process_guard = process_mutex.lock().await;
            if let Some(mut child) = process_guard.take() {
                log::info!("🔪 强制停止摄像头 {} 的FFmpeg进程", camera_id);
                let _ = child.kill().await;
                let _ = child.wait().await;
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
        let processes = self.processes.clone();

        tokio::spawn(async move {
            let segment_pattern = playlist_file.parent().unwrap().join("segment_%03d.ts");
            
            log::debug!("🎬 启动FFmpeg进程: camera_id={}", camera_id);
            
            // FFmpeg命令参数 - 优化版本（支持 RTSP/RTMP/HTTP）
            let mut cmd = Command::new("ffmpeg");
            
            // 根据输入URL类型调整参数
            let is_rtsp = rtsp_url.starts_with("rtsp://");
            
            if is_rtsp {
                // RTSP 特定参数
                cmd.args([
                    "-rtsp_transport", "tcp",       // 使用TCP传输（更稳定，避免丢包）
                ]);
            }
            
            cmd.args([
                "-fflags", "nobuffer",              // 禁用输入缓冲（减少延迟）
                "-flags", "low_delay",              // 低延迟标志
                "-i", &rtsp_url,                    // 输入流URL（RTSP/RTMP/HTTP等）
                
                // 视频编码参数
                "-c:v", "copy",                     // 直接复制视频流（不重新编码，极速）
                "-c:a", "aac",                      // 音频编码器
                "-b:a", "64k",                      // 降低音频码率
                
                // HLS输出参数优化
                "-f", "hls",                        // 输出格式HLS
                "-hls_time", "2",                   // 每个片段2秒（平衡启动速度和稳定性）
                "-hls_list_size", "4",              // 播放列表保持4个片段
                "-hls_flags", "delete_segments+omit_endlist", // 自动删除旧片段+实时流标志
                "-hls_segment_type", "mpegts",      // 使用MPEG-TS格式
                "-hls_segment_filename", &segment_pattern.to_string_lossy(),
                "-hls_allow_cache", "0",            // 禁止缓存（实时流）
                
                // 其他优化参数
                "-preset", "ultrafast",             // 编码速度优先
                "-tune", "zerolatency",             // 零延迟调优
                "-probesize", "32",                 // 减小探测大小（更快启动）
                "-analyzeduration", "0",            // 跳过分析（立即开始）
                "-max_delay", "500000",             // 最大延迟0.5秒
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
                    log::info!("FFmpeg进程已启动: camera_id={}, URL: {}", camera_id, rtsp_url);
                    let _ = status_sender.send((camera_id, "streaming".to_string()));

                    // 捕获 stderr 输出以便调试
                    let stderr = child.stderr.take();
                    if let Some(stderr) = stderr {
                        let camera_id_for_log = camera_id;
                        tokio::spawn(async move {
                            use tokio::io::{AsyncBufReadExt, BufReader};
                            let reader = BufReader::new(stderr);
                            let mut lines = reader.lines();
                            
                            while let Ok(Some(line)) = lines.next_line().await {
                                // 只记录错误和警告信息
                                if line.contains("error") || line.contains("Error") || 
                                   line.contains("warning") || line.contains("Warning") ||
                                   line.contains("failed") || line.contains("Failed") {
                                    log::warn!("FFmpeg[{}]: {}", camera_id_for_log, line);
                                }
                            }
                        });
                    }

                    // 保存进程引用以便后续可以停止
                    let child_mutex = Arc::new(Mutex::new(Some(child)));
                    {
                        let mut procs = processes.lock().await;
                        procs.insert(camera_id, child_mutex.clone());
                    }

                    // 等待进程完成或被终止
                    let mut child_guard = child_mutex.lock().await;
                    if let Some(mut child_process) = child_guard.take() {
                        match child_process.wait().await {
                            Ok(status) => {
                                if status.success() {
                                    log::info!("🏁 FFmpeg进程正常结束: camera_id={}", camera_id);
                                } else {
                                    log::error!("FFmpeg进程异常结束: camera_id={}, URL: {}, 状态码: {:?}", 
                                        camera_id, rtsp_url, status.code());
                                }
                            }
                            Err(e) => {
                                log::error!("FFmpeg进程等待失败: camera_id={}, 错误: {}", camera_id, e);
                            }
                        }
                    }
                    
                    // 清理进程引用
                    {
                        let mut procs = processes.lock().await;
                        procs.remove(&camera_id);
                    }
                }
                Err(e) => {
                    log::error!("启动FFmpeg进程失败: camera_id={}, 错误: {}", camera_id, e);
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

    /// 确认系统已安装 ffmpeg（macOS/Ubuntu/Windows 均需）
    async fn ensure_ffmpeg_available(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let status = Command::new("ffmpeg")
            .arg("-version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await;

        match status {
            Ok(s) if s.success() => Ok(()),
            _ => {
                log::error!("未检测到 ffmpeg，请先安装。Ubuntu: sudo apt update && sudo apt install -y ffmpeg");
                Err("ffmpeg 未安装或不可用".into())
            }
        }
    }
}

impl Default for RTSPConverter {
    fn default() -> Self {
        let output_dir = std::env::temp_dir().join("dz_viz_hls");
        Self::new(output_dir)
    }
}
