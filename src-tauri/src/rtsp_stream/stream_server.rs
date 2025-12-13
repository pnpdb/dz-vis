use axum::{
    extract::{Path, State, WebSocketUpgrade},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use serde::Deserialize;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use crate::database::VehicleDatabase;
use crate::rtsp_stream::rtsp_proxy::RTSPProxy;

#[derive(Clone)]
pub struct VideoStreamState {
    pub db: Arc<VehicleDatabase>,
    pub rtsp_proxy: Arc<RTSPProxy>,
}

/// 查询参数
#[derive(Deserialize)]
#[allow(dead_code)]
pub struct StreamQuery {
    pub camera_id: Option<i64>,
}

/// 视频流服务器
pub struct VideoStreamServer {
    port: u16,
    state: VideoStreamState,
}

impl VideoStreamServer {
    pub fn new(port: u16, db: Arc<VehicleDatabase>) -> Self {
        Self {
            port,
            state: VideoStreamState { 
                db,
                rtsp_proxy: Arc::new(RTSPProxy::new()),
            },
        }
    }

    /// 启动视频流服务器
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let app = Router::new()
            .route("/stream/:camera_id", get(handle_stream))
            .route("/camera/list", get(get_camera_list))
            .route("/camera/:camera_id/info", get(get_camera_info))
            .route("/ws/camera/:camera_id", get(handle_websocket))
            .layer(CorsLayer::permissive())
            .with_state(self.state.clone());

        let addr = format!("127.0.0.1:{}", self.port);
        log::info!("🎥 视频流服务器启动在: http://{}", addr);

        let listener = tokio::net::TcpListener::bind(&addr).await?;
        axum::serve(listener, app).await?;

        Ok(())
    }
}

/// 处理视频流请求
async fn handle_stream(
    Path(camera_id): Path<i64>,
    State(state): State<VideoStreamState>,
) -> Result<Response, StatusCode> {
    // 从数据库获取摄像头信息
    let camera = match state.db.get_all_sandbox_cameras().await {
        Ok(cameras) => cameras.into_iter().find(|c| c.id == camera_id),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let camera = camera.ok_or(StatusCode::NOT_FOUND)?;

    match camera.camera_type.as_str() {
        "USB" => handle_usb_camera(camera.device_index.unwrap_or(0)).await,
        "RJ45" => handle_rtsp_camera(camera.rtsp_url.as_deref().unwrap_or_default()).await,
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

/// 处理USB摄像头流
async fn handle_usb_camera(device_index: i32) -> Result<Response, StatusCode> {
    // USB摄像头通常由前端的getUserMedia处理
    // 这里返回一个说明响应
    let response_body = format!(
        r#"{{
            "type": "usb",
            "device_index": {},
            "message": "USB摄像头请使用浏览器原生getUserMedia API访问",
            "method": "navigator.mediaDevices.getUserMedia"
        }}"#,
        device_index
    );

    let mut headers = HeaderMap::new();
    headers.insert("content-type", HeaderValue::from_static("application/json"));

    Ok((StatusCode::OK, headers, response_body).into_response())
}

/// 处理RTSP摄像头流
async fn handle_rtsp_camera(rtsp_url: &str) -> Result<Response, StatusCode> {
    if rtsp_url.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // 简化的RTSP处理：返回一个代理URL或建议
    let response_body = format!(
        r#"{{
            "type": "rtsp",
            "rtsp_url": "{}",
            "message": "RTSP流需要特殊处理，建议使用HLS转换或WebRTC",
            "suggestions": [
                "使用FFmpeg将RTSP转换为HLS",
                "使用WebRTC网关",
                "使用专门的视频播放器库如Video.js"
            ],
            "proxy_url": "/api/rtsp-proxy?url={}"
        }}"#,
        rtsp_url,
        urlencoding::encode(rtsp_url)
    );

    let mut headers = HeaderMap::new();
    headers.insert("content-type", HeaderValue::from_static("application/json"));

    Ok((StatusCode::OK, headers, response_body).into_response())
}

/// 获取摄像头列表
async fn get_camera_list(State(state): State<VideoStreamState>) -> Result<Response, StatusCode> {
    match state.db.get_all_sandbox_cameras().await {
        Ok(cameras) => {
            let json = serde_json::to_string(&cameras).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            let mut headers = HeaderMap::new();
            headers.insert("content-type", HeaderValue::from_static("application/json"));
            Ok((StatusCode::OK, headers, json).into_response())
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// 获取特定摄像头信息
async fn get_camera_info(
    Path(camera_id): Path<i64>,
    State(state): State<VideoStreamState>,
) -> Result<Response, StatusCode> {
    let camera = match state.db.get_all_sandbox_cameras().await {
        Ok(cameras) => cameras.into_iter().find(|c| c.id == camera_id),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    match camera {
        Some(camera) => {
            let json = serde_json::to_string(&camera).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            let mut headers = HeaderMap::new();
            headers.insert("content-type", HeaderValue::from_static("application/json"));
            Ok((StatusCode::OK, headers, json).into_response())
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// 处理WebSocket连接
async fn handle_websocket(
    Path(camera_id): Path<i64>,
    ws: WebSocketUpgrade,
    State(state): State<VideoStreamState>,
) -> Response {
    log::debug!("🔌 WebSocket连接请求: camera_id={}", camera_id);
    
    // 验证摄像头是否存在
    let camera_exists = match state.db.get_all_sandbox_cameras().await {
        Ok(cameras) => cameras.into_iter().any(|c| c.id == camera_id),
        Err(_) => false,
    };
    
    if !camera_exists {
        log::warn!("摄像头不存在: camera_id={}", camera_id);
        return ws.on_upgrade(|socket| async move {
            let _ = socket.close().await;
        });
    }
    
    state.rtsp_proxy.handle_websocket(ws, camera_id).await
}
