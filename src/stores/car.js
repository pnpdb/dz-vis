import { defineStore } from 'pinia';
import { VehicleConnectionAPI } from '@/utils/vehicleAPI.js';
import { normalizeVehicleList, parseVehicleId, compareVehicleId } from '@/utils/vehicleTypes.js';
import { vehicleToModelCoordinates, applyOffsetToReceived } from '@/utils/coordinateTransform.js';
import eventBus, { EVENTS } from '@/utils/eventBus.js';
import { throttle } from '@/utils/throttle.js';
import { deepClone } from '@/utils/stateManager.js';
import { validateVehicleInfo } from '@/utils/validation.js';

const filePath = localStorage.getItem('filePath') || '';

// 性能优化：为高频事件创建节流函数
const throttledVehicleStateUpdate = throttle((data) => {
    eventBus.emit(EVENTS.VEHICLE_STATE_UPDATED, data);
}, 50); // 每50ms最多触发一次

// 🧹 定期清理任务：防止内存泄漏
let cleanupInterval = null;

// 启动定期清理任务（在Store初始化后调用）
const startCleanupTask = (store) => {
    if (cleanupInterval) {
        return; // 已经启动
    }
    
    // 每2分钟执行一次清理
    cleanupInterval = setInterval(() => {
        try {
            store.cleanupIdleVehicles();
        } catch (error) {
            console.error('定期清理任务执行失败:', error);
        }
    }, 2 * 60 * 1000); // 2分钟
    
    console.log('✅ 车辆状态定期清理任务已启动 (每2分钟)');
};

// 停止定期清理任务
const stopCleanupTask = () => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
        console.log('🛑 车辆状态定期清理任务已停止');
    }
};

// 🧹 清理 beforeunload 监听器（避免内存泄漏）
const cleanupBeforeUnloadListener = () => {
    if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', stopCleanupTask);
    }
};

// 确保应用关闭时停止清理任务
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', stopCleanupTask);
}

