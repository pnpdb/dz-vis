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
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { socketManager } from '@/utils/socketManager.js';

// 当前选中的车辆ID (可以从父组件传入或全局状态获取)
const currentCarId = ref('car_127.0.0.1'); // 默认值，实际应该动态获取

const showMsg = (result, message) => {
    if (result) {
        ElMessage.success(message || '操作成功');
    } else {
        ElMessage.error(message || '操作失败');
    }
};

const startCar = async () => {
    try {
        await socketManager.startVehicle(currentCarId.value);
        showMsg(true, '车辆启动命令已发送');
    } catch (error) {
        console.error('启动车辆失败:', error);
        showMsg(false, '启动车辆失败');
    }
};

const stopCar = async () => {
    try {
        await socketManager.stopVehicle(currentCarId.value);
        showMsg(true, '车辆停止命令已发送');
    } catch (error) {
        console.error('停止车辆失败:', error);
        showMsg(false, '停止车辆失败');
    }
};

const emptyMode = async () => {
    try {
        // 空载模式可以发送配置更新命令
        await socketManager.sendToVehicle(
            currentCarId.value, 
            0x1008, // CONFIG_UPDATE
            new TextEncoder().encode('empty_mode')
        );
        showMsg(true, '已切换到空载模式');
    } catch (error) {
        console.error('切换空载模式失败:', error);
        showMsg(false, '切换空载模式失败');
    }
};

const initPose = async () => {
    try {
        await socketManager.sendToVehicle(
            currentCarId.value,
            0x1009, // SYSTEM_RESET
            new TextEncoder().encode('init_pose')
        );
        showMsg(true, '位姿初始化命令已发送');
    } catch (error) {
        console.error('初始化位姿失败:', error);
        showMsg(false, '初始化位姿失败');
    }
};

const emergencyBrake = async () => {
    try {
        await socketManager.emergencyBrake(currentCarId.value);
        showMsg(true, '紧急制动命令已发送');
    } catch (error) {
        console.error('紧急制动失败:', error);
        showMsg(false, '紧急制动失败');
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