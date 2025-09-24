//! 视频帧统计模块
//! 
//! 提供实时的视频帧统计功能，包括帧率计算、性能监控等

use crate::video_processing::types::{VideoFrameStats, current_timestamp};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

/// 视频帧统计管理器
pub struct FrameStatistics {
    /// 每个车辆的统计信息
    stats: Arc<RwLock<HashMap<u32, VehicleFrameStats>>>,
}

/// 单个车辆的帧统计信息
struct VehicleFrameStats {
    /// 基础统计
    pub total_frames: u64,
    pub valid_frames: u64,
    pub invalid_frames: u64,
    
    /// 帧率计算
    pub frame_times: Vec<Instant>, // 最近的帧时间戳
    pub current_fps: f64,
    pub average_fps: f64,
    
    /// 大小统计
    pub total_size: u64, // 总字节数
    pub average_frame_size: f64,
    
    /// 性能统计
    pub processing_times: Vec<u64>, // 最近的处理时间（微秒）
    pub average_processing_time: f64,
    
    /// 时间信息
    pub first_frame_time: Instant,
    pub last_frame_time: Instant,
    pub last_update: u64,
}

impl Default for VehicleFrameStats {
    fn default() -> Self {
        let now = Instant::now();
        Self {
            total_frames: 0,
            valid_frames: 0,
            invalid_frames: 0,
            frame_times: Vec::with_capacity(60), // 保存最近60帧的时间
            current_fps: 0.0,
            average_fps: 0.0,
            total_size: 0,
            average_frame_size: 0.0,
            processing_times: Vec::with_capacity(100), // 保存最近100次处理时间
            average_processing_time: 0.0,
            first_frame_time: now,
            last_frame_time: now,
            last_update: current_timestamp(),
        }
    }
}

