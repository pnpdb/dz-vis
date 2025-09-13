<template>
    <div class="form-group">
        <label class="form-label"><fa icon="gamepad" /> 车辆控制</label>

        <div class="control-buttons">
            <button class="btn control-btn start-btn" @click="startCar()">
                <fa icon="play" /> 启动车辆
            </button>
            <button class="btn control-btn stop-btn" @click="stopCar()">
                <fa icon="stop" /> 停止车辆
            </button>

            <button class="btn control-btn btn-outline" @click="emptyMode()">
                <fa icon="car" /> 空载模式
            </button>
            <button class="btn control-btn btn-secondary" @click="initPose()">
                <fa icon="refresh" /> 初始化位姿
            </button>
            <button
                class="btn control-btn emergency-btn"
                @click="emergencyBrake()"
            >
                <fa icon="exclamation-triangle" /> 紧急制动
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { socketManager } from '@/utils/socketManager.js';
import { useCarStore } from '@/stores/car.js';

const carStore = useCarStore();

// 当前选中的车辆ID
const currentCarId = computed(() => carStore.selectedCarId);

// 显示成功或失败消息，持续时间3秒
const showMsg = (isSuccess, message) => {
    if (isSuccess) {
        ElMessage({
            message: message || '操作成功',
            type: 'success',
            duration: 3000
        });
    } else {
        ElMessage({
            message: message || '操作失败',
            type: 'error',
            duration: 3000
        });
    }
};

// 检查车辆是否在线 - 统一的在线检查逻辑
const checkVehicleOnline = (vehicleId) => {
    const isOnline = socketManager.isVehicleConnected(vehicleId);
    if (!isOnline) {
        ElMessage({
            message: `当前车辆${vehicleId}离线，请检查连接状态`,
            type: 'warning',
            duration: 3000
        });
    }
    return isOnline;
};

const startCar = async () => {
    const vehicleId = currentCarId.value;
    if (!vehicleId) {
        showMsg(false, '请先选择车辆');
        return;
    }

    if (!checkVehicleOnline(vehicleId)) {
        return;
    }

    try {
        console.log(`🚗 开始发送启动指令给车辆${vehicleId}`);
        const result = await socketManager.startVehicle(vehicleId);
        console.log(`✅ 启动指令发送结果:`, result);
        showMsg(true, `车辆${vehicleId}启动指令发送成功`);
    } catch (error) {
        console.error('启动车辆失败:', error);
        showMsg(false, '启动车辆失败: ' + error.message);
    }
};

const stopCar = async () => {
    const vehicleId = currentCarId.value;
    if (!vehicleId) {
        showMsg(false, '请先选择车辆');
        return;
    }

    if (!checkVehicleOnline(vehicleId)) {
        return;
    }

    try {
        await socketManager.stopVehicle(vehicleId);
        showMsg(true, `车辆${vehicleId}停止指令发送成功`);
    } catch (error) {
        console.error('停止车辆失败:', error);
        showMsg(false, '停止车辆失败: ' + error.message);
    }
};

const emptyMode = async () => {
    const vehicleId = currentCarId.value;
    if (!vehicleId) {
        showMsg(false, '请先选择车辆');
        return;
    }

    if (!checkVehicleOnline(vehicleId)) {
        return;
    }

    try {
        await socketManager.setEmptyMode(vehicleId);
        showMsg(true, `车辆${vehicleId}空载模式指令发送成功`);
    } catch (error) {
        console.error('切换空载模式失败:', error);
        showMsg(false, '切换空载模式失败: ' + error.message);
    }
};

const initPose = async () => {
    const vehicleId = currentCarId.value;
    if (!vehicleId) {
        showMsg(false, '请先选择车辆');
        return;
    }

    if (!checkVehicleOnline(vehicleId)) {
        return;
    }

    try {
        // 使用默认的初始位置 (0, 0, 0)
        await socketManager.initializePose(vehicleId, 0.0, 0.0, 0.0);
        showMsg(true, `车辆${vehicleId}位姿初始化指令发送成功`);
    } catch (error) {
        console.error('初始化位姿失败:', error);
        showMsg(false, '初始化位姿失败: ' + error.message);
    }
};

const emergencyBrake = async () => {
    const vehicleId = currentCarId.value;
    if (!vehicleId) {
        showMsg(false, '请先选择车辆');
        return;
    }

    if (!checkVehicleOnline(vehicleId)) {
        return;
    }

    try {
        await socketManager.emergencyBrake(vehicleId);
        showMsg(true, `车辆${vehicleId}紧急制动指令发送成功`);
    } catch (error) {
        console.error('紧急制动失败:', error);
        showMsg(false, '紧急制动失败: ' + error.message);
    }
};

onMounted(() => {
    // 组件挂载时可以检查Socket连接状态
    console.log('CarButton组件已挂载，当前车辆ID:', currentCarId.value);
});
</script>

<style lang="scss" scoped>
.control-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.control-btn {
    width: auto;
    flex: 1;
    padding: 8px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    transition: all 0.3s ease;
    min-height: 32px;
}

.start-btn {
    background: linear-gradient(90deg, #00d2ff, #00f0ff);
    color: #002b4d;
    border: 1px solid rgba(0, 240, 255, 0.3);
}

.stop-btn {
    background: rgba(255, 77, 77, 0.2);
    color: #ff4d4d;
    border: 1px solid rgba(255, 77, 77, 0.3);
}

.emergency-btn {
    background: rgba(255, 204, 0, 0.2);
    color: #ffcc00;
    border: 1px solid rgba(255, 204, 0, 0.3);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(255, 204, 0, 0.4);
    }

    70% {
        box-shadow: 0 0 0 10px rgba(255, 204, 0, 0);
    }

    100% {
        box-shadow: 0 0 0 0 rgba(255, 204, 0, 0);
    }
}

.control-btn:hover {
    transform: translateY(-3px);
}

.start-btn:hover {
    box-shadow: 0 5px 20px rgba(0, 240, 255, 0.4);
}

.stop-btn:hover {
    box-shadow: 0 5px 20px rgba(255, 77, 77, 0.3);
}

.emergency-btn:hover {
    box-shadow: 0 5px 20px rgba(255, 204, 0, 0.4);
}
</style>