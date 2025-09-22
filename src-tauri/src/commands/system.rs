// 系统相关命令
use tauri::Manager;
use std::process::Command;
use local_ip_address::local_ip;
use log::{info, warn, error};

/// 问候命令 (示例命令)
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 打开系统文件选择器，返回选择的文档路径
#[tauri::command]
pub async fn pick_document(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let handle = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        handle
            .dialog()
            .file()
            .add_filter("Documents", &["pdf", "doc", "docx", "xls", "xlsx"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(picked.map(|p| match p {
        tauri_plugin_dialog::FilePath::Path(path) => path.to_string_lossy().to_string(),
        tauri_plugin_dialog::FilePath::Url(url) => url.to_string(),
    }))
}

/// 打开文件夹命令
#[tauri::command]
pub async fn open_folder() -> Result<(), String> {
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

/// 打开指定路径
#[tauri::command]
pub async fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open path: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", &path])
            .spawn()
            .map_err(|e| format!("Failed to open path: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open path: {}", e))?;
    }
    
    Ok(())
}

/// 获取系统信息
#[tauri::command]
pub async fn get_system_info() -> Result<serde_json::Value, String> {
    let local_ip = local_ip().map(|ip| ip.to_string()).unwrap_or_else(|_| "未知".to_string());
    
    Ok(serde_json::json!({
        "local_ip": local_ip,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// 最小化窗口
#[tauri::command]
pub async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

/// 最大化窗口
#[tauri::command]
pub async fn maximize_window(window: tauri::Window) -> Result<(), String> {
    window.maximize().map_err(|e| e.to_string())
}

/// 关闭窗口
#[tauri::command]
pub async fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

/// 获取网络状态
#[tauri::command]
pub async fn get_network_status() -> Result<serde_json::Value, String> {
    let local_ip = match local_ip() {
        Ok(ip) => ip.to_string(),
        Err(_) => "未知".to_string(),
    };
    
    // 简单的网络连通性检查
    let is_connected = match reqwest::get("http://www.baidu.com").await {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    };
    
    Ok(serde_json::json!({
        "local_ip": local_ip,
        "is_connected": is_connected,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}
