use super::protocol::{build_message, ProtocolParser, SocketMessage};
use crate::database::VehicleDatabase;
use crate::protocol_processing::types::{MessageTypes, VehicleInfo, ProtocolConstants, ParsedProtocolData, GearPosition};
use crate::protocol_processing::parser::ProtocolParser as ProcessingProtocolParser;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use log::{info, debug, warn, error};

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

// 沙盘服务连接管理器（仅保存一个特殊连接）
pub type SandboxConnectionManager = Arc<RwLock<Option<ClientConnection>>>;

// Socket服务器
pub struct SocketServer {
    port: u16,
    connections: ConnectionManager,
    sandbox: SandboxConnectionManager,
    app_handle: tauri::AppHandle,
    vehicle_state: Arc<RwLock<HashMap<u8, VehicleInfo>>>,
}

impl SocketServer {
    pub fn new(port: u16, app_handle: tauri::AppHandle) -> Self {
        Self {
            port,
            connections: Arc::new(RwLock::new(HashMap::new())),
            sandbox: Arc::new(RwLock::new(None)),
            app_handle,
            vehicle_state: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    pub fn new_with_connections(port: u16, app_handle: tauri::AppHandle, connections: ConnectionManager, sandbox: SandboxConnectionManager) -> Self {
        Self {
            port,
            connections,
            sandbox,
            app_handle,
            vehicle_state: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 启动Socket服务器
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let addr = format!("0.0.0.0:{}", self.port);
        let listener = TcpListener::bind(&addr).await?;
        
        info!("Socket服务器启动成功: {}", addr);
        
        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    info!("新客户端连接: {}", addr);
                    
                    let connections = self.connections.clone();
                    let app_handle = self.app_handle.clone();
                    let sandbox = self.sandbox.clone();
                    
                    let vehicle_state = self.vehicle_state.clone();

                    let handle = tokio::spawn(async move {
                        if let Err(e) = Self::handle_client(stream, addr, connections, app_handle, sandbox, vehicle_state).await {
                            error!("客户端处理错误 {}: {}", addr, e);
                        }
                    });
                    // 可选：你可以在这里添加handle.await如果需要等待
                    let _ = handle;
                }
                Err(e) => {
                    error!("接受连接失败: {}", e);
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
        sandbox_manager: SandboxConnectionManager,
        vehicle_state: Arc<RwLock<HashMap<u8, VehicleInfo>>>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let (tx, mut rx) = mpsc::unbounded_channel::<Vec<u8>>();
        
        info!("******客户端连接 IP: {}", addr.ip());

        // 判断是否为沙盘服务连接（优先判定）
        let mut is_sandbox = false;
        if let Some(db) = app_handle.try_state::<VehicleDatabase>() {
            match db.get_sandbox_service_settings().await {
                Ok(Some(settings)) => {
                    let configured_ip = settings.ip_address.trim();
                    let remote_ip = addr.ip().to_string();
                    debug!("检查沙盘IP: 配置={}, 实际={}", configured_ip, remote_ip);
                    if configured_ip == remote_ip {
                        is_sandbox = true;
                        info!("沙盘连接已识别");
                        if let Err(e) = app_handle.emit("sandbox-connect", serde_json::json!({
                            "ip": remote_ip,
                            "addr": addr.to_string()
                        })) {
                            error!("通知前端沙盘连接失败: {}", e);
                        }
                    } else {
                        debug!("沙盘IP不匹配: 配置={}, 实际={}", configured_ip, remote_ip);
                    }
                }
                _ => {}
            }
        }

        // 根据客户端IP地址查询数据库获取车辆信息（非沙盘连接）
        debug!("客户端连接来自: {}", addr.ip());
        let vehicle_info = if !is_sandbox { if let Some(db) = app_handle.try_state::<VehicleDatabase>() {
            // 查询数据库中匹配的车辆连接
            match db.get_all_vehicle_connections().await {
                Ok(connections) => {
                    debug!("数据库中的车辆连接:");
                    for conn in &connections {
                        debug!("车辆ID: {}, IP: {}, 名称: {}, 活跃: {}", 
                               conn.vehicle_id, conn.ip_address, conn.name, conn.is_active);
                    }
                    let found = connections.into_iter()
                        .find(|conn| conn.ip_address == addr.ip().to_string() && conn.is_active);
                    if let Some(ref info) = found {
                        info!("找到匹配车辆: ID={}, 名称={}", info.vehicle_id, info.name);
                    } else {
                        warn!("IP {} 未找到匹配的车辆", addr.ip());
                    }
                    found
                }
                Err(e) => {
                    error!("查询车辆连接失败: {}", e);
                    None
                }
            }
        } else {
            error!("无法获取数据库实例");
            None
        } } else { None };
        
        // 沙盘连接仅保存到sandbox_manager，不进入车辆连接表
        if is_sandbox {
            {
                let mut sandbox = sandbox_manager.write();
                *sandbox = Some(ClientConnection {
                    vehicle_id: -1,
                    vehicle_name: "SandboxService".to_string(),
                    addr,
                    sender: tx.clone(),
                });
            }
            info!("沙盘服务连接已建立: {} (IP: {})", addr, addr.ip());
        }

        let (mut vehicle_id, mut vehicle_name) = if is_sandbox {
            (-1, "SandboxService".to_string())
        } else if let Some(info) = vehicle_info {
            info!("数据库匹配车辆 -> ID: {}, 名称: {}", info.vehicle_id, info.name);
            (info.vehicle_id, info.name)
        } else {
            warn!(
                "数据库未匹配车辆配置 (IP: {}), 将使用接入帧中的车辆ID",
                addr.ip()
            );
            // vehicle_id 将在解析数据包时以协议内的真实ID为准
            (0, format!("未知车辆_{}", addr.ip()))
        };
        
        // 保存车辆连接（非沙盘）
        if !is_sandbox {
            {
                let mut conns = connections.write();
                conns.insert(vehicle_id, ClientConnection {
                    vehicle_id,
                    vehicle_name: vehicle_name.clone(),
                    addr,
                    sender: tx.clone(),
                });
                info!("车辆 {} (ID: {}) 连接已建立，当前连接数: {}", vehicle_name, vehicle_id, conns.len());
            } // 在这里释放锁
            
            // 发送车辆连接事件到前端
            Self::send_connect_event(vehicle_id, &vehicle_name, &app_handle).await;
        }

        // 启动在线时长统计任务
        if !is_sandbox {
            let app_handle_for_timer = app_handle.clone();
            let timer_vehicle_id = vehicle_id;
            let connections_for_timer = connections.clone();
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60)); // 每分钟更新一次
                loop {
                    interval.tick().await;
                    {
                        let conns = connections_for_timer.read();
                        if !conns.contains_key(&timer_vehicle_id) {
                            debug!("车辆 {} 已断开，停止在线时长统计", timer_vehicle_id);
                            break;
                        }
                    }
                    if let Some(db) = app_handle_for_timer.try_state::<VehicleDatabase>() {
                        match db.update_vehicle_online_time(timer_vehicle_id, 1).await {
                            Ok(_) => {
                                debug!("车辆 {} 在线时长已更新 (+1分钟)", timer_vehicle_id);
                            }
                            Err(e) => {
                                error!("更新车辆 {} 在线时长失败: {}", timer_vehicle_id, e);
                            }
                        }
                    } else {
                        error!("无法获取数据库实例，无法更新在线时长");
                    }
                }
            });
        }
        
