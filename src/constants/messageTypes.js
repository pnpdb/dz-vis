/**
 * Socket消息类型常量定义
 */

// 接收消息类型 (从客户端接收)
export const RECEIVE_MESSAGE_TYPES = {
    HEARTBEAT: 0x0001,           // 心跳包
    VEHICLE_INFO: 0x0002,        // 车辆信息协议（车辆编号+速度+位置+电量+传感器状态）
};

// 发送消息类型 (发送给客户端)
export const SEND_MESSAGE_TYPES = {
    // 预留给后续指令协议，从0x1001开始递增
};

// 车辆信息协议数据域定义 (37字节)
export const VEHICLE_INFO_PROTOCOL = {
    VEHICLE_ID_OFFSET: 0,        // 车辆编号偏移 (1字节)
    SPEED_OFFSET: 1,             // 车速偏移 (8字节, DOUBLE)
    POSITION_X_OFFSET: 9,        // 位置X偏移 (8字节, DOUBLE)
    POSITION_Y_OFFSET: 17,       // 位置Y偏移 (8字节, DOUBLE)
    BATTERY_OFFSET: 25,          // 电池电量偏移 (8字节, DOUBLE)
    NAV_STATUS_OFFSET: 33,       // 导航状态偏移 (1字节)
    CAMERA_STATUS_OFFSET: 34,    // 相机状态偏移 (1字节)
    LIDAR_STATUS_OFFSET: 35,     // 激光雷达状态偏移 (1字节)
    GYRO_STATUS_OFFSET: 36,      // 陀螺仪状态偏移 (1字节)
    BEIDOU_STATUS_OFFSET: 37,    // 北斗状态偏移 (1字节)
    TOTAL_SIZE: 38,              // 总大小 38字节
    
    // 状态值定义
    STATUS_ABNORMAL: 0,          // 异常/未导航
    STATUS_NORMAL: 1,            // 正常/导航中
    
    // 车速范围 (0-1 m/s)
    MIN_SPEED: 0.0,
    MAX_SPEED: 1.0
};

// 协议常量
export const PROTOCOL_CONSTANTS = {
    HEADER: [0xEF, 0xEF, 0xEF, 0xEF],        // 帧头
    FOOTER: [0xFE, 0xFE, 0xFE, 0xFE],        // 帧尾
    VERSION: 0x10,                           // 协议版本 1.0
    HEADER_SIZE: 4,                          // 帧头大小
    VERSION_SIZE: 1,                         // 版本大小
    TIMESTAMP_SIZE: 8,                       // 时间戳大小
    MESSAGE_TYPE_SIZE: 2,                    // 消息类型大小
    DATA_LENGTH_SIZE: 4,                     // 数据长度大小
    CRC_SIZE: 2,                            // CRC大小
    FOOTER_SIZE: 4,                         // 帧尾大小
    MIN_PACKET_SIZE: 25,                    // 最小数据包大小(不含数据域)
};

// 消息类型转换工具
export const MessageTypeUtils = {
    /**
     * 获取接收消息类型名称
     */
    getReceiveTypeName(type) {
        const entry = Object.entries(RECEIVE_MESSAGE_TYPES).find(([_, value]) => value === type);
        return entry ? entry[0] : `UNKNOWN_RECEIVE_${type.toString(16).toUpperCase()}`;
    },

    /**
     * 获取发送消息类型名称
     */
    getSendTypeName(type) {
        const entry = Object.entries(SEND_MESSAGE_TYPES).find(([_, value]) => value === type);
        return entry ? entry[0] : `UNKNOWN_SEND_${type.toString(16).toUpperCase()}`;
    },

    /**
     * 检查是否为有效的接收消息类型
     */
    isValidReceiveType(type) {
        return Object.values(RECEIVE_MESSAGE_TYPES).includes(type);
    },

    /**
     * 检查是否为有效的发送消息类型
     */
    isValidSendType(type) {
        return Object.values(SEND_MESSAGE_TYPES).includes(type);
    }
};

export default {
    RECEIVE_MESSAGE_TYPES,
    SEND_MESSAGE_TYPES,
    VEHICLE_INFO_PROTOCOL,
    PROTOCOL_CONSTANTS,
    MessageTypeUtils
};
