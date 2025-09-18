use tauri::Manager;
use std::process::Command;
use local_ip_address::local_ip;

mod socket;
mod database;
mod rtsp_stream;
mod rtsp_converter;
mod udp_video;

use database::{VehicleDatabase, CreateVehicleConnectionRequest, UpdateVehicleConnectionRequest, UpdateTrafficLightSettingsRequest, CreateTaxiOrderRequest, CreateAvpParkingRequest, CreateAvpPickupRequest, CreateOrUpdateSandboxServiceRequest, CreateSandboxCameraRequest, UpdateSandboxCameraRequest};
use rtsp_converter::{RTSPConverter, HLSServer};
use udp_video::{UdpVideoManager, ServerStats};
use std::sync::Arc;
use tokio::sync::Mutex;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Open folder command for file management
#[tauri::command]
async fn open_folder() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(".")
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(".")
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(".")
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    Ok(())
}

// ============ 沙盘交通灯指令 ============

/// 发送红绿灯时长到沙盘（0x2002）
#[tauri::command]
async fn send_sandbox_traffic_light_duration(
    app: tauri::AppHandle,
    light_id: u8,
    red_seconds: u16,
    green_seconds: u16,
) -> Result<String, String> {
    // 基础范围校验（与前端一致，避免脏数据）
    if red_seconds == 0 || red_seconds > 300 {
        return Err("红灯时长必须在1-300秒之间".to_string());
    }
    if green_seconds == 0 || green_seconds > 300 {
        return Err("绿灯时长必须在1-300秒之间".to_string());
    }
    let sandbox = app.state::<socket::SandboxConnectionManager>();
    let mut data = Vec::with_capacity(1 + 2 + 2);
    data.push(light_id);
    data.extend_from_slice(&red_seconds.to_le_bytes());
    data.extend_from_slice(&green_seconds.to_le_bytes());

    // 发送成功后在DB保存对应编号的时长
    match socket::SocketServer::send_to_sandbox(&sandbox, 0x2002, &data) {
        Ok(_) => {
            if let Some(db) = app.try_state::<VehicleDatabase>() {
                let _ = db.update_traffic_light_item(light_id as i32, red_seconds as i32, green_seconds as i32).await;
            }
            Ok("发送成功".to_string())
        }
        Err(e) => Err(e)
    }
}

// 单个红绿灯项查询
#[tauri::command]
async fn get_traffic_light_item(app: tauri::AppHandle, light_id: i32) -> Result<serde_json::Value, String> {
    if let Some(db) = app.try_state::<VehicleDatabase>() {
        db.get_traffic_light_item(light_id)
            .await
            .map(|item| serde_json::to_value(item).unwrap())
            .map_err(|e| e.to_string())
    } else {
        Err("数据库未初始化".to_string())
    }
}

// 单个红绿灯项更新
#[tauri::command]
async fn update_traffic_light_item(app: tauri::AppHandle, light_id: i32, red_seconds: i32, green_seconds: i32) -> Result<serde_json::Value, String> {
    if let Some(db) = app.try_state::<VehicleDatabase>() {
        db.update_traffic_light_item(light_id, red_seconds, green_seconds)
            .await
            .map(|item| serde_json::to_value(item).unwrap())
            .map_err(|e| e.to_string())
    } else {
        Err("数据库未初始化".to_string())
    }
}

// Get system information
#[tauri::command]
async fn get_system_info() -> Result<serde_json::Value, String> {
    let info = serde_json::json!({
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "version": env!("CARGO_PKG_VERSION")
    });
    
    Ok(info)
}

// （已移除主题设置相关命令）

