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
 * 沙盘模型逻辑尺寸（单位：米，客户端坐标系统）
 * 这些是固定的逻辑尺寸，不会改变
 */
export const LOGICAL_DIMENSIONS = {
    width: 6.0,   // X轴总宽度（米）
    depth: 5.0    // Z轴总深度（米）
};

/**
 * 动态沙盘尺寸（从实际模型包围盒计算）
 * 这些值会在沙盘模型加载后动态更新
 */
let dynamicSandboxBounds = {
    minX: -3.0,   // 初始值（会被更新）
    maxX: 3.0,
    minY: 0,      // Y轴（高度）
    maxY: 0,
    minZ: -2.5,
    maxZ: 2.5,
    centerX: 0,
    centerZ: 0,
    width: 6.0,
    height: 0,
    depth: 5.0,
    scale: 1.0    // 沙盘模型的缩放比例
};

/**
 * 为了向后兼容，保留 SANDBOX_DIMENSIONS
 * @deprecated 请使用 LOGICAL_DIMENSIONS
 */
export const SANDBOX_DIMENSIONS = LOGICAL_DIMENSIONS;

/**
 * 更新沙盘动态包围盒（从实际模型计算）
 * 应该使用整个沙盘模型（包括底座）的包围盒
 * @param {Object} bounds - 包围盒信息 {min: {x, z}, max: {x, z}, scale: number}
 */
export function updateSandboxBounds(bounds) {
    const scale = bounds.scale || 1.0;
    
    dynamicSandboxBounds = {
        minX: bounds.min.x,
        maxX: bounds.max.x,
        minY: bounds.min?.y ?? 0,
        maxY: bounds.max?.y ?? 0,
        minZ: bounds.min.z,
        maxZ: bounds.max.z,
        centerX: (bounds.min.x + bounds.max.x) / 2,
        centerZ: (bounds.min.z + bounds.max.z) / 2,
        width: bounds.max.x - bounds.min.x,
        height: (bounds.max?.y ?? 0) - (bounds.min?.y ?? 0),
        depth: bounds.max.z - bounds.min.z,
        scale: scale
    };
    
    console.log('📐 坐标转换包围盒已更新:');
    console.log(`  局部坐标范围:`);
    console.log(`    X: ${dynamicSandboxBounds.minX.toFixed(3)} ~ ${dynamicSandboxBounds.maxX.toFixed(3)} (宽度: ${dynamicSandboxBounds.width.toFixed(3)})`);
    console.log(`    Y: ${dynamicSandboxBounds.minY.toFixed(3)} ~ ${dynamicSandboxBounds.maxY.toFixed(3)} (高度: ${dynamicSandboxBounds.height.toFixed(3)})`);
    console.log(`    Z: ${dynamicSandboxBounds.minZ.toFixed(3)} ~ ${dynamicSandboxBounds.maxZ.toFixed(3)} (深度: ${dynamicSandboxBounds.depth.toFixed(3)})`);
    console.log(`  沙盘缩放比例: ${dynamicSandboxBounds.scale}x`);
    console.log(`  沙盘局部坐标范围 (原始尺寸):`);
    console.log(`    X: ${(dynamicSandboxBounds.minX / dynamicSandboxBounds.scale).toFixed(3)} ~ ${(dynamicSandboxBounds.maxX / dynamicSandboxBounds.scale).toFixed(3)}`);
    console.log(`    Z: ${(dynamicSandboxBounds.minZ / dynamicSandboxBounds.scale).toFixed(3)} ~ ${(dynamicSandboxBounds.maxZ / dynamicSandboxBounds.scale).toFixed(3)}`);
    console.log(`  中心点: (${dynamicSandboxBounds.centerX.toFixed(3)}, ${dynamicSandboxBounds.centerZ.toFixed(3)})`);
    console.log(`  长宽比: ${(dynamicSandboxBounds.width / dynamicSandboxBounds.depth).toFixed(3)} (应该接近1.2)`);
    
    // 测试坐标映射（手动计算）
    console.log('🧪 测试坐标映射 (客户端 → 世界 → 局部):');
    const localMinX = dynamicSandboxBounds.minX / dynamicSandboxBounds.scale;
    const localMaxX = dynamicSandboxBounds.maxX / dynamicSandboxBounds.scale;
    const localMinZ = dynamicSandboxBounds.minZ / dynamicSandboxBounds.scale;
    const localMaxZ = dynamicSandboxBounds.maxZ / dynamicSandboxBounds.scale;
    console.log(`  客户端(0,0) 应该映射到局部左下角: (${localMinX.toFixed(3)}, ${localMaxZ.toFixed(3)})`);
    console.log(`  客户端(6,0) 应该映射到局部右下角: (${localMaxX.toFixed(3)}, ${localMaxZ.toFixed(3)})`);
    console.log(`  客户端(0,5) 应该映射到局部左上角: (${localMinX.toFixed(3)}, ${localMinZ.toFixed(3)})`);
    console.log(`  客户端(6,5) 应该映射到局部右上角: (${localMaxX.toFixed(3)}, ${localMinZ.toFixed(3)})`);
}

