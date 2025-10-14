/**
 * 动态消息类型加载器
 * 从Rust后端获取统一的消息类型定义，避免前后端定义不一致
 */

import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/utils/logger.js';

// 缓存加载的配置
let cachedConfig = null;
let loadPromise = null;

/**
 * 加载消息类型配置
 * @returns {Promise<Object>} 完整的消息类型配置
 */
export async function loadMessageTypesConfig() {
    // 如果已经缓存，直接返回
    if (cachedConfig) {
        return cachedConfig;
    }

    // 如果正在加载，返回同一个Promise
    if (loadPromise) {
        return loadPromise;
    }

    // 开始加载
    loadPromise = (async () => {
        try {
            logger.debug('MessageTypesLoader', '正在从Rust后端加载消息类型配置...');
            const config = await invoke('get_message_types_config_command');
            cachedConfig = config;
            logger.info('MessageTypesLoader', '消息类型配置加载成功');
            return config;
        } catch (error) {
            logger.error('MessageTypesLoader', '加载消息类型配置失败:', error);
            // 加载失败时返回默认配置（向后兼容）
            return getDefaultConfig();
        } finally {
            loadPromise = null;
        }
    })();

    return loadPromise;
}

/**
 * 获取接收消息类型
 * @returns {Promise<Object>} 接收消息类型映射
 */
export async function getReceiveMessageTypes() {
    const config = await loadMessageTypesConfig();
    return config.receive_message_types || {};
}

/**
 * 获取发送消息类型
 * @returns {Promise<Object>} 发送消息类型映射
 */
export async function getSendMessageTypes() {
    const config = await loadMessageTypesConfig();
    return config.send_message_types || {};
}

/**
 * 获取协议常量
 * @returns {Promise<Object>} 协议常量配置
 */
export async function getProtocolConstants() {
    const config = await loadMessageTypesConfig();
    return config.protocol_constants || {};
}

/**
 * 清除缓存，强制重新加载
 */
export function clearCache() {
    cachedConfig = null;
    loadPromise = null;
    logger.debug('MessageTypesLoader', '缓存已清除');
}

/**
 * 默认配置（向后兼容）
 * 如果Rust后端不可用，使用此配置
 */
function getDefaultConfig() {
    logger.warn('MessageTypesLoader', '使用默认配置（Rust后端不可用）');
    return {
        receive_message_types: {
            HEARTBEAT: 0x0001,
            VEHICLE_INFO: 0x0002,
            SANDBOX_TRAFFIC_LIGHT_STATUS: 0x3001,
        },
        send_message_types: {
            VEHICLE_CONTROL: 0x1001,
            DATA_RECORDING: 0x1002,
            TAXI_ORDER: 0x1003,
            AVP_PARKING: 0x1004,
            AVP_PICKUP: 0x1005,
            VEHICLE_FUNCTION_SETTING: 0x1006,
            VEHICLE_PATH_DISPLAY: 0x1007,
            CONSTRUCTION_MARKER: 0x1008,
            VEHICLE_CAMERA_TOGGLE: 0x1009,
            SANDBOX_LIGHTING_CONTROL: 0x2003,
        },
        protocol_constants: {
            header: [0xEF, 0xEF, 0xEF, 0xEF],
            footer: [0xFE, 0xFE, 0xFE, 0xFE],
            version: 0x10,
            header_size: 4,
            version_size: 1,
            timestamp_size: 8,
            message_type_size: 2,
            data_length_size: 4,
            crc_size: 2,
            footer_size: 4,
            min_packet_size: 25,
        },
        vehicle_info_protocol: {
            vehicle_id_offset: 0,
            speed_offset: 1,
            position_x_offset: 9,
            position_y_offset: 17,
            orientation_offset: 25,
            battery_offset: 33,
            gear_offset: 41,
            steering_angle_offset: 42,
            nav_status_offset: 50,
            camera_status_offset: 51,
            lidar_status_offset: 52,
            gyro_status_offset: 53,
            parking_slot_offset: 54,
            total_size: 55,
            min_speed: 0.0,
            max_speed: 1.0,
        },
        nav_status_texts: {
            '1': '正常行驶中（空载模式倒车入库）',
            '2': '正常行驶中（空载模式不倒车入库）',
            '3': '接客模式，去起点接客',
            '4': '接客模式，去终点送客',
            '5': '去往充电车位',
            '6': '充电中',
            '7': '去往定车位路上',
            '8': '车位停车中',
            '9': '到达接客起点',
            '10': '到达接客终点',
            '11': '正在倒车入库',
            '12': '正在出库中',
            '13': '正在倒车入库',
            '14': '出库完成',
            '15': '平行驾驶模式',
        },
    };
}

/**
 * 创建便捷的访问器（与原messageTypes.js兼容）
 * 注意：这些是异步函数，返回Promise
 */
export const MessageTypesLoader = {
    loadConfig: loadMessageTypesConfig,
    getReceiveTypes: getReceiveMessageTypes,
    getSendTypes: getSendMessageTypes,
    getConstants: getProtocolConstants,
    clearCache,
};

export default MessageTypesLoader;