// Window control commands
#[tauri::command]
async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn maximize_window(window: tauri::Window) -> Result<(), String> {
    window.maximize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

// Socket服务器相关命令
#[tauri::command]
async fn start_socket_server(app: tauri::AppHandle, port: u16) -> Result<String, String> {
    println!("🚀 开始启动Socket服务器，端口: {}", port);
    
    // 使用Tauri状态中的ConnectionManager
    let connections = app.state::<socket::ConnectionManager>();
    let sandbox = app.state::<socket::SandboxConnectionManager>();
    let server = socket::SocketServer::new_with_connections(port, app.clone(), connections.inner().clone(), sandbox.inner().clone());
    
    // 在后台启动服务器
    tokio::spawn(async move {
        println!("📡 Socket服务器开始监听...");
        if let Err(e) = server.start().await {
            eprintln!("❌ Socket服务器错误: {}", e);
        }
    });
    
    // 给服务器一点时间启动
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
    
    let result = format!("Socket服务器启动在端口: {}", port);
    println!("✅ {}", result);
    Ok(result)
}

#[tauri::command]
async fn send_to_vehicle(
    app: tauri::AppHandle,
    vehicle_id: i32,
    message_type: u16,
    data: Vec<u8>
) -> Result<String, String> {
    let connections = app.state::<socket::ConnectionManager>();
    socket::SocketServer::send_to_vehicle(&connections, vehicle_id, message_type, &data)
        .map(|_| "消息发送成功".to_string())
}

// 发送沙盘控制指令（0x2001）
#[tauri::command]
async fn send_sandbox_control(
    app: tauri::AppHandle,
    vehicle_id: u8,
    action: u8, // 0: 自动驾驶, 1: 平行驾驶
) -> Result<String, String> {
    // 构建数据域: 车辆编号(1) + 动作(1)
    let mut data = Vec::with_capacity(2);
    data.push(vehicle_id);
    data.push(action);

    let sandbox = app.state::<socket::SandboxConnectionManager>();
    socket::SocketServer::send_to_sandbox(&sandbox, 0x2001, &data)
        .map(|_| "发送成功".to_string())
}

#[tauri::command]
async fn broadcast_message(
    app: tauri::AppHandle,
    message_type: u16,
    data: Vec<u8>
) -> Result<String, String> {
    let connections = app.state::<socket::ConnectionManager>();
    let count = socket::SocketServer::broadcast_message(&connections, message_type, &data);
    Ok(format!("消息已发送给 {} 个车辆", count))
}

#[tauri::command]
async fn get_connected_vehicles(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let connections = app.state::<socket::ConnectionManager>();
    let status = socket::SocketServer::get_connection_status(&connections);
    Ok(serde_json::json!(status))
}

// ============ 车辆连接管理相关命令 ============

/// 获取所有车辆连接
#[tauri::command]
async fn get_vehicle_connections(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_all_vehicle_connections().await {
        Ok(connections) => Ok(serde_json::to_value(connections).unwrap()),
        Err(e) => Err(format!("获取车辆连接失败: {}", e))
    }
}

/// 创建车辆连接
#[tauri::command]
async fn create_vehicle_connection(
    app: tauri::AppHandle,
    request: CreateVehicleConnectionRequest
) -> Result<serde_json::Value, String> {
    // 验证请求参数
    if let Err(e) = request.validate() {
        return Err(e);
    }
    
    let db = app.state::<VehicleDatabase>();
    match db.create_vehicle_connection(request).await {
        Ok(connection) => Ok(serde_json::to_value(connection).unwrap()),
        Err(e) => {
            let error_msg = if e.to_string().contains("UNIQUE constraint failed") {
                "车辆ID已存在，请使用不同的车辆ID".to_string()
            } else {
                format!("创建车辆连接失败: {}", e)
            };
            Err(error_msg)
        }
    }
}

/// 更新车辆连接
#[tauri::command]
async fn update_vehicle_connection(
    app: tauri::AppHandle,
    id: i64,
    request: UpdateVehicleConnectionRequest
) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.update_vehicle_connection(id, request).await {
        Ok(Some(connection)) => Ok(serde_json::to_value(connection).unwrap()),
        Ok(None) => Err("车辆连接不存在".to_string()),
        Err(e) => {
            let error_msg = if e.to_string().contains("UNIQUE constraint failed") {
                "车辆ID已存在，请使用不同的车辆ID".to_string()
            } else {
                format!("更新车辆连接失败: {}", e)
            };
            Err(error_msg)
        }
    }
}

/// 删除车辆连接
#[tauri::command]
async fn delete_vehicle_connection(app: tauri::AppHandle, id: i64) -> Result<String, String> {
    let db = app.state::<VehicleDatabase>();
    match db.delete_vehicle_connection(id).await {
        Ok(true) => Ok("删除成功".to_string()),
        Ok(false) => Err("车辆连接不存在".to_string()),
        Err(e) => Err(format!("删除车辆连接失败: {}", e))
    }
}

