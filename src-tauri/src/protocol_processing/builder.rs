//! 协议构建器
//! 
//! 提供高效的二进制协议构建功能，支持零拷贝协议数据生成

use crate::protocol_processing::types::*;

/// 协议构建器
pub struct ProtocolBuilder {
    /// 构建缓冲区
    buffer: Vec<u8>,
    /// 构建统计
    stats: BuilderStats,
}

/// 构建器统计信息
#[derive(Debug, Clone)]
pub struct BuilderStats {
    /// 构建的协议数量
    pub protocols_built: u64,
    /// 总构建时间（微秒）
    pub total_time_us: u64,
    /// 总构建字节数
    pub total_bytes: u64,
}

impl ProtocolBuilder {
    /// 创建新的协议构建器
    pub fn new() -> Self {
        Self {
            buffer: Vec::with_capacity(1024),
            stats: BuilderStats {
                protocols_built: 0,
                total_time_us: 0,
                total_bytes: 0,
            },
        }
    }
    
    /// 构建车辆控制协议
    pub fn build_vehicle_control(&mut self, command: &VehicleControlCommand) -> Vec<u8> {
        let start_time = current_timestamp_us();
        self.buffer.clear();
        
        // 写入车辆ID
        self.buffer.push(command.vehicle_id);
        
        // 写入控制指令
        self.buffer.push(command.command.to_u8());
        
        // 如果有位置数据，写入位置信息
        if let Some(position) = &command.position_data {
            self.write_f64_le(position.x);
            self.write_f64_le(position.y);
            self.write_f64_le(position.orientation);
        }
        
        self.update_stats(start_time);
        self.buffer.clone()
    }
    
    /// 构建出租车订单协议
    pub fn build_taxi_order(&mut self, order: &TaxiOrderData) -> Vec<u8> {
        let start_time = current_timestamp_us();
        self.buffer.clear();
        
        self.buffer.push(order.vehicle_id);
        self.write_f64_le(order.start_x);
        self.write_f64_le(order.start_y);
        self.write_f64_le(order.end_x);
        self.write_f64_le(order.end_y);
        
        self.update_stats(start_time);
        self.buffer.clone()
    }
    
    /// 构建AVP泊车协议
    pub fn build_avp_parking(&mut self, parking: &AvpParkingData) -> Vec<u8> {
        let start_time = current_timestamp_us();
        self.buffer.clear();
        
        self.buffer.push(parking.vehicle_id);
        self.buffer.push(parking.parking_spot);
        
        self.update_stats(start_time);
        self.buffer.clone()
    }
    
    /// 构建AVP取车协议
    pub fn build_avp_pickup(&mut self, pickup: &AvpPickupData) -> Vec<u8> {
        let start_time = current_timestamp_us();
        self.buffer.clear();
        
        self.buffer.push(pickup.vehicle_id);
        
        self.update_stats(start_time);
        self.buffer.clone()
    }
    
    /// 构建数据记录协议
    pub fn build_data_recording(&mut self, recording: &DataRecordingData) -> Vec<u8> {
        let start_time = current_timestamp_us();
        self.buffer.clear();
        
        self.buffer.push(recording.vehicle_id);
        self.buffer.push(recording.action);
        
        self.update_stats(start_time);
        self.buffer.clone()
    }
    
    /// 构建施工标记协议
    pub fn build_construction_marker(&mut self, marker: &ConstructionMarkerData) -> Vec<u8> {
        let start_time = current_timestamp_us();
        self.buffer.clear();
        
        self.buffer.push(marker.marker_id);
        self.buffer.push(marker.action);
        self.write_f64_le(marker.x);
        self.write_f64_le(marker.y);
        
        self.update_stats(start_time);
        self.buffer.clone()
    }

    /// 构建车辆功能设置协议
    pub fn build_vehicle_function_setting(&mut self, setting: &VehicleFunctionSettingData) -> Vec<u8> {
        let start_time = current_timestamp_us();
        self.buffer.clear();

        self.buffer.push(setting.vehicle_id);
        self.buffer.push(setting.function_id);
        self.buffer.push(setting.enable_status);

        self.update_stats(start_time);
        self.buffer.clone()
    }

    /// 构建车辆路径显示协议
    pub fn build_vehicle_path_display(&mut self, path: &VehiclePathDisplayData) -> Vec<u8> {
        let start_time = current_timestamp_us();
        self.buffer.clear();

        self.buffer.push(path.vehicle_id);
        self.buffer.push(path.display_path);

        self.update_stats(start_time);
        self.buffer.clone()
    }

    /// 构建车辆摄像头开关协议
    pub fn build_vehicle_camera_toggle(&mut self, toggle: &VehicleCameraToggleData) -> Vec<u8> {
        let start_time = current_timestamp_us();
        self.buffer.clear();

        self.buffer.push(toggle.vehicle_id);
        self.buffer.push(toggle.enabled);

        self.update_stats(start_time);
        self.buffer.clone()
    }

