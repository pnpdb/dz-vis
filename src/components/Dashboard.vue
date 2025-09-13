<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
    speedValue: {
        type: Number,
        default: 0,
    },
    hasSpeed: {
        type: Boolean,
        default: false,
    },
});

// 数字动画状态
const speedElement = ref(null);
const previousSpeed = ref(0);

// 数字变化时的动画（已禁用）
const animateSpeedChange = () => {
    // 动画效果已移除
};

// 计数完成回调（已简化）
const onCountFinished = () => {
    previousSpeed.value = props.speedValue;
};

// 格式化速度显示
const formatSpeed = (speed) => {
    const numSpeed = Number(speed);
    if (numSpeed === 0) {
        return '0';
    }
    return numSpeed.toFixed(2);
};

// 监听速度变化（动画已禁用）
watch(() => props.speedValue, (newVal, oldVal) => {
    if (newVal !== oldVal) {
        previousSpeed.value = newVal;
    }
}, { immediate: false });
</script>

<template>
    <!-- 仪表盘 -->
    <div class="dashboard-wrap center">
        <div
            :class="['out-circle', { 'out-circle_rotate': hasSpeed }, 'center']"
        >
            <div
                v-for="item in 60"
                :key="item"
                :style="`--i: ${item}; `"
                :class="['scend', { scend_active: item <= (speedValue * 60) }]"
            ></div>
            <div class="inner-circle">
                <div class="speed">
                    <span class="speed-counter">{{ formatSpeed(speedValue) }}</span>
                </div>
                <div class="unit">m/s</div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
$width: 120px;
$height: 120px;
$font-size: 26px;

.dashboard-wrap {
    flex-grow: 1;

    .out-circle {
        position: relative;
        min-width: $width;
        min-height: $height;
        border-radius: 50%;
        perspective: 500px;
        /* 透视距离，增加3D效果 */
        transform-style: preserve-3d;
        /* 让子元素继承3D空间 */
    }

    .out-circle_rotate::after {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        content: '';
        border: 1px solid #39485b;
        background-image: conic-gradient(
            from 46deg at 50% 50%,
            transparent,
            #24b8ee90 20%,
            #70ffae31 27%,
            transparent 17%
        );
        border-right: 2px #24ddee solid;
        animation: rotate 3s linear infinite;
    }

    .scend {
        position: absolute;
        top: 50%;
        left: 50%;
        height: 50%;
        width: 1px;
        border-bottom: 6px solid #39485b;
        transform-origin: top center;
        transform: rotate(calc(var(--i) * 6deg));
        transition: all 0.3s ease-in-out;
    }

    .scend_active {
        width: 4px;
        border-bottom: 10px solid var(--primary);
    }

    .inner-circle {
        width: $width * 0.8;
        height: $height * 0.8;
        position: absolute;
        z-index: 9;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);

        border-radius: 50%;
        box-shadow: #24b8ee90 0px 0px 20px inset;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .speed {
        color: rgb(255, 255, 255);
        font-size: $font-size;
        font-weight: 700;
        font-family: 'Orbitron', sans-serif !important;
        text-shadow:
            0px 1px 0px #17c0ff,
            0px 2px 0px #17c0ff,
            0px 3px 0px #17c0ff,
            0px 4px 0px #17c0ff,
            0px 5px 10px rgba(23, 192, 255, 0.5);
    }

    .unit {
        font-size: 20px;
        color: #ccc;
    }
}

@keyframes rotate {
    to {
        transform: rotate(360deg);
    }
}

/* 数字动画效果已移除 */
</style>