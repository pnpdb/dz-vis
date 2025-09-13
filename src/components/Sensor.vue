<template>
    <div class="form-group">
        <label class="form-label"><fa icon="cog" /> 传感器</label>

        <div class="sensor center">
            <div class="circle-tit">传感器</div>
            <div :class="['circle1', { circle1_active: online }]"></div>
            <div class="circle2"></div>
            <div :class="['circle3', { circle3_active: online }]"></div>
            <div class="circle4">
                <div class="point1 center">
                    <div class="sensor-item sensor-item1">
                        <div class="sensor-tit">
                            <fa icon="compass" /> 陀螺仪
                        </div>
                        <div :class="getClass(sensorData.imuState)">
                            {{ getDesc(sensorData.imuState) }}
                        </div>
                    </div>
                </div>
                <div class="point2 center">
                    <div class="sensor-item sensor-item2">
                        <div class="sensor-tit">
                            <fa icon="signal" />
                            激光雷达
                        </div>
                        <div :class="getClass(sensorData.lidarState)">
                            {{ getDesc(sensorData.lidarState) }}
                        </div>
                    </div>
                </div>
                <div class="point3 center">
                    <div class="sensor-item sensor-item3">
                        <div class="sensor-tit">
                            <fa icon="camera" /> 相机
                        </div>
                        <div :class="getClass(sensorData.cameraState)">
                            {{ getDesc(sensorData.cameraState) }}
                        </div>
                    </div>
                </div>
                <div class="point4 center">
                    <div class="sensor-item sensor-item4">
                        <div class="sensor-tit">
                            <fa icon="wifi" /> 北斗
                        </div>
                        <div :class="getClass(sensorData.beidouState)">
                            {{ getDesc(sensorData.beidouState) }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
    carInfo: {
        type: String,
        default: 'A'
    },
    online: {
        type: Boolean,
        default: true
    }
});

const sensorData = ref({
    imuState: 1,
    lidarState: 1,
    cameraState: 1,
    beidouState: 1
});