/// 获取活跃的车辆连接
#[tauri::command]
async fn get_active_vehicle_connections(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_active_vehicle_connections().await {
        Ok(connections) => Ok(serde_json::to_value(connections).unwrap()),
        Err(e) => Err(format!("获取活跃车辆连接失败: {}", e))
    }
}

/// 获取网络状态信息
#[tauri::command]
async fn get_network_status() -> Result<serde_json::Value, String> {
    match local_ip() {
        Ok(ip) => {
            let ip_str = ip.to_string();
            let is_private = is_private_ip(&ip_str);
            
            Ok(serde_json::json!({
                "connected": true,
                "ip": ip_str,
                "is_private": is_private,
                "text": if is_private { 
                    format!("局域网已连接 {}", ip_str) 
                } else { 
                    format!("公网已连接 {}", ip_str) 
                },
                "icon": "signal"
            }))
        }
        Err(_) => {
            Ok(serde_json::json!({
                "connected": false,
                "ip": null,
                "is_private": false,
                "text": "未检测到网络",
                "icon": "times-circle"
            }))
        }
    }
}

/// 获取Socket服务器状态
#[tauri::command]
async fn get_socket_server_status(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let connections = app.state::<socket::ConnectionManager>();
    let connected_vehicles = socket::SocketServer::get_connection_status(&connections);
    let vehicle_count = connected_vehicles.len();
    
    // 检查是否有连接的管理器状态（简单判断服务是否运行）
    let is_running = true; // 如果能获取到连接管理器，说明服务正在运行
    
    Ok(serde_json::json!({
        "running": is_running,
        "vehicle_count": vehicle_count,
        "connected_vehicles": connected_vehicles,
        "text": if is_running {
            "运行中".to_string()
        } else {
            "未启动".to_string()
        },
        "icon": if is_running { "server" } else { "times-circle" }
    }))
}

/// 判断是否为私有IP地址
fn is_private_ip(ip: &str) -> bool {
    if let Ok(addr) = ip.parse::<std::net::Ipv4Addr>() {
        let octets = addr.octets();
        
        // 10.0.0.0 - 10.255.255.255
        if octets[0] == 10 {
            return true;
        }
        
        // 172.16.0.0 - 172.31.255.255
        if octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31 {
            return true;
        }
        
        // 192.168.0.0 - 192.168.255.255
        if octets[0] == 192 && octets[1] == 168 {
            return true;
        }
        
        // 169.254.0.0 - 169.254.255.255 (APIPA)
        if octets[0] == 169 && octets[1] == 254 {
            return true;
        }
    }
    
    false
}

// 获取交通灯设置
#[tauri::command]
async fn get_traffic_light_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_traffic_light_settings().await {
        Ok(settings) => Ok(serde_json::to_value(settings).unwrap()),
        Err(e) => Err(format!("获取交通灯设置失败: {}", e))
    }
}

// 更新交通灯设置
#[tauri::command]
async fn update_traffic_light_settings(
    app: tauri::AppHandle, 
    request: UpdateTrafficLightSettingsRequest
) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.update_traffic_light_settings(request).await {
        Ok(settings) => Ok(serde_json::to_value(settings).unwrap()),
        Err(e) => Err(format!("更新交通灯设置失败: {}", e))
    }
}

