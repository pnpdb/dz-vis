//! 零拷贝数据转换器
//! 
//! 提供高效的数据转换功能，最大化利用零拷贝技术减少内存分配和拷贝操作

use crate::protocol_processing::types::*;
use std::mem;
use std::slice;

/// 零拷贝数据转换器
pub struct DataConverter {
    /// 内存对齐缓冲区
    aligned_buffer: Vec<u8>,
    /// 转换统计
    stats: ConversionStats,
}

/// 转换统计信息
#[derive(Debug, Clone)]
pub struct ConversionStats {
    /// 零拷贝转换次数
    pub zero_copy_conversions: u64,
    /// 内存拷贝转换次数
    pub memory_copy_conversions: u64,
    /// 节省的内存拷贝字节数
    pub saved_bytes: u64,
    /// 总转换时间（微秒）
    pub total_time_us: u64,
}

impl DataConverter {
    /// 创建新的数据转换器
    pub fn new() -> Self {
        Self {
            aligned_buffer: Vec::with_capacity(4096), // 预分配4KB缓冲区
            stats: ConversionStats {
                zero_copy_conversions: 0,
                memory_copy_conversions: 0,
                saved_bytes: 0,
                total_time_us: 0,
            },
        }
    }
    
    /// 零拷贝转换字节数组到结构化数据
    /// 
    /// # Safety
    /// 此函数使用unsafe代码进行零拷贝转换，调用者需要确保：
    /// - 输入数据的内存布局与目标类型兼容
    /// - 数据长度足够
    /// - 内存对齐正确
    pub fn zero_copy_convert<T>(&mut self, data: &[u8]) -> Result<&T, ProtocolError> 
    where
        T: Sized,
    {
        let start_time = current_timestamp_us();
        
        if data.len() < mem::size_of::<T>() {
            return Err(ProtocolError::InsufficientData {
                required: mem::size_of::<T>(),
                actual: data.len(),
            });
        }
        
        let ptr = data.as_ptr();
        let alignment = mem::align_of::<T>();
        
        // 检查内存对齐
        if ptr as usize % alignment != 0 {
            // 如果没有对齐，需要进行内存拷贝到对齐的缓冲区
            self.aligned_buffer.clear();
            self.aligned_buffer.extend_from_slice(&data[..mem::size_of::<T>()]);
            
            // 确保缓冲区对齐
            let buffer_ptr = self.aligned_buffer.as_ptr();
            if buffer_ptr as usize % alignment != 0 {
                return Err(ProtocolError::AlignmentError {
                    address: buffer_ptr,
                    alignment,
                });
            }
            
            self.stats.memory_copy_conversions += 1;
            unsafe {
                let result = &*(buffer_ptr as *const T);
                self.stats.total_time_us += current_timestamp_us() - start_time;
                Ok(result)
            }
        } else {
            // 内存已对齐，可以进行零拷贝转换
            self.stats.zero_copy_conversions += 1;
            self.stats.saved_bytes += mem::size_of::<T>() as u64;
            
            unsafe {
                let result = &*(ptr as *const T);
                self.stats.total_time_us += current_timestamp_us() - start_time;
                Ok(result)
            }
        }
    }
    
    /// 批量零拷贝转换
    pub fn batch_zero_copy_convert<T>(&mut self, data_chunks: &[&[u8]]) -> Result<Vec<*const T>, ProtocolError>
    where
        T: Sized,
    {
        let start_time = current_timestamp_us();
        let mut results = Vec::with_capacity(data_chunks.len());
        
        for chunk in data_chunks {
            let converted = self.zero_copy_convert::<T>(chunk)?;
            results.push(converted as *const T);
        }
        
        self.stats.total_time_us += current_timestamp_us() - start_time;
        Ok(results)
    }
    
