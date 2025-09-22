// 媒体相关命令
use crate::config::AppConfig;
use crate::database::VehicleDatabase;
use crate::rtsp_converter::{RTSPConverter, HLSServer};
use crate::udp_video::{UdpVideoManager, ServerStats};
use crate::rtsp_stream;
use log::{info, warn, error};
use tauri::Manager;
use std::sync::Arc;
use tokio::sync::Mutex;

// UDP视频服务器全局管理器
static UDP_VIDEO_MANAGER: once_cell::sync::Lazy<Arc<Mutex<UdpVideoManager>>> = 
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(UdpVideoManager::new())));

/// 启动视频流服务器
#[tauri::command]
pub async fn start_video_stream_server(app: tauri::AppHandle, port: u16) -> Result<String, String> {
    info!("开始启动视频流服务器，端口: {}", port);
    
    let db = app.state::<VehicleDatabase>();
    let db_clone = {
        let db_ref: &VehicleDatabase = db.inner();
        db_ref.clone()
    };
    let server = rtsp_stream::VideoStreamServer::new(port, std::sync::Arc::new(db_clone));
    
    // 在后台启动视频流服务器
    let port_for_log = port; // 为闭包捕获端口
    tokio::spawn(async move {
        match server.start().await {
            Ok(_) => {
                info!("✅ 视频流服务器启动成功: 0.0.0.0:{}", port_for_log);
            }
            Err(e) => {
                let error_msg = e.to_string();
                if error_msg.contains("Address already in use") {
                    warn!("ℹ️ 视频流服务器端口{}已被占用，可能已有实例在运行", port_for_log);
                } else {
                    error!("❌ 视频流服务器启动失败: {}", e);
                }
            }
        }
    });
    
    // 给服务器一点时间启动
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    let result = format!("视频流服务器启动在端口: {}", port);
    Ok(result)
}

/// 获取摄像头流URL
#[tauri::command]
pub async fn get_camera_stream_url(camera_id: i64, server_port: Option<u16>) -> Result<String, String> {
    let port = server_port.unwrap_or(AppConfig::global().ports.video_stream_server);
    let url = format!("http://127.0.0.1:{}/stream/{}", port, camera_id);
    Ok(url)
}

/// 获取摄像头WebSocket URL
#[tauri::command]
pub async fn get_camera_websocket_url(camera_id: i64, server_port: Option<u16>) -> Result<String, String> {
    let port = server_port.unwrap_or(AppConfig::global().ports.video_stream_server);
    let url = format!("ws://127.0.0.1:{}/ws/camera/{}", port, camera_id);
    Ok(url)
}

/// 启动RTSP到HLS转换
#[tauri::command]
pub async fn start_rtsp_conversion(
    app: tauri::AppHandle,
    camera_id: i64,
    rtsp_url: String
) -> Result<String, String> {
    info!("🔄 启动RTSP转换: camera_id={}, rtsp_url={}", camera_id, rtsp_url);
    
    // 检查是否已有转换器实例
    let converter = match app.try_state::<RTSPConverter>() {
        Some(converter) => converter.inner().clone(),
        None => {
            // 创建新的转换器实例
            let output_dir = std::env::temp_dir().join("dz_viz_hls");
            let converter = RTSPConverter::new(output_dir);
            app.manage(converter);
            app.state::<RTSPConverter>().inner().clone()
        }
    };
    
    match converter.start_conversion(camera_id, rtsp_url).await {
        Ok(hls_url) => Ok(hls_url),
        Err(e) => Err(format!("启动RTSP转换失败: {}", e))
    }
}

/// 停止RTSP转换
#[tauri::command]
pub async fn stop_rtsp_conversion(app: tauri::AppHandle, camera_id: i64) -> Result<String, String> {
    if let Some(converter) = app.try_state::<RTSPConverter>() {
        match converter.stop_conversion(camera_id).await {
            Ok(_) => Ok("转换已停止".to_string()),
            Err(e) => Err(format!("停止RTSP转换失败: {}", e))
        }
    } else {
        Err("RTSP转换器未初始化".to_string())
    }
}

/// 获取HLS流URL
#[tauri::command]
pub async fn get_hls_url(app: tauri::AppHandle, camera_id: i64, hls_port: Option<u16>) -> Result<String, String> {
    let port = hls_port.unwrap_or(AppConfig::global().ports.hls_server);
    
    if let Some(converter) = app.try_state::<RTSPConverter>() {
        if let Some(stream_info) = converter.get_stream_info(camera_id).await {
            let url = format!("http://127.0.0.1:{}{}", port, stream_info.hls_url);
            return Ok(url);
        }
    }
    
    Err("未找到对应的HLS流".to_string())
}

/// 启动HLS服务器
#[tauri::command]
pub async fn start_hls_server(app: tauri::AppHandle, port: Option<u16>) -> Result<String, String> {
    let hls_port = port.unwrap_or(AppConfig::global().ports.hls_server);
    info!("开始启动HLS服务器，端口: {}", hls_port);
    
    // 检查是否已有HLS服务器实例
    if app.try_state::<HLSServer>().is_some() {
        info!("HLS服务器已在运行");
        return Ok("HLS服务器已在运行".to_string());
    }
    
    let base_dir = std::env::temp_dir().join("dz_viz_hls");
    let hls_server = HLSServer::new(hls_port, base_dir);
    
    // 在后台启动HLS服务器
    let server_clone = HLSServer::new(hls_port, std::env::temp_dir().join("dz_viz_hls"));
    let port_for_log = hls_port; // 为闭包捕获端口
    tokio::spawn(async move {
        match server_clone.start().await {
            Ok(_) => {
                info!("✅ HLS服务器启动成功: 0.0.0.0:{}", port_for_log);
            }
            Err(e) => {
                error!("❌ HLS服务器启动失败: {}", e);
            }
        }
    });
    
    app.manage(hls_server);
    Ok(format!("HLS服务器已启动在端口: {}", hls_port))
}

/// 启动UDP视频服务器
#[tauri::command]
pub async fn start_udp_video_server(app: tauri::AppHandle, port: Option<u16>) -> Result<String, String> {
    let actual_port = port.unwrap_or(AppConfig::global().ports.udp_video_server);
    let bind_addr = format!("0.0.0.0:{}", actual_port);
    info!("开始启动UDP视频服务器，端口: {}", actual_port);
    
    let mut manager = UDP_VIDEO_MANAGER.lock().await;
    
    manager.start_server(&bind_addr, Some(app)).await
        .map_err(|e| format!("启动UDP视频服务器失败: {}", e))?;
    
    info!("✅ UDP视频服务器启动成功: {}", bind_addr);
    Ok(format!("UDP视频服务器已启动在端口: {}", actual_port))
}

/// 停止UDP视频服务器
#[tauri::command]
pub async fn stop_udp_video_server() -> Result<String, String> {
    let mut manager = UDP_VIDEO_MANAGER.lock().await;
    manager.stop_server().await;
    Ok("UDP视频服务器已停止".to_string())
}

/// 获取UDP视频服务器状态
#[tauri::command]
pub async fn get_udp_video_server_stats() -> Result<Option<ServerStats>, String> {
    let manager = UDP_VIDEO_MANAGER.lock().await;
    Ok(manager.get_stats().await)
}

/// 获取媒体服务器端口配置
#[tauri::command]
pub async fn get_media_server_ports() -> Result<serde_json::Value, String> {
    let config = AppConfig::global();
    Ok(serde_json::json!({
        "video_stream_server": config.ports.video_stream_server,
        "hls_server": config.ports.hls_server,
        "udp_video_server": config.ports.udp_video_server
    }))
}