#[tauri::command]
async fn broadcast_taxi_order(
    app: tauri::AppHandle,
    order_id: String,
    start_x: f64,
    start_y: f64,
    end_x: f64,
    end_y: f64,
) -> Result<String, String> {
    // 1. 检查是否有在线车辆
    let connections = app.state::<socket::ConnectionManager>();
    let online_count = socket::SocketServer::get_connection_status(&connections).len();
    
    if online_count == 0 {
        return Err("当前没有可用车辆".to_string());
    }

    // 2. 构建出租车订单协议数据域 (48字节)
    let mut data = Vec::with_capacity(48);
    
    // 订单号 (16字节) - 如果不足16字节则用空字节填充
    let mut order_bytes = order_id.as_bytes().to_vec();
    order_bytes.resize(16, 0);
    data.extend_from_slice(&order_bytes);
    
    // 起点X (8字节, DOUBLE, 小端序)
    data.extend_from_slice(&start_x.to_le_bytes());
    
    // 起点Y (8字节, DOUBLE, 小端序)  
    data.extend_from_slice(&start_y.to_le_bytes());
    
    // 终点X (8字节, DOUBLE, 小端序)
    data.extend_from_slice(&end_x.to_le_bytes());
    
    // 终点Y (8字节, DOUBLE, 小端序)
    data.extend_from_slice(&end_y.to_le_bytes());

    // 3. 广播消息给所有在线车辆
    let sent_count = socket::SocketServer::broadcast_message(&connections, 0x1003, &data);
    
    if sent_count > 0 {
        // 4. 发送成功，保存到数据库
        if let Some(db) = app.try_state::<VehicleDatabase>() {
            let taxi_order_request = CreateTaxiOrderRequest {
                order_id: order_id.clone(),
                start_x,
                start_y,
                end_x,
                end_y,
            };
            
            match db.create_taxi_order(taxi_order_request).await {
                Ok(_) => {
                    println!("✅ 出租车订单已保存到数据库: {}", order_id);
                }
                Err(e) => {
                    println!("❌ 保存出租车订单到数据库失败: {}", e);
                    // 虽然数据库保存失败，但消息已发送，所以不返回错误
                }
            }
        }
        
        Ok(format!("出租车订单已发送给 {} 个车辆", sent_count))
    } else {
        Err("发送出租车订单失败".to_string())
    }
}

#[tauri::command]
async fn send_avp_parking(
    app: tauri::AppHandle,
    vehicle_id: i32,
) -> Result<String, String> {
    // 1. 构建AVP泊车协议数据域 (2字节)
    let mut data = Vec::with_capacity(2);
    
    // 车辆编号 (1字节, UINT8)
    data.push(vehicle_id as u8);
    
    // 停车位编号 (1字节, UINT8) - 写死为1号车位
    data.push(1);

    // 2. 发送消息给指定车辆
    let connections = app.state::<socket::ConnectionManager>();
    let sent_result = socket::SocketServer::send_to_vehicle(&connections, vehicle_id, 0x1004, &data);
    
    match sent_result {
        Ok(_) => {
            // 3. 发送成功，保存到数据库
            if let Some(db) = app.try_state::<VehicleDatabase>() {
                let avp_parking_request = CreateAvpParkingRequest {
                    vehicle_id,
                    parking_spot: 1, // 写死为1号车位
                };
                
                match db.create_avp_parking(avp_parking_request).await {
                    Ok(_) => {
                        println!("✅ AVP泊车记录已保存到数据库: 车辆{}, 车位{}", vehicle_id, 1);
                    }
                    Err(e) => {
                        println!("❌ 保存AVP泊车记录到数据库失败: {}", e);
                        // 虽然数据库保存失败，但消息已发送，所以不返回错误
                    }
                }
            }
            
            Ok("AVP泊车指令发送成功".to_string())
        }
        Err(e) => {
            Err(format!("发送AVP泊车指令失败: {}", e))
        }
    }
}

#[tauri::command]
async fn send_avp_pickup(
    app: tauri::AppHandle,
    vehicle_id: i32,
) -> Result<String, String> {
    // 1. 构建AVP取车协议数据域 (1字节)
    let mut data = Vec::with_capacity(1);
    
    // 车辆编号 (1字节, UINT8)
    data.push(vehicle_id as u8);

    // 2. 发送消息给指定车辆
    let connections = app.state::<socket::ConnectionManager>();
    let sent_result = socket::SocketServer::send_to_vehicle(&connections, vehicle_id, 0x1005, &data);
    
    match sent_result {
        Ok(_) => {
            // 3. 发送成功，保存到数据库
            if let Some(db) = app.try_state::<VehicleDatabase>() {
                let avp_pickup_request = CreateAvpPickupRequest {
                    vehicle_id,
                };
                
                match db.create_avp_pickup(avp_pickup_request).await {
                    Ok(_) => {
                        println!("✅ AVP取车记录已保存到数据库: 车辆{}", vehicle_id);
                    }
                    Err(e) => {
                        println!("❌ 保存AVP取车记录到数据库失败: {}", e);
                        // 虽然数据库保存失败，但消息已发送，所以不返回错误
                    }
                }
            }
            
            Ok("AVP取车指令发送成功".to_string())
        }
        Err(e) => {
            Err(format!("发送AVP取车指令失败: {}", e))
        }
    }
}

