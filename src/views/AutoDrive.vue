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
                    v-model="carStore.taxi.startPoint"
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
                    v-model="carStore.taxi.endPoint"
                />
                <button class="btn btn-danger btn-small" @click="selectEndPoint">
                    <fa icon="flag-checkered"></fa> 选择终点
                </button>
            </div>

            <div class="flex">
                <button class="btn btn-primary" @click="callTaxi">
                    <fa icon="car-side"></fa> 呼叫出租车
                </button>
                <button class="btn btn-secondary btn-small" @click="clearTaxiSelection" style="margin-left: 8px;">
                    <fa icon="eraser"></fa> 清除选择
                </button>
            </div>
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
import { ElMessageBox } from 'element-plus';
import Toast from '@/utils/toast.js';
import { useCarStore } from '@/stores/car.js';
import { socketManager } from '@/utils/socketManager.js';
import { 
    startPointSelectionMode, 
    stopPointSelectionMode,
    startParkingSlotSelectionMode,
    stopParkingSlotSelectionMode,
    createStartPointMarker, 
    createEndPointMarker,
    removeStartPointMarker,
    removeEndPointMarker
} from '@/components/Scene3D/index.js';
import { findNearestFreeSlot, modelToVehicleCoordinates, applyOffsetToSend } from '@/utils/coordinateTransform.js';

const carStore = useCarStore();

// 组件挂载时确保有选中的车辆并恢复出租车状态
onMounted(() => {
    // 如果没有选中车辆，尝试选择第一个
    if (!carStore.selectedCarId && carStore.carList.length > 0) {
        carStore.changeCarId(carStore.carList[0].id);
    }
    
    // 恢复出租车起点和终点标记（如果有的话）
    setTimeout(() => {
        if (carStore.taxi.startCoords) {
            const { x, z } = carStore.taxi.startCoords;
            createStartPointMarker(x, z);
            console.log(`🚀 恢复起点标记: (${x.toFixed(3)}, ${z.toFixed(3)})`);
        }
        
        if (carStore.taxi.endCoords) {
            const { x, z } = carStore.taxi.endCoords;
            createEndPointMarker(x, z);
            console.log(`🏁 恢复终点标记: (${x.toFixed(3)}, ${z.toFixed(3)})`);
        }
    }, 500); // 延迟确保3D场景已初始化
});

// 数据记录开关
const dataRecord = ref(false);

// 处理数据记录开关变化
const handleDataRecordChange = async (newValue) => {
    // 1. 获取当前选中的车辆
    const currentCarId = carStore.selectedCarId;
    
    // 2. 检查是否选择了车辆
    if (!currentCarId) {
        Toast.warning('请先选择车辆');
        // 回滚开关状态
        dataRecord.value = !newValue;
        return;
    }
    
    // 3. 检查该车辆是否在线
    const isOnline = socketManager.isVehicleConnected(currentCarId);
    
    if (!isOnline) {
        Toast.warning(`当前车辆${currentCarId}离线，请检查连接状态`);
        // 回滚开关状态
        dataRecord.value = !newValue;
        return;
    }
    
    // 4. 车辆在线，发送数据记录协议
    try {
        const result = await socketManager.sendDataRecording(currentCarId, newValue);
        
        // 5. 发送成功，显示成功Toast
        const statusText = newValue ? '开启' : '关闭';
        Toast.success(`数据记录${statusText}指令发送成功`);
        
    } catch (error) {
        // 6. 发送失败，显示失败Toast并回滚
        const statusText = newValue ? '开启' : '关闭';
        Toast.error(`数据记录${statusText}指令发送失败: ${error.message || error}`);
        
        // 回滚开关状态
        dataRecord.value = !newValue;
    }
};

// 出租车相关数据现在使用store管理，不需要本地状态

// 停车相关数据
const parking = ref({
    car: '',
    point: '',  // 显示文本
    slotId: null  // 实际车位编号（1或2）
});

// 取车相关数据
const pickup = ref({
    car: '',
});

