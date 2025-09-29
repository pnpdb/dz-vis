// 车辆相关命令
use crate::config::AppConfig;
use crate::database::{
    CreateAvpParkingRequest, CreateAvpPickupRequest, CreateTaxiOrderRequest,
    CreateVehicleConnectionRequest, UpdateVehicleConnectionRequest, VehicleDatabase,
};
use crate::protocol_processing::types::{
    AvpParkingData, AvpPickupData, ControlCommandType, DataRecordingData, PositionData,
    TaxiOrderData, VehicleControlCommand, VehicleFunctionSettingData, VehiclePathDisplayData,
    MessageTypes,
};
use crate::services::vehicle::VehicleService;
use crate::socket::{self, ConnectionManager, SandboxConnectionManager};
use log::{error, info, warn};
use tauri::Manager;

/// 启动Socket服务器
#[tauri::command]
pub async fn start_socket_server(app: tauri::AppHandle) -> Result<String, String> {
    // 使用Tauri状态中的ConnectionManager
    let connections = app.state::<ConnectionManager>();
    let sandbox = app.state::<SandboxConnectionManager>();
    let port = AppConfig::global().ports.socket_server;
    let server = socket::SocketServer::new_with_connections(
        port,
        app.clone(),
        connections.inner().clone(),
        sandbox.inner().clone(),
    );

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
    data: Vec<u8>,
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
    data: Vec<u8>,
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
    let payload = VehicleService::new()
        .build_construction_marker_payload(marker_id, position_x, position_y, action);

    let connections = app.state::<ConnectionManager>();
    let sent_count = socket::SocketServer::broadcast_message(&connections, 0x1008, &payload);

    let action_name = if action == 1 { "设置" } else { "取消" };
    info!(
        "广播施工标记 - ID: {}, 位置: ({:.3}, {:.3}), 动作: {} ({})",
        marker_id, position_x, position_y, action, action_name
    );

    Ok(format!("已广播给{}辆车", sent_count))
}

/// 广播所有施工标记信息 (0x1008) - 新协议格式
#[tauri::command]
pub async fn broadcast_all_construction_markers(
    app: tauri::AppHandle,
    markers: Vec<serde_json::Value>,
) -> Result<String, String> {
    let coordinate_pairs: Vec<(f64, f64)> = markers
        .iter()
        .filter_map(|marker| {
            let x = marker.get("x").and_then(|v| v.as_f64());
            let z = marker.get("z").and_then(|v| v.as_f64());
            match (x, z) {
                (Some(px), Some(pz)) => Some((px, pz)),
                _ => None,
            }
        })
        .collect();

    let payload = VehicleService::new().build_all_construction_markers_payload(&coordinate_pairs);

    let connections = app.state::<ConnectionManager>();
    let sent_count = socket::SocketServer::broadcast_message(&connections, 0x1008, &payload);

    info!(
        "广播所有施工标记 - 共{}个施工点，数据长度: {}字节",
        coordinate_pairs.len(),
        payload.len()
    );
    for (index, (x, z)) in coordinate_pairs.iter().enumerate() {
        info!("  施工点{}: ({:.3}, {:.3})", index + 1, x, z);
    }

    Ok(format!(
        "已广播{}个施工点给{}辆车",
        markers.len(),
        sent_count
    ))
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
        Err(e) => Err(format!("获取车辆连接失败: {}", e)),
    }
}

/// 创建车辆连接
#[tauri::command]
pub async fn create_vehicle_connection(
    app: tauri::AppHandle,
    request: CreateVehicleConnectionRequest,
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
    request: UpdateVehicleConnectionRequest,
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
        Err(e) => Err(format!("删除车辆连接失败: {}", e)),
    }
}

