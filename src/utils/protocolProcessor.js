//! 前端协议处理工具
//! 
//! 提供与Rust后端协议处理模块的接口，支持高性能的二进制协议处理

import { invoke } from '@tauri-apps/api/core'

/**
 * 协议处理器类
 * 封装与Rust后端的协议处理交互
 */
class ProtocolProcessor {
    constructor() {
        this.stats = null
        this.supportedTypes = null
    }

    /**
     * 解析单个协议
     * @param {string} messageType - 消息类型 (如 "0x0001")
     * @param {string} data - Base64编码的二进制数据
     * @returns {Promise<Object>} 解析结果
     */
    async parseProtocol(messageType, data) {
        try {
            const result = await invoke('parse_protocol', {
                request: {
                    message_type: messageType,
                    data: data
                }
            })
            
            if (result.success) {
                console.log(`🔍 协议解析成功: ${messageType}, 耗时: ${result.stats.total_time_us}μs`)
                return {
                    success: true,
                    data: result.data,
                    stats: result.stats
                }
            } else {
                console.warn(`协议解析失败: ${result.error}`)
                return {
                    success: false,
                    error: result.error,
                    stats: result.stats
                }
            }
        } catch (error) {
            console.error('协议解析异常:', error)
            return {
                success: false,
                error: error.message || '解析异常'
            }
        }
    }

    /**
     * 验证协议数据
     * @param {Object} parsedData - 已解析的协议数据
     * @returns {Promise<boolean>} 验证结果
     */
    async validateProtocol(parsedData) {
        try {
            const isValid = await invoke('validate_protocol', { parsedData })
            return isValid
        } catch (error) {
            console.error('协议验证异常:', error)
            return false
        }
    }

    /**
     * 批量处理协议
     * @param {Array} tasks - 任务列表
     * @param {string} mode - 处理模式 ("normal", "priority", "adaptive")
     * @param {number} targetLatencyUs - 目标延迟（微秒，仅adaptive模式）
     * @returns {Promise<Object>} 批处理结果
     */
    async batchProcessProtocols(tasks, mode = 'normal', targetLatencyUs = null) {
        try {
            const request = {
                tasks: tasks,
                mode: mode,
                target_latency_us: targetLatencyUs
            }

            const result = await invoke('batch_process_protocols', { request })
            
            console.log(`📦 批量处理完成: 成功${result.success_count}, 失败${result.error_count}, 耗时: ${result.total_time_us}μs`)
            
            return {
                success: true,
                result: result
            }
        } catch (error) {
            console.error('批量处理异常:', error)
            return {
                success: false,
                error: error.message || '批量处理异常'
            }
        }
    }

    /**
     * 构建协议数据
     * @param {string} protocolType - 协议类型
     * @param {Object} data - 协议数据
     * @returns {Promise<string>} Base64编码的协议数据
     */
    async buildProtocol(protocolType, data) {
        try {
            const result = await invoke('build_protocol', {
                request: {
                    protocol_type: protocolType,
                    data: data
                }
            })
            
            console.log(`🔧 协议构建成功: ${protocolType}`)
            return result
        } catch (error) {
            console.error('协议构建异常:', error)
            throw error
        }
    }

    /**
     * 快速验证协议格式
     * @param {string} messageType - 消息类型
     * @param {string} data - Base64编码的数据
     * @returns {Promise<Object>} 验证结果
     */
    async quickValidateFormat(messageType, data) {
        try {
            const result = await invoke('quick_validate_protocol_format', {
                messageType: messageType,
                data: data
            })
            
            return result
        } catch (error) {
            console.error('格式验证异常:', error)
            return {
                valid: false,
                error: error.message || '格式验证异常'
            }
        }
    }

    /**
     * 获取协议处理统计信息
     * @returns {Promise<Object>} 统计信息
     */
    async getStats() {
        try {
            const stats = await invoke('get_protocol_stats')
            this.stats = stats
            return stats
        } catch (error) {
            console.error('获取统计信息异常:', error)
            return null
        }
    }

    /**
     * 重置协议处理统计
     * @returns {Promise<boolean>} 重置结果
     */
    async resetStats() {
        try {
            await invoke('reset_protocol_stats')
            this.stats = null
            console.log('📊 协议处理统计已重置')
            return true
        } catch (error) {
            console.error('重置统计信息异常:', error)
            return false
        }
    }

    /**
     * 配置批处理器
     * @param {number} workerCount - 工作线程数量
     * @returns {Promise<boolean>} 配置结果
     */
    async configureBatchProcessor(workerCount) {
        try {
            await invoke('configure_batch_processor', { workerCount })
            console.log(`⚙️ 批处理器配置更新: ${workerCount} 个工作线程`)
            return true
        } catch (error) {
            console.error('配置批处理器异常:', error)
            return false
        }
    }

    /**
     * 获取支持的消息类型
     * @returns {Promise<Array>} 支持的消息类型列表
     */
    async getSupportedMessageTypes() {
        try {
            if (!this.supportedTypes) {
                this.supportedTypes = await invoke('get_supported_message_types')
            }
            return this.supportedTypes
        } catch (error) {
            console.error('获取支持的消息类型异常:', error)
            return []
        }
    }

    /**
     * 解析车辆信息协议
     * @param {string} data - Base64编码的数据
     * @returns {Promise<Object>} 车辆信息
     */
    async parseVehicleInfo(data) {
        const result = await this.parseProtocol('0x0001', data)
        if (result.success && result.data && result.data.VehicleInfo) {
            return {
                success: true,
                vehicleInfo: result.data.VehicleInfo,
                stats: result.stats
            }
        }
        return {
            success: false,
            error: result.error || '车辆信息解析失败'
        }
    }

