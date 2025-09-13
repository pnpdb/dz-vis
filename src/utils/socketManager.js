/**
 * Socket服务端管理工具
 * 负责启动Socket服务器、处理接收消息、发送消息给客户端
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { SEND_MESSAGE_TYPES, RECEIVE_MESSAGE_TYPES, VEHICLE_INFO_PROTOCOL, VEHICLE_CONTROL_PROTOCOL, DATA_RECORDING_PROTOCOL, TAXI_ORDER_PROTOCOL, AVP_PARKING_PROTOCOL, MessageTypeUtils } from '@/constants/messageTypes.js';
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

        // 触发在线车辆数量变化事件
        window.dispatchEvent(new CustomEvent('online-vehicles-count-changed', {
            detail: {
                count: this.getOnlineVehicleCount(),
                vehicleIds: this.getOnlineVehicleIds(),
                timestamp: Date.now()
            }
        }));
        
        console.log(`📡 SocketManager状态更新: 车辆${carId}, 连接:${isConnected}, 总在线数量:${this.getOnlineVehicleCount()}`);
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
     * 获取当前在线车辆数量
     */
    getOnlineVehicleCount() {
        return this.connectedVehicles.size;
    }

    /**
     * 获取所有在线车辆ID列表
     */
    getOnlineVehicleIds() {
        return Array.from(this.connectedVehicles.keys());
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
     * 发送车辆控制指令
     * @param {number} vehicleId - 车辆ID
     * @param {number} command - 控制指令 (1:启动，2:停止，3:紧急制动，4:空载模式，5:初始化位姿)
     * @param {Object} positionData - 位置数据 (仅当指令为5时需要) {x: number, y: number, orientation: number}
     */
    async sendVehicleControl(vehicleId, command, positionData = null) {
        try {
            console.log(`🔧 sendVehicleControl - 车辆: ${vehicleId}, 指令: ${command}`);
            console.log(`🔧 VEHICLE_CONTROL_PROTOCOL:`, VEHICLE_CONTROL_PROTOCOL);
            console.log(`🔧 SEND_MESSAGE_TYPES:`, SEND_MESSAGE_TYPES);
            
            // 验证指令
            if (command < 1 || command > 5) {
                throw new Error(`无效的控制指令: ${command}`);
            }

            // 确定数据域大小
            const needsPosition = command === VEHICLE_CONTROL_PROTOCOL.COMMAND_INIT_POSE;
            const dataSize = needsPosition ? 
                VEHICLE_CONTROL_PROTOCOL.TOTAL_SIZE_WITH_POSITION : 
                VEHICLE_CONTROL_PROTOCOL.TOTAL_SIZE_WITHOUT_POSITION;
            
            console.log(`🔧 needsPosition: ${needsPosition}, dataSize: ${dataSize}`);

            // 创建数据域
            const dataBuffer = new ArrayBuffer(dataSize);
            const dataView = new DataView(dataBuffer);

            // 写入车辆编号
            dataView.setUint8(VEHICLE_CONTROL_PROTOCOL.VEHICLE_ID_OFFSET, vehicleId);
            
            // 写入控制指令
            dataView.setUint8(VEHICLE_CONTROL_PROTOCOL.CONTROL_COMMAND_OFFSET, command);

            // 如果是初始化位姿指令，写入位置数据
            if (needsPosition) {
                if (!positionData) {
                    throw new Error('初始化位姿指令需要提供位置数据');
                }
                
                // 写入位置X (DOUBLE, 小端序)
                dataView.setFloat64(VEHICLE_CONTROL_PROTOCOL.POSITION_X_OFFSET, positionData.x, true);
                
                // 写入位置Y (DOUBLE, 小端序)
                dataView.setFloat64(VEHICLE_CONTROL_PROTOCOL.POSITION_Y_OFFSET, positionData.y, true);
                
                // 写入朝向 (DOUBLE, 小端序)
                dataView.setFloat64(VEHICLE_CONTROL_PROTOCOL.ORIENTATION_OFFSET, positionData.orientation, true);
            }

            // 转换为字节数组
            const dataArray = new Uint8Array(dataBuffer);

            // 通过Rust发送消息给指定车辆
            console.log(`🔧 准备调用invoke - vehicleId: ${vehicleId}, messageType: ${SEND_MESSAGE_TYPES.VEHICLE_CONTROL}, data长度: ${dataArray.length}`);
            const result = await invoke('send_to_vehicle', {
                vehicleId: vehicleId,
                messageType: SEND_MESSAGE_TYPES.VEHICLE_CONTROL,
                data: Array.from(dataArray)
            });
            console.log(`🔧 invoke调用成功, 结果:`, result);

            const commandName = VEHICLE_CONTROL_PROTOCOL.COMMAND_NAMES[command];
            logger.info(`车辆控制指令发送成功 - 车辆: ${vehicleId}, 指令: ${commandName}, 数据大小: ${dataSize}字节`);
            
            if (needsPosition) {
                logger.debug(`位置数据 - X: ${positionData.x}, Y: ${positionData.y}, 朝向: ${positionData.orientation}`);
            }

            return result;
        } catch (error) {
            const commandName = VEHICLE_CONTROL_PROTOCOL.COMMAND_NAMES[command] || `未知指令(${command})`;
            logger.error(`发送车辆控制指令失败 - 车辆: ${vehicleId}, 指令: ${commandName}:`, error);
            throw error;
        }
    }

    /**
     * 便捷方法：启动车辆
     */
    async startVehicle(vehicleId) {
        return await this.sendVehicleControl(vehicleId, VEHICLE_CONTROL_PROTOCOL.COMMAND_START);
    }

    /**
     * 便捷方法：停止车辆
     */
    async stopVehicle(vehicleId) {
        return await this.sendVehicleControl(vehicleId, VEHICLE_CONTROL_PROTOCOL.COMMAND_STOP);
    }

    /**
     * 便捷方法：紧急制动
     */
    async emergencyBrake(vehicleId) {
        return await this.sendVehicleControl(vehicleId, VEHICLE_CONTROL_PROTOCOL.COMMAND_EMERGENCY_BRAKE);
    }

    /**
     * 便捷方法：切换空载模式
     */
    async setEmptyMode(vehicleId) {
        return await this.sendVehicleControl(vehicleId, VEHICLE_CONTROL_PROTOCOL.COMMAND_EMPTY_MODE);
    }

    /**
     * 便捷方法：初始化位姿
     */
    async initializePose(vehicleId, x = 0.0, y = 0.0, orientation = 0.0) {
        return await this.sendVehicleControl(vehicleId, VEHICLE_CONTROL_PROTOCOL.COMMAND_INIT_POSE, {
            x, y, orientation
        });
    }

    /**
     * 发送数据记录控制指令
     * @param {number} vehicleId 车辆ID
     * @param {boolean} enabled 记录状态（true：开启，false：关闭）
     * @returns {Promise<string>} 发送结果
     */
    async sendDataRecording(vehicleId, enabled) {
        try {
            if (vehicleId == null) {
                throw new Error('车辆ID不能为空');
            }

            console.log(`🔧 SocketManager.sendDataRecording - 车辆ID: ${vehicleId}, 启用: ${enabled}`);

            // 构建数据域 (2字节)
            const dataBuffer = new ArrayBuffer(DATA_RECORDING_PROTOCOL.TOTAL_SIZE);
            const dataView = new DataView(dataBuffer);

            // 写入车辆编号 (UINT8)
            dataView.setUint8(DATA_RECORDING_PROTOCOL.VEHICLE_ID_OFFSET, vehicleId);
            
            // 写入记录状态 (UINT8)
            const recordingStatus = enabled ? DATA_RECORDING_PROTOCOL.RECORDING_ON : DATA_RECORDING_PROTOCOL.RECORDING_OFF;
            dataView.setUint8(DATA_RECORDING_PROTOCOL.RECORDING_STATUS_OFFSET, recordingStatus);

            // 转换为字节数组
            const dataArray = new Uint8Array(dataBuffer);

            // 通过Rust发送消息给指定车辆
            console.log(`🔧 准备发送数据记录指令 - vehicleId: ${vehicleId}, enabled: ${enabled}, messageType: ${SEND_MESSAGE_TYPES.DATA_RECORDING}, data长度: ${dataArray.length}`);
            const result = await invoke('send_to_vehicle', {
                vehicleId: vehicleId,
                messageType: SEND_MESSAGE_TYPES.DATA_RECORDING,
                data: Array.from(dataArray)
            });
            console.log(`🔧 数据记录指令发送成功, 结果:`, result);

            const statusName = DATA_RECORDING_PROTOCOL.STATUS_NAMES[recordingStatus];
            logger.info(`数据记录指令发送成功 - 车辆: ${vehicleId}, 状态: ${statusName}`);

            return result;
        } catch (error) {
            const statusName = enabled ? '开启' : '关闭';
            logger.error(`发送数据记录指令失败 - 车辆: ${vehicleId}, 状态: ${statusName}:`, error);
            throw error;
        }
    }

    /**
     * 发送出租车订单广播
     * @param {string} orderId 订单ID (16字节UUID)
     * @param {number} startX 起点X坐标
     * @param {number} startY 起点Y坐标
     * @param {number} endX 终点X坐标
     * @param {number} endY 终点Y坐标
     * @returns {Promise<string>} 发送结果
     */
    async sendTaxiOrder(orderId, startX = null, startY = null, endX = null, endY = null) {
        try {
            // 使用默认坐标（如果没有提供）
            const actualStartX = startX ?? TAXI_ORDER_PROTOCOL.DEFAULT_START_X;
            const actualStartY = startY ?? TAXI_ORDER_PROTOCOL.DEFAULT_START_Y;
            const actualEndX = endX ?? TAXI_ORDER_PROTOCOL.DEFAULT_END_X;
            const actualEndY = endY ?? TAXI_ORDER_PROTOCOL.DEFAULT_END_Y;

            console.log(`🚕 发送出租车订单 - 订单: ${orderId}, 起点: (${actualStartX}, ${actualStartY}), 终点: (${actualEndX}, ${actualEndY})`);

            // 调用Rust后端进行广播和数据库保存
            const result = await invoke('broadcast_taxi_order', {
                orderId: orderId,
                startX: actualStartX,
                startY: actualStartY,
                endX: actualEndX,
                endY: actualEndY
            });

            logger.info(`出租车订单发送成功 - 订单: ${orderId}`);
            return result;
        } catch (error) {
            logger.error(`发送出租车订单失败 - 订单: ${orderId}:`, error);
            throw error;
        }
    }

    /**
     * 生成出租车订单UUID
     * @returns {string} 16字符的UUID字符串
     */
    generateOrderId() {
        // 生成简单的16字符UUID（实际应用中可以使用更复杂的UUID库）
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 16; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * 发送AVP自主代客泊车指令
     * @param {number} vehicleId 车辆ID
     * @param {number} parkingSpot 停车位编号（可选，默认使用常量1）
     * @returns {Promise<string>} 发送结果
     */
    async sendAvpParking(vehicleId, parkingSpot = null) {
        try {
            if (vehicleId == null) {
                throw new Error('车辆ID不能为空');
            }

            // 使用默认停车位（如果没有提供）
            const actualParkingSpot = parkingSpot ?? AVP_PARKING_PROTOCOL.DEFAULT_PARKING_SPOT;

            console.log(`🅿️ 发送AVP泊车指令 - 车辆: ${vehicleId}, 车位: ${actualParkingSpot}`);

            // 调用Rust后端进行发送和数据库保存
            const result = await invoke('send_avp_parking', {
                vehicleId: vehicleId
            });

            logger.info(`AVP泊车指令发送成功 - 车辆: ${vehicleId}, 车位: ${actualParkingSpot}`);
            return result;
        } catch (error) {
            logger.error(`发送AVP泊车指令失败 - 车辆: ${vehicleId}:`, error);
            throw error;
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
