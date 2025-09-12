<template>
    <div class="app-container">
        <!-- 科技背景层 -->
        <div class="tech-background">
            <div class="grid-overlay"></div>
            <div class="particle-field"></div>
            <div class="hologram-lines"></div>
        </div>
        
        <!-- 悬浮导航栏 -->
        <Header class="floating-header" />
        
        <!-- 主3D内容区 - 全屏显示 -->
        <div class="main-scene">
            <Map class="fullscreen-3d" />
        </div>
        
        <!-- 悬浮控制面板 -->
        <div class="floating-panels">
            <RouterView />
        </div>
        
        <!-- HUD状态指示器 -->
        <div class="hud-overlay">
            <div class="status-indicator top-left">
                <div class="indicator-dot active"></div>
                <span>系统在线</span>
            </div>
            <div class="status-indicator top-right">
                <div class="timestamp">{{ currentTime }}</div>
            </div>
            <div class="status-indicator bottom-left">
                <div class="network-status">
                    <fa icon="signal" />
                    <span>网络连接正常</span>
                </div>
            </div>
            <div class="status-indicator bottom-right">
                <div class="performance-monitor">
                    <span>FPS: {{ fps }}</span>
                    <div class="fps-bar">
                        <div class="fps-fill" :style="{ width: fpsPercentage + '%' }"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { RouterView } from 'vue-router';
import Header from '@/components/Header.vue';
import Map from '@/views/Map.vue';

// 实时状态数据
const currentTime = ref('');
const fps = ref(60);
const fpsPercentage = ref(100);

// 更新时间
const updateTime = () => {
    const now = new Date();
    currentTime.value = now.toLocaleTimeString('zh-CN', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

// 模拟FPS监控
const updateFPS = () => {
    // 模拟FPS波动
    fps.value = Math.floor(58 + Math.random() * 4); // 58-62 FPS
    fpsPercentage.value = Math.min((fps.value / 60) * 100, 100);
};

// 窗口 resize 处理
const handleResize = () => {
    window.dispatchEvent(new CustomEvent('app-resize', {
        detail: {
            width: window.innerWidth,
            height: window.innerHeight
        }
    }));
};

let timeInterval = null;
let fpsInterval = null;

onMounted(() => {
    // 启动实时更新
    updateTime();
    timeInterval = setInterval(updateTime, 1000);
    fpsInterval = setInterval(updateFPS, 100);
    
    // 绑定resize事件
    window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
    // 清理定时器和事件
    if (timeInterval) clearInterval(timeInterval);
    if (fpsInterval) clearInterval(fpsInterval);
    window.removeEventListener('resize', handleResize);
});
</script>

<style lang="scss" scoped>
.app-container {
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: hidden;
    background: radial-gradient(circle at center, 
        rgba(0, 20, 40, 0.95) 0%, 
        rgba(0, 10, 25, 0.98) 50%, 
        rgba(0, 5, 15, 1) 100%
    );
}

/* 科技背景层 */
.tech-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
}

.grid-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: 
        linear-gradient(rgba(0, 240, 255, 0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 240, 255, 0.1) 1px, transparent 1px);
    background-size: 50px 50px;
    background-position: 0 0, 0 0;
    animation: gridFloat 20s linear infinite;
}

@keyframes gridFloat {
    0% { transform: translate(0, 0); }
    100% { transform: translate(50px, 50px); }
}

.particle-field {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: 
        radial-gradient(2px 2px at 20% 30%, rgba(0, 240, 255, 0.8), transparent),
        radial-gradient(2px 2px at 40% 70%, rgba(0, 200, 255, 0.6), transparent),
        radial-gradient(1px 1px at 90% 40%, rgba(0, 180, 255, 0.4), transparent),
        radial-gradient(1px 1px at 60% 80%, rgba(0, 220, 255, 0.3), transparent);
    background-size: 200px 200px, 150px 150px, 100px 100px, 80px 80px;
    animation: particleFloat 15s ease-in-out infinite alternate;
}

@keyframes particleFloat {
    0% { transform: translate(0, 0) scale(1); }
    100% { transform: translate(-20px, -10px) scale(1.1); }
}

.hologram-lines {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(
        90deg,
        transparent,
        transparent 98px,
        rgba(0, 240, 255, 0.03) 100px
    );
    animation: holoScan 8s linear infinite;
}

@keyframes holoScan {
    0% { transform: translateX(-100px); }
    100% { transform: translateX(100px); }
}