    /// 安全的数据转换（带验证）
    pub fn safe_convert_vehicle_info(&mut self, data: &[u8]) -> Result<VehicleInfoRaw, ProtocolError> {
        if data.len() < mem::size_of::<VehicleInfoRaw>() {
            return Err(ProtocolError::InsufficientData {
                required: mem::size_of::<VehicleInfoRaw>(),
                actual: data.len(),
            });
        }
        
        // 使用零拷贝转换
        let raw_data = self.zero_copy_convert::<VehicleInfoRaw>(data)?;
        let raw_data_copy = *raw_data;
        
        // 验证数据有效性
        self.validate_vehicle_info_raw(&raw_data_copy)?;
        
        Ok(raw_data_copy)
    }
    
    /// 转换原始数据到高级结构
    pub fn convert_raw_to_vehicle_info(&self, raw: &VehicleInfoRaw) -> VehicleInfo {
        VehicleInfo {
            vehicle_id: raw.vehicle_id,
            speed: f64::from_le_bytes(raw.speed),
            position_x: f64::from_le_bytes(raw.position_x),
            position_y: f64::from_le_bytes(raw.position_y),
            orientation: f64::from_le_bytes(raw.orientation),
            battery: f64::from_le_bytes(raw.battery),
            gear: raw.gear,
            steering_angle: f64::from_le_bytes(raw.steering_angle),
            nav_status: raw.nav_status,
            sensors: SensorStatus {
                camera: raw.camera_status != 0,
                lidar: raw.lidar_status != 0,
                gyro: raw.gyro_status != 0,
            },
        }
    }
    
    /// 批量转换车辆信息
    pub fn batch_convert_vehicle_info(&mut self, data_chunks: &[&[u8]]) -> Result<Vec<VehicleInfo>, ProtocolError> {
        let start_time = current_timestamp_us();
        let mut results = Vec::with_capacity(data_chunks.len());
        
        for chunk in data_chunks {
            let raw_data = self.safe_convert_vehicle_info(chunk)?;
            let vehicle_info = self.convert_raw_to_vehicle_info(&raw_data);
            results.push(vehicle_info);
        }
        
        self.stats.total_time_us += current_timestamp_us() - start_time;
        Ok(results)
    }
    
    /// 内存映射转换（用于大数据块）
    pub fn memory_map_convert<T>(&mut self, data: &[u8], count: usize) -> Result<&[T], ProtocolError>
    where
        T: Sized,
    {
        let element_size = mem::size_of::<T>();
        let required_size = element_size * count;
        
        if data.len() < required_size {
            return Err(ProtocolError::InsufficientData {
                required: required_size,
                actual: data.len(),
            });
        }
        
        let ptr = data.as_ptr();
        let alignment = mem::align_of::<T>();
        
        if ptr as usize % alignment != 0 {
            return Err(ProtocolError::AlignmentError {
                address: ptr,
                alignment,
            });
        }
        
        self.stats.zero_copy_conversions += 1;
        self.stats.saved_bytes += required_size as u64;
        
        unsafe {
            Ok(slice::from_raw_parts(ptr as *const T, count))
        }
    }
    
    /// 验证原始车辆信息数据
    fn validate_vehicle_info_raw(&self, raw: &VehicleInfoRaw) -> Result<(), ProtocolError> {
        let speed = f64::from_le_bytes(raw.speed);
        let battery = f64::from_le_bytes(raw.battery);
        let steering_angle = f64::from_le_bytes(raw.steering_angle);
        
        if speed < ProtocolConstants::MIN_SPEED || speed > ProtocolConstants::MAX_SPEED {
            return Err(ProtocolError::ValidationError {
                field: "speed".to_string(),
                value: speed,
                min: ProtocolConstants::MIN_SPEED,
                max: ProtocolConstants::MAX_SPEED,
            });
        }
        
        if battery < ProtocolConstants::MIN_BATTERY || battery > ProtocolConstants::MAX_BATTERY {
            return Err(ProtocolError::ValidationError {
                field: "battery".to_string(),
                value: battery,
                min: ProtocolConstants::MIN_BATTERY,
                max: ProtocolConstants::MAX_BATTERY,
            });
        }
        
        if steering_angle < ProtocolConstants::MIN_STEERING_ANGLE || steering_angle > ProtocolConstants::MAX_STEERING_ANGLE {
            return Err(ProtocolError::ValidationError {
                field: "steering_angle".to_string(),
                value: steering_angle,
                min: ProtocolConstants::MIN_STEERING_ANGLE,
                max: ProtocolConstants::MAX_STEERING_ANGLE,
            });
        }
        
        Ok(())
    }
    