#[tauri::command]
async fn get_vehicle_online_stats(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_recent_vehicle_online_time(7).await {
        Ok(records) => Ok(serde_json::to_value(records).unwrap()),
        Err(e) => Err(format!("获取车辆在线统计失败: {}", e))
    }
}

#[tauri::command]
async fn get_driving_behavior_stats(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_driving_behavior_stats().await {
        Ok(stats) => Ok(stats),
        Err(e) => Err(format!("获取自动驾驶行为统计失败: {}", e))
    }
}

// ============ 沙盘设置相关命令 ============

/// 获取沙盘服务设置
#[tauri::command]
async fn get_sandbox_service_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_sandbox_service_settings().await {
        Ok(settings) => Ok(serde_json::to_value(settings).unwrap()),
        Err(e) => Err(format!("获取沙盘服务设置失败: {}", e))
    }
}

/// 创建或更新沙盘服务设置
#[tauri::command]
async fn create_or_update_sandbox_service_settings(
    app: tauri::AppHandle,
    request: CreateOrUpdateSandboxServiceRequest
) -> Result<serde_json::Value, String> {
    // 验证请求参数
    if let Err(e) = request.validate() {
        return Err(e);
    }
    
    let db = app.state::<VehicleDatabase>();
    match db.create_or_update_sandbox_service_settings(request).await {
        Ok(settings) => Ok(serde_json::to_value(settings).unwrap()),
        Err(e) => Err(format!("创建或更新沙盘服务设置失败: {}", e))
    }
}

/// 删除沙盘服务设置
#[tauri::command]
async fn delete_sandbox_service_settings(app: tauri::AppHandle) -> Result<String, String> {
    let db = app.state::<VehicleDatabase>();
    match db.delete_sandbox_service_settings().await {
        Ok(true) => Ok("删除成功".to_string()),
        Ok(false) => Err("没有找到要删除的设置".to_string()),
        Err(e) => Err(format!("删除沙盘服务设置失败: {}", e))
    }
}

/// 获取所有沙盘摄像头
#[tauri::command]
async fn get_all_sandbox_cameras(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_all_sandbox_cameras().await {
        Ok(cameras) => Ok(serde_json::to_value(cameras).unwrap()),
        Err(e) => Err(format!("获取沙盘摄像头列表失败: {}", e))
    }
}

/// 创建沙盘摄像头
#[tauri::command]
async fn create_sandbox_camera(
    app: tauri::AppHandle,
    request: CreateSandboxCameraRequest
) -> Result<serde_json::Value, String> {
    // 验证请求参数
    if let Err(e) = request.validate() {
        return Err(e);
    }
    
    let db = app.state::<VehicleDatabase>();
    match db.create_sandbox_camera(request).await {
        Ok(camera) => Ok(serde_json::to_value(camera).unwrap()),
        Err(e) => Err(format!("创建沙盘摄像头失败: {}", e))
    }
}

/// 更新沙盘摄像头
#[tauri::command]
async fn update_sandbox_camera(
    app: tauri::AppHandle,
    id: i64,
    request: UpdateSandboxCameraRequest
) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.update_sandbox_camera(id, request).await {
        Ok(Some(camera)) => Ok(serde_json::to_value(camera).unwrap()),
        Ok(None) => Err("摄像头不存在".to_string()),
        Err(e) => Err(format!("更新沙盘摄像头失败: {}", e))
    }
}

/// 删除沙盘摄像头
#[tauri::command]
async fn delete_sandbox_camera(app: tauri::AppHandle, id: i64) -> Result<String, String> {
    let db = app.state::<VehicleDatabase>();
    match db.delete_sandbox_camera(id).await {
        Ok(true) => Ok("删除成功".to_string()),
        Ok(false) => Err("摄像头不存在".to_string()),
        Err(e) => Err(format!("删除沙盘摄像头失败: {}", e))
    }
}

// ============ 视频流相关命令 ============

