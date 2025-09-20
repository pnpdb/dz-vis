use axum::{
    extract::{ws::WebSocket, WebSocketUpgrade},
    response::Response,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock, Mutex};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use base64::prelude::*;

/// RTSP流状态
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct RTSPStreamState {
    pub url: String,
    pub is_active: bool,
    pub viewers: usize,
}

/// WebSocket消息类型
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WSMessage {
    #[serde(rename = "start_stream")]
    StartStream { camera_id: i64, rtsp_url: String },
    #[serde(rename = "stop_stream")]
    StopStream { camera_id: i64 },
    #[serde(rename = "frame_data")]
    FrameData { camera_id: i64, data: String, timestamp: u64 },
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "status")]
    Status { camera_id: i64, status: String },
}

/// RTSP代理服务
pub struct RTSPProxy {
    streams: Arc<RwLock<HashMap<i64, RTSPStreamState>>>,
    frame_sender: broadcast::Sender<(i64, Vec<u8>)>,
}

impl RTSPProxy {
    pub fn new() -> Self {
        let (frame_sender, _) = broadcast::channel(100);
        Self {
            streams: Arc::new(RwLock::new(HashMap::new())),
            frame_sender,
        }
    }

    /// 处理WebSocket连接
    pub async fn handle_websocket(
        &self,
        ws: WebSocketUpgrade,
        camera_id: i64,
    ) -> Response {
        let streams = self.streams.clone();
        let frame_receiver = self.frame_sender.subscribe();
        let frame_sender = self.frame_sender.clone();
        
        log::info!("✅ 接受WebSocket连接: camera_id={}", camera_id);
        
        ws.on_upgrade(move |socket| async move {
            Self::handle_socket(socket, camera_id, streams, frame_receiver, frame_sender).await;
        })
    }

    /// 处理单个WebSocket连接
    async fn handle_socket(
        socket: WebSocket,
        camera_id: i64,
        streams: Arc<RwLock<HashMap<i64, RTSPStreamState>>>,
        mut frame_receiver: broadcast::Receiver<(i64, Vec<u8>)>,
        frame_sender: broadcast::Sender<(i64, Vec<u8>)>,
    ) {
        let (sender, mut receiver) = socket.split();
        let sender = Arc::new(Mutex::new(sender));

        // 启动帧数据转发任务
        let frame_task = {
            let sender_clone = sender.clone();
            tokio::spawn(async move {
                while let Ok((stream_id, frame_data)) = frame_receiver.recv().await {
                    if stream_id == camera_id {
                        let message = WSMessage::FrameData {
                            camera_id: stream_id,
                            data: base64::prelude::BASE64_STANDARD.encode(&frame_data),
                            timestamp: chrono::Utc::now().timestamp_millis() as u64,
                        };
                        
                        if let Ok(json) = serde_json::to_string(&message) {
                            let mut sender_guard = sender_clone.lock().await;
                            if sender_guard.send(axum::extract::ws::Message::Text(json)).await.is_err() {
                                break;
                            }
                        }
                    }
                }
            })
        };

        // 处理客户端消息
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(axum::extract::ws::Message::Text(text)) => {
                    if let Ok(ws_msg) = serde_json::from_str::<WSMessage>(&text) {
                        match ws_msg {
                            WSMessage::StartStream { camera_id, rtsp_url } => {
                                log::info!("🎥 启动RTSP流: {} -> {}", camera_id, rtsp_url);
                                
                                // 更新流状态
                                {
                                    let mut streams_guard = streams.write().await;
                                    streams_guard.insert(camera_id, RTSPStreamState {
                                        url: rtsp_url.clone(),
                                        is_active: true,
                                        viewers: 1,
                                    });
                                }

                                // 发送连接成功状态
                                let status_msg = WSMessage::Status {
                                    camera_id,
                                    status: "streaming".to_string(),
                                };
                                
                                if let Ok(status_json) = serde_json::to_string(&status_msg) {
                                    let mut sender_guard = sender.lock().await;
                                    if let Err(e) = sender_guard.send(axum::extract::ws::Message::Text(status_json)).await {
                                        log::warn!("❌ 发送状态消息失败: {}", e);
                                    } else {
                                        log::debug!("📡 已发送流状态: streaming");
                                    }
                                }

                                // 启动RTSP流处理
                                Self::start_rtsp_stream(camera_id, rtsp_url, frame_sender.clone()).await;
                            }
                            WSMessage::StopStream { camera_id } => {
                                log::info!("🛑 停止RTSP流: {}", camera_id);
                                
                                let mut streams_guard = streams.write().await;
                                streams_guard.remove(&camera_id);
                            }
                            _ => {}
                        }
                    }
                }
                Ok(axum::extract::ws::Message::Close(_)) => {
                    log::debug!("📱 WebSocket连接关闭");
                    break;
                }
                Err(e) => {
                    log::error!("❌ WebSocket错误: {}", e);
                    break;
                }
                _ => {}
            }
        }

        // 清理任务
        frame_task.abort();
    }

    /// 启动RTSP流处理
    async fn start_rtsp_stream(camera_id: i64, rtsp_url: String, _frame_sender: broadcast::Sender<(i64, Vec<u8>)>) {
        tokio::spawn(async move {
            log::debug!("🔄 准备连接RTSP流: {} -> {}", camera_id, rtsp_url);
            
            // 这里为真实的RTSP流连接做准备
            // 实际的RTSP处理将通过您的推流服务来完成
            // 当前只是确保WebSocket连接建立成功
            
            log::info!("✅ RTSP流连接已准备就绪: camera_id={}, url={}", camera_id, rtsp_url);
            
            // 真实的RTSP流处理逻辑可以在这里添加
            // 例如使用FFmpeg或其他RTSP客户端库来接收和转码RTSP流
            // 然后通过frame_sender发送处理后的帧数据
        });
    }

}

impl Default for RTSPProxy {
    fn default() -> Self {
        Self::new()
    }
}
