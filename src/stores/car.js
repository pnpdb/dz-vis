import { defineStore } from 'pinia';
import { VehicleConnectionAPI } from '@/utils/vehicleAPI.js';
import { normalizeVehicleList, parseVehicleId, compareVehicleId } from '@/utils/vehicleTypes.js';

const filePath = localStorage.getItem('filePath') || '';

export const useCarStore = defineStore('car', {
    state: () => ({
        filePath,
        selectedCarId: '',
        carList: [], // 从数据库加载的车辆列表
        defaultCarList: [ // 默认车辆列表（备用）
            {
                id: 1,
                name: '车辆A',
                value: 1,
                position: {
                    x: 100,
                    y: 100,
                },
                angle: 0,
                speed: 20,
                batteryValue: 82,
                isNav: true,
                loop: 75,
                online: true,
            },
            {
                id: 2,
                name: '车辆B',
                value: 2,
            },
            {
                id: 3,
                name: '车辆C',
                value: 3,
            },
            {
                id: 4,
                name: '车辆D',
                value: 4,
            },
            {
                id: 5,
                name: '车辆E',
                value: 5,
            },
        ],
        count: 0,
        name: 'Eduardo',
        loading: false,
        cameraEnabled: false,
        cameraManualStates: new Map(),
        vehicleStateMap: new Map(),
        // 出租车状态管理
        taxi: {
            startPoint: '',
            endPoint: '',
            startCoords: null, // { x, z }
            endCoords: null,   // { x, z }
        },
    }),
    getters: {
        selectedCar: state => {
            const car = state.carList.find(
                car => car.id === state.selectedCarId
            );
            return car || (state.carList.length > 0 ? state.carList[0] : null);
        },
        // 返回可用的车辆列表（如果数据库为空则使用默认列表）
        availableCarList: state => {
            return state.carList.length > 0 ? state.carList : state.defaultCarList;
        },
    },
    actions: {
        changeCarId(id) {
            this.selectedCarId = parseVehicleId(id);
        },

        setCameraEnabled(enabled) {
            this.cameraEnabled = Boolean(enabled);
        },

        setManualCameraState(vehicleId, enabled) {
            const normalizedId = parseVehicleId(vehicleId, 0);
            if (!normalizedId) return;
            if (enabled) {
                this.cameraManualStates.set(normalizedId, true);
            } else {
                this.cameraManualStates.delete(normalizedId);
            }
        },

        isManualCameraEnabled(vehicleId) {
            const normalizedId = parseVehicleId(vehicleId, 0);
            if (!normalizedId) return false;
            return this.cameraManualStates.get(normalizedId) === true;
        },

        resetManualCameraState(vehicleId) {
            const normalizedId = parseVehicleId(vehicleId, 0);
            if (!normalizedId) return;
            this.cameraManualStates.delete(normalizedId);
        },

        updateVehicleState(vehicleId, state) {
            if (vehicleId == null) return;
            this.vehicleStateMap.set(vehicleId, state);
        },

        getVehicleState(vehicleId) {
            return this.vehicleStateMap.get(vehicleId) || null;
        },

        clearVehicleState(vehicleId) {
            this.vehicleStateMap.delete(vehicleId);
        },

        clearAllVehicleState() {
            this.vehicleStateMap.clear();
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
    },
});