// 重置传感器状态为默认状态
const resetSensorData = () => {
    sensorData.value = {
        imuState: 0,  // 未连接时显示异常
        lidarState: 0,
        cameraState: 0,
        beidouState: 0
    };
    console.log(`🔄 重置车辆${props.carInfo}传感器状态为默认状态`);
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
const handleVehicleInfoUpdate = (event) => {
    const vehicleInfo = event.detail;
    
    // 根据当前选择的车辆信息来匹配
    const isCurrentVehicle = vehicleInfo.carId === props.carInfo || 
                           vehicleInfo.vehicleId === props.carInfo ||
                           // 向后兼容：如果carInfo是字母，转换为数字ID
                           (typeof props.carInfo === 'string' && 
                            vehicleInfo.vehicleId === getVehicleIdFromLetter(props.carInfo));
    
    if (isCurrentVehicle) {
        // 更新传感器状态
        sensorData.value = {
            imuState: vehicleInfo.sensors.gyro.status ? 1 : 0,
            lidarState: vehicleInfo.sensors.lidar.status ? 1 : 0,
            cameraState: vehicleInfo.sensors.camera.status ? 1 : 0,
            beidouState: vehicleInfo.sensors.beidou.status ? 1 : 0
        };
        
        console.log(`更新车辆${props.carInfo}传感器状态:`, sensorData.value);
    }
};

// 向后兼容：字母ID转数字ID的映射
const getVehicleIdFromLetter = (letter) => {
    const letterMap = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
    return letterMap[letter.toUpperCase()] || null;
};

// 监听车辆切换
watch(() => props.carInfo, (newVehicleId, oldVehicleId) => {
    if (newVehicleId !== oldVehicleId) {
        console.log(`🔄 Sensor车辆切换: ${oldVehicleId} → ${newVehicleId}`);
        resetSensorData();
    }
}, { immediate: true });

onMounted(() => {
    // 监听车辆信息更新事件
    window.addEventListener('vehicle-info-update', handleVehicleInfoUpdate);
});

onBeforeUnmount(() => {
    window.removeEventListener('vehicle-info-update', handleVehicleInfoUpdate);
});
</script>

<style lang="scss" scoped>
.sensor {
    position: relative;
    width: 100%;
    height: 180px;

    .circle-tit {
        font-size: 15px;
        font-weight: bold;
        font-family: Arial, sans-serif;
        animation: breathing 3s infinite;
        text-shadow: 1px 1px 4px var(--primary);
        color: var(--primary);
    }

    @keyframes breathing {
        0% {
            transform: scale(1);
        }

        50% {
            transform: scale(0.9);
        }

        100% {
            transform: scale(1);
        }
    }

    .circle1 {
        position: absolute;
        width: 70px;
        height: 70px;
        border-radius: 50%;
        border-top: 2px #ffffff40 solid;
        border-bottom: 2px #ffffff40 solid;
        border-left: 2px #39485b solid;
        border-right: 2px #39485b solid;
        box-shadow: 0 0 2px #fff;
    }
    .circle1_active {
        animation: rotateAn 2s linear infinite;
    }

    .circle2 {
        position: absolute;
        width: 95px;
        height: 95px;
        border-radius: 50%;
        border: 8px #39485be1 solid;
        box-shadow: var(--primary) 0px 0px 10px;
    }

    .circle3 {
        position: absolute;
        width: 120px;
        height: 120px;
        border-radius: 50%;
        border-left: 2px #ffffff40 solid;
        border-right: 2px #ffffff40 solid;
        border-top: 2px #39485b solid;
        border-bottom: 2px #39485b solid;
        box-shadow: 0px 0px 2px #fff;
    }
    .circle3_active {
        animation: rotateAn 3s linear infinite;
    }

    .circle4 {
        position: absolute;
        width: 155px;
        height: 140px;
        border-radius: 50%;
        border-top: 1px transparent solid;
        border-bottom: 1px transparent solid;
        border-left: 1px var(--primary-transparent) solid;
        border-right: 1px var(--primary-transparent) solid;
    }

    .point {
        width: 2px;
        height: 2px;
        border-radius: 50%;
        background-color: #fff;
        position: absolute;
    }

    .point_after {
        position: absolute;
        content: '';
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 1px solid var(--primary-light);
    }

    .point_before {
        position: absolute;
        content: '';
        width: 45px;
        height: 2px;
        background: linear-gradient(to right, #39485b, var(--primary-light));
    }

    .point1 {
        @extend .point;
        left: 20px;
        top: 24px;
    }

    .point1::after {
        @extend .point_after;
    }

    .point1::before {
        @extend .point_before;
        right: 6px;
    }

    .point2 {
        @extend .point;
        right: 22px;
        top: 24px;
    }

    .point2::after {
        @extend .point_after;
    }

    .point2::before {
        @extend .point_before;
        background: linear-gradient(to left, #39485b, var(--primary-light));
        left: 6px;
    }

    .point3 {
        @extend .point;
        left: 22px;
        bottom: 24px;
    }

    .point3::after {
        @extend .point_after;
    }

    .point3::before {
        @extend .point_before;
        right: 6px;
    }

    .point4 {
        @extend .point;
        right: 22px;
        bottom: 24px;
    }

    .point4::after {
        @extend .point_after;
    }

    .point4::before {
        @extend .point_before;
        background: linear-gradient(to left, #39485b, var(--primary-light));
        left: 6px;
    }
}

.sensor-item {
    position: relative;
    left: -60px;
    top: -5px;
    text-align: center;

    .sensor-tit {
        margin-bottom: 3px;
        font-size: 12px;
        width: 70px;
        color: #a0b3d0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
    }

    .sensor-state {
        font-size: 12px;
    }
}

.sensor-item2 {
    position: relative;
    left: 60px;
}

.sensor-item4 {
    position: relative;
    left: 60px;
}

@keyframes rotateAn {
    0% {
        transform: rotate(0);
    }

    100% {
        transform: rotate(360deg);
    }
}
</style>