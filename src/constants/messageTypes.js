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
    VEHICLE_CONTROL: 0x1001,         // 车辆控制指令
    DATA_RECORDING: 0x1002,          // 数据记录控制
    TAXI_ORDER: 0x1003,              // 出租车订单
    AVP_PARKING: 0x1004,             // AVP自主代客泊车
    AVP_PICKUP: 0x1005,              // AVP取车
    VEHICLE_FUNCTION_SETTING: 0x1006, // 车辆功能设置
    VEHICLE_PATH_DISPLAY: 0x1007,    // 车辆路径显示控制
    CONSTRUCTION_MARKER: 0x1008,     // 施工标记
};

// 车辆信息协议数据域定义 (54字节)
export const VEHICLE_INFO_PROTOCOL = {
    VEHICLE_ID_OFFSET: 0,            // 车辆编号偏移 (1字节)
    SPEED_OFFSET: 1,                 // 车速偏移 (8字节, DOUBLE)
    POSITION_X_OFFSET: 9,            // 位置X偏移 (8字节, DOUBLE)
    POSITION_Y_OFFSET: 17,           // 位置Y偏移 (8字节, DOUBLE)
    ORIENTATION_OFFSET: 25,          // 朝向偏移 (8字节, DOUBLE)
    BATTERY_OFFSET: 33,              // 电池电量偏移 (8字节, DOUBLE)
    GEAR_OFFSET: 41,                 // 档位偏移 (1字节, UINT8) 1:P 2:R 3:N 4:D
    STEERING_ANGLE_OFFSET: 42,       // 方向盘转角偏移 (8字节, DOUBLE)
    NAV_STATUS_OFFSET: 50,           // 导航状态偏移 (1字节)
    CAMERA_STATUS_OFFSET: 51,        // 相机状态偏移 (1字节)
    LIDAR_STATUS_OFFSET: 52,         // 激光雷达状态偏移 (1字节)
    GYRO_STATUS_OFFSET: 53,          // 陀螺仪状态偏移 (1字节)
    TOTAL_SIZE: 54,                  // 总大小 54字节
    
    // 车速范围 (0-1 m/s)
    MIN_SPEED: 0.0,
    MAX_SPEED: 1.0
};

export const NAV_STATUS_TEXTS = {
    1: '正常行驶中（空载模式倒车入库）',
    2: '正常行驶中（空载模式不倒车入库）',
    3: '接客模式，去起点接客',
    4: '接客模式，去终点送客',
    5: '去往充电车位',
    6: '充电中',
    7: '去往定车位路上',
    8: '车位停车中',
    9: '到达接客起点',
    10: '到达接客终点',
    11: '正在倒车入库',
    12: '正在出库中',
    13: '正在倒车入库',
    14: '出库完成',
    15: '平行驾驶模式'
};

// 车辆控制协议数据域定义
export const VEHICLE_CONTROL_PROTOCOL = {
    VEHICLE_ID_OFFSET: 0,            // 车辆编号偏移 (1字节)
    CONTROL_COMMAND_OFFSET: 1,       // 控制指令偏移 (1字节)
    POSITION_X_OFFSET: 2,            // 位置X偏移 (8字节, DOUBLE) - 仅当控制指令=4时存在
    POSITION_Y_OFFSET: 10,           // 位置Y偏移 (8字节, DOUBLE) - 仅当控制指令=4时存在
    ORIENTATION_OFFSET: 18,          // 朝向偏移 (8字节, DOUBLE) - 仅当控制指令=4时存在
    
    // 数据大小定义
    BASE_SIZE: 2,                    // 基础大小：车辆编号(1) + 控制指令(1) = 2字节
    POSITION_DATA_SIZE: 24,          // 位置数据大小：位置X(8) + 位置Y(8) + 朝向(8) = 24字节
    TOTAL_SIZE_WITH_POSITION: 26,    // 包含位置信息的总大小 = 2 + 24 = 26字节
    TOTAL_SIZE_WITHOUT_POSITION: 2,  // 不包含位置信息的总大小 = 2字节
    
    // 控制指令类型
    COMMAND_START: 1,                // 启动
    COMMAND_STOP: 2,                 // 停止
    COMMAND_EMERGENCY_BRAKE: 3,      // 紧急制动
    COMMAND_INIT_POSE: 4,            // 初始化位姿（需要位置数据）
    
    // 指令名称映射
    COMMAND_NAMES: {
        1: '启动',
        2: '停止',
        3: '紧急制动',
        4: '初始化位姿'
    }
};

// 数据记录协议数据域定义 (2字节)
export const DATA_RECORDING_PROTOCOL = {
    VEHICLE_ID_OFFSET: 0,            // 车辆编号偏移 (1字节, UINT8)
    RECORDING_STATUS_OFFSET: 1,      // 记录状态偏移 (1字节, UINT8)
    TOTAL_SIZE: 2,                   // 总大小 2字节
    
    // 记录状态值定义
    RECORDING_OFF: 0,                // 关闭记录
    RECORDING_ON: 1,                 // 开启记录
    
    // 状态名称映射
    STATUS_NAMES: {
        0: '关闭',
        1: '开启'
    }
};

