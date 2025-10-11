//! 协议验证器
//! 
//! 提供全面的协议数据验证功能，确保数据完整性和有效性

use crate::protocol_processing::types::*;
use std::collections::HashMap;

/// 协议验证器
pub struct ProtocolValidator {
    /// 验证规则配置
    config: ValidationConfig,
    /// 验证统计
    stats: ValidationStats,
    /// 自定义验证规则
    custom_rules: HashMap<String, Box<dyn Fn(&ParsedProtocolData) -> Result<(), ProtocolError> + Send + Sync>>,
}

/// 验证配置
#[derive(Debug, Clone)]
pub struct ValidationConfig {
    /// 启用严格验证
    pub strict_mode: bool,
    /// 启用范围检查
    pub range_check: bool,
    /// 启用逻辑验证
    pub logic_check: bool,
    /// 启用性能验证
    pub performance_check: bool,
    /// 最大验证时间（微秒）
    pub max_validation_time_us: u64,
}

/// 验证统计
#[derive(Debug, Clone)]
pub struct ValidationStats {
    /// 验证成功次数
    pub success_count: u64,
    /// 验证失败次数
    pub failure_count: u64,
    /// 总验证时间（微秒）
    pub total_time_us: u64,
    /// 平均验证时间（微秒）
    pub average_time_us: f64,
    /// 各类型错误统计
    pub error_counts: HashMap<String, u64>,
}

impl ProtocolValidator {
    /// 创建新的协议验证器
    pub fn new(config: ValidationConfig) -> Self {
        Self {
            config,
            stats: ValidationStats {
                success_count: 0,
                failure_count: 0,
                total_time_us: 0,
                average_time_us: 0.0,
                error_counts: HashMap::new(),
            },
            custom_rules: HashMap::new(),
        }
    }
    
    /// 验证解析后的协议数据
    pub fn validate(&mut self, data: &ParsedProtocolData) -> Result<(), ProtocolError> {
        let start_time = current_timestamp_us();
        
        // 检查验证超时
        let timeout = self.config.max_validation_time_us;
        
        let result = self.perform_validation(data, start_time, timeout);
        
        let validation_time = current_timestamp_us() - start_time;
        self.stats.total_time_us += validation_time;
        
        match &result {
            Ok(_) => {
                self.stats.success_count += 1;
            }
            Err(e) => {
                self.stats.failure_count += 1;
                let error_type = format!("{:?}", e).split('(').next().unwrap_or("Unknown").to_string();
                *self.stats.error_counts.entry(error_type).or_insert(0) += 1;
            }
        }
        
        // 更新平均验证时间
        let total_validations = self.stats.success_count + self.stats.failure_count;
        if total_validations > 0 {
            self.stats.average_time_us = self.stats.total_time_us as f64 / total_validations as f64;
        }
        
        result
    }
    
    /// 执行验证逻辑
    fn perform_validation(&self, data: &ParsedProtocolData, start_time: u64, timeout: u64) -> Result<(), ProtocolError> {
        match data {
            ParsedProtocolData::VehicleInfo(info) => self.validate_vehicle_info(info, start_time, timeout),
            ParsedProtocolData::VehicleControl(cmd) => self.validate_vehicle_control(cmd, start_time, timeout),
            ParsedProtocolData::TaxiOrder(order) => self.validate_taxi_order(order, start_time, timeout),
            ParsedProtocolData::AvpParking(parking) => self.validate_avp_parking(parking, start_time, timeout),
            ParsedProtocolData::AvpPickup(pickup) => self.validate_avp_pickup(pickup, start_time, timeout),
            ParsedProtocolData::DataRecording(recording) => self.validate_data_recording(recording, start_time, timeout),
            ParsedProtocolData::ConstructionMarker(marker) => self.validate_construction_marker(marker, start_time, timeout),
            ParsedProtocolData::VehicleFunctionSetting(_) | ParsedProtocolData::VehiclePathDisplay(_) => Ok(()),
            ParsedProtocolData::VehicleCameraToggle(toggle) => self.validate_vehicle_camera_toggle(toggle),
            ParsedProtocolData::SandboxLighting(lighting) => self.validate_sandbox_lighting(lighting),
            ParsedProtocolData::SandboxTrafficLightStatus(status) => self.validate_sandbox_traffic_light_status(status),
        }
    }

