<template>
    <div class="form-group">
        <label class="form-label">
            <fa icon="bars-staggered" /> 车辆参数
        </label>
        <div class="info-grid">
            <Dashboard :speedValue="speedValue" :hasSpeed="hasSpeed" />
            
            <div class="right-column">
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
                    <fa icon="wifi" />
                    在线状态
                </div>
                <div class="info-value status-normal">在线</div>
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
    gap: 8px;
}

.right-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
</style>