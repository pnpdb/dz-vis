<template>
    <div class="form-group">
        <label class="form-label">
            <fa icon="bars-staggered" /> 车辆参数
        </label>
        
        <!-- 车辆参数布局 -->
        <div class="info-grid">
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
                <div class="info-value">{{ navStatus.text }}</div>
            </div>
        </div>

    </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import Dashboard from '@/components/Dashboard.vue';
import { compareVehicleId, parseVehicleId } from '@/utils/vehicleTypes.js';
import eventBus, { EVENTS } from '@/utils/eventBus.js'
import logHelper from '@/utils/logHelper.js'

const props = defineProps({
    carInfo: {
        type: [String, Number],
        default: 1
    }
});

const batteryValue = ref(82);
const speedValue = ref(0);
const hasSpeed = ref(false);
const positionX = ref(116.40);
const positionY = ref(39.90);
const isOnline = ref(false);
const navStatus = ref({
    code: 0,
    text: '未导航'
});
const vehicleInfo = ref(null);

const currentVehicleId = ref(parseVehicleId(props.carInfo));

const resetToDefaultState = () => {
    speedValue.value = 0;
    hasSpeed.value = false;
    batteryValue.value = 0;
    positionX.value = 0;
    positionY.value = 0;
    isOnline.value = false;
    navStatus.value = {
        code: 0,
        text: '未导航'
    };
    vehicleInfo.value = null;
};

const getOnlineStatusText = () => isOnline.value ? '在线' : '离线';
const getOnlineStatusClass = () => isOnline.value ? 'status-normal' : 'status-error';

const checkAndUpdateVehicleStatus = () => {
    eventBus.emit(EVENTS.REQUEST_VEHICLE_STATUS, { vehicleId: currentVehicleId.value });
};

const handleVehicleInfoUpdate = (data) => {
    if (!data || typeof data !== 'object') return;

    const incomingId = data.vehicleId ?? data.carId;
    if (!compareVehicleId(incomingId, currentVehicleId.value)) {
        return;
    }

    hasSpeed.value = typeof data.speed === 'number';
    speedValue.value = hasSpeed.value ? data.speed : 0;
    positionX.value = data.position?.x ?? 0;
    positionY.value = data.position?.y ?? 0;
    batteryValue.value = typeof data.battery === 'number' ? Math.round(data.battery) : 0;
    navStatus.value = data.navigation ?? { code: 0, text: '未导航' };
    isOnline.value = true;
    vehicleInfo.value = data;
};

const handleVehicleConnectionStatus = ({ carId, vehicleId, isConnected }) => {
    const incomingId = vehicleId ?? carId;
    if (!compareVehicleId(incomingId, currentVehicleId.value)) {
        return;
    }

    const previous = isOnline.value;
    isOnline.value = Boolean(isConnected);
    logHelper.debug('CarInfo', '更新连接状态', {
        carId: incomingId,
        isConnected,
        previous,
        current: isOnline.value
    });
};

watch(() => props.carInfo, (newVehicleId, oldVehicleId) => {
    if (newVehicleId !== oldVehicleId) {
        currentVehicleId.value = parseVehicleId(newVehicleId);
        resetToDefaultState();
        checkAndUpdateVehicleStatus();
    }
}, { immediate: true });

onMounted(() => {
    eventBus.on(EVENTS.VEHICLE_INFO_UPDATE, handleVehicleInfoUpdate);
    eventBus.on(EVENTS.VEHICLE_CONNECTION_STATUS, handleVehicleConnectionStatus);
    checkAndUpdateVehicleStatus();
});

onBeforeUnmount(() => {
    eventBus.off(EVENTS.VEHICLE_INFO_UPDATE, handleVehicleInfoUpdate);
    eventBus.off(EVENTS.VEHICLE_CONNECTION_STATUS, handleVehicleConnectionStatus);
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

/* 移除平行驾驶模式相关样式 */

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