/// 获取活跃的车辆连接
#[tauri::command]
pub async fn get_active_vehicle_connections(
    app: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_active_vehicle_connections().await {
        Ok(connections) => Ok(serde_json::to_value(connections).unwrap()),
        Err(e) => Err(format!("获取活跃车辆连接失败: {}", e)),
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

/// 发送出租车订单给指定车辆
#[tauri::command]
pub async fn send_taxi_order_to_vehicle(
    app: tauri::AppHandle,
    order_id: String,
    vehicle_id: u8,
    start_x: f64,
    start_y: f64,
    end_x: f64,
    end_y: f64,
) -> Result<String, String> {
    let connections = app.state::<ConnectionManager>();
    let db = app.state::<VehicleDatabase>();

    // 1. 检查指定车辆是否在线
    let vehicle_id_i32 = vehicle_id as i32;
    let online_vehicles = socket::SocketServer::get_connection_status(&connections);
    let vehicle_online = online_vehicles.iter().any(|v| {
        v.get("vehicle_id")
            .and_then(|id| id.as_i64())
            .map(|id| id as i32)
            == Some(vehicle_id_i32)
    });

    if !vehicle_online {
        return Err(format!("车辆{}当前不在线", vehicle_id));
    }

    let order_payload = VehicleService::new().build_taxi_order_payload(&TaxiOrderData {
        vehicle_id,
        start_x,
        start_y,
        end_x,
        end_y,
    });

    // 3. 发送消息给指定车辆
    let success =
        socket::SocketServer::send_to_vehicle(&connections, vehicle_id_i32, 0x1003, &order_payload)
            .is_ok();

    if success {
        // 4. 发送成功后保存到数据库
        match db
            .save_taxi_order(&order_id, vehicle_id_i32, start_x, start_y, end_x, end_y)
            .await
        {
            Ok(_) => {
                info!(
                    "✅ 出租车订单发送并保存成功: 订单{}, 车辆{}",
                    order_id, vehicle_id
                );
                Ok(format!(
                    "出租车订单已发送给{}号车并保存到数据库",
                    vehicle_id
                ))
            }
            Err(e) => {
                warn!(
                    "⚠️ 出租车订单发送成功但保存失败: 订单{}, 车辆{}, 错误: {}",
                    order_id, vehicle_id, e
                );
                // 即使保存失败，也认为发送成功
                Ok(format!(
                    "出租车订单已发送给{}号车，但数据库保存失败: {}",
                    vehicle_id, e
                ))
            }
        }
    } else {
        Err(format!("发送出租车订单给车辆{}失败", vehicle_id))
    }
}

/// 广播出租车订单（保留原有功能）
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

    let broadcast_payload = VehicleService::new()
        .build_taxi_order_broadcast_payload(&order_id, start_x, start_y, end_x, end_y);

    // 3. 广播消息给所有在线车辆
    let sent_count =
        socket::SocketServer::broadcast_message(&connections, 0x1003, &broadcast_payload);

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
pub async fn send_avp_parking(app: tauri::AppHandle, vehicle_id: i32) -> Result<String, String> {
    // 1. 构建AVP泊车协议数据域 (2字节)
    let parking_payload = VehicleService::new().build_avp_parking_payload(&AvpParkingData {
        vehicle_id: vehicle_id as u8,
        parking_spot: 1,
    });

    // 2. 发送消息给指定车辆
    let connections = app.state::<ConnectionManager>();
    let sent_result =
        socket::SocketServer::send_to_vehicle(&connections, vehicle_id, 0x1004, &parking_payload);

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
                        info!(
                            "✅ AVP泊车记录已保存到数据库: 车辆{}, 车位{}",
                            vehicle_id, 1
                        );
                    }
                    Err(e) => {
                        warn!("❌ 保存AVP泊车记录到数据库失败: {}", e);
                        // 虽然数据库保存失败，但消息已发送，所以不返回错误
                    }
                }
            }

            Ok("AVP泊车指令发送成功".to_string())
        }
        Err(e) => Err(format!("发送AVP泊车指令失败: {}", e)),
    }
}

