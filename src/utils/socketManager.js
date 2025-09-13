/**
 * Socket服务端管理工具
 * 负责启动Socket服务器、处理接收消息、发送消息给客户端
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { SEND_MESSAGE_TYPES, RECEIVE_MESSAGE_TYPES, VEHICLE_INFO_PROTOCOL, MessageTypeUtils } from '@/constants/messageTypes.js';
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
        
        // 监听车辆状态请求事件
        this.setupStatusRequestHandler();
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
            // ElMessage.success(`Socket服务器启动在端口 ${port}`); // 移除toast提示
            
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
            
            // 监听车辆断开连接事件
            await listen('vehicle-disconnect', (event) => {
                this.handleVehicleDisconnect(event.payload);
            });
            
            logger.info('开始监听Socket消息和断开连接事件');
        } catch (error) {
            logger.error('监听Socket事件失败:', error);
        }
    }

    /**
     * 处理车辆断开连接事件
     */
    handleVehicleDisconnect(payload) {
        const { vehicle_id, vehicle_name } = payload;
        logger.info(`车辆断开连接 - 车辆: ${vehicle_name} (ID: ${vehicle_id})`);
        
        // 更新车辆连接状态为断开
        this.updateVehicleStatus(vehicle_id, false);
    }

    /**
     * 处理接收到的消息
     */
    handleIncomingMessage(payload) {
        const { vehicle_id, message_type, timestamp, data } = payload;
        
        logger.info(`收到消息 - 车辆: ${vehicle_id}, 类型: 0x${message_type.toString(16).toUpperCase()}`);
        
        // 更新车辆连接状态为在线
        this.updateVehicleStatus(vehicle_id, true);
        
        // 获取消息类型名称
        const typeName = MessageTypeUtils.getReceiveTypeName(message_type);
        
        // 调用对应的消息处理器
        const handler = this.messageHandlers.get(message_type);
        if (handler) {
            try {
                handler(vehicle_id, data, timestamp);
            } catch (error) {
                logger.error(`处理消息类型 ${typeName} 失败:`, error);
            }
        } else {
            logger.warn(`未找到消息类型 ${typeName} (0x${message_type.toString(16)}) 的处理器`);
            // 调用默认处理器
            this.handleUnknownMessage(vehicle_id, message_type, data, timestamp);
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

        // 车辆信息协议处理
        this.setMessageHandler(RECEIVE_MESSAGE_TYPES.VEHICLE_INFO, (carId, data, timestamp) => {
            logger.info(`收到车辆信息 - 车辆: ${carId}, 数据长度: ${data.length}`);
            this.parseVehicleInfo(carId, data, timestamp);
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
        
        // 触发车辆连接状态变化事件
        window.dispatchEvent(new CustomEvent('vehicle-connection-status', {
            detail: {
                carId: carId, // 确保使用正确的carId
                isConnected,
                timestamp: Date.now()
            }
        }));
        
        console.log(`📡 SocketManager状态更新: 车辆${carId}, 连接:${isConnected}`);
        logger.info(`车辆连接状态更新 - 车辆: ${carId}, 状态: ${isConnected ? '连接' : '断开'}`);
    }

    /**
     * 检查车辆是否连接
     */
    isVehicleConnected(vehicleId) {
        return this.connectedVehicles.has(vehicleId);
    }

    /**
     * 获取车辆连接信息
     */
    getVehicleConnection(vehicleId) {
        return this.connectedVehicles.get(vehicleId) || null;
    }

    /**
     * 设置车辆状态请求处理器
     */
    setupStatusRequestHandler() {
        console.log('🔧 SocketManager.setupStatusRequestHandler 已设置');
        window.addEventListener('request-vehicle-status', (event) => {
            const { vehicleId } = event.detail;
            const isConnected = this.isVehicleConnected(vehicleId);
            
            console.log(`🔍 SocketManager收到状态请求 - 车辆: ${vehicleId}, 连接状态: ${isConnected}`);
            
            // 立即响应车辆连接状态
            window.dispatchEvent(new CustomEvent('vehicle-connection-status', {
                detail: {
                    carId: vehicleId,
                    isConnected,
                    timestamp: Date.now()
                }
            }));
            
            console.log(`📤 SocketManager发送状态响应 - 车辆: ${vehicleId}, 连接: ${isConnected}`);
            logger.debug(`响应车辆状态请求 - 车辆: ${vehicleId}, 状态: ${isConnected ? '连接' : '未连接'}`);
        });
    }


    /**
     * 车辆控制方法 (预留给后续指令协议实现)
     * TODO: 当实现发送指令协议时，恢复这些方法
     */
    // async startVehicle(carId) {
    //     return this.sendToVehicle(carId, SEND_MESSAGE_TYPES.START_VEHICLE);
    // }

    // async stopVehicle(carId) {
    //     return this.sendToVehicle(carId, SEND_MESSAGE_TYPES.STOP_VEHICLE);
    // }

    // async emergencyBrake(carId) {
    //     return this.sendToVehicle(carId, SEND_MESSAGE_TYPES.EMERGENCY_BRAKE);
    // }

    // async setVehicleSpeed(carId, speed) {
    //     const speedData = new Uint8Array(4);
    //     new DataView(speedData.buffer).setFloat32(0, speed, true); // 小端序
    //     return this.sendToVehicle(carId, SEND_MESSAGE_TYPES.SET_SPEED, speedData);
    // }

    // async requestVehicleStatus(carId) {
    //     return this.sendToVehicle(carId, SEND_MESSAGE_TYPES.REQUEST_STATUS);
    // }

    // ============ 数据域解析方法 ============

    /**
     * 解析车辆信息协议数据域 (38字节)
     * 协议格式：车辆编号(1) + 车速(8) + 位置X(8) + 位置Y(8) + 电量(8) + 导航状态(1) + 相机状态(1) + 雷达状态(1) + 陀螺仪状态(1) + 北斗状态(1)
     */
    parseVehicleInfo(carId, data, timestamp) {
        logger.info(`解析车辆信息 - 车辆: ${carId}, 数据长度: ${data.length}`);
        
        // 验证数据长度
        if (data.length !== VEHICLE_INFO_PROTOCOL.TOTAL_SIZE) {
            logger.error(`车辆信息数据长度错误 - 期望: ${VEHICLE_INFO_PROTOCOL.TOTAL_SIZE}, 实际: ${data.length}`);
            return;
        }
        
        try {
            const view = new DataView(new Uint8Array(data).buffer);
            
            // 解析数据域
            const vehicleId = view.getUint8(VEHICLE_INFO_PROTOCOL.VEHICLE_ID_OFFSET);
            const speed = view.getFloat64(VEHICLE_INFO_PROTOCOL.SPEED_OFFSET, true);  // 小端序
            const positionX = view.getFloat64(VEHICLE_INFO_PROTOCOL.POSITION_X_OFFSET, true);
            const positionY = view.getFloat64(VEHICLE_INFO_PROTOCOL.POSITION_Y_OFFSET, true);
            const battery = view.getFloat64(VEHICLE_INFO_PROTOCOL.BATTERY_OFFSET, true);
            const navStatus = view.getUint8(VEHICLE_INFO_PROTOCOL.NAV_STATUS_OFFSET);
            const cameraStatus = view.getUint8(VEHICLE_INFO_PROTOCOL.CAMERA_STATUS_OFFSET);
            const lidarStatus = view.getUint8(VEHICLE_INFO_PROTOCOL.LIDAR_STATUS_OFFSET);
            const gyroStatus = view.getUint8(VEHICLE_INFO_PROTOCOL.GYRO_STATUS_OFFSET);
            const beidouStatus = view.getUint8(VEHICLE_INFO_PROTOCOL.BEIDOU_STATUS_OFFSET);
            
            // 数据验证
            const clampedSpeed = Math.max(VEHICLE_INFO_PROTOCOL.MIN_SPEED, 
                                        Math.min(VEHICLE_INFO_PROTOCOL.MAX_SPEED, speed));
            const clampedBattery = Math.max(0, Math.min(100, battery));
            
            const vehicleInfo = {
                carId: carId, // 使用传入的carId参数
                vehicleId,
                speed: clampedSpeed,
                position: { x: positionX, y: positionY },
                battery: clampedBattery,
                navigation: {
                    status: navStatus === VEHICLE_INFO_PROTOCOL.STATUS_NORMAL,
                    text: navStatus === VEHICLE_INFO_PROTOCOL.STATUS_NORMAL ? '导航中' : '未导航'
                },
                sensors: {
                    camera: {
                        status: cameraStatus === VEHICLE_INFO_PROTOCOL.STATUS_NORMAL,
                        text: cameraStatus === VEHICLE_INFO_PROTOCOL.STATUS_NORMAL ? '正常' : '异常'
                    },
                    lidar: {
                        status: lidarStatus === VEHICLE_INFO_PROTOCOL.STATUS_NORMAL,
                        text: lidarStatus === VEHICLE_INFO_PROTOCOL.STATUS_NORMAL ? '正常' : '异常'
                    },
                    gyro: {
                        status: gyroStatus === VEHICLE_INFO_PROTOCOL.STATUS_NORMAL,
                        text: gyroStatus === VEHICLE_INFO_PROTOCOL.STATUS_NORMAL ? '正常' : '异常'
                    },
                    beidou: {
                        status: beidouStatus === VEHICLE_INFO_PROTOCOL.STATUS_NORMAL,
                        text: beidouStatus === VEHICLE_INFO_PROTOCOL.STATUS_NORMAL ? '正常' : '异常'
                    }
                },
                timestamp
            };
            
            logger.info(`车辆信息解析成功 - 车辆ID: ${vehicleId}, 速度: ${clampedSpeed.toFixed(3)}m/s, 位置: (${positionX.toFixed(2)}, ${positionY.toFixed(2)}), 电量: ${clampedBattery.toFixed(1)}%`);
            
            console.log('📡 SocketManager发送vehicle-info-update事件:', vehicleInfo);
            
            // 发送到UI更新
            window.dispatchEvent(new CustomEvent('vehicle-info-update', {
                detail: vehicleInfo
            }));
            
        } catch (error) {
            logger.error(`解析车辆信息失败 - 车辆: ${carId}:`, error);
        }
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
