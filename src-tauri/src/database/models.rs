use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// 车辆连接配置模型
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct VehicleConnection {
    pub id: i64,
    pub vehicle_id: i32,    // 车辆编号（整数）
    pub ip_address: String, // IP地址
    pub name: String,       // 车辆显示名称
    pub description: Option<String>, // 描述信息
    pub color: Option<String>,       // 车辆颜色（十六进制格式，如 #409EFF）
    pub is_active: bool,    // 是否启用
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 创建车辆连接的请求参数
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateVehicleConnectionRequest {
    pub vehicle_id: i32,
    pub ip_address: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

/// 更新车辆连接的请求参数
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateVehicleConnectionRequest {
    pub vehicle_id: Option<i32>,
    pub ip_address: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
    pub is_active: Option<bool>,
}

impl VehicleConnection {
    /// 获取IP地址
    pub fn get_address(&self) -> String {
        self.ip_address.clone()
    }
    
    /// 检查IP地址格式是否有效
    pub fn is_valid_ip(&self) -> bool {
        self.ip_address.parse::<std::net::IpAddr>().is_ok()
    }
}

impl CreateVehicleConnectionRequest {
    /// 验证请求参数
    pub fn validate(&self) -> Result<(), String> {
        if self.vehicle_id <= 0 {
            return Err("车辆编号必须大于0".to_string());
        }
        
        if self.ip_address.parse::<std::net::IpAddr>().is_err() {
            return Err("IP地址格式无效".to_string());
        }
        
        if self.name.trim().is_empty() {
            return Err("车辆名称不能为空".to_string());
        }
        
        Ok(())
    }
}

/// 交通灯设置模型
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TrafficLightSettings {
    pub id: i64,
    pub red_light_duration: i32,    // 红灯时长（秒）
    pub green_light_duration: i32,  // 绿灯时长（秒）
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 单个红绿灯时长模型
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TrafficLightItem {
    pub id: i64,
    pub light_id: i32,              // 红绿灯编号（从1开始）
    pub red_light_duration: i32,    // 红灯时长（秒）
    pub green_light_duration: i32,  // 绿灯时长（秒）
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 更新交通灯设置的请求参数
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateTrafficLightSettingsRequest {
    pub red_light_duration: Option<i32>,
    pub green_light_duration: Option<i32>,
}

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct TaxiOrder {
    pub id: i64,
    pub order_id: String,           // 16字节UUID字符串
    pub start_x: f64,               // 起点X坐标
    pub start_y: f64,               // 起点Y坐标
    pub end_x: f64,                 // 终点X坐标
    pub end_y: f64,                 // 终点Y坐标
    pub assigned_vehicle_id: Option<i32>, // 接单的车辆ID（可选）
    pub created_at: String,         // 创建时间
    pub updated_at: String,         // 更新时间
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateTaxiOrderRequest {
    pub order_id: String,
    pub start_x: f64,
    pub start_y: f64,
    pub end_x: f64,
    pub end_y: f64,
}

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AvpParking {
    pub id: i64,
    pub vehicle_id: i32,            // 车辆编号
    pub parking_spot: i32,          // 停车位编号
    pub created_at: String,         // 创建时间
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateAvpParkingRequest {
    pub vehicle_id: i32,
    pub parking_spot: i32,
}

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AvpPickup {
    pub id: i64,
    pub vehicle_id: i32,            // 车辆编号
    pub created_at: String,         // 创建时间
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateAvpPickupRequest {
    pub vehicle_id: i32,
}

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct VehicleOnlineTime {
    pub id: i64,
    pub vehicle_id: i32,            // 车辆编号
    pub date: String,               // 日期 (YYYY-MM-DD)
    pub online_minutes: i32,        // 累计在线时长（分钟）
    pub updated_at: String,         // 最后更新时间
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdateVehicleOnlineTimeRequest {
    pub vehicle_id: i32,
    pub date: String,
    pub online_minutes: i32,
}

impl UpdateTrafficLightSettingsRequest {
    /// 验证请求参数
    pub fn validate(&self) -> Result<(), String> {
        if let Some(red) = self.red_light_duration {
            if red <= 0 || red > 300 {
                return Err("红灯时长必须在1-300秒之间".to_string());
            }
        }
        
        if let Some(green) = self.green_light_duration {
            if green <= 0 || green > 300 {
                return Err("绿灯时长必须在1-300秒之间".to_string());
            }
        }
        
        Ok(())
    }
}

/// 沙盘服务设置模型
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SandboxServiceSettings {
    pub id: i64,
    pub ip_address: String,     // 沙盘服务IP地址
    pub traffic_light_count: i32, // 红绿灯数量
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 创建/更新沙盘服务设置的请求参数
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateOrUpdateSandboxServiceRequest {
    pub ip_address: String,
    pub traffic_light_count: i32,
}

/// 沙盘摄像头设置模型
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SandboxCamera {
    pub id: i64,
    pub name: String,           // 摄像头名称
    pub camera_type: String,    // 摄像头类型：'RJ45' 或 'USB'
    pub rtsp_url: Option<String>,    // RTSP地址（RJ45类型使用）
    pub device_index: Option<i32>,   // 设备文件索引（USB类型使用）
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 创建沙盘摄像头的请求参数
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSandboxCameraRequest {
    pub name: String,
    pub camera_type: String,    // 'RJ45' 或 'USB'
    pub rtsp_url: Option<String>,
    pub device_index: Option<i32>,
}

/// 更新沙盘摄像头的请求参数
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateSandboxCameraRequest {
    pub name: Option<String>,
    pub camera_type: Option<String>,
    pub rtsp_url: Option<String>,
    pub device_index: Option<i32>,
}

impl CreateOrUpdateSandboxServiceRequest {
    /// 验证请求参数
    pub fn validate(&self) -> Result<(), String> {
        if self.ip_address.parse::<std::net::IpAddr>().is_err() {
            return Err("IP地址格式无效".to_string());
        }
        
        Ok(())
    }
}

/// 应用基本设置模型
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AppSettings {
    pub id: i64,
    pub log_level: String,       // 日志级别: DEBUG/INFO/WARNING/ERROR
    pub cache_size: i32,         // 缓存大小(MB)
    pub auto_start: bool,        // 开机启动
    pub app_title: String,       // 应用标题
    pub coordinate_offset_x: f64, // 坐标X轴偏移量
    pub coordinate_offset_y: f64, // 坐标Y轴偏移量
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 更新/创建应用基本设置请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAppSettingsRequest {
    pub log_level: Option<String>,
    pub cache_size: Option<i32>,
    pub auto_start: Option<bool>,
    pub app_title: Option<String>,
    pub coordinate_offset_x: Option<f64>,
    pub coordinate_offset_y: Option<f64>,
}

impl UpdateAppSettingsRequest {
    pub fn validate(&self) -> Result<(), String> {
        if let Some(level) = &self.log_level {
            let upper = level.to_uppercase();
            let ok = matches!(upper.as_str(), "DEBUG" | "INFO" | "WARNING" | "ERROR");
            if !ok {
                return Err("日志级别必须为 DEBUG/INFO/WARNING/ERROR".to_string());
            }
        }
        if let Some(size) = self.cache_size {
            if size < 0 || size > 1024 * 10 { // 上限10GB
                return Err("缓存大小必须在0-10240MB之间".to_string());
            }
        }
        
        if let Some(title) = &self.app_title {
            if title.trim().is_empty() {
                return Err("应用标题不能为空".to_string());
            }
            if title.chars().count() > 30 {
                return Err("应用标题长度不能超过30个字符".to_string());
            }
        }
        
        Ok(())
    }
}

impl CreateSandboxCameraRequest {
    /// 验证请求参数
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("摄像头名称不能为空".to_string());
        }
        
        if self.camera_type != "RJ45" && self.camera_type != "USB" {
            return Err("摄像头类型必须是RJ45或USB".to_string());
        }
        
        match self.camera_type.as_str() {
            "RJ45" => {
                if self.rtsp_url.is_none() || self.rtsp_url.as_ref().unwrap().trim().is_empty() {
                    return Err("RJ45摄像头必须提供RTSP地址".to_string());
                }
                // 简单的RTSP URL验证
                if let Some(url) = &self.rtsp_url {
                    if !url.starts_with("rtsp://") {
                        return Err("RTSP地址格式无效，必须以rtsp://开头".to_string());
                    }
                }
            }
            "USB" => {
                if self.device_index.is_none() {
                    return Err("USB摄像头必须提供设备索引".to_string());
                }
                if let Some(index) = self.device_index {
                    if index < 0 {
                        return Err("设备索引必须为非负整数".to_string());
                    }
                }
            }
            _ => unreachable!()
        }
        
        Ok(())
    }
}

/// 菜单可见性设置模型
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MenuVisibilitySettings {
    pub id: i64,
    pub show_vehicle_info: bool,      // 显示"车辆信息"菜单
    pub show_auto_drive: bool,        // 显示"自动驾驶"菜单
    pub show_sandbox_control: bool,   // 显示"沙盘控制"菜单
    pub show_settings: bool,          // 显示"功能设置"菜单
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 更新菜单可见性设置的请求参数
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateMenuVisibilityRequest {
    pub show_vehicle_info: Option<bool>,
    pub show_auto_drive: Option<bool>,
    pub show_sandbox_control: Option<bool>,
    pub show_settings: Option<bool>,
}
