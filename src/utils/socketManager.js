/**
 * Socket服务端管理工具
 * 负责启动Socket服务器、处理接收消息、发送消息给客户端
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import vehicleBridge from '@/utils/vehicleBridge.js';
import eventBus, { EVENTS } from '@/utils/eventBus.js';
import { RECEIVE_MESSAGE_TYPES, MessageTypeUtils, VEHICLE_CONTROL_PROTOCOL, SEND_MESSAGE_TYPES, AVP_PARKING_PROTOCOL } from '@/constants/messageTypes.js';
import { ElMessage } from 'element-plus';
import { createLogger, logger } from '@/utils/logger.js';
import { debug as plDebug, info as plInfo, warn as plWarn, error as plError } from '@tauri-apps/plugin-log';
import logHelper from '@/utils/logHelper.js'
import { normalizeVehicleList, parseVehicleId } from '@/utils/vehicleTypes.js'
import { useCarStore } from '@/stores/car.js'

const socketLogger = createLogger('SocketManager');
const bytesToHex = (bytes) => Array.from(bytes || [], (b) => b.toString(16).padStart(2, '0')).join(' ');

class SocketManager {
    constructor() {
        this.isServerRunning = false;
        this.connectedVehicles = new Map();
        this.sandboxConnected = false;
        this.vehicleReady = new Map();
        this.vehicleParkingSlots = new Map();
        this.messageHandlers = new Map();
        this.carStore = null;
        
        // 设置默认消息处理器
        this.setupDefaultHandlers();
        
        // 监听车辆状态请求事件
        this.setupStatusRequestHandler();
    }

    ensureCarStore() {
        if (!this.carStore) {
            try {
                this.carStore = useCarStore();
            } catch (error) {
                socketLogger.warn('获取carStore失败:', error);
            }
        }
        return this.carStore;
    }

    /**
     * 启动Socket服务器
     */
    async startServer() {
        try {
            logHelper.debug('SocketManager', 'startServer called')
            
            if (this.isServerRunning) {
                socketLogger.warn('Socket服务器已在运行');
                return;
            }

            const result = await invoke('start_socket_server');
            socketLogger.debug('Tauri invoke 返回结果:', result);
            
            this.isServerRunning = true;
            
            socketLogger.info(`Socket服务器启动成功: ${result}`);
            
            // 开始监听消息
            this.startListening();
            
            return result;
        } catch (error) {
            socketLogger.error('启动Socket服务器失败:', error);
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
            
            // 监听车辆连接事件
            await listen('vehicle-connect', (event) => {
                this.handleVehicleConnect(event.payload);
            });

            // 监听车辆断开连接事件
            await listen('vehicle-disconnect', (event) => {
                this.handleVehicleDisconnect(event.payload);
            });

            // 监听沙盘客户端连接事件
            await listen('sandbox-connect', (event) => {
                this.handleSandboxConnect(event.payload)
            });

            await listen('sandbox-disconnect', (event) => {
                this.handleSandboxDisconnect(event.payload)
            });
            
            socketLogger.info('开始监听Socket消息和断开连接事件');
        } catch (error) {
            socketLogger.error('监听Socket事件失败:', error);
            plError(`监听Socket事件失败: ${error}`).catch(() => {});
        }
    }

    /**
     * 处理车辆连接事件
     */
    handleVehicleConnect(payload) {
        const { vehicle_id, vehicle_name } = payload;
        socketLogger.info(`车辆连接 - 车辆: ${vehicle_name} (ID: ${vehicle_id})`);
        plInfo(`车辆连接 - 车辆: ${vehicle_name} (ID: ${vehicle_id})`).catch(() => {});
        
        // 更新车辆连接状态为在线
        this.updateVehicleStatus(vehicle_id, true);
    }

    /**
     * 处理车辆断开连接事件
     */
    handleVehicleDisconnect(payload) {
        const { vehicle_id, vehicle_name } = payload;
        socketLogger.info(`车辆断开连接 - 车辆: ${vehicle_name} (ID: ${vehicle_id})`);
        plInfo(`车辆断开连接 - 车辆: ${vehicle_name} (ID: ${vehicle_id})`).catch(() => {});
        
        // 更新车辆连接状态为断开
        this.updateVehicleStatus(vehicle_id, false);
    }

    /**
     * 处理接收到的消息
     */
    handleIncomingMessage(payload) {
        const { vehicle_id, message_type, timestamp, parsed } = payload;
        
        socketLogger.debug(`收到消息 - 车辆: ${vehicle_id}, 类型: 0x${message_type.toString(16).toUpperCase()}`);
        socketLogger.trace?.('socket-message payload', { ...payload, parsed });
        
        // 更新车辆连接状态为在线
        this.updateVehicleStatus(vehicle_id, true);
        
        // 获取消息类型名称
        const typeName = MessageTypeUtils.getReceiveTypeName(message_type);
        
        // 调用对应的消息处理器
        const handler = this.messageHandlers.get(message_type);
        if (handler) {
            try {
                handler(vehicle_id, parsed, timestamp);
            } catch (error) {
                socketLogger.error(`处理消息类型 ${typeName} 失败:`, error);
                plError(`处理消息类型 ${typeName} 失败: ${error}`).catch(() => {});
            }
        } else {
            socketLogger.warn(`未找到消息类型 ${typeName} (0x${message_type.toString(16)}) 的处理器`);
            // 调用默认处理器
            this.handleUnknownMessage(vehicle_id, message_type, parsed, timestamp);
        }
    }

    /**
     * 设置默认消息处理器
     */
    setupDefaultHandlers() {
        // 心跳包处理
        this.setMessageHandler(RECEIVE_MESSAGE_TYPES.HEARTBEAT, (carId) => {
            socketLogger.debug(`收到心跳包 - 车辆: ${carId}`);
            this.updateVehicleStatus(carId, true);
        });

        // 车辆信息协议处理
        this.setMessageHandler(RECEIVE_MESSAGE_TYPES.VEHICLE_INFO, (carId, parsed, timestamp) => {
            if (!parsed || typeof parsed !== 'object') {
                socketLogger.warn(`收到的车辆信息缺少解析数据 - 车辆: ${carId}`);
                return;
            }
            socketLogger.info(`收到车辆信息 - 车辆: ${carId}`);
            this.updateVehicleInfoFromParsed(carId, parsed, timestamp);
        });
    }

    updateVehicleInfoFromParsed(carId, parsed, timestamp) {
        const vehicleId = Number(parsed.vehicle_id ?? parsed.carId ?? carId);
        const speed = Number(parsed.speed ?? 0);
        const position = parsed.position ?? { x: 0, y: 0 };
        const orientation = Number(parsed.orientation ?? 0);
        const battery = Number(parsed.battery ?? 0);
        const gear = Number(parsed.gear ?? 0);
        const steeringAngle = Number(parsed.steeringAngle ?? 0);
        const navigation = parsed.navigation ?? { code: 0, text: '未知状态' };
        const sensors = parsed.sensors ?? {};
        const parkingSlot = Number(parsed.parkingSlot ?? 0);

        const vehicleInfo = {
            carId,
            vehicleId,
            speed,
            position,
            orientation,
            battery,
            gear,
            steeringAngle,
            navigation,
            sensors,
            parkingSlot,
            timestamp,
        };

        if (!this.isVehicleStateChanged(vehicleId, vehicleInfo)) {
            socketLogger.debug(`车辆 ${vehicleId} 数据未变化，跳过UI更新`);
            return;
        }

        const store = this.ensureCarStore();
        store?.updateVehicleState(vehicleId, vehicleInfo);

        logger.outputToPlugin('DEBUG', 'SocketManager.vehicleInfoUpdate', [
            `车辆:${vehicleId} 速:${speed.toFixed(3)} 位置:(${position.x?.toFixed?.(2) ?? position.x},${position.y?.toFixed?.(2) ?? position.y}) 电:${battery.toFixed?.(1) ?? battery}%`
        ], { throttle: true, throttleKey: `vinfo-ok-${vehicleId}`, interval: 500 });

        eventBus.emit(EVENTS.VEHICLE_INFO_UPDATE, vehicleInfo);

        if (parkingSlot > 0) {
            this.vehicleParkingSlots.set(vehicleId, parkingSlot);
        } else {
            this.vehicleParkingSlots.delete(vehicleId);
        }
    }

    isVehicleStateChanged(vehicleId, nextState) {
        const store = this.ensureCarStore();
        if (!store) return true;
        const previous = store.getVehicleState(vehicleId);
        if (!previous) return true;

        try {
            const epsilon = 1e-6;
            const close = (a, b) => Math.abs(Number(a) - Number(b)) <= epsilon;

            if (!close(previous.speed, nextState.speed)) return true;
            if (!close(previous.position?.x, nextState.position?.x)) return true;
            if (!close(previous.position?.y, nextState.position?.y)) return true;
            if (!close(previous.orientation, nextState.orientation)) return true;
            if (!close(previous.battery, nextState.battery)) return true;
            if (Number(previous.gear) !== Number(nextState.gear)) return true;
            if (!close(previous.steeringAngle, nextState.steeringAngle)) return true;
            if (Number(previous.navigation?.code) !== Number(nextState.navigation?.code)) return true;
            if ((previous.sensors?.camera?.status ?? false) !== (nextState.sensors?.camera?.status ?? false)) return true;
            if ((previous.sensors?.lidar?.status ?? false) !== (nextState.sensors?.lidar?.status ?? false)) return true;
            if ((previous.sensors?.gyro?.status ?? false) !== (nextState.sensors?.gyro?.status ?? false)) return true;
            if (Number(previous.parkingSlot) !== Number(nextState.parkingSlot)) return true;
            return false;
        } catch (error) {
            socketLogger.warn('比较车辆状态失败，默认更新:', error);
            return true;
        }
    }

    /**
     * 设置消息处理器
     */
    setMessageHandler(messageType, handler) {
        this.messageHandlers.set(messageType, handler);
        socketLogger.debug(`设置消息处理器: ${MessageTypeUtils.getReceiveTypeName(messageType)}`);
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
            socketLogger.info(`发送消息成功 - 车辆: ${carId}, 类型: ${typeName}`);
            
            return result;
        } catch (error) {
            socketLogger.error(`发送消息失败 - 车辆: ${carId}:`, error);
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
            socketLogger.info(`广播消息成功 - 类型: ${typeName}, 结果: ${result}`);
            
            return result;
        } catch (error) {
            socketLogger.error('广播消息失败:', error);
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
            
            socketLogger.debug(`获取到 ${result.length} 个已连接车辆`);
            return result;
        } catch (error) {
            socketLogger.error('获取连接车辆失败:', error);
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
        eventBus.emit(EVENTS.VEHICLE_CONNECTION_STATUS, {
            carId,
                isConnected,
                timestamp: Date.now()
        });

        // 触发在线车辆数量变化事件
        eventBus.emit(EVENTS.ONLINE_VEHICLES_COUNT_CHANGED, {
                count: this.getOnlineVehicleCount(),
                vehicleIds: this.getOnlineVehicleIds(),
                timestamp: Date.now()
        });
        
        socketLogger.info(`车辆连接状态更新 - 车辆: ${carId}, 状态: ${isConnected ? '连接' : '断开'}, 在线数量: ${this.getOnlineVehicleCount()}`);
        if (!isConnected) {
            this.vehicleParkingSlots.delete(carId);
        }
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
        socketLogger.debug('SocketManager.setupStatusRequestHandler 已设置');
        eventBus.on(EVENTS.REQUEST_VEHICLE_STATUS, ({ vehicleId }) => {
            const isConnected = this.isVehicleConnected(vehicleId);
            
            socketLogger.debug(`SocketManager收到状态请求 - 车辆: ${vehicleId}, 连接状态: ${isConnected}`);
            
            eventBus.emit(EVENTS.VEHICLE_CONNECTION_STATUS, {
                    carId: vehicleId,
                    isConnected,
                    timestamp: Date.now()
            });
            
            socketLogger.debug(`SocketManager发送状态响应 - 车辆: ${vehicleId}, 连接: ${isConnected}`);
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
     * 发送车辆控制指令
     * @param {number} vehicleId - 车辆ID
     * @param {number} command - 控制指令 (1:启动，2:停止，3:紧急制动，4:初始化位姿)
     * @param {Object} positionData - 位置数据 (仅当指令为4时需要) {x: number, y: number, orientation: number}
     */
    async sendVehicleControl(vehicleId, command, positionData = null) {
        return vehicleBridge.sendVehicleControl(vehicleId, command, positionData);
    }
    
    // 保留原来的实现作为回退
    async sendVehicleControlLegacy(vehicleId, command, positionData = null) {
        try {
            socketLogger.debug(`sendVehicleControlLegacy - 车辆: ${vehicleId}, 指令: ${command}`);
            
            if (command < 1 || command > 4) {
                throw new Error(`无效的控制指令: ${command}`);
            }

            const needsPosition = command === 4;
            const dataSize = needsPosition ? 26 : 2;

            const dataBuffer = new ArrayBuffer(dataSize);
            const dataView = new DataView(dataBuffer);

            dataView.setUint8(0, vehicleId);
            dataView.setUint8(1, command);
            
            if (needsPosition) {
                if (!positionData) {
                    throw new Error('初始化位姿指令需要提供位置数据');
                }
                dataView.setFloat64(2, positionData.x, true);
                dataView.setFloat64(10, positionData.y, true);
                dataView.setFloat64(18, positionData.orientation, true);
            }

            const dataArray = new Uint8Array(dataBuffer);
            const result = await invoke('send_to_vehicle', {
                vehicleId,
                messageType: SEND_MESSAGE_TYPES.VEHICLE_CONTROL,
                data: Array.from(dataArray)
            });
            
            socketLogger.info(`fallback 车辆控制指令发送成功 - 车辆: ${vehicleId}, 指令: ${command}, 数据大小: ${dataSize}字节`);
            return result;
        } catch (error) {
            socketLogger.error(`fallback 发送车辆控制指令失败 - 车辆: ${vehicleId}, 指令: ${command}:`, error);
            throw error;
        }
    }

    /**
     * 便捷方法：启动车辆
     */
    async startVehicle(vehicleId) {
        return vehicleBridge.sendVehicleControl(vehicleId, VEHICLE_CONTROL_PROTOCOL.COMMAND_START);
    }

    /**
     * 便捷方法：停止车辆
     */
    async stopVehicle(vehicleId) {
        return vehicleBridge.sendVehicleControl(vehicleId, VEHICLE_CONTROL_PROTOCOL.COMMAND_STOP);
    }

    /**
     * 便捷方法：紧急制动
     */
    async emergencyBrake(vehicleId) {
        return vehicleBridge.sendVehicleControl(vehicleId, VEHICLE_CONTROL_PROTOCOL.COMMAND_EMERGENCY_BRAKE);
    }


    /**
     * 便捷方法：初始化位姿
     */
    async initializePose(vehicleId, x = 0.0, y = 0.0, orientation = 0.0) {
        return vehicleBridge.sendVehicleControl(vehicleId, VEHICLE_CONTROL_PROTOCOL.COMMAND_INIT_POSE, {
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

            socketLogger.debug(`SocketManager.sendDataRecording - 车辆ID: ${vehicleId}, 启用: ${enabled}`);

            const recordingStatus = enabled ? DATA_RECORDING_PROTOCOL.RECORDING_ON : DATA_RECORDING_PROTOCOL.RECORDING_OFF;
            const result = await vehicleBridge.sendDataRecording(vehicleId, recordingStatus);
            const statusName = DATA_RECORDING_PROTOCOL.STATUS_NAMES[recordingStatus];
            socketLogger.info(`数据记录指令发送成功 - 车辆: ${vehicleId}, 状态: ${statusName}`);
            return result;
        } catch (error) {
            const statusName = enabled ? '开启' : '关闭';
            socketLogger.error(`发送数据记录指令失败 - 车辆: ${vehicleId}, 状态: ${statusName}:`, error);
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

            socketLogger.info(`发送出租车订单 - 订单: ${orderId}, 起点: (${actualStartX}, ${actualStartY}), 终点: (${actualEndX}, ${actualEndY})`);

            // 调用Rust后端进行广播和数据库保存
            const result = await vehicleBridge.broadcastTaxiOrder(orderId, actualStartX, actualStartY, actualEndX, actualEndY);

            socketLogger.info(`出租车订单发送成功 - 订单: ${orderId}`);
            return result;
        } catch (error) {
            socketLogger.error(`发送出租车订单失败 - 订单: ${orderId}:`, error);
            throw error;
        }
    }

    /**
     * 发送出租车订单给指定车辆
     * @param {string} orderId 订单ID (16字节UUID)
     * @param {number} vehicleId 目标车辆ID
     * @param {number} startX 起点X坐标
     * @param {number} startY 起点Y坐标
     * @param {number} endX 终点X坐标
     * @param {number} endY 终点Y坐标
     * @returns {Promise<string>} 发送结果
     */
    async sendTaxiOrderToVehicle(orderId, vehicleId, startX, startY, endX, endY) {
        try {
            socketLogger.info(`发送出租车订单给指定车辆 - 订单: ${orderId}, 车辆: ${vehicleId}, 起点: (${startX}, ${startY}), 终点: (${endX}, ${endY})`);

            // 调用Rust后端发送给指定车辆并保存到数据库
            const result = await vehicleBridge.sendTaxiOrderToVehicle(orderId, vehicleId, startX, startY, endX, endY);

            socketLogger.info(`出租车订单发送成功 - 订单: ${orderId}, 车辆: ${vehicleId}`);
            return result;
        } catch (error) {
            socketLogger.error(`发送出租车订单失败 - 订单: ${orderId}, 车辆: ${vehicleId}:`, error);
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

            socketLogger.info(`发送AVP泊车指令 - 车辆: ${vehicleId}, 车位: ${actualParkingSpot}`);

            const result = await vehicleBridge.sendAvpParking(vehicleId, actualParkingSpot);

            socketLogger.info(`AVP泊车指令发送成功 - 车辆: ${vehicleId}, 车位: ${actualParkingSpot}`);
            return result;
        } catch (error) {
            socketLogger.error(`发送AVP泊车指令失败 - 车辆: ${vehicleId}:`, error);
            throw error;
        }
    }

    /**
     * 发送AVP取车指令
     * @param {number} vehicleId 车辆ID
     * @returns {Promise<string>} 发送结果
     */
    async sendAvpPickup(vehicleId) {
        try {
            if (vehicleId == null) {
                throw new Error('车辆ID不能为空');
            }

            socketLogger.info(`发送AVP取车指令 - 车辆: ${vehicleId}`);

            // 调用Rust后端进行发送和数据库保存
            const result = await vehicleBridge.sendAvpPickup(vehicleId);

            socketLogger.info(`AVP取车指令发送成功 - 车辆: ${vehicleId}`);
            return result;
        } catch (error) {
            socketLogger.error(`发送AVP取车指令失败 - 车辆: ${vehicleId}:`, error);
            throw error;
        }
    }

    /**
     * 发送车辆功能设置指令
     * @param {number} vehicleId - 车辆ID
     * @param {number} functionId - 功能编号 (0:全部, 1:传感器, 2:建图, 3:录制, 4:定位, 5:自主导航, 6:图像识别, 7:打靶功能)
     * @param {number} enableStatus - 启用状态 (0:关闭, 1:启用)
     */
    async sendVehicleFunctionSetting(vehicleId, functionId, enableStatus) {
        try {
            if (vehicleId == null) {
                throw new Error('车辆ID不能为空');
            }
            if (functionId == null || functionId < 0 || functionId > 7) {
                throw new Error('功能编号无效');
            }
            if (enableStatus == null || (enableStatus !== 0 && enableStatus !== 1)) {
                throw new Error('启用状态无效');
            }

            socketLogger.debug(`发送车辆功能设置指令 - 车辆: ${vehicleId}, 功能: ${functionId}, 状态: ${enableStatus}`);

            const result = await vehicleBridge.sendVehicleFunctionSetting(vehicleId, functionId, enableStatus);
            socketLogger.info(`车辆功能设置指令发送成功 - 车辆: ${vehicleId}, 功能: ${functionId}, 状态: ${enableStatus}`);
            return result;
        } catch (error) {
            socketLogger.error(`发送车辆功能设置指令失败 - 车辆: ${vehicleId}:`, error);
            throw error;
        }
    }

    /**
     * 发送车辆路径显示控制指令
     * @param {number} vehicleId - 车辆ID
     * @param {number} displayPath - 显示路径状态 (0:车端不发送, 1:车端开启发送)
     */
    async sendVehiclePathDisplay(vehicleId, displayPath) {
        try {
            if (vehicleId == null) {
                throw new Error('车辆ID不能为空');
            }
            if (displayPath == null || (displayPath !== 0 && displayPath !== 1)) {
                throw new Error('显示路径状态无效');
            }

            socketLogger.debug(`发送车辆路径显示控制指令 - 车辆: ${vehicleId}, 显示路径: ${displayPath ? '开启' : '关闭'}`);

            const result = await vehicleBridge.sendVehiclePathDisplay(vehicleId, displayPath);
            socketLogger.info(`车辆路径显示控制指令发送成功 - 车辆: ${vehicleId}, 显示路径: ${displayPath ? '开启' : '关闭'}`);
            return result;
        } catch (error) {
            socketLogger.error(`发送车辆路径显示控制指令失败 - 车辆: ${vehicleId}:`, error);
            throw error;
        }
    }

    /**
     * 处理未知消息类型
     */
    handleUnknownMessage(carId, messageType, parsed, timestamp) {
        socketLogger.warn(`未知消息类型 0x${messageType.toString(16)} - 车辆: ${carId}, 数据长度: ${parsed?.length ?? 0}`);
        if (parsed) {
            socketLogger.debug('未知消息类型使用parsed数据:', parsed);
        }
        // TODO: 处理未知消息类型
    }

    handleSandboxConnect(payload) {
        socketLogger.info('沙盘客户端连接', payload)
        this.sandboxConnected = true
        eventBus.emit(EVENTS.SANDBOX_CONNECTION_STATUS, { isConnected: true, payload })
    }

    handleSandboxDisconnect(payload) {
        socketLogger.warn('沙盘客户端断开', payload)
        this.sandboxConnected = false
        eventBus.emit(EVENTS.SANDBOX_CONNECTION_STATUS, { isConnected: false, payload })
    }

    isSandboxConnected() {
        return this.sandboxConnected
    }

    setVehicleReady(vehicleId, ready) {
        if (ready) {
            this.vehicleReady.set(vehicleId, true)
        } else {
            this.vehicleReady.delete(vehicleId)
        }
    }

    isVehicleReady(vehicleId) {
        return this.vehicleReady.get(vehicleId) === true
    }

    getSelectedVehicleId() {
        if (typeof window !== 'undefined') {
            const carStore = window.__pinia?.stores?.car || null
            if (carStore?.selectedCarId) {
                return parseVehicleId(carStore.selectedCarId)
            }
        }
        return 0
    }

    getVehicleParkingSlot(vehicleId) {
        return this.vehicleParkingSlots.get(vehicleId) || 0;
    }
}

// 创建全局Socket管理器实例
export const socketManager = new SocketManager();

export default socketManager;
