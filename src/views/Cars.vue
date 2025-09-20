<template>
    <div class="floating-vehicle-panel">
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import CarCamera from '@/components/CarCamera.vue';
import Sensor from '@/components/Sensor.vue';
import CarInfo from '@/components/CarInfo.vue';
import StatusIndicator from '@/components/StatusIndicator.vue';
import { useCarStore } from '@/stores/car.js';

const carStore = useCarStore();

// 使用store中的选中车辆ID
const selectedCar = computed(() => carStore.selectedCarId || 1);
const vehicleStatus = ref('offline'); // 车辆状态：online, offline，默认离线

const vehicleStatusText = computed(() => {
    const statusMap = {
        online: '在线',
        offline: '离线'
    };
    return statusMap[vehicleStatus.value] || '离线';
});

// 处理车辆连接状态变化事件
const handleVehicleConnectionStatus = (event) => {
    console.debug('📥 Cars页面收到vehicle-connection-status事件:', event.detail);
    const { carId, isConnected } = event.detail;
    
    // 根据当前选择的车辆信息来匹配
    const isCurrentVehicle = carId === selectedCar.value || 
                           carId == selectedCar.value;   // 松散比较
    
    console.debug(`🔍 Cars页面车辆匹配: 事件车辆${carId} vs 当前选中${selectedCar.value} = ${isCurrentVehicle}`);
    
    if (isCurrentVehicle) {
        const oldStatus = vehicleStatus.value;
        vehicleStatus.value = isConnected ? 'online' : 'offline';
        console.debug(`🚗 Cars页面状态更新: 车辆${carId}, 连接:${isConnected} → ${oldStatus} → ${vehicleStatus.value}`);
        console.debug(`🎨 StatusIndicator应该显示: ${vehicleStatus.value}`);
    }
};

// 移除模拟状态监控，使用真实的连接状态
const startVehicleStatusMonitoring = () => {
    // 不再需要模拟状态变化，状态由实际连接事件驱动
    console.debug('🎯 车辆状态监控已启动（基于真实连接状态）');
    console.debug('🔍 当前vehicleStatus:', vehicleStatus.value);
};

// 监听选中车辆变化
watch(selectedCar, (newVehicleId, oldVehicleId) => {
    if (newVehicleId !== oldVehicleId) {
        console.debug(`🔄 Cars页面车辆切换: ${oldVehicleId} → ${newVehicleId}`);
        // 重置为离线状态，等待实际连接状态确认
        vehicleStatus.value = 'offline';
        
        // 请求新车辆的连接状态
        console.debug(`📤 Cars页面请求车辆状态: ${newVehicleId}`);
        window.dispatchEvent(new CustomEvent('request-vehicle-status', {
            detail: {
                vehicleId: newVehicleId
            }
        }));
    }
}, { immediate: true });

onMounted(() => {
    // 监听车辆连接状态变化事件
    window.addEventListener('vehicle-connection-status', handleVehicleConnectionStatus);
    // 启动状态监控（现在只是日志输出）
    startVehicleStatusMonitoring();
});

onBeforeUnmount(() => {
    // 清理事件监听器
    window.removeEventListener('vehicle-connection-status', handleVehicleConnectionStatus);
});
</script>

<style lang="scss" scoped>
.floating-vehicle-panel {
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
    justify-content: space-between;
    gap: 12px;
    border-bottom: 2px solid rgba(0, 240, 255, 0.3);
    position: relative;
    width: 100%;
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

.panel-status {
    margin-left: auto;
    padding-left: 15px;
}

.status-value {
    font-weight: 600;
    color: var(--primary);
}

/* 滚动条样式 */
.floating-vehicle-panel::-webkit-scrollbar {
    width: 6px;
}

.floating-vehicle-panel::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
}

.floating-vehicle-panel::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, 
        var(--primary), 
        var(--primary-dark)
    );
    border-radius: 3px;
    box-shadow: 0 0 5px rgba(0, 240, 255, 0.3);
}

.floating-vehicle-panel::-webkit-scrollbar-thumb:hover {
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
}
</style>