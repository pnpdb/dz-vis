use super::protocol::{ProtocolParser, SocketMessage, build_message};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;

// 客户端连接信息
#[derive(Debug, Clone)]
pub struct ClientConnection {
    pub car_id: String,
    pub addr: SocketAddr,
    pub sender: mpsc::UnboundedSender<Vec<u8>>,
}

// 全局连接管理器
pub type ConnectionManager = Arc<RwLock<HashMap<String, ClientConnection>>>;

// Socket服务器
pub struct SocketServer {
    port: u16,
    connections: ConnectionManager,
    app_handle: tauri::AppHandle,
}

impl SocketServer {
    pub fn new(port: u16, app_handle: tauri::AppHandle) -> Self {
        Self {
            port,
            connections: Arc::new(RwLock::new(HashMap::new())),
            app_handle,
        }
    }

    /// 启动Socket服务器
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let addr = format!("0.0.0.0:{}", self.port);
        let listener = TcpListener::bind(&addr).await?;
        
        println!("🚀 Socket服务器启动在: {}", addr);
        
        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    println!("📡 新客户端连接: {}", addr);
                    
                    let connections = self.connections.clone();
                    let app_handle = self.app_handle.clone();
                    
                    tokio::spawn(async move {
                        if let Err(e) = Self::handle_client(stream, addr, connections, app_handle).await {
                            println!("❌ 客户端处理错误 {}: {}", addr, e);
                        }
                    });
                }
                Err(e) => {
                    println!("❌ 接受连接失败: {}", e);
                }
            }
        }
    }

    /// 处理单个客户端连接
    async fn handle_client(
        mut stream: TcpStream,
        addr: SocketAddr,
        connections: ConnectionManager,
        app_handle: tauri::AppHandle,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let (tx, mut rx) = mpsc::unbounded_channel::<Vec<u8>>();
        let mut parser = ProtocolParser::new();
        let mut buffer = [0u8; 1024];
        
        // 暂时使用IP地址作为car_id，后续可通过消息协议获取真实ID
        let car_id = format!("car_{}", addr.ip());
        
        // 保存连接
        {
            let mut conns = connections.write();
            conns.insert(car_id.clone(), ClientConnection {
                car_id: car_id.clone(),
                addr,
                sender: tx,
            });
        }
        
        println!("✅ 车辆 {} 连接已建立", car_id);
        
        loop {
            tokio::select! {
                // 接收数据
                result = stream.read(&mut buffer) => {
                    match result {
                        Ok(0) => {
                            println!("🔌 客户端 {} 断开连接", addr);
                            break;
                        }
                        Ok(n) => {
                            parser.feed_data(&buffer[..n]);
                            
                            // 尝试解析消息
                            while let Ok(Some(message)) = parser.try_parse_message() {
                                Self::handle_message(message, &car_id, &app_handle).await;
                            }
                        }
                        Err(e) => {
                            println!("❌ 读取数据错误 {}: {}", addr, e);
                            break;
                        }
                    }
                }
                
                // 发送数据
                Some(data) = rx.recv() => {
                    if let Err(e) = stream.write_all(&data).await {
                        println!("❌ 发送数据错误 {}: {}", addr, e);
                        break;
                    }
                }
            }
        }
        
        // 清理连接
        {
            let mut conns = connections.write();
            conns.remove(&car_id);
        }
        
        println!("🗑️ 车辆 {} 连接已清理", car_id);
        Ok(())
    }

    /// 处理接收到的消息
    async fn handle_message(message: SocketMessage, car_id: &str, app_handle: &tauri::AppHandle) {
        println!("📨 收到消息 - 车辆: {}, 类型: 0x{:04X}, 数据长度: {}", 
                car_id, message.message_type, message.data.len());
        
        // 发送到前端进行数据域解析
        let frontend_message = serde_json::json!({
            "type": "socket_message",
            "car_id": car_id,
            "message_type": message.message_type,
            "timestamp": message.timestamp,
            "data": message.data
        });
        
        if let Err(e) = app_handle.emit("socket-message", frontend_message) {
            println!("❌ 发送消息到前端失败: {}", e);
        }
    }

    /// 发送消息给指定车辆
    pub fn send_to_vehicle(
        connections: &ConnectionManager,
        car_id: &str,
        message_type: u16,
        data: &[u8],
    ) -> Result<(), String> {
        let conns = connections.read();
        
        if let Some(connection) = conns.get(car_id) {
            let packet = build_message(message_type, data);
            
            if let Err(e) = connection.sender.send(packet) {
                return Err(format!("发送失败: {}", e));
            }
            
            println!("📤 发送消息到车辆 {} - 类型: 0x{:04X}, 数据长度: {}", 
                    car_id, message_type, data.len());
            Ok(())
        } else {
            Err(format!("车辆 {} 未连接", car_id))
        }
    }

    /// 广播消息给所有车辆
    pub fn broadcast_message(
        connections: &ConnectionManager,
        message_type: u16,
        data: &[u8],
    ) -> usize {
        let conns = connections.read();
        let packet = build_message(message_type, data);
        let mut sent_count = 0;
        
        for (car_id, connection) in conns.iter() {
            if connection.sender.send(packet.clone()).is_ok() {
                sent_count += 1;
                println!("📤 广播消息到车辆 {} - 类型: 0x{:04X}", car_id, message_type);
            }
        }
        
        sent_count
    }

    /// 获取连接状态
    pub fn get_connection_status(connections: &ConnectionManager) -> Vec<serde_json::Value> {
        let conns = connections.read();
        conns.iter().map(|(car_id, conn)| {
            serde_json::json!({
                "car_id": car_id,
                "address": conn.addr.to_string(),
                "connected": true
            })
        }).collect()
    }
}
