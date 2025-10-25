/**
 * 时间相关常量
 * 包含超时、间隔、节流、防抖等时间配置
 */

export const TIMING = {
    // ========== 应用初始化 ==========
    APP_INIT_DELAY: 1000,              // 应用初始化延迟（ms）
    SOCKET_START_DELAY: 2000,          // Socket服务器启动延迟（ms）
    
    // ========== 事件节流/防抖 ==========
    VEHICLE_INFO_THROTTLE: 50,         // 车辆信息更新节流（ms）
    CONNECTION_STATUS_THROTTLE: 100,   // 连接状态节流（ms）
    ONLINE_COUNT_THROTTLE: 200,        // 在线数量统计节流（ms）
    VIDEO_FPS_THROTTLE: 500,           // 视频FPS更新节流（ms）
    CAMERA_TOGGLE_DEBOUNCE: 50,        // 摄像头切换防抖（ms）
    LOG_THROTTLE_INTERVAL: 500,        // 日志节流间隔（ms）
    
    // ========== 超时设置 ==========
    NETWORK_TIMEOUT: 5000,             // 网络请求超时（ms）
    COMMAND_TIMEOUT: 3000,             // 命令执行超时（ms）
    VIDEO_PROCESSING_TIMEOUT: 10000,   // 视频处理超时（ms）
    PROTOCOL_TIMEOUT: 5000,            // 协议处理超时（ms）
    
    // ========== 定期任务间隔 ==========
    DATA_UPDATE_INTERVAL: 2000,        // 数据更新间隔（ms）
    SERVER_STATUS_INTERVAL: 5000,      // 服务器状态检查间隔（ms）
    VIDEO_CLEANUP_INTERVAL: 5000,      // 视频清理检查间隔（ms）
    STATS_CLEANUP_INTERVAL: 300000,    // 统计数据清理间隔（5分钟，ms）
    
    // ========== 资源加载 ==========
    SECONDARY_PRELOAD_DELAY: 3000,     // 次要资源预加载延迟（ms）
    
    // ========== 性能日志 ==========
    PERF_LOG_THRESHOLD: 10000,         // 性能日志记录阈值（10ms，us）
};

export default TIMING;

