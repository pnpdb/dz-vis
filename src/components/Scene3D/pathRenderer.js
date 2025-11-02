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

// 存储车辆的完整路径点（用于实时裁剪）
// vehicleId -> { fullPathPoints: [{x, y, z}, ...], startIndex: number }
const vehiclePathData = new Map();

// 路径裁剪的节流Map（vehicleId -> timestamp）
const pathTrimThrottle = new Map();

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
    
    // 保存完整路径数据（用于实时裁剪）
    vehiclePathData.set(vehicleId, {
        fullPathPoints: [...pathPoints], // 深拷贝
        startIndex: 0, // 当前显示的起始索引
        debugLogged: false, // 调试日志标志
        closestPointLogged: false // 最近点调试标志
    });
    
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
    vehiclePathData.delete(vehicleId);
    pathTrimThrottle.delete(vehicleId);
    
    // 场景使用连续渲染，无需手动触发渲染
    
    logger.debug(`移除路径线 - 车辆: ${vehicleId}`);
}

/**
 * 获取车辆颜色
 * @param {number} vehicleId - 车辆ID
 * @returns {string} 颜色值（十六进制字符串，如 "#FF0000"）
 */
function getVehicleColor(vehicleId) {
    try {
        // 尝试从 carStore 获取车辆自定义颜色
        const { useCarStore } = require('@/stores/car.js');
        const carStore = useCarStore();
        
        // 🐛 修复：从 carList 数组而不是 vehicles Map 获取颜色
        if (carStore.carList && Array.isArray(carStore.carList)) {
            const vehicle = carStore.carList.find(v => v.id === vehicleId || v.vehicleId === vehicleId);
            if (vehicle && vehicle.color) {
                // 确保返回十六进制格式
                return vehicle.color.startsWith('#') ? vehicle.color : `#${vehicle.color}`;
            }
        }
    } catch (error) {
        // Scene3D 上下文中无法访问 store，使用默认颜色
        logger.warn(`无法从store获取车辆 ${vehicleId} 的颜色，使用默认颜色:`, error.message);
    }
    
    // 默认颜色：根据车辆ID分配（返回十六进制字符串）
    const defaultColors = [
        '#00FF00', '#0080FF', '#FF8000', '#FF00FF',
        '#FFFF00', '#00FFFF', '#FF0080', '#80FF00'
    ];
    
    return defaultColors[(vehicleId - 1) % defaultColors.length] || '#00FF00';
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

/**
 * 实时裁剪车辆路径（清除已走过的路径点）
 * 
 * 算法说明：
 * 1. 在路径上查找距离车辆最近的点（最近点）
 * 2. 从最近点开始，沿着路径方向保留后续所有点
 * 3. 这样可以正确处理急转弯、U型弯等复杂路径
 * 
 * @param {number} vehicleId - 车辆ID
 * @param {Object} vehiclePosition - 车辆当前位置 {x, z}
 * @param {number} vehicleOrientation - 车辆朝向（弧度，用于辅助判断）
 * @param {number} navStatus - 导航状态
 */
export function trimVehiclePath(vehicleId, vehiclePosition, vehicleOrientation, navStatus) {
    // 只在导航状态 3、4、7 时裁剪路径
    if (![3, 4, 7].includes(navStatus)) {
        return;
    }
    
    // 检查是否有路径数据
    const pathData = vehiclePathData.get(vehicleId);
    const line = vehiclePaths.get(vehicleId);
    
    if (!pathData || !line) {
        if (!pathData) {
            console.log(`⚠️ 车辆 ${vehicleId} 没有路径数据，跳过裁剪`);
        }
        return;
    }
    
    // ✅ 先解构数据，再使用
    const { fullPathPoints, startIndex } = pathData;
    
    // 首次调用时输出调试信息
    if (!pathData.debugLogged) {
        console.log(`🛣️ 开始裁剪车辆 ${vehicleId} 的路径`);
        console.log(`   总路径点数: ${fullPathPoints.length}`);
        console.log(`   车辆位置: (${vehiclePosition.x.toFixed(3)}, ${vehiclePosition.z.toFixed(3)})`);
        console.log(`   车辆朝向: ${(vehicleOrientation * 180 / Math.PI).toFixed(1)}°`);
        console.log(`   导航状态: ${navStatus}`);
        
        // 🔍 输出前10个路径点和后10个路径点，查看分布
        console.log(`📍 前10个路径点:`);
        for (let i = 0; i < Math.min(10, fullPathPoints.length); i++) {
            const p = fullPathPoints[i];
            console.log(`   [${i}]: (${p.x.toFixed(3)}, ${p.z.toFixed(3)})`);
        }
        if (fullPathPoints.length > 20) {
            console.log(`📍 后10个路径点:`);
            for (let i = fullPathPoints.length - 10; i < fullPathPoints.length; i++) {
                const p = fullPathPoints[i];
                console.log(`   [${i}]: (${p.x.toFixed(3)}, ${p.z.toFixed(3)})`);
            }
        }
        
        pathData.debugLogged = true;
    }
    
    // 节流：降低到 100ms 更新一次，提高实时性
    const now = Date.now();
    const lastTrim = pathTrimThrottle.get(vehicleId) || 0;
    if (now - lastTrim < 100) {
        return;
    }
    pathTrimThrottle.set(vehicleId, now);
    
    // 如果所有点都已经走过，不再处理
    if (startIndex >= fullPathPoints.length - 1) {
        return;
    }
    
    // ========== 基于距离的路径裁剪算法（适用于急转弯） ==========
    
    // 🔍 搜索策略：
    // 1. 如果是第一次裁剪（startIndex = 0），搜索全部路径点，找到车辆真正的起始位置
    // 2. 之后只搜索小范围（200个点），提高性能
    const isFirstTrim = (startIndex === 0);
    const searchRange = isFirstTrim 
        ? fullPathPoints.length  // 第一次：搜索全部点
        : Math.min(200, fullPathPoints.length - startIndex); // 之后：搜索200个点
    const searchEndIndex = startIndex + searchRange;
    
    if (isFirstTrim) {
        console.log(`🔍 第一次裁剪，搜索全部 ${fullPathPoints.length} 个路径点`);
    }
    
    // 查找距离车辆最近的路径点
    let closestIndex = startIndex;
    let minDistance = Infinity;
    let debugSamples = []; // 记录采样点用于调试
    
    for (let i = startIndex; i < searchEndIndex; i++) {
        const point = fullPathPoints[i];
        
        // 计算欧氏距离
        const dx = point.x - vehiclePosition.x;
        const dz = point.z - vehiclePosition.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // 采样记录（每100个点记录一次，用于调试）
        if (isFirstTrim && i % 100 === 0) {
            debugSamples.push({ index: i, distance: distance.toFixed(3), point: `(${point.x.toFixed(3)}, ${point.z.toFixed(3)})` });
        }
        
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }
    
    // 如果是第一次裁剪，输出采样信息
    if (isFirstTrim && debugSamples.length > 0) {
        console.log(`📊 距离采样（每100个点）:`);
        debugSamples.forEach(s => {
            console.log(`   [${s.index}]: ${s.point} → 距离 ${s.distance}`);
        });
    }
    
    // 每次都输出最近点信息（用于调试）
    const closestPoint = fullPathPoints[closestIndex];
    console.log(`🎯 车辆 ${vehicleId} 最近点查找:`);
    console.log(`   车辆坐标: (${vehiclePosition.x.toFixed(3)}, ${vehiclePosition.z.toFixed(3)})`);
    console.log(`   搜索范围: ${startIndex} - ${searchEndIndex} (共 ${searchRange} 个点)`);
    console.log(`   最近点索引: ${closestIndex}/${fullPathPoints.length}`);
    console.log(`   最近点坐标: (${closestPoint.x.toFixed(3)}, ${closestPoint.z.toFixed(3)})`);
    console.log(`   最近距离: ${minDistance.toFixed(3)} 单位`);
    
    // 额外的安全检查：如果最近距离太大，说明车辆可能偏离路径
    const maxDeviationDistance = 10.0; // 增大最大偏离距离（单位），更宽容
    if (minDistance > maxDeviationDistance) {
        console.warn(`⚠️ 车辆 ${vehicleId} 偏离路径过远 (${minDistance.toFixed(2)}m > ${maxDeviationDistance}m)，跳过裁剪`);
        return;
    }
    
    // 计算新的起始索引
    // 策略：找到最近点，删除最近点之前的所有路径点
    // 
    // 🎯 核心逻辑：
    // 1. 路径文件本身就是有序的（从起点到终点）
    // 2. 车辆肯定是沿着这个顺序行驶
    // 3. 找到离车辆最近的点，直接删除这个点之前的所有点
    // 4. 只绘制从最近点到末尾的路径（还没走的路）
    
    // ✅ 如果最近点没有前进，说明车辆还在原来的路径段上，不需要更新
    if (closestIndex <= startIndex) {
        console.log(`⏸️  车辆 ${vehicleId} 路径未前进: startIndex=${startIndex}, closestIndex=${closestIndex}`);
        return;
    }
    
    // ✅ 直接使用最近点作为新的起始索引（删除最近点之前的所有点）
    const newStartIndex = closestIndex;
    
    // 输出裁剪信息（便于调试）
    console.log(`✂️  车辆 ${vehicleId} 准备裁剪路径:`);
    console.log(`   当前索引: ${startIndex} -> 新索引: ${newStartIndex} (前进 ${newStartIndex - startIndex} 个点)`);
    console.log(`   删除点数: ${newStartIndex} 个`);
    console.log(`   保留点数: ${fullPathPoints.length - newStartIndex} 个`);
    
    // 更新起始索引
    pathData.startIndex = newStartIndex;
    
    // 如果所有点都已走过，隐藏路径但不删除
    if (newStartIndex >= fullPathPoints.length - 1) {
        line.visible = false;
        console.log(`🏁 车辆 ${vehicleId} 已走完所有路径点，路径已隐藏`);
        return;
    }
    
    // 提取剩余的路径点
    const remainingPoints = fullPathPoints.slice(newStartIndex);
    
    // 更新路径几何体
    const positions = [];
    remainingPoints.forEach(p => {
        positions.push(p.x, p.y, p.z);
    });
    
    // 更新几何体位置
    // setPositions() 会自动处理内部属性的更新，无需手动清理
    const geometry = line.geometry;
    geometry.setPositions(positions);
    line.computeLineDistances(); // 必须重新计算线段距离（用于虚线等效果）
    line.visible = true;
    
    console.log(`✅ 车辆 ${vehicleId} 路径已裁剪完成:`);
    console.log(`   删除: ${newStartIndex} 个点 (已走过)`);
    console.log(`   保留: ${remainingPoints.length} 个点 (还未走)`);
    console.log(`   百分比: ${((remainingPoints.length/fullPathPoints.length)*100).toFixed(1)}% 剩余`);
}

// 导出 removePath 供外部使用
export { removePath };

export default {
    initPathRenderer,
    destroyPathRenderer,
    clearAllPaths,
    getPathCount,
    hasPath,
    trimVehiclePath,
    removePath
};

