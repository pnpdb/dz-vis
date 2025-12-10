/**
 * 坐标转换工具模块
 * 
 * 坐标系说明：
 * 1. 车辆坐标系（协议坐标系）：
 *    - 原点在左下角 (0, 0)
 *    - X轴：0 → 6.0m（向右为正）
 *    - Y轴：0 → 5.0m（向上为正，对应模型Z轴变小）
 * 
 * 2. 沙盘模型坐标系（Three.js世界坐标）：
 *    - 原点在中心 (0, 0, 0)
 *    - X轴：-3.0 → +3.0（向右为正）
 *    - Z轴：+2.5 → -2.5（向前为正，注意方向相反）
 */

// ============ 常量定义 ============

/**
 * 沙盘模型原始尺寸（单位：米，与缩放无关）
 */
export const SANDBOX_DIMENSIONS = {
    width: 6.0,   // X轴总宽度（米）
    depth: 5.0,   // Z轴总深度（米）
    halfWidth: 6.0 / 2,   // 3.0
    halfDepth: 5.0 / 2    // 2.5
};

/**
 * 车位中心点坐标（车辆坐标系，单位：米）
 * ⚠️ 注意：这些坐标需要根据新模型重新测量！
 * 以下是按比例缩放的临时值（X轴 * 1.247, Y轴 * 1.779）
 */
export const PARKING_SLOTS = {
    1: { x: 4.326, y: 1.299 },  // 1号车位（临时值，需重新测量）
    2: { x: 4.907, y: 1.299 }   // 2号车位（临时值，需重新测量）
};

// ============ 全局坐标偏移量管理 ============

/**
 * 坐标偏移量（单位：米）
 * - 接收车辆坐标时：先加上偏移量，再转换为模型坐标
 * - 发送车辆坐标时：转换为车辆坐标后，再减去偏移量
 */
let globalCoordinateOffset = {
    x: 0,
    y: 0
};

/**
 * 设置全局坐标偏移量
 * @param {number} offsetX - X轴偏移量（米，可正可负）
 * @param {number} offsetY - Y轴偏移量（米，可正可负）
 */
export function setCoordinateOffset(offsetX, offsetY) {
    globalCoordinateOffset.x = Number(offsetX) || 0;
    globalCoordinateOffset.y = Number(offsetY) || 0;
    console.info(`✅ [坐标偏移] 已设置: X=${globalCoordinateOffset.x}m, Y=${globalCoordinateOffset.y}m`);
}

/**
 * 获取当前坐标偏移量
 * @returns {{x: number, y: number}} 当前偏移量
 */
export function getCoordinateOffset() {
    return { ...globalCoordinateOffset };
}

/**
 * 应用偏移量到接收的坐标（加法）
 * 用于处理从车端接收的坐标
 * @param {number} x - 原始X坐标（车辆坐标系）
 * @param {number} y - 原始Y坐标（车辆坐标系）
 * @returns {{x: number, y: number}} 应用偏移后的坐标
 */
export function applyOffsetToReceived(x, y) {
    return {
        x: x + globalCoordinateOffset.x,
        y: y + globalCoordinateOffset.y
    };
}

/**
 * 应用偏移量到发送的坐标（减法）
 * 用于处理发送给车端的坐标
 * @param {number} x - 原始X坐标（车辆坐标系）
 * @param {number} y - 原始Y坐标（车辆坐标系）
 * @returns {{x: number, y: number}} 应用偏移后的坐标
 */
export function applyOffsetToSend(x, y) {
    return {
        x: x - globalCoordinateOffset.x,
        y: y - globalCoordinateOffset.y
    };
}

// ============ 坐标转换函数 ============

/**
 * 将车辆坐标系转换为模型坐标系
 * @param {number} vehicleX - 车辆X坐标（0-6.0m）
 * @param {number} vehicleY - 车辆Y坐标（0-5.0m）
 * @returns {{x: number, z: number}} 模型坐标系的 {x, z}
 */