/// 发送AVP取车指令
#[tauri::command]
pub async fn send_avp_pickup(app: tauri::AppHandle, vehicle_id: i32) -> Result<String, String> {
    // 1. 构建AVP取车协议数据域 (1字节)
    let pickup_payload = VehicleService::new().build_avp_pickup_payload(&AvpPickupData {
        vehicle_id: vehicle_id as u8,
    });

    // 2. 发送消息给指定车辆
    let connections = app.state::<ConnectionManager>();
    let sent_result =
        socket::SocketServer::send_to_vehicle(&connections, vehicle_id, 0x1005, &pickup_payload);

    match sent_result {
        Ok(_) => {
            // 3. 发送成功，保存到数据库
            if let Some(db) = app.try_state::<VehicleDatabase>() {
                let avp_pickup_request = CreateAvpPickupRequest { vehicle_id };

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
        Err(e) => Err(format!("发送AVP取车指令失败: {}", e)),
    }
}

/// 获取车辆在线统计
#[tauri::command]
pub async fn get_vehicle_online_stats(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_recent_vehicle_online_time(7).await {
        Ok(records) => Ok(serde_json::to_value(records).unwrap()),
        Err(e) => Err(format!("获取车辆在线统计失败: {}", e)),
    }
}

/// 获取驾驶行为统计
#[tauri::command]
pub async fn get_driving_behavior_stats(
    app: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_driving_behavior_stats().await {
        Ok(stats) => Ok(stats),
        Err(e) => Err(format!("获取自动驾驶行为统计失败: {}", e)),
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

#[tauri::command]
pub async fn send_vehicle_control_command(
    app: tauri::AppHandle,
    vehicle_id: u8,
    command: String,
    position_data: Option<PositionData>,
) -> Result<String, String> {
    let command_type = match command.as_str() {
        "Start" => ControlCommandType::Start,
        "Stop" => ControlCommandType::Stop,
        "EmergencyBrake" => ControlCommandType::EmergencyBrake,
        "InitPose" => ControlCommandType::InitPose,
        _ => return Err(format!("不支持的控制指令: {}", command)),
    };

    let payload = VehicleService::new().build_vehicle_control_payload(&VehicleControlCommand {
        vehicle_id,
        command: command_type,
        position_data,
    });

    let connections = app.state::<ConnectionManager>();
    socket::SocketServer::send_to_vehicle(&connections, vehicle_id as i32, MessageTypes::VEHICLE_CONTROL, &payload)
        .map(|_| "车辆控制指令发送成功".to_string())
}

/// 发送数据记录协议
#[tauri::command]
pub async fn send_data_recording_command(
    app: tauri::AppHandle,
    vehicle_id: u8,
    recording_status: u8,
) -> Result<String, String> {
    if !matches!(recording_status, 0 | 1) {
        return Err(format!("无效的数据记录状态: {}", recording_status));
    }

    let payload = VehicleService::new().build_data_recording_payload(&DataRecordingData {
        vehicle_id,
        action: recording_status,
    });

    let connections = app.state::<ConnectionManager>();
    socket::SocketServer::send_to_vehicle(&connections, vehicle_id as i32, 0x1002, &payload)
        .map(|_| "数据记录指令发送成功".to_string())
}

/// 发送车辆功能设置协议
#[tauri::command]
pub async fn send_vehicle_function_setting_command(
    app: tauri::AppHandle,
    vehicle_id: u8,
    function_id: u8,
    enable_status: u8,
) -> Result<String, String> {
    if function_id > 7 {
        return Err(format!("功能编号无效: {}", function_id));
    }
    if !matches!(enable_status, 0 | 1) {
        return Err(format!("启用状态无效: {}", enable_status));
    }

    let payload = VehicleService::new().build_vehicle_function_setting_payload(&VehicleFunctionSettingData {
        vehicle_id,
        function_id,
        enable_status,
    });

    let connections = app.state::<ConnectionManager>();
    socket::SocketServer::send_to_vehicle(&connections, vehicle_id as i32, 0x1006, &payload)
        .map(|_| "车辆功能设置指令发送成功".to_string())
}

/// 发送车辆路径显示协议
#[tauri::command]
pub async fn send_vehicle_path_display_command(
    app: tauri::AppHandle,
    vehicle_id: u8,
    display_path: u8,
) -> Result<String, String> {
    if !matches!(display_path, 0 | 1) {
        return Err(format!("显示路径状态无效: {}", display_path));
    }

    let payload = VehicleService::new().build_vehicle_path_display_payload(&VehiclePathDisplayData {
        vehicle_id,
        display_path,
    });

    let connections = app.state::<ConnectionManager>();
    socket::SocketServer::send_to_vehicle(&connections, vehicle_id as i32, 0x1007, &payload)
        .map(|_| "车辆路径显示指令发送成功".to_string())
}

// 其余命令维持原样。
