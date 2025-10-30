/**
 * 视频处理工具 - 使用Rust后端进行高性能处理
 * 替代原有的JavaScript Base64处理逻辑
 */

import { invoke } from '@tauri-apps/api/core';
import { logger } from './logger.js';
import { TIMING } from '@/constants';

/**
 * 视频处理器类
 * 提供统一的视频帧处理接口，使用Rust后端优化性能
 */
export class VideoProcessor {
    constructor() {
        this.stats = new Map(); // 本地统计缓存
        this.processingQueue = new Map(); // 处理队列，避免重复处理
        this.processingTimestamps = new Map(); // 记录开始处理的时间戳
        this.PROCESSING_TIMEOUT = TIMING.VIDEO_PROCESSING_TIMEOUT;
        
        // 启动定期清理任务
        this._startCleanupTask();
    }
    
    /**
     * 启动超时清理任务
     * @private
     */
    _startCleanupTask() {
        if (typeof window === 'undefined') return;
        
        this.cleanupInterval = setInterval(() => {
            this._cleanupTimedOutProcessing();
        }, TIMING.VIDEO_CLEANUP_INTERVAL);
    }
    
    /**
     * 清理超时的处理任务
     * @private
     */
    _cleanupTimedOutProcessing() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, timestamp] of this.processingTimestamps.entries()) {
            if (now - timestamp > this.PROCESSING_TIMEOUT) {
                logger.warn('VideoProcessor', `处理任务超时，强制清理: ${key} (已等待${Math.round((now - timestamp) / 1000)}秒)`);
                this.processingQueue.delete(key);
                this.processingTimestamps.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            logger.info('VideoProcessor', `清理了${cleanedCount}个超时的处理任务`);
        }
    }
    
    /**
     * 处理Base64编码的视频帧
     * 
     * @param {number} vehicleId - 车辆ID
     * @param {string} base64Data - Base64编码的JPEG数据
     * @param {number} frameId - 帧ID（可选）
     * @returns {Promise<Object>} 处理结果
     */
    async processVideoFrame(vehicleId, base64Data, frameId = null) {
        try {
            // 避免重复处理相同的帧
            const cacheKey = `${vehicleId}_${frameId || Date.now()}`;
            if (this.processingQueue.has(cacheKey)) {
                return await this.processingQueue.get(cacheKey);
            }
            
            // 创建处理Promise
            const processingPromise = this._processFrameInternal(vehicleId, base64Data, frameId);
            this.processingQueue.set(cacheKey, processingPromise);
            this.processingTimestamps.set(cacheKey, Date.now()); // 记录开始时间
            
            try {
                const result = await processingPromise;
                return result;
            } finally {
                // 清理缓存和时间戳
                this.processingQueue.delete(cacheKey);
                this.processingTimestamps.delete(cacheKey);
            }
        } catch (error) {
            logger.error('VideoProcessor', `处理视频帧失败: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 内部处理方法
     */
    async _processFrameInternal(vehicleId, base64Data, frameId) {
        const startTime = performance.now();
        
        try {
            const result = await invoke('process_video_frame', {
                vehicleId: Number(vehicleId),
                frameId: frameId ? Number(frameId) : null,
                base64Data: base64Data
            });
            
            const processingTime = performance.now() - startTime;
            
            if (result.success && result.frame) {
                // 更新本地统计
                this._updateLocalStats(vehicleId, result.stats, processingTime);
                
                // 记录性能日志（仅在开发模式或详细日志模式下）
                if (import.meta.env.DEV && result.stats.total_time_us > TIMING.PERF_LOG_THRESHOLD) {
                    logger.debug('VideoProcessor', 
                        `车辆${vehicleId}帧处理: ${(result.stats.total_time_us / 1000).toFixed(2)}ms ` +
                        `(解码: ${(result.stats.decode_time_us / 1000).toFixed(2)}ms, ` +
                        `验证: ${(result.stats.validation_time_us / 1000).toFixed(2)}ms, ` +
                        `编码: ${(result.stats.encode_time_us / 1000).toFixed(2)}ms)`
                    );
                }
                
                return {
                    success: true,
                    frame: result.frame,
                    stats: result.stats,
                    processingTimeMs: processingTime
                };
            } else {
                logger.warn('VideoProcessor', `车辆${vehicleId}帧处理失败: ${result.error}`);
                return {
                    success: false,
                    error: result.error,
                    stats: result.stats,
                    processingTimeMs: processingTime
                };
            }
        } catch (error) {
            const processingTime = performance.now() - startTime;
            logger.error('VideoProcessor', `调用Rust处理器失败: ${error.message}`);
            return {
                success: false,
                error: error.message,
                processingTimeMs: processingTime
            };
        }
    }
    
    /**
     * 快速验证Base64编码的JPEG数据
     * 
     * @param {string} base64Data - Base64编码的数据
     * @returns {Promise<boolean>} 是否为有效的JPEG格式
     */
    async quickValidateJpeg(base64Data) {
        try {
            const result = await invoke('quick_validate_jpeg_base64', {
                base64Data: base64Data
            });
            return result;
        } catch (error) {
            logger.warn('VideoProcessor', `JPEG快速验证失败: ${error.message}`);
            return false;
        }
    }
    
    /**
     * 批量处理多个视频帧
     * 
     * @param {Array} frames - 帧数据数组 [{vehicleId, base64Data, frameId?}, ...]
     * @returns {Promise<Array>} 处理结果数组
     */
    async batchProcessFrames(frames) {
        try {
            const batchRequest = frames.map(frame => ({
                vehicle_id: Number(frame.vehicleId),
                frame_id: frame.frameId ? Number(frame.frameId) : null,
                base64_data: frame.base64Data
            }));
            
            const results = await invoke('batch_process_video_frames', {
                frames: batchRequest
            });
            
            // 更新本地统计
            results.forEach((result, index) => {
                if (result.success) {
                    this._updateLocalStats(frames[index].vehicleId, result.stats, 0);
                }
            });
            
            return results.map((result, index) => ({
                vehicleId: frames[index].vehicleId,
                success: result.success,
                frame: result.frame,
                error: result.error,
                stats: result.stats
            }));
        } catch (error) {
            logger.error('VideoProcessor', `批量处理失败: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 获取指定车辆的视频统计信息
     * 
     * @param {number} vehicleId - 车辆ID
     * @returns {Promise<Object|null>} 统计信息
     */
    async getVehicleStats(vehicleId) {
        try {
            const stats = await invoke('get_vehicle_video_stats', {
                vehicleId: Number(vehicleId)
            });
            
            // 更新本地缓存
            if (stats) {
                this.stats.set(vehicleId, {
                    ...stats,
                    lastUpdate: Date.now()
                });
            }
            
            return stats;
        } catch (error) {
            logger.warn('VideoProcessor', `获取车辆${vehicleId}统计失败: ${error.message}`);
            return null;
        }
    }
    
    /**
     * 获取所有车辆的视频统计信息
     * 
     * @returns {Promise<Array>} 统计信息数组
     */
    async getAllStats() {
        try {
            const allStats = await invoke('get_all_video_stats');
            
            // 更新本地缓存
            allStats.forEach(stats => {
                this.stats.set(stats.vehicle_id, {
                    ...stats,
                    lastUpdate: Date.now()
                });
            });
            
            return allStats;
        } catch (error) {
            logger.warn('VideoProcessor', `获取所有统计失败: ${error.message}`);
            return [];
        }
    }
    
    /**
     * 获取性能摘要
     * 
     * @returns {Promise<Object>} 性能摘要信息
     */
    async getPerformanceSummary() {
        try {
            const summary = await invoke('get_video_processing_summary');
            return summary;
        } catch (error) {
            logger.warn('VideoProcessor', `获取性能摘要失败: ${error.message}`);
            return null;
        }
    }
    
    /**
     * 清理指定车辆的统计信息
     * 
     * @param {number} vehicleId - 车辆ID
     */
    async clearVehicleStats(vehicleId) {
        try {
            await invoke('clear_vehicle_video_stats', {
                vehicleId: Number(vehicleId)
            });
            this.stats.delete(vehicleId);
        } catch (error) {
            logger.warn('VideoProcessor', `清理车辆${vehicleId}统计失败: ${error.message}`);
        }
    }
    
    /**
     * 清理超时的统计信息
     * 
     * @param {number} timeoutSeconds - 超时时间（秒），默认300秒
     * @returns {Promise<number>} 清理的车辆数量
     */
    async cleanupStaleStats(timeoutSeconds = 300) {
        try {
            const cleanedCount = await invoke('cleanup_stale_video_stats', {
                timeoutSeconds: timeoutSeconds
            });
            
            // 同时清理本地缓存
            const now = Date.now();
            const timeoutMs = timeoutSeconds * 1000;
            
            for (const [vehicleId, stats] of this.stats.entries()) {
                if (now - stats.lastUpdate > timeoutMs) {
                    this.stats.delete(vehicleId);
                }
            }
            
            logger.info('VideoProcessor', `清理了${cleanedCount}个超时车辆的统计信息`);
            return cleanedCount;
        } catch (error) {
            logger.warn('VideoProcessor', `清理超时统计失败: ${error.message}`);
            return 0;
        }
    }
    
    /**
     * 重置所有统计信息
     */
    async resetAllStats() {
        try {
            await invoke('reset_all_video_stats');
            this.stats.clear();
            logger.info('VideoProcessor', '已重置所有视频处理统计信息');
        } catch (error) {
            logger.warn('VideoProcessor', `重置统计失败: ${error.message}`);
        }
    }
    
    /**
     * 获取本地缓存的统计信息
     * 
     * @param {number} vehicleId - 车辆ID
     * @returns {Object|null} 本地缓存的统计信息
     */
    getLocalStats(vehicleId) {
        return this.stats.get(vehicleId) || null;
    }
    
    /**
     * 更新本地统计缓存
     */
    _updateLocalStats(vehicleId, rustStats, jsProcessingTime) {
        const existing = this.stats.get(vehicleId) || {};
        this.stats.set(vehicleId, {
            ...existing,
            rustProcessingTimeUs: rustStats.total_time_us,
            jsProcessingTimeMs: jsProcessingTime,
            lastUpdate: Date.now(),
            totalRustTime: (existing.totalRustTime || 0) + rustStats.total_time_us,
            totalJsTime: (existing.totalJsTime || 0) + jsProcessingTime,
            processedFrames: (existing.processedFrames || 0) + 1
        });
    }
    
    /**
     * 获取性能比较数据
     * 
     * @returns {Object} 性能比较统计
     */
    getPerformanceComparison() {
        const comparison = {
            totalVehicles: this.stats.size,
            totalFrames: 0,
            totalRustTimeMs: 0,
            totalJsTimeMs: 0,
            averageRustTimeMs: 0,
            averageJsTimeMs: 0,
            performanceGain: 0
        };
        
        for (const stats of this.stats.values()) {
            comparison.totalFrames += stats.processedFrames || 0;
            comparison.totalRustTimeMs += (stats.totalRustTime || 0) / 1000;
            comparison.totalJsTimeMs += stats.totalJsTime || 0;
        }
        
        if (comparison.totalFrames > 0) {
            comparison.averageRustTimeMs = comparison.totalRustTimeMs / comparison.totalFrames;
            comparison.averageJsTimeMs = comparison.totalJsTimeMs / comparison.totalFrames;
            
            if (comparison.averageJsTimeMs > 0) {
                comparison.performanceGain = 
                    ((comparison.averageJsTimeMs - comparison.averageRustTimeMs) / comparison.averageJsTimeMs) * 100;
            }
        }
        
        return comparison;
    }
    
    /**
     * 销毁处理器，清理所有资源
     */
    destroy() {
        // 清理定时器
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        // 清理队列和时间戳
        this.processingQueue.clear();
        this.processingTimestamps.clear();
        this.stats.clear();
        
        logger.info('VideoProcessor', '视频处理器已销毁');
    }
    
    /**
     * 获取当前处理队列状态（用于调试）
     * 
     * @returns {Object} 队列状态信息
     */
    getQueueStatus() {
        return {
            queueSize: this.processingQueue.size,
            oldestTask: this._getOldestTaskAge(),
            timeoutThreshold: this.PROCESSING_TIMEOUT
        };
    }
    
    /**
     * 获取最老任务的等待时间
     * @private
     */
    _getOldestTaskAge() {
        if (this.processingTimestamps.size === 0) return 0;
        
        const now = Date.now();
        let oldest = 0;
        
        for (const timestamp of this.processingTimestamps.values()) {
            const age = now - timestamp;
            if (age > oldest) oldest = age;
        }
        
        return oldest;
    }
}

// 全局单例
export const videoProcessor = new VideoProcessor();

// 自动清理任务（保存定时器引用以便清理）
let statsCleanupTimer = null;
if (typeof window !== 'undefined') {
    // 定期清理超时统计
    statsCleanupTimer = setInterval(() => {
        videoProcessor.cleanupStaleStats(300).catch(console.warn);
    }, TIMING.STATS_CLEANUP_INTERVAL);
    
    // 确保应用关闭时清理
    if (window.__videoProcessorCleanup) {
        window.__videoProcessorCleanup();
    }
    window.__videoProcessorCleanup = () => {
        if (statsCleanupTimer) {
            clearInterval(statsCleanupTimer);
            statsCleanupTimer = null;
            console.log('✅ VideoProcessor 清理定时器已清理');
        }
    };
}

export default videoProcessor;