/* 悬浮导航栏 */
.floating-header {
    position: fixed;
    top: 20px;
    left: 20px;
    right: 20px;
    z-index: 1000;
    backdrop-filter: blur(20px);
    background: rgba(0, 15, 30, 0.8);
    border: 1px solid rgba(0, 240, 255, 0.3);
    border-radius: 20px;
    box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.5),
        0 0 20px rgba(0, 240, 255, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    margin: 0;
    animation: headerFloat 6s ease-in-out infinite;
}

@keyframes headerFloat {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-5px); }
}

/* 全屏3D场景 */
.main-scene {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10;
}

.fullscreen-3d {
    width: 100%;
    height: 100%;
    border-radius: 0;
    background: transparent;
    border: none;
    box-shadow: none;
}

/* 悬浮控制面板 */
.floating-panels {
    position: fixed;
    top: 120px;
    bottom: 20px;
    right: 20px;
    z-index: 100;
    pointer-events: none;
    max-width: 420px;
    width: 420px;
}

.floating-panels > * {
    pointer-events: auto;
    background: rgba(0, 15, 30, 0.85);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(0, 240, 255, 0.3);
    border-radius: 16px;
    box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.4),
        0 0 20px rgba(0, 240, 255, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
    animation: panelFloat 8s ease-in-out infinite;
}

@keyframes panelFloat {
    0%, 100% { transform: translateX(0px) translateY(0px); }
    25% { transform: translateX(5px) translateY(-5px); }
    75% { transform: translateX(-5px) translateY(5px); }
}

/* HUD状态指示器 */
.hud-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 200;
}

.status-indicator {
    position: absolute;
    padding: 12px 20px;
    background: rgba(0, 15, 30, 0.9);
    backdrop-filter: blur(15px);
    border: 1px solid rgba(0, 240, 255, 0.4);
    border-radius: 12px;
    color: var(--text-primary);
    font-family: 'Orbitron', monospace;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 
        0 4px 16px rgba(0, 0, 0, 0.3),
        0 0 10px rgba(0, 240, 255, 0.2);
    animation: hudPulse 4s ease-in-out infinite;
}

@keyframes hudPulse {
    0%, 100% { 
        box-shadow: 
            0 4px 16px rgba(0, 0, 0, 0.3),
            0 0 10px rgba(0, 240, 255, 0.2);
    }
    50% { 
        box-shadow: 
            0 4px 20px rgba(0, 0, 0, 0.4),
            0 0 15px rgba(0, 240, 255, 0.4);
    }
}

.top-left { top: 120px; left: 20px; }
.top-right { top: 120px; right: 440px; }
.bottom-left { bottom: 20px; left: 20px; }
.bottom-right { bottom: 20px; right: 440px; }

.indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff4444;
    animation: dotBlink 2s infinite;
}

.indicator-dot.active {
    background: #00ff88;
}

@keyframes dotBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.timestamp {
    font-family: 'Orbitron', monospace;
    font-weight: 700;
    color: var(--primary);
    text-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
}

.network-status {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--success);
}

.performance-monitor {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: 'Orbitron', monospace;
}

.fps-bar {
    width: 60px;
    height: 6px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    overflow: hidden;
}

.fps-fill {
    height: 100%;
    background: linear-gradient(90deg, #ff4444, #ffaa00, #00ff88);
    border-radius: 3px;
    transition: width 0.3s ease;
}

/* 响应式调整 */
@media (max-width: 1400px) {
    .floating-panels {
        right: 10px;
        max-width: 380px;
        width: 380px;
    }
    
    .top-right, .bottom-right {
        right: 400px;
    }
}

@media (max-width: 1200px) {
    .floating-panels {
        right: 10px;
        max-width: 350px;
        width: 350px;
    }
    
    .top-right, .bottom-right {
        right: 370px;
    }
}

/* 悬浮面板内部元素重置 */
:deep(.floating-panels .panel-card) {
    background: transparent;
    border: none;
    box-shadow: none;
    backdrop-filter: none;
    margin: 0;
    border-radius: 0;
}

:deep(.floating-panels .form-group) {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(0, 240, 255, 0.2);
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}

:deep(.floating-panels .form-group:hover) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(0, 240, 255, 0.4);
    box-shadow: 0 0 20px rgba(0, 240, 255, 0.15);
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
    transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.fade-enter-from {
    opacity: 0;
    transform: translateX(50px) scale(0.95);
}

.fade-leave-to {
    opacity: 0;
    transform: translateX(-50px) scale(0.95);
}
</style>
