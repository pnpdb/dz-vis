// 沙盘相关命令
use crate::socket;
use crate::database::{VehicleDatabase, UpdateTrafficLightSettingsRequest, CreateOrUpdateSandboxServiceRequest, CreateSandboxCameraRequest, UpdateSandboxCameraRequest};
use log::{info, warn, error};
use tauri::Manager;

/// 发送沙盘控制命令
#[tauri::command]
pub async fn send_sandbox_control(
    app: tauri::AppHandle,
    message_type: u16,
    data: Vec<u8>
) -> Result<String, String> {
    let sandbox_connections = app.state::<socket::SandboxConnectionManager>();
    match socket::SocketServer::send_to_sandbox(&sandbox_connections, message_type, &data) {
        true => Ok("沙盘控制命令已发送".to_string()),
        false => Err("沙盘未连接".to_string())
    }
}

/// 检查沙盘是否连接
#[tauri::command]
pub async fn is_sandbox_connected(app: tauri::AppHandle) -> Result<bool, String> {
    let sandbox_connections = app.state::<socket::SandboxConnectionManager>();
    let guard = sandbox_connections.read();
    Ok(guard.is_some())
}

/// 发送沙盘红绿灯时长控制
#[tauri::command]
pub async fn send_sandbox_traffic_light_duration(
    app: tauri::AppHandle,
    light_id: i32,
    red_seconds: i32,
    green_seconds: i32
) -> Result<String, String> {
    // 构建协议数据域 (12字节)
    let mut data = Vec::new();
    data.extend_from_slice(&(light_id as u32).to_le_bytes());     // 红绿灯编号 (4字节)
    data.extend_from_slice(&(red_seconds as u32).to_le_bytes());  // 红灯时长 (4字节)
    data.extend_from_slice(&(green_seconds as u32).to_le_bytes()); // 绿灯时长 (4字节)
    
    let sandbox_connections = app.state::<socket::SandboxConnectionManager>();
    match socket::SocketServer::send_to_sandbox(&sandbox_connections, 0x1004, &data) {
        true => {
            info!("发送沙盘红绿灯时长控制 - 编号: {}, 红灯: {}s, 绿灯: {}s", light_id, red_seconds, green_seconds);
            Ok(format!("红绿灯{}时长设置已发送到沙盘", light_id))
        }
        false => Err("沙盘未连接，无法发送红绿灯时长控制".to_string())
    }
}

/// 获取红绿灯设置
#[tauri::command]
pub async fn get_traffic_light_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_traffic_light_settings().await {
        Ok(settings) => Ok(serde_json::to_value(settings).unwrap()),
        Err(e) => Err(format!("获取红绿灯设置失败: {}", e))
    }
}

/// 更新红绿灯设置
#[tauri::command]
pub async fn update_traffic_light_settings(
    app: tauri::AppHandle,
    request: UpdateTrafficLightSettingsRequest
) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.update_traffic_light_settings(request).await {
        Ok(settings) => {
            info!("红绿灯设置更新成功");
            Ok(serde_json::to_value(settings).unwrap())
        }
        Err(e) => Err(format!("更新红绿灯设置失败: {}", e))
    }
}

/// 获取单个红绿灯项目
#[tauri::command]
pub async fn get_traffic_light_item(app: tauri::AppHandle, light_id: i32) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_traffic_light_item(light_id).await {
        Ok(Some(item)) => Ok(serde_json::to_value(item).unwrap()),
        Ok(None) => Err(format!("红绿灯 {} 不存在", light_id)),
        Err(e) => Err(format!("获取红绿灯项目失败: {}", e))
    }
}

/// 更新单个红绿灯项目
#[tauri::command]
pub async fn update_traffic_light_item(app: tauri::AppHandle, light_id: i32, red_seconds: i32, green_seconds: i32) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.update_traffic_light_item(light_id, red_seconds, green_seconds).await {
        Ok(item) => {
            info!("红绿灯项目更新成功: ID={}, 红灯={}s, 绿灯={}s", light_id, red_seconds, green_seconds);
            Ok(serde_json::to_value(item).unwrap())
        }
        Err(e) => Err(format!("更新红绿灯项目失败: {}", e))
    }
}

/// 获取沙盘服务设置
#[tauri::command]
pub async fn get_sandbox_service_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_sandbox_service_settings().await {
        Ok(settings) => Ok(serde_json::to_value(settings).unwrap()),
        Err(e) => Err(format!("获取沙盘服务设置失败: {}", e))
    }
}

/// 创建或更新沙盘服务设置
#[tauri::command]
pub async fn create_or_update_sandbox_service_settings(
    app: tauri::AppHandle,
    request: CreateOrUpdateSandboxServiceRequest
) -> Result<serde_json::Value, String> {
    if let Err(e) = request.validate() {
        return Err(e);
    }
    
    let db = app.state::<VehicleDatabase>();
    match db.create_or_update_sandbox_service_settings(request).await {
        Ok(settings) => {
            info!("沙盘服务设置更新成功");
            Ok(serde_json::to_value(settings).unwrap())
        }
        Err(e) => Err(format!("更新沙盘服务设置失败: {}", e))
    }
}

/// 删除沙盘服务设置
#[tauri::command]
pub async fn delete_sandbox_service_settings(app: tauri::AppHandle) -> Result<String, String> {
    let db = app.state::<VehicleDatabase>();
    match db.delete_sandbox_service_settings().await {
        Ok(_) => {
            info!("沙盘服务设置删除成功");
            Ok("沙盘服务设置删除成功".to_string())
        }
        Err(e) => Err(format!("删除沙盘服务设置失败: {}", e))
    }
}

/// 获取所有沙盘摄像头
#[tauri::command]
pub async fn get_all_sandbox_cameras(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_all_sandbox_cameras().await {
        Ok(cameras) => Ok(serde_json::to_value(cameras).unwrap()),
        Err(e) => Err(format!("获取沙盘摄像头列表失败: {}", e))
    }
}

/// 创建沙盘摄像头
#[tauri::command]
pub async fn create_sandbox_camera(
    app: tauri::AppHandle,
    request: CreateSandboxCameraRequest
) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.create_sandbox_camera(request).await {
        Ok(camera) => {
            info!("沙盘摄像头创建成功: ID={}, 名称={}", camera.id, camera.name);
            Ok(serde_json::to_value(camera).unwrap())
        }
        Err(e) => Err(format!("创建沙盘摄像头失败: {}", e))
    }
}

/// 更新沙盘摄像头
#[tauri::command]
pub async fn update_sandbox_camera(
    app: tauri::AppHandle,
    id: i64,
    request: UpdateSandboxCameraRequest
) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.update_sandbox_camera(id, request).await {
        Ok(camera) => {
            info!("沙盘摄像头更新成功: ID={}", id);
            Ok(serde_json::to_value(camera).unwrap())
        }
        Err(e) => Err(format!("更新沙盘摄像头失败: {}", e))
    }
}

/// 删除沙盘摄像头
#[tauri::command]
pub async fn delete_sandbox_camera(app: tauri::AppHandle, id: i64) -> Result<String, String> {
    let db = app.state::<VehicleDatabase>();
    match db.delete_sandbox_camera(id).await {
        Ok(_) => {
            info!("沙盘摄像头删除成功: ID={}", id);
            Ok(format!("沙盘摄像头 {} 删除成功", id))
        }
        Err(e) => Err(format!("删除沙盘摄像头失败: {}", e))
    }
}