    fn validate_vehicle_camera_toggle(&self, toggle: &VehicleCameraToggleData) -> Result<(), ProtocolError> {
        if toggle.vehicle_id == 0 {
            return Err(ProtocolError::ValidationError {
                field: "vehicle_id".into(),
                value: toggle.vehicle_id as f64,
                min: 1.0,
                max: 255.0,
            });
        }
        if !matches!(toggle.enabled, 0 | 1) {
            return Err(ProtocolError::ValidationError {
                field: "enabled".into(),
                value: toggle.enabled as f64,
                min: 0.0,
                max: 1.0,
            });
        }
        Ok(())
    }

    fn validate_sandbox_lighting(&self, lighting: &SandboxLightingData) -> Result<(), ProtocolError> {
        for (field, value) in [
            ("ambient", lighting.ambient),
            ("building", lighting.building),
            ("street", lighting.street),
        ] {
            if !matches!(value, 0 | 1) {
                return Err(ProtocolError::ValidationError {
                    field: field.to_string(),
                    value: value as f64,
                    min: 0.0,
                    max: 1.0,
                });
            }
        }
        Ok(())
    }

    fn validate_sandbox_traffic_light_status(&self, status: &SandboxTrafficLightStatusData) -> Result<(), ProtocolError> {
        for light in &status.lights {
            if !matches!(light.color, 1 | 2 | 3) {
                return Err(ProtocolError::ValidationError {
                    field: format!("light_color_{}", light.index),
                    value: light.color as f64,
                    min: 1.0,
                    max: 3.0,
                });
            }
            if light.remaining > 120 {
                return Err(ProtocolError::ValidationError {
                    field: format!("light_remaining_{}", light.index),
                    value: light.remaining as f64,
                    min: 0.0,
                    max: 120.0,
                });
            }
        }
        Ok(())
    }
    
    /// 验证车辆信息
    fn validate_vehicle_info(&self, info: &VehicleInfo, start_time: u64, timeout: u64) -> Result<(), ProtocolError> {
        self.check_timeout(start_time, timeout)?;
        
        // 基本范围验证
        if self.config.range_check {
            self.validate_speed_range(info.speed)?;
            self.validate_battery_range(info.battery)?;
            self.validate_steering_angle_range(info.steering_angle)?;
            self.validate_gear_range(info.gear)?;
            self.validate_nav_status_range(info.nav_status)?;
        }
        
        // 逻辑验证
        if self.config.logic_check {
            self.validate_vehicle_logic(info)?;
        }
        
        // 性能验证
        if self.config.performance_check {
            self.validate_vehicle_performance(info)?;
        }
        
        Ok(())
    }
    
    /// 验证车辆控制指令
    fn validate_vehicle_control(&self, cmd: &VehicleControlCommand, start_time: u64, timeout: u64) -> Result<(), ProtocolError> {
        self.check_timeout(start_time, timeout)?;
        
        // 验证车辆ID
        if cmd.vehicle_id == 0 {
            return Err(ProtocolError::ValidationError {
                field: "vehicle_id".to_string(),
                value: cmd.vehicle_id as f64,
                min: 1.0,
                max: 255.0,
            });
        }
        
        // 验证位置数据（如果存在）
        if let Some(position) = &cmd.position_data {
            self.validate_position_data(position)?;
        }
        
        // 逻辑验证：初始化位姿命令必须包含位置数据
        if matches!(cmd.command, ControlCommandType::InitPose) && cmd.position_data.is_none() {
            return Err(ProtocolError::ValidationError {
                field: "position_data".to_string(),
                value: 0.0,
                min: 1.0,
                max: 1.0,
            });
        }
        
        Ok(())
    }
    
