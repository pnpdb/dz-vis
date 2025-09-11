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
import { ref, computed } from 'vue';

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

const getDesc = (val) => {
    return !props.online || val !== 1 ? '异常' : '正常';
};

const getClass = (val) => {
    return !props.online || val !== 1
        ? 'sensor-state status-error'
        : 'sensor-state status-normal';
};
</script>

<style lang="scss" scoped>
.sensor {
    position: relative;
    width: 100%;
    height: 200px;

    .circle-tit {
        font-size: 18px;
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
        width: 80px;
        height: 80px;
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
        width: 110px;
        height: 110px;
        border-radius: 50%;
        border: 10px #39485be1 solid;
        box-shadow: var(--primary) 0px 0px 10px;
    }

    .circle3 {
        position: absolute;
        width: 140px;
        height: 140px;
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
        width: 180px;
        height: 160px;
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
    left: -70px;
    top: -5px;
    text-align: center;

    .sensor-tit {
        margin-bottom: 4px;
        font-size: 14px;
        width: 80px;
        color: #a0b3d0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
    }

    .sensor-state {
        font-size: 14px;
    }
}

.sensor-item2 {
    position: relative;
    left: 70px;
}

.sensor-item4 {
    position: relative;
    left: 70px;
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