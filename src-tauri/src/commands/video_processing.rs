//! 视频处理相关的Tauri命令

use crate::video_processing::{
    FrameProcessor,
    types::{FrameProcessingResult, VideoFrameStats},
};
use std::sync::OnceLock;
// use tauri::State; // 暂时未使用

/// 全局视频帧处理器
static FRAME_PROCESSOR: OnceLock<FrameProcessor> = OnceLock::new();

/// 获取或初始化帧处理器
fn get_frame_processor() -> &'static FrameProcessor {
    FRAME_PROCESSOR.get_or_init(|| {
        FrameProcessor::new(
            Some(20 * 1024 * 1024), // 20MB最大帧大小
            true, // 启用详细统计
        )
    })
}

/// 处理Base64编码的视频帧
/// 
/// 这是主要的视频帧处理接口，替代前端的Base64处理逻辑
/// 
/// # Arguments
/// * `vehicle_id` - 车辆ID
/// * `frame_id` - 帧ID（可选，默认使用时间戳）
/// * `base64_data` - Base64编码的JPEG数据
/// 
/// # Returns
/// * `FrameProcessingResult` - 处理结果和性能统计
#[tauri::command]
pub async fn process_video_frame(
    vehicle_id: u32,
    frame_id: Option<u32>,
    base64_data: String,
) -> Result<FrameProcessingResult, String> {
    let processor = get_frame_processor();
    let frame_id = frame_id.unwrap_or_else(|| {
        (std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() & 0xFFFFFFFF) as u32
    });
    
    let result = processor.process_base64_frame(vehicle_id, frame_id, &base64_data);
    Ok(result)
}

/// 快速验证Base64编码的JPEG数据
/// 
/// 用于高频率调用场景，仅进行基本验证
/// 
/// # Arguments
/// * `base64_data` - Base64编码的数据
/// 
/// # Returns
/// * `bool` - 是否为有效的JPEG格式
#[tauri::command]
pub async fn quick_validate_jpeg_base64(base64_data: String) -> Result<bool, String> {
    let processor = get_frame_processor();
    processor.quick_validate_base64_jpeg(&base64_data)
        .map_err(|e| e.to_string())
}

/// 获取指定车辆的视频帧统计信息
/// 
/// # Arguments
/// * `vehicle_id` - 车辆ID
/// 
/// # Returns
/// * `Option<VideoFrameStats>` - 统计信息，如果车辆不存在则返回None
#[tauri::command]
pub async fn get_vehicle_video_stats(vehicle_id: u32) -> Result<Option<VideoFrameStats>, String> {
    let processor = get_frame_processor();
    let stats = processor.get_statistics();
    Ok(stats.get_stats(vehicle_id))
}

/// 获取所有车辆的视频帧统计信息
/// 
/// # Returns
/// * `Vec<VideoFrameStats>` - 所有车辆的统计信息
#[tauri::command]
pub async fn get_all_video_stats() -> Result<Vec<VideoFrameStats>, String> {
    let processor = get_frame_processor();
    let stats = processor.get_statistics();
    Ok(stats.get_all_stats())
}

/// 清理指定车辆的视频统计信息
/// 
/// # Arguments
/// * `vehicle_id` - 车辆ID
#[tauri::command]
pub async fn clear_vehicle_video_stats(vehicle_id: u32) -> Result<(), String> {
    let processor = get_frame_processor();
    processor.clear_vehicle_stats(vehicle_id);
    Ok(())
}

/// 清理超时的视频统计信息
/// 
/// # Arguments
/// * `timeout_seconds` - 超时时间（秒），默认300秒（5分钟）
#[tauri::command]
pub async fn cleanup_stale_video_stats(timeout_seconds: Option<u64>) -> Result<usize, String> {
    let processor = get_frame_processor();
    let stats = processor.get_statistics();
    
    // 获取清理前的车辆数量
    let before_count = stats.get_all_stats().len();
    
    // 执行清理
    stats.cleanup_stale_stats(timeout_seconds.unwrap_or(300));
    
    // 获取清理后的车辆数量
    let after_count = stats.get_all_stats().len();
    
    Ok(before_count - after_count)
}

/// 获取视频处理的性能摘要
/// 
/// # Returns
/// * `StatsSummary` - 性能摘要信息
#[tauri::command]
pub async fn get_video_processing_summary() -> Result<crate::video_processing::frame_statistics::StatsSummary, String> {
    let processor = get_frame_processor();
    let stats = processor.get_statistics();
    Ok(stats.get_summary())
}

/// 批量处理多个视频帧
/// 
/// 用于批量处理场景，提高处理效率
/// 
/// # Arguments
/// * `frames` - 待处理的帧数据列表
/// 
/// # Returns
/// * `Vec<FrameProcessingResult>` - 处理结果列表
#[tauri::command]
pub async fn batch_process_video_frames(
    frames: Vec<BatchFrameRequest>,
) -> Result<Vec<FrameProcessingResult>, String> {
    let processor = get_frame_processor();
    let mut results = Vec::with_capacity(frames.len());
    
    for frame_request in frames {
        let frame_id = frame_request.frame_id.unwrap_or_else(|| {
            (std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() & 0xFFFFFFFF) as u32
        });
        
        let result = processor.process_base64_frame(
            frame_request.vehicle_id,
            frame_id,
            &frame_request.base64_data,
        );
        
        results.push(result);
    }
    
    Ok(results)
}

/// 批量处理请求的数据结构
#[derive(serde::Deserialize)]
pub struct BatchFrameRequest {
    pub vehicle_id: u32,
    pub frame_id: Option<u32>,
    pub base64_data: String,
}

/// 重置所有视频处理统计信息
/// 
/// 清除所有车辆的统计数据，用于系统重置
#[tauri::command]
pub async fn reset_all_video_stats() -> Result<(), String> {
    let processor = get_frame_processor();
    let stats = processor.get_statistics();
    stats.clear_all_stats();
    Ok(())
}