// 出租车订单协议数据域定义 (48字节)
export const TAXI_ORDER_PROTOCOL = {
    ORDER_ID_OFFSET: 0,              // 订单号偏移 (16字节, CHAR16)
    START_X_OFFSET: 16,              // 起点X偏移 (8字节, DOUBLE)
    START_Y_OFFSET: 24,              // 起点Y偏移 (8字节, DOUBLE)
    END_X_OFFSET: 32,                // 终点X偏移 (8字节, DOUBLE)
    END_Y_OFFSET: 40,                // 终点Y偏移 (8字节, DOUBLE)
    TOTAL_SIZE: 48,                  // 总大小 48字节
    
    // 默认坐标常量（暂时写死）
    DEFAULT_START_X: 116.4,          // 默认起点X坐标
    DEFAULT_START_Y: 39.9,           // 默认起点Y坐标
    DEFAULT_END_X: 118.5,            // 默认终点X坐标
    DEFAULT_END_Y: 41.2,             // 默认终点Y坐标
};

// AVP自主代客泊车协议数据域定义 (2字节)
export const AVP_PARKING_PROTOCOL = {
    VEHICLE_ID_OFFSET: 0,            // 车辆编号偏移 (1字节, UINT8)
    PARKING_SPOT_OFFSET: 1,          // 停车位编号偏移 (1字节, UINT8)
    TOTAL_SIZE: 2,                   // 总大小 2字节
    
    // 默认停车位编号常量（暂时写死）
    DEFAULT_PARKING_SPOT: 1,         // 默认停车位编号
};

// AVP取车协议数据域定义 (1字节)
export const AVP_PICKUP_PROTOCOL = {
    VEHICLE_ID_OFFSET: 0,            // 车辆编号偏移 (1字节, UINT8)
    TOTAL_SIZE: 1,                   // 总大小 1字节
};

// 车辆功能设置协议数据域定义 (3字节)
export const VEHICLE_FUNCTION_SETTING_PROTOCOL = {
    VEHICLE_ID_OFFSET: 0,            // 车辆编号偏移 (1字节)
    FUNCTION_ID_OFFSET: 1,           // 功能编号偏移 (1字节)
    ENABLE_STATUS_OFFSET: 2,         // 启用状态偏移 (1字节)
    TOTAL_SIZE: 3,                   // 总大小 3字节
    
    // 功能编号定义
    FUNCTION_ALL: 0,                 // 全部(所有程序)
    FUNCTION_SENSORS: 1,             // 传感器
    FUNCTION_MAPPING: 2,             // 建图
    FUNCTION_RECORDING: 3,           // 录制
    FUNCTION_POSITIONING: 4,         // 定位
    FUNCTION_AUTONOMOUS_NAV: 5,      // 自主导航
    FUNCTION_IMAGE_RECOGNITION: 6,   // 图像识别
    FUNCTION_TARGET_SHOOTING: 7,     // 打靶功能
    
    // 启用状态定义
    STATUS_DISABLE: 0,               // 关闭
    STATUS_ENABLE: 1,                // 启用
};

// 车辆路径显示协议数据域定义 (2字节)
export const VEHICLE_PATH_DISPLAY_PROTOCOL = {
    VEHICLE_ID_OFFSET: 0,            // 车辆编号偏移 (1字节)
    DISPLAY_PATH_OFFSET: 1,          // 显示路径偏移 (1字节)
    TOTAL_SIZE: 2,                   // 总大小 2字节
    
    // 显示路径状态定义
    PATH_DISABLE: 0,                 // 车端不发送路径数据
    PATH_ENABLE: 1,                  // 车端开启发送路径数据
};

// 施工标记协议数据域定义 (18字节)
export const CONSTRUCTION_MARKER_PROTOCOL = {
    ID_OFFSET: 0,                    // 施工点ID偏移 (1字节, UINT8)
    POSITION_X_OFFSET: 1,            // 位置X偏移 (8字节, DOUBLE)
    POSITION_Y_OFFSET: 9,            // 位置Y偏移 (8字节, DOUBLE)
    ACTION_OFFSET: 17,               // 动作偏移 (1字节, UINT8)
    TOTAL_SIZE: 18,                  // 总大小 18字节
    
    // 动作类型定义
    ACTION_CANCEL: 0,                // 取消施工标记
    ACTION_SET: 1,                   // 设置施工标记
    
    // 动作名称映射
    ACTION_NAMES: {
        0: '取消',
        1: '设置'
    }
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
    VEHICLE_CONTROL_PROTOCOL,
    DATA_RECORDING_PROTOCOL,
    TAXI_ORDER_PROTOCOL,
    AVP_PARKING_PROTOCOL,
    AVP_PICKUP_PROTOCOL,
    VEHICLE_FUNCTION_SETTING_PROTOCOL,
    VEHICLE_PATH_DISPLAY_PROTOCOL,
    CONSTRUCTION_MARKER_PROTOCOL,
    PROTOCOL_CONSTANTS,
    MessageTypeUtils
};
