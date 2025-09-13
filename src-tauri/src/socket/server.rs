use super::protocol::{ProtocolParser, SocketMessage, build_message};
use crate::database::VehicleDatabase;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;

// 客户端连接信息
#[derive(Debug, Clone)]
pub struct ClientConnection {
    pub vehicle_id: i32,           // 使用整数车辆ID
    pub vehicle_name: String,      // 车辆名称
    pub addr: SocketAddr,
    pub sender: mpsc::UnboundedSender<Vec<u8>>,
}

// 全局连接管理器 - 使用整数车辆ID作为键
pub type ConnectionManager = Arc<RwLock<HashMap<i32, ClientConnection>>>;

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
    
    pub fn new_with_connections(port: u16, app_handle: tauri::AppHandle, connections: ConnectionManager) -> Self {
        Self {
            port,
            connections,
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
        
        // 根据客户端IP地址查询数据库获取车辆信息
        println!("🔍 客户端连接来自: {}", addr.ip());
        let vehicle_info = if let Some(db) = app_handle.try_state::<VehicleDatabase>() {
            // 查询数据库中匹配的车辆连接
            match db.get_all_vehicle_connections().await {
                Ok(connections) => {
                    println!("📋 数据库中的车辆连接:");
                    for conn in &connections {
                        println!("  - 车辆ID: {}, IP: {}, 名称: {}, 激活: {}", 
                               conn.vehicle_id, conn.ip_address, conn.name, conn.is_active);
                    }
                    let found = connections.into_iter()
                        .find(|conn| conn.ip_address == addr.ip().to_string() && conn.is_active);
                    if let Some(ref info) = found {
                        println!("✅ 找到匹配的车辆: ID={}, 名称={}", info.vehicle_id, info.name);
                    } else {
                        println!("❌ 未找到IP {}的匹配车辆", addr.ip());
                    }
                    found
                }
                Err(e) => {
                    println!("❌ 查询车辆连接失败: {}", e);
                    None
                }
            }
        } else {
            println!("❌ 无法获取数据库实例");
            None
        };
        
        let (vehicle_id, vehicle_name) = if let Some(info) = vehicle_info {
            (info.vehicle_id, info.name)
        } else {
            println!("⚠️ 未找到IP {}的车辆配置，使用默认值", addr.ip());
            // 使用IP最后一段作为默认ID
            let default_id = addr.ip().to_string()
                .split('.')
                .last()
                .unwrap_or("0")
                .parse::<i32>()
                .unwrap_or(0);
            (default_id, format!("未知车辆_{}", addr.ip()))
        };
        
        // 保存连接
        {
            let mut conns = connections.write();
            conns.insert(vehicle_id, ClientConnection {
                vehicle_id,
                vehicle_name: vehicle_name.clone(),
                addr,
                sender: tx,
            });
            println!("✅ 车辆 {} (ID: {}) 连接已建立，当前连接数: {}", vehicle_name, vehicle_id, conns.len());
        }

        // 启动在线时长统计任务
        let app_handle_for_timer = app_handle.clone();
        let timer_vehicle_id = vehicle_id;
        let connections_for_timer = connections.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60)); // 每分钟更新一次
            loop {
                interval.tick().await;
                
                // 检查车辆是否还在线
                {
                    let conns = connections_for_timer.read();
                    if !conns.contains_key(&timer_vehicle_id) {
                        println!("⏰ 车辆 {} 已断开，停止在线时长统计", timer_vehicle_id);
                        break;
                    }
                }

                // 更新在线时长（+1分钟）
                if let Some(db) = app_handle_for_timer.try_state::<VehicleDatabase>() {
                    match db.update_vehicle_online_time(timer_vehicle_id, 1).await {
                        Ok(_) => {
                            println!("📊 车辆 {} 在线时长已更新 (+1分钟)", timer_vehicle_id);
                        }
                        Err(e) => {
                            println!("❌ 更新车辆 {} 在线时长失败: {}", timer_vehicle_id, e);
                        }
                    }
                } else {
                    println!("❌ 无法获取数据库实例，无法更新在线时长");
                }
            }
        });
        
        let mut parser = ProtocolParser::new();
        let mut buffer = [0u8; 1024];
        
        loop {
            tokio::select! {
                // 接收数据
                result = stream.read(&mut buffer) => {
                    match result {
                        Ok(0) => {
                            println!("🔌 客户端 {} (车辆ID: {}) 正常断开连接 (read返回0)", addr, vehicle_id);
                            // 发送断开连接事件到前端
                            Self::send_disconnect_event(vehicle_id, &vehicle_name, &app_handle).await;
                            break;
                        }
                        Ok(n) => {
                            // println!("📥 接收到 {} 字节数据", n);
                            parser.feed_data(&buffer[..n]);
                            
                            // 尝试解析消息
                            while let Ok(Some(message)) = parser.try_parse_message() {
                                println!("🔧 处理消息前，检查连接状态...");
                                {
                                    let conns = connections.read();
                                    println!("🔍 当前连接数: {}, 包含车辆{}: {}", 
                                            conns.len(), vehicle_id, conns.contains_key(&vehicle_id));
                                }
                                Self::handle_message(message, vehicle_id, &vehicle_name, &app_handle).await;
                                println!("🔧 处理消息后，检查连接状态...");
                                {
                                    let conns = connections.read();
                                    println!("🔍 当前连接数: {}, 包含车辆{}: {}", 
                                            conns.len(), vehicle_id, conns.contains_key(&vehicle_id));
                                }
                            }
                        }
                        Err(e) => {
                            println!("❌ 读取数据错误 {} (车辆ID: {}): {}", addr, vehicle_id, e);
                            // 发送断开连接事件到前端
                            Self::send_disconnect_event(vehicle_id, &vehicle_name, &app_handle).await;
                            break;
                        }
                    }
                }
                
                // 发送数据
                Some(data) = rx.recv() => {
                    println!("📤 准备发送 {} 字节数据到车辆 {} (ID: {})", data.len(), vehicle_name, vehicle_id);
                    println!("🔍 发送前连接状态检查:");
                    {
                        let conns = connections.read();
                        println!("    - 当前连接数: {}", conns.len());
                        println!("    - 包含当前车辆: {}", conns.contains_key(&vehicle_id));
                    }
                    
                    match stream.write_all(&data).await {
                        Err(e) => {
                            println!("❌ 发送数据错误 {} (车辆ID: {}): {}", addr, vehicle_id, e);
                            // 发送断开连接事件到前端
                            Self::send_disconnect_event(vehicle_id, &vehicle_name, &app_handle).await;
                            println!("💀 连接因发送错误而退出");
                            break;
                        }
                        Ok(_) => {
                            println!("✅ 数据发送成功到车辆 {} (ID: {})", vehicle_name, vehicle_id);
                        }
                    }
                }
            }
        }
        
        // 清理连接
        {
            let mut conns = connections.write();
            conns.remove(&vehicle_id);
            println!("🗑️ 车辆 {} (ID: {}) 连接已清理，剩余连接数: {}", vehicle_name, vehicle_id, conns.len());
        }
        
        Ok(())
    }

    /// 处理接收到的消息
    async fn handle_message(message: SocketMessage, vehicle_id: i32, vehicle_name: &str, app_handle: &tauri::AppHandle) {
        println!("📨 收到消息 - 车辆: {} (ID: {}), 类型: 0x{:04X}, 数据长度: {}",
                vehicle_name, vehicle_id, message.message_type, message.data.len());
        
        println!("🔧 handle_message 开始处理...");
        
        // 发送到前端进行数据域解析
        let frontend_message = serde_json::json!({
            "type": "socket_message",
            "vehicle_id": vehicle_id,
            "vehicle_name": vehicle_name,
            "message_type": message.message_type,
            "timestamp": message.timestamp,
            "data": message.data
        });
        
        println!("🔧 准备发送到前端...");
        match app_handle.emit("socket-message", frontend_message) {
            Ok(_) => {
                println!("✅ 消息成功发送到前端");
            }
            Err(e) => {
                println!("❌ 发送消息到前端失败: {}", e);
            }
        }
        println!("🔧 handle_message 完成处理");
    }

    /// 发送车辆断开连接事件到前端
    async fn send_disconnect_event(vehicle_id: i32, vehicle_name: &str, app_handle: &tauri::AppHandle) {
        let disconnect_message = serde_json::json!({
            "type": "vehicle_disconnect",
            "vehicle_id": vehicle_id,
            "vehicle_name": vehicle_name,
            "timestamp": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64
        });
        
        if let Err(e) = app_handle.emit("vehicle-disconnect", disconnect_message) {
            println!("❌ 发送车辆断开事件到前端失败: {}", e);
        } else {
            println!("📤 已通知前端车辆 {} (ID: {}) 断开连接", vehicle_name, vehicle_id);
        }
    }

    /// 发送消息给指定车辆
    pub fn send_to_vehicle(
        connections: &ConnectionManager,
        vehicle_id: i32,
        message_type: u16,
        data: &[u8],
    ) -> Result<(), String> {
        let conns = connections.read();
        
        if let Some(connection) = conns.get(&vehicle_id) {
            let packet = build_message(message_type, data);
            
            if let Err(e) = connection.sender.send(packet) {
                return Err(format!("发送失败: {}", e));
            }
            
            println!("📤 发送消息到车辆 {} (ID: {}) - 类型: 0x{:04X}, 数据长度: {}", 
                    connection.vehicle_name, vehicle_id, message_type, data.len());
            Ok(())
        } else {
            Err(format!("车辆 ID {} 未连接", vehicle_id))
        }
    }

    /// 广播消息给所有车辆
    pub fn broadcast_message(
        connections: &ConnectionManager,
        message_type: u16,
        data: &[u8],
    ) -> usize {
        println!("📡 准备广播消息 - 类型: 0x{:04X}, 数据长度: {} 字节", message_type, data.len());
        
        // 先检查连接数量而不持有锁
        {
            let conns = connections.read();
            println!("🔍 锁定前连接数量: {}", conns.len());
        }
        
        println!("🔒 尝试获取连接管理器读锁...");
        let conns = connections.read();
        println!("✅ 成功获取读锁");
        println!("🔍 锁定后连接数量: {}", conns.len());
        
        for (vehicle_id, connection) in conns.iter() {
            println!("  - 车辆ID: {}, 名称: {}, 地址: {}", 
                   vehicle_id, connection.vehicle_name, connection.addr);
        }
        
        let packet = build_message(message_type, data);
        let mut sent_count = 0;
        
        for (vehicle_id, connection) in conns.iter() {
            match connection.sender.send(packet.clone()) {
                Ok(_) => {
                    sent_count += 1;
                    println!("✅ 广播消息到车辆 {} (ID: {}) - 类型: 0x{:04X}", 
                            connection.vehicle_name, vehicle_id, message_type);
                }
                Err(e) => {
                    println!("❌ 发送消息到车辆 {} (ID: {}) 失败: {}", 
                            connection.vehicle_name, vehicle_id, e);
                }
            }
        }
        
        println!("📊 广播完成 - 成功发送给 {} 个车辆", sent_count);
        sent_count
    }

    /// 获取连接状态
    pub fn get_connection_status(connections: &ConnectionManager) -> Vec<serde_json::Value> {
        let conns = connections.read();
        conns.iter().map(|(vehicle_id, conn)| {
            serde_json::json!({
                "vehicle_id": vehicle_id,
                "vehicle_name": &conn.vehicle_name,
                "address": conn.addr.to_string(),
                "connected": true
            })
        }).collect()
    }
}