    /**
     * 构建车辆控制协议
     * @param {number} vehicleId - 车辆ID
     * @param {string} command - 控制指令 ("Start", "Stop", "EmergencyBrake", "InitPose")
     * @param {Object} positionData - 位置数据（仅InitPose需要）
     * @returns {Promise<string>} Base64编码的协议数据
     */
    async buildVehicleControl(vehicleId, command, positionData = null) {
        const controlData = {
            vehicle_id: vehicleId,
            command: command,
            position_data: positionData
        }

        return await this.buildProtocol('vehicle_control', controlData)
    }

    /**
     * 构建出租车订单协议
     * @param {number} vehicleId - 车辆ID
     * @param {number} startX - 起点X坐标
     * @param {number} startY - 起点Y坐标
     * @param {number} endX - 终点X坐标
     * @param {number} endY - 终点Y坐标
     * @returns {Promise<string>} Base64编码的协议数据
     */
    async buildTaxiOrder(vehicleId, startX, startY, endX, endY) {
        const orderData = {
            vehicle_id: vehicleId,
            start_x: startX,
            start_y: startY,
            end_x: endX,
            end_y: endY
        }

        return await this.buildProtocol('taxi_order', orderData)
    }

    /**
     * 构建AVP泊车协议
     * @param {number} vehicleId - 车辆ID
     * @param {number} parkingSpot - 停车位编号
     * @returns {Promise<string>} Base64编码的协议数据
     */
    async buildAvpParking(vehicleId, parkingSpot) {
        const parkingData = {
            vehicle_id: vehicleId,
            parking_spot: parkingSpot
        }

        return await this.buildProtocol('avp_parking', parkingData)
    }

    /**
     * 构建AVP取车协议
     * @param {number} vehicleId - 车辆ID
     * @returns {Promise<string>} Base64编码的协议数据
     */
    async buildAvpPickup(vehicleId) {
        const pickupData = {
            vehicle_id: vehicleId
        }

        return await this.buildProtocol('avp_pickup', pickupData)
    }

    /**
     * 构建数据记录协议
     * @param {number} vehicleId - 车辆ID
     * @param {number} action - 动作类型 (0: 停止记录, 1: 开始记录, 2: 暂停记录)
     * @returns {Promise<string>} Base64编码的协议数据
     */
    async buildDataRecording(vehicleId, action) {
        const recordingData = {
            vehicle_id: vehicleId,
            action: action
        }

        return await this.buildProtocol('data_recording', recordingData)
    }

    /**
     * 构建施工标记协议
     * @param {number} markerId - 标记ID
     * @param {number} action - 动作类型 (0: 移除标记, 1: 添加标记)
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {Promise<string>} Base64编码的协议数据
     */
    async buildConstructionMarker(markerId, action, x, y) {
        const markerData = {
            marker_id: markerId,
            action: action,
            x: x,
            y: y
        }

        return await this.buildProtocol('construction_marker', markerData)
    }

    /**
     * 创建批处理任务
     * @param {string} messageType - 消息类型
     * @param {string} data - Base64编码的数据
     * @param {string} priority - 优先级 ("low", "normal", "high", "critical")
     * @returns {Object} 批处理任务对象
     */
    createBatchTask(messageType, data, priority = 'normal') {
        return {
            message_type: messageType,
            data: data,
            priority: priority
        }
    }

    /**
     * 获取性能摘要
     * @returns {Promise<Object>} 性能摘要
     */
    async getPerformanceSummary() {
        const stats = await this.getStats()
        if (!stats) return null

        const batchStats = stats.batch_processing
        const validationStats = stats.validation
        const conversionStats = stats.conversion

        return {
            totalTasks: batchStats.total_tasks,
            successRate: batchStats.successful_tasks / (batchStats.successful_tasks + batchStats.failed_tasks),
            averageProcessingTime: batchStats.average_time_us,
            throughput: batchStats.throughput,
            parallelEfficiency: batchStats.parallel_efficiency,
            validationSuccessRate: validationStats.success_rate,
            zeroCopyEfficiency: conversionStats.zero_copy_efficiency,
            savedBytes: conversionStats.saved_bytes
        }
    }

    /**
     * 监控协议处理性能
     * @param {number} intervalMs - 监控间隔（毫秒）
     * @param {Function} callback - 回调函数
     * @returns {Function} 停止监控的函数
     */
    startPerformanceMonitoring(intervalMs = 5000, callback) {
        const intervalId = setInterval(async () => {
            const summary = await this.getPerformanceSummary()
            if (summary && callback) {
                callback(summary)
            }
        }, intervalMs)

        // 追踪活跃的监控定时器（防止内存泄漏）
        if (!this.activeMonitoringTimers) {
            this.activeMonitoringTimers = new Set();
        }
        this.activeMonitoringTimers.add(intervalId);

        return () => {
            clearInterval(intervalId)
            if (this.activeMonitoringTimers) {
                this.activeMonitoringTimers.delete(intervalId);
            }
            console.log('📊 协议处理性能监控已停止')
        }
    }
    
    /**
     * 销毁处理器，清理所有资源
     */
    destroy() {
        // 清理所有活跃的监控定时器
        if (this.activeMonitoringTimers && this.activeMonitoringTimers.size > 0) {
            this.activeMonitoringTimers.forEach(timerId => {
                clearInterval(timerId);
            });
            this.activeMonitoringTimers.clear();
            console.log('ProtocolProcessor 监控定时器已清理');
        }
        
        // 清理统计数据
        this.stats = null;
        this.supportedTypes = null;
    }
}

// 创建全局实例
const protocolProcessor = new ProtocolProcessor()

export default protocolProcessor

// 导出类以供需要创建多个实例的场景
export { ProtocolProcessor }