export function vehicleToModelCoordinates(vehicleX, vehicleY) {
    // 🚀 生产环境优化：简化验证，避免性能开销
    // 只在开发环境进行详细验证
    if (import.meta.env.DEV) {
        // 参数验证（健壮性优化）
        if (typeof vehicleX !== 'number' || typeof vehicleY !== 'number') {
            console.error('❌ 坐标转换参数必须为数字:', { vehicleX, vehicleY });
            return { x: 0, z: 0 };
        }
        
        if (isNaN(vehicleX) || isNaN(vehicleY)) {
            console.error('❌ 坐标转换参数不能为NaN:', { vehicleX, vehicleY });
            return { x: 0, z: 0 };
        }
        
        // 边界检查（警告但不阻止）
        if (vehicleX < -0.1 || vehicleX > SANDBOX_DIMENSIONS.width + 0.1 ||
            vehicleY < -0.1 || vehicleY > SANDBOX_DIMENSIONS.depth + 0.1) {
            console.warn(`⚠️ 车辆坐标超出范围: (${vehicleX.toFixed(3)}, ${vehicleY.toFixed(3)})`);
            console.warn(`   期望范围: X(0-${SANDBOX_DIMENSIONS.width}), Y(0-${SANDBOX_DIMENSIONS.depth})`);
        }
    }
    
    return {
        x: vehicleX - SANDBOX_DIMENSIONS.halfWidth,
        z: SANDBOX_DIMENSIONS.halfDepth - vehicleY
    };
}

/**
 * 车位中心点坐标（模型坐标系，预计算）
 * 注意：必须在 vehicleToModelCoordinates 函数定义之后初始化
 */
export const PARKING_SLOTS_MODEL = {
    1: vehicleToModelCoordinates(PARKING_SLOTS[1].x, PARKING_SLOTS[1].y),
    2: vehicleToModelCoordinates(PARKING_SLOTS[2].x, PARKING_SLOTS[2].y)
};

/**
 * 将模型坐标系转换为车辆坐标系
 * @param {number} modelX - 模型X坐标（-2.405 ~ +2.405）
 * @param {number} modelZ - 模型Z坐标（-1.405 ~ +1.405）
 * @returns {{x: number, y: number}} 车辆坐标系的 {x, y}
 */
export function modelToVehicleCoordinates(modelX, modelZ) {
    // 🚀 生产环境优化：简化验证，避免性能开销
    const vehicleX = modelX + SANDBOX_DIMENSIONS.halfWidth;
    const vehicleY = SANDBOX_DIMENSIONS.halfDepth - modelZ;
    
    // 只在开发环境进行详细验证
    if (import.meta.env.DEV) {
        // 参数验证（健壮性优化）
        if (typeof modelX !== 'number' || typeof modelZ !== 'number') {
            console.error('❌ 坐标转换参数必须为数字:', { modelX, modelZ });
            return { x: 0, y: 0 };
        }
        
        if (isNaN(modelX) || isNaN(modelZ)) {
            console.error('❌ 坐标转换参数不能为NaN:', { modelX, modelZ });
            return { x: 0, y: 0 };
        }
        
        // 验证转换结果是否在合理范围内
        if (vehicleX < -0.1 || vehicleX > SANDBOX_DIMENSIONS.width + 0.1 ||
            vehicleY < -0.1 || vehicleY > SANDBOX_DIMENSIONS.depth + 0.1) {
            console.warn(`⚠️ 坐标转换结果超出范围: 模型坐标(${modelX.toFixed(3)}, ${modelZ.toFixed(3)}) → 车辆坐标(${vehicleX.toFixed(3)}, ${vehicleY.toFixed(3)})`);
            console.warn(`   期望范围: X(0-${SANDBOX_DIMENSIONS.width}), Y(0-${SANDBOX_DIMENSIONS.depth})`);
        }
    }
    
    return { x: vehicleX, y: vehicleY };
}

/**
 * 计算两点之间的欧几里得距离
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @returns {number} 距离
 */
