import { defineStore } from 'pinia';
import { VehicleConnectionAPI } from '@/utils/vehicleAPI.js';
import { normalizeVehicleList, parseVehicleId, compareVehicleId } from '@/utils/vehicleTypes.js';

const filePath = localStorage.getItem('filePath') || '';

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
        
        // 沙盘连接状态
        sandboxConnected: false,
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
            }
        },
        
        /**
         * 更新车辆运行状态
         * @param {number} vehicleId - 车辆ID
         * @param {Object} vehicleInfo - 车辆信息
         */
        updateVehicleState(vehicleId, vehicleInfo) {
            const state = this.getOrCreateVehicleState(vehicleId);
            if (!state) return;
            
            // 更新运行状态
            Object.assign(state.state, {
                position: vehicleInfo.position || state.state.position,
                speed: vehicleInfo.speed ?? state.state.speed,
                battery: vehicleInfo.battery ?? state.state.battery,
                gear: vehicleInfo.gear || state.state.gear,
                orientation: vehicleInfo.orientation ?? state.state.orientation,
                steeringAngle: vehicleInfo.steeringAngle ?? state.state.steeringAngle,
                navigation: vehicleInfo.navigation || state.state.navigation,
                sensors: vehicleInfo.sensors || state.state.sensors,
                timestamp: vehicleInfo.timestamp || Date.now(),
            });
            
            // 更新停车位（统一存储在 parking.slotId，避免状态不一致）
            if (vehicleInfo.parkingSlot !== undefined) {
                state.parking.slotId = vehicleInfo.parkingSlot;
            }
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