<template>
    <div class="fullscreen-map">
        <!-- 全屏3D场景 -->
        <div class="scene-container">
            <Scene3D />
        </div>

        <!-- 悬浮控制元素 -->
        <div class="floating-controls">
            <!-- 车辆列表 - 左上角 -->
            <div class="floating-element car-list-floating">
                <CarList />
            </div>

            <!-- 车辆控制按钮 - 左下角 -->
            <div class="floating-element car-button-floating">
                <CarButton />
            </div>
        </div>

        <!-- 小型图表仪表板 - 底部居中 -->
        <div class="mini-dashboard">
            <div class="dashboard-item">
                <div class="dashboard-icon">
                    <fa icon="chart-line" />
                </div>
                <div class="dashboard-info">
                    <span class="dashboard-label">网络延迟</span>
                    <span class="dashboard-value">{{ networkDelay }}ms</span>
                </div>
            </div>
            
            <div class="dashboard-item">
                <div class="dashboard-icon">
                    <fa :icon="serverStatus.icon" />
                </div>
                <div class="dashboard-info">
                    <span class="dashboard-label">服务状态</span>
                    <span class="dashboard-value">{{ serverStatus.text }}</span>
                </div>
            </div>
            
            <div class="dashboard-item">
                <div class="dashboard-icon">
                    <fa icon="car" />
                </div>
                <div class="dashboard-info">
                    <span class="dashboard-label">在线车辆</span>
                    <span class="dashboard-value">{{ onlineVehicles }}台</span>
                </div>
            </div>
            
            <div class="dashboard-item">
                <div class="dashboard-icon">
                    <fa icon="clock" />
                </div>
                <div class="dashboard-info">
                    <span class="dashboard-label">运行时间</span>
                    <span class="dashboard-value">{{ runningTime }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import CarList from '@/components/CarList.vue';
import CarButton from '@/components/CarButton.vue';
import Scene3D from '@/components/Scene3D/index.vue';

// 实时数据
const networkDelay = ref(12);
const onlineVehicles = ref(0);
const runningTime = ref('00:00:00');
const serverStatus = ref({
    text: '检测中...',
    icon: 'server',
    running: false,
    vehicleCount: 0
});

// 应用启动时间
const appStartTime = Date.now();

let dataUpdateInterval = null;

// 计算运行时间
const formatRunningTime = (startTime) => {
    const now = Date.now();
    const diff = Math.floor((now - startTime) / 1000); // 转换为秒
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    
    // 格式化为 HH:MM:SS
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// 数据更新
const updateData = () => {
    // 模拟网络延迟波动
    networkDelay.value = Math.floor(8 + Math.random() * 15);
    
    // 更新运行时间（从应用启动开始计算）
    runningTime.value = formatRunningTime(appStartTime);
};

// 获取服务状态
const updateServerStatus = async () => {
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('get_socket_server_status');
        
        serverStatus.value = {
            text: result.text,
            icon: result.icon,
            running: result.running,
            vehicleCount: result.vehicle_count
        };
        
        // 更新在线车辆数量
        onlineVehicles.value = result.vehicle_count || 0;
    } catch (error) {
        console.error('获取服务状态失败:', error);
        serverStatus.value = {
            text: '状态未知',
            icon: 'question-circle',
            running: false,
            vehicleCount: 0
        };
        onlineVehicles.value = 0;
    }
};

let serverStatusInterval = null;

onMounted(() => {
    updateData();
    dataUpdateInterval = setInterval(updateData, 2000);
    
    // 启动服务状态检测
    updateServerStatus();
    serverStatusInterval = setInterval(updateServerStatus, 5000); // 每5秒检测一次服务状态
});

onBeforeUnmount(() => {
    if (dataUpdateInterval) {
        clearInterval(dataUpdateInterval);
    }
    if (serverStatusInterval) {
        clearInterval(serverStatusInterval);
    }
});
</script>

<style lang="scss" scoped>
.fullscreen-map {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
}

.scene-container {
    width: 100%;
    height: 100%;
    position: relative;
    z-index: 1;
}

.floating-controls {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 50;
}

.floating-element {
    position: absolute;
    pointer-events: auto;
    background: rgba(0, 15, 30, 0.85);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(0, 240, 255, 0.3);
    border-radius: 12px;
    box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.4),
        0 0 20px rgba(0, 240, 255, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    
    &:hover {
        transform: translateY(-5px);
        box-shadow: 
            0 12px 40px rgba(0, 0, 0, 0.5),
            0 0 25px rgba(0, 240, 255, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }
}

.car-list-floating {
    top: 140px;
    left: 20px;
    width: 220px;
    max-height: 200px;
    overflow-y: auto;
    padding: 12px;
    z-index: 1000; /* 提高层级确保下拉列表显示在最上层 */
}

.car-button-floating {
    top: 300px; /* 移动到车辆列表下方，留出间距 */
    left: 20px;
    width: 220px;
    padding: 12px;
}

/* 悬浮元素内部样式重置 */
:deep(.floating-element .form-group) {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(0, 240, 255, 0.2);
    margin-bottom: 8px;
    padding: 10px;
}

:deep(.floating-element .panel-header) {
    border-bottom: 1px solid rgba(0, 240, 255, 0.3);
    margin-bottom: 10px;
    padding-bottom: 8px;
}

/* 紧凑化悬浮元素内的文字和控件 */
:deep(.floating-element .form-label) {
    font-size: 14px !important;
    margin-bottom: 6px;
    gap: 4px;
    font-weight: 500;
}

:deep(.floating-element .el-select) {
    font-size: 12px;
}

:deep(.car-list-floating .el-select .el-input__wrapper) {
    min-height: 26px !important;
    height: 26px !important;
}

:deep(.car-list-floating .el-select .el-input) {
    height: 26px !important;
}

:deep(.car-list-floating .el-select .el-input__inner) {
    font-size: 12px !important;
    padding: 2px 12px !important;
    line-height: 22px !important;
    height: 22px !important;
}

/* 更强制的高度控制 */
.car-list-floating :deep(.el-select .el-input__wrapper) {
    min-height: 26px !important;
    height: 26px !important;
    box-sizing: border-box !important;
}

.car-list-floating :deep(.el-input) {
    height: 26px !important;
}

.car-list-floating :deep(.el-input__inner) {
    height: 22px !important;
    line-height: 22px !important;
    padding: 2px 12px !important;
}

:deep(.floating-element .control-buttons) {
    gap: 6px !important;
    flex-direction: column !important;
}

:deep(.floating-element .control-btn) {
    padding: 6px 12px !important;
    font-size: 11px !important;
    border-radius: 6px !important;
    min-height: 28px !important;
    width: 100% !important;
}

:deep(.floating-element .control-btn .fa) {
    font-size: 10px !important;
    margin-right: 3px !important;
}

/* 下拉选择框选项 */
:deep(.el-select-dropdown .el-select-dropdown__item) {
    font-size: 12px !important;
    padding: 6px 12px !important;
    min-height: auto !important;
}

/* 确保车辆选择下拉列表宽度与下拉框一致 */
:deep(.car-list-floating .el-select) {
    width: 100% !important;
}

:deep(.car-list-floating .el-select .el-select__popper.el-popper) {
    width: 196px !important; /* 220px container - 24px padding */
    min-width: 196px !important;
}

:deep(.car-list-floating .el-select .el-select-dropdown) {
    width: 196px !important;
    min-width: 196px !important;
}

:deep(.car-list-floating .el-select .el-select-dropdown .el-select-dropdown__wrap) {
    max-height: 150px !important;
}

/* 小型仪表板 */
.mini-dashboard {
    position: absolute;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 20px;
    z-index: 50;
    pointer-events: auto;
}

.dashboard-item {
    background: rgba(0, 15, 30, 0.9);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(0, 240, 255, 0.4);
    border-radius: 12px;
    padding: 15px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 140px;
    box-shadow: 
        0 4px 16px rgba(0, 0, 0, 0.3),
        0 0 10px rgba(0, 240, 255, 0.2);
    transition: all 0.3s ease;
    
    &:hover {
        background: rgba(0, 20, 40, 0.95);
        border-color: rgba(0, 240, 255, 0.6);
        transform: translateY(-3px);
        box-shadow: 
            0 8px 25px rgba(0, 0, 0, 0.4),
            0 0 15px rgba(0, 240, 255, 0.3);
    }
}

.dashboard-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, 
        var(--primary) 0%, 
        var(--primary-dark) 100%
    );
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--dark-bg);
    font-size: 16px;
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
}

.dashboard-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.dashboard-label {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.dashboard-value {
    font-size: 16px;
    font-weight: 700;
    color: var(--primary);
    font-family: 'Orbitron', monospace;
    text-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
}

/* 响应式调整 */
@media (max-width: 1400px) {
    .car-list-floating,
    .car-button-floating {
        width: 200px;
    }
    
    .mini-dashboard {
        gap: 15px;
    }
    
    .dashboard-item {
        min-width: 120px;
        padding: 12px 16px;
    }
}

@media (max-width: 1200px) {
    .car-list-floating,
    .car-button-floating {
        width: 180px;
    }
    
    .mini-dashboard {
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
        max-width: 90vw;
    }
    
    .dashboard-item {
        min-width: 100px;
        padding: 10px 14px;
    }
}

/* 悬浮控制元素滚动条 */
.car-list-floating::-webkit-scrollbar {
    width: 4px;
}

.car-list-floating::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
}

.car-list-floating::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, 
        var(--primary), 
        var(--primary-dark)
    );
    border-radius: 2px;
    box-shadow: 0 0 3px rgba(0, 240, 255, 0.3);
}
</style>