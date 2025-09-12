use tauri::Manager;
use std::process::Command;

mod socket;

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
    
    let server = socket::SocketServer::new(port, app.clone());
    
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
    car_id: String,
    message_type: u16,
    data: Vec<u8>
) -> Result<String, String> {
    let connections = app.state::<socket::ConnectionManager>();
    socket::SocketServer::send_to_vehicle(&connections, &car_id, message_type, &data)
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
            get_connected_vehicles
        ])
        .setup(|app| {
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
