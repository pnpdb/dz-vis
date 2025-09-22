// 车辆相关命令
use crate::config::AppConfig;
use crate::socket::{self, ConnectionManager, SandboxConnectionManager};
use crate::database::{VehicleDatabase, CreateVehicleConnectionRequest, UpdateVehicleConnectionRequest, CreateTaxiOrderRequest, CreateAvpParkingRequest, CreateAvpPickupRequest};
use log::{info, warn, error};
use tauri::Manager;

/// 启动Socket服务器
#[tauri::command]
pub async fn start_socket_server(app: tauri::AppHandle, port: u16) -> Result<String, String> {    
    // 使用Tauri状态中的ConnectionManager
    let connections = app.state::<ConnectionManager>();
    let sandbox = app.state::<SandboxConnectionManager>();
    let server = socket::SocketServer::new_with_connections(port, app.clone(), connections.inner().clone(), sandbox.inner().clone());
    
    // 在后台启动服务器
    tokio::spawn(async move {
        if let Err(e) = server.start().await {
            error!("❌ Socket服务器错误: {}", e);
        }
    });
    
    // 给服务器一点时间启动
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
    
    let result = format!("Socket服务器启动在端口: {}", port);
    info!("✅ {}", result);
    Ok(result)
}

/// 发送消息给指定车辆
#[tauri::command]
pub async fn send_to_vehicle(
    app: tauri::AppHandle,
    vehicle_id: i32,
    message_type: u16,
    data: Vec<u8>
) -> Result<String, String> {
    let connections = app.state::<ConnectionManager>();
    socket::SocketServer::send_to_vehicle(&connections, vehicle_id, message_type, &data)
        .map(|_| "消息发送成功".to_string())
}

/// 广播消息给所有车辆
#[tauri::command]
pub async fn broadcast_message(
    app: tauri::AppHandle,
    message_type: u16,
    data: Vec<u8>
) -> Result<String, String> {
    let connections = app.state::<ConnectionManager>();
    let count = socket::SocketServer::broadcast_message(&connections, message_type, &data);
    Ok(format!("消息已发送给 {} 个车辆", count))
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
    
    let connections = app.state::<ConnectionManager>();
    let sent_count = socket::SocketServer::broadcast_message(&connections, 0x1008, &data);
    
    let action_name = if action == 1 { "设置" } else { "取消" };
    info!("广播施工标记 - ID: {}, 位置: ({:.3}, {:.3}), 动作: {} ({})", 
          marker_id, position_x, position_y, action, action_name);
    
    Ok(format!("已广播给{}辆车", sent_count))
}

/// 获取已连接的车辆
#[tauri::command]
pub async fn get_connected_vehicles(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let connections = app.state::<ConnectionManager>();
    let status = socket::SocketServer::get_connection_status(&connections);
    Ok(serde_json::json!(status))
}

/// 获取所有车辆连接配置
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
pub async fn update_vehicle_connection(
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
pub async fn delete_vehicle_connection(app: tauri::AppHandle, id: i64) -> Result<String, String> {
    let db = app.state::<VehicleDatabase>();
    match db.delete_vehicle_connection(id).await {
        Ok(true) => Ok("删除成功".to_string()),
        Ok(false) => Err("车辆连接不存在".to_string()),
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
    let connections = app.state::<ConnectionManager>();
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

/// 广播出租车订单
#[tauri::command]
pub async fn broadcast_taxi_order(
    app: tauri::AppHandle,
    order_id: String,
    start_x: f64,
    start_y: f64,
    end_x: f64,
    end_y: f64,
) -> Result<String, String> {
    // 1. 检查是否有在线车辆
    let connections = app.state::<ConnectionManager>();
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
                        info!("✅ 出租车订单已保存到数据库: {}", order_id);
                    }
                    Err(e) => {
                        warn!("❌ 保存出租车订单到数据库失败: {}", e);
                    // 虽然数据库保存失败，但消息已发送，所以不返回错误
                }
            }
        }
        
        Ok(format!("出租车订单已发送给 {} 个车辆", sent_count))
    } else {
        Err("发送出租车订单失败".to_string())
    }
}

/// 发送AVP停车指令
#[tauri::command]
pub async fn send_avp_parking(
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
    let connections = app.state::<ConnectionManager>();
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
                        info!("✅ AVP泊车记录已保存到数据库: 车辆{}, 车位{}", vehicle_id, 1);
                    }
                    Err(e) => {
                        warn!("❌ 保存AVP泊车记录到数据库失败: {}", e);
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

/// 发送AVP取车指令
#[tauri::command]
pub async fn send_avp_pickup(
    app: tauri::AppHandle,
    vehicle_id: i32,
) -> Result<String, String> {
    // 1. 构建AVP取车协议数据域 (1字节)
    let mut data = Vec::with_capacity(1);
    
    // 车辆编号 (1字节, UINT8)
    data.push(vehicle_id as u8);

    // 2. 发送消息给指定车辆
    let connections = app.state::<ConnectionManager>();
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
                        info!("✅ AVP取车记录已保存到数据库: 车辆{}", vehicle_id);
                    }
                    Err(e) => {
                        warn!("❌ 保存AVP取车记录到数据库失败: {}", e);
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

/// 获取车辆在线统计
#[tauri::command]
pub async fn get_vehicle_online_stats(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_recent_vehicle_online_time(7).await {
        Ok(records) => Ok(serde_json::to_value(records).unwrap()),
        Err(e) => Err(format!("获取车辆在线统计失败: {}", e))
    }
}

/// 获取驾驶行为统计
#[tauri::command]
pub async fn get_driving_behavior_stats(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_driving_behavior_stats().await {
        Ok(stats) => Ok(stats),
        Err(e) => Err(format!("获取自动驾驶行为统计失败: {}", e))
    }
}

/// 获取车辆服务器端口配置
#[tauri::command]
pub async fn get_vehicle_server_ports() -> Result<serde_json::Value, String> {
    let config = AppConfig::global();
    Ok(serde_json::json!({
        "socket_server": config.ports.socket_server
    }))
}