    /// 构建沙盘灯光控制协议（4字节：停车抬杆、环境灯、建筑灯、路灯）
    pub fn build_sandbox_lighting(&mut self, lighting: &SandboxLightingData) -> Vec<u8> {
        let start_time = current_timestamp_us();
        self.buffer.clear();

        self.buffer.push(lighting.barrier);   // 停车抬杆
        self.buffer.push(lighting.ambient);   // 环境灯
        self.buffer.push(lighting.building);  // 建筑灯
        self.buffer.push(lighting.street);    // 路灯

        self.update_stats(start_time);
        self.buffer.clone()
    }
 
    /// 批量构建协议
    pub fn batch_build(&mut self, commands: &[ParsedProtocolData]) -> Vec<Vec<u8>> {
        let start_time = current_timestamp_us();
        let mut results = Vec::with_capacity(commands.len());
 
        for command in commands {
            let data = match command {
                ParsedProtocolData::VehicleControl(cmd) => self.build_vehicle_control(cmd),
                ParsedProtocolData::TaxiOrder(order) => self.build_taxi_order(order),
                ParsedProtocolData::AvpParking(parking) => self.build_avp_parking(parking),
                ParsedProtocolData::AvpPickup(pickup) => self.build_avp_pickup(pickup),
                ParsedProtocolData::DataRecording(recording) => self.build_data_recording(recording),
                ParsedProtocolData::ConstructionMarker(marker) => self.build_construction_marker(marker),
                ParsedProtocolData::VehicleFunctionSetting(setting) => self.build_vehicle_function_setting(setting),
                ParsedProtocolData::VehiclePathDisplay(path) => self.build_vehicle_path_display(path),
                ParsedProtocolData::VehicleCameraToggle(toggle) => self.build_vehicle_camera_toggle(toggle),
                ParsedProtocolData::SandboxLighting(lighting) => self.build_sandbox_lighting(lighting),
                _ => continue,
            };
            results.push(data);
        }
 
        self.stats.total_time_us += current_timestamp_us() - start_time;
        results
    }
    
    /// 零拷贝构建（直接写入目标缓冲区）
    pub fn zero_copy_build_vehicle_control(&mut self, command: &VehicleControlCommand, target: &mut [u8]) -> Result<usize, ProtocolError> {
        let required_size = if command.position_data.is_some() {
            ProtocolConstants::VEHICLE_CONTROL_TOTAL_SIZE_WITH_POSITION
        } else {
            ProtocolConstants::VEHICLE_CONTROL_BASE_SIZE
        };
        
        if target.len() < required_size {
            return Err(ProtocolError::InsufficientData {
                required: required_size,
                actual: target.len(),
            });
        }
        
        let start_time = current_timestamp_us();
        
        // 直接写入目标缓冲区
        target[0] = command.vehicle_id;
        target[1] = command.command.to_u8();
        
        let mut written = 2;
        
        if let Some(position) = &command.position_data {
            self.write_f64_le_to_slice(&mut target[2..10], position.x);
            self.write_f64_le_to_slice(&mut target[10..18], position.y);
            self.write_f64_le_to_slice(&mut target[18..26], position.orientation);
            written = 26;
        }
        
        self.stats.protocols_built += 1;
        self.stats.total_time_us += current_timestamp_us() - start_time;
        self.stats.total_bytes += written as u64;
        
        Ok(written)
    }
    
    /// 高效的内存预分配构建
    pub fn pre_allocated_build(&mut self, capacity: usize) -> PreAllocatedBuilder {
        PreAllocatedBuilder::new(capacity)
    }
    
    /// 写入小端序f64到缓冲区
    fn write_f64_le(&mut self, value: f64) {
        self.buffer.extend_from_slice(&value.to_le_bytes());
    }
    
    /// 写入小端序f64到指定切片
    fn write_f64_le_to_slice(&self, target: &mut [u8], value: f64) {
        let bytes = value.to_le_bytes();
        target.copy_from_slice(&bytes);
    }
    
    /// 更新统计信息
    fn update_stats(&mut self, start_time: u64) {
        self.stats.protocols_built += 1;
        self.stats.total_time_us += current_timestamp_us() - start_time;
        self.stats.total_bytes += self.buffer.len() as u64;
    }
    
    /// 获取统计信息
    pub fn get_stats(&self) -> &BuilderStats {
        &self.stats
    }
    
    /// 重置统计信息
    pub fn reset_stats(&mut self) {
        self.stats = BuilderStats {
            protocols_built: 0,
            total_time_us: 0,
            total_bytes: 0,
        };
    }
    
    /// 获取平均构建时间
    pub fn get_average_build_time(&self) -> f64 {
        if self.stats.protocols_built == 0 {
            0.0
        } else {
            self.stats.total_time_us as f64 / self.stats.protocols_built as f64
        }
    }
}

impl Default for ProtocolBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// 预分配构建器（用于高频构建场景）
pub struct PreAllocatedBuilder {
    buffers: Vec<Vec<u8>>,
    current_index: usize,
}