/**
 * 获取当前沙盘包围盒
 * @returns {Object} 当前包围盒信息
 */
export function getSandboxBounds() {
    return { ...dynamicSandboxBounds };
}

/**
 * 车位中心点坐标（单位：米）
 */
export const PARKING_SLOTS = {
    1: { x: 4.627, y: 1.331 },  // 1号车位
    2: { x: 3.948, y: 1.331 }   // 2号车位
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
    console.info(`[坐标偏移] 已设置: X=${globalCoordinateOffset.x}m, Y=${globalCoordinateOffset.y}m`);
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
    // 生产环境优化：简化验证，避免性能开销
    // 只在开发环境进行详细验证
    if (import.meta.env.DEV) {
        // 参数验证（健壮性优化）
        if (typeof vehicleX !== 'number' || typeof vehicleY !== 'number') {
            console.error('坐标转换参数必须为数字:', { vehicleX, vehicleY });
            return { x: 0, z: 0 };
        }
        
        if (isNaN(vehicleX) || isNaN(vehicleY)) {
            console.error('坐标转换参数不能为NaN:', { vehicleX, vehicleY });
            return { x: 0, z: 0 };
        }
        
        // 边界检查（警告但不阻止）
        if (vehicleX < -0.1 || vehicleX > LOGICAL_DIMENSIONS.width + 0.1 ||
            vehicleY < -0.1 || vehicleY > LOGICAL_DIMENSIONS.depth + 0.1) {
            console.warn(`车辆坐标超出范围: (${vehicleX.toFixed(3)}, ${vehicleY.toFixed(3)})`);
            console.warn(`   期望范围: X(0-${LOGICAL_DIMENSIONS.width}), Y(0-${LOGICAL_DIMENSIONS.depth})`);
        }
    }
    
    // 先限制客户端坐标在有效范围内，防止超出沙盘边界
    const clampedX = Math.max(0, Math.min(LOGICAL_DIMENSIONS.width, vehicleX));
    const clampedY = Math.max(0, Math.min(LOGICAL_DIMENSIONS.depth, vehicleY));
    
    // 使用动态包围盒进行转换
    // 将客户端坐标 (0→6, 0→5) 线性映射到模型包围盒范围（世界坐标）
    const worldX = dynamicSandboxBounds.minX + (clampedX / LOGICAL_DIMENSIONS.width) * dynamicSandboxBounds.width;
    const worldZ = dynamicSandboxBounds.maxZ - (clampedY / LOGICAL_DIMENSIONS.depth) * dynamicSandboxBounds.depth;
    
    // 重要：由于车辆是作为沙盘模型的子对象添加的，需要转换为沙盘的局部坐标
    // 沙盘模型有缩放（6x），所以需要除以缩放比例
    const localX = worldX / dynamicSandboxBounds.scale;
    const localZ = worldZ / dynamicSandboxBounds.scale;
    
    // 开发环境下输出详细的转换信息（每5秒最多输出一次，避免刷屏）
    if (import.meta.env.DEV) {
        const now = Date.now();
        if (!vehicleToModelCoordinates._lastLog || now - vehicleToModelCoordinates._lastLog > 5000) {
            const clamped = (clampedX !== vehicleX || clampedY !== vehicleY);
            console.log(`坐标转换${clamped ? ' (已限制到边界内)' : ''}:`);
            console.log(`   客户端(${vehicleX.toFixed(3)}, ${vehicleY.toFixed(3)})${clamped ? ` → 限制后(${clampedX.toFixed(3)}, ${clampedY.toFixed(3)})` : ''}`);
            console.log(`   → 世界坐标(${worldX.toFixed(3)}, ${worldZ.toFixed(3)})`);
            console.log(`   → 沙盘局部坐标(${localX.toFixed(3)}, ${localZ.toFixed(3)})`);
            console.log(`   📦 沙盘局部边界: X[-3.0 ~ 3.0], Z[-2.5 ~ 2.5]`);
            vehicleToModelCoordinates._lastLog = now;
        }
    }
    
    return { x: localX, z: localZ };
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
 * @param {number} localX - 沙盘局部坐标 X
 * @param {number} localZ - 沙盘局部坐标 Z
 * @returns {{x: number, y: number}} 车辆坐标系的 {x, y}
 */
export function modelToVehicleCoordinates(localX, localZ) {
    // 参数验证（只在开发环境）
    if (import.meta.env.DEV) {
        if (typeof localX !== 'number' || typeof localZ !== 'number') {
            console.error('坐标转换参数必须为数字:', { localX, localZ });
            return { x: 0, y: 0 };
        }
        
        if (isNaN(localX) || isNaN(localZ)) {
            console.error('坐标转换参数不能为NaN:', { localX, localZ });
            return { x: 0, y: 0 };
        }
    }
    
    // 先将局部坐标转换为世界坐标（乘以缩放比例）
    const worldX = localX * dynamicSandboxBounds.scale;
    const worldZ = localZ * dynamicSandboxBounds.scale;
    
    // 使用动态包围盒进行反向转换
    // 将世界坐标线性映射回客户端坐标 (0→6, 0→5)
    const vehicleX = ((worldX - dynamicSandboxBounds.minX) / dynamicSandboxBounds.width) * LOGICAL_DIMENSIONS.width;
    const vehicleY = ((dynamicSandboxBounds.maxZ - worldZ) / dynamicSandboxBounds.depth) * LOGICAL_DIMENSIONS.depth;
    
    // 只在开发环境进行详细验证
    if (import.meta.env.DEV) {
        // 验证转换结果是否在合理范围内
        if (vehicleX < -0.1 || vehicleX > LOGICAL_DIMENSIONS.width + 0.1 ||
            vehicleY < -0.1 || vehicleY > LOGICAL_DIMENSIONS.depth + 0.1) {
            console.warn(`坐标转换结果超出范围: 模型坐标(${modelX.toFixed(3)}, ${modelZ.toFixed(3)}) → 车辆坐标(${vehicleX.toFixed(3)}, ${vehicleY.toFixed(3)})`);
            console.warn(`   期望范围: X(0-${LOGICAL_DIMENSIONS.width}), Y(0-${LOGICAL_DIMENSIONS.depth})`);
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
    // 生产环境优化：快速计算，跳过验证
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
    console.log('车位坐标（模型系）:', PARKING_SLOTS_MODEL);
    
    const slots = [];
    
    // 遍历所有车位
    for (const [slotId, modelCoords] of Object.entries(PARKING_SLOTS_MODEL)) {
        const id = Number(slotId);
        
        console.log(`   检查车位${id}: (${modelCoords.x.toFixed(3)}, ${modelCoords.z.toFixed(3)})`);
        
        // 检查是否被占用
        if (isSlotOccupied(id)) {
            console.log(`   车位${id}已被占用`);
            continue;
        }
        
        // 计算距离
        const distance = calculateDistance(modelX, modelZ, modelCoords.x, modelCoords.z);
        console.log(`   车位${id}空闲，距离: ${distance.toFixed(3)}m`);
        slots.push({ slotId: id, distance, coords: modelCoords });
    }
    
    // 如果没有空闲车位
    if (slots.length === 0) {
        console.log('没有空闲车位');
        return null;
    }
    
    // 按距离排序，返回最近的
    slots.sort((a, b) => a.distance - b.distance);
    console.log(`找到最近的空闲车位: ${slots[0].slotId}号，距离: ${slots[0].distance.toFixed(3)}m`);
    return slots[0];
}

/**
 * 验证坐标是否在沙盘范围内（车辆坐标系）
 * @param {number} vehicleX 
 * @param {number} vehicleY 
 * @returns {boolean}
 */
export function isWithinBounds(vehicleX, vehicleY) {
    return vehicleX >= 0 && vehicleX <= LOGICAL_DIMENSIONS.width &&
           vehicleY >= 0 && vehicleY <= LOGICAL_DIMENSIONS.depth;
}

/**
 * 将车辆坐标转换为地图图片上的百分比位置
 * 用于在地图上显示车辆的位置点
 * @param {number} vehicleX - 车辆X坐标（0-6.0m）
 * @param {number} vehicleY - 车辆Y坐标（0-5.0m）
 * @returns {{x: number, y: number}} 百分比位置 {x: 0-100, y: 0-100}
 */
export function vehicleToMapPercent(vehicleX, vehicleY) {
    // 生产环境优化：快速转换，跳过验证
    // 转换为百分比
    // X轴：0m -> 0%, 6.0m -> 100%
    // Y轴：0m -> 100% (底部), 5.0m -> 0% (顶部) - 注意Y轴方向相反
    const xPercent = (vehicleX / LOGICAL_DIMENSIONS.width) * 100;
    const yPercent = 100 - (vehicleY / LOGICAL_DIMENSIONS.depth) * 100;
    
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
console.log('逻辑尺寸（米）:', LOGICAL_DIMENSIONS.width, 'x', LOGICAL_DIMENSIONS.depth);
console.log('动态包围盒（初始值）:', dynamicSandboxBounds);
console.log('注意：实际包围盒将在沙盘模型加载后动态更新');
console.log('车位坐标（车辆坐标系）:', PARKING_SLOTS);
console.log('车位坐标（模型坐标系，初始值）:', PARKING_SLOTS_MODEL);

// 验证车位坐标转换
console.log('🔍 验证车位坐标转换（基于初始包围盒）:');
for (const [id, vehicleCoords] of Object.entries(PARKING_SLOTS)) {
    const modelCoords = PARKING_SLOTS_MODEL[id];
    console.log(`  车位${id}:`);
    console.log(`    车辆坐标: X=${vehicleCoords.x.toFixed(5)}m, Y=${vehicleCoords.y.toFixed(5)}m`);
    console.log(`    模型坐标: X=${modelCoords.x.toFixed(5)}m, Z=${modelCoords.z.toFixed(5)}m`);
}

