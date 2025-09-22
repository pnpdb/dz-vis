// 车辆相关命令
use crate::socket;
use crate::database::{VehicleDatabase, CreateVehicleConnectionRequest, UpdateVehicleConnectionRequest, CreateTaxiOrderRequest, CreateAvpParkingRequest, CreateAvpPickupRequest};
use log::{info, warn, error};
use tauri::Manager;

/// 启动Socket服务器
#[tauri::command]
pub async fn start_socket_server(app: tauri::AppHandle, port: u16) -> Result<String, String> {
    let connections = app.state::<socket::ConnectionManager>();
    match socket::SocketServer::start_with_existing_manager(port, connections.clone(), app.handle().clone()).await {
        Ok(_) => {
            info!("Socket服务器启动成功，监听端口: {}", port);
            Ok(format!("Socket服务器启动成功，监听端口: {}", port))
        }
        Err(e) => {
            error!("Socket服务器启动失败: {}", e);
            Err(format!("Socket服务器启动失败: {}", e))
        }
    }
}

/// 发送消息给指定车辆
#[tauri::command]
pub async fn send_to_vehicle(
    app: tauri::AppHandle,
    vehicle_id: i32,
    message_type: u16,
    data: Vec<u8>
) -> Result<String, String> {
    let connections = app.state::<socket::ConnectionManager>();
    match socket::SocketServer::send_to_vehicle(&connections, vehicle_id, message_type, &data) {
        true => Ok(format!("消息已发送到车辆 {}", vehicle_id)),
        false => Err(format!("车辆 {} 未连接", vehicle_id))
    }
}

/// 广播消息给所有车辆
#[tauri::command]
pub async fn broadcast_message(
    app: tauri::AppHandle,
    message_type: u16,
    data: Vec<u8>
) -> Result<String, String> {
    let connections = app.state::<socket::ConnectionManager>();
    let sent_count = socket::SocketServer::broadcast_message(&connections, message_type, &data);
    Ok(format!("消息已广播给 {} 辆车", sent_count))
}

/// 广播施工标记信息 (0x1008)
#[tauri::command]
pub async fn broadcast_construction_marker(
    app: tauri::AppHandle,
    marker_id: u8,
    position_x: f64,
    position_y: f64,
    action: u8, // 0: 取消, 1: 设置
) -> Result<String, String> {
    // 构建施工标记协议数据域 (18字节)
    let mut data = Vec::new();
    data.push(marker_id);                               // 施工点ID (1字节)
    data.extend_from_slice(&position_x.to_le_bytes());  // 位置X (8字节, DOUBLE)
    data.extend_from_slice(&position_y.to_le_bytes());  // 位置Y (8字节, DOUBLE)  
    data.push(action);                                  // 动作 (1字节)
    
    let connections = app.state::<socket::ConnectionManager>();
    let sent_count = socket::SocketServer::broadcast_message(&connections, 0x1008, &data);
    
    let action_name = if action == 1 { "设置" } else { "取消" };
    info!("广播施工标记 - ID: {}, 位置: ({:.3}, {:.3}), 动作: {} ({})", 
          marker_id, position_x, position_y, action, action_name);
    
    Ok(format!("已广播给{}辆车", sent_count))
}

/// 获取已连接的车辆
#[tauri::command]
pub async fn get_connected_vehicles(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let connections = app.state::<socket::ConnectionManager>();
    let connected = socket::SocketServer::get_connected_vehicles(&connections);
    Ok(serde_json::to_value(connected).unwrap())
}

/// 获取车辆连接配置
#[tauri::command]
pub async fn get_vehicle_connections(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_all_vehicle_connections().await {
        Ok(connections) => Ok(serde_json::to_value(connections).unwrap()),
        Err(e) => Err(format!("获取车辆连接失败: {}", e))
    }
}

/// 创建车辆连接
#[tauri::command]
pub async fn create_vehicle_connection(
    app: tauri::AppHandle,
    request: CreateVehicleConnectionRequest
) -> Result<serde_json::Value, String> {
    if let Err(e) = request.validate() {
        return Err(e);
    }
    
    let db = app.state::<VehicleDatabase>();
    match db.create_vehicle_connection(request).await {
        Ok(connection) => {
            info!("车辆连接创建成功: ID={}, IP={}", connection.vehicle_id, connection.ip_address);
            Ok(serde_json::to_value(connection).unwrap())
        }
        Err(e) => Err(format!("创建车辆连接失败: {}", e))
    }
}

