use anyhow::Result;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, State, WebSocketUpgrade,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::Mutex;

use super::get_global_streamer;

/// WebSocket 服务器状态
#[derive(Clone)]
struct WsState {
    // 可以添加其他共享状态
}

/// 启动 WebSocket 服务器（用于推送 MJPEG 帧）
pub async fn start_websocket_server(port: u16) -> Result<()> {
    let state = WsState {};

    let app = Router::new()
        .route("/mjpeg/:camera_id", get(handle_mjpeg_websocket))
        .with_state(state);

    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    log::info!("GStreamer MJPEG WebSocket 服务器启动于: ws://{}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

/// 处理 MJPEG WebSocket 连接
async fn handle_mjpeg_websocket(
    Path(camera_id): Path<u32>,
    ws: WebSocketUpgrade,
    State(_state): State<WsState>,
) -> impl IntoResponse {
    log::info!("新的 MJPEG WebSocket 连接: camera_id={}", camera_id);

    ws.on_upgrade(move |socket| handle_mjpeg_stream(socket, camera_id))
}

/// 处理单个 WebSocket 连接的 MJPEG 流
async fn handle_mjpeg_stream(socket: WebSocket, camera_id: u32) {
    let (ws_sender, mut ws_receiver) = socket.split();
    let ws_sender = Arc::new(Mutex::new(ws_sender));

    // 获取全局流管理器
    let streamer_arc = match get_global_streamer().await {
        Ok(s) => s,
        Err(e) => {
            log::error!("无法获取流管理器: {}", e);
            return;
        }
    };

    // 订阅 JPEG 流
    let receiver = {
        let streamer_guard = streamer_arc.read().await;
        if let Some(streamer) = streamer_guard.as_ref() {
            match streamer.subscribe(camera_id).await {
                Some(rx) => rx,
                None => {
                    log::warn!("摄像头 {} 的流不存在", camera_id);
                    let _ = ws_sender
                        .lock()
                        .await
                        .send(Message::Text(format!(
                            "{{\"error\":\"摄像头 {} 的流不存在\"}}",
                            camera_id
                        )))
                        .await;
                    return;
                }
            }
        } else {
            log::error!("流管理器未初始化");
            return;
        }
    };

    let mut receiver = receiver;

    // 发送就绪消息
    let _ = ws_sender
        .lock()
        .await
        .send(Message::Text(format!(
            "{{\"ready\":true,\"camera_id\":{}}}",
            camera_id
        )))
        .await;

    log::info!("开始推送 MJPEG 流: camera_id={}", camera_id);

    // 持续推送 JPEG 数据（优化版本：减少锁竞争）
    loop {
        tokio::select! {
            // 接收 JPEG 数据并推送
            jpeg_result = receiver.recv() => {
                match jpeg_result {
                    Ok(jpeg_data) => {
                        // 发送二进制数据（JPEG 帧）
                        // 减少 Mutex 锁持有时间
                        let send_result = {
                            let mut sender = ws_sender.lock().await;
                            sender.send(Message::Binary(jpeg_data)).await
                        };
                        
                        if let Err(e) = send_result {
                            log::debug!("发送失败，客户端可能已断开: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        log::warn!("广播通道错误: {}", e);
                        break;
                    }
                }
            }
            // 接收客户端消息（处理关闭/ping）
            msg_result = ws_receiver.next() => {
                match msg_result {
                    Some(Ok(Message::Close(_))) | None => {
                        log::info!("客户端主动关闭连接 (camera_id={})", camera_id);
                        break;
                    }
                    Some(Ok(Message::Ping(data))) => {
                        let _ = ws_sender.lock().await.send(Message::Pong(data)).await;
                    }
                    Some(Err(e)) => {
                        log::error!("接收消息错误: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
        }
    }

    log::info!("MJPEG WebSocket 连接已关闭: camera_id={}", camera_id);
}

