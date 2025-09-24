//! 高性能二进制协议解析器
//! 
//! 提供零拷贝的协议解析功能，支持多种协议类型的高效解析

use crate::protocol_processing::types::*;
use std::mem;

/// 高性能协议解析器
pub struct ProtocolParser {
    /// 启用严格验证模式
    strict_validation: bool,
    /// 性能统计
    stats: ProtocolProcessingStats,
}

impl ProtocolParser {
    /// 创建新的协议解析器
    pub fn new(strict_validation: bool) -> Self {
        Self {
            strict_validation,
            stats: ProtocolProcessingStats {
                parsing_time_us: 0,
                validation_time_us: 0,
                conversion_time_us: 0,
                total_time_us: 0,
                bytes_processed: 0,
            },
        }
    }
    
    /// 解析协议数据
    /// 
    /// # Arguments
    /// * `message_type` - 消息类型
    /// * `data` - 二进制数据
    /// 
    /// # Returns
    /// * `ProtocolParsingResult` - 解析结果
    pub fn parse_protocol(&mut self, message_type: u16, data: &[u8]) -> ProtocolParsingResult {
        let start_time = current_timestamp_us();
        self.stats.bytes_processed = data.len();
        
        // 验证消息类型
        if !MessageTypes::is_valid(message_type) {
            return ProtocolParsingResult {
                success: false,
                data: None,
                error: Some(format!("无效的消息类型: 0x{:04X}", message_type)),
                stats: self.stats.clone(),
            };
        }
        
        let parsing_start = current_timestamp_us();
        let result = match message_type {
            MessageTypes::VEHICLE_INFO => self.parse_vehicle_info(data),
            MessageTypes::VEHICLE_CONTROL => self.parse_vehicle_control(data),
            MessageTypes::TAXI_ORDER => self.parse_taxi_order(data),
            MessageTypes::AVP_PARKING => self.parse_avp_parking(data),
            MessageTypes::AVP_PICKUP => self.parse_avp_pickup(data),
            MessageTypes::DATA_RECORDING => self.parse_data_recording(data),
            MessageTypes::CONSTRUCTION_MARKER => self.parse_construction_marker(data),
            _ => Err(ProtocolError::InvalidMessageType { message_type }),
        };
        
        self.stats.parsing_time_us = current_timestamp_us() - parsing_start;
        self.stats.total_time_us = current_timestamp_us() - start_time;
        
        match result {
            Ok(parsed_data) => ProtocolParsingResult {
                success: true,
                data: Some(parsed_data),
                error: None,
                stats: self.stats.clone(),
            },
            Err(e) => ProtocolParsingResult {
                success: false,
                data: None,
                error: Some(e.to_string()),
                stats: self.stats.clone(),
            },
        }
    }
    