    /// 验证出租车订单
    fn validate_taxi_order(&self, order: &TaxiOrderData, start_time: u64, timeout: u64) -> Result<(), ProtocolError> {
        self.check_timeout(start_time, timeout)?;
        
        if order.vehicle_id == 0 {
            return Err(ProtocolError::ValidationError {
                field: "vehicle_id".to_string(),
                value: order.vehicle_id as f64,
                min: 1.0,
                max: 255.0,
            });
        }
        
        // 验证起点和终点不能相同
        if self.config.logic_check {
            let distance = ((order.end_x - order.start_x).powi(2) + (order.end_y - order.start_y).powi(2)).sqrt();
            if distance < 0.1 {
                return Err(ProtocolError::ValidationError {
                    field: "distance".to_string(),
                    value: distance,
                    min: 0.1,
                    max: f64::MAX,
                });
            }
        }
        
        Ok(())
    }
    
    /// 验证AVP泊车
    fn validate_avp_parking(&self, parking: &AvpParkingData, start_time: u64, timeout: u64) -> Result<(), ProtocolError> {
        self.check_timeout(start_time, timeout)?;
        
        if parking.vehicle_id == 0 {
            return Err(ProtocolError::ValidationError {
                field: "vehicle_id".to_string(),
                value: parking.vehicle_id as f64,
                min: 1.0,
                max: 255.0,
            });
        }
        
        if parking.parking_spot == 0 {
            return Err(ProtocolError::ValidationError {
                field: "parking_spot".to_string(),
                value: parking.parking_spot as f64,
                min: 1.0,
                max: 255.0,
            });
        }
        
        Ok(())
    }
    
    /// 验证AVP取车
    fn validate_avp_pickup(&self, pickup: &AvpPickupData, start_time: u64, timeout: u64) -> Result<(), ProtocolError> {
        self.check_timeout(start_time, timeout)?;
        
        if pickup.vehicle_id == 0 {
            return Err(ProtocolError::ValidationError {
                field: "vehicle_id".to_string(),
                value: pickup.vehicle_id as f64,
                min: 1.0,
                max: 255.0,
            });
        }
        
        Ok(())
    }
    
    /// 验证数据记录
    fn validate_data_recording(&self, recording: &DataRecordingData, start_time: u64, timeout: u64) -> Result<(), ProtocolError> {
        self.check_timeout(start_time, timeout)?;
        
        if recording.vehicle_id == 0 {
            return Err(ProtocolError::ValidationError {
                field: "vehicle_id".to_string(),
                value: recording.vehicle_id as f64,
                min: 1.0,
                max: 255.0,
            });
        }
        
        // 验证动作类型
        if recording.action > 2 {
            return Err(ProtocolError::ValidationError {
                field: "action".to_string(),
                value: recording.action as f64,
                min: 0.0,
                max: 2.0,
            });
        }
        
        Ok(())
    }
    
    /// 验证施工标记
    fn validate_construction_marker(&self, marker: &ConstructionMarkerData, start_time: u64, timeout: u64) -> Result<(), ProtocolError> {
        self.check_timeout(start_time, timeout)?;
        
        if marker.marker_id == 0 {
            return Err(ProtocolError::ValidationError {
                field: "marker_id".to_string(),
                value: marker.marker_id as f64,
                min: 1.0,
                max: 255.0,
            });
        }
        
        // 验证动作类型
        if marker.action > 1 {
            return Err(ProtocolError::ValidationError {
                field: "action".to_string(),
                value: marker.action as f64,
                min: 0.0,
                max: 1.0,
            });
        }
        
        Ok(())
    }
    
    /// 验证速度范围
    fn validate_speed_range(&self, speed: f64) -> Result<(), ProtocolError> {
        if speed < ProtocolConstants::MIN_SPEED || speed > ProtocolConstants::MAX_SPEED {
            Err(ProtocolError::ValidationError {
                field: "speed".to_string(),
                value: speed,
                min: ProtocolConstants::MIN_SPEED,
                max: ProtocolConstants::MAX_SPEED,
            })
        } else {
            Ok(())
        }
    }
    
    /// 验证电池电量范围
    fn validate_battery_range(&self, battery: f64) -> Result<(), ProtocolError> {
        if battery < ProtocolConstants::MIN_BATTERY || battery > ProtocolConstants::MAX_BATTERY {
            Err(ProtocolError::ValidationError {
                field: "battery".to_string(),
                value: battery,
                min: ProtocolConstants::MIN_BATTERY,
                max: ProtocolConstants::MAX_BATTERY,
            })
        } else {
            Ok(())
        }
    }
    