/// 更新车辆连接
#[tauri::command]
pub async fn update_vehicle_connection(
    app: tauri::AppHandle,
    id: i64,
    request: UpdateVehicleConnectionRequest
) -> Result<serde_json::Value, String> {
    if let Err(e) = request.validate() {
        return Err(e);
    }
    
    let db = app.state::<VehicleDatabase>();
    match db.update_vehicle_connection(id, request).await {
        Ok(connection) => {
            info!("车辆连接更新成功: ID={}", id);
            Ok(serde_json::to_value(connection).unwrap())
        }
        Err(e) => Err(format!("更新车辆连接失败: {}", e))
    }
}

/// 删除车辆连接
#[tauri::command]
pub async fn delete_vehicle_connection(app: tauri::AppHandle, id: i64) -> Result<String, String> {
    let db = app.state::<VehicleDatabase>();
    match db.delete_vehicle_connection(id).await {
        Ok(_) => {
            info!("车辆连接删除成功: ID={}", id);
            Ok(format!("车辆连接 {} 删除成功", id))
        }
        Err(e) => Err(format!("删除车辆连接失败: {}", e))
    }
}

/// 获取活跃的车辆连接
#[tauri::command]
pub async fn get_active_vehicle_connections(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_active_vehicle_connections().await {
        Ok(connections) => Ok(serde_json::to_value(connections).unwrap()),
        Err(e) => Err(format!("获取活跃车辆连接失败: {}", e))
    }
}