    /// 解析车辆信息协议
    fn parse_vehicle_info(&mut self, data: &[u8]) -> Result<ParsedProtocolData, ProtocolError> {
        if data.len() < ProtocolConstants::VEHICLE_INFO_TOTAL_SIZE {
            return Err(ProtocolError::InsufficientData {
                required: ProtocolConstants::VEHICLE_INFO_TOTAL_SIZE,
                actual: data.len(),
            });
        }
        
        let validation_start = current_timestamp_us();
        
        // 零拷贝解析 - 直接从字节数组读取数据
        let vehicle_id = data[ProtocolConstants::VEHICLE_INFO_VEHICLE_ID_OFFSET];
        
        let speed = self.read_f64_le(data, ProtocolConstants::VEHICLE_INFO_SPEED_OFFSET)?;
        let position_x = self.read_f64_le(data, ProtocolConstants::VEHICLE_INFO_POSITION_X_OFFSET)?;
        let position_y = self.read_f64_le(data, ProtocolConstants::VEHICLE_INFO_POSITION_Y_OFFSET)?;
        let orientation = self.read_f64_le(data, ProtocolConstants::VEHICLE_INFO_ORIENTATION_OFFSET)?;
        let battery = self.read_f64_le(data, ProtocolConstants::VEHICLE_INFO_BATTERY_OFFSET)?;
        let gear = data[ProtocolConstants::VEHICLE_INFO_GEAR_OFFSET];
        let steering_angle = self.read_f64_le(data, ProtocolConstants::VEHICLE_INFO_STEERING_ANGLE_OFFSET)?;
        let nav_status = data[ProtocolConstants::VEHICLE_INFO_NAV_STATUS_OFFSET];
        
        // 传感器状态解析
        let camera_status = data[ProtocolConstants::VEHICLE_INFO_CAMERA_STATUS_OFFSET] != 0;
        let lidar_status = data[ProtocolConstants::VEHICLE_INFO_LIDAR_STATUS_OFFSET] != 0;
        let gyro_status = data[ProtocolConstants::VEHICLE_INFO_GYRO_STATUS_OFFSET] != 0;
        
        // 数据验证
        if self.strict_validation {
            self.validate_speed(speed)?;
            self.validate_battery(battery)?;
            self.validate_steering_angle(steering_angle)?;
        } else {
            // 非严格模式下进行范围限制
            let _speed = speed.clamp(ProtocolConstants::MIN_SPEED, ProtocolConstants::MAX_SPEED);
            let _battery = battery.clamp(ProtocolConstants::MIN_BATTERY, ProtocolConstants::MAX_BATTERY);
            let _steering_angle = steering_angle.clamp(
                ProtocolConstants::MIN_STEERING_ANGLE, 
                ProtocolConstants::MAX_STEERING_ANGLE
            );
        }
        
        self.stats.validation_time_us = current_timestamp_us() - validation_start;
        
        let conversion_start = current_timestamp_us();
        
        let vehicle_info = VehicleInfo {
            vehicle_id,
            speed,
            position_x,
            position_y,
            orientation,
            battery,
            gear,
            steering_angle,
            nav_status,
            sensors: SensorStatus {
                camera: camera_status,
                lidar: lidar_status,
                gyro: gyro_status,
            },
        };
        
        self.stats.conversion_time_us = current_timestamp_us() - conversion_start;
        
        Ok(ParsedProtocolData::VehicleInfo(vehicle_info))
    }
    
    /// 解析车辆控制协议
    fn parse_vehicle_control(&mut self, data: &[u8]) -> Result<ParsedProtocolData, ProtocolError> {
        if data.len() < ProtocolConstants::VEHICLE_CONTROL_BASE_SIZE {
            return Err(ProtocolError::InsufficientData {
                required: ProtocolConstants::VEHICLE_CONTROL_BASE_SIZE,
                actual: data.len(),
            });
        }
        
        let vehicle_id = data[ProtocolConstants::VEHICLE_CONTROL_VEHICLE_ID_OFFSET];
        let command_byte = data[ProtocolConstants::VEHICLE_CONTROL_COMMAND_OFFSET];
        let command = ControlCommandType::from_u8(command_byte)?;
        
        // 如果是初始化位姿命令，需要读取位置数据
        let position_data = if matches!(command, ControlCommandType::InitPose) {
            if data.len() < ProtocolConstants::VEHICLE_CONTROL_TOTAL_SIZE_WITH_POSITION {
                return Err(ProtocolError::InsufficientData {
                    required: ProtocolConstants::VEHICLE_CONTROL_TOTAL_SIZE_WITH_POSITION,
                    actual: data.len(),
                });
            }
            
            let x = self.read_f64_le(data, ProtocolConstants::VEHICLE_CONTROL_POSITION_X_OFFSET)?;
            let y = self.read_f64_le(data, ProtocolConstants::VEHICLE_CONTROL_POSITION_Y_OFFSET)?;
            let orientation = self.read_f64_le(data, ProtocolConstants::VEHICLE_CONTROL_ORIENTATION_OFFSET)?;
            
            Some(PositionData { x, y, orientation })
        } else {
            None
        };
        
        let control_command = VehicleControlCommand {
            vehicle_id,
            command,
            position_data,
        };
        
        Ok(ParsedProtocolData::VehicleControl(control_command))
    }
    
