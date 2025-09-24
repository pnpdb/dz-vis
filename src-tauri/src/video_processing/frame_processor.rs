//! 视频帧处理器
//! 
//! 提供高性能的视频帧处理功能，统一处理Base64编码/解码、JPEG验证等

use crate::video_processing::{
    types::{
        ProcessedVideoFrame, FrameProcessingResult, ProcessingStats, 
        VideoProcessingError, current_timestamp, current_timestamp_us
    },
    jpeg_validator::JpegValidator,
    frame_statistics::FrameStatistics,
};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD};
use std::sync::Arc;

/// 视频帧处理器
pub struct FrameProcessor {
    /// 帧统计管理器
    statistics: Arc<FrameStatistics>,
    /// 最大允许的帧大小（字节）
    max_frame_size: usize,
    /// 是否启用详细的性能统计
    enable_detailed_stats: bool,
}

impl FrameProcessor {
    /// 创建新的帧处理器
    /// 
    /// # Arguments
    /// * `max_frame_size` - 最大允许的帧大小（字节），默认10MB
    /// * `enable_detailed_stats` - 是否启用详细的性能统计
    pub fn new(max_frame_size: Option<usize>, enable_detailed_stats: bool) -> Self {
        Self {
            statistics: Arc::new(FrameStatistics::new()),
            max_frame_size: max_frame_size.unwrap_or(10 * 1024 * 1024), // 默认10MB
            enable_detailed_stats,
        }
    }
    
    /// 处理Base64编码的视频帧
    /// 
    /// 这是主要的处理入口，包含完整的处理流程：
    /// 1. Base64解码
    /// 2. JPEG格式验证
    /// 3. 重新编码（如果需要）
    /// 4. 统计记录
    /// 
    /// # Arguments
    /// * `vehicle_id` - 车辆ID
    /// * `frame_id` - 帧ID
    /// * `base64_data` - Base64编码的JPEG数据
    /// 
    /// # Returns
    /// * `FrameProcessingResult` - 处理结果，包含性能统计
    pub fn process_base64_frame(
        &self,
        vehicle_id: u32,
        frame_id: u32,
        base64_data: &str,
    ) -> FrameProcessingResult {
        let total_start_time = current_timestamp_us();
        let mut stats = ProcessingStats {
            decode_time_us: 0,
            validation_time_us: 0,
            encode_time_us: 0,
            total_time_us: 0,
        };
        
        // 步骤1: Base64解码
        let decode_start = current_timestamp_us();
        let jpeg_data = match self.decode_base64(base64_data) {
            Ok(data) => data,
            Err(e) => {
                self.statistics.record_invalid_frame(vehicle_id);
                return FrameProcessingResult {
                    success: false,
                    frame: None,
                    error: Some(e.to_string()),
                    stats,
                };
            }
        };
        stats.decode_time_us = current_timestamp_us() - decode_start;
        
        // 步骤2: JPEG格式验证
        let _validation_start = current_timestamp_us();
        let validation_time = match JpegValidator::validate_jpeg(&jpeg_data) {
            Ok(time) => time,
            Err(e) => {
                self.statistics.record_invalid_frame(vehicle_id);
                return FrameProcessingResult {
                    success: false,
                    frame: None,
                    error: Some(e.to_string()),
                    stats,
                };
            }
        };
        stats.validation_time_us = validation_time;
        
        // 步骤3: 重新编码Base64（确保数据一致性）
        let encode_start = current_timestamp_us();
        let final_base64 = match self.encode_base64(&jpeg_data) {
            Ok(data) => data,
            Err(e) => {
                self.statistics.record_invalid_frame(vehicle_id);
                return FrameProcessingResult {
                    success: false,
                    frame: None,
                    error: Some(e.to_string()),
                    stats,
                };
            }
        };
        stats.encode_time_us = current_timestamp_us() - encode_start;
        
        // 计算总处理时间
        stats.total_time_us = current_timestamp_us() - total_start_time;
        
        // 创建处理结果
        let processed_frame = ProcessedVideoFrame {
            vehicle_id,
            frame_id,
            timestamp: current_timestamp(),
            jpeg_base64: final_base64,
            raw_size: jpeg_data.len(),
            compressed_size: base64_data.len(),
            is_valid_jpeg: true,
            processing_time_us: stats.total_time_us,
        };
        
        // 记录统计信息
        self.statistics.record_valid_frame(
            vehicle_id,
            jpeg_data.len(),
            stats.total_time_us,
        );
        
        FrameProcessingResult {
            success: true,
            frame: Some(processed_frame),
            error: None,
            stats,
        }
    }
    
