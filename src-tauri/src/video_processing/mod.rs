//! 视频处理模块
//! 
//! 提供高性能的视频帧处理功能，包括：
//! - Base64编码/解码优化
//! - JPEG头验证
//! - 视频帧统计和分析
//! - 统一的视频处理接口

pub mod frame_processor;
pub mod jpeg_validator;
pub mod frame_statistics;
pub mod types;

pub use frame_processor::FrameProcessor;
pub use jpeg_validator::JpegValidator;
pub use frame_statistics::FrameStatistics;
pub use types::*;
