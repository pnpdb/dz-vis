<template>
    <div class="form-group">
        <label class="form-label">
            <fa icon="bars-staggered" /> 车辆参数
        </label>
        <div class="info-grid">
            <Dashboard :speedValue="speedValue" :hasSpeed="hasSpeed" />
            
            <div class="flex-h">
                <div class="info-card info-card-h">
                    <div class="info-title">
                        <fa icon="compass" />
                        位置
                    </div>
                    <div class="info-value">X: 116.40</div>
                    <div class="info-value">Y: 39.90</div>
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
                    <fa icon="car" />
                    车辆名称
                </div>
                <div class="info-value">{{ carInfo || '车辆A' }}</div>
            </div>
            <div class="info-card">
                <div class="info-title">
                    <fa icon="wifi" />
                    在线状态
                </div>
                <div class="info-value status-normal">在线</div>
            </div>
            <div class="info-card">
                <div class="info-title">
                    <fa icon="refresh" />
                    循环状态
                </div>
                <div class="info-value">75%</div>
            </div>

            <div class="info-card">
                <div class="info-title">
                    <fa icon="route" />
                    导航状态
                </div>
                <div class="info-value">导航中</div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import Dashboard from '@/components/Dashboard.vue';

const props = defineProps({
    carInfo: {
        type: String,
        default: 'A'
    }
});

const batteryValue = ref(82);
const speedValue = ref(0);
const hasSpeed = ref(false);
let speedTimer = null;

const handleSpeedValue = (value) => {
    speedValue.value = value;
};

onMounted(() => {
    speedTimer = setInterval(() => {
        // 速度随机在20-30之间
        speedValue.value = Math.floor(Math.random() * 10) + 20;
        hasSpeed.value = true;
    }, 1000);
});

onBeforeUnmount(() => {
    if (speedTimer) {
        clearInterval(speedTimer);
    }
});
</script>

<style lang="scss" scoped>
.info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.info-card {
    min-width: 150px;
    height: 84px;
    background: rgba(10, 25, 47, 0.5);
    border-radius: 8px;
    padding: 15px;
    border: 1px solid rgba(0, 240, 255, 0.1);

    .info-title {
        font-size: 14px;
        color: #a0b3d0;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .info-value {
        font-size: 18px;
        font-weight: 600;
        color: #00f0ff;
        font-family: 'Orbitron', sans-serif;
    }

    .info-value_low {
        color: #ff0080;
    }
}

.info-card-h {
    width: 100%;
    height: 100px;
}

.battery-container {
    margin-top: 8px;
    height: 10px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    overflow: hidden;

    .battery-level {
        height: 100%;
        background: linear-gradient(90deg, #00d2ff 0%, #00ff9d 100%);
        border-radius: 5px;
        width: var(--battery-level, 0%);
        transition: width 0.3s ease;
    }

    .battery-level_low {
        background: linear-gradient(90deg, #fff 0%, #ff0080 100%);
    }
}
</style>