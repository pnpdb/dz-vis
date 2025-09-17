use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::UdpSocket;
use tokio::sync::{broadcast, RwLock};
use tokio::time::timeout;
use tauri::Emitter;
use base64::Engine;

use super::protocol::{FrameAssembler, VideoPacket};

/// 视频帧数据
#[derive(Debug, Clone, serde::Serialize)]
pub struct VideoFrame {
    pub vehicle_id: u32,
    pub frame_id: u32,
    pub timestamp: u64,
    pub jpeg_data: String, // 直接使用base64字符串
}

/// UDP视频服务器
pub struct UdpVideoServer {
    socket: Arc<UdpSocket>,
    frame_sender: broadcast::Sender<VideoFrame>,
    assemblers: Arc<RwLock<HashMap<(u32, u32), FrameAssembler>>>, // (vehicle_id, frame_id) -> FrameAssembler
    running: Arc<RwLock<bool>>,
    app_handle: Option<tauri::AppHandle>,
}

impl UdpVideoServer {
    /// 创建新的UDP视频服务器
    pub async fn new(bind_addr: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let socket = UdpSocket::bind(bind_addr).await?;

        let (frame_sender, _) = broadcast::channel(100);

        Ok(Self {
            socket: Arc::new(socket),
            frame_sender,
            assemblers: Arc::new(RwLock::new(HashMap::new())),
            running: Arc::new(RwLock::new(false)),
            app_handle: None,
        })
    }

    /// 设置Tauri应用句柄
    pub fn set_app_handle(&mut self, app_handle: tauri::AppHandle) {
        self.app_handle = Some(app_handle);
    }

    /// 获取视频帧接收器
    pub fn subscribe(&self) -> broadcast::Receiver<VideoFrame> {
        self.frame_sender.subscribe()
    }

    /// 启动服务器
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        {
            let mut running = self.running.write().await;
            if *running {
                return Ok(());
            }
            *running = true;
        }


        // 启动清理任务
        let assemblers_clone = Arc::clone(&self.assemblers);
        let running_clone = Arc::clone(&self.running);
        tokio::spawn(async move {
            Self::cleanup_task(assemblers_clone, running_clone).await;
        });

        // 主循环
        loop {
            {
                let running = self.running.read().await;
                if !*running {
                    break;
                }
            }

            let mut buffer = vec![0u8; 65535]; // UDP最大包大小
            
            match timeout(Duration::from_millis(10), self.socket.recv_from(&mut buffer)).await {
                Ok(Ok((size, addr))) => {
                    buffer.truncate(size);
                    self.handle_packet(buffer, addr).await;
                }
                Ok(Err(_)) => {
                    break;
                }
                Err(_) => {
                    // 超时，继续循环检查running状态
                    continue;
                }
            }
        }

