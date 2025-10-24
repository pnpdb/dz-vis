/**
 * 通用验证工具
 * 提取重复的验证逻辑，提高代码复用性
 */

/**
 * 验证车辆ID是否有效
 * @param {*} vehicleId - 车辆ID
 * @returns {{valid: boolean, error?: string}}
 */
export function validateVehicleId(vehicleId) {
    if (vehicleId === null || vehicleId === undefined) {
        return { valid: false, error: '车辆ID不能为空' };
    }
    
    if (typeof vehicleId !== 'number' && typeof vehicleId !== 'string') {
        return { valid: false, error: '车辆ID必须为数字或字符串' };
    }
    
    return { valid: true };
}

/**
 * 验证位置坐标是否有效
 * @param {*} position - 位置对象
 * @param {string} coordinateSystem - 坐标系类型 'model' | 'vehicle'
 * @returns {{valid: boolean, error?: string}}
 */
export function validatePosition(position, coordinateSystem = 'model') {
    if (!position || typeof position !== 'object') {
        return { valid: false, error: '位置参数无效' };
    }
    
    // 模型坐标系使用 {x, z}
    if (coordinateSystem === 'model') {
        if (typeof position.x !== 'number' || typeof position.z !== 'number') {
            return { valid: false, error: '位置坐标必须为数字 (x, z)' };
        }
        
        if (isNaN(position.x) || isNaN(position.z)) {
            return { valid: false, error: '位置坐标不能为NaN' };
        }
    }
    
    // 车辆坐标系使用 {x, y}
    if (coordinateSystem === 'vehicle') {
        if (typeof position.x !== 'number' || typeof position.y !== 'number') {
            return { valid: false, error: '位置坐标必须为数字 (x, y)' };
        }
        
        if (isNaN(position.x) || isNaN(position.y)) {
            return { valid: false, error: '位置坐标不能为NaN' };
        }
    }
    
    return { valid: true };
}

/**
 * 验证朝向角度是否有效
 * @param {*} orientation - 朝向角度（弧度）
 * @returns {{valid: boolean, error?: string}}
 */
export function validateOrientation(orientation) {
    if (orientation === null || orientation === undefined) {
        return { valid: true }; // 朝向可选
    }
    
    if (typeof orientation !== 'number') {
        return { valid: false, error: '朝向角度必须为数字' };
    }
    
    if (isNaN(orientation)) {
        return { valid: false, error: '朝向角度不能为NaN' };
    }
    
    // 朝向角度应该在 -π 到 π 范围内（可以给出警告但不阻止）
    if (orientation < -Math.PI || orientation > Math.PI) {
        console.warn(`⚠️ 朝向角度超出推荐范围 [-π, π]: ${orientation.toFixed(3)}`);
    }
    
    return { valid: true };
}

/**
 * 验证数字参数
 * @param {*} value - 要验证的值
 * @param {string} name - 参数名称
 * @param {Object} options - 验证选项
 * @param {number} options.min - 最小值
 * @param {number} options.max - 最大值
 * @param {boolean} options.allowNull - 是否允许null
 * @returns {{valid: boolean, error?: string}}
 */
export function validateNumber(value, name, options = {}) {
    const { min, max, allowNull = false } = options;
    
    if (value === null || value === undefined) {
        if (allowNull) {
            return { valid: true };
        }
        return { valid: false, error: `${name}不能为空` };
    }
    
    if (typeof value !== 'number') {
        return { valid: false, error: `${name}必须为数字` };
    }
    
    if (isNaN(value)) {
        return { valid: false, error: `${name}不能为NaN` };
    }
    
    if (min !== undefined && value < min) {
        return { valid: false, error: `${name}不能小于${min}` };
    }
    
    if (max !== undefined && value > max) {
        return { valid: false, error: `${name}不能大于${max}` };
    }
    
    return { valid: true };
}

/**
 * 验证车辆状态对象
 * @param {*} vehicleInfo - 车辆信息对象
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateVehicleInfo(vehicleInfo) {
    const errors = [];
    
    if (!vehicleInfo || typeof vehicleInfo !== 'object') {
        return { valid: false, errors: ['车辆信息对象无效'] };
    }
    
    // 验证必需字段
    if (vehicleInfo.position) {
        const posResult = validatePosition(vehicleInfo.position, 'vehicle');
        if (!posResult.valid) {
            errors.push(`位置: ${posResult.error}`);
        }
    }
    
    if (vehicleInfo.orientation !== undefined) {
        const oriResult = validateOrientation(vehicleInfo.orientation);
        if (!oriResult.valid) {
            errors.push(`朝向: ${oriResult.error}`);
        }
    }
    
    // 验证可选数值字段
    const numericFields = [
        { key: 'speed', name: '速度', min: 0 },
        { key: 'battery', name: '电量', min: 0, max: 100 },
        { key: 'steeringAngle', name: '方向盘转角', min: -540, max: 540 }
    ];
    
    for (const field of numericFields) {
        if (vehicleInfo[field.key] !== undefined) {
            const result = validateNumber(
                vehicleInfo[field.key],
                field.name,
                { min: field.min, max: field.max, allowNull: true }
            );
            if (!result.valid) {
                errors.push(result.error);
            }
        }
    }
    
    return { valid: errors.length === 0, errors };
}

/**
 * 验证批量参数（用于批量操作）
 * @param {Array} items - 要验证的项目数组
 * @param {Function} validator - 验证器函数
 * @returns {{valid: boolean, errors: Array}}
 */
export function validateBatch(items, validator) {
    if (!Array.isArray(items)) {
        return { valid: false, errors: ['输入必须为数组'] };
    }
    
    const errors = [];
    
    items.forEach((item, index) => {
        const result = validator(item);
        if (!result.valid) {
            errors.push({
                index,
                item,
                error: result.error || result.errors
            });
        }
    });
    
    return {
        valid: errors.length === 0,
        errors,
        validCount: items.length - errors.length,
        totalCount: items.length
    };
}