    /// 处理原始JPEG数据
    /// 
    /// 直接处理二进制JPEG数据，跳过Base64解码步骤
    /// 
    /// # Arguments
    /// * `vehicle_id` - 车辆ID
    /// * `frame_id` - 帧ID
    /// * `jpeg_data` - 原始JPEG二进制数据
    pub fn process_raw_jpeg(
        &self,
        vehicle_id: u32,
        frame_id: u32,
        jpeg_data: &[u8],
    ) -> FrameProcessingResult {
        let total_start_time = current_timestamp_us();
        let mut stats = ProcessingStats {
            decode_time_us: 0, // 跳过解码
            validation_time_us: 0,
            encode_time_us: 0,
            total_time_us: 0,
        };
        
        // 检查数据大小
        if jpeg_data.len() > self.max_frame_size {
            self.statistics.record_invalid_frame(vehicle_id);
            return FrameProcessingResult {
                success: false,
                frame: None,
                error: Some(VideoProcessingError::DataTooLarge {
                    size: jpeg_data.len(),
                    max: self.max_frame_size,
                }.to_string()),
                stats,
            };
        }
        
        // JPEG格式验证
        let _validation_start = current_timestamp_us();
        let validation_time = match JpegValidator::validate_jpeg(jpeg_data) {
            Ok(time) => time,
            Err(e) => {
                self.statistics.record_invalid_frame(vehicle_id);
                return FrameProcessingResult {
                    success: false,
                    frame: None,
                    error: Some(e.to_string()),
                    stats,
                };
            }
        };
        stats.validation_time_us = validation_time;
        
        // Base64编码
        let encode_start = current_timestamp_us();
        let base64_data = match self.encode_base64(jpeg_data) {
            Ok(data) => data,
            Err(e) => {
                self.statistics.record_invalid_frame(vehicle_id);
                return FrameProcessingResult {
                    success: false,
                    frame: None,
                    error: Some(e.to_string()),
                    stats,
                };
            }
        };
        stats.encode_time_us = current_timestamp_us() - encode_start;
        stats.total_time_us = current_timestamp_us() - total_start_time;
        
        // 创建处理结果
        let processed_frame = ProcessedVideoFrame {
            vehicle_id,
            frame_id,
            timestamp: current_timestamp(),
            jpeg_base64: base64_data,
            raw_size: jpeg_data.len(),
            compressed_size: jpeg_data.len(), // 原始数据大小
            is_valid_jpeg: true,
            processing_time_us: stats.total_time_us,
        };
        
        // 记录统计信息
        self.statistics.record_valid_frame(
            vehicle_id,
            jpeg_data.len(),
            stats.total_time_us,
        );
        
        FrameProcessingResult {
            success: true,
            frame: Some(processed_frame),
            error: None,
            stats,
        }
    }
    
    /// 快速验证Base64编码的JPEG数据
    /// 
    /// 仅进行基本验证，不进行完整处理，适用于高频率调用
    pub fn quick_validate_base64_jpeg(&self, base64_data: &str) -> Result<bool, VideoProcessingError> {
        // 快速Base64解码检查
        if base64_data.is_empty() {
            return Err(VideoProcessingError::EmptyData);
        }
        
        // 尝试解码前几个字节来检查JPEG头
        let header_b64 = if base64_data.len() > 8 { &base64_data[..8] } else { base64_data };
        
        match BASE64_STANDARD.decode(header_b64) {
            Ok(header_bytes) => Ok(JpegValidator::quick_validate_jpeg_header(&header_bytes)),
            Err(_) => Ok(false), // Base64解码失败，但不抛出错误
        }
    }
    
