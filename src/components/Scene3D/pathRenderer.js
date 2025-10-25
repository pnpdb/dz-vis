/**
 * 路径渲染器
 * 负责在 Three.js 场景中绘制车辆的全局路径
 */

import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import eventBus from '@/utils/eventBus.js';
import { createLogger } from '@/utils/logger.js';

const logger = createLogger('PathRenderer');

// 全局变量
let scene = null;
let sandboxModel = null;

// 存储车辆路径：vehicleId -> THREE.Line
const vehiclePaths = new Map();

/**
 * 初始化路径渲染器
 * @param {THREE.Scene} sceneInstance - Three.js 场景
 * @param {THREE.Object3D} sandboxModelInstance - 沙盘模型
 */
export function initPathRenderer(sceneInstance, sandboxModelInstance) {
    scene = sceneInstance;
    sandboxModel = sandboxModelInstance;
    
    // 监听路径绘制事件
    eventBus.on('vehicle-path-draw', handlePathDraw);
    
    // 监听路径清除事件
    eventBus.on('vehicle-path-clear', handlePathClear);
    
    // 监听窗口大小变化，更新线材质分辨率
    window.addEventListener('resize', updateLineResolution);
    
    logger.info('✅ 路径渲染器初始化完成');
}

/**
 * 更新所有路径线的材质分辨率（窗口大小变化时调用）
 */
function updateLineResolution() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    vehiclePaths.forEach((line) => {
        if (line.material && line.material.resolution) {
            line.material.resolution.set(width, height);
        }
    });
    
    logger.debug(`更新路径线分辨率: ${width}x${height}`);
}

/**
 * 销毁路径渲染器
 * 移除所有路径并取消事件监听
 */
export function destroyPathRenderer() {
    // 清除所有路径
    vehiclePaths.forEach((line, vehicleId) => {
        removePath(vehicleId);
    });
    vehiclePaths.clear();
    
    // 移除事件监听
    eventBus.off('vehicle-path-draw', handlePathDraw);
    eventBus.off('vehicle-path-clear', handlePathClear);
    window.removeEventListener('resize', updateLineResolution);
    
    logger.info('路径渲染器已销毁');
}

/**
 * 处理路径绘制事件
 * @param {Object} payload - 事件载荷 {vehicleId, pathPoints, color?, timestamp}
 */
function handlePathDraw(payload) {
    const { vehicleId, pathPoints, color, timestamp } = payload;
    
    logger.info(`绘制车辆路径 - 车辆: ${vehicleId}, 点数: ${pathPoints.length}`);
    
    if (!pathPoints || pathPoints.length === 0) {
        logger.warn(`车辆 ${vehicleId} 的路径点为空`);
        return;
    }
    
    try {
        // 移除旧的路径
        if (vehiclePaths.has(vehicleId)) {
            removePath(vehicleId);
        }
        
        // 创建新的路径（传递颜色）
        createPath(vehicleId, pathPoints, color);
        
        logger.info(`✅ 车辆 ${vehicleId} 的路径已绘制`);
    } catch (error) {
        logger.error(`绘制车辆 ${vehicleId} 的路径失败:`, error);
    }
}

/**
 * 处理路径清除事件
 * @param {Object} payload - 事件载荷
 */
function handlePathClear(payload) {
    const { vehicleId } = payload;
    
    logger.info(`清除车辆路径 - 车辆: ${vehicleId}`);
    
    try {
        removePath(vehicleId);
        logger.info(`✅ 车辆 ${vehicleId} 的路径已清除`);
    } catch (error) {
        logger.error(`清除车辆 ${vehicleId} 的路径失败:`, error);
    }
}

/**
 * 创建路径线（使用 Line2 支持粗线）
 * @param {number} vehicleId - 车辆ID
 * @param {Array} pathPoints - 路径点数组 [{x, y, z}, ...]
 * @param {string} color - 车辆颜色（可选，格式：#RRGGBB）
 */
