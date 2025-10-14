//! 统一错误类型定义
//! 提供清晰的错误分类和转换

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// 应用统一错误类型
#[derive(Error, Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "message")]
pub enum AppError {
    // ========== 车辆相关错误 ==========
    #[error("车辆未连接: {0}")]
    VehicleNotConnected(i32),
    
    #[error("无效的车辆ID: {0}")]
    InvalidVehicleId(u8),
    
    #[error("车辆操作失败: {0}")]
    VehicleOperationFailed(String),
    
    // ========== 协议相关错误 ==========
    #[error("协议解析失败: {0}")]
    ProtocolParseFailed(String),
    
    #[error("协议验证失败: {0}")]
    ProtocolValidationFailed(String),
    
    #[error("无效的消息类型: {0:#06X}")]
    InvalidMessageType(u16),
    
    #[error("CRC校验失败")]
    CrcCheckFailed,
    
    // ========== 网络相关错误 ==========
    #[error("Socket连接失败: {0}")]
    SocketConnectionFailed(String),
    
    #[error("网络发送失败: {0}")]
    NetworkSendFailed(String),
    
    #[error("无效的IP地址: {0}")]
    InvalidIpAddress(String),
    
    #[error("无效的端口号: {0}")]
    InvalidPort(u16),
    
    // ========== 数据库相关错误 ==========
    #[error("数据库操作失败: {0}")]
    DatabaseError(String),
    
    #[error("记录未找到: {0}")]
    RecordNotFound(String),
    
    #[error("数据库连接失败")]
    DatabaseConnectionFailed,
    
    // ========== 文件相关错误 ==========
    #[error("文件读取失败: {0}")]
    FileReadFailed(String),
    
    #[error("文件写入失败: {0}")]
    FileWriteFailed(String),
    
    #[error("文件不存在: {0}")]
    FileNotFound(String),
    
    // ========== 视频相关错误 ==========
    #[error("视频流错误: {0}")]
    VideoStreamError(String),
    
    #[error("RTSP转换失败: {0}")]
    RtspConversionFailed(String),
    
    #[error("视频帧无效")]
    InvalidVideoFrame,
    
    // ========== 配置相关错误 ==========
    #[error("配置加载失败: {0}")]
    ConfigLoadFailed(String),
    
    #[error("无效的配置值: {0}")]
    InvalidConfigValue(String),
    
    // ========== 验证相关错误 ==========
    #[error("参数验证失败: {0}")]
    ValidationFailed(String),
    
    #[error("数值超出范围: {field} = {value}, 期望范围 [{min}, {max}]")]
    OutOfRange {
        field: String,
        value: String,
        min: String,
        max: String,
    },
    
    // ========== 系统相关错误 ==========
    #[error("权限不足: {0}")]
    PermissionDenied(String),
    
    #[error("资源繁忙: {0}")]
    ResourceBusy(String),
    
    #[error("超时: {0}")]
    Timeout(String),
    
    #[error("未实现的功能: {0}")]
    NotImplemented(String),
    
    // ========== 通用错误 ==========
    #[error("内部错误: {0}")]
    InternalError(String),
    
    #[error("未知错误: {0}")]
    Unknown(String),
}

/// 错误结果类型别名
#[allow(dead_code)]
pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    /// 转换为JSON字符串（用于前端）
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| {
            format!(r#"{{"type":"Unknown","message":"{}"}}"#, self)
        })
    }
    
    /// 获取错误代码
    pub fn code(&self) -> &str {
        match self {
            Self::VehicleNotConnected(_) => "VEHICLE_NOT_CONNECTED",
            Self::InvalidVehicleId(_) => "INVALID_VEHICLE_ID",
            Self::VehicleOperationFailed(_) => "VEHICLE_OPERATION_FAILED",
            Self::ProtocolParseFailed(_) => "PROTOCOL_PARSE_FAILED",
            Self::ProtocolValidationFailed(_) => "PROTOCOL_VALIDATION_FAILED",
            Self::InvalidMessageType(_) => "INVALID_MESSAGE_TYPE",
            Self::CrcCheckFailed => "CRC_CHECK_FAILED",
            Self::SocketConnectionFailed(_) => "SOCKET_CONNECTION_FAILED",
            Self::NetworkSendFailed(_) => "NETWORK_SEND_FAILED",
            Self::InvalidIpAddress(_) => "INVALID_IP_ADDRESS",
            Self::InvalidPort(_) => "INVALID_PORT",
            Self::DatabaseError(_) => "DATABASE_ERROR",
            Self::RecordNotFound(_) => "RECORD_NOT_FOUND",
            Self::DatabaseConnectionFailed => "DATABASE_CONNECTION_FAILED",
            Self::FileReadFailed(_) => "FILE_READ_FAILED",
            Self::FileWriteFailed(_) => "FILE_WRITE_FAILED",
            Self::FileNotFound(_) => "FILE_NOT_FOUND",
            Self::VideoStreamError(_) => "VIDEO_STREAM_ERROR",
            Self::RtspConversionFailed(_) => "RTSP_CONVERSION_FAILED",
            Self::InvalidVideoFrame => "INVALID_VIDEO_FRAME",
            Self::ConfigLoadFailed(_) => "CONFIG_LOAD_FAILED",
            Self::InvalidConfigValue(_) => "INVALID_CONFIG_VALUE",
            Self::ValidationFailed(_) => "VALIDATION_FAILED",
            Self::OutOfRange { .. } => "OUT_OF_RANGE",
            Self::PermissionDenied(_) => "PERMISSION_DENIED",
            Self::ResourceBusy(_) => "RESOURCE_BUSY",
            Self::Timeout(_) => "TIMEOUT",
            Self::NotImplemented(_) => "NOT_IMPLEMENTED",
            Self::InternalError(_) => "INTERNAL_ERROR",
            Self::Unknown(_) => "UNKNOWN",
        }
    }
}

// ========== 从其他错误类型转换 ==========

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => Self::FileNotFound(err.to_string()),
            std::io::ErrorKind::PermissionDenied => Self::PermissionDenied(err.to_string()),
            std::io::ErrorKind::TimedOut => Self::Timeout(err.to_string()),
            _ => Self::InternalError(format!("IO错误: {}", err)),
        }
    }
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => Self::RecordNotFound("数据库记录未找到".to_string()),
            sqlx::Error::PoolTimedOut => Self::Timeout("数据库连接池超时".to_string()),
            _ => Self::DatabaseError(err.to_string()),
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        Self::InternalError(format!("JSON序列化错误: {}", err))
    }
}

// 实现Into<String>用于Tauri命令返回
impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = AppError::InvalidVehicleId(0);
        assert_eq!(err.to_string(), "无效的车辆ID: 0");
        assert_eq!(err.code(), "INVALID_VEHICLE_ID");
    }

    #[test]
    fn test_error_json() {
        let err = AppError::VehicleNotConnected(1);
        let json = err.to_json();
        assert!(json.contains("VehicleNotConnected"));
    }
}

