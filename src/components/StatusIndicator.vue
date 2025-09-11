<template>
    <div 
        :class="['status-indicator', statusClass, pulseClass, `size-${size}`]"
        :title="title || statusText"
    >
        <div class="indicator-dot"></div>
        <span v-if="showLabel" class="indicator-label">{{ statusText }}</span>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    status: {
        type: String,
        default: 'offline',
        validator: (value) => ['online', 'offline', 'busy', 'error', 'warning'].includes(value)
    },
    showLabel: {
        type: Boolean,
        default: true
    },
    pulse: {
        type: Boolean,
        default: true
    },
    size: {
        type: String,
        default: 'medium',
        validator: (value) => ['small', 'medium', 'large'].includes(value)
    },
    title: {
        type: String,
        default: ''
    }
});

const statusClass = computed(() => `status-${props.status}`);
const pulseClass = computed(() => {
    if (!props.pulse) return '';
    
    switch (props.status) {
        case 'online':
            return 'status-breathing';
        case 'busy':
            return 'status-breathing';
        case 'error':
            return 'status-breathing';
        case 'warning':
            return 'status-pulse';
        default:
            return '';
    }
});

const statusText = computed(() => {
    const statusMap = {
        online: '在线',
        offline: '离线',
        busy: '忙碌',
        error: '故障',
        warning: '警告'
    };
    return statusMap[props.status] || '未知';
});
</script>

<style lang="scss" scoped>
.status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(5px);
    transition: all 0.3s ease;
    will-change: transform;
}

.indicator-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    position: relative;
    flex-shrink: 0;
    transition: all 0.3s ease;
}

.indicator-label {
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    transition: color 0.3s ease;
}

/* 尺寸变体 */
.status-indicator.size-small .indicator-dot {
    width: 8px;
    height: 8px;
}

.status-indicator.size-large .indicator-dot {
    width: 16px;
    height: 16px;
}

.status-indicator.size-large .indicator-label {
    font-size: 14px;
}

/* 状态颜色 */
.status-online .indicator-dot {
    background: linear-gradient(135deg, #00ff9d, #00cc7a);
    box-shadow: 0 0 10px rgba(0, 255, 157, 0.5);
}

.status-online .indicator-label {
    color: #00ff9d;
}

.status-offline .indicator-dot {
    background: linear-gradient(135deg, #666, #999);
    box-shadow: 0 0 5px rgba(150, 150, 150, 0.3);
}

.status-offline .indicator-label {
    color: #999;
}

.status-busy .indicator-dot {
    background: linear-gradient(135deg, #ffcc00, #ff9900);
    box-shadow: 0 0 10px rgba(255, 204, 0, 0.5);
}

.status-busy .indicator-label {
    color: #ffcc00;
}

.status-error .indicator-dot {
    background: linear-gradient(135deg, #ff4d4d, #cc0000);
    box-shadow: 0 0 10px rgba(255, 77, 77, 0.5);
}

.status-error .indicator-label {
    color: #ff4d4d;
}

.status-warning .indicator-dot {
    background: linear-gradient(135deg, #ff9900, #ff6600);
    box-shadow: 0 0 10px rgba(255, 153, 0, 0.5);
}

.status-warning .indicator-label {
    color: #ff9900;
}

/* 悬浮效果 */
.status-indicator:hover {
    transform: translateY(-1px);
    background: rgba(0, 0, 0, 0.5);
    border-color: rgba(255, 255, 255, 0.2);
}

.status-indicator:hover .indicator-dot {
    transform: scale(1.2);
}

/* 呼吸动画 */
.status-breathing .indicator-dot {
    animation: statusBreathing 2s ease-in-out infinite;
}

.status-breathing.status-busy .indicator-dot {
    animation: statusBreathing 1s ease-in-out infinite;
}

.status-breathing.status-error .indicator-dot {
    animation: statusErrorBlink 0.5s ease-in-out infinite alternate;
}

@keyframes statusBreathing {
    0%, 100% {
        transform: scale(1);
        opacity: 1;
    }
    50% {
        transform: scale(1.2);
        opacity: 0.7;
    }
}

@keyframes statusErrorBlink {
    0% {
        opacity: 1;
        box-shadow: 0 0 10px rgba(255, 77, 77, 0.5);
    }
    100% {
        opacity: 0.3;
        box-shadow: 0 0 20px rgba(255, 77, 77, 0.8);
    }
}

/* 脉冲波纹效果 */
.status-pulse .indicator-dot::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
    border-radius: 50%;
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
    animation: statusPulseWave 2s ease-out infinite;
}

@keyframes statusPulseWave {
    0% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
    }
    100% {
        transform: translate(-50%, -50%) scale(2.5);
        opacity: 0;
    }
}
</style>