function createPath(vehicleId, pathPoints, color = null) {
    // 将路径点转换为扁平数组 [x1, y1, z1, x2, y2, z2, ...]
    const positions = [];
    pathPoints.forEach(p => {
        positions.push(p.x, p.y, p.z);
    });
    
    // 创建 LineGeometry
    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    
    // 获取车辆颜色
    let colorObj;
    if (color) {
        colorObj = new THREE.Color(color);
    } else {
        const colorHex = getVehicleColor(vehicleId);
        colorObj = new THREE.Color(colorHex);
    }
    
    // 创建 LineMaterial（支持粗线）
    const material = new LineMaterial({
        color: colorObj,
        linewidth: 5, // 单位是像素，这里设置为5像素
        worldUnits: false, // false 表示使用像素单位
        transparent: true,
        opacity: 0.9,
        depthTest: true,
        depthWrite: true
    });
    
    // 设置渲染分辨率（必须）
    if (typeof window !== 'undefined') {
        material.resolution.set(window.innerWidth, window.innerHeight);
    }
    
    // 创建 Line2 对象
    const line = new Line2(geometry, material);
    line.name = `vehicle_path_${vehicleId}`;
    line.computeLineDistances(); // 必须调用
    
    // 添加到沙盘模型
    if (sandboxModel) {
        sandboxModel.add(line);
    } else {
        logger.warn('沙盘模型未初始化，路径添加到场景');
        scene.add(line);
    }
    
    // 保存引用
    vehiclePaths.set(vehicleId, line);
    
    logger.info(`✅ 车辆 ${vehicleId} 路径已绘制 - ${pathPoints.length} 个点, 颜色: #${colorObj.getHexString()}`);
}

/**
 * 移除路径线
 * @param {number} vehicleId - 车辆ID
 */
function removePath(vehicleId) {
    const line = vehiclePaths.get(vehicleId);
    
    if (!line) {
        logger.debug(`车辆 ${vehicleId} 没有路径需要移除`);
        return;
    }
    
    // 从场景中移除
    if (sandboxModel) {
        sandboxModel.remove(line);
    } else {
        scene.remove(line);
    }
    
    // 释放资源
    if (line.geometry) {
        line.geometry.dispose();
    }
    
    if (line.material) {
        line.material.dispose();
    }
    
    // 从Map中移除
    vehiclePaths.delete(vehicleId);
    
    // 场景使用连续渲染，无需手动触发渲染
    
    logger.debug(`移除路径线 - 车辆: ${vehicleId}`);
}

/**
 * 获取车辆颜色
 * @param {number} vehicleId - 车辆ID
 * @returns {number} 颜色值（十六进制）
 */
function getVehicleColor(vehicleId) {
    try {
        // 尝试从 carStore 获取车辆自定义颜色
        const { useCarStore } = require('@/stores/car.js');
        const carStore = useCarStore();
        
        const vehicle = carStore.vehicles.find(v => v.id === vehicleId);
        if (vehicle && vehicle.color) {
            const colorStr = vehicle.color.replace('#', '');
            return parseInt(colorStr, 16);
        }
    } catch (error) {
        // Scene3D 上下文中无法访问 store，使用默认颜色
    }
    
    // 默认颜色：根据车辆ID分配
    const defaultColors = [
        0x00FF00, 0x0080FF, 0xFF8000, 0xFF00FF,
        0xFFFF00, 0x00FFFF, 0xFF0080, 0x80FF00
    ];
    
    return defaultColors[(vehicleId - 1) % defaultColors.length] || 0x00FF00;
}

/**
 * 清除所有路径
 */
export function clearAllPaths() {
    logger.info('清除所有车辆路径...');
    
    vehiclePaths.forEach((line, vehicleId) => {
        removePath(vehicleId);
    });
    
    logger.info('✅ 所有车辆路径已清除');
}

/**
 * 获取当前已绘制的路径数量
 * @returns {number} 路径数量
 */
export function getPathCount() {
    return vehiclePaths.size;
}

/**
 * 获取指定车辆是否有路径
 * @param {number} vehicleId - 车辆ID
 * @returns {boolean}
 */
export function hasPath(vehicleId) {
    return vehiclePaths.has(vehicleId);
}

export default {
    initPathRenderer,
    destroyPathRenderer,
    clearAllPaths,
    getPathCount,
    hasPath
};

