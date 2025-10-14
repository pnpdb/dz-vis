//! 协议配置相关的Tauri命令
//! 提供前端访问统一的消息类型定义

use crate::protocol_processing::message_types_config::{MessageTypesConfig, get_message_types_config};

/// 获取完整的消息类型配置
/// 前端通过此命令动态加载所有协议定义，避免硬编码
#[tauri::command]
pub async fn get_message_types_config_command() -> Result<MessageTypesConfig, String> {
    Ok(get_message_types_config())
}

/// 获取接收消息类型列表
#[tauri::command]
pub async fn get_receive_message_types() -> Result<serde_json::Value, String> {
    let config = get_message_types_config();
    Ok(serde_json::to_value(config.receive_message_types)
        .map_err(|e| format!("序列化失败: {}", e))?)
}

/// 获取发送消息类型列表
#[tauri::command]
pub async fn get_send_message_types() -> Result<serde_json::Value, String> {
    let config = get_message_types_config();
    Ok(serde_json::to_value(config.send_message_types)
        .map_err(|e| format!("序列化失败: {}", e))?)
}

/// 获取协议常量配置
#[tauri::command]
pub async fn get_protocol_constants() -> Result<serde_json::Value, String> {
    let config = get_message_types_config();
    Ok(serde_json::to_value(config.protocol_constants)
        .map_err(|e| format!("序列化失败: {}", e))?)
}

