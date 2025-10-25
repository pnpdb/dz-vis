/**
 * 验证规则常量
 * 包含各种数据验证的范围和规则
 */

export const VALIDATION_RANGES = {
    // ========== 车辆参数 ==========
    VEHICLE_ID: { min: 1, max: 255 },
    SPEED: { min: 0, max: 10 },        // m/s
    BATTERY: { min: 0, max: 100 },     // %
    STEERING_ANGLE: { min: -180, max: 180 }, // 度
    
    // ========== 网络 ==========
    PORT: { min: 1, max: 65535 },
    
    // ========== 字符串长度 ==========
    VEHICLE_NAME: { min: 1, max: 50 },
    IP_ADDRESS: { min: 7, max: 15 },   // "0.0.0.0" ~ "255.255.255.255"
};

export default VALIDATION_RANGES;