/// 启动视频流服务器
#[tauri::command]
async fn start_video_stream_server(app: tauri::AppHandle, port: u16) -> Result<String, String> {
    println!("🎥 启动视频流服务器，端口: {}", port);
    
    let db = app.state::<VehicleDatabase>();
    let db_clone = {
        let db_ref: &VehicleDatabase = db.inner();
        db_ref.clone()
    };
    let server = rtsp_stream::VideoStreamServer::new(port, std::sync::Arc::new(db_clone));
    
    // 在后台启动视频流服务器
    tokio::spawn(async move {
        println!("📺 视频流服务器开始监听...");
        if let Err(e) = server.start().await {
            let error_msg = e.to_string();
            if error_msg.contains("Address already in use") {
                println!("ℹ️ 视频流服务器端口{}已被占用，可能已有实例在运行", port);
            } else {
                eprintln!("❌ 视频流服务器错误: {}", e);
            }
        }
    });
    
    // 给服务器一点时间启动
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    let result = format!("视频流服务器启动在端口: {}", port);
    println!("✅ {}", result);
    Ok(result)
}

/// 获取摄像头流URL
#[tauri::command]
async fn get_camera_stream_url(camera_id: i64, server_port: Option<u16>) -> Result<String, String> {
    let port = server_port.unwrap_or(9001);
    let url = format!("http://127.0.0.1:{}/stream/{}", port, camera_id);
    Ok(url)
}

/// 获取摄像头WebSocket URL
#[tauri::command]
async fn get_camera_websocket_url(camera_id: i64, server_port: Option<u16>) -> Result<String, String> {
    let port = server_port.unwrap_or(9001);
    let url = format!("ws://127.0.0.1:{}/ws/camera/{}", port, camera_id);
    Ok(url)
}

// ============ RTSP转换相关命令 ============

/// 启动RTSP到HLS转换
#[tauri::command]
async fn start_rtsp_conversion(
    app: tauri::AppHandle,
    camera_id: i64,
    rtsp_url: String
) -> Result<String, String> {
    println!("🔄 启动RTSP转换: camera_id={}, rtsp_url={}", camera_id, rtsp_url);
    
    // 检查是否已有转换器实例
    let converter = match app.try_state::<RTSPConverter>() {
        Some(converter) => converter.inner().clone(),
        None => {
            // 创建新的转换器实例
            let output_dir = std::env::temp_dir().join("dz_viz_hls");
            let converter = RTSPConverter::new(output_dir);
            app.manage(converter);
            app.state::<RTSPConverter>().inner().clone()
        }
    };
    
    match converter.start_conversion(camera_id, rtsp_url).await {
        Ok(hls_url) => Ok(hls_url),
        Err(e) => Err(format!("启动RTSP转换失败: {}", e))
    }
}

/// 停止RTSP转换
#[tauri::command]
async fn stop_rtsp_conversion(app: tauri::AppHandle, camera_id: i64) -> Result<String, String> {
    if let Some(converter) = app.try_state::<RTSPConverter>() {
        match converter.stop_conversion(camera_id).await {
            Ok(_) => Ok("转换已停止".to_string()),
            Err(e) => Err(format!("停止RTSP转换失败: {}", e))
        }
    } else {
        Err("RTSP转换器未初始化".to_string())
    }
}

/// 获取HLS流URL
#[tauri::command]
async fn get_hls_url(app: tauri::AppHandle, camera_id: i64, hls_port: Option<u16>) -> Result<String, String> {
    let port = hls_port.unwrap_or(9002);
    
    if let Some(converter) = app.try_state::<RTSPConverter>() {
        if let Some(stream_info) = converter.get_stream_info(camera_id).await {
            let url = format!("http://127.0.0.1:{}{}", port, stream_info.hls_url);
            return Ok(url);
        }
    }
    
    Err("未找到对应的HLS流".to_string())
}

/// 启动HLS服务器
#[tauri::command]
async fn start_hls_server(app: tauri::AppHandle, port: Option<u16>) -> Result<String, String> {
    let hls_port = port.unwrap_or(9002);
    
    // 检查是否已有HLS服务器实例
    if app.try_state::<HLSServer>().is_some() {
        return Ok("HLS服务器已在运行".to_string());
    }
    
    let base_dir = std::env::temp_dir().join("dz_viz_hls");
    let hls_server = HLSServer::new(hls_port, base_dir);
    
    // 在后台启动HLS服务器
    let server_clone = HLSServer::new(hls_port, std::env::temp_dir().join("dz_viz_hls"));
    tokio::spawn(async move {
        if let Err(e) = server_clone.start().await {
            eprintln!("❌ HLS服务器启动失败: {}", e);
        }
    });
    
    app.manage(hls_server);
    Ok(format!("HLS服务器已启动在端口: {}", hls_port))
}

