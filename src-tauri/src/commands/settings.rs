// 设置相关命令
use crate::database::{VehicleDatabase, models::{UpdateAppSettingsRequest, UpdateMenuVisibilityRequest}};
use log::{info, warn};
use tauri::Manager;

/// 获取应用基本设置
#[tauri::command]
pub async fn get_app_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_app_settings().await {
        Ok(settings) => Ok(serde_json::to_value(settings).unwrap()),
        Err(e) => Err(format!("获取应用设置失败: {}", e))
    }
}

/// 更新应用基本设置
#[tauri::command]
pub async fn update_app_settings(app: tauri::AppHandle, request: UpdateAppSettingsRequest) -> Result<serde_json::Value, String> {
    if let Err(e) = request.validate() { return Err(e); }
    let db = app.state::<VehicleDatabase>();
    match db.update_app_settings(request.clone()).await {
        Ok(settings) => {
            // 如果包含自动启动设置的更新，同步更新系统的自动启动状态
            #[cfg(desktop)]
            if let Some(auto_start) = request.auto_start {
                use tauri_plugin_autostart::ManagerExt;
                let autostart_manager = app.autolaunch();
                
                if auto_start {
                    match autostart_manager.enable() {
                        Ok(_) => info!("开机启动已启用"),
                        Err(e) => warn!("启用开机启动失败: {}", e),
                    }
                } else {
                    match autostart_manager.disable() {
                        Ok(_) => info!("开机启动已禁用"),
                        Err(e) => warn!("禁用开机启动失败: {}", e),
                    }
                }
                
                // 检查并记录当前状态
                match autostart_manager.is_enabled() {
                    Ok(enabled) => info!("📋 开机启动状态更新为: {}", if enabled { "已启用" } else { "已禁用" }),
                    Err(e) => warn!("无法检查开机启动状态: {}", e),
                }
            }
            
            Ok(serde_json::to_value(settings).unwrap())
        },
        Err(e) => Err(format!("更新应用设置失败: {}", e))
    }
}

/// 获取菜单可见性设置
#[tauri::command]
pub async fn get_menu_visibility_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_menu_visibility_settings().await {
        Ok(settings) => Ok(serde_json::to_value(settings).unwrap()),
        Err(e) => Err(format!("获取菜单可见性设置失败: {}", e))
    }
}

/// 更新菜单可见性设置
#[tauri::command]
pub async fn update_menu_visibility_settings(
    app: tauri::AppHandle, 
    request: UpdateMenuVisibilityRequest
) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.update_menu_visibility_settings(request).await {
        Ok(settings) => {
            info!("菜单可见性设置已更新");
            Ok(serde_json::to_value(settings).unwrap())
        },
        Err(e) => Err(format!("更新菜单可见性设置失败: {}", e))
    }
}