/**
 * Socket服务端管理工具
 * 负责启动Socket服务器、处理接收消息、发送消息给客户端
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { SEND_MESSAGE_TYPES, RECEIVE_MESSAGE_TYPES, MessageTypeUtils } from '@/constants/messageTypes.js';
import { ElMessage } from 'element-plus';
import { createLogger } from '@/utils/logger.js';

const logger = createLogger('SocketManager');

class SocketManager {
    constructor() {
        this.isServerRunning = false;
        this.connectedVehicles = new Map();
        this.messageHandlers = new Map();
        this.defaultPort = 8888;
        
        // 设置默认消息处理器
        this.setupDefaultHandlers();
    }

    /**
     * 启动Socket服务器
     */
    async startServer(port = this.defaultPort) {
        try {
            console.log('🔍 SocketManager.startServer 被调用, 端口:', port);
            
            if (this.isServerRunning) {
                logger.warn('Socket服务器已在运行');
                return;
            }

            console.log('📞 调用 Tauri invoke start_socket_server...');
            const result = await invoke('start_socket_server', { port });
            console.log('✅ Tauri invoke 返回结果:', result);
            
            this.isServerRunning = true;
            
            logger.info(`Socket服务器启动成功: ${result}`);
            ElMessage.success(`Socket服务器启动在端口 ${port}`);
            
            // 开始监听消息
            this.startListening();
            
            return result;
        } catch (error) {
            console.error('❌ SocketManager.startServer 错误:', error);
            logger.error('启动Socket服务器失败:', error);
            ElMessage.error(`启动Socket服务器失败: ${error}`);
            throw error;
        }
    }

    /**
     * 开始监听Socket消息
     */
    async startListening() {
        try {
            // 监听来自Rust端的Socket消息
            await listen('socket-message', (event) => {
                this.handleIncomingMessage(event.payload);
            });
            
            logger.info('开始监听Socket消息');
        } catch (error) {
            logger.error('监听Socket消息失败:', error);
        }
    }

    /**
     * 处理接收到的消息
     */
    handleIncomingMessage(payload) {
        const { car_id, message_type, timestamp, data } = payload;
        
        logger.info(`收到消息 - 车辆: ${car_id}, 类型: 0x${message_type.toString(16).toUpperCase()}`);
        
        // 更新车辆连接状态
        this.updateVehicleStatus(car_id, true);
        
        // 获取消息类型名称
        const typeName = MessageTypeUtils.getReceiveTypeName(message_type);
        
        // 调用对应的消息处理器
        const handler = this.messageHandlers.get(message_type);
        if (handler) {
            try {
                handler(car_id, data, timestamp);
            } catch (error) {
                logger.error(`处理消息类型 ${typeName} 失败:`, error);
            }
        } else {
            logger.warn(`未找到消息类型 ${typeName} (0x${message_type.toString(16)}) 的处理器`);
            // 调用默认处理器
            this.handleUnknownMessage(car_id, message_type, data, timestamp);
        }
    }

    /**
     * 设置默认消息处理器
     */
    setupDefaultHandlers() {
        // 心跳包处理
        this.setMessageHandler(RECEIVE_MESSAGE_TYPES.HEARTBEAT, (carId, data, timestamp) => {
            logger.debug(`收到心跳包 - 车辆: ${carId}`);
            this.updateVehicleStatus(carId, true);
        });

        // 车辆状态处理
        this.setMessageHandler(RECEIVE_MESSAGE_TYPES.VEHICLE_STATUS, (carId, data, timestamp) => {
            logger.info(`收到车辆状态 - 车辆: ${carId}, 数据长度: ${data.length}`);
            // 这里会调用用户自定义的数据域解析逻辑
            this.parseVehicleStatus(carId, data, timestamp);
        });

        // 传感器数据处理
        this.setMessageHandler(RECEIVE_MESSAGE_TYPES.SENSOR_DATA, (carId, data, timestamp) => {
            logger.info(`收到传感器数据 - 车辆: ${carId}, 数据长度: ${data.length}`);
            this.parseSensorData(carId, data, timestamp);
        });

        // GPS位置处理
        this.setMessageHandler(RECEIVE_MESSAGE_TYPES.GPS_LOCATION, (carId, data, timestamp) => {
            logger.info(`收到GPS位置 - 车辆: ${carId}, 数据长度: ${data.length}`);
            this.parseGPSLocation(carId, data, timestamp);
        });

        // 错误报告处理
        this.setMessageHandler(RECEIVE_MESSAGE_TYPES.ERROR_REPORT, (carId, data, timestamp) => {
            logger.warn(`收到错误报告 - 车辆: ${carId}, 数据长度: ${data.length}`);
            this.parseErrorReport(carId, data, timestamp);
        });
    }

    /**
     * 设置消息处理器
     */
    setMessageHandler(messageType, handler) {
        this.messageHandlers.set(messageType, handler);
        logger.debug(`设置消息处理器: ${MessageTypeUtils.getReceiveTypeName(messageType)}`);
    }

    /**
     * 发送消息给指定车辆
     */
    async sendToVehicle(carId, messageType, data = []) {
        try {
            const result = await invoke('send_to_vehicle', {
                car_id: carId,
                message_type: messageType,
                data: Array.from(data)
            });
            
            const typeName = MessageTypeUtils.getSendTypeName(messageType);
            logger.info(`发送消息成功 - 车辆: ${carId}, 类型: ${typeName}`);
            
            return result;
        } catch (error) {
            logger.error(`发送消息失败 - 车辆: ${carId}:`, error);
            ElMessage.error(`发送消息失败: ${error}`);
            throw error;
        }
    }

    /**
     * 广播消息给所有车辆
     */
    async broadcastMessage(messageType, data = []) {
        try {
            const result = await invoke('broadcast_message', {
                message_type: messageType,
                data: Array.from(data)
            });
            
            const typeName = MessageTypeUtils.getSendTypeName(messageType);
            logger.info(`广播消息成功 - 类型: ${typeName}, 结果: ${result}`);
            
            return result;
        } catch (error) {
            logger.error('广播消息失败:', error);
            ElMessage.error(`广播消息失败: ${error}`);
            throw error;
        }
    }

    /**
     * 获取已连接的车辆列表
     */
    async getConnectedVehicles() {
        try {
            const result = await invoke('get_connected_vehicles');
            
            // 更新本地车辆列表
            this.connectedVehicles.clear();
            result.forEach(vehicle => {
                this.connectedVehicles.set(vehicle.car_id, vehicle);
            });
            
            logger.debug(`获取到 ${result.length} 个已连接车辆`);
            return result;
        } catch (error) {
            logger.error('获取连接车辆失败:', error);
            return [];
        }
    }

    /**
     * 更新车辆状态
     */
    updateVehicleStatus(carId, isConnected) {
        if (isConnected) {
            this.connectedVehicles.set(carId, {
                car_id: carId,
                connected: true,
                last_seen: Date.now()
            });
        } else {
            this.connectedVehicles.delete(carId);
        }
    }

    /**
     * 车辆控制方法
     */
    async startVehicle(carId) {
        return this.sendToVehicle(carId, SEND_MESSAGE_TYPES.START_VEHICLE);
    }

    async stopVehicle(carId) {
        return this.sendToVehicle(carId, SEND_MESSAGE_TYPES.STOP_VEHICLE);
    }

    async emergencyBrake(carId) {
        return this.sendToVehicle(carId, SEND_MESSAGE_TYPES.EMERGENCY_BRAKE);
    }

    async setVehicleSpeed(carId, speed) {
        const speedData = new Uint8Array(4);
        new DataView(speedData.buffer).setFloat32(0, speed, true); // 小端序
        return this.sendToVehicle(carId, SEND_MESSAGE_TYPES.SET_SPEED, speedData);
    }

    async requestVehicleStatus(carId) {
        return this.sendToVehicle(carId, SEND_MESSAGE_TYPES.REQUEST_STATUS);
    }

    // ============ 数据域解析方法 (用户可自定义) ============

    /**
     * 解析车辆状态数据域
     * 用户可根据实际协议修改此方法
     */
    parseVehicleStatus(carId, data, timestamp) {
        // TODO: 根据具体协议解析车辆状态数据
        logger.info(`解析车辆状态 - 车辆: ${carId}, 原始数据:`, data);
        
        // 示例解析逻辑 - 用户需要根据实际协议修改
        if (data.length >= 8) {
            const view = new DataView(new Uint8Array(data).buffer);
            const speed = view.getFloat32(0, true); // 小端序
            const battery = view.getUint8(4);
            const status = view.getUint8(5);
            
            logger.info(`车辆状态解析 - 速度: ${speed}, 电量: ${battery}%, 状态: ${status}`);
            
            // 发送到UI更新
            window.dispatchEvent(new CustomEvent('vehicle-status-update', {
                detail: { carId, speed, battery, status, timestamp }
            }));
        }
    }

    /**
     * 解析传感器数据域
     */
    parseSensorData(carId, data, timestamp) {
        logger.info(`解析传感器数据 - 车辆: ${carId}, 原始数据:`, data);
        // TODO: 实现传感器数据解析
    }

    /**
     * 解析GPS位置数据域
     */
    parseGPSLocation(carId, data, timestamp) {
        logger.info(`解析GPS位置 - 车辆: ${carId}, 原始数据:`, data);
        // TODO: 实现GPS数据解析
    }

    /**
     * 解析错误报告数据域
     */
    parseErrorReport(carId, data, timestamp) {
        logger.warn(`解析错误报告 - 车辆: ${carId}, 原始数据:`, data);
        // TODO: 实现错误报告解析
    }

    /**
     * 处理未知消息类型
     */
    handleUnknownMessage(carId, messageType, data, timestamp) {
        logger.warn(`未知消息类型 0x${messageType.toString(16)} - 车辆: ${carId}, 数据:`, data);
        // TODO: 处理未知消息类型
    }
}

// 创建全局Socket管理器实例
export const socketManager = new SocketManager();

export default socketManager;