        Ok(())
    }

    /// 停止服务器
    pub async fn stop(&self) {
        let mut running = self.running.write().await;
        *running = false;
    }

    /// 处理接收到的数据包
    async fn handle_packet(&self, packet_data: Vec<u8>, _addr: SocketAddr) {
        
        match VideoPacket::from_udp_packet(&packet_data) {
            Ok(packet) => {
                // println!("📦 收到视频包: 车辆{}, 帧{}, 类型{:?}, 分片{}/{}", 
                //     packet.header.vehicle_id, packet.header.frame_id, 
                //     packet.header.frame_type, packet.header.fragment_index + 1, 
                //     packet.header.total_fragments);

                match packet.header.frame_type {
                    super::protocol::FrameType::Complete => {
                        // 完整帧，直接发送
                        let base64_data = base64::engine::general_purpose::STANDARD.encode(&packet.data);
                        let frame = VideoFrame {
                            vehicle_id: packet.header.vehicle_id,
                            frame_id: packet.header.frame_id,
                            timestamp: packet.header.timestamp,
                            jpeg_data: base64_data,
                        };

                        if let Err(_) = self.frame_sender.send(frame.clone()) {
                            // 没有订阅者，忽略错误
                        }

                        // 发送Tauri事件到前端
                        if let Some(app_handle) = &self.app_handle {
                            let _ = app_handle.emit_to("main", "udp-video-frame", &frame);
                        }
                    }
                    _ => {
                        // 分片帧，需要重组
                        self.handle_fragment(packet).await;
                    }
                }
            }
            Err(_) => {
                // 忽略解析失败的包
            }
        }
    }

    /// 处理分片帧
    async fn handle_fragment(&self, packet: VideoPacket) {
        let key = (packet.header.vehicle_id, packet.header.frame_id);
        
        let mut assemblers = self.assemblers.write().await;
        
        // 获取或创建重组器
        let assembler = assemblers.entry(key).or_insert_with(|| {
            FrameAssembler::new(&packet.header)
        });

        // 添加分片
        let is_complete = assembler.add_fragment(&packet.header, packet.data);
        
        if is_complete {
            // 重组完成
            if let Some(frame_data) = assembler.assemble_frame() {
                let base64_data = base64::engine::general_purpose::STANDARD.encode(&frame_data);
                let frame = VideoFrame {
                    vehicle_id: packet.header.vehicle_id,
                    frame_id: packet.header.frame_id,
                    timestamp: packet.header.timestamp,
                    jpeg_data: base64_data,
                };

                if let Err(_) = self.frame_sender.send(frame.clone()) {
                    // 没有订阅者，忽略错误
                }

                // 发送Tauri事件到前端
                if let Some(app_handle) = &self.app_handle {
                    let _ = app_handle.emit_to("main", "udp-video-frame", &frame);
                }
            }

            // 移除已完成的重组器
            assemblers.remove(&key);
        }
    }

    /// 清理超时的重组器
    async fn cleanup_task(
        assemblers: Arc<RwLock<HashMap<(u32, u32), FrameAssembler>>>,
        running: Arc<RwLock<bool>>,
    ) {
        let mut cleanup_interval = tokio::time::interval(Duration::from_secs(5));
        
        while *running.read().await {
            cleanup_interval.tick().await;
            
            let mut assemblers = assemblers.write().await;
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;
            
            // 移除超过5秒未完成的重组器
            assemblers.retain(|&(_vehicle_id, _frame_id), assembler| {
                now - assembler.timestamp < 5000
            });
        }
    }

    /// 获取服务器统计信息
    pub async fn get_stats(&self) -> ServerStats {
        let assemblers = self.assemblers.read().await;
        ServerStats {
            active_assemblers: assemblers.len(),
            is_running: *self.running.read().await,
        }
    }
}

/// 服务器统计信息
#[derive(Debug, Clone, serde::Serialize)]
pub struct ServerStats {
    pub active_assemblers: usize,
    pub is_running: bool,
}

/// UDP视频服务管理器
pub struct UdpVideoManager {
    server: Option<UdpVideoServer>,
    server_handle: Option<tokio::task::JoinHandle<()>>,
}

impl UdpVideoManager {
    pub fn new() -> Self {
        Self {
            server: None,
            server_handle: None,
        }
    }

    /// 启动UDP视频服务器
    pub async fn start_server(&mut self, bind_addr: &str, app_handle: Option<tauri::AppHandle>) -> Result<(), Box<dyn std::error::Error>> {
        if self.server.is_some() {
            println!("⚠️ UDP视频服务器已经启动");
            return Ok(());
        }

        let mut server = UdpVideoServer::new(bind_addr).await?;
        
        // 设置应用句柄
        if let Some(handle) = app_handle {
            server.set_app_handle(handle);
        }
        
        let server_clone = server.clone();
        
        let handle = tokio::spawn(async move {
            if let Err(e) = server_clone.start().await {
                println!("❌ UDP视频服务器运行错误: {}", e);
            }
        });

        self.server = Some(server);
        self.server_handle = Some(handle);
        
        println!("✅ UDP视频服务器已启动: {}", bind_addr);
        Ok(())
    }

    /// 停止UDP视频服务器
    pub async fn stop_server(&mut self) {
        if let Some(server) = &self.server {
            server.stop().await;
        }

        if let Some(handle) = self.server_handle.take() {
            handle.abort();
        }

        self.server = None;
        println!("🛑 UDP视频服务器已停止");
    }

    /// 获取视频帧订阅器
    pub fn subscribe_frames(&self) -> Option<broadcast::Receiver<VideoFrame>> {
        self.server.as_ref().map(|s| s.subscribe())
    }

    /// 获取服务器统计信息
    pub async fn get_stats(&self) -> Option<ServerStats> {
        match &self.server {
            Some(server) => Some(server.get_stats().await),
            None => None,
        }
    }
}

impl Clone for UdpVideoServer {
    fn clone(&self) -> Self {
        Self {
            socket: Arc::clone(&self.socket),
            frame_sender: self.frame_sender.clone(),
            assemblers: Arc::clone(&self.assemblers),
            running: Arc::clone(&self.running),
            app_handle: self.app_handle.clone(),
        }
    }
}
