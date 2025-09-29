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
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import eventBus, { EVENTS } from '@/utils/eventBus.js';

const OFFLINE_TEXT = '--';

const props = defineProps({
    carInfo: {
        type: [String, Number],
        default: 1,
    },
    online: {
        type: Boolean,
        default: false,
    },
});

const sensorData = ref({
    imuState: 0,
    lidarState: 0,
    cameraState: 0,
});

const resetSensorData = () => {
    sensorData.value = {
        imuState: 0,
        lidarState: 0,
        cameraState: 0,
    };
};

const getDesc = (val) => {
    if (!props.online) return OFFLINE_TEXT;
    return val === 1 ? '正常' : '异常';
};

const getClass = (val) => {
    if (!props.online) return 'sensor-state status-offline';
    return val === 1 ? 'sensor-state status-normal' : 'sensor-state status-error';
};

const getVehicleIdFromLetter = (letter) => {
    const letterMap = { A: 1, B: 2, C: 3, D: 4, E: 5 };
    return letterMap[letter.toUpperCase()] || null;
};

const handleVehicleInfoUpdate = (vehicleInfo) => {
    if (!vehicleInfo || typeof vehicleInfo !== 'object') return;

    const isCurrentVehicle =
        vehicleInfo.carId === props.carInfo ||
        vehicleInfo.vehicleId === props.carInfo ||
        (typeof props.carInfo === 'string' &&
            vehicleInfo.vehicleId === getVehicleIdFromLetter(props.carInfo));

    // console.debug('📥 Sensor收到车辆信息事件:', {
    //     incomingId: vehicleInfo.vehicleId ?? vehicleInfo.carId,
    //     target: props.carInfo,
    //     isCurrentVehicle,
    //     online: props.online,
    //     sensors: vehicleInfo.sensors,
    // });

    if (isCurrentVehicle) {
        sensorData.value = {
            imuState: vehicleInfo.sensors.gyro?.status ? 1 : 0,
            lidarState: vehicleInfo.sensors.lidar?.status ? 1 : 0,
            cameraState: vehicleInfo.sensors.camera?.status ? 1 : 0,
        };
        // console.debug('✅ Sensor状态更新:', sensorData.value);
    }
};

watch(
    () => props.carInfo,
    (newVehicleId, oldVehicleId) => {
        if (newVehicleId !== oldVehicleId) {
            resetSensorData();
        }
    },
    { immediate: true },
);

watch(
    () => props.online,
    (online) => {
        if (!online) {
            resetSensorData();
        }
    },
);

onMounted(() => {
    eventBus.on(EVENTS.VEHICLE_INFO_UPDATE, handleVehicleInfoUpdate);
    eventBus.emit(EVENTS.REQUEST_VEHICLE_STATUS, { vehicleId: props.carInfo });
});

onBeforeUnmount(() => {
    eventBus.off(EVENTS.VEHICLE_INFO_UPDATE, handleVehicleInfoUpdate);
});
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

.status-normal {
    color: var(--success, #00ff00);
}

.status-error {
    color: var(--danger, #ff4444);
}

.status-offline {
    color: #a0b3d0;
}
</style>