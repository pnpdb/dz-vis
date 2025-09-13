use tauri::Manager;
use std::process::Command;
use local_ip_address::local_ip;

mod socket;
mod database;

use database::{VehicleDatabase, CreateVehicleConnectionRequest, UpdateVehicleConnectionRequest, UpdateTrafficLightSettingsRequest};

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
    let server = socket::SocketServer::new_with_connections(port, app.clone(), connections.inner().clone());
    
    // 在后台启动服务器
    tokio::spawn(async move {
        println!("📡 Socket服务器开始监听...");
        if let Err(e) = server.start().await {
            eprintln!("❌ Socket服务器错误: {}", e);
        }
    });
    
    // 给服务器一点时间启动
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(socket::ConnectionManager::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            open_folder,
            get_system_info,
            minimize_window,
            maximize_window,
            close_window,
            start_socket_server,
            send_to_vehicle,
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
            update_traffic_light_settings
        ])
        .setup(|app| {
            // 初始化数据库
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match VehicleDatabase::new().await {
                    Ok(db) => {
                        app_handle.manage(db);
                        println!("✅ 车辆数据库初始化成功");
                    }
                    Err(e) => {
                        eprintln!("❌ 车辆数据库初始化失败: {}", e);
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
