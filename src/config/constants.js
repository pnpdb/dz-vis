/**
 * 应用常量集中管理
 * 避免魔法数字分散在代码中
 */

// ========== 时间相关常量 ==========
export const TIMING = {
    // 应用初始化
    APP_INIT_DELAY: 1000,              // 应用初始化延迟（ms）
    SOCKET_START_DELAY: 2000,          // Socket服务器启动延迟（ms）
    
    // 事件节流/防抖
    VEHICLE_INFO_THROTTLE: 50,         // 车辆信息更新节流（ms）
    CONNECTION_STATUS_THROTTLE: 100,   // 连接状态节流（ms）
    ONLINE_COUNT_THROTTLE: 200,        // 在线数量统计节流（ms）
    VIDEO_FPS_THROTTLE: 500,           // 视频FPS更新节流（ms）
    CAMERA_TOGGLE_DEBOUNCE: 50,        // 摄像头切换防抖（ms）
    
    // 日志节流
    LOG_THROTTLE_INTERVAL: 500,        // 日志节流间隔（ms）
    
    // 超时设置
    NETWORK_TIMEOUT: 5000,             // 网络请求超时（ms）
    COMMAND_TIMEOUT: 3000,             // 命令执行超时（ms）
};

// ========== 数据限制常量 ==========
export const LIMITS = {
    // 日志
    LOG_MESSAGE_MAX_LENGTH: 4000,      // 单条日志最大长度
    LOG_BUFFER_SIZE: 1000,             // 日志缓冲区大小
    
    // 视频
    VIDEO_FPS_HISTORY: 60,             // 视频FPS历史记录数量
    MAX_VIDEO_FRAME_SIZE: 10 * 1024 * 1024, // 最大视频帧大小（10MB）
    
    // 车辆
    MAX_VEHICLE_COUNT: 255,            // 最大车辆数量
    MAX_VEHICLE_NAME_LENGTH: 50,       // 车辆名称最大长度
    
    // 批量操作
    MAX_BATCH_SIZE: 100,               // 最大批量操作数量
    BATCH_THROTTLE_TIME: 100,          // 批量操作节流时间（ms）
};

// ========== 默认值常量 ==========
export const DEFAULTS = {
    // ElementPlus组件
    MESSAGE_OFFSET: 50,                // 消息提示偏移量（为标题栏留空）
    NOTIFICATION_OFFSET: 50,           // 通知偏移量
    
    // 网络
    SOCKET_PORT: 8888,                 // Socket服务器默认端口
    VIDEO_PORT: 8889,                  // 视频服务器默认端口
    
    // 车辆
    DEFAULT_VEHICLE_ID: 1,             // 默认车辆ID
    DEFAULT_PARKING_SPOT: 1,           // 默认停车位
    
    // 坐标
    DEFAULT_START_X: 116.4,            // 默认起点X
    DEFAULT_START_Y: 39.9,             // 默认起点Y
    DEFAULT_END_X: 118.5,              // 默认终点X
    DEFAULT_END_Y: 41.2,               // 默认终点Y
};

// ========== UI常量 ==========
export const UI = {
    // 自定义标题栏
    TITLE_BAR_HEIGHT: 30,              // 标题栏高度（px）
    TITLE_BAR_BG_COLOR: '#181818',     // 标题栏背景色
    TITLE_BAR_FONT_SIZE: 12,           // 标题栏字体大小（px）
    
    // 布局偏移
    FLOATING_HEADER_TOP: 40,           // 浮动头部top偏移（px）
    FLOATING_PANELS_TOP: 40,           // 浮动面板top偏移（px）
    HUD_STATUS_TOP: 40,                // HUD状态top偏移（px）
    
    // 颜色
    PRIMARY_COLOR: '#409EFF',          // 主色调
    SUCCESS_COLOR: '#67C23A',          // 成功色
    WARNING_COLOR: '#E6A23C',          // 警告色
    DANGER_COLOR: '#F56C6C',           // 危险色
    INFO_COLOR: '#909399',             // 信息色
};

// ========== 性能相关常量 ==========
export const PERFORMANCE = {
    // 状态对比精度
    FLOAT_EPSILON: 1e-6,               // 浮点数比较精度
    
    // 帧率目标
    TARGET_FPS: 60,                    // 目标帧率
    MIN_FRAME_TIME: 16.67,             // 最小帧时间（ms），对应60FPS
    
    // 缓存大小
    STATE_CACHE_SIZE: 100,             // 状态缓存大小
    TEXTURE_CACHE_SIZE: 50,            // 纹理缓存大小
};

// ========== 协议相关常量 ==========
export const PROTOCOL = {
    // 帧标识
    HEADER: [0xEF, 0xEF, 0xEF, 0xEF],
    FOOTER: [0xFE, 0xFE, 0xFE, 0xFE],
    VERSION: 0x10,
    
    // 大小限制
    MIN_PACKET_SIZE: 25,               // 最小数据包大小（字节）
    MAX_PACKET_SIZE: 65535,            // 最大数据包大小（字节）
    
    // 超时
    PROTOCOL_TIMEOUT: 5000,            // 协议处理超时（ms）
};

// ========== 验证范围常量 ==========
export const VALIDATION_RANGES = {
    // 车辆参数
    VEHICLE_ID: { min: 1, max: 255 },
    SPEED: { min: 0, max: 10 },        // m/s
    BATTERY: { min: 0, max: 100 },     // %
    STEERING_ANGLE: { min: -180, max: 180 }, // 度
    
    // 网络
    PORT: { min: 1, max: 65535 },
    
    // 字符串长度
    VEHICLE_NAME: { min: 1, max: 50 },
    IP_ADDRESS: { min: 7, max: 15 },   // "0.0.0.0" ~ "255.255.255.255"
};

export default {
    TIMING,
    LIMITS,
    DEFAULTS,
    UI,
    PERFORMANCE,
    PROTOCOL,
    VALIDATION_RANGES,
};