// 呼叫出租车
const callTaxi = async () => {
    // 保存起点终点坐标（用于添加到activeTaxiRides）
    const startCoords = carStore.taxi.startCoords;
    const endCoords = carStore.taxi.endCoords;
    
    try {
        // 1. 检查是否有在线车辆
        const onlineVehicleCount = socketManager.getOnlineVehicleCount();
        if (onlineVehicleCount === 0) {
            Toast.warning('当前没有可用车辆');
            // 失败：清除UI文本 + 清除沙盘图标
            clearTaxiSelection();
            return;
        }

        // 2. 检查是否已选择起点和终点
        if (!startCoords || !endCoords) {
            Toast.warning('请先选择起点和终点位置');
            return;
        }

        // 3. 查找离起点最近且导航状态为1或2的车辆
        const assignedVehicleId = carStore.findNearestIdleVehicle(
            startCoords.x,
            startCoords.z
        );
        
        if (!assignedVehicleId) {
            Toast.warning('当前没有可用车辆');
            // 失败：清除UI文本 + 清除沙盘图标
            clearTaxiSelection();
            return;
        }
        
        // 4. 将模型坐标转换为车辆坐标系
        const startVehicleCoords = modelToVehicleCoordinates(
            startCoords.x,
            startCoords.z
        );
        const endVehicleCoords = modelToVehicleCoordinates(
            endCoords.x,
            endCoords.z
        );
        
        // 5. 应用偏移量（发送坐标减偏移量）
        const finalStartCoords = applyOffsetToSend(startVehicleCoords.x, startVehicleCoords.y);
        const finalEndCoords = applyOffsetToSend(endVehicleCoords.x, endVehicleCoords.y);
        
        // 6. 生成订单ID
        const orderId = socketManager.generateOrderId();
        
        // 7. 发送出租车订单给指定车辆（使用应用偏移后的车辆坐标系）
        const result = await socketManager.sendTaxiOrderToVehicle(
            orderId,
            assignedVehicleId,
            finalStartCoords.x,
            finalStartCoords.y,
            finalEndCoords.x,
            finalEndCoords.y
        );
        
        // 8. 打车成功后只清除UI上的文本坐标，保留沙盘图标
        // 沙盘图标将在导航状态10时清除
        carStore.clearTaxiPoints(); // 只清除UI文本
        
        // 9. 将车辆添加到打车状态列表（用于后续监听导航状态10）
        carStore.addActiveTaxiRide(assignedVehicleId, startCoords, endCoords, orderId);
        
        // 10. 显示成功Toast
        Toast.success(`出租车订单已发送给${assignedVehicleId}号车，请等待车辆响应`);
        
        console.debug(`🚕 出租车订单发送成功 - 订单: ${orderId}, 车辆: ${assignedVehicleId}`);
        console.debug(`   起点（车辆坐标）: (${startVehicleCoords.x.toFixed(3)}, ${startVehicleCoords.y.toFixed(3)})`);
        console.debug(`   终点（车辆坐标）: (${endVehicleCoords.x.toFixed(3)}, ${endVehicleCoords.y.toFixed(3)})`);
        console.debug(`   ℹ️ 沙盘图标保留，将在导航状态10时清除`);
        
    } catch (error) {
        // 11. 发送失败：清除UI文本 + 清除沙盘图标
        clearTaxiSelection();
        
        // 12. 显示失败Toast
        Toast.error(`呼叫出租车失败: ${error.message || error}`);
        
        console.error('呼叫出租车失败:', error);
    }
};

// 开始泊车
const startParking = async () => {
    try {
        // 1. 检查是否选择了车辆
        if (!parking.value.car) {
            Toast.warning('请先选择车辆');
            return;
        }

        // 2. 检查是否选择了车位
        if (!parking.value.slotId) {
            Toast.warning('请先选择车位');
            return;
        }

        // 3. 检查该车辆是否在线
        const isOnline = socketManager.isVehicleConnected(parking.value.car);
        if (!isOnline) {
            Toast.warning('选中的车辆当前离线，无法执行泊车操作');
            return;
        }

        // 4. 车辆在线，发送AVP泊车指令（带实际车位编号）
        const result = await socketManager.sendAvpParking(parking.value.car, parking.value.slotId);
        
        // 5. 发送成功，显示成功Toast
        Toast.success(`AVP泊车指令发送成功，车辆正在前往${parking.value.slotId}号车位`);
        
        console.debug(`AVP泊车指令发送成功 - 车辆: ${parking.value.car}, 车位: ${parking.value.slotId}, 结果: ${result}`);
        
    } catch (error) {
        // 6. 发送失败，显示失败Toast
        Toast.error(`AVP泊车指令发送失败: ${error.message || error}`);
        
        console.error('AVP泊车指令发送失败:', error);
    }
};

// 取车
const pickupCar = async () => {
    try {
        // 1. 检查是否选择了车辆
        if (!pickup.value.car) {
            Toast.warning('请先选择车辆');
            return;
        }

        // 2. 检查该车辆是否在线
        const isOnline = socketManager.isVehicleConnected(pickup.value.car);
        if (!isOnline) {
            Toast.warning('选中的车辆当前离线，无法执行取车操作');
            return;
        }

        // 3. 车辆在线，发送AVP取车指令
        const result = await socketManager.sendAvpPickup(pickup.value.car);
        
        // 4. 发送成功，显示成功Toast
        Toast.success('AVP取车指令发送成功，车辆正在执行取车');
        
        console.debug(`AVP取车指令发送成功 - 车辆: ${pickup.value.car}, 结果: ${result}`);
        
    } catch (error) {
        // 5. 发送失败，显示失败Toast
        Toast.error(`AVP取车指令发送失败: ${error.message || error}`);
        
        console.error('AVP取车指令发送失败:', error);
    }
};

