/**
 * Socket服务端管理工具
 * 负责启动Socket服务器、处理接收消息、发送消息给客户端
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import vehicleBridge from '@/utils/vehicleBridge.js';
import eventBus, { EVENTS } from '@/utils/eventBus.js';
import { RECEIVE_MESSAGE_TYPES, MessageTypeUtils, VEHICLE_CONTROL_PROTOCOL, SEND_MESSAGE_TYPES, AVP_PARKING_PROTOCOL, VEHICLE_CAMERA_PROTOCOL, DATA_RECORDING_PROTOCOL, SANDBOX_LIGHTING_PROTOCOL, SANDBOX_TRAFFIC_LIGHT_PROTOCOL } from '@/constants/messageTypes.js';
import Toast from '@/utils/toast.js';
import { createLogger, logger } from '@/utils/logger.js';
import { debug as plDebug, info as plInfo, warn as plWarn, error as plError } from '@tauri-apps/plugin-log';
import logHelper from '@/utils/logHelper.js'
import { normalizeVehicleList, parseVehicleId } from '@/utils/vehicleTypes.js'
import { useCarStore } from '@/stores/car.js'
import { throttle, createThrottledEmitter } from '@/utils/eventThrottle.js';

const socketLogger = createLogger('SocketManager');
const bytesToHex = (bytes) => Array.from(bytes || [], (b) => b.toString(16).padStart(2, '0')).join(' ');

class SocketManager {
    constructor() {
        this.isServerRunning = false;
        this.parallelOverride = new Set(); // Tracks vehicles whose camera was temporarily enabled for Parallel Driving
        this.pendingCameraPromise = Promise.resolve(); // For sequentializing camera toggle commands
        this.messageHandlers = new Map();
        this.carStore = null;
        this._rustCompareErrorLogged = false; // 避免重复记录Rust比对错误
        
        // 创建节流的事件发射器（性能优化）
        this.throttledEmitters = {
            vehicleInfo: createThrottledEmitter(eventBus, EVENTS.VEHICLE_INFO_UPDATE, 50), // 50ms节流
            connectionStatus: createThrottledEmitter(eventBus, EVENTS.VEHICLE_CONNECTION_STATUS, 100),
            onlineCountChanged: createThrottledEmitter(eventBus, EVENTS.ONLINE_VEHICLES_COUNT_CHANGED, 200),
        };
        
        // 设置默认消息处理器
        this.setupDefaultHandlers();
        
        // 监听车辆状态请求事件
        this.setupStatusRequestHandler();
    }

    /**
     * 获取carStore实例（延迟加载）
     * @returns {Object} carStore实例
     */
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
     * 转换颜色格式：rgb(r, g, b) 或 #RRGGBB -> #RRGGBB
     * @param {string} color - 颜色字符串
     * @returns {string|null} 十六进制颜色或null
     */
    convertColorToHex(color) {
        if (!color) return null;
        
        // 已经是十六进制格式
        if (color.startsWith('#')) {
            return color;
        }
        
        // rgb(r, g, b) 格式
        const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        }
        
        return null;
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
            
            // 触发服务器启动事件（用于显示网络信息）
            eventBus.emit(EVENTS.SOCKET_SERVER_STARTED, result);
            
            // 开始监听消息
            this.startListening();
            
            return result;
        } catch (error) {
            socketLogger.error('启动Socket服务器失败:', error);
            Toast.warning(`启动Socket服务器失败: ${error}`);
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
        
        // 只有车辆消息才更新车辆状态（沙盘消息的 vehicle_id 可能无效）
        if (vehicle_id && vehicle_id > 0) {
            this.updateVehicleStatus(vehicle_id, true);
        }
        
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
            // socketLogger.info(`收到车辆信息 - 车辆: ${carId}`);
            this.updateVehicleInfoFromParsed(carId, parsed, timestamp);
        });

        // 路径文件选择协议处理（0x0003）
        this.setMessageHandler(RECEIVE_MESSAGE_TYPES.PATH_FILE_SELECTION, async (carId, parsed, timestamp) => {
            await this.handlePathFileSelection(carId, parsed, timestamp);
        });

        // 沙盘红绿灯状态协议处理（0x3001）
        this.setMessageHandler(RECEIVE_MESSAGE_TYPES.SANDBOX_TRAFFIC_LIGHT_STATUS, async (carId, parsed, timestamp) => {
            await this.handleTrafficLightStatus(carId, parsed, timestamp);
        });
    }

    /**
     * 更新车辆信息（优化版：完全依赖Rust状态比对）
     * @param {number} carId - 车辆ID
     * @param {Object} parsed - 解析后的车辆数据
     * @param {number} timestamp - 时间戳
     */
    async updateVehicleInfoFromParsed(carId, parsed, timestamp) {
        // 空值检查：验证输入参数
        if (!parsed || typeof parsed !== 'object') {
            socketLogger.warn(`无效的解析数据: carId=${carId}`);
            return;
        }
        
        // 类型安全：确保 vehicleId 有效
        const vehicleId = Number(parsed.vehicle_id ?? parsed.carId ?? carId);
        if (isNaN(vehicleId) || vehicleId <= 0) {
            socketLogger.warn(`无效的车辆ID: ${vehicleId}`);
            return;
        }
        
        // 安全地提取数值，带有范围验证
        const speed = Math.max(0, Number(parsed.speed ?? 0));
        const battery = Math.max(0, Math.min(100, Number(parsed.battery ?? 0)));
        const orientation = Number(parsed.orientation ?? 0);
        const steeringAngle = Number(parsed.steeringAngle ?? 0);
        const parkingSlot = Math.max(0, Number(parsed.parkingSlot ?? 0));
        
        // 安全地提取对象，确保有默认值
        const position = (parsed.position && typeof parsed.position === 'object') 
            ? { x: Number(parsed.position.x ?? 0), y: Number(parsed.position.y ?? 0) }
            : { x: 0, y: 0 };
        
        const navigation = (parsed.navigation && typeof parsed.navigation === 'object')
            ? { 
                code: Number(parsed.navigation.code ?? 0), 
                text: String(parsed.navigation.text ?? '未知状态') 
              }
            : { code: 0, text: '未知状态' };
        
        const sensors = (parsed.sensors && typeof parsed.sensors === 'object')
            ? parsed.sensors
            : {};
        
        const gear = this.extractGear(parsed.gear);

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

        // ✅ 优化：使用Rust进行状态比对（移除JS端重复比对）
        const store = this.ensureCarStore();
        if (store) {
            const prevVehicleState = store.getVehicleState(vehicleId);
            
            // 如果有前一个状态且数据完整，使用Rust比对
            if (prevVehicleState && prevVehicleState.state) {
                try {
                    // 准备前一个状态（需要包含停车位信息）
                    const prevState = {
                        ...prevVehicleState.state,
                        parkingSlot: prevVehicleState.parking.slotId,
                        vehicleId: vehicleId
                    };
                    
                    // 准备Rust比对所需的数据格式
                    const prevForRust = this.prepareStateForRustComparison(prevState);
                    const nextForRust = this.prepareStateForRustComparison(vehicleInfo);
                    
                    const { invoke } = await import('@tauri-apps/api/core');
                    const result = await invoke('is_vehicle_state_changed', {
                        prev: prevForRust,
                        next: nextForRust
                    });

                    if (!result.changed) {
            socketLogger.debug(`车辆 ${vehicleId} 数据未变化，跳过UI更新`);
            return;
        }

                    // 记录变化的字段（开发环境）
                    if (import.meta.env.DEV && result.changed_fields?.length > 0) {
                        socketLogger.debug(`车辆 ${vehicleId} 变化字段: ${result.changed_fields.join(', ')}`);
                    }
                } catch (error) {
                    // Rust比对失败时回退到更新（保证可靠性）
                    // 只在第一次失败时警告，避免日志刷屏
                    if (!this._rustCompareErrorLogged) {
                        socketLogger.warn(`Rust状态比对失败，回退到直接更新:`, error.message || error);
                        this._rustCompareErrorLogged = true;
                    }
                }
            }

            // 更新状态到store
            store.updateVehicleState(vehicleId, vehicleInfo);
        }

        logger.outputToPlugin('DEBUG', 'SocketManager.vehicleInfoUpdate', [
            `车辆:${vehicleId} 速:${speed.toFixed(3)} 位置:(${position.x?.toFixed?.(2) ?? position.x},${position.y?.toFixed?.(2) ?? position.y}) 电:${battery.toFixed?.(1) ?? battery}%`
        ], { throttle: true, throttleKey: `vinfo-ok-${vehicleId}`, interval: 500 });

        // 使用节流的事件发射器（性能优化）
        this.throttledEmitters.vehicleInfo(vehicleInfo);
    }

    /**
     * 准备用于Rust比对的状态数据
     * @param {Object} state - 车辆状态
     * @returns {Object} Rust VehicleInfo格式
     */
    prepareStateForRustComparison(state) {
        // 获取档位值（可能是对象或数字）
        let gearValue = state.gear?.value ?? state.gear ?? 1;
        if (typeof gearValue !== 'number') {
            gearValue = 1; // 默认为P档
        }

        // 转换档位为Rust枚举格式
        let gearEnum;
        switch (gearValue) {
            case 1:
                gearEnum = 'Park';
                break;
            case 2:
                gearEnum = 'Reverse';
                break;
            case 3:
                gearEnum = 'Neutral';
                break;
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
            case 9:
                gearEnum = { DriveLevel: gearValue - 3 };
                break;
            default:
                gearEnum = 'Park';
        }

        return {
            vehicle_id: Number(state.vehicleId ?? state.vehicle_id ?? 0),
            speed: Number(state.speed ?? 0),
            position_x: Number(state.position?.x ?? 0),
            position_y: Number(state.position?.y ?? 0),
            orientation: Number(state.orientation ?? 0),
            battery: Number(state.battery ?? 0),
            gear: gearEnum,
            steering_angle: Number(state.steeringAngle ?? state.steering_angle ?? 0),
            nav_status: Number(state.navigation?.code ?? state.nav_status ?? 0),
            sensors: {
                camera: Boolean(state.sensors?.camera?.status ?? false),
                lidar: Boolean(state.sensors?.lidar?.status ?? false),
                gyro: Boolean(state.sensors?.gyro?.status ?? false),
            },
            parking_slot: Number(state.parkingSlot ?? state.parking_slot ?? 0),
        };
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
            Toast.warning(`发送消息失败: ${error}`);
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
            Toast.warning(`广播消息失败: ${error}`);
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
     * 更新车辆状态（委托给store）
     */
    updateVehicleStatus(carId, isConnected) {
        const store = this.ensureCarStore();
        if (!store) {
            socketLogger.warn('carStore未初始化，无法更新车辆状态');
            return;
        }
        
        // 更新store中的连接状态
        store.updateVehicleConnection(carId, isConnected, {
            lastSeen: Date.now()
        });
        
        // 使用节流的事件发射器（性能优化）
        this.throttledEmitters.connectionStatus({
            carId,
                isConnected,
                timestamp: Date.now()
        });

        this.throttledEmitters.onlineCountChanged({
            count: store.getOnlineVehicleCount(),
            vehicleIds: store.getOnlineVehicleIds(),
                timestamp: Date.now()
        });
        
        // socketLogger.info(`车辆连接状态更新 - 车辆: ${carId}, 状态: ${isConnected ? '连接' : '断开'}, 在线数量: ${store.getOnlineVehicleCount()}`);
    }

    /**
     * 检查车辆是否连接（委托给store）
     */
    isVehicleConnected(vehicleId) {
        const store = this.ensureCarStore();
        return store ? store.isVehicleOnline(vehicleId) : false;
    }

    /**
     * 获取车辆连接信息（委托给store）
     */
    getVehicleConnection(vehicleId) {
        const store = this.ensureCarStore();
        if (!store) return null;
        const state = store.getVehicleState(vehicleId);
        return state ? {
            car_id: vehicleId,
            connected: state.connection.isOnline,
            last_seen: state.connection.lastSeen
        } : null;
    }

    /**
     * 获取当前在线车辆数量（委托给store）
     */
    getOnlineVehicleCount() {
        const store = this.ensureCarStore();
        return store ? store.getOnlineVehicleCount() : 0;
    }

    /**
     * 获取所有在线车辆ID列表（委托给store）
     */
    getOnlineVehicleIds() {
        const store = this.ensureCarStore();
        return store ? store.getOnlineVehicleIds() : [];
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
     * 处理路径文件选择协议（0x0003）
     * @param {number} carId - 车辆ID
     * @param {Object} parsed - 解析后的路径选择数据
     * @param {number} timestamp - 时间戳
     */
    async handlePathFileSelection(carId, parsed, timestamp) {
        try {
            // 调试：输出 parsed 对象的完整内容
            socketLogger.debug(`收到路径文件选择原始数据 - 车辆: ${carId}, parsed:`, JSON.stringify(parsed));
            
            // 检查 parsed 对象
            if (!parsed) {
                socketLogger.error(`路径文件选择数据为空 - 车辆: ${carId}`);
                return;
            }
            
            const pathFileIds = parsed.path_file_ids || [];
            socketLogger.info(`收到路径文件选择 - 车辆: ${carId}, 路径编号: [${pathFileIds.join(', ')}], 数量: ${pathFileIds.length}`);
            
            // 检查路径编号列表
            if (pathFileIds.length === 0) {
                socketLogger.warn(`车辆 ${carId} 的路径编号列表为空`);
                return;
            }
            
            // 获取车辆颜色（从 carStore.carList）
            let vehicleColor = null;
            const carStore = this.ensureCarStore();
            if (carStore && Array.isArray(carStore.carList)) {
                const vehicle = carStore.carList.find(v => v.id === carId);
                if (vehicle && vehicle.color) {
                    // 转换颜色格式：rgb(r, g, b) -> #RRGGBB
                    vehicleColor = this.convertColorToHex(vehicle.color);
                }
            }
            
            // 发送事件到 pathManager（包含颜色信息）
            eventBus.emit(EVENTS.VEHICLE_PATH_UPDATE, {
                vehicleId: carId,
                pathFileIds: pathFileIds,
                color: vehicleColor,
                timestamp
            });
        } catch (error) {
            socketLogger.error(`处理路径文件选择失败 - 车辆: ${carId}:`, error);
            socketLogger.error(`错误详情: ${error.message || '未知错误'}`);
            socketLogger.error(`错误堆栈:`, error.stack || '无堆栈信息');
        }
    }

    /**
     * 处理沙盘红绿灯状态协议（0x3001）
     * @param {number} carId - 车辆ID（沙盘消息此参数无效，可忽略）
     * @param {Object} parsed - 解析后的红绿灯状态数据
     * @param {number} timestamp - 时间戳
     */
    async handleTrafficLightStatus(carId, parsed, timestamp) {
        try {
            if (!parsed) {
                socketLogger.error(`红绿灯状态数据为空`);
                return;
            }

            // 从解析数据中提取两组红绿灯的状态
            const lights = parsed.lights || [];
            
            if (lights.length < 2) {
                socketLogger.warn(`红绿灯状态数据不完整，需要2组数据，实际收到: ${lights.length}组`);
                return;
            }

            socketLogger.info(
                `收到红绿灯状态 - ` +
                `1组(6个): ${SANDBOX_TRAFFIC_LIGHT_PROTOCOL.COLOR_NAMES[lights[0].color] || '未知'} ${lights[0].remaining}秒, ` +
                `2组(2个): ${SANDBOX_TRAFFIC_LIGHT_PROTOCOL.COLOR_NAMES[lights[1].color] || '未知'} ${lights[1].remaining}秒`
            );

            // 动态导入 Scene3D 模块（避免循环依赖）
            const { updateTrafficLightGroup, isTrafficLightManagerInitialized } = await import('@/components/Scene3D/index.js');
            
            // 检查红绿灯管理器是否已初始化
            if (!isTrafficLightManagerInitialized()) {
                socketLogger.warn('红绿灯管理器未初始化，跳过更新');
                return;
            }

            // 更新两组红绿灯状态
            // lights[0] -> 1组（6个红绿灯）-> groupIndex = 1
            // lights[1] -> 2组（2个红绿灯）-> groupIndex = 0
            updateTrafficLightGroup(1, lights[0].color, lights[0].remaining);
            updateTrafficLightGroup(0, lights[1].color, lights[1].remaining);

        } catch (error) {
            socketLogger.error(`处理红绿灯状态失败:`, error);
            socketLogger.error(`错误详情: ${error.message || '未知错误'}`);
            socketLogger.error(`错误堆栈:`, error.stack || '无堆栈信息');
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
     * 批量发送车辆路径显示控制指令（给所有指定车辆）
     * @param {Array<number>} vehicleIds - 车辆ID数组
     * @param {number} displayPath - 显示路径状态 (0:关闭, 1:开启)
     */
    async sendBatchVehiclePathDisplay(vehicleIds, displayPath) {
        try {
            if (!Array.isArray(vehicleIds) || vehicleIds.length === 0) {
                throw new Error('车辆ID数组不能为空');
            }
            if (displayPath == null || (displayPath !== 0 && displayPath !== 1)) {
                throw new Error('显示路径状态无效');
            }

            socketLogger.info(`批量发送路径显示控制指令 - ${vehicleIds.length} 辆车, 状态: ${displayPath ? '开启' : '关闭'}`);

            const { invoke } = await import('@tauri-apps/api/core');
            
            // 构建批量发送的数据
            // 每辆车的数据域: [车辆编号(1字节), 显示路径(1字节)]
            const vehicles = vehicleIds.map(vehicleId => ({
                vehicle_id: Number(vehicleId),
                message_type: SEND_MESSAGE_TYPES.VEHICLE_PATH_DISPLAY, // 0x1007
                data: [
                    Number(vehicleId), // 第一个字节：车辆编号
                    displayPath        // 第二个字节：显示路径状态
                ]
            }));
            
            // 调用 Rust 批量发送命令
            const result = await invoke('batch_send_to_vehicles', { vehicles });
            
            if (result.error_count > 0) {
                socketLogger.warn(`批量路径显示控制部分失败 - 成功: ${result.success_count}, 失败: ${result.error_count}`);
                console.warn('失败详情:', result.errors);
            } else {
                socketLogger.info(`批量路径显示控制全部成功 - ${result.success_count} 辆车`);
            }
            
            return result;
        } catch (error) {
            socketLogger.error(`批量发送路径显示控制指令失败:`, error);
            throw error;
        }
    }
    
    /**
     * 处理沙盘连接（委托给store）
     */
    handleSandboxConnect(payload) {
        socketLogger.info('沙盘客户端连接', payload);
        const store = this.ensureCarStore();
        if (store) {
            store.setSandboxConnected(true);
        }
        eventBus.emit(EVENTS.SANDBOX_CONNECTION_STATUS, { isConnected: true, payload });
    }

    /**
     * 处理沙盘断开（委托给store）
     */
    handleSandboxDisconnect(payload) {
        socketLogger.warn('沙盘客户端断开', payload);
        const store = this.ensureCarStore();
        if (store) {
            store.setSandboxConnected(false);
        }
        eventBus.emit(EVENTS.SANDBOX_CONNECTION_STATUS, { isConnected: false, payload });
    }

    /**
     * 检查沙盘是否连接（委托给store）
     */
    isSandboxConnected() {
        const store = this.ensureCarStore();
        return store ? store.isSandboxConnected() : false;
    }

    /**
     * 设置车辆就绪状态（委托给store）
     */
    setVehicleReady(vehicleId, ready) {
        const store = this.ensureCarStore();
        if (store) {
            store.setVehicleReady(vehicleId, ready);
        }
    }

    /**
     * 检查车辆是否就绪（委托给store）
     */
    isVehicleReady(vehicleId) {
        const store = this.ensureCarStore();
        return store ? store.isVehicleReady(vehicleId) : false;
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

    /**
     * 获取车辆停车位（委托给store）
     */
    getVehicleParkingSlot(vehicleId) {
        const store = this.ensureCarStore();
        return store ? store.getVehicleParkingSlot(vehicleId) : 0;
    }

    /**
     * 记录某车辆摄像头的手动状态（委托给store）
     */
    setManualCameraState(vehicleId, enabled) {
        if (!Number.isFinite(vehicleId)) return;
        const store = this.ensureCarStore();
        if (store) {
            store.setManualCameraState(vehicleId, enabled);
        }
    }

    /**
     * 检查摄像头手动状态（委托给store）
     */
    isManualCameraEnabled(vehicleId) {
        if (!Number.isFinite(vehicleId)) return false;
        const store = this.ensureCarStore();
        return store ? store.isManualCameraEnabled(vehicleId) : false;
    }

    markManualCameraState() {
        // 保留空方法以兼容旧代码
    }

    /**
     * 发送车辆摄像头开关指令，确保同一时间只有一个车辆处于开启状态（委托给store）
     */
    async toggleVehicleCamera(vehicleId, enabled, { force = false } = {}) {
        const normalizedId = parseVehicleId(vehicleId, 0);
        if (!normalizedId) {
            socketLogger.warn('toggleVehicleCamera: vehicleId 无效', vehicleId);
            return;
        }

        const store = this.ensureCarStore();
        if (!store) {
            socketLogger.warn('carStore未初始化，无法切换摄像头');
            return;
        }

        const desiredStatus = enabled ? VEHICLE_CAMERA_PROTOCOL.STATUS_ON : VEHICLE_CAMERA_PROTOCOL.STATUS_OFF;
        const activeCameraId = store.getActiveCameraVehicleId();

        if (!force) {
            if (enabled) {
                if (activeCameraId === normalizedId) {
                    socketLogger.debug(`[CameraToggle] 车辆${normalizedId} 已处于开启状态，跳过发送`);
                    return;
                }
            } else {
                if (activeCameraId !== normalizedId) {
                    socketLogger.debug(`[CameraToggle] 车辆${normalizedId} 已处于关闭状态，跳过发送`);
                    return;
                }
            }
        }

        const execute = async () => {
            // 如果要开启，先关闭其他车辆
            if (enabled && activeCameraId && activeCameraId !== normalizedId) {
                try {
                    socketLogger.info(`[CameraToggle] 切换摄像头源: ${activeCameraId} -> ${normalizedId}`);
                    await vehicleBridge.sendVehicleCameraToggle(activeCameraId, false);
                    store.setActiveCameraState(activeCameraId, false);
                } catch (error) {
                    socketLogger.warn(`关闭车辆 ${activeCameraId} 摄像头失败:`, error);
                }
            }

            try {
                await vehicleBridge.sendVehicleCameraToggle(normalizedId, desiredStatus === VEHICLE_CAMERA_PROTOCOL.STATUS_ON);
                socketLogger.info(`[CameraToggle] 车辆 ${normalizedId} 摄像头${enabled ? '开启' : '关闭'} 指令已发送`);
                
                // 更新store中的激活状态
                store.setActiveCameraState(normalizedId, enabled);
                
                if (!enabled) {
                    this.parallelOverride.delete(normalizedId);
                }
            } catch (error) {
                socketLogger.error(`发送车辆 ${normalizedId} 摄像头开关失败:`, error);
                throw error;
            }
        };

        this.pendingCameraPromise = this.pendingCameraPromise.then(execute, execute);
        return this.pendingCameraPromise;
    }

    async enforceCameraStatesOnShow(vehicleId) {
        const normalizedId = parseVehicleId(vehicleId, 0);
        if (!normalizedId) return;
        const store = this.ensureCarStore();
        const shouldEnable = store?.isManualCameraEnabled?.(normalizedId);
        if (shouldEnable) {
            await this.toggleVehicleCamera(normalizedId, true);
        }
    }

    async enforceCameraStatesOnHide(vehicleId) {
        const normalizedId = parseVehicleId(vehicleId, 0);
        if (!normalizedId) return;
        const store = this.ensureCarStore();
        const shouldDisable = store?.isManualCameraEnabled?.(normalizedId);
        if (shouldDisable) {
            await this.toggleVehicleCamera(normalizedId, false);
        }
    }

    markParallelOverride(vehicleId, enabled) {
        const normalizedId = parseVehicleId(vehicleId, 0);
        if (!normalizedId) return;
        if (enabled) {
            this.parallelOverride.add(normalizedId);
        } else {
            this.parallelOverride.delete(normalizedId);
        }
    }

    hasParallelOverride(vehicleId) {
        const normalizedId = parseVehicleId(vehicleId, 0);
        if (!normalizedId) return false;
        return this.parallelOverride.has(normalizedId);
    }

    async sendSandboxLightingControl({ ambient, building, street }) {
        const values = { ambient, building, street };
        for (const [name, value] of Object.entries(values)) {
            if (!Number.isInteger(value) || (value !== 0 && value !== 1)) {
                throw new Error(`${name} 状态无效`);
            }
        }

        try {
            await invoke('send_sandbox_lighting_control', values);
            socketLogger.info(`[SandboxLighting] 已发送灯光状态: 环境=${ambient}, 建筑=${building}, 路灯=${street}`);
        } catch (error) {
            socketLogger.error('发送沙盘灯光控制指令失败:', error);
            throw error;
        }
    }

    extractGear(gearData) {
        if (!gearData) return 'P';
        if (typeof gearData === 'string') return gearData;
        const value = Number(gearData.value ?? gearData);
        switch (value) {
            case 1: return 'P';
            case 2: return 'R';
            case 3: return 'N';
            case 4: return 'D1';
            case 5: return 'D2';
            case 6: return 'D3';
            case 7: return 'D4';
            case 8: return 'D5';
            case 9: return 'D';
            default: return 'P';
        }
    }
}

// 创建全局Socket管理器实例
export const socketManager = new SocketManager();

export default socketManager;