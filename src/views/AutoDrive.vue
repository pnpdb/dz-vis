<template>
    <div class="floating-autodrive-panel">
        <div class="panel-header">
            <div class="panel-icon">
                <fa icon="robot"></fa>
            </div>
            <h2 class="panel-title">自动驾驶</h2>
        </div>

        <!-- 数据设置 -->
        <div class="form-group">
            <label class="form-label"> <fa icon="file" /> 数据设置</label>
            <div class="flex-item">
                <span>数据记录</span>
                <el-switch
                    v-model="dataRecord"
                    active-color="#13ce66"
                    inactive-color="#ff4949"
                    @change="handleDataRecordChange"
                ></el-switch>
            </div>
        </div>
        <!-- 自动驾驶出租车 -->
        <div class="form-group">
            <label class="form-label">
                <fa icon="taxi" /> 自动驾驶出租车</label
            >
            <div class="input-label">起点位置:</div>
            <div class="flex">
                <input
                    class="map-point-value"
                    placeholder="请在地图上选择起点"
                    readonly
                    v-model="taxi.startPoint"
                />

                <button class="btn btn-secondary btn-small" @click="selectStartPoint">
                    <fa icon="map-marked-alt"></fa> 选择起点
                </button>
            </div>
            <div class="input-label">终点位置:</div>
            <div class="flex">
                <input
                    class="map-point-value"
                    placeholder="请在地图上选择终点"
                    readonly
                    v-model="taxi.endPoint"
                />
                <button class="btn btn-danger btn-small" @click="selectEndPoint">
                    <fa icon="flag-checkered"></fa> 选择终点
                </button>
            </div>

            <button class="btn btn-primary" @click="callTaxi">
                <fa icon="car-side"></fa> 呼叫出租车
            </button>
        </div>

        <!-- AVP自主代客泊车 -->
        <div class="form-group">
            <label class="form-label">
                <fa icon="parking" /> AVP自主代客泊车</label
            >
            <div class="input-label">选择车辆:</div>
            <div class="flex">
                <el-select v-model="parking.car" placeholder="请选择车辆">
                    <el-option
                        v-for="vehicle in carStore.carList"
                        :key="vehicle.id"
                        :label="vehicle.name"
                        :value="vehicle.id"
                    ></el-option>
                </el-select>
            </div>
            <div class="input-label">选择车位:</div>

            <div class="flex">
                <input
                    class="map-point-value"
                    placeholder="请在地图上选择停车位"
                    readonly
                    v-model="parking.point"
                />
                <button class="btn btn-secondary btn-small" @click="selectParkingSpot">
                    <fa icon="map-marked-alt"></fa>
                    选择车位
                </button>
            </div>
            <button class="btn btn-primary" @click="startParking">
                <fa icon="parking"></fa> 我要泊车
            </button>
        </div>

        <!-- AVP取车 -->
        <div class="form-group">
            <label class="form-label"> <fa icon="key" /> AVP取车</label>
            <div class="input-label">选择车辆:</div>
            <div class="flex">
                <el-select v-model="pickup.car" placeholder="请选择车辆">
                    <el-option
                        v-for="vehicle in carStore.carList"
                        :key="vehicle.id"
                        :label="vehicle.name"
                        :value="vehicle.id"
                    ></el-option>
                </el-select>
            </div>

            <button class="btn btn-primary" @click="pickupCar">
                <fa icon="sign-in-alt"></fa> 我要取车
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useCarStore } from '@/stores/car.js';
import { socketManager } from '@/utils/socketManager.js';

const carStore = useCarStore();

// 组件挂载时确保有选中的车辆
onMounted(() => {
    // 如果没有选中车辆，尝试选择第一个
    if (!carStore.selectedCarId && carStore.carList.length > 0) {
        carStore.changeCarId(carStore.carList[0].id);
    }
});

// 数据记录开关
const dataRecord = ref(false);

// 处理数据记录开关变化
const handleDataRecordChange = async (newValue) => {
    // 1. 获取当前选中的车辆
    const currentCarId = carStore.selectedCarId;
    
    // 2. 检查是否选择了车辆
    if (!currentCarId) {
        ElMessage({
            message: '请先选择车辆',
            type: 'warning',
            duration: 3000
        });
        // 回滚开关状态
        dataRecord.value = !newValue;
        return;
    }
    
    // 3. 检查该车辆是否在线
    const isOnline = socketManager.isVehicleConnected(currentCarId);
    
    if (!isOnline) {
        ElMessage({
            message: `当前车辆${currentCarId}离线，请检查连接状态`,
            type: 'warning',
            duration: 3000
        });
        // 回滚开关状态
        dataRecord.value = !newValue;
        return;
    }
    
    // 4. 车辆在线，发送数据记录协议
    try {
        const result = await socketManager.sendDataRecording(currentCarId, newValue);
        
        // 5. 发送成功，显示成功Toast
        const statusText = newValue ? '开启' : '关闭';
        ElMessage({
            message: `数据记录${statusText}指令发送成功`,
            type: 'success',
            duration: 3000
        });
        
    } catch (error) {
        // 6. 发送失败，显示失败Toast并回滚
        const statusText = newValue ? '开启' : '关闭';
        ElMessage({
            message: `数据记录${statusText}指令发送失败: ${error.message || error}`,
            type: 'error',
            duration: 3000
        });
        
        // 回滚开关状态
        dataRecord.value = !newValue;
    }
};

// 出租车相关数据
const taxi = ref({
    startPoint: '',
    endPoint: '',
});

