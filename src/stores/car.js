import { defineStore } from 'pinia';
import { VehicleConnectionAPI } from '@/utils/vehicleAPI.js';

const filePath = localStorage.getItem('filePath') || '';

export const useCarStore = defineStore('car', {
    state: () => ({
        filePath,
        selectedCarId: null,
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
            this.selectedCarId = id;
        },
        
        // 从数据库加载车辆列表
        async loadVehicleConnections() {
            this.loading = true;
            try {
                const result = await VehicleConnectionAPI.getAllConnections();
                if (result.success) {
                    // 转换数据库数据为store格式
                    this.carList = result.data.map(connection => ({
                        id: connection.vehicle_id,
                        name: connection.name,
                        value: connection.vehicle_id, // 保持兼容性
                        vehicleId: connection.vehicle_id,
                        ipAddress: connection.ip_address,
                        port: connection.port,
                        description: connection.description,
                        isActive: connection.is_active,
                        online: connection.is_active,
                        // 默认属性
                        position: { x: 0, y: 0 },
                        angle: 0,
                        speed: 0,
                        batteryValue: 0,
                        isNav: false,
                        loop: 0,
                    }));
                    
                    // 如果没有选中车辆且有车辆列表，选择第一个
                    if (!this.selectedCarId && this.carList.length > 0) {
                        this.selectedCarId = this.carList[0].id;
                    }
                    
                    console.log('✅ Store加载车辆列表成功:', this.carList);
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
    },
});