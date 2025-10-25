/**
 * 性能相关常量
 * 包含性能优化、帧率、精度等配置
 */

export const PERFORMANCE = {
    // ========== 浮点精度 ==========
    FLOAT_EPSILON: 1e-6,               // 浮点数比较精度
    
    // ========== 帧率目标 ==========
    TARGET_FPS: 60,                    // 目标帧率
    MIN_FRAME_TIME: 16.67,             // 最小帧时间（ms），对应60FPS
};

export default PERFORMANCE;

