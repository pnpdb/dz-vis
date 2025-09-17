<template>
    <div class="form-group">
        <label class="form-label">
            <fa icon="bars-staggered" /> 车辆参数
        </label>
        
        <!-- 普通模式的车辆参数布局 -->
        <div class="info-grid" v-show="!parallelDrivingMode">
            <Dashboard :speedValue="speedValue" :hasSpeed="hasSpeed" />
            
            <div class="right-column">
                <div class="info-card info-card-h">
                    <div class="info-title">
                        <fa icon="compass" />
                        位置
                    </div>
                    <div class="info-value">X: {{ positionX.toFixed(2) }}</div>
                    <div class="info-value">Y: {{ positionY.toFixed(2) }}</div>
                </div>
                <div class="info-card info-card-h">
                    <div class="info-title">
                        <fa icon="battery-three-quarters" />
                        电量
                    </div>
                    <div
                        :class="[
                            'info-value',
                            { 'info-value_low': batteryValue < 20 },
                        ]"
                    >
                        {{ batteryValue }}%
                    </div>
                    <div class="battery-container">
                        <div
                            :class="[
                                'battery-level',
                                { 'battery-level_low': batteryValue < 20 },
                            ]"
                            :style="{ '--battery-level': batteryValue + '%' }"
                        ></div>
                    </div>
                </div>
            </div>
            
            <div class="info-card">
                <div class="info-title">
                    <fa icon="wifi" />
                    在线状态
                </div>
                <div :class="['info-value', getOnlineStatusClass()]">{{ getOnlineStatusText() }}</div>
            </div>
            <div class="info-card">
                <div class="info-title">
                    <fa icon="route" />
                    导航状态
                </div>
                <div :class="['info-value', navStatus.status ? 'status-normal' : 'status-warning']">{{ navStatus.text }}</div>
            </div>
        </div>

        <!-- 平行驾驶模式的车辆参数布局 -->
        <div class="info-grid" v-show="parallelDrivingMode">
            <Dashboard :speedValue="speedValue" :hasSpeed="hasSpeed" />
            
            <div class="steering-wheel-container">
                <SteeringWheel :angle="steeringAngle" />
            </div>
            
            <div class="info-card">
                <div class="info-title">
                    <fa icon="gear" />
                    档位
                </div>
                <div :class="['info-value', 'gear-indicator']">{{ currentGear }}</div>
            </div>
            <div class="info-card">
                <div class="info-title">
                    <fa icon="battery-three-quarters" />
                    电量
                </div>
                <div
                    :class="[
                        'info-value',
                        { 'info-value_low': batteryValue < 20 },
                    ]"
                >
                    {{ batteryValue }}%
                </div>
                <div class="battery-container">
                    <div
                        :class="[
                            'battery-level',
                            { 'battery-level_low': batteryValue < 20 },
                        ]"
                        :style="{ '--battery-level': batteryValue + '%' }"
                    ></div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import Dashboard from '@/components/Dashboard.vue';
import SteeringWheel from '@/components/SteeringWheel.vue';

const props = defineProps({
    carInfo: {
        type: String,
        default: 'A'
    }
});

// 车辆信息响应式数据
const batteryValue = ref(82);
const speedValue = ref(0);
const hasSpeed = ref(false);
const positionX = ref(116.40);
const positionY = ref(39.90);
const isOnline = ref(false); // 简单的在线/离线状态
const navStatus = ref({
    status: false,
    text: '未导航'
});

// 平行驾驶模式相关数据
const parallelDrivingMode = ref(false);
const steeringAngle = ref(0); // 方向盘转角 (-360 到 360 度)
const currentGear = ref('P'); // 当前档位 P/R/N/D

// 用于确定是否显示该车辆的信息
const currentVehicleId = ref(null);

// 重置车辆信息为默认状态
const resetToDefaultState = () => {
    speedValue.value = 0;
    hasSpeed.value = false;
    batteryValue.value = 0;
    positionX.value = 0;
    positionY.value = 0;
    isOnline.value = false;
    navStatus.value = {
        status: false,
        text: '未导航'
    };
    console.log(`🔄 重置车辆${props.carInfo}信息为默认状态`);
};

// 获取在线状态文本
const getOnlineStatusText = () => {
    return isOnline.value ? '在线' : '离线';
};

// 获取在线状态样式类
const getOnlineStatusClass = () => {
    return isOnline.value ? 'status-normal' : 'status-error';
};

// 检查车辆连接状态并更新UI
const checkAndUpdateVehicleStatus = () => {
    // 通过全局事件请求当前车辆的连接状态
    console.log(`📤 CarInfo请求车辆状态: ${props.carInfo}`);
    window.dispatchEvent(new CustomEvent('request-vehicle-status', {
        detail: {
            vehicleId: props.carInfo
        }
    }));
};

const handleSpeedValue = (value) => {
    speedValue.value = value;
};

