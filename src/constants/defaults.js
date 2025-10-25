/**
 * 默认值常量
 * 包含各种默认配置、初始值
 */

export const DEFAULTS = {
    // ========== ElementPlus 组件 ==========
    MESSAGE_OFFSET: 50,                // 消息提示偏移量（为标题栏留空）
    NOTIFICATION_OFFSET: 50,           // 通知偏移量
    
    // ========== 网络 ==========
    SOCKET_PORT: 8888,                 // Socket服务器默认端口
    VIDEO_PORT: 8889,                  // 视频服务器默认端口
    
    // ========== 车辆 ==========
    DEFAULT_VEHICLE_ID: 1,             // 默认车辆ID
    DEFAULT_PARKING_SPOT: 1,           // 默认停车位
    
    // ========== 坐标 ==========
    DEFAULT_START_X: 116.4,            // 默认起点X
    DEFAULT_START_Y: 39.9,             // 默认起点Y
    DEFAULT_END_X: 118.5,              // 默认终点X
    DEFAULT_END_Y: 41.2,               // 默认终点Y
};

export default DEFAULTS;