    /// 获取转换统计
    pub fn get_stats(&self) -> &ConversionStats {
        &self.stats
    }
    
    /// 重置统计
    pub fn reset_stats(&mut self) {
        self.stats = ConversionStats {
            zero_copy_conversions: 0,
            memory_copy_conversions: 0,
            saved_bytes: 0,
            total_time_us: 0,
        };
    }
    
    /// 获取零拷贝效率
    pub fn get_zero_copy_efficiency(&self) -> f64 {
        let total = self.stats.zero_copy_conversions + self.stats.memory_copy_conversions;
        if total == 0 {
            0.0
        } else {
            self.stats.zero_copy_conversions as f64 / total as f64
        }
    }
}

impl Default for DataConverter {
    fn default() -> Self {
        Self::new()
    }
}

/// 原始车辆信息数据结构（用于零拷贝转换）
#[repr(C, packed)]
#[derive(Debug, Clone, Copy)]
pub struct VehicleInfoRaw {
    pub vehicle_id: u8,
    pub speed: [u8; 8],        // f64 as bytes
    pub position_x: [u8; 8],   // f64 as bytes
    pub position_y: [u8; 8],   // f64 as bytes
    pub orientation: [u8; 8],  // f64 as bytes
    pub battery: [u8; 8],      // f64 as bytes
    pub gear: u8,
    pub steering_angle: [u8; 8], // f64 as bytes
    pub nav_status: u8,
    pub camera_status: u8,
    pub lidar_status: u8,
    pub gyro_status: u8,
}

/// 高效的数据流处理器
pub struct StreamProcessor {
    converter: DataConverter,
    buffer: Vec<u8>,
    processed_bytes: usize,
}

impl StreamProcessor {
    pub fn new(buffer_size: usize) -> Self {
        Self {
            converter: DataConverter::new(),
            buffer: Vec::with_capacity(buffer_size),
            processed_bytes: 0,
        }
    }
    
    /// 流式处理数据
    pub fn process_stream<T, F>(&mut self, data: &[u8], mut processor: F) -> Result<usize, ProtocolError>
    where
        T: Sized,
        F: FnMut(&T) -> Result<(), ProtocolError>,
    {
        let element_size = mem::size_of::<T>();
        let mut processed_count = 0;
        let mut offset = 0;
        
        while offset + element_size <= data.len() {
            let chunk = &data[offset..offset + element_size];
            let converted = self.converter.zero_copy_convert::<T>(chunk)?;
            processor(converted)?;
            
            offset += element_size;
            processed_count += 1;
            self.processed_bytes += element_size;
        }
        
        Ok(processed_count)
    }
    
    pub fn get_processed_bytes(&self) -> usize {
        self.processed_bytes
    }
    
    pub fn reset(&mut self) {
        self.converter.reset_stats();
        self.processed_bytes = 0;
        self.buffer.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_zero_copy_conversion() {
        let mut converter = DataConverter::new();
        
        // 创建对齐的测试数据
        let mut data = vec![0u8; mem::size_of::<VehicleInfoRaw>()];
        data[0] = 1; // vehicle_id
        
        let result = converter.safe_convert_vehicle_info(&data);
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_batch_conversion() {
        let mut converter = DataConverter::new();
        
        let data1 = vec![0u8; mem::size_of::<VehicleInfoRaw>()];
        let data2 = vec![1u8; mem::size_of::<VehicleInfoRaw>()];
        let chunks = vec![data1.as_slice(), data2.as_slice()];
        
        let result = converter.batch_convert_vehicle_info(&chunks);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 2);
    }
    
    #[test]
    fn test_stream_processing() {
        let mut processor = StreamProcessor::new(1024);
        
        let data = vec![0u8; mem::size_of::<VehicleInfoRaw>() * 3];
        let result = processor.process_stream::<VehicleInfoRaw, _>(&data, |_raw| Ok(()));
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 3);
    }
}