/// 获取Socket服务器状态
#[tauri::command]
pub async fn get_socket_server_status(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let connections = app.state::<socket::ConnectionManager>();
    let connected_count = {
        let guard = connections.lock();
        guard.len()
    };
    
    Ok(serde_json::json!({
        "is_running": true,
        "connected_count": connected_count,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// 广播出租车订单
#[tauri::command]
pub async fn broadcast_taxi_order(
    app: tauri::AppHandle,
    passenger_name: String,
    pickup_location: String,
    destination: String,
    order_time: String,
    contact_phone: String,
    estimated_fare: f64,
    priority_level: i32,
    special_requirements: Option<String>
) -> Result<String, String> {
    let db = app.state::<VehicleDatabase>();
    
    // 创建订单记录
    let order_request = CreateTaxiOrderRequest {
        passenger_name: passenger_name.clone(),
        pickup_location: pickup_location.clone(),
        destination: destination.clone(),
        order_time,
        contact_phone: contact_phone.clone(),
        estimated_fare,
        priority_level,
        special_requirements: special_requirements.clone()
    };
    
    let order = match db.create_taxi_order(order_request).await {
        Ok(order) => order,
        Err(e) => return Err(format!("创建出租车订单失败: {}", e))
    };
    
    // 构建协议数据
    let mut data = Vec::new();
    
    // 订单ID (4字节, UINT32)
    data.extend_from_slice(&(order.id as u32).to_le_bytes());
    
    // 乘客姓名 (32字节，UTF-8编码，不足补0)
    let passenger_bytes = passenger_name.as_bytes();
    data.extend_from_slice(passenger_bytes);
    data.resize(data.len() + (32 - passenger_bytes.len().min(32)), 0);
    
    // 上车地点 (64字节，UTF-8编码，不足补0)
    let pickup_bytes = pickup_location.as_bytes();
    data.extend_from_slice(pickup_bytes);
    data.resize(data.len() + (64 - pickup_bytes.len().min(64)), 0);
    
    // 目的地 (64字节，UTF-8编码，不足补0)
    let destination_bytes = destination.as_bytes();
    data.extend_from_slice(destination_bytes);
    data.resize(data.len() + (64 - destination_bytes.len().min(64)), 0);
    
    // 联系电话 (16字节，UTF-8编码，不足补0)
    let phone_bytes = contact_phone.as_bytes();
    data.extend_from_slice(phone_bytes);
    data.resize(data.len() + (16 - phone_bytes.len().min(16)), 0);
    
    // 预估费用 (8字节, DOUBLE)
    data.extend_from_slice(&estimated_fare.to_le_bytes());
    
    // 优先级 (4字节, UINT32)
    data.extend_from_slice(&(priority_level as u32).to_le_bytes());
    
    // 特殊需求 (64字节，UTF-8编码，不足补0)
    let requirements_str = special_requirements.unwrap_or_default();
    let requirements_bytes = requirements_str.as_bytes();
    data.extend_from_slice(requirements_bytes);
    data.resize(data.len() + (64 - requirements_bytes.len().min(64)), 0);
    
    let connections = app.state::<socket::ConnectionManager>();
    let sent_count = socket::SocketServer::broadcast_message(&connections, 0x1005, &data);
    
    info!("广播出租车订单 - 订单ID: {}, 乘客: {}, 上车地点: {}, 目的地: {}", 
          order.id, passenger_name, pickup_location, destination);
    
    Ok(format!("出租车订单已广播给{}辆车", sent_count))
}

/// 发送AVP停车指令
#[tauri::command]
pub async fn send_avp_parking(
    app: tauri::AppHandle,
    vehicle_id: i32,
    parking_spot: String,
    target_position_x: f64,
    target_position_y: f64,
    target_orientation: f64
) -> Result<String, String> {
    let db = app.state::<VehicleDatabase>();
    
    // 创建AVP停车记录
    let parking_request = CreateAvpParkingRequest {
        vehicle_id,
        parking_spot: parking_spot.clone(),
        target_position_x,
        target_position_y,
        target_orientation
    };
    
    let parking = match db.create_avp_parking(parking_request).await {
        Ok(parking) => parking,
        Err(e) => return Err(format!("创建AVP停车记录失败: {}", e))
    };
    
    // 构建协议数据域 (25字节)
    let mut data = Vec::new();
    data.extend_from_slice(&(parking.id as u32).to_le_bytes());    // 停车ID (4字节)
    data.extend_from_slice(&target_position_x.to_le_bytes());       // 目标位置X (8字节)
    data.extend_from_slice(&target_position_y.to_le_bytes());       // 目标位置Y (8字节)
    data.extend_from_slice(&target_orientation.to_le_bytes());      // 目标朝向 (8字节)
    
    let connections = app.state::<socket::ConnectionManager>();
    let success = socket::SocketServer::send_to_vehicle(&connections, vehicle_id, 0x1006, &data);
    
    if success {
        info!("发送AVP停车指令 - 车辆ID: {}, 停车位: {}, 位置: ({:.3}, {:.3}), 朝向: {:.3}°", 
              vehicle_id, parking_spot, target_position_x, target_position_y, target_orientation);
        Ok(format!("AVP停车指令已发送给车辆{}", vehicle_id))
    } else {
        Err(format!("车辆{}未连接，AVP停车指令发送失败", vehicle_id))
    }
}

/// 发送AVP取车指令
#[tauri::command]
pub async fn send_avp_pickup(
    app: tauri::AppHandle,
    vehicle_id: i32
) -> Result<String, String> {
    let db = app.state::<VehicleDatabase>();
    
    // 创建AVP取车记录
    let pickup_request = CreateAvpPickupRequest { vehicle_id };
    let pickup = match db.create_avp_pickup(pickup_request).await {
        Ok(pickup) => pickup,
        Err(e) => return Err(format!("创建AVP取车记录失败: {}", e))
    };
    
    // 构建协议数据域 (4字节)
    let mut data = Vec::new();
    data.extend_from_slice(&(pickup.id as u32).to_le_bytes());    // 取车ID (4字节)
    
    let connections = app.state::<socket::ConnectionManager>();
    let success = socket::SocketServer::send_to_vehicle(&connections, vehicle_id, 0x1007, &data);
    
    if success {
        info!("发送AVP取车指令 - 车辆ID: {}", vehicle_id);
        Ok(format!("AVP取车指令已发送给车辆{}", vehicle_id))
    } else {
        Err(format!("车辆{}未连接，AVP取车指令发送失败", vehicle_id))
    }
}

/// 获取车辆在线统计
#[tauri::command]
pub async fn get_vehicle_online_stats(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_vehicle_online_stats().await {
        Ok(stats) => Ok(serde_json::to_value(stats).unwrap()),
        Err(e) => Err(format!("获取车辆在线统计失败: {}", e))
    }
}

/// 获取驾驶行为统计
#[tauri::command]
pub async fn get_driving_behavior_stats(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    // 这里可以实现真实的驾驶行为统计逻辑
    // 暂时返回模拟数据
    Ok(serde_json::json!({
        "total_distance": 1234.5,
        "average_speed": 45.2,
        "fuel_consumption": 8.5,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}