// 处理车辆信息更新事件
const handleVehicleInfoUpdate = (event) => {
    const vehicleInfo = event.detail;
    
    // 根据当前选择的车辆信息来匹配
    // 支持多种匹配方式：数字、字符串、字母映射
    const isCurrentVehicle = vehicleInfo.carId === props.carInfo || 
                           vehicleInfo.vehicleId === props.carInfo ||
                           vehicleInfo.carId == props.carInfo ||   // 松散比较
                           vehicleInfo.vehicleId == props.carInfo || // 松散比较
                           // 向后兼容：如果carInfo是字母，转换为数字ID
                           (typeof props.carInfo === 'string' && 
                            vehicleInfo.vehicleId === getVehicleIdFromLetter(props.carInfo));
    
    console.log(`🎯 CarInfo匹配: 车辆${vehicleInfo.vehicleId} vs 当前${props.carInfo} = ${isCurrentVehicle}`);
    
    if (isCurrentVehicle) {
        // 更新车辆信息
        speedValue.value = Number(vehicleInfo.speed.toFixed(3)); // 转换为数字类型
        batteryValue.value = Math.round(vehicleInfo.battery);
        positionX.value = vehicleInfo.position.x;
        positionY.value = vehicleInfo.position.y;
        navStatus.value = vehicleInfo.navigation;
        hasSpeed.value = true;
        isOnline.value = true;
        
        console.log(`更新车辆${props.carInfo}信息:`, vehicleInfo);
    }
};

// 向后兼容：字母ID转数字ID的映射
const getVehicleIdFromLetter = (letter) => {
    const letterMap = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
    return letterMap[letter.toUpperCase()] || null;
};

// 处理车辆连接状态变化事件
const handleVehicleConnectionStatus = (event) => {
    console.log('📥 CarInfo收到vehicle-connection-status事件:', event.detail);
    const { carId, isConnected } = event.detail;
    
    // 根据当前选择的车辆信息来匹配
    const isCurrentVehicle = carId === props.carInfo || 
                           carId == props.carInfo ||   // 松散比较
                           // 向后兼容：如果carInfo是字母，转换为数字ID
                           (typeof props.carInfo === 'string' && 
                            carId === getVehicleIdFromLetter(props.carInfo));
    
    console.log(`🔍 CarInfo车辆匹配: 事件车辆${carId} vs 当前${props.carInfo} = ${isCurrentVehicle}`);
    
    if (isCurrentVehicle) {
        const oldStatus = isOnline.value;
        isOnline.value = isConnected;
        console.log(`🔗 CarInfo状态更新: 车辆${carId}, 连接:${isConnected} → ${oldStatus} → ${isOnline.value}`);
    }
};

// 监听车辆切换
watch(() => props.carInfo, (newVehicleId, oldVehicleId) => {
    if (newVehicleId !== oldVehicleId) {
        console.log(`🔄 车辆切换: ${oldVehicleId} → ${newVehicleId}`);
        resetToDefaultState();
        checkAndUpdateVehicleStatus();
    }
}, { immediate: true });

// 处理平行驾驶模式切换事件
const handleParallelDrivingModeChange = (event) => {
    parallelDrivingMode.value = event.detail.mode;
    console.log(`🎮 CarInfo平行驾驶模式切换: ${parallelDrivingMode.value ? '开启' : '关闭'}`);
};

onMounted(() => {
    // 监听车辆信息更新事件
    window.addEventListener('vehicle-info-update', handleVehicleInfoUpdate);
    // 监听车辆连接状态变化事件
    window.addEventListener('vehicle-connection-status', handleVehicleConnectionStatus);
    // 监听平行驾驶模式切换事件
    window.addEventListener('parallel-driving-mode-change', handleParallelDrivingModeChange);
    
    // 初始检查车辆状态
    checkAndUpdateVehicleStatus();
});

onBeforeUnmount(() => {
    window.removeEventListener('vehicle-info-update', handleVehicleInfoUpdate);
    window.removeEventListener('vehicle-connection-status', handleVehicleConnectionStatus);
    window.removeEventListener('parallel-driving-mode-change', handleParallelDrivingModeChange);
});
</script>

<style lang="scss" scoped>
.info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
}

.right-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* 方向盘容器样式 */
.steering-wheel-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100px;
}

/* 档位指示器样式 */
.gear-indicator {
    font-size: 2rem !important;
    font-weight: bold;
    color: #00ff88 !important;
    text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}

.info-card {
    min-width: 120px;
    height: 60px;
    background: rgba(10, 25, 47, 0.5);
    border-radius: 6px;
    padding: 8px;
    border: 1px solid rgba(0, 240, 255, 0.1);

    .info-title {
        font-size: 10px;
        color: #a0b3d0;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .info-value {
        font-size: 14px;
        font-weight: 600;
        color: #00f0ff;
        font-family: 'Orbitron', sans-serif;
        line-height: 1.2;
    }

    .info-value_low {
        color: #ff0080;
    }
}

.info-card-h {
    width: 100%;
    height: 70px;
}

.battery-container {
    margin-top: 4px;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;

    .battery-level {
        height: 100%;
        background: linear-gradient(90deg, #00d2ff 0%, #00ff9d 100%);
        border-radius: 3px;
        width: var(--battery-level, 0%);
        transition: width 0.3s ease;
    }

    .battery-level_low {
        background: linear-gradient(90deg, #fff 0%, #ff0080 100%);
    }
}

/* 状态颜色样式 */
.status-normal {
    color: var(--success, #00ff00);
}

/* .status-warning {
    color: var(--warning, #ffaa00);
} */

.status-error {
    color: var(--danger, #ff4444);
}
</style>