<template>
    <div class="panel-card">
        <div class="panel-header">
            <div class="panel-icon">
                <fa icon="car-side" />
            </div>
            <h2 class="panel-title">车辆信息</h2>
            <div class="panel-status">
                <StatusIndicator 
                    :status="vehicleStatus" 
                    :show-label="false" 
                    size="medium"
                    title="车辆状态"
                />
            </div>
        </div>

        <!-- 车载摄像头 -->
        <CarCamera />

        <!-- 车辆信息 -->
        <CarInfo :carInfo="selectedCar" />

        <!-- 传感器 -->
        <Sensor :carInfo="selectedCar" :online="vehicleStatus === 'online'" />
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import CarCamera from '@/components/CarCamera.vue';
import Sensor from '@/components/Sensor.vue';
import CarInfo from '@/components/CarInfo.vue';
import StatusIndicator from '@/components/StatusIndicator.vue';

const selectedCar = ref('B');
const vehicleStatus = ref('online'); // 车辆状态：online, offline, busy, error, warning
let vehicleStatusTimer = null;

const vehicleStatusText = computed(() => {
    const statusMap = {
        online: '在线',
        offline: '离线',
        busy: '忙碌',
        error: '错误',
        warning: '警告'
    };
    return statusMap[vehicleStatus.value] || '未知';
});

// 开始车辆状态监控
const startVehicleStatusMonitoring = () => {
    vehicleStatusTimer = setInterval(() => {
        // 模拟车辆状态变化
        const states = ['online', 'busy', 'warning'];
        const randomIndex = Math.floor(Math.random() * states.length);
        vehicleStatus.value = states[randomIndex];
        
        // 偶尔模拟离线状态
        if (Math.random() > 0.95) {
            vehicleStatus.value = 'offline';
        }
    }, 8000); // 每8秒检查一次车辆状态
};

onMounted(() => {
    // 模拟车辆状态监控
    startVehicleStatusMonitoring();
});

onBeforeUnmount(() => {
    if (vehicleStatusTimer) {
        clearInterval(vehicleStatusTimer);
    }
});
</script>

<style lang="scss" scoped>
.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
}

.panel-status {
    margin-left: auto;
    padding-left: 15px;
}

.status-value {
    font-weight: 600;
    color: var(--primary);
}
</style>