/**
 * 数据限制常量
 * 包含各种数据大小、数量限制
 */

export const LIMITS = {
    // ========== 日志 ==========
    LOG_MESSAGE_MAX_LENGTH: 4000,      // 单条日志最大长度
    LOG_BUFFER_SIZE: 1000,             // 日志缓冲区大小
    
    // ========== 视频 ==========
    VIDEO_FPS_HISTORY: 60,             // 视频FPS历史记录数量
    MAX_VIDEO_FRAME_SIZE: 10 * 1024 * 1024, // 最大视频帧大小（10MB）
    
    // ========== 车辆 ==========
    MAX_VEHICLE_COUNT: 255,            // 最大车辆数量
    MAX_VEHICLE_NAME_LENGTH: 50,       // 车辆名称最大长度
    
    // ========== 批量操作 ==========
    MAX_BATCH_SIZE: 100,               // 最大批量操作数量
    BATCH_THROTTLE_TIME: 100,          // 批量操作节流时间（ms）
    
    // ========== 缓存 ==========
    STATE_CACHE_SIZE: 100,             // 状态缓存大小
    TEXTURE_CACHE_SIZE: 50,            // 纹理缓存大小
};

export default LIMITS;

