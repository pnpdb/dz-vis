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

// 数字变化时的炫酷动画
const animateSpeedChange = () => {
    const element = document.querySelector('.speed-counter');
    if (element) {
        // 添加闪光效果
        element.classList.add('number-flash');
        setTimeout(() => {
            element.classList.remove('number-flash');
        }, 800);
        
        // 添加数字跳动效果
        if (Math.abs(props.speedValue - previousSpeed.value) > 5) {
            element.classList.add('number-bounce');
            setTimeout(() => {
                element.classList.remove('number-bounce');
            }, 800);
        } else {
            element.classList.add('number-roll');
            setTimeout(() => {
                element.classList.remove('number-roll');
            }, 600);
        }
    }
};

// 计数完成回调
const onCountFinished = () => {
    const element = document.querySelector('.speed-counter');
    if (element && props.speedValue > previousSpeed.value) {
        // 速度增加时添加脉冲效果
        element.style.textShadow = `
            0px 1px 0px #17c0ff,
            0px 2px 0px #17c0ff,
            0px 3px 0px #17c0ff,
            0px 4px 0px #17c0ff,
            0px 5px 10px rgba(23, 192, 255, 0.8),
            0 0 20px rgba(23, 192, 255, 0.6)
        `;
        
        setTimeout(() => {
            element.style.textShadow = `
                0px 1px 0px #17c0ff,
                0px 2px 0px #17c0ff,
                0px 3px 0px #17c0ff,
                0px 4px 0px #17c0ff,
                0px 5px 10px rgba(23, 192, 255, 0.5)
            `;
        }, 300);
    }
    previousSpeed.value = props.speedValue;
};

// 监听速度变化
watch(() => props.speedValue, (newVal, oldVal) => {
    if (newVal !== oldVal) {
        nextTick(() => {
            animateSpeedChange();
        });
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
                :class="['scend', { scend_active: item * 2 <= speedValue }]"
            ></div>
            <div class="inner-circle">
                <div class="speed number-animate will-change-transform">
                    <span class="speed-counter">{{ speedValue }}</span>
                </div>
                <div class="unit">km/h</div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
$width: 190px;
$height: 190px;
$font-size: 50px;

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

/* 数字动画效果 */
.number-flash {
    animation: flash 0.8s ease-in-out;
}

.number-bounce {
    animation: bounce 0.8s ease-in-out;
}

.number-roll {
    animation: roll 0.6s ease-in-out;
}

@keyframes flash {
    0%, 100% { 
        filter: brightness(1); 
    }
    50% { 
        filter: brightness(1.5);
        text-shadow:
            0px 1px 0px #17c0ff,
            0px 2px 0px #17c0ff,
            0px 3px 0px #17c0ff,
            0px 4px 0px #17c0ff,
            0px 5px 10px rgba(23, 192, 255, 0.8),
            0 0 30px rgba(23, 192, 255, 0.8);
    }
}

@keyframes bounce {
    0%, 100% { 
        transform: scale(1); 
    }
    50% { 
        transform: scale(1.1); 
    }
}

@keyframes roll {
    0% { 
        transform: rotateY(0deg); 
    }
    50% { 
        transform: rotateY(180deg); 
    }
    100% { 
        transform: rotateY(360deg); 
    }
}
</style>