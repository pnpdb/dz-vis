//! 视频处理相关的类型定义

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// 处理后的视频帧数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessedVideoFrame {
    /// 车辆ID
    pub vehicle_id: u32,
    /// 帧ID
    pub frame_id: u32,
    /// 时间戳
    pub timestamp: u64,
    /// Base64编码的JPEG数据
    pub jpeg_base64: String,
    /// 原始数据大小（字节）
    pub raw_size: usize,
    /// 压缩后大小（字节）
    pub compressed_size: usize,
    /// 是否为有效的JPEG数据
    pub is_valid_jpeg: bool,
    /// 处理时间（微秒）
    pub processing_time_us: u64,
}

/// 视频帧处理结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameProcessingResult {
    /// 是否处理成功
    pub success: bool,
    /// 处理后的帧数据（如果成功）
    pub frame: Option<ProcessedVideoFrame>,
    /// 错误信息（如果失败）
    pub error: Option<String>,
    /// 性能统计
    pub stats: ProcessingStats,
}

/// 处理性能统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingStats {
    /// Base64解码时间（微秒）
    pub decode_time_us: u64,
    /// JPEG验证时间（微秒）
    pub validation_time_us: u64,
    /// Base64编码时间（微秒）
    pub encode_time_us: u64,
    /// 总处理时间（微秒）
    pub total_time_us: u64,
}

/// 视频帧统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoFrameStats {
    /// 车辆ID
    pub vehicle_id: u32,
    /// 总帧数
    pub total_frames: u64,
    /// 有效帧数
    pub valid_frames: u64,
    /// 无效帧数
    pub invalid_frames: u64,
    /// 平均帧率（FPS）
    pub average_fps: f64,
    /// 当前帧率（FPS）
    pub current_fps: f64,
    /// 平均帧大小（字节）
    pub average_frame_size: f64,
    /// 最后更新时间
    pub last_update: u64,
    /// 平均处理时间（微秒）
    pub average_processing_time_us: f64,
}

impl Default for VideoFrameStats {
    fn default() -> Self {
        Self {
            vehicle_id: 0,
            total_frames: 0,
            valid_frames: 0,
            invalid_frames: 0,
            average_fps: 0.0,
            current_fps: 0.0,
            average_frame_size: 0.0,
            last_update: current_timestamp(),
            average_processing_time_us: 0.0,
        }
    }
}

/// 视频处理错误类型
#[derive(Debug, thiserror::Error)]
pub enum VideoProcessingError {
    #[error("Base64解码失败: {0}")]
    Base64DecodeError(String),
    
    #[error("无效的JPEG格式: {0}")]
    InvalidJpegFormat(String),
    
    #[error("数据为空")]
    EmptyData,
    
    #[error("数据过大: {size} 字节，最大允许 {max} 字节")]
    DataTooLarge { size: usize, max: usize },
    
    #[error("Base64编码失败: {0}")]
    Base64EncodeError(String),
    
    #[error("系统时间错误: {0}")]
    SystemTimeError(String),
}

/// 获取当前时间戳（毫秒）
pub fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 获取当前时间戳（微秒）
pub fn current_timestamp_us() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_micros() as u64)
        .unwrap_or(0)
}
