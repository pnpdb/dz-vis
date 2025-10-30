use anyhow::{Context, Result};
use log::{error, info, warn};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

/// MediaMTX 进程管理器
/// 
/// 职责：
/// 1. 在应用启动时启动 MediaMTX 进程
/// 2. 在应用退出时优雅地停止 MediaMTX 进程
/// 3. 提供 RTSP/RTMP 到 WebRTC 的转换能力
#[derive(Clone)]
pub struct MediaMTXManager {
    process: Arc<Mutex<Option<Child>>>,
}

impl MediaMTXManager {
    /// 创建新的 MediaMTX 管理器
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
        }
    }

    /// 启动 MediaMTX 服务
    /// 
    /// 会自动定位打包的 mediamtx 可执行文件和配置文件
    /// 支持开发环境和生产环境
    pub fn start(&self, app_handle: &AppHandle) -> Result<()> {
        // 检查是否已经在运行
        {
            let process_lock = self.process.lock().unwrap();
            if process_lock.is_some() {
                warn!("⚠️ MediaMTX 已经在运行");
                return Ok(());
            }
        }

        // 获取 MediaMTX 文件路径（兼顾开发和生产环境）
        let (mediamtx_binary, mediamtx_config, working_dir) = if cfg!(debug_assertions) {
            // 开发环境：使用 src-tauri/resources 目录
            let current_dir = std::env::current_dir().context("无法获取当前目录")?;
            info!("🔧 开发模式 - 当前工作目录: {:?}", current_dir);
            
            // 尝试几个可能的路径
            let possible_paths = vec![
                current_dir.join("resources"),                              // 如果当前在 src-tauri
                current_dir.join("src-tauri").join("resources"),           // 如果当前在项目根目录
                current_dir.parent().unwrap().join("resources"),            // 备用路径
            ];
            
            let resources_dir = possible_paths.into_iter()
                .find(|p| p.exists() && p.join("mediamtx").exists())
                .context("开发环境中未找到 resources/mediamtx")?;
            
            info!("🔧 开发模式 - 资源目录: {:?}", resources_dir);
            
            (
                resources_dir.join("mediamtx"),
                resources_dir.join("mediamtx.yml"),
                resources_dir
            )
        } else {
            // 生产环境：使用 Tauri 的资源目录
            let resource_path = app_handle
                .path()
                .resource_dir()
                .context("无法获取资源目录")?;
            
            info!("📦 生产模式 - 资源目录: {:?}", resource_path);
            
            (
                resource_path.join("mediamtx"),
                resource_path.join("mediamtx.yml"),
                resource_path
            )
        };

        info!("🚀 启动 MediaMTX...");
        info!("   可执行文件: {:?}", mediamtx_binary);
        info!("   配置文件: {:?}", mediamtx_config);
        info!("   工作目录: {:?}", working_dir);

        // 检查文件是否存在
        if !mediamtx_binary.exists() {
            error!("❌ MediaMTX 可执行文件不存在: {:?}", mediamtx_binary);
            return Err(anyhow::anyhow!("MediaMTX 可执行文件未找到"));
        }

        if !mediamtx_config.exists() {
            error!("❌ MediaMTX 配置文件不存在: {:?}", mediamtx_config);
            return Err(anyhow::anyhow!("MediaMTX 配置文件未找到"));
        }

        // 启动 MediaMTX 进程
        let child = Command::new(&mediamtx_binary)
            .arg(&mediamtx_config)
            .current_dir(&working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .context("启动 MediaMTX 进程失败")?;

        info!("✅ MediaMTX 已启动 (PID: {})", child.id());
        info!("📡 WebRTC 端点: http://127.0.0.1:8889");
        info!("📺 RTSP 监听: rtsp://127.0.0.1:8554");
        info!("📹 RTMP 监听: rtmp://127.0.0.1:1935");

        // 保存进程句柄
        {
            let mut process_lock = self.process.lock().unwrap();
            *process_lock = Some(child);
        }

        Ok(())
    }

    /// 停止 MediaMTX 服务
    pub fn stop(&self) {
        let mut process_lock = self.process.lock().unwrap();
        
        if let Some(mut child) = process_lock.take() {
            info!("🛑 正在停止 MediaMTX (PID: {})...", child.id());
            
            // 尝试优雅地终止进程
            match child.kill() {
                Ok(_) => {
                    match child.wait() {
                        Ok(status) => {
                            info!("✅ MediaMTX 已停止 (退出状态: {})", status);
                        }
                        Err(e) => {
                            error!("❌ 等待 MediaMTX 退出时出错: {}", e);
                        }
                    }
                }
                Err(e) => {
                    error!("❌ 停止 MediaMTX 时出错: {}", e);
                }
            }
        } else {
            warn!("⚠️ MediaMTX 未运行");
        }
    }

    /// 检查 MediaMTX 是否正在运行
    pub fn is_running(&self) -> bool {
        let process_lock = self.process.lock().unwrap();
        process_lock.is_some()
    }

    /// 获取 WebRTC 播放 URL
    /// 
    /// MediaMTX 使用 WHEP 协议提供 WebRTC 播放
    /// URL 格式: http://127.0.0.1:8889/{stream_name}/whep
    /// 
    /// # 参数
    /// - `stream_name`: 流名称（例如：camera_3）
    /// 
    /// # 返回
    /// WebRTC WHEP 端点 URL
    pub fn get_webrtc_url(stream_name: &str) -> String {
        format!("http://127.0.0.1:8889/{}/whep", stream_name)
    }

    /// 获取 RTSP 推流 URL
    /// 
    /// 用于将外部 RTSP 源推送到 MediaMTX
    /// URL 格式: rtsp://127.0.0.1:8554/{stream_name}
    /// 
    /// # 参数
    /// - `stream_name`: 流名称（例如：camera_3）
    /// 
    /// # 返回
    /// RTSP 推流端点 URL
    pub fn get_rtsp_publish_url(stream_name: &str) -> String {
        format!("rtsp://127.0.0.1:8554/{}", stream_name)
    }
}

impl Drop for MediaMTXManager {
    fn drop(&mut self) {
        self.stop();
    }
}