        let mut vehicle_parser = ProtocolParser::new();
        let mut sandbox_parser = if is_sandbox { Some(ProtocolParser::new()) } else { None };
 
        let mut buffer = [0u8; 4096]; // 增加缓冲区大小以处理更大的数据包
 
        loop {
            tokio::select! {
                // 接收数据
                result = stream.read(&mut buffer) => {
                    match result {
                        Ok(0) => {
                            if is_sandbox {
                            info!("沙盘服务 {} 正常断开", addr);
                            } else {
                                info!("客户端 {} (车辆ID: {}) 正常断开", addr, vehicle_id);
                                // 发送断开连接事件到前端
                                Self::send_disconnect_event(vehicle_id, &vehicle_name, &app_handle).await;
                            }
                            break;
                        }
                        Ok(n) => {
                            if is_sandbox {
                                if let Some(parser) = sandbox_parser.as_mut() {
                                    parser.feed_data(&buffer[..n]);
                                    while let Ok(Some(message)) = parser.try_parse_message() {
                                        sandbox_logger::handle_parsed_message(&message);
                                    }
                                }
                            } else {
                                vehicle_parser.feed_data(&buffer[..n]);
                                while let Ok(Some(message)) = vehicle_parser.try_parse_message() {
                                    if let Some((new_id, new_name)) = Self::handle_message(
                                        message,
                                        vehicle_id,
                                        &vehicle_name,
                                        &app_handle,
                                        vehicle_state.clone(),
                                        connections.clone()
                                    ).await {
                                        vehicle_id = new_id;
                                        vehicle_name = new_name;
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            warn!("{} 连接异常: {}", vehicle_name, e);
                            if is_sandbox {
                                let mut sandbox = sandbox_manager.write();
                                *sandbox = None;
                                let _ = app_handle.emit("sandbox-disconnect", serde_json::json!({
                                    "ip": addr.ip().to_string(),
                                    "addr": addr.to_string()
                                }));
                            }
                            break;
                        }
                    }
                }
                
                // 发送数据
                Some(data) = rx.recv() => {
                    if is_sandbox {
                        debug!("准备发送 {} 字节到沙盘服务", data.len());
                    } else {
                        debug!("准备发送 {} 字节到车辆 {} (ID: {})", data.len(), vehicle_name, vehicle_id);
                    }
                    
                    match stream.write_all(&data).await {
                        Err(e) => {
                            if is_sandbox {
                                error!("发送数据错误 (沙盘) {}: {}", addr, e);
                            } else {
                                error!("发送数据错误 {} (车辆ID: {}): {}", addr, vehicle_id, e);
                                // Send disconnect event to frontend
                                Self::send_disconnect_event(vehicle_id, &vehicle_name, &app_handle).await;
                                debug!("连接因发送错误而退出");
                            }
                            break;
                        }
                        Ok(_) => {
                            if is_sandbox {
                                debug!("数据成功发送到沙盘服务");
                            } else {
                                debug!("数据成功发送到车辆 {} (ID: {})", vehicle_name, vehicle_id);
                            }
                        }
                    }
                }
            }
        }
        
        // Clean up connections
        if is_sandbox {
            let mut sandbox = sandbox_manager.write();
            *sandbox = None;
            if let Err(e) = app_handle.emit("sandbox-disconnect", serde_json::json!({
                "ip": addr.ip().to_string(),
                "addr": addr.to_string()
            })) {
                error!("通知前端沙盘断开失败: {}", e);
            }
            info!("沙盘服务连接已清理");
        } else {
            let mut conns = connections.write();
            conns.remove(&vehicle_id);
            info!("车辆 {} (ID: {}) 连接已清理，剩余连接: {}", vehicle_name, vehicle_id, conns.len());
        }
        
        Ok(())
    }

    /// 处理接收到的消息
    async fn handle_message(
        message: SocketMessage,
        vehicle_id: i32,
        vehicle_name: &str,
        app_handle: &tauri::AppHandle,
        vehicle_state: Arc<RwLock<HashMap<u8, VehicleInfo>>>,
        connections: ConnectionManager,
    ) -> Option<(i32, String)> {
        debug!("收到消息 - 车辆: {} (ID: {}), 类型: 0x{:04X}, 数据长度: {}",
                vehicle_name, vehicle_id, message.message_type, message.data.len());

        let mut parsed_payload: Option<serde_json::Value> = None;
        let mut reassigned_vehicle: Option<(i32, String)> = None;

        if message.message_type == MessageTypes::HEARTBEAT {
            parsed_payload = Some(serde_json::json!({
                "type": "heartbeat",
                "vehicle_id": vehicle_id,
                "timestamp": message.timestamp,
            }));
        } else if message.message_type == MessageTypes::VEHICLE_INFO {
            if message.data.len() < ProtocolConstants::VEHICLE_INFO_TOTAL_SIZE {
                warn!(
                    "车辆信息数据长度不足 - 车辆: {} (ID: {}), 长度: {}",
                    vehicle_name,
                    vehicle_id,
                    message.data.len()
                );
            } else if let Some(info_json) = parse_vehicle_info_payload(&message.data, &vehicle_state, vehicle_id, vehicle_name) {
                if let Some(parsed_id) = info_json.get("vehicle_id").and_then(|v| v.as_u64()) {
                    let parsed_vehicle_id = parsed_id as i32;
                    if vehicle_id != parsed_vehicle_id && vehicle_id >= 0 {
                        let mut conns = connections.write();
                        if let Some(mut conn) = conns.remove(&vehicle_id) {
                            info!(
                                "纠正车辆连接ID: {} -> {} (名称: {})",
                                vehicle_id,
                                parsed_vehicle_id,
                                vehicle_name
                            );
                            conn.vehicle_id = parsed_vehicle_id;
                            let new_name = conn.vehicle_name.clone();
                            conns.insert(parsed_vehicle_id, conn);
                            reassigned_vehicle = Some((parsed_vehicle_id, new_name));
                        }
                    }
                }
                parsed_payload = Some(info_json);
            } else {
                return None;
            }
        } else if message.message_type == MessageTypes::PATH_FILE_SELECTION {
            // 处理路径文件选择协议（0x0003）
            let mut parser = ProcessingProtocolParser::new(false);
            let result = parser.parse_protocol(message.message_type, &message.data);
            if result.success {
                if let Some(ParsedProtocolData::PathFileSelection(selection)) = result.data {
                    info!(
                        "路径文件选择 - 车辆ID: {}, 路径数量: {}, 路径编号: {:?}",
                        selection.vehicle_id,
                        selection.path_file_ids.len(),
                        selection.path_file_ids
                    );
                    parsed_payload = Some(serde_json::json!({
                        "type": "path_file_selection",
                        "vehicle_id": selection.vehicle_id,
                        "path_file_ids": selection.path_file_ids
                    }));
                }
            } else if let Some(err) = result.error {
                warn!("路径文件选择解析失败: {}", err);
            }
        } else if message.message_type == MessageTypes::SANDBOX_TRAFFIC_LIGHT_STATUS {
            let mut parser = ProcessingProtocolParser::new(false);
            let result = parser.parse_protocol(message.message_type, &message.data);
            if result.success {
                if let Some(ParsedProtocolData::SandboxTrafficLightStatus(status)) = result.data {
                    info!("沙盘红绿灯状态: {} 个灯", status.lights.len());
                    for light in &status.lights {
                        let color_text = match light.color {
                            1 => "红灯",
                            2 => "绿灯",
                            3 => "黄灯",
                            other => {
                                warn!("沙盘红绿灯状态未知颜色 {}", other);
                                "未知"
                            }
                        };
                        info!("  - 灯{}: {} 剩余 {} 秒", light.index, color_text, light.remaining);
                    }
                    parsed_payload = Some(serde_json::json!({
                        "type": "sandbox_traffic_light_status",
                        "lights": status.lights
                    }));
                }
            } else if let Some(err) = result.error {
                warn!("沙盘红绿灯状态解析失败: {}", err);
            }
        }
 
        let mut frontend_message = serde_json::json!({
            "type": "socket_message",
            "vehicle_id": vehicle_id,
            "vehicle_name": vehicle_name,
            "message_type": message.message_type,
            "timestamp": message.timestamp,
            "data": message.data
        });
 
        if let Some(parsed) = parsed_payload {
            frontend_message["parsed"] = parsed;
        }
        
        match app_handle.emit("socket-message", frontend_message) {
            Ok(_) => {
                debug!("消息成功发送到前端");
            }
            Err(e) => {
                error!("发送消息到前端失败: {}", e);
            }
        }
        reassigned_vehicle
    }

    /// 发送车辆连接事件到前端
    async fn send_connect_event(vehicle_id: i32, vehicle_name: &str, app_handle: &tauri::AppHandle) {
        let connect_message = serde_json::json!({
            "type": "vehicle_connect",
            "vehicle_id": vehicle_id,
            "vehicle_name": vehicle_name,
            "timestamp": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64
        });
        
        if let Err(e) = app_handle.emit("vehicle-connect", connect_message) {
            error!("发送车辆连接事件到前端失败: {}", e);
        } else {
            info!("已通知前端车辆 {} (ID: {}) 连接", vehicle_name, vehicle_id);
        }
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
            error!("发送车辆断开事件到前端失败: {}", e);
        } else {
            info!("已通知前端车辆 {} (ID: {}) 断开连接", vehicle_name, vehicle_id);
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
            
            info!("发送消息到车辆 {} (ID: {}) - 类型: 0x{:04X}, 数据长度: {}", 
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
        info!("准备广播消息 - 类型: 0x{:04X}, 数据长度: {} 字节", message_type, data.len());
        
        let conns = connections.read();
        debug!("当前连接数量: {}", conns.len());
        
        let packet = build_message(message_type, data);
        let mut sent_count = 0;
        
        for (vehicle_id, connection) in conns.iter() {
            match connection.sender.send(packet.clone()) {
                Ok(_) => {
                    sent_count += 1;
                    debug!("广播消息到车辆 {} (ID: {}) - 类型: 0x{:04X}", 
                            connection.vehicle_name, vehicle_id, message_type);
                }
                Err(e) => {
                    warn!("发送消息到车辆 {} (ID: {}) 失败: {}", 
                            connection.vehicle_name, vehicle_id, e);
                }
            }
        }
        
        info!("广播完成 - 成功发送给 {} 个车辆", sent_count);
        sent_count
    }

    /// 发送消息给沙盘服务
    pub fn send_to_sandbox(
        sandbox: &SandboxConnectionManager,
        message_type: u16,
        data: &[u8],
    ) -> Result<(), String> {
        let conn_opt = sandbox.read();
        if let Some(connection) = &*conn_opt {
            let packet = build_message(message_type, data);
            if let Err(e) = connection.sender.send(packet) {
                return Err(format!("发送失败: {}", e));
            }
            info!("发送消息到沙盘服务 - 类型: 0x{:04X}, 数据长度: {}", message_type, data.len());
            Ok(())
        } else {
            Err("沙盘服务离线".to_string())
        }
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

mod sandbox_logger {
    use super::*;

    pub fn handle_parsed_message(message: &SocketMessage) {
        let mut processing_parser = ProcessingProtocolParser::new(false);
        let result = processing_parser.parse_protocol(message.message_type, &message.data);
        if message.message_type == MessageTypes::SANDBOX_TRAFFIC_LIGHT_STATUS {
            if let Some(ParsedProtocolData::SandboxTrafficLightStatus(status)) = result.data {
                log::info!("[Sandbox] 红绿灯状态: {}", status.lights.len());
                for light in status.lights {
                    let color_text = match light.color {
                        1 => "红",
                        2 => "绿",
                        3 => "黄",
                        _ => "未知",
                    };
                    log::info!("  - 灯{}: {} 剩余 {} 秒", light.index, color_text, light.remaining);
                }
            }
        }
    }
}

fn floats_close(a: f64, b: f64, epsilon: f64) -> bool {
    (a - b).abs() <= epsilon
}

fn vehicle_info_equal(a: &VehicleInfo, b: &VehicleInfo) -> bool {
    a.vehicle_id == b.vehicle_id
        && floats_close(a.speed, b.speed, 1e-6)
        && floats_close(a.position_x, b.position_x, 1e-6)
        && floats_close(a.position_y, b.position_y, 1e-6)
        && floats_close(a.orientation, b.orientation, 1e-6)
        && floats_close(a.battery, b.battery, 1e-6)
        && a.gear == b.gear
        && floats_close(a.steering_angle, b.steering_angle, 1e-6)
        && a.nav_status == b.nav_status
        && a.sensors.camera == b.sensors.camera
        && a.sensors.lidar == b.sensors.lidar
        && a.sensors.gyro == b.sensors.gyro
        && a.parking_slot == b.parking_slot
}

fn parse_vehicle_info_payload(
    data: &[u8],
    vehicle_state: &Arc<RwLock<HashMap<u8, VehicleInfo>>>,
    vehicle_id_i32: i32,
    vehicle_name: &str,
) -> Option<serde_json::Value> {
    use crate::protocol_processing::types::ProtocolConstants;

    let view = &data;
    let vehicle_id = view[ProtocolConstants::VEHICLE_INFO_VEHICLE_ID_OFFSET];

    let read_f64 = |offset: usize| -> f64 {
        let mut bytes = [0u8; 8];
        bytes.copy_from_slice(&view[offset..offset + 8]);
        f64::from_le_bytes(bytes)
    };

    let speed = read_f64(ProtocolConstants::VEHICLE_INFO_SPEED_OFFSET);
    let position_x = read_f64(ProtocolConstants::VEHICLE_INFO_POSITION_X_OFFSET);
    let position_y = read_f64(ProtocolConstants::VEHICLE_INFO_POSITION_Y_OFFSET);
    let orientation = read_f64(ProtocolConstants::VEHICLE_INFO_ORIENTATION_OFFSET);
    let battery = read_f64(ProtocolConstants::VEHICLE_INFO_BATTERY_OFFSET);
    let gear_raw = view[ProtocolConstants::VEHICLE_INFO_GEAR_OFFSET];
    let gear = GearPosition::from_u8(gear_raw);
    let steering_angle = read_f64(ProtocolConstants::VEHICLE_INFO_STEERING_ANGLE_OFFSET);
    let nav_status = view[ProtocolConstants::VEHICLE_INFO_NAV_STATUS_OFFSET];
    let camera_status = view[ProtocolConstants::VEHICLE_INFO_CAMERA_STATUS_OFFSET] != 0;
    let lidar_status = view[ProtocolConstants::VEHICLE_INFO_LIDAR_STATUS_OFFSET] != 0;
    let gyro_status = view[ProtocolConstants::VEHICLE_INFO_GYRO_STATUS_OFFSET] != 0;
    let parking_slot = view[ProtocolConstants::VEHICLE_INFO_PARKING_SLOT_OFFSET];

    let info = VehicleInfo {
        vehicle_id,
        speed,
        position_x,
        position_y,
        orientation,
        battery,
        gear,
        steering_angle,
        nav_status,
        sensors: crate::protocol_processing::types::SensorStatus {
            camera: camera_status,
            lidar: lidar_status,
            gyro: gyro_status,
        },
        parking_slot,
    };

    let mut cache = vehicle_state.write();
    if let Some(previous) = cache.get(&vehicle_id) {
        if vehicle_info_equal(previous, &info) {
            debug!(
                "车辆 {} (ID: {}) 数据未变化，跳过更新",
                vehicle_name,
                vehicle_id_i32
            );
            return None;
        }
    }
    cache.insert(vehicle_id, info.clone());

    Some(serde_json::json!({
        "vehicle_id": info.vehicle_id,
        "speed": info.speed,
        "position": {"x": info.position_x, "y": info.position_y},
        "orientation": info.orientation,
        "battery": info.battery,
        "gear": {
            "value": gear.to_u8(),
            "label": gear.label(),
        },
        "steeringAngle": info.steering_angle,
        "navigation": {
            "code": info.nav_status,
            "text": nav_status_text(info.nav_status),
        },
        "sensors": {
            "camera": {
                "status": camera_status,
                "text": if camera_status { "正常" } else { "异常" }
            },
            "lidar": {
                "status": lidar_status,
                "text": if lidar_status { "正常" } else { "异常" }
            },
            "gyro": {
                "status": gyro_status,
                "text": if gyro_status { "正常" } else { "异常" }
            }
        },
        "parkingSlot": info.parking_slot
    }))
}

fn nav_status_text(code: u8) -> &'static str {
    match code {
        1 => "正常行驶中（空载模式倒车入库）",
        2 => "正常行驶中（空载模式不倒车入库）",
        3 => "接客模式，去起点接客",
        4 => "接客模式，去终点送客",
        5 => "去往充电车位",
        6 => "充电中",
        7 => "去往定车位路上",
        8 => "车位停车中",
        9 => "到达接客起点",
        10 => "到达接客终点",
        11 => "正在倒车入库",
        12 => "正在出库中",
        13 => "正在倒车入库",
        14 => "出库完成",
        15 => "平行驾驶模式",
        _ => "未知状态",
    }
}
