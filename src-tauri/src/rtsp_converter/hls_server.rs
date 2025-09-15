use axum::{
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::path::PathBuf;
use tokio::fs;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
pub struct HLSServerState {
    pub base_dir: PathBuf,
}

pub struct HLSServer {
    port: u16,
    base_dir: PathBuf,
}

impl HLSServer {
    pub fn new(port: u16, base_dir: PathBuf) -> Self {
        Self { port, base_dir }
    }

    /// 启动HLS服务器
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let state = HLSServerState {
            base_dir: self.base_dir.clone(),
        };

        let app = Router::new()
            .route("/hls/:camera_id/:file", get(serve_hls_file))
            .route("/hls/:camera_id/playlist.m3u8", get(serve_playlist))
            .layer(CorsLayer::permissive())
            .with_state(state);

        let addr = format!("127.0.0.1:{}", self.port);
        println!("🎥 HLS服务器启动在: http://{}", addr);

        let listener = tokio::net::TcpListener::bind(&addr).await?;
        axum::serve(listener, app).await?;

        Ok(())
    }
}

/// 提供HLS播放列表文件
async fn serve_playlist(
    Path(camera_id): Path<String>,
    State(state): State<HLSServerState>,
) -> Result<Response, StatusCode> {
    let file_path = state.base_dir.join(&camera_id).join("playlist.m3u8");
    
    serve_file_with_headers(file_path, "application/vnd.apple.mpegurl").await
}

/// 提供HLS文件（播放列表和视频片段）
async fn serve_hls_file(
    Path((camera_id, file)): Path<(String, String)>,
    State(state): State<HLSServerState>,
) -> Result<Response, StatusCode> {
    let file_path = state.base_dir.join(&camera_id).join(&file);
    
    // 根据文件扩展名设置MIME类型
    let content_type = if file.ends_with(".m3u8") {
        "application/vnd.apple.mpegurl"
    } else if file.ends_with(".ts") {
        "video/MP2T"
    } else {
        "application/octet-stream"
    };
    
    serve_file_with_headers(file_path, content_type).await
}

/// 通用文件服务函数
async fn serve_file_with_headers(
    file_path: PathBuf,
    content_type: &str,
) -> Result<Response, StatusCode> {
    if !file_path.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    match fs::read(&file_path).await {
        Ok(contents) => {
            let mut headers = HeaderMap::new();
            headers.insert("content-type", HeaderValue::from_str(content_type).unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")));
            headers.insert("cache-control", HeaderValue::from_static("no-cache"));
            headers.insert("access-control-allow-origin", HeaderValue::from_static("*"));
            headers.insert("access-control-allow-headers", HeaderValue::from_static("*"));
            
            Ok((StatusCode::OK, headers, contents).into_response())
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