impl PreAllocatedBuilder {
    pub fn new(capacity: usize) -> Self {
        let mut buffers = Vec::with_capacity(capacity);
        for _ in 0..capacity {
            buffers.push(Vec::with_capacity(256)); // 预分配256字节
        }
        
        Self {
            buffers,
            current_index: 0,
        }
    }
    
    /// 获取下一个可用缓冲区
    pub fn next_buffer(&mut self) -> &mut Vec<u8> {
        let current_index = self.current_index;
        let buffer_len = self.buffers.len();
        self.current_index = (current_index + 1) % buffer_len;
        let buffer = &mut self.buffers[current_index];
        buffer.clear();
        buffer
    }
    
    /// 构建车辆控制协议到预分配缓冲区
    pub fn build_vehicle_control(&mut self, command: &VehicleControlCommand) -> &[u8] {
        let buffer = self.next_buffer();
        
        buffer.push(command.vehicle_id);
        buffer.push(command.command.to_u8());
        
        if let Some(position) = &command.position_data {
            buffer.extend_from_slice(&position.x.to_le_bytes());
            buffer.extend_from_slice(&position.y.to_le_bytes());
            buffer.extend_from_slice(&position.orientation.to_le_bytes());
        }
        
        buffer.as_slice()
    }
}

/// 流式协议构建器（用于大量数据的流式处理）
pub struct StreamProtocolBuilder {
    writer: Box<dyn std::io::Write + Send>,
    stats: BuilderStats,
}

impl StreamProtocolBuilder {
    pub fn new(writer: Box<dyn std::io::Write + Send>) -> Self {
        Self {
            writer,
            stats: BuilderStats {
                protocols_built: 0,
                total_time_us: 0,
                total_bytes: 0,
            },
        }
    }
    
    /// 流式写入车辆控制协议
    pub fn write_vehicle_control(&mut self, command: &VehicleControlCommand) -> Result<usize, ProtocolError> {
        let start_time = current_timestamp_us();
        
        self.writer.write_all(&[command.vehicle_id])
            .map_err(|e| ProtocolError::ZeroCopyError(e.to_string()))?;
        
        self.writer.write_all(&[command.command.to_u8()])
            .map_err(|e| ProtocolError::ZeroCopyError(e.to_string()))?;
        
        let mut written = 2;
        
        if let Some(position) = &command.position_data {
            self.writer.write_all(&position.x.to_le_bytes())
                .map_err(|e| ProtocolError::ZeroCopyError(e.to_string()))?;
            self.writer.write_all(&position.y.to_le_bytes())
                .map_err(|e| ProtocolError::ZeroCopyError(e.to_string()))?;
            self.writer.write_all(&position.orientation.to_le_bytes())
                .map_err(|e| ProtocolError::ZeroCopyError(e.to_string()))?;
            written += 24;
        }
        
        self.stats.protocols_built += 1;
        self.stats.total_time_us += current_timestamp_us() - start_time;
        self.stats.total_bytes += written as u64;
        
        Ok(written)
    }
    
    pub fn get_stats(&self) -> &BuilderStats {
        &self.stats
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_build_vehicle_control() {
        let mut builder = ProtocolBuilder::new();
        
        let command = VehicleControlCommand {
            vehicle_id: 1,
            command: ControlCommandType::Start,
            position_data: None,
        };
        
        let data = builder.build_vehicle_control(&command);
        assert_eq!(data.len(), 2);
        assert_eq!(data[0], 1);
        assert_eq!(data[1], 1);
    }
    
    #[test]
    fn test_build_vehicle_control_with_position() {
        let mut builder = ProtocolBuilder::new();
        
        let command = VehicleControlCommand {
            vehicle_id: 1,
            command: ControlCommandType::InitPose,
            position_data: Some(PositionData {
                x: 10.0,
                y: 20.0,
                orientation: 90.0,
            }),
        };
        
        let data = builder.build_vehicle_control(&command);
        assert_eq!(data.len(), 26);
    }
    
    #[test]
    fn test_zero_copy_build() {
        let mut builder = ProtocolBuilder::new();
        let mut target = vec![0u8; 26];
        
        let command = VehicleControlCommand {
            vehicle_id: 1,
            command: ControlCommandType::Start,
            position_data: None,
        };
        
        let written = builder.zero_copy_build_vehicle_control(&command, &mut target).unwrap();
        assert_eq!(written, 2);
        assert_eq!(target[0], 1);
        assert_eq!(target[1], 1);
    }
    
    #[test]
    fn test_pre_allocated_builder() {
        let mut builder = PreAllocatedBuilder::new(4);
        
        let command = VehicleControlCommand {
            vehicle_id: 1,
            command: ControlCommandType::Stop,
            position_data: None,
        };
        
        let data = builder.build_vehicle_control(&command);
        assert_eq!(data.len(), 2);
        assert_eq!(data[0], 1);
        assert_eq!(data[1], 2);
    }
}
