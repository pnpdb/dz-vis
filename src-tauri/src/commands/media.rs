// 媒体和流相关命令
use crate::rtsp_converter::{RTSPConverter, HLSServer};
use crate::udp_video::{UdpVideoManager, ServerStats};
use std::sync::Arc;
use tokio::sync::Mutex;
use log::{info, warn, error};
use tauri::Manager;

// 全局静态变量
static UDP_VIDEO_MANAGER: once_cell::sync::Lazy<Arc<Mutex<UdpVideoManager>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(UdpVideoManager::new())));

/// 启动视频流服务器
#[tauri::command]
pub async fn start_video_stream_server(app: tauri::AppHandle, port: u16) -> Result<String, String> {
    use axum::{
        routing::get,
        Router,
        response::Html,
        extract::Path
    };
    use tower_http::cors::CorsLayer;
    use std::net::SocketAddr;
    
    let app_router = Router::new()
        .route("/", get(|| async { Html("<h1>视频流服务器运行中</h1>") }))
        .route("/stream/:camera_id", get(handle_video_stream))
        .layer(CorsLayer::permissive());
    
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    
    tokio::spawn(async move {
        if let Err(e) = axum::serve(
            tokio::net::TcpListener::bind(&addr).await.unwrap(),
            app_router
        ).await {
            error!("视频流服务器运行失败: {}", e);
        }
    });
    
    info!("视频流服务器启动成功，端口: {}", port);
    Ok(format!("视频流服务器启动成功，端口: {}", port))
}

async fn handle_video_stream(Path(camera_id): Path<i64>) -> String {
    format!("处理摄像头 {} 的视频流", camera_id)
}

/// 获取摄像头流URL
#[tauri::command]
pub async fn get_camera_stream_url(camera_id: i64, server_port: Option<u16>) -> Result<String, String> {
    let port = server_port.unwrap_or(8081);
    Ok(format!("http://localhost:{}/stream/{}", port, camera_id))
}

/// 获取摄像头WebSocket URL
#[tauri::command]
pub async fn get_camera_websocket_url(camera_id: i64, server_port: Option<u16>) -> Result<String, String> {
    let port = server_port.unwrap_or(8082);
    Ok(format!("ws://localhost:{}/ws/{}", port, camera_id))
}

/// 开始RTSP转换
#[tauri::command]
pub async fn start_rtsp_conversion(
    app: tauri::AppHandle,
    camera_id: i64,
    rtsp_url: String,
    output_port: Option<u16>
) -> Result<String, String> {
    let converter = match app.try_state::<Arc<Mutex<RTSPConverter>>>() {
        Some(converter) => converter,
        None => {
            let new_converter = Arc::new(Mutex::new(RTSPConverter::new()));
            app.manage(new_converter.clone());
            new_converter
        }
    };
    
    let port = output_port.unwrap_or(8080);
    
    match converter.lock().await.start_conversion(camera_id, rtsp_url.clone(), port).await {
        Ok(_) => {
            info!("RTSP转换启动成功 - 摄像头ID: {}, URL: {}, 输出端口: {}", camera_id, rtsp_url, port);
            Ok(format!("RTSP转换启动成功，输出端口: {}", port))
        }
        Err(e) => {
            error!("RTSP转换启动失败: {}", e);
            Err(format!("RTSP转换启动失败: {}", e))
        }
    }
}

/// 停止RTSP转换
#[tauri::command]
pub async fn stop_rtsp_conversion(app: tauri::AppHandle, camera_id: i64) -> Result<String, String> {
    let converter = match app.try_state::<Arc<Mutex<RTSPConverter>>>() {
        Some(converter) => converter,
        None => return Err("RTSP转换器未初始化".to_string())
    };
    
    match converter.lock().await.stop_conversion(camera_id).await {
        Ok(_) => {
            info!("RTSP转换停止成功 - 摄像头ID: {}", camera_id);
            Ok("RTSP转换已停止".to_string())
        }
        Err(e) => {
            error!("停止RTSP转换失败: {}", e);
            Err(format!("停止RTSP转换失败: {}", e))
        }
    }
}

/// 获取HLS URL
#[tauri::command]
pub async fn get_hls_url(app: tauri::AppHandle, camera_id: i64, hls_port: Option<u16>) -> Result<String, String> {
    let port = hls_port.unwrap_or(8083);
    Ok(format!("http://localhost:{}/hls/camera_{}/playlist.m3u8", port, camera_id))
}

/// 启动HLS服务器
#[tauri::command]
pub async fn start_hls_server(app: tauri::AppHandle, port: Option<u16>) -> Result<String, String> {
    let hls_server = match app.try_state::<Arc<Mutex<HLSServer>>>() {
        Some(server) => server,
        None => {
            let new_server = Arc::new(Mutex::new(HLSServer::new()));
            app.manage(new_server.clone());
            new_server
        }
    };
    
    let server_port = port.unwrap_or(8083);
    
    match hls_server.lock().await.start(server_port).await {
        Ok(_) => {
            info!("HLS服务器启动成功，端口: {}", server_port);
            Ok(format!("HLS服务器启动成功，端口: {}", server_port))
        }
        Err(e) => {
            error!("HLS服务器启动失败: {}", e);
            Err(format!("HLS服务器启动失败: {}", e))
        }
    }
}

/// 启动UDP视频服务器
#[tauri::command]
pub async fn start_udp_video_server(app: tauri::AppHandle, port: u16) -> Result<String, String> {
    let mut manager = UDP_VIDEO_MANAGER.lock().await;
    let addr = format!("0.0.0.0:{}", port);
    
    match manager.start_server(&addr, Some(app.handle().clone())).await {
        Ok(_) => {
            info!("UDP视频服务器启动成功: {}", addr);
            Ok(format!("UDP视频服务器启动成功: {}", addr))
        }
        Err(e) => {
            error!("UDP视频服务器启动失败: {}", e);
            Err(format!("UDP视频服务器启动失败: {}", e))
        }
    }
}

/// 停止UDP视频服务器
#[tauri::command]
pub async fn stop_udp_video_server() -> Result<String, String> {
    let mut manager = UDP_VIDEO_MANAGER.lock().await;
    
    match manager.stop_server().await {
        Ok(_) => {
            info!("UDP视频服务器已停止");
            Ok("UDP视频服务器已停止".to_string())
        }
        Err(e) => {
            error!("停止UDP视频服务器失败: {}", e);
            Err(format!("停止UDP视频服务器失败: {}", e))
        }
    }
}

/// 获取UDP视频服务器统计信息
#[tauri::command]
pub async fn get_udp_video_server_stats() -> Result<Option<ServerStats>, String> {
    let manager = UDP_VIDEO_MANAGER.lock().await;
    Ok(manager.get_stats().cloned())
}