// 停车相关数据
const parking = ref({
    car: '',
    point: '',
});

// 取车相关数据
const pickup = ref({
    car: '',
});

// 呼叫出租车
const callTaxi = async () => {
    try {
        // 1. 检查是否有在线车辆
        const onlineVehicleCount = socketManager.getOnlineVehicleCount();
        if (onlineVehicleCount === 0) {
            ElMessage({
                message: '当前没有可用车辆',
                type: 'warning',
                duration: 3000
            });
            return;
        }

        // 2. 生成订单ID
        const orderId = socketManager.generateOrderId();
        
        // 3. 发送出租车订单广播（使用默认坐标）
        const result = await socketManager.sendTaxiOrder(orderId);
        
        // 4. 发送成功，显示成功Toast
        ElMessage({
            message: '🚕 出租车订单发送成功，请等待车辆响应',
            type: 'success',
            duration: 3000
        });
        
        console.debug(`🚕 出租车订单发送成功 - 订单: ${orderId}, 结果: ${result}`);
        
    } catch (error) {
        // 5. 发送失败，显示失败Toast
        ElMessage({
            message: `呼叫出租车失败: ${error.message || error}`,
            type: 'error',
            duration: 3000
        });
        
        console.error('呼叫出租车失败:', error);
    }
};

// 开始泊车
const startParking = async () => {
    try {
        // 1. 检查是否选择了车辆
        if (!parking.value.car) {
            ElMessage({
                message: '请先选择车辆',
                type: 'warning',
                duration: 3000
            });
            return;
        }

        // 2. 检查该车辆是否在线
        const isOnline = socketManager.isVehicleConnected(parking.value.car);
        if (!isOnline) {
            ElMessage({
                message: '选中的车辆当前离线，无法执行泊车操作',
                type: 'warning',
                duration: 3000
            });
            return;
        }

        // 3. 车辆在线，发送AVP泊车指令
        const result = await socketManager.sendAvpParking(parking.value.car);
        
        // 4. 发送成功，显示成功Toast
        ElMessage({
            message: '🅿️ AVP泊车指令发送成功，车辆正在执行泊车',
            type: 'success',
            duration: 3000
        });
        
        console.debug(`🅿️ AVP泊车指令发送成功 - 车辆: ${parking.value.car}, 结果: ${result}`);
        
    } catch (error) {
        // 5. 发送失败，显示失败Toast
        ElMessage({
            message: `AVP泊车指令发送失败: ${error.message || error}`,
            type: 'error',
            duration: 3000
        });
        
        console.error('AVP泊车指令发送失败:', error);
    }
};

// 取车
const pickupCar = async () => {
    try {
        // 1. 检查是否选择了车辆
        if (!pickup.value.car) {
            ElMessage({
                message: '请先选择车辆',
                type: 'warning',
                duration: 3000
            });
            return;
        }

        // 2. 检查该车辆是否在线
        const isOnline = socketManager.isVehicleConnected(pickup.value.car);
        if (!isOnline) {
            ElMessage({
                message: '选中的车辆当前离线，无法执行取车操作',
                type: 'warning',
                duration: 3000
            });
            return;
        }

        // 3. 车辆在线，发送AVP取车指令
        const result = await socketManager.sendAvpPickup(pickup.value.car);
        
        // 4. 发送成功，显示成功Toast
        ElMessage({
            message: 'AVP取车指令发送成功，车辆正在执行取车',
            type: 'success',
            duration: 3000
        });
        
        console.debug(`AVP取车指令发送成功 - 车辆: ${pickup.value.car}, 结果: ${result}`);
        
    } catch (error) {
        // 5. 发送失败，显示失败Toast
        ElMessage({
            message: `AVP取车指令发送失败: ${error.message || error}`,
            type: 'error',
            duration: 3000
        });
        
        console.error('AVP取车指令发送失败:', error);
    }
};

// 选择地图位置的函数（占位符）
const selectStartPoint = () => {
    ElMessage.info('请在地图上点击选择起点位置');
};

const selectEndPoint = () => {
    ElMessage.info('请在地图上点击选择终点位置');
};

const selectParkingSpot = () => {
    ElMessage.info('请在地图上点击选择停车位');
};
</script>

<style lang="scss" scoped>
.floating-autodrive-panel {
    padding: 25px;
    height: 100%;
    overflow-y: auto;
    position: relative;
}

.panel-header {
    margin-bottom: 20px;
    padding-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 2px solid rgba(0, 240, 255, 0.3);
    position: relative;
}

.panel-icon {
    width: 36px;
    height: 36px;
    font-size: 20px;
    color: var(--dark-bg);
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
}

.panel-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    background: linear-gradient(90deg, var(--primary), var(--primary-light));
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    flex: 1;
}

.flex-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.flex {
    margin-bottom: 10px;
}
.input-label {
    min-width: 70px;
    color: var(--text-secondary);
    margin-bottom: 8px;
    font-size: 12px;
}
.map-point-value {
    flex-grow: 1;
    height: 32px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(0, 240, 255, 0.3);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 12px;
    margin-right: 8px;
}

/* 滚动条样式 */
.floating-autodrive-panel::-webkit-scrollbar {
    width: 6px;
}

.floating-autodrive-panel::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
}

.floating-autodrive-panel::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, 
        var(--primary), 
        var(--primary-dark)
    );
    border-radius: 3px;
    box-shadow: 0 0 5px rgba(0, 240, 255, 0.3);
}

.floating-autodrive-panel::-webkit-scrollbar-thumb:hover {
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
}
</style>