    /// 验证方向盘角度范围
    fn validate_steering_angle_range(&self, angle: f64) -> Result<(), ProtocolError> {
        if angle < ProtocolConstants::MIN_STEERING_ANGLE || angle > ProtocolConstants::MAX_STEERING_ANGLE {
            Err(ProtocolError::ValidationError {
                field: "steering_angle".to_string(),
                value: angle,
                min: ProtocolConstants::MIN_STEERING_ANGLE,
                max: ProtocolConstants::MAX_STEERING_ANGLE,
            })
        } else {
            Ok(())
        }
    }
    
    /// 验证档位范围
    fn validate_gear_range(&self, gear: GearPosition) -> Result<(), ProtocolError> {
        match gear {
            GearPosition::Park | GearPosition::Reverse | GearPosition::Neutral => Ok(()),
            GearPosition::DriveLevel(level) if (1..=6).contains(&level) => Ok(()),
            _ => Err(ProtocolError::ValidationError {
                field: "gear".to_string(),
                value: gear.to_u8() as f64,
                min: 1.0,
                max: 9.0,
            }),
        }
    }
    
    /// 验证导航状态范围
    fn validate_nav_status_range(&self, status: u8) -> Result<(), ProtocolError> {
        if status > 3 { // 0: 停止, 1: 导航中, 2: 到达, 3: 错误
            Err(ProtocolError::ValidationError {
                field: "nav_status".to_string(),
                value: status as f64,
                min: 0.0,
                max: 3.0,
            })
        } else {
            Ok(())
        }
    }
    
    /// 验证位置数据
    fn validate_position_data(&self, position: &PositionData) -> Result<(), ProtocolError> {
        // 验证角度范围
        if position.orientation < -180.0 || position.orientation > 180.0 {
            return Err(ProtocolError::ValidationError {
                field: "orientation".to_string(),
                value: position.orientation,
                min: -180.0,
                max: 180.0,
            });
        }
        
        Ok(())
    }
    
    /// 验证车辆逻辑
    fn validate_vehicle_logic(&self, info: &VehicleInfo) -> Result<(), ProtocolError> {
        // 逻辑1: 如果速度为0，方向盘角度应该为0或接近0
        if info.speed == 0.0 && info.steering_angle.abs() > 10.0 {
            return Err(ProtocolError::ValidationError {
                field: "steering_logic".to_string(),
                value: info.steering_angle,
                min: -10.0,
                max: 10.0,
            });
        }
        
        // 逻辑2: 如果档位是停车档P，速度应该为0
        if matches!(info.gear, GearPosition::Park) && info.speed > 0.0 {
            return Err(ProtocolError::ValidationError {
                field: "gear_speed_logic".to_string(),
                value: info.speed,
                min: 0.0,
                max: 0.0,
            });
        }
        
        Ok(())
    }
    
    /// 验证车辆性能
    fn validate_vehicle_performance(&self, info: &VehicleInfo) -> Result<(), ProtocolError> {
        // 性能1: 电池电量低于10%时，速度不应该超过0.3
        if info.battery < 10.0 && info.speed > 0.3 {
            return Err(ProtocolError::ValidationError {
                field: "low_battery_performance".to_string(),
                value: info.speed,
                min: 0.0,
                max: 0.3,
            });
        }
        
        Ok(())
    }
    
    /// 检查验证超时
    fn check_timeout(&self, start_time: u64, timeout: u64) -> Result<(), ProtocolError> {
        if timeout > 0 {
            let elapsed = current_timestamp_us() - start_time;
            if elapsed > timeout {
                return Err(ProtocolError::ValidationError {
                    field: "validation_timeout".to_string(),
                    value: elapsed as f64,
                    min: 0.0,
                    max: timeout as f64,
                });
            }
        }
        Ok(())
    }
    
