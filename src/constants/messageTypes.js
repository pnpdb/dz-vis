/**
 * Socket消息类型常量定义
 */

// 接收消息类型 (从客户端接收)
export const RECEIVE_MESSAGE_TYPES = {
    HEARTBEAT: 0x0001,           // 心跳包
    VEHICLE_STATUS: 0x0002,      // 车辆状态信息
    SENSOR_DATA: 0x0003,         // 传感器数据
    GPS_LOCATION: 0x0004,        // GPS位置信息
    CAMERA_STREAM: 0x0005,       // 摄像头数据流
    ERROR_REPORT: 0x0006,        // 错误报告
    SYSTEM_INFO: 0x0007,         // 系统信息
    BATTERY_STATUS: 0x0008,      // 电池状态
    SPEED_DATA: 0x0009,          // 速度数据
    TEMPERATURE: 0x000A,         // 温度数据
};

// 发送消息类型 (发送给客户端)
export const SEND_MESSAGE_TYPES = {
    CONTROL_COMMAND: 0x1001,     // 控制指令
    START_VEHICLE: 0x1002,       // 启动车辆
    STOP_VEHICLE: 0x1003,        // 停止车辆
    SET_SPEED: 0x1004,           // 设置速度
    EMERGENCY_BRAKE: 0x1005,     // 紧急制动
    SET_DIRECTION: 0x1006,       // 设置方向
    REQUEST_STATUS: 0x1007,      // 请求状态
    CONFIG_UPDATE: 0x1008,       // 配置更新
    SYSTEM_RESET: 0x1009,        // 系统重置
    CAMERA_CONTROL: 0x100A,      // 摄像头控制
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
    PROTOCOL_CONSTANTS,
    MessageTypeUtils
};
