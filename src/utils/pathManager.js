/**
 * 全局路径管理器
 * 管理哪些车辆开启了路径显示功能
 */

import { ref } from 'vue';
import { createLogger } from './logger.js';
import eventBus, { EVENTS } from './eventBus.js';
import { invoke } from '@tauri-apps/api/core';
import { getCoordinateOffset, vehicleToModelCoordinates, applyOffsetToReceived } from './coordinateTransform.js';

const logger = createLogger('PathManager');

// 保存当前开启路径显示的车辆ID集合（全局状态）
export const pathEnabledVehicles = ref(new Set());

/**
 * 检查车辆是否开启了路径显示
 * @param {number} vehicleId - 车辆ID
 * @returns {boolean}
 */
export function isPathEnabled(vehicleId) {
    return pathEnabledVehicles.value.has(vehicleId);
}

/**
 * 添加车辆到路径显示列表
 * @param {number} vehicleId - 车辆ID
 */
export function enablePath(vehicleId) {
    pathEnabledVehicles.value.add(vehicleId);
    logger.info(`车辆 ${vehicleId} 已开启路径显示`);
}

/**
 * 从路径显示列表中移除车辆
 * @param {number} vehicleId - 车辆ID
 */
export function disablePath(vehicleId) {
    pathEnabledVehicles.value.delete(vehicleId);
    logger.info(`车辆 ${vehicleId} 已关闭路径显示`);
    
    // 发送事件清除该车辆的路径
    eventBus.emit('vehicle-path-clear', { vehicleId });
}

/**
 * 清空所有车辆的路径显示
 */
export function clearAllPaths() {
    const vehicleIds = Array.from(pathEnabledVehicles.value);
    pathEnabledVehicles.value.clear();
    logger.info(`已清空所有车辆的路径显示`);
    
    // 发送事件清除所有路径
    vehicleIds.forEach(vehicleId => {
        eventBus.emit('vehicle-path-clear', { vehicleId });
    });
}

/**
 * 批量添加车辆到路径显示列表
 * @param {Array<number>} vehicleIds - 车辆ID数组
 */
export function enablePaths(vehicleIds) {
    vehicleIds.forEach(id => pathEnabledVehicles.value.add(id));
    logger.info(`批量开启路径显示 - ${vehicleIds.length} 辆车`);
}

/**
 * 处理车辆路径更新事件（从0x0003协议）
 * @param {Object} payload - 事件载荷
 */
export async function handleVehiclePathUpdate(payload) {
    try {
        const { vehicleId, pathFileIds, timestamp } = payload;
        
        logger.info(`处理车辆路径更新 - 车辆: ${vehicleId}, 路径编号: [${pathFileIds.join(', ')}]`);
        
        // 检查路径编号列表
        if (!pathFileIds || pathFileIds.length === 0) {
            logger.warn(`车辆 ${vehicleId} 的路径编号列表为空`);
            return;
        }
        
        // 检查车辆是否在路径显示列表中
        if (!isPathEnabled(vehicleId)) {
            logger.debug(`车辆 ${vehicleId} 未开启路径显示，忽略路径更新`);
            return;
        }
        
        // 获取当前的坐标偏移量
        const offset = getCoordinateOffset();
        
        // 调用Rust命令获取合并的路径数据（已应用偏移）
        const result = await invoke('get_merged_path_data', {
            pathIds: pathFileIds,
            offsetX: offset.x,
            offsetY: offset.y
        });
        
        if (!result.success) {
            logger.error(`获取路径数据失败 - 车辆: ${vehicleId}, 错误: ${result.message || '未知错误'}`);
            return;
        }
        
        if (!result.points || result.points.length === 0) {
            logger.warn(`车辆 ${vehicleId} 的路径数据为空 - 可能路径文件不存在或为空`);
            return;
        }
        
        logger.info(`✅ 成功获取车辆 ${vehicleId} 的路径数据 - ${result.point_count} 个点`);
        
        // 将路径点转换为模型坐标系
        const modelPoints = result.points.map(point => {
            // point已经包含了偏移量，直接转换为模型坐标
            const modelCoords = vehicleToModelCoordinates(point.x, point.y);
            return {
                x: modelCoords.x,
                y: 0.05, // 路径线的高度（稍微抬高避免Z-fighting）
                z: modelCoords.z
            };
        });
        
        // 发送事件给Scene3D进行绘制
        eventBus.emit('vehicle-path-draw', {
            vehicleId,
            pathPoints: modelPoints,
            timestamp
        });
        
    } catch (error) {
        logger.error(`处理车辆路径更新失败:`, error);
        logger.error(`错误详情: ${error.message || '未知错误'}`);
        logger.error(`错误堆栈:`, error.stack || '无堆栈信息');
    }
}

/**
 * 处理车辆断开连接
 * @param {Object} payload - 事件载荷 {carId, isConnected}
 */
function handleVehicleDisconnect(payload) {
    const { carId, isConnected } = payload;
    
    // 只处理断开连接的情况
    if (isConnected) {
        return;
    }
    
    // 如果该车辆的路径正在显示，则清除
    if (isPathEnabled(carId)) {
        logger.info(`车辆 ${carId} 断开连接，清除其路径`);
        disablePath(carId);
    }
}

/**
 * 初始化路径管理器
 * 监听车辆路径更新和连接状态事件
 */
export function initPathManager() {
    logger.info('初始化路径管理器...');
    
    // 监听车辆路径更新事件（来自socketManager）
    eventBus.on(EVENTS.VEHICLE_PATH_UPDATE, handleVehiclePathUpdate);
    
    // 监听车辆连接状态变化事件
    eventBus.on(EVENTS.VEHICLE_CONNECTION_STATUS, handleVehicleDisconnect);
    
    logger.info('✅ 路径管理器初始化完成');
}

/**
 * 销毁路径管理器
 * 移除事件监听
 */
export function destroyPathManager() {
    eventBus.off(EVENTS.VEHICLE_PATH_UPDATE, handleVehiclePathUpdate);
    eventBus.off(EVENTS.VEHICLE_CONNECTION_STATUS, handleVehicleDisconnect);
    logger.info('路径管理器已销毁');
}

export default {
    pathEnabledVehicles,
    isPathEnabled,
    enablePath,
    disablePath,
    clearAllPaths,
    enablePaths,
    handleVehiclePathUpdate,
    initPathManager,
    destroyPathManager
};