    /// 批量验证
    pub fn batch_validate(&mut self, data_list: &[ParsedProtocolData]) -> Vec<Result<(), ProtocolError>> {
        let start_time = current_timestamp_us();
        let mut results = Vec::with_capacity(data_list.len());
        
        for data in data_list {
            let result = self.validate(data);
            results.push(result);
        }
        
        self.stats.total_time_us += current_timestamp_us() - start_time;
        results
    }
    
    /// 添加自定义验证规则
    pub fn add_custom_rule<F>(&mut self, name: String, rule: F)
    where
        F: Fn(&ParsedProtocolData) -> Result<(), ProtocolError> + Send + Sync + 'static,
    {
        self.custom_rules.insert(name, Box::new(rule));
    }
    
    /// 应用自定义验证规则
    pub fn apply_custom_rules(&self, data: &ParsedProtocolData) -> Result<(), ProtocolError> {
        for (name, rule) in &self.custom_rules {
            rule(data).map_err(|e| {
                log::debug!("自定义验证规则 '{}' 失败: {}", name, e);
                e
            })?;
        }
        Ok(())
    }
    
    /// 获取验证统计
    pub fn get_stats(&self) -> &ValidationStats {
        &self.stats
    }
    
    /// 重置验证统计
    pub fn reset_stats(&mut self) {
        self.stats = ValidationStats {
            success_count: 0,
            failure_count: 0,
            total_time_us: 0,
            average_time_us: 0.0,
            error_counts: HashMap::new(),
        };
    }
    
    /// 获取验证成功率
    pub fn get_success_rate(&self) -> f64 {
        let total = self.stats.success_count + self.stats.failure_count;
        if total == 0 {
            0.0
        } else {
            self.stats.success_count as f64 / total as f64
        }
    }
}

impl Default for ProtocolValidator {
    fn default() -> Self {
        Self::new(ValidationConfig {
            strict_mode: false,
            range_check: true,
            logic_check: true,
            performance_check: false,
            max_validation_time_us: 1000, // 1ms
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_validate_vehicle_info() {
        let mut validator = ProtocolValidator::default();
        
        let info = VehicleInfo {
            vehicle_id: 1,
            speed: 0.5,
            position_x: 10.0,
            position_y: 20.0,
            orientation: 90.0,
            battery: 80.0,
            gear: 1,
            steering_angle: 15.0,
            nav_status: 1,
            sensors: SensorStatus {
                camera: true,
                lidar: true,
                gyro: true,
            },
        };
        
        let data = ParsedProtocolData::VehicleInfo(info);
        let result = validator.validate(&data);
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_validate_invalid_speed() {
        let mut validator = ProtocolValidator::default();
        
        let info = VehicleInfo {
            vehicle_id: 1,
            speed: 2.0, // 超出范围
            position_x: 10.0,
            position_y: 20.0,
            orientation: 90.0,
            battery: 80.0,
            gear: 1,
            steering_angle: 15.0,
            nav_status: 1,
            sensors: SensorStatus {
                camera: true,
                lidar: true,
                gyro: true,
            },
        };
        
        let data = ParsedProtocolData::VehicleInfo(info);
        let result = validator.validate(&data);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_batch_validation() {
        let mut validator = ProtocolValidator::default();
        
        let info1 = ParsedProtocolData::VehicleInfo(VehicleInfo {
            vehicle_id: 1,
            speed: 0.5,
            position_x: 10.0,
            position_y: 20.0,
            orientation: 90.0,
            battery: 80.0,
            gear: 1,
            steering_angle: 15.0,
            nav_status: 1,
            sensors: SensorStatus {
                camera: true,
                lidar: true,
                gyro: true,
            },
        });
        
        let info2 = ParsedProtocolData::VehicleInfo(VehicleInfo {
            vehicle_id: 2,
            speed: 2.0, // 无效
            position_x: 10.0,
            position_y: 20.0,
            orientation: 90.0,
            battery: 80.0,
            gear: 1,
            steering_angle: 15.0,
            nav_status: 1,
            sensors: SensorStatus {
                camera: true,
                lidar: true,
                gyro: true,
            },
        });
        
        let results = validator.batch_validate(&[info1, info2]);
        assert_eq!(results.len(), 2);
        assert!(results[0].is_ok());
        assert!(results[1].is_err());
    }
}