    /// Base64解码
    fn decode_base64(&self, base64_data: &str) -> Result<Vec<u8>, VideoProcessingError> {
        if base64_data.is_empty() {
            return Err(VideoProcessingError::EmptyData);
        }
        
        // 验证Base64格式
        if !Self::is_valid_base64_format(base64_data) {
            return Err(VideoProcessingError::Base64DecodeError(
                "无效的Base64格式".to_string()
            ));
        }
        
        // 解码
        let decoded = BASE64_STANDARD.decode(base64_data)
            .map_err(|e| VideoProcessingError::Base64DecodeError(e.to_string()))?;
        
        // 检查解码后的数据大小
        if decoded.len() > self.max_frame_size {
            return Err(VideoProcessingError::DataTooLarge {
                size: decoded.len(),
                max: self.max_frame_size,
            });
        }
        
        Ok(decoded)
    }
    
    /// Base64编码
    fn encode_base64(&self, data: &[u8]) -> Result<String, VideoProcessingError> {
        if data.is_empty() {
            return Err(VideoProcessingError::EmptyData);
        }
        
        Ok(BASE64_STANDARD.encode(data))
    }
    
    /// 验证Base64格式
    fn is_valid_base64_format(data: &str) -> bool {
        // 基本格式检查
        if data.is_empty() {
            return false;
        }
        
        // Base64字符集检查
        data.chars().all(|c| {
            c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '='
        })
    }
    
    /// 获取帧统计管理器的引用
    pub fn get_statistics(&self) -> Arc<FrameStatistics> {
        self.statistics.clone()
    }
    
    /// 清理指定车辆的统计信息
    pub fn clear_vehicle_stats(&self, vehicle_id: u32) {
        self.statistics.clear_vehicle_stats(vehicle_id);
    }
    
    /// 清理超时的统计信息
    pub fn cleanup_stale_stats(&self, timeout_seconds: u64) {
        self.statistics.cleanup_stale_stats(timeout_seconds);
    }
}

impl Default for FrameProcessor {
    fn default() -> Self {
        Self::new(None, false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_valid_base64_format() {
        assert!(FrameProcessor::is_valid_base64_format("SGVsbG8gV29ybGQ="));
        assert!(FrameProcessor::is_valid_base64_format("AQIDBA=="));
        assert!(!FrameProcessor::is_valid_base64_format(""));
        assert!(!FrameProcessor::is_valid_base64_format("Hello World!")); // 包含非Base64字符
    }
    
    #[test]
    fn test_process_base64_frame() {
        let processor = FrameProcessor::new(Some(1024 * 1024), true);
        
        // 创建一个简单的JPEG头的Base64编码
        let jpeg_header = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        let base64_data = BASE64_STANDARD.encode(&jpeg_header);
        
        let result = processor.process_base64_frame(1, 1, &base64_data);
        
        // 由于我们的测试数据不是完整的JPEG，可能会失败，但至少应该能解码
        // 这里主要测试流程是否正常
        assert!(result.stats.decode_time_us > 0);
    }
    
    #[test]
    fn test_quick_validate() {
        let processor = FrameProcessor::default();
        
        // 创建一个有效的JPEG头的Base64编码
        let jpeg_header = vec![0xFF, 0xD8, 0xFF, 0xE0];
        let base64_data = BASE64_STANDARD.encode(&jpeg_header);
        
        let result = processor.quick_validate_base64_jpeg(&base64_data);
        assert!(result.is_ok());
        assert!(result.unwrap()); // 应该识别为有效的JPEG头
    }
    
    #[test]
    fn test_empty_data() {
        let processor = FrameProcessor::default();
        
        let result = processor.process_base64_frame(1, 1, "");
        assert!(!result.success);
        assert!(result.error.is_some());
    }
}