impl FrameStatistics {
    /// 创建新的帧统计管理器
    pub fn new() -> Self {
        Self {
            stats: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// 记录一个有效帧
    pub fn record_valid_frame(
        &self,
        vehicle_id: u32,
        frame_size: usize,
        processing_time_us: u64,
    ) {
        let mut stats_map = self.stats.write().unwrap();
        let stats = stats_map.entry(vehicle_id).or_default();
        
        let now = Instant::now();
        stats.total_frames += 1;
        stats.valid_frames += 1;
        stats.total_size += frame_size as u64;
        stats.last_frame_time = now;
        stats.last_update = current_timestamp();
        
        // 更新帧时间记录
        stats.frame_times.push(now);
        if stats.frame_times.len() > 60 {
            stats.frame_times.remove(0); // 保持最近60帧
        }
        
        // 更新处理时间记录
        stats.processing_times.push(processing_time_us);
        if stats.processing_times.len() > 100 {
            stats.processing_times.remove(0); // 保持最近100次
        }
        
        // 计算统计值
        Self::update_calculated_stats(stats);
    }
    
    /// 记录一个无效帧
    pub fn record_invalid_frame(&self, vehicle_id: u32) {
        let mut stats_map = self.stats.write().unwrap();
        let stats = stats_map.entry(vehicle_id).or_default();
        
        stats.total_frames += 1;
        stats.invalid_frames += 1;
        stats.last_update = current_timestamp();
    }
    
    /// 获取指定车辆的统计信息
    pub fn get_stats(&self, vehicle_id: u32) -> Option<VideoFrameStats> {
        let stats_map = self.stats.read().unwrap();
        stats_map.get(&vehicle_id).map(|stats| VideoFrameStats {
            vehicle_id,
            total_frames: stats.total_frames,
            valid_frames: stats.valid_frames,
            invalid_frames: stats.invalid_frames,
            average_fps: stats.average_fps,
            current_fps: stats.current_fps,
            average_frame_size: stats.average_frame_size,
            last_update: stats.last_update,
            average_processing_time_us: stats.average_processing_time,
        })
    }
    
    /// 获取所有车辆的统计信息
    pub fn get_all_stats(&self) -> Vec<VideoFrameStats> {
        let stats_map = self.stats.read().unwrap();
        stats_map
            .iter()
            .map(|(&vehicle_id, stats)| VideoFrameStats {
                vehicle_id,
                total_frames: stats.total_frames,
                valid_frames: stats.valid_frames,
                invalid_frames: stats.invalid_frames,
                average_fps: stats.average_fps,
                current_fps: stats.current_fps,
                average_frame_size: stats.average_frame_size,
                last_update: stats.last_update,
                average_processing_time_us: stats.average_processing_time,
            })
            .collect()
    }
    
    /// 清理指定车辆的统计信息
    pub fn clear_vehicle_stats(&self, vehicle_id: u32) {
        let mut stats_map = self.stats.write().unwrap();
        stats_map.remove(&vehicle_id);
    }
    
    /// 清理所有统计信息
    pub fn clear_all_stats(&self) {
        let mut stats_map = self.stats.write().unwrap();
        stats_map.clear();
    }
    
    /// 清理超时的统计信息（超过指定时间未更新的车辆）
    pub fn cleanup_stale_stats(&self, timeout_seconds: u64) {
        let current_time = current_timestamp();
        let timeout_ms = timeout_seconds * 1000;
        
        let mut stats_map = self.stats.write().unwrap();
        stats_map.retain(|&vehicle_id, stats| {
            let is_active = current_time.saturating_sub(stats.last_update) < timeout_ms;
            if !is_active {
                log::debug!("清理车辆 {} 的超时统计信息", vehicle_id);
            }
            is_active
        });
    }
    
    /// 更新计算得出的统计值
    fn update_calculated_stats(stats: &mut VehicleFrameStats) {
        // 计算平均帧大小
        if stats.valid_frames > 0 {
            stats.average_frame_size = stats.total_size as f64 / stats.valid_frames as f64;
        }
        
        // 计算平均处理时间
        if !stats.processing_times.is_empty() {
            let sum: u64 = stats.processing_times.iter().sum();
            stats.average_processing_time = sum as f64 / stats.processing_times.len() as f64;
        }
        
        // 计算帧率
        Self::calculate_fps(stats);
    }
    
    /// 计算帧率
    fn calculate_fps(stats: &mut VehicleFrameStats) {
        if stats.frame_times.len() < 2 {
            return;
        }
        
        let now = Instant::now();
        
        // 计算当前帧率（基于最近的帧）
        let recent_frames = std::cmp::min(10, stats.frame_times.len());
        if recent_frames >= 2 {
            let recent_duration = now.duration_since(stats.frame_times[stats.frame_times.len() - recent_frames]);
            if recent_duration.as_secs_f64() > 0.0 {
                stats.current_fps = (recent_frames - 1) as f64 / recent_duration.as_secs_f64();
            }
        }
        
        // 计算平均帧率（基于所有帧时间）
        let total_duration = now.duration_since(stats.first_frame_time);
        if total_duration.as_secs_f64() > 0.0 && stats.valid_frames > 1 {
            stats.average_fps = (stats.valid_frames - 1) as f64 / total_duration.as_secs_f64();
        }
        
        // 清理过旧的帧时间（超过5秒的）
        let cutoff_time = now - Duration::from_secs(5);
        stats.frame_times.retain(|&time| time > cutoff_time);
    }
    
    /// 获取统计摘要信息
    pub fn get_summary(&self) -> StatsSummary {
        let stats_map = self.stats.read().unwrap();
        
        let total_vehicles = stats_map.len();
        let mut total_frames = 0u64;
        let mut total_valid_frames = 0u64;
        let mut total_invalid_frames = 0u64;
        let mut total_fps = 0.0;
        let mut active_vehicles = 0;
        
        let current_time = current_timestamp();
        
        for stats in stats_map.values() {
            total_frames += stats.total_frames;
            total_valid_frames += stats.valid_frames;
            total_invalid_frames += stats.invalid_frames;
            
            // 只统计活跃的车辆（最近30秒内有更新）
            if current_time.saturating_sub(stats.last_update) < 30000 {
                active_vehicles += 1;
                total_fps += stats.current_fps;
            }
        }
        
        StatsSummary {
            total_vehicles,
            active_vehicles,
            total_frames,
            total_valid_frames,
            total_invalid_frames,
            average_fps: if active_vehicles > 0 { total_fps / active_vehicles as f64 } else { 0.0 },
            success_rate: if total_frames > 0 { 
                total_valid_frames as f64 / total_frames as f64 * 100.0 
            } else { 
                0.0 
            },
        }
    }
}

/// 统计摘要信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StatsSummary {
    pub total_vehicles: usize,
    pub active_vehicles: usize,
    pub total_frames: u64,
    pub total_valid_frames: u64,
    pub total_invalid_frames: u64,
    pub average_fps: f64,
    pub success_rate: f64, // 成功率百分比
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;
    
    #[test]
    fn test_frame_statistics() {
        let stats = FrameStatistics::new();
        
        // 记录一些帧
        stats.record_valid_frame(1, 1024, 100);
        stats.record_valid_frame(1, 2048, 150);
        stats.record_invalid_frame(1);
        
        let vehicle_stats = stats.get_stats(1).unwrap();
        assert_eq!(vehicle_stats.total_frames, 3);
        assert_eq!(vehicle_stats.valid_frames, 2);
        assert_eq!(vehicle_stats.invalid_frames, 1);
        assert_eq!(vehicle_stats.average_frame_size, 1536.0); // (1024 + 2048) / 2
    }
    
    #[test]
    fn test_cleanup_stale_stats() {
        let stats = FrameStatistics::new();
        
        stats.record_valid_frame(1, 1024, 100);
        stats.record_valid_frame(2, 1024, 100);
        
        // 等待一小段时间
        thread::sleep(Duration::from_millis(10));
        
        // 清理超时统计（超时时间设为很短）
        stats.cleanup_stale_stats(0); // 0秒超时，应该清理所有
        
        assert!(stats.get_stats(1).is_none());
        assert!(stats.get_stats(2).is_none());
    }
}