// UDP视频服务器全局管理器
static UDP_VIDEO_MANAGER: once_cell::sync::Lazy<Arc<Mutex<UdpVideoManager>>> = 
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(UdpVideoManager::new())));

/// 启动UDP视频服务器
#[tauri::command]
async fn start_udp_video_server(app: tauri::AppHandle, port: u16) -> Result<String, String> {
    let bind_addr = format!("0.0.0.0:{}", port);
    let mut manager = UDP_VIDEO_MANAGER.lock().await;
    
    manager.start_server(&bind_addr, Some(app)).await
        .map_err(|e| format!("启动UDP视频服务器失败: {}", e))?;
    
    Ok(format!("UDP视频服务器已启动在端口: {}", port))
}

/// 停止UDP视频服务器
#[tauri::command]
async fn stop_udp_video_server() -> Result<String, String> {
    let mut manager = UDP_VIDEO_MANAGER.lock().await;
    manager.stop_server().await;
    Ok("UDP视频服务器已停止".to_string())
}

/// 获取UDP视频服务器状态
#[tauri::command]
async fn get_udp_video_server_stats() -> Result<Option<ServerStats>, String> {
    let manager = UDP_VIDEO_MANAGER.lock().await;
    Ok(manager.get_stats().await)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(socket::ConnectionManager::default())
        .manage(Arc::new(parking_lot::RwLock::new(None)) as socket::SandboxConnectionManager)
        .invoke_handler(tauri::generate_handler![
            greet,
            open_folder,
            get_system_info,
            minimize_window,
            maximize_window,
            close_window,
            start_socket_server,
            send_to_vehicle,
            send_sandbox_control,
            broadcast_message,
            get_connected_vehicles,
            get_vehicle_connections,
            create_vehicle_connection,
            update_vehicle_connection,
            delete_vehicle_connection,
            get_active_vehicle_connections,
            get_network_status,
            get_socket_server_status,
            get_traffic_light_settings,
            update_traffic_light_settings,
            broadcast_taxi_order,
            send_avp_parking,
            send_avp_pickup,
            get_vehicle_online_stats,
            get_driving_behavior_stats,
            get_sandbox_service_settings,
            create_or_update_sandbox_service_settings,
            delete_sandbox_service_settings,
            get_all_sandbox_cameras,
            create_sandbox_camera,
            update_sandbox_camera,
            delete_sandbox_camera,
            start_video_stream_server,
            get_camera_stream_url,
            get_camera_websocket_url,
            start_rtsp_conversion,
            stop_rtsp_conversion,
            get_hls_url,
            start_hls_server,
            start_udp_video_server,
            stop_udp_video_server,
            get_udp_video_server_stats,
            send_sandbox_traffic_light_duration,
            get_traffic_light_item,
            update_traffic_light_item
        ])
        .setup(|app| {
            // 克隆app handle用于不同任务
            let app_handle_db = app.handle().clone();
            let app_handle_udp = app.handle().clone();
            
            // 初始化数据库
            tauri::async_runtime::spawn(async move {
                match VehicleDatabase::new().await {
                    Ok(db) => {
                        app_handle_db.manage(db);
                        println!("✅ 车辆数据库初始化成功");
                    }
                    Err(e) => {
                        eprintln!("❌ 车辆数据库初始化失败: {}", e);
                    }
                }
            });

            // 初始化UDP视频服务器
            tauri::async_runtime::spawn(async move {
                let mut manager = UDP_VIDEO_MANAGER.lock().await;
                match manager.start_server("0.0.0.0:8080", Some(app_handle_udp)).await {
                    Ok(_) => {
                        println!("✅ UDP视频服务器自动启动成功: 0.0.0.0:8080");
                    }
                    Err(e) => {
                        eprintln!("❌ UDP视频服务器启动失败: {}", e);
                    }
                }
            });
            
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
