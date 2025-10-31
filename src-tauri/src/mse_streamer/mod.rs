use anyhow::{Context, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{broadcast, RwLock};

pub mod websocket;

/// MSE 流管理器 - 管理 RTSP 到 fMP4 的转换和 WebSocket 分发
pub struct MseStreamer {
    // 活动的 FFmpeg 进程
    processes: Arc<RwLock<HashMap<u32, Child>>>,
    // 广播通道：每个摄像头一个通道，用于分发 fMP4 数据
    broadcasters: Arc<RwLock<HashMap<u32, broadcast::Sender<Vec<u8>>>>>,
}

impl MseStreamer {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(RwLock::new(HashMap::new())),
            broadcasters: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 查找 FFmpeg 可执行文件
    /// 尝试多个可能的路径，优先使用系统 PATH
    fn find_ffmpeg_executable() -> String {
        // 常见的 FFmpeg 安装路径（按优先级排序）
        let possible_paths = vec![
            "ffmpeg",                           // 系统 PATH（优先）
            "/usr/bin/ffmpeg",                  // Linux 标准路径
            "/usr/local/bin/ffmpeg",            // Linux 用户安装路径
            "/opt/homebrew/bin/ffmpeg",         // macOS Homebrew (Apple Silicon)
            "/usr/local/homebrew/bin/ffmpeg",   // macOS Homebrew (Intel)
            "/snap/bin/ffmpeg",                 // Ubuntu Snap 安装
            "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",  // Windows
            "C:\\ffmpeg\\bin\\ffmpeg.exe",      // Windows 备选
        ];

        // 尝试每个路径
        for path in possible_paths {
            if Self::check_ffmpeg_exists(path) {
                log::info!("✅ 找到 FFmpeg: {}", path);
                return path.to_string();
            }
        }

        // 如果都找不到，返回默认值并记录警告
        log::warn!("⚠️ 未找到 FFmpeg，使用默认值 'ffmpeg'（可能失败）");
        log::warn!("💡 请安装 FFmpeg: sudo apt install ffmpeg");
        "ffmpeg".to_string()
    }

    /// 检查 FFmpeg 是否存在
    fn check_ffmpeg_exists(path: &str) -> bool {
        std::process::Command::new(path)
            .arg("-version")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }

    /// 启动 RTSP → fMP4 流
    pub async fn start_stream(&self, camera_id: u32, rtsp_url: String) -> Result<()> {
        // 停止旧流（如果存在）
        self.stop_stream(camera_id).await;

        log::info!("📡 启动 MSE 流: camera_id={}, rtsp_url={}", camera_id, rtsp_url);

        // 创建广播通道（容量 100 个 fMP4 片段）
        let (tx, _rx) = broadcast::channel::<Vec<u8>>(100);
        
        // 存储广播器
        {
            let mut broadcasters = self.broadcasters.write().await;
            broadcasters.insert(camera_id, tx.clone());
        }

        // 查找 FFmpeg 可执行文件（尝试多个可能的路径）
        let ffmpeg_path = Self::find_ffmpeg_executable();
        log::info!("🔍 使用 FFmpeg 路径: {}", ffmpeg_path);

        // 启动 FFmpeg：RTSP → fMP4 (stdout)
        let mut ffmpeg_cmd = Command::new(&ffmpeg_path);
        
        // 构建 FFmpeg 参数
        let mut args = vec![
            "-loglevel", "warning",
            "-hide_banner",
        ];

        // RTSP 专用参数
        if rtsp_url.starts_with("rtsp://") {
            args.extend_from_slice(&[
                "-rtsp_transport", "tcp",
                "-max_delay", "500000",
                "-analyzeduration", "1000000",
                "-probesize", "500000",
            ]);
        }

        // 输入
        args.extend_from_slice(&[
            "-i", &rtsp_url,
        ]);

        // 输出为 fMP4 格式（fragmented MP4 for MSE）
        args.extend_from_slice(&[
            "-c:v", "copy",                    // 视频直接复制（不重编码）
            "-c:a", "aac",                      // 音频转为 AAC（MSE 标准）
            "-movflags", "frag_keyframe+empty_moov+default_base_moof",  // fMP4 关键标志
            "-fflags", "nobuffer",              // 禁用缓冲
            "-flags", "low_delay",              // 低延迟
            "-f", "mp4",                        // MP4 容器
            "pipe:1",                           // 输出到 stdout
        ]);

        ffmpeg_cmd.args(&args);
        ffmpeg_cmd.stdout(std::process::Stdio::piped());
        ffmpeg_cmd.stderr(std::process::Stdio::piped());

        let mut child = match ffmpeg_cmd.spawn() {
            Ok(child) => child,
            Err(e) => {
                log::error!("❌ 启动 FFmpeg 进程失败: {}", e);
                log::error!("   FFmpeg 路径: {}", ffmpeg_path);
                log::error!("   错误类型: {:?}", e.kind());
                
                // 尝试给出具体建议
                if e.kind() == std::io::ErrorKind::NotFound {
                    log::error!("💡 FFmpeg 未找到，请安装:");
                    log::error!("   Ubuntu/Debian: sudo apt install ffmpeg");
                    log::error!("   或添加 FFmpeg 到系统 PATH");
                }
                
                return Err(anyhow::anyhow!("启动 FFmpeg 进程失败: {} (路径: {})", e, ffmpeg_path));
            }
        };

        let pid = child.id().unwrap_or(0);
        log::info!("✅ FFmpeg 已启动: PID={} (路径: {})", pid, ffmpeg_path);

        // 获取 stdout 和 stderr
        let stdout = child.stdout.take().context("无法获取 FFmpeg stdout")?;
        let stderr = child.stderr.take().context("无法获取 FFmpeg stderr")?;

        // 存储进程
        {
            let mut processes = self.processes.write().await;
            processes.insert(camera_id, child);
        }

        // 启动 stdout 读取任务（读取 fMP4 数据并广播）
        let tx_clone = tx.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut buffer = vec![0u8; 8192]; // 8KB 缓冲区

            loop {
                match reader.read(&mut buffer).await {
                    Ok(0) => {
                        log::warn!("FFmpeg stdout 已关闭 (camera_id={})", camera_id);
                        break;
                    }
                    Ok(n) => {
                        // 广播 fMP4 数据给所有订阅者
                        let chunk = buffer[..n].to_vec();
                        if tx_clone.send(chunk).is_err() {
                            log::debug!("没有订阅者，停止广播 (camera_id={})", camera_id);
                            break;
                        }
                    }
                    Err(e) => {
                        log::error!("读取 FFmpeg stdout 失败: {}", e);
                        break;
                    }
                }
            }
        });

        // 启动 stderr 日志任务
        let camera_id_clone = camera_id;
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                // 忽略 "Broken pipe" 错误（这是正常的流停止信号）
                if line.contains("Broken pipe") {
                    log::debug!("FFmpeg[{}] 流已停止 (Broken pipe)", camera_id_clone);
                    break; // 停止读取日志
                }
                
                // 只记录错误和警告
                if line.contains("error") || line.contains("Error") {
                    log::error!("FFmpeg[{}] 错误: {}", camera_id_clone, line);
                } else if line.contains("warning") || line.contains("Warning") {
                    log::warn!("FFmpeg[{}] 警告: {}", camera_id_clone, line);
                }
            }
        });

        Ok(())
    }

    /// 停止流
    pub async fn stop_stream(&self, camera_id: u32) {
        log::info!("🛑 停止 MSE 流: camera_id={}", camera_id);

        // 1. 先停止 FFmpeg 进程（避免 Broken pipe 错误）
        {
            let mut processes = self.processes.write().await;
            if let Some(mut child) = processes.remove(&camera_id) {
                let _ = child.kill().await;
                let _ = child.wait().await;
                log::info!("✅ FFmpeg 进程已停止 (camera_id={})", camera_id);
            }
        }

        // 2. 然后移除广播器（断开所有订阅者）
        {
            let mut broadcasters = self.broadcasters.write().await;
            broadcasters.remove(&camera_id);
        }
    }

    /// 订阅流（获取广播接收器）
    pub async fn subscribe(&self, camera_id: u32) -> Option<broadcast::Receiver<Vec<u8>>> {
        let broadcasters = self.broadcasters.read().await;
        broadcasters.get(&camera_id).map(|tx| tx.subscribe())
    }

    /// 检查流是否活跃
    pub async fn is_stream_active(&self, camera_id: u32) -> bool {
        let processes = self.processes.read().await;
        processes.contains_key(&camera_id)
    }
}

use once_cell::sync::Lazy;

/// 全局 MSE 流管理器实例
static MSE_STREAMER: Lazy<Arc<MseStreamer>> = Lazy::new(|| Arc::new(MseStreamer::new()));

pub fn get_mse_streamer() -> Arc<MseStreamer> {
    MSE_STREAMER.clone()
}

