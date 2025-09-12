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
import { ElMessage } from 'element-plus';

const showMsg = (result, message) => {
    if (result) {
        ElMessage.success(message || '操作成功');
    } else {
        ElMessage.error(message || '操作失败');
    }
};

const startCar = () => {
    console.log('启动车辆');
    showMsg(true, '车辆已启动');
};

const stopCar = () => {
    console.log('停止车辆');
    showMsg(true, '车辆已停止');
};

const emptyMode = () => {
    console.log('切换到空载模式');
    showMsg(true, '已切换到空载模式');
};

const initPose = () => {
    console.log('初始化位姿');
    showMsg(true, '位姿已初始化');
};

const emergencyBrake = () => {
    console.log('紧急制动');
    showMsg(true, '已执行紧急制动');
};
</script>

<style lang="scss" scoped>
.control-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
}

.control-btn {
    width: 130px;
    flex: 1;
    padding: 10px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    transition: all 0.3s ease;
    min-height: 44px;
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