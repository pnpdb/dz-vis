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

        <!-- 浮动日志查看器（可拖拽） -->
        <LogViewer v-model="showLogViewer" />
        
        <!-- HUD状态指示器 -->
        <div class="hud-overlay">
            <!-- FPS显示 - 右上角时间左侧 -->
            <div class="status-indicator top-right-fps">
                <div class="performance-monitor">
                    <span>FPS: {{ fps.toString().padStart(2, ' ') }}</span>
                    <div class="fps-bar">
                        <div class="fps-fill" :style="{ width: fpsPercentage + '%' }"></div>
                    </div>
                </div>
            </div>
            <!-- 系统时间 - 右上角 -->
            <div class="status-indicator top-right">
                <div class="timestamp">{{ currentTime }}</div>
            </div>
            <div class="status-indicator bottom-left">
                <div class="network-status">
                    <fa :icon="networkStatus.icon" />
                    <span>{{ networkStatus.text }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { RouterView } from 'vue-router';
import Header from '@/components/Header.vue';
import LogViewer from '@/components/LogViewer.vue';
import Map from '@/views/Map.vue';
import { error as jsError } from '@tauri-apps/plugin-log';

// 实时状态数据
const currentTime = ref('');
const fps = ref(60);
const fpsPercentage = ref(100);
const networkStatus = ref({
    text: '检测网络中...',
    icon: 'signal',
    connected: false
});

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

// 真实FPS监控
const updateFPS = (fpsData) => {
    if (fpsData && typeof fpsData.fps === 'number') {
        fps.value = fpsData.fps;
        fpsPercentage.value = Math.min((fps.value / 60) * 100, 100);
    }
};

// 监听3D场景的FPS事件
const handleFPSUpdate = (event) => {
    updateFPS(event.detail);
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

// 检测网络连接状态（使用Rust后端）
const checkNetworkStatus = async () => {
    try {
        // 首先检查浏览器的在线状态
        if (!navigator.onLine) {
            networkStatus.value = {
                text: '网络断开',
                icon: 'times-circle',
                connected: false
            };
            return;
        }

        // 调用Rust后端获取网络状态
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('get_network_status');
        
        networkStatus.value = {
            text: result.text,
            icon: result.icon,
            connected: result.connected
        };
        
    } catch (error) {
        await jsError('网络状态检测失败:', error);
        networkStatus.value = {
            text: '网络状态未知',
            icon: 'question-circle',
            connected: false
        };
    }
};


let timeInterval = null;
let networkInterval = null;
const showLogViewer = ref(false);

onMounted(() => {
    // 启动实时更新
    updateTime();
    timeInterval = setInterval(updateTime, 1000);
    
    // 启动网络状态检测
    checkNetworkStatus();
    networkInterval = setInterval(checkNetworkStatus, 30000); // 每30秒检测一次
    
    // 监听网络状态变化
    window.addEventListener('online', checkNetworkStatus);
    window.addEventListener('offline', checkNetworkStatus);
    
    // 监听FPS更新事件
    window.addEventListener('fps-update', handleFPSUpdate);
    
    // 绑定resize事件
    window.addEventListener('resize', handleResize);

    // 根据设置动态控制日志查看器显示
    window.addEventListener('toggle-log-viewer', (e) => {
        showLogViewer.value = !!(e?.detail?.visible);
    });
});

onBeforeUnmount(() => {
    // 清理定时器和事件
    if (timeInterval) clearInterval(timeInterval);
    if (networkInterval) clearInterval(networkInterval);
    
    window.removeEventListener('fps-update', handleFPSUpdate);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('online', checkNetworkStatus);
    window.removeEventListener('offline', checkNetworkStatus);
    window.removeEventListener('toggle-log-viewer', () => {});
});
</script>

<style lang="scss" scoped>
.app-container {
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: visible; /* 允许对话框显示在容器外 */
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
.top-right { top: 120px; right: 450px; }
.top-right-fps { top: 120px; right: 570px; } /* FPS显示在时间左侧 */
.bottom-left { bottom: 20px; left: 20px; }
.bottom-right { bottom: 20px; right: 450px; }

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
    transition: color 0.3s ease;
    
    &:has(.fa-times-circle),
    &:has(.fa-exclamation-triangle),
    &:has(.fa-question-circle) {
        color: var(--danger, #ff4444);
    }
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
    
    .top-right-fps {
        right: 510px;
    }
}

@media (max-width: 1200px) {
    .floating-panels {
        right: 10px;
        max-width: 340px;
        width: 340px;
    }
    
    .top-right, .bottom-right {
        right: 360px;
    }
    
    .top-right-fps {
        right: 470px;
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
    padding: 12px;
    margin-bottom: 10px;
}

:deep(.floating-panels .form-group:hover) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(0, 240, 255, 0.4);
    box-shadow: 0 0 20px rgba(0, 240, 255, 0.15);
}

/* 右侧面板紧凑化 */
:deep(.floating-panels .form-label) {
    margin-bottom: 4px;
    gap: 6px;
}

/* 优化按钮样式，恢复占满宽度 */
:deep(.floating-panels .btn) {
    width: 100% !important;
    min-height: 36px !important;
    padding: 8px 16px !important;
    font-size: 12px !important;
    border-radius: 4px !important;
}

:deep(.floating-panels .el-button) {
    width: 100% !important;
    min-height: 36px !important;
    padding: 8px 16px !important;
    font-size: 12px !important;
    border-radius: 4px !important;
}

:deep(.floating-panels .el-select) {
    max-width: 100% !important;
}

:deep(.floating-panels .el-input-number) {
    max-width: 100% !important;
}

/* 优化表单组布局 */
:deep(.floating-panels .form-group) {
    margin-bottom: 12px !important;
    padding: 8px !important;
}

:deep(.floating-panels .flex) {
    margin-bottom: 6px !important;
}


/* 优化网格布局 */
:deep(.floating-panels .light-controls) {
    gap: 6px !important;
}

:deep(.floating-panels .control-buttons) {
    gap: 6px !important;
}

/* 优化地图点选择和其他特殊布局 */
:deep(.floating-panels .map-points) {
    gap: 6px !important;
}

:deep(.floating-panels .map-point-item) {
    padding: 6px !important;
    margin-bottom: 4px !important;
}

:deep(.floating-panels .map-point-value) {
    padding: 6px 10px !important;
    font-size: 11px !important;
    min-height: 32px !important;
}

/* 优化摄像头控制按钮 */
:deep(.floating-panels .camera-controls) {
    gap: 6px !important;
}

:deep(.floating-panels .camera-controls .btn) {
    width: 100% !important;
    font-size: 12px !important;
    padding: 8px 16px !important;
    min-height: 36px !important;
    border-radius: 4px !important;
}

/* 统一字号规范 */
:deep(.floating-panels .panel-header .panel-title) {
    font-size: 18px !important;
}

/* 一级标题 - 面板标题 */
:deep(.floating-panels .panel-title) {
    font-size: 18px !important;
}

/* 二级标题 - 表单组标题 */
:deep(.floating-panels .form-label) {
    font-size: 13px !important;
}

/* 三级标题 - 输入标签 */
:deep(.floating-panels .input-label) {
    font-size: 12px !important;
    margin-bottom: 4px !important;
    color: rgba(255, 255, 255, 0.7) !important;
}

/* 内容文字 - 普通文本 */
:deep(.floating-panels .info-title) {
    font-size: 11px !important;
}

:deep(.floating-panels .info-value) {
    font-size: 14px !important;
}

:deep(.floating-panels .camera-desc) {
    font-size: 12px !important;
}

:deep(.floating-panels .camera-overlay) {
    font-size: 11px !important;
}

/* 按钮文字和圆角 */
:deep(.floating-panels .btn) {
    font-size: 12px !important;
    border-radius: 4px !important;
}

:deep(.floating-panels .el-button) {
    font-size: 12px !important;
    border-radius: 4px !important;
}

/* 确保所有控制按钮都使用小圆角 */
:deep(.floating-panels .control-btn) {
    border-radius: 4px !important;
}

:deep(.floating-panels .start-btn) {
    border-radius: 4px !important;
}

:deep(.floating-panels .stop-btn) {
    border-radius: 4px !important;
}

:deep(.floating-panels .emergency-btn) {
    border-radius: 4px !important;
}

:deep(.floating-panels .btn-outline) {
    border-radius: 4px !important;
}

:deep(.floating-panels .btn-secondary) {
    border-radius: 4px !important;
}

:deep(.floating-panels .btn-primary) {
    border-radius: 4px !important;
}

/* 确保小按钮也有合适的高度 */
:deep(.floating-panels .btn-small) {
    min-height: 32px !important;
    padding: 6px 12px !important;
    font-size: 11px !important;
    border-radius: 4px !important;
}

:deep(.floating-panels .btn-secondary) {
    min-height: 36px !important;
}

:deep(.floating-panels .btn-danger) {
    min-height: 36px !important;
}

/* 确保左侧控制按钮也有合适的高度 */
:deep(.floating-element .control-btn) {
    min-height: 34px !important;
    padding: 8px 12px !important;
}

/* 调整其他可能较小的按钮 */
:deep(.floating-panels button) {
    min-height: 34px !important;
}

:deep(.floating-panels input[type="button"]) {
    min-height: 34px !important;
}

/* 输入框文字 */
:deep(.floating-panels .el-input__inner) {
    font-size: 12px !important;
}

:deep(.floating-panels .el-select .el-input__inner) {
    font-size: 12px !important;
}

/* 传感器和其他状态文字 */
:deep(.floating-panels .sensor-tit) {
    font-size: 11px !important;
}

:deep(.floating-panels .light-label) {
    font-size: 11px !important;
}

/* 地图点和数值 */
:deep(.floating-panels .map-point-label) {
    font-size: 11px !important;
}

:deep(.floating-panels .map-point-value) {
    font-size: 11px !important;
}

:deep(.floating-panels .panel-icon) {
    width: 32px !important;
    height: 32px !important;
    font-size: 16px !important;
}

:deep(.floating-panels .el-input__wrapper) {
    min-height: 30px !important;
}

:deep(.floating-panels .el-input__inner) {
    font-size: 11px !important;
    padding: 4px 8px !important;
}

:deep(.floating-panels .el-input-number) {
    font-size: 11px !important;
}

:deep(.floating-panels .el-input-number .el-input__inner) {
    font-size: 11px !important;
    padding: 4px 8px !important;
}

:deep(.floating-panels .el-select .el-input__inner) {
    font-size: 11px !important;
}

:deep(.floating-panels .btn) {
    padding: 8px 12px !important;
    font-size: 12px !important;
    min-height: 36px !important;
}

:deep(.floating-panels .camera-preview) {
    height: 160px !important;
    margin-top: 6px !important;
}

:deep(.floating-panels .light-item) {
    padding: 6px !important;
    font-size: 11px !important;
}

:deep(.floating-panels .light-icon) {
    font-size: 12px !important;
}

:deep(.floating-panels .indicator-pulse) {
    width: 8px !important;
    height: 8px !important;
}

/* 优化设备控制网格布局 */
:deep(.floating-panels .light-controls) {
    gap: 8px !important;
}

/* 速度仪表盘等图表组件优化 */
:deep(.floating-panels .echarts) {
    height: 80px !important;
}

:deep(.floating-panels .echrts-container) {
    height: 80px !important;
}

/* 特别优化车辆信息页面的仪表盘 */
:deep(.floating-panels .speed-gauge) {
    height: 70px !important;
    max-height: 70px !important;
}

:deep(.floating-panels .gauge-container) {
    height: 70px !important;
    max-height: 70px !important;
}

/* 车辆信息卡片优化 */
:deep(.floating-panels .vehicle-card) {
    padding: 8px !important;
}

/* 传感器数据优化 */
:deep(.floating-panels .sensor-item) {
    padding: 4px 6px !important;
    font-size: 10px !important;
}

/* 按钮组优化 */
:deep(.floating-panels .control-buttons) {
    gap: 4px !important;
}

/* 车辆选择下拉框样式 */
.car-list-floating :deep(.compact-select-dropdown) {
    z-index: 9999 !important;
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
