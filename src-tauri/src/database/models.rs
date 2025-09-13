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
}

/// 更新车辆连接的请求参数
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateVehicleConnectionRequest {
    pub vehicle_id: Option<i32>,
    pub ip_address: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
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