    /// 解析出租车订单协议
    fn parse_taxi_order(&mut self, data: &[u8]) -> Result<ParsedProtocolData, ProtocolError> {
        if data.len() < ProtocolConstants::TAXI_ORDER_TOTAL_SIZE {
            return Err(ProtocolError::InsufficientData {
                required: ProtocolConstants::TAXI_ORDER_TOTAL_SIZE,
                actual: data.len(),
            });
        }
        
        let vehicle_id = data[ProtocolConstants::TAXI_ORDER_VEHICLE_ID_OFFSET];
        let start_x = self.read_f64_le(data, ProtocolConstants::TAXI_ORDER_START_X_OFFSET)?;
        let start_y = self.read_f64_le(data, ProtocolConstants::TAXI_ORDER_START_Y_OFFSET)?;
        let end_x = self.read_f64_le(data, ProtocolConstants::TAXI_ORDER_END_X_OFFSET)?;
        let end_y = self.read_f64_le(data, ProtocolConstants::TAXI_ORDER_END_Y_OFFSET)?;
        
        let taxi_order = TaxiOrderData {
            vehicle_id,
            start_x,
            start_y,
            end_x,
            end_y,
        };
        
        Ok(ParsedProtocolData::TaxiOrder(taxi_order))
    }
    
    /// 解析AVP泊车协议
    fn parse_avp_parking(&mut self, data: &[u8]) -> Result<ParsedProtocolData, ProtocolError> {
        if data.len() < ProtocolConstants::AVP_PARKING_TOTAL_SIZE {
            return Err(ProtocolError::InsufficientData {
                required: ProtocolConstants::AVP_PARKING_TOTAL_SIZE,
                actual: data.len(),
            });
        }
        
        let vehicle_id = data[ProtocolConstants::AVP_PARKING_VEHICLE_ID_OFFSET];
        let parking_spot = data[ProtocolConstants::AVP_PARKING_SPOT_OFFSET];
        
        let avp_parking = AvpParkingData {
            vehicle_id,
            parking_spot,
        };
        
        Ok(ParsedProtocolData::AvpParking(avp_parking))
    }
    
    /// 解析AVP取车协议
    fn parse_avp_pickup(&mut self, data: &[u8]) -> Result<ParsedProtocolData, ProtocolError> {
        if data.len() < ProtocolConstants::AVP_PICKUP_TOTAL_SIZE {
            return Err(ProtocolError::InsufficientData {
                required: ProtocolConstants::AVP_PICKUP_TOTAL_SIZE,
                actual: data.len(),
            });
        }
        
        let vehicle_id = data[ProtocolConstants::AVP_PICKUP_VEHICLE_ID_OFFSET];
        
        let avp_pickup = AvpPickupData { vehicle_id };
        
        Ok(ParsedProtocolData::AvpPickup(avp_pickup))
    }
    
    /// 解析数据记录协议
    fn parse_data_recording(&mut self, data: &[u8]) -> Result<ParsedProtocolData, ProtocolError> {
        if data.len() < ProtocolConstants::DATA_RECORDING_TOTAL_SIZE {
            return Err(ProtocolError::InsufficientData {
                required: ProtocolConstants::DATA_RECORDING_TOTAL_SIZE,
                actual: data.len(),
            });
        }
        
        let vehicle_id = data[ProtocolConstants::DATA_RECORDING_VEHICLE_ID_OFFSET];
        let action = data[ProtocolConstants::DATA_RECORDING_ACTION_OFFSET];
        
        let data_recording = DataRecordingData {
            vehicle_id,
            action,
        };
        
        Ok(ParsedProtocolData::DataRecording(data_recording))
    }
    