export function calculateDistance(x1, y1, x2, y2) {
    // 🚀 生产环境优化：快速计算，跳过验证
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 查找离指定点最近的空闲车位
 * @param {number} modelX - 点击位置的模型X坐标
 * @param {number} modelZ - 点击位置的模型Z坐标
 * @param {Function} isSlotOccupied - 检查车位是否被占用的函数 (slotId) => boolean
 * @returns {{slotId: number, distance: number} | null} 最近的空闲车位，或null（如果都被占用）
 */
export function findNearestFreeSlot(modelX, modelZ, isSlotOccupied) {
    console.log(`🔍 查找最近车位 - 点击位置: (${modelX.toFixed(3)}, ${modelZ.toFixed(3)})`);
    console.log('📍 车位坐标（模型系）:', PARKING_SLOTS_MODEL);
    
    const slots = [];
    
    // 遍历所有车位
    for (const [slotId, modelCoords] of Object.entries(PARKING_SLOTS_MODEL)) {
        const id = Number(slotId);
        
        console.log(`   检查车位${id}: (${modelCoords.x.toFixed(3)}, ${modelCoords.z.toFixed(3)})`);
        
        // 检查是否被占用
        if (isSlotOccupied(id)) {
            console.log(`   ❌ 车位${id}已被占用`);
            continue;
        }
        
        // 计算距离
        const distance = calculateDistance(modelX, modelZ, modelCoords.x, modelCoords.z);
        console.log(`   ✅ 车位${id}空闲，距离: ${distance.toFixed(3)}m`);
        slots.push({ slotId: id, distance, coords: modelCoords });
    }
    
    // 如果没有空闲车位
    if (slots.length === 0) {
        console.log('❌ 没有空闲车位');
        return null;
    }
    
    // 按距离排序，返回最近的
    slots.sort((a, b) => a.distance - b.distance);
    console.log(`✅ 找到最近的空闲车位: ${slots[0].slotId}号，距离: ${slots[0].distance.toFixed(3)}m`);
    return slots[0];
}

/**
 * 验证坐标是否在沙盘范围内（车辆坐标系）
 * @param {number} vehicleX 
 * @param {number} vehicleY 
 * @returns {boolean}
 */
export function isWithinBounds(vehicleX, vehicleY) {
    return vehicleX >= 0 && vehicleX <= SANDBOX_DIMENSIONS.width &&
           vehicleY >= 0 && vehicleY <= SANDBOX_DIMENSIONS.depth;
}

/**
 * 将车辆坐标转换为地图图片上的百分比位置
 * 用于在地图上显示车辆的位置点
 * @param {number} vehicleX - 车辆X坐标（0-6.0m）
 * @param {number} vehicleY - 车辆Y坐标（0-5.0m）
 * @returns {{x: number, y: number}} 百分比位置 {x: 0-100, y: 0-100}
 */
export function vehicleToMapPercent(vehicleX, vehicleY) {
    // 🚀 生产环境优化：快速转换，跳过验证
    // 转换为百分比
    // X轴：0m -> 0%, 6.0m -> 100%
    // Y轴：0m -> 100% (底部), 5.0m -> 0% (顶部) - 注意Y轴方向相反
    const xPercent = (vehicleX / SANDBOX_DIMENSIONS.width) * 100;
    const yPercent = 100 - (vehicleY / SANDBOX_DIMENSIONS.depth) * 100;
    
    return {
        x: xPercent,
        y: yPercent
    };
}

/**
 * 获取所有车位信息（用于调试）
 * @returns {Array<{id: number, vehicle: {x, y}, model: {x, z}}>}
 */
export function getAllParkingSlots() {
    return Object.keys(PARKING_SLOTS).map(id => ({
        id: Number(id),
        vehicle: PARKING_SLOTS[id],
        model: PARKING_SLOTS_MODEL[id]
    }));
}

// ============ 日志输出（初始化时） ============
console.log('📐 坐标转换工具已加载');
console.log('沙盘尺寸（米）:', SANDBOX_DIMENSIONS.width, 'x', SANDBOX_DIMENSIONS.depth);
console.log('车位坐标（车辆坐标系）:', PARKING_SLOTS);
console.log('车位坐标（模型坐标系）:', PARKING_SLOTS_MODEL);

// 验证车位坐标转换
console.log('🔍 验证车位坐标转换:');
for (const [id, vehicleCoords] of Object.entries(PARKING_SLOTS)) {
    const modelCoords = PARKING_SLOTS_MODEL[id];
    console.log(`  车位${id}:`);
    console.log(`    车辆坐标: X=${vehicleCoords.x.toFixed(5)}m, Y=${vehicleCoords.y.toFixed(5)}m`);
    console.log(`    模型坐标: X=${modelCoords.x.toFixed(5)}m, Z=${modelCoords.z.toFixed(5)}m`);
}