export const useCarStore = defineStore('car', {
    state: () => ({
        filePath,
        selectedCarId: '',
        carList: [], // 从数据库加载的车辆列表
        count: 0,
        name: 'Eduardo',
        loading: false,
        
        // ========== 统一的车辆状态管理 ==========
        // 将原本分散在socketManager中的状态统一管理到这里
        vehicles: new Map(), // Map<vehicleId, VehicleState>
        
        // 出租车状态管理
        taxi: {
            startPoint: '',
            endPoint: '',
            startCoords: null, // { x, z }
            endCoords: null,   // { x, z }
        },
        
        // 打车状态管理：存储正在打车的车辆信息
        // Map<vehicleId, { startCoords: {x, z}, endCoords: {x, z}, orderId: string }>
        activeTaxiRides: new Map(),
        
        // 沙盘连接状态
        sandboxConnected: false,
        
        // 内存管理配置（防止内存泄漏）
        maxVehicles: 50, // 最大车辆数量
        vehicleIdleTimeout: 10 * 60 * 1000, // 10分钟未活动视为闲置
    }),
    getters: {
        selectedCar: state => {
            const car = state.carList.find(
                car => car.id === state.selectedCarId
            );
            return car || (state.carList.length > 0 ? state.carList[0] : null);
        },
        // 返回可用的车辆列表
        availableCarList: state => {
            return state.carList;
        },
    },
    actions: {
        // ========== 初始化和清理 ==========
        
        /**
         * 初始化Store（启动定期清理任务）
         * 应该在应用启动时调用一次
         */
        init() {
            startCleanupTask(this);
        },
        
        /**
         * 销毁Store（停止定期清理任务）
         * 应该在应用关闭时调用
         */
        destroy() {
            stopCleanupTask();
            cleanupBeforeUnloadListener(); // 🧹 清理事件监听器
        },
        
        changeCarId(id) {
            this.selectedCarId = parseVehicleId(id);
        },

        setCameraEnabled(enabled) {
            this.cameraEnabled = Boolean(enabled);
        },

        // ========== 统一的车辆状态管理方法 ==========
        
        /**
         * 获取或创建车辆状态对象
         * @param {number} vehicleId - 车辆ID
         * @returns {Object} 车辆状态对象
         */
        getOrCreateVehicleState(vehicleId) {
            const normalizedId = parseVehicleId(vehicleId, 0);
            if (!normalizedId) return null;
            
            if (!this.vehicles.has(normalizedId)) {
                this.vehicles.set(normalizedId, {
                    // 连接状态
                    connection: {
                        isOnline: false,
                        lastSeen: null,
                        addr: null,
                    },
                    // 运行状态
                    state: {
                        position: { x: 0, y: 0 },
                        speed: 0,
                        battery: 0,
                        gear: 'P',
                        orientation: 0,
                        steeringAngle: 0,
                        navigation: { code: 0, text: '未知状态' },
                        sensors: {
                            camera: { status: false },
                            lidar: { status: false },
                            gyro: { status: false },
                        },
                        timestamp: null,
                    },
                    // 摄像头状态
                    camera: {
                        isManualOn: false,
                        isActive: false,
                    },
                    // 停车位状态
                    parking: {
                        slotId: 0,
                    },
                    // 就绪状态
                    readiness: {
                        isReady: false,
                    },
                });
            }
            
            return this.vehicles.get(normalizedId);
        },
        
        /**
         * 更新车辆连接状态
         * @param {number} vehicleId - 车辆ID
         * @param {boolean} isOnline - 是否在线
         * @param {Object} options - 额外选项 {lastSeen, addr}
         */
        updateVehicleConnection(vehicleId, isOnline, options = {}) {
            const state = this.getOrCreateVehicleState(vehicleId);
            if (!state) return;
            
            state.connection.isOnline = isOnline;
            state.connection.lastSeen = options.lastSeen || Date.now();
            if (options.addr) {
                state.connection.addr = options.addr;
            }
            
            // 离线时清理相关状态
            if (!isOnline) {
                state.parking.slotId = 0;
                state.camera.isActive = false;
                // 清理导航状态
                state.state.navigation = { code: 0, text: '未知状态' };
                
                // 🚕 清理打车状态：如果该车辆正在执行打车任务，清除打车订单
                if (this.isVehicleInTaxiMode(vehicleId)) {
                    this.removeActiveTaxiRide(vehicleId);
                    console.log(`🚗 车辆 ${vehicleId} 断开连接，已清除打车订单`);
                    
                    // 清除该车辆的专属打车图标
                    // 注意：这里使用动态导入避免循环依赖
                    import('@/components/Scene3D/index.js').then(({ removeTaxiMarkersForVehicle }) => {
                        removeTaxiMarkersForVehicle(vehicleId);
                        console.log(`🗺️ 已清除车辆 ${vehicleId} 的打车图标`);
                    }).catch(err => {
                        console.warn('清除车辆打车图标失败:', err);
                    });
                }
            }
            
            // 触发车辆连接状态变化事件（用于3D模型管理）
            eventBus.emit(EVENTS.VEHICLE_CONNECTION_CHANGED, {
                vehicleId,
                isOnline
            });
            
            // 内存管理：检查是否需要清理闲置车辆
            this.cleanupIdleVehicles();
        },
        
        /**
         * 更新车辆运行状态
         * @param {number} vehicleId - 车辆ID
         * @param {Object} vehicleInfo - 车辆信息
         */
        updateVehicleState(vehicleId, vehicleInfo) {
            // 验证输入数据（使用统一验证工具）
            const validation = validateVehicleInfo(vehicleInfo);
            if (!validation.valid) {
                console.warn(`⚠️ 车辆 ${vehicleId} 状态数据验证失败:`, validation.errors);
                // 继续处理，但记录警告
            }
            
            const state = this.getOrCreateVehicleState(vehicleId);
            if (!state) return;
            
            // 1️⃣ 获取原始坐标
            const rawPosition = vehicleInfo.position || state.state.position;
            
            // 2️⃣ 应用坐标偏移量（接收坐标加偏移量）
            const offsetPosition = applyOffsetToReceived(rawPosition.x, rawPosition.y);
            
            // 不可变更新运行状态（架构优化：避免直接修改，使用不可变更新）
            state.state = {
                ...state.state,
                position: offsetPosition,  // 保存应用偏移后的车辆坐标系（用于显示）
                speed: vehicleInfo.speed ?? state.state.speed,
                battery: vehicleInfo.battery ?? state.state.battery,
                gear: vehicleInfo.gear || state.state.gear,
                orientation: vehicleInfo.orientation ?? state.state.orientation,
                steeringAngle: vehicleInfo.steeringAngle ?? state.state.steeringAngle,
                navigation: vehicleInfo.navigation || state.state.navigation,
                sensors: vehicleInfo.sensors || state.state.sensors,
                timestamp: vehicleInfo.timestamp || Date.now(),
            };
            
            // 不可变更新停车位（避免直接修改）
            if (vehicleInfo.parkingSlot !== undefined) {
                state.parking = {
                    ...state.parking,
                    slotId: vehicleInfo.parkingSlot
                };
            }
            
            // 触发状态更新事件（传递完整的车辆信息，包括传感器状态等）
            eventBus.emit(EVENTS.VEHICLE_INFO_UPDATE, {
                vehicleId,
                ...state.state,  // 展开所有状态字段（包含应用偏移后的车辆坐标系position）
                sensors: state.state.sensors || { camera: false, lidar: false, gyro: false }
            });
            
            // 3️⃣ 转换为模型坐标系（用于3D模型渲染）
            const modelCoords = vehicleToModelCoordinates(
                offsetPosition.x, 
                offsetPosition.y
            );
            const modelPosition = {
                x: modelCoords.x,
                z: modelCoords.z  // 车辆的Y对应模型的Z
            };
            
            // 触发车辆状态更新事件（用于3D模型位置更新，传递模型坐标系）
            // 使用节流避免高频更新影响性能（每秒2次变为每秒最多20次）
            throttledVehicleStateUpdate({
                vehicleId,
                position: modelPosition,  // 模型坐标系
                orientation: vehicleInfo.orientation ?? state.state.orientation
            });
        },
        
        /**
         * 获取车辆状态
         * @param {number} vehicleId - 车辆ID
         * @returns {Object|null} 车辆状态
         */
        getVehicleState(vehicleId) {
            const normalizedId = parseVehicleId(vehicleId, 0);
            return this.vehicles.get(normalizedId) || null;
        },
        
        /**
         * 获取车辆运行状态（向后兼容）
         * @param {number} vehicleId - 车辆ID
         * @returns {Object|null} 车辆运行状态
         */
        getVehicleRuntimeState(vehicleId) {
            const state = this.getVehicleState(vehicleId);
            return state ? state.state : null;
        },
        
        /**
         * 检查车辆是否在线
         * @param {number} vehicleId - 车辆ID
         * @returns {boolean} 是否在线
         */
        isVehicleOnline(vehicleId) {
            const state = this.getVehicleState(vehicleId);
            return state ? state.connection.isOnline : false;
        },
        
        /**
         * 获取在线车辆数量
         * @returns {number} 在线车辆数量
         */
        getOnlineVehicleCount() {
            let count = 0;
            for (const state of this.vehicles.values()) {
                if (state.connection.isOnline) count++;
            }
            return count;
        },
        
        /**
         * 获取所有在线车辆ID列表
         * @returns {Array<number>} 在线车辆ID数组
         */
        getOnlineVehicleIds() {
            const ids = [];
            for (const [id, state] of this.vehicles.entries()) {
                if (state.connection.isOnline) ids.push(id);
            }
            return ids;
        },
        
        /**
         * 清理闲置车辆（内存泄漏防护）
         * 移除长时间未活动且离线的车辆状态
         */
        cleanupIdleVehicles() {
            const now = Date.now();
            const vehiclesToRemove = [];
            
            // 🚀 优化：始终清理超时的离线车辆，不只在超过最大数量时
            // 找出需要清理的车辆
            for (const [vehicleId, state] of this.vehicles.entries()) {
                // 只清理离线车辆
                if (!state.connection.isOnline) {
                    const idleTime = now - (state.connection.lastSeen || 0);
                    if (idleTime > this.vehicleIdleTimeout) {
                        vehiclesToRemove.push(vehicleId);
                    }
                }
            }
            
            // 如果超过最大车辆数，额外清理最久未活动的离线车辆
            if (this.vehicles.size > this.maxVehicles) {
                // 按最后活跃时间排序，优先删除最久未活动的
                const offlineVehicles = [];
                for (const [vehicleId, state] of this.vehicles.entries()) {
                    if (!state.connection.isOnline && !vehiclesToRemove.includes(vehicleId)) {
                        offlineVehicles.push({
                            id: vehicleId,
                            lastSeen: state.connection.lastSeen || 0
                        });
                    }
                }
                
                offlineVehicles.sort((a, b) => a.lastSeen - b.lastSeen);
                
                // 添加到删除列表，直到数量低于阈值
                const targetSize = Math.floor(this.maxVehicles * 0.8); // 清理到80%
                const needed = this.vehicles.size - targetSize - vehiclesToRemove.length;
                for (let i = 0; i < Math.min(needed, offlineVehicles.length); i++) {
                    vehiclesToRemove.push(offlineVehicles[i].id);
                }
            }
            
            // 执行删除并触发场景清理
            let removed = 0;
            for (const vehicleId of vehiclesToRemove) {
                this.vehicles.delete(vehicleId);
                
                // 🧹 同时清理3D场景中的车辆模型和路径
                try {
                    import('@/components/Scene3D/index.js').then(({ removeVehicle }) => {
                        if (removeVehicle) removeVehicle(vehicleId);
                    }).catch(() => {});
                    
                    import('@/components/Scene3D/pathRenderer.js').then(({ removePath }) => {
                        if (removePath) removePath(vehicleId);
                    }).catch(() => {});
                } catch (e) {}
                
                removed++;
                console.info(`🧹 清理闲置车辆: ${vehicleId}`);
            }
            
            if (removed > 0) {
                console.info(`✅ 内存清理完成，移除 ${removed} 个闲置车辆，当前车辆数: ${this.vehicles.size}`);
            }
        },
        
        /**
         * 手动清理指定车辆状态
         * @param {number} vehicleId - 车辆ID
         */
        removeVehicleState(vehicleId) {
            const normalizedId = parseVehicleId(vehicleId, 0);
            if (normalizedId && this.vehicles.has(normalizedId)) {
                this.vehicles.delete(normalizedId);
                console.info(`🗑️ 已移除车辆状态: ${normalizedId}`);
                return true;
            }
            return false;
        },
        
        /**
         * 清理所有离线车辆状态
         */
        clearOfflineVehicles() {
            const offlineVehicles = [];
            for (const [vehicleId, state] of this.vehicles.entries()) {
                if (!state.connection.isOnline) {
                    offlineVehicles.push(vehicleId);
                }
            }
            
            offlineVehicles.forEach(id => this.vehicles.delete(id));
            
            if (offlineVehicles.length > 0) {
                console.info(`🧹 已清理 ${offlineVehicles.length} 个离线车辆状态`);
            }
        },
        
        /**
         * 设置摄像头手动状态
         * @param {number} vehicleId - 车辆ID
         * @param {boolean} enabled - 是否启用
         */
        setManualCameraState(vehicleId, enabled) {
            const state = this.getOrCreateVehicleState(vehicleId);
            if (!state) return;
            state.camera.isManualOn = Boolean(enabled);
        },
        
        /**
         * 获取摄像头手动状态
         * @param {number} vehicleId - 车辆ID
         * @returns {boolean} 是否手动启用
         */
        isManualCameraEnabled(vehicleId) {
            const state = this.getVehicleState(vehicleId);
            return state ? state.camera.isManualOn : false;
        },
        
        /**
         * 设置摄像头激活状态
         * @param {number} vehicleId - 车辆ID
         * @param {boolean} isActive - 是否激活
         */
        setActiveCameraState(vehicleId, isActive) {
            const state = this.getOrCreateVehicleState(vehicleId);
            if (!state) return;
            state.camera.isActive = Boolean(isActive);
        },
        
        /**
         * 获取摄像头激活状态
         * @param {number} vehicleId - 车辆ID
         * @returns {boolean} 是否激活
         */
        isCameraActive(vehicleId) {
            const state = this.getVehicleState(vehicleId);
            return state ? state.camera.isActive : false;
        },
        
        /**
         * 获取激活的摄像头车辆ID
         * @returns {number|null} 激活的车辆ID
         */
        getActiveCameraVehicleId() {
            for (const [id, state] of this.vehicles.entries()) {
                if (state.camera.isActive) return id;
            }
            return null;
        },
        
        /**
         * 重置摄像头手动状态
         * @param {number} vehicleId - 车辆ID
         */
        resetManualCameraState(vehicleId) {
            const state = this.getVehicleState(vehicleId);
            if (state) {
                state.camera.isManualOn = false;
            }
        },
        
        /**
         * 设置车辆就绪状态
         * @param {number} vehicleId - 车辆ID
         * @param {boolean} ready - 是否就绪
         */
        setVehicleReady(vehicleId, ready) {
            const state = this.getOrCreateVehicleState(vehicleId);
            if (!state) return;
            state.readiness.isReady = Boolean(ready);
        },
        
        /**
         * 检查车辆是否就绪
         * @param {number} vehicleId - 车辆ID
         * @returns {boolean} 是否就绪
         */
        isVehicleReady(vehicleId) {
            const state = this.getVehicleState(vehicleId);
            return state ? state.readiness.isReady : false;
        },
        
        /**
         * 获取车辆停车位
         * @param {number} vehicleId - 车辆ID
         * @returns {number} 停车位编号
         */
        getVehicleParkingSlot(vehicleId) {
            const state = this.getVehicleState(vehicleId);
            return state ? state.parking.slotId : 0;
        },
        
        /**
         * 检查指定车位是否被占用
         * @param {number} slotId - 车位编号
         * @returns {boolean} 是否被占用
         */
        isParkingSlotOccupied(slotId) {
            for (const state of this.vehicles.values()) {
                if (state.parking.slotId === slotId) {
                    return true;
                }
            }
            return false;
        },
        
        /**
         * 获取所有已占用的车位列表
         * @returns {Array<{vehicleId: number, slotId: number}>}
         */
        getOccupiedSlots() {
            const occupied = [];
            for (const [vehicleId, state] of this.vehicles.entries()) {
                if (state.parking.slotId > 0) {
                    occupied.push({ vehicleId, slotId: state.parking.slotId });
                }
            }
            return occupied;
        },
        
        /**
         * 获取车辆的导航状态
         * @param {number} vehicleId - 车辆ID
         * @returns {Object|null} 导航状态 {code, text}
         */
        getVehicleNavigationStatus(vehicleId) {
            const state = this.getVehicleState(vehicleId);
            return state ? state.state.navigation : null;
        },
        
        /**
         * 查找离指定位置最近且导航状态为待命的车辆
         * @param {number} targetX - 目标位置X坐标（模型坐标系）
         * @param {number} targetZ - 目标位置Z坐标（模型坐标系）
         * @returns {number|null} 最近的符合条件的车辆ID，或null
         */
        findNearestIdleVehicle(targetX, targetZ) {
            const candidates = [];
            
            // 遍历所有车辆
            for (const [vehicleId, state] of this.vehicles.entries()) {
                // 必须在线
                if (!state.connection.isOnline) {
                    console.log(`🚫 车辆${vehicleId}离线，跳过`);
                    continue;
                }
                
                // 必须有导航状态
                if (!state.state.navigation) {
                    console.log(`🚫 车辆${vehicleId}无导航状态，跳过`);
                    continue;
                }
                
                const navCode = state.state.navigation.code;
                
                // 导航状态必须为1（待命）或2（空闲）
                if (navCode !== 1 && navCode !== 2) {
                    console.log(`🚫 车辆${vehicleId}导航状态${navCode}(${state.state.navigation.text})，不符合要求（需要1或2）`);
                    continue;
                }
                
                // 计算距离
                const vehicleX = state.state.position.x;
                const vehicleZ = state.state.position.y; // 注意：内部存储时y对应模型的z
                const distance = Math.sqrt(
                    Math.pow(vehicleX - targetX, 2) + 
                    Math.pow(vehicleZ - targetZ, 2)
                );
                
                candidates.push({
                    vehicleId,
                    distance,
                    navStatus: navCode,
                    navText: state.state.navigation.text,
                    position: { x: vehicleX, z: vehicleZ }
                });
                
                console.log(`✅ 车辆${vehicleId}符合条件 - 导航状态: ${navCode}(${state.state.navigation.text}), 距离: ${distance.toFixed(3)}m`);
            }
            
            // 如果没有符合条件的车辆
            if (candidates.length === 0) {
                console.log('❌ 没有找到符合条件的车辆（在线且导航状态为1或2）');
                return null;
            }
            
            // 按距离排序，返回最近的
            candidates.sort((a, b) => a.distance - b.distance);
            const nearest = candidates[0];
            
            console.log(`🎯 找到最近的空闲车辆: ${nearest.vehicleId}号，距离: ${nearest.distance.toFixed(3)}m，导航状态: ${nearest.navStatus}(${nearest.navText})`);
            return nearest.vehicleId;
        },
        
        /**
         * 清除车辆状态
         * @param {number} vehicleId - 车辆ID
         */
        clearVehicleState(vehicleId) {
            const normalizedId = parseVehicleId(vehicleId, 0);
            if (normalizedId) {
                this.vehicles.delete(normalizedId);
            }
        },

        /**
         * 清除所有车辆状态
         */
        clearAllVehicleState() {
            this.vehicles.clear();
        },

        // 从数据库加载车辆列表
        applyVehicleConnections(connections = []) {
            const normalized = normalizeVehicleList(connections);
            const previousSelected = this.selectedCarId;

            this.carList = normalized;

            if (previousSelected) {
                const stillExists = normalized.some(vehicle => compareVehicleId(vehicle.vehicleId, previousSelected));
                if (!stillExists) {
                    this.selectedCarId = normalized[0]?.vehicleId ?? '';
                }
            } else if (!this.selectedCarId && normalized.length > 0) {
                this.selectedCarId = normalized[0].vehicleId;
            }
        },

        async loadVehicleConnections() {
            this.loading = true;
            try {
                const result = await VehicleConnectionAPI.getAllConnections();
                if (result.success) {
                    // 使用统一的车辆数据标准化函数
                    this.applyVehicleConnections(result.data);
                } else {
                    console.error('❌ Store加载车辆列表失败:', result.error);
                    // 失败时使用默认列表
                    this.carList = [];
                }
            } catch (error) {
                console.error('❌ Store加载车辆连接异常:', error);
                this.carList = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 刷新车辆列表
        async refreshVehicleList() {
            await this.loadVehicleConnections();
        },

        // 出租车状态管理actions
        setTaxiStartPoint(point, coords) {
            this.taxi.startPoint = point;
            this.taxi.startCoords = coords;
        },

        setTaxiEndPoint(point, coords) {
            this.taxi.endPoint = point;
            this.taxi.endCoords = coords;
        },

        clearTaxiPoints() {
            this.taxi.startPoint = '';
            this.taxi.endPoint = '';
            this.taxi.startCoords = null;
            this.taxi.endCoords = null;
        },

        getTaxiState() {
            return { ...this.taxi };
        },
        
        // ========== 打车状态管理 ==========
        
        /**
         * 添加活跃的打车订单
         * @param {number} vehicleId - 车辆ID
         * @param {Object} startCoords - 起点坐标 {x, z}
         * @param {Object} endCoords - 终点坐标 {x, z}
         * @param {string} orderId - 订单ID
         */
        addActiveTaxiRide(vehicleId, startCoords, endCoords, orderId) {
            this.activeTaxiRides.set(vehicleId, {
                startCoords: { ...startCoords },
                endCoords: { ...endCoords },
                orderId,
                timestamp: Date.now()
            });
            console.log(`🚕 车辆 ${vehicleId} 开始打车订单: ${orderId}`);
        },
        
        /**
         * 移除活跃的打车订单
         * @param {number} vehicleId - 车辆ID
         * @returns {boolean} 是否成功移除
         */
        removeActiveTaxiRide(vehicleId) {
            const had = this.activeTaxiRides.has(vehicleId);
            if (had) {
                const ride = this.activeTaxiRides.get(vehicleId);
                this.activeTaxiRides.delete(vehicleId);
                console.log(`🚕 车辆 ${vehicleId} 完成打车订单: ${ride.orderId}`);
            }
            return had;
        },
        
        /**
         * 检查车辆是否在打车状态
         * @param {number} vehicleId - 车辆ID
         * @returns {boolean}
         */
        isVehicleInTaxiMode(vehicleId) {
            return this.activeTaxiRides.has(vehicleId);
        },
        
        /**
         * 获取车辆的打车订单信息
         * @param {number} vehicleId - 车辆ID
         * @returns {Object|null}
         */
        getActiveTaxiRide(vehicleId) {
            return this.activeTaxiRides.get(vehicleId) || null;
        },
        
        /**
         * 清除所有打车订单
         */
        clearAllTaxiRides() {
            const count = this.activeTaxiRides.size;
            this.activeTaxiRides.clear();
            console.log(`🚕 已清除 ${count} 个打车订单`);
        },
        
        // ========== 沙盘状态管理 ==========
        
        /**
         * 设置沙盘连接状态
         * @param {boolean} connected - 是否连接
         */
        setSandboxConnected(connected) {
            this.sandboxConnected = Boolean(connected);
        },
        
        /**
         * 获取沙盘连接状态
         * @returns {boolean} 是否连接
         */
        isSandboxConnected() {
            return this.sandboxConnected;
        },
    },
});