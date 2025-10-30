use super::get_mse_streamer;
use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{accept_async, WebSocketStream};

/// WebSocket 服务器 - 推送 fMP4 流给前端
pub async fn start_websocket_server(port: u16) -> Result<()> {
    let addr = format!("127.0.0.1:{}", port);
    let listener = TcpListener::bind(&addr).await?;
    
    log::info!("🚀 MSE WebSocket 服务器启动: {}", addr);

    tokio::spawn(async move {
        while let Ok((stream, peer)) = listener.accept().await {
            tokio::spawn(handle_websocket_connection(stream, peer));
        }
    });

    Ok(())
}

/// 处理单个 WebSocket 连接
async fn handle_websocket_connection(stream: TcpStream, peer: SocketAddr) {
    log::info!("🔌 新的 WebSocket 连接: {}", peer);

    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            log::error!("WebSocket 握手失败: {}", e);
            return;
        }
    };

    if let Err(e) = handle_client(ws_stream, peer).await {
        log::error!("WebSocket 客户端处理错误 ({}): {}", peer, e);
    }

    log::info!("🔌 WebSocket 连接已断开: {}", peer);
}

/// 处理客户端请求
async fn handle_client(
    ws_stream: WebSocketStream<TcpStream>,
    peer: SocketAddr,
) -> Result<()> {
    let (ws_sender, mut ws_receiver) = ws_stream.split();
    let ws_sender = Arc::new(Mutex::new(ws_sender));

    // 等待客户端发送订阅消息：{"camera_id": 3}
    let camera_id = match ws_receiver.next().await {
        Some(Ok(Message::Text(text))) => {
            // 解析 JSON
            let json: serde_json::Value = serde_json::from_str(&text)?;
            json["camera_id"].as_u64().unwrap_or(0) as u32
        }
        _ => {
            log::warn!("客户端未发送订阅消息");
            return Ok(());
        }
    };

    log::info!("📡 客户端 {} 订阅摄像头: {}", peer, camera_id);

    // 订阅 fMP4 流
    let streamer = get_mse_streamer();
    let mut receiver = match streamer.subscribe(camera_id).await {
        Some(rx) => rx,
        None => {
            log::warn!("摄像头 {} 的流不存在", camera_id);
            let _ = ws_sender.lock().await.send(Message::Text(
                serde_json::json!({"error": "Stream not found"}).to_string()
            )).await;
            return Ok(());
        }
    };

    // 发送就绪消息
    ws_sender
        .lock()
        .await
        .send(Message::Text(
            serde_json::json!({"status": "ready"}).to_string()
        ))
        .await?;

    // 持续推送 fMP4 数据
    loop {
        tokio::select! {
            // 接收 fMP4 数据并推送
            chunk_result = receiver.recv() => {
                match chunk_result {
                    Ok(chunk) => {
                        // 发送二进制数据（fMP4 片段）
                        if let Err(e) = ws_sender.lock().await.send(Message::Binary(chunk)).await {
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
                        log::info!("客户端主动关闭连接");
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

    Ok(())
}