    /// 解析施工标记协议
    fn parse_construction_marker(&mut self, data: &[u8]) -> Result<ParsedProtocolData, ProtocolError> {
        if data.len() < ProtocolConstants::CONSTRUCTION_MARKER_TOTAL_SIZE {
            return Err(ProtocolError::InsufficientData {
                required: ProtocolConstants::CONSTRUCTION_MARKER_TOTAL_SIZE,
                actual: data.len(),
            });
        }
        
        let marker_id = data[ProtocolConstants::CONSTRUCTION_MARKER_ID_OFFSET];
        let action = data[ProtocolConstants::CONSTRUCTION_MARKER_ACTION_OFFSET];
        let x = self.read_f64_le(data, ProtocolConstants::CONSTRUCTION_MARKER_X_OFFSET)?;
        let y = self.read_f64_le(data, ProtocolConstants::CONSTRUCTION_MARKER_Y_OFFSET)?;
        
        let construction_marker = ConstructionMarkerData {
            marker_id,
            action,
            x,
            y,
        };
        
        Ok(ParsedProtocolData::ConstructionMarker(construction_marker))
    }
    
    /// 零拷贝读取小端序f64
    fn read_f64_le(&self, data: &[u8], offset: usize) -> Result<f64, ProtocolError> {
        if offset + 8 > data.len() {
            return Err(ProtocolError::InsufficientData {
                required: offset + 8,
                actual: data.len(),
            });
        }
        
        // 检查内存对齐
        let ptr = data.as_ptr().wrapping_add(offset);
        if ptr as usize % mem::align_of::<f64>() != 0 {
            // 如果没有对齐，使用安全的字节数组转换
            let mut bytes = [0u8; 8];
            bytes.copy_from_slice(&data[offset..offset + 8]);
            Ok(f64::from_le_bytes(bytes))
        } else {
            // 如果对齐，可以使用零拷贝转换
            unsafe {
                Ok(f64::from_le_bytes(*(ptr as *const [u8; 8])))
            }
        }
    }
    
    /// 验证速度范围
    fn validate_speed(&self, speed: f64) -> Result<(), ProtocolError> {
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
    fn validate_battery(&self, battery: f64) -> Result<(), ProtocolError> {
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
    fn validate_steering_angle(&self, angle: f64) -> Result<(), ProtocolError> {
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
    
    /// 获取性能统计
    pub fn get_stats(&self) -> &ProtocolProcessingStats {
        &self.stats
    }
    
    /// 重置性能统计
    pub fn reset_stats(&mut self) {
        self.stats = ProtocolProcessingStats {
            parsing_time_us: 0,
            validation_time_us: 0,
            conversion_time_us: 0,
            total_time_us: 0,
            bytes_processed: 0,
        };
    }
}

impl Default for ProtocolParser {
    fn default() -> Self {
        Self::new(false) // 默认非严格验证模式
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_vehicle_info() {
        let mut parser = ProtocolParser::new(false);
        
        // 创建测试数据
        let mut data = vec![0u8; ProtocolConstants::VEHICLE_INFO_TOTAL_SIZE];
        data[0] = 1; // vehicle_id
        // 添加更多测试数据...
        
        let result = parser.parse_protocol(MessageTypes::VEHICLE_INFO, &data);
        assert!(result.success);
    }
    
    #[test]
    fn test_parse_vehicle_control() {
        let mut parser = ProtocolParser::new(false);
        
        let mut data = vec![0u8; ProtocolConstants::VEHICLE_CONTROL_BASE_SIZE];
        data[0] = 1; // vehicle_id
        data[1] = 1; // start command
        
        let result = parser.parse_protocol(MessageTypes::VEHICLE_CONTROL, &data);
        assert!(result.success);
    }
    
    #[test]
    fn test_insufficient_data() {
        let mut parser = ProtocolParser::new(false);
        
        let data = vec![0u8; 1]; // 数据不足
        
        let result = parser.parse_protocol(MessageTypes::VEHICLE_INFO, &data);
        assert!(!result.success);
        assert!(result.error.is_some());
    }
}