// 选择起点
const selectStartPoint = () => {
    Toast.info('请在地图上点击选择起点位置');
    
    // 启动点选择模式
    startPointSelectionMode(({ x, z }) => {
        // 结束选择模式
        stopPointSelectionMode();
        
        // 创建起点标记（使用模型坐标）
        const result = createStartPointMarker(x, z);
        if (result) {
            // 将模型坐标转换为车辆坐标系用于显示
            const vehicleCoords = modelToVehicleCoordinates(x, z);
            
            // 保存模型坐标到store（用于后续计算距离）
            carStore.setTaxiStartPoint(
                `X: ${vehicleCoords.x.toFixed(3)}m, Y: ${vehicleCoords.y.toFixed(3)}m`, 
                { x, z }
            );
            
            Toast.success('起点已选择');
            console.log(`🚀 起点 - 车辆坐标: (${vehicleCoords.x.toFixed(3)}, ${vehicleCoords.y.toFixed(3)}), 模型坐标: (${x.toFixed(3)}, ${z.toFixed(3)})`);
        } else {
            Toast.error('起点标记创建失败');
        }
    });
};

// 选择终点
const selectEndPoint = () => {
    Toast.info('请在地图上点击选择终点位置');
    
    // 启动点选择模式
    startPointSelectionMode(({ x, z }) => {
        // 结束选择模式
        stopPointSelectionMode();
        
        // 创建终点标记（使用模型坐标）
        const result = createEndPointMarker(x, z);
        if (result) {
            // 将模型坐标转换为车辆坐标系用于显示
            const vehicleCoords = modelToVehicleCoordinates(x, z);
            
            // 保存模型坐标到store（用于后续计算距离）
            carStore.setTaxiEndPoint(
                `X: ${vehicleCoords.x.toFixed(3)}m, Y: ${vehicleCoords.y.toFixed(3)}m`, 
                { x, z }
            );
            
            Toast.success('终点已选择');
            console.log(`🏁 终点 - 车辆坐标: (${vehicleCoords.x.toFixed(3)}, ${vehicleCoords.y.toFixed(3)}), 模型坐标: (${x.toFixed(3)}, ${z.toFixed(3)})`);
        } else {
            Toast.error('终点标记创建失败');
        }
    });
};

const selectParkingSpot = () => {
    Toast.info('请在沙盘上点击选择停车位');
    
    // 启动车位选择模式
    startParkingSlotSelectionMode(async (position) => {
        // 停止选择模式
        stopParkingSlotSelectionMode();
        
        console.log('🅿️ 点击位置:', position);
        
        // 查找最近的空闲车位
        const nearestSlot = findNearestFreeSlot(
            position.x,
            position.z,
            (slotId) => carStore.isParkingSlotOccupied(slotId)
        );
        
        // 如果没有空闲车位
        if (!nearestSlot) {
            Toast.warning('当前没有空闲车位');
            return;
        }
        
        console.log(`🅿️ 找到最近的空闲车位: ${nearestSlot.slotId}号 (距离: ${nearestSlot.distance.toFixed(3)}m)`);
        
        // 弹出确认对话框
        try {
            await ElMessageBox.confirm(
                `已找到最近的空闲车位：${nearestSlot.slotId}号车位`,
                '确认车位选择',
                {
                    confirmButtonText: '确认',
                    cancelButtonText: '取消',
                    type: 'info'
                }
            );
            
            // 确认后保存车位信息
            parking.value.point = `${nearestSlot.slotId}号车位`;
            parking.value.slotId = nearestSlot.slotId;
            
            Toast.success(`已选择${nearestSlot.slotId}号车位`);
            console.log(`✅ 车位选择完成: ${nearestSlot.slotId}号`);
            
        } catch (error) {
            // 用户取消
            console.log('❌ 用户取消车位选择');
        }
    });
};

// 清除出租车起点和终点选择
const clearTaxiSelection = () => {
    // 移除地图上的标记
    removeStartPointMarker();
    removeEndPointMarker();
    
    // 清除数据
    // 清除store中的数据
    carStore.clearTaxiPoints();
    
    Toast.info('已清除起点和终点选择');
    console.log('🧹 出租车起点和终点选择已清除');
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