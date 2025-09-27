<template>
    <div class="form-group">
        <label class="form-label"><fa icon="cog" /> 传感器</label>

        <div class="sensor-list">
            <div class="sensor-card">
                <div class="sensor-icon"><fa icon="compass" /></div>
                <div class="sensor-name">陀螺仪</div>
                <div :class="getClass(sensorData.imuState)">{{ getDesc(sensorData.imuState) }}</div>
                        </div>
            <div class="sensor-card">
                <div class="sensor-icon"><fa icon="signal" /></div>
                <div class="sensor-name">激光雷达</div>
                <div :class="getClass(sensorData.lidarState)">{{ getDesc(sensorData.lidarState) }}</div>
                        </div>
            <div class="sensor-card">
                <div class="sensor-icon"><fa icon="camera" /></div>
                <div class="sensor-name">相机</div>
                <div :class="getClass(sensorData.cameraState)">{{ getDesc(sensorData.cameraState) }}</div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import eventBus, { EVENTS } from '@/utils/eventBus.js'

const props = defineProps({
    carInfo: {
        type: [String, Number], // 支持字符串和数字类型
        default: 1
    },
    online: {
        type: Boolean,
        default: true
    }
});

const sensorData = ref({
    imuState: 1,
    lidarState: 1,
    cameraState: 1
});

// 重置传感器状态为默认状态
const resetSensorData = () => {
    sensorData.value = {
        imuState: 0,  // 未连接时显示异常
        lidarState: 0,
        cameraState: 0
    };
    console.debug(`🔄 重置车辆${props.carInfo}传感器状态为默认状态`);
};

const getDesc = (val) => {
    return !props.online || val !== 1 ? '异常' : '正常';
};

const getClass = (val) => {
    return !props.online || val !== 1
        ? 'sensor-state status-error'
        : 'sensor-state status-normal';
};

// 处理车辆信息更新事件
const handleVehicleInfoUpdate = (vehicleInfo) => {
    if (!vehicleInfo || typeof vehicleInfo !== 'object') return

    const isCurrentVehicle = vehicleInfo.carId === props.carInfo ||
        vehicleInfo.vehicleId === props.carInfo ||
        (typeof props.carInfo === 'string' &&
            vehicleInfo.vehicleId === getVehicleIdFromLetter(props.carInfo))

    if (isCurrentVehicle) {
        sensorData.value = {
            imuState: vehicleInfo.sensors.gyro?.status ? 1 : 0,
            lidarState: vehicleInfo.sensors.lidar?.status ? 1 : 0,
            cameraState: vehicleInfo.sensors.camera?.status ? 1 : 0
        }
        console.debug(`更新车辆${props.carInfo}传感器状态:`, sensorData.value)
    }
}

// 向后兼容：字母ID转数字ID的映射
const getVehicleIdFromLetter = (letter) => {
    const letterMap = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
    return letterMap[letter.toUpperCase()] || null;
};

// 监听车辆切换
watch(() => props.carInfo, (newVehicleId, oldVehicleId) => {
    if (newVehicleId !== oldVehicleId) {
        console.debug(`🔄 Sensor车辆切换: ${oldVehicleId} → ${newVehicleId}`);
        resetSensorData();
    }
}, { immediate: true });

onMounted(() => {
    eventBus.on(EVENTS.VEHICLE_INFO_UPDATE, handleVehicleInfoUpdate)
    eventBus.emit(EVENTS.REQUEST_VEHICLE_STATUS, { vehicleId: props.carInfo })
})

onBeforeUnmount(() => {
    eventBus.off(EVENTS.VEHICLE_INFO_UPDATE, handleVehicleInfoUpdate)
})
</script>

<style lang="scss" scoped>
.sensor-list {
    display: flex;
    gap: 8px;
}

.sensor-card {
    flex: 1;
    min-width: 90px;
    background: rgba(10, 25, 47, 0.5);
    border: 1px solid rgba(0, 240, 255, 0.1);
    border-radius: 6px;
    padding: 8px;
    text-align: center;
}

.sensor-icon {
    color: var(--primary);
    margin-bottom: 4px;
}

.sensor-name {
        font-size: 12px;
        color: #a0b3d0;
    margin-bottom: 2px;
    }

    .sensor-state {
        font-size: 12px;
}

.status-normal { color: var(--success, #00ff00); }
.status-error { color: var(--danger, #ff4444); }
</style>