// 沙盘相关命令
use crate::socket::{self, SandboxConnectionManager};
use crate::database::{VehicleDatabase, UpdateTrafficLightSettingsRequest, CreateOrUpdateSandboxServiceRequest, CreateSandboxCameraRequest, UpdateSandboxCameraRequest};
use log::info;
use tauri::Manager;

/// 发送红绿灯时长到沙盘（0x2002）
#[tauri::command]
pub async fn send_sandbox_traffic_light_duration(
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
    let sandbox = app.state::<SandboxConnectionManager>();
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

/// 获取单个红绿灯项目
#[tauri::command]
pub async fn get_traffic_light_item(app: tauri::AppHandle, light_id: i32) -> Result<serde_json::Value, String> {
    if let Some(db) = app.try_state::<VehicleDatabase>() {
        db.get_traffic_light_item(light_id)
            .await
            .map(|item| serde_json::to_value(item).unwrap())
            .map_err(|e| e.to_string())
    } else {
        Err("数据库未初始化".to_string())
    }
}

/// 更新单个红绿灯项目
#[tauri::command]
pub async fn update_traffic_light_item(app: tauri::AppHandle, light_id: i32, red_seconds: i32, green_seconds: i32) -> Result<serde_json::Value, String> {
    if let Some(db) = app.try_state::<VehicleDatabase>() {
        db.update_traffic_light_item(light_id, red_seconds, green_seconds)
            .await
            .map(|item| serde_json::to_value(item).unwrap())
            .map_err(|e| e.to_string())
    } else {
        Err("数据库未初始化".to_string())
    }
}

/// 发送平行驾驶指令（0x2001）
#[tauri::command]
pub async fn send_sandbox_control(
    app: tauri::AppHandle,
    vehicle_id: u8,
) -> Result<String, String> {
    // 构建数据域: 车辆编号(1)
    let data = vec![vehicle_id];

    let sandbox = app.state::<SandboxConnectionManager>();
    // if sandbox.read().is_none() {
    //     return Err("沙盘未连接".to_string());
    // }
    socket::SocketServer::send_to_sandbox(&sandbox, 0x2001, &data)
        .map(|_| "发送成功".to_string())
        .map_err(|e| format!("发送失败: {}", e))
}

/// 查询沙盘是否已连接
#[tauri::command]
pub async fn is_sandbox_connected(app: tauri::AppHandle) -> Result<bool, String> {
    let sandbox = app.state::<SandboxConnectionManager>();
    let is_connected = sandbox.read().is_some();
    Ok(is_connected)
}

/// 获取交通灯设置
#[tauri::command]
pub async fn get_traffic_light_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.get_traffic_light_settings().await {
        Ok(settings) => Ok(serde_json::to_value(settings).unwrap()),
        Err(e) => Err(format!("获取交通灯设置失败: {}", e))
    }
}

/// 更新交通灯设置
#[tauri::command]
pub async fn update_traffic_light_settings(
    app: tauri::AppHandle, 
    request: UpdateTrafficLightSettingsRequest
) -> Result<serde_json::Value, String> {
    let db = app.state::<VehicleDatabase>();
    match db.update_traffic_light_settings(request).await {
        Ok(settings) => Ok(serde_json::to_value(settings).unwrap()),
        Err(e) => Err(format!("更新交通灯设置失败: {}", e))
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
pub async fn delete_sandbox_service_settings(app: tauri::AppHandle) -> Result<String, String> {
    let db = app.state::<VehicleDatabase>();
    match db.delete_sandbox_service_settings().await {
        Ok(true) => Ok("删除成功".to_string()),
        Ok(false) => Err("没有找到要删除的设置".to_string()),
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
        Ok(camera) => Ok(serde_json::to_value(camera).unwrap()),
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
        Ok(Some(camera)) => Ok(serde_json::to_value(camera).unwrap()),
        Ok(None) => Err("摄像头不存在".to_string()),
        Err(e) => Err(format!("更新沙盘摄像头失败: {}", e))
    }
}

/// 删除沙盘摄像头
#[tauri::command]
pub async fn delete_sandbox_camera(app: tauri::AppHandle, id: i64) -> Result<String, String> {
    let db = app.state::<VehicleDatabase>();
    match db.delete_sandbox_camera(id).await {
        Ok(true) => Ok("删除成功".to_string()),
        Ok(false) => Err("摄像头不存在".to_string()),
        Err(e) => Err(format!("删除沙盘摄像头失败: {}", e))
    }
}