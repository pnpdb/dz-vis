use axum::{
    extract::{ws::WebSocket, WebSocketUpgrade},
    response::Response,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use base64::prelude::*;

/// RTSP流状态
#[derive(Debug, Clone)]
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
        
        ws.on_upgrade(move |socket| async move {
            Self::handle_socket(socket, camera_id, streams, frame_receiver).await;
        })
    }

    /// 处理单个WebSocket连接
    async fn handle_socket(
        socket: WebSocket,
        camera_id: i64,
        streams: Arc<RwLock<HashMap<i64, RTSPStreamState>>>,
        mut frame_receiver: broadcast::Receiver<(i64, Vec<u8>)>,
    ) {
        let (sender, mut receiver) = socket.split();

        // 启动帧数据转发任务
        let frame_task = {
            let sender = sender;
            tokio::spawn(async move {
                let mut sender = sender;
                while let Ok((stream_id, frame_data)) = frame_receiver.recv().await {
                    if stream_id == camera_id {
                        let message = WSMessage::FrameData {
                            camera_id: stream_id,
                            data: base64::prelude::BASE64_STANDARD.encode(&frame_data),
                            timestamp: chrono::Utc::now().timestamp_millis() as u64,
                        };
                        
                        if let Ok(json) = serde_json::to_string(&message) {
                            if sender.send(axum::extract::ws::Message::Text(json)).await.is_err() {
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
                                println!("🎥 启动RTSP流: {} -> {}", camera_id, rtsp_url);
                                
                                // 更新流状态
                                {
                                    let mut streams_guard = streams.write().await;
                                    streams_guard.insert(camera_id, RTSPStreamState {
                                        url: rtsp_url.clone(),
                                        is_active: true,
                                        viewers: 1,
                                    });
                                }

                                // 启动RTSP流处理（简化版本）
                                Self::start_rtsp_stream(camera_id, rtsp_url).await;
                            }
                            WSMessage::StopStream { camera_id } => {
                                println!("🛑 停止RTSP流: {}", camera_id);
                                
                                let mut streams_guard = streams.write().await;
                                streams_guard.remove(&camera_id);
                            }
                            _ => {}
                        }
                    }
                }
                Ok(axum::extract::ws::Message::Close(_)) => {
                    println!("📱 WebSocket连接关闭");
                    break;
                }
                Err(e) => {
                    println!("❌ WebSocket错误: {}", e);
                    break;
                }
                _ => {}
            }
        }

        // 清理任务
        frame_task.abort();
    }

    /// 启动RTSP流处理（简化版本 - 实际应用中需要FFmpeg）
    async fn start_rtsp_stream(camera_id: i64, rtsp_url: String) {
        tokio::spawn(async move {
            // 这里是简化的实现
            // 实际应用中需要使用FFmpeg来处理RTSP流
            println!("🔄 模拟RTSP流处理: {} -> {}", camera_id, rtsp_url);
            
            // 模拟发送帧数据
            let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(33)); // ~30 FPS
            let mut frame_counter = 0u64;
            
            loop {
                interval.tick().await;
                frame_counter += 1;
                
                // 生成模拟帧数据（实际应用中从FFmpeg获取）
                let _mock_frame = Self::generate_mock_frame(frame_counter);
                
                // 这里应该通过broadcast sender发送真实的帧数据
                // 由于我们没有真实的RTSP解码，这里只是演示结构
                
                if frame_counter > 1000 { // 防止无限循环
                    break;
                }
            }
        });
    }

    /// 生成模拟帧数据（用于测试）
    fn generate_mock_frame(frame_number: u64) -> Vec<u8> {
        // 生成一个简单的测试模式
        // 实际应用中这里是从FFmpeg解码得到的帧数据
        format!("Frame {}: Mock RTSP data", frame_number).into_bytes()
    }
}

impl Default for RTSPProxy {
    fn default() -> Self {
        Self::new()
    }
}
