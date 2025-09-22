<template>
    <div class="fullscreen-map">
        <!-- 全屏3D场景 -->
        <div class="scene-container">
            <Scene3D />
            <!-- 模型区域内的右下角按钮，避免跨出模型区域 -->
            <div class="scene-bottom-right-controls">
                <button class="scene-action-btn" @click="setDefaultView">俯视视角</button>
                <button class="scene-action-btn" @click="setTopDownView">鸟瞰视角</button>
                <button class="scene-action-btn" @click="startConstructionMark">施工标记</button>
            </div>
        </div>

        <!-- 悬浮控制元素 -->
        <div class="floating-controls">
            <!-- 车辆选择和控制 - 左上角 -->
            <div class="car-control-floating">
                <CarList />
                <CarButton />
            </div>

            <!-- 车辆运行时间统计图表 - 左中 -->
            <div class="floating-element vehicle-time-chart-floating">
                <VehicleTimeChart />
            </div>
            <!-- 自动驾驶行为统计图表 - 左中下 -->
            <div class="floating-element driving-behavior-chart-floating">
                <DrivingBehaviorChart />
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

        <!-- 施工标记确认弹窗 -->
        <el-dialog
            v-model="constructionDialogVisible"
            title=""
            width="500px"
            :close-on-click-modal="false"
            :close-on-press-escape="false"
            :show-close="false"
            center
            class="construction-confirmation-dialog"
        >
            <div class="construction-dialog-content">
                <!-- 图标和标题 -->
                <div class="dialog-header">
                    <div class="icon-container">
                        <fa icon="hard-hat" class="construction-icon" />
                    </div>
                    <h2 class="dialog-title">确定施工标记</h2>
                    <p class="dialog-subtitle">请确认施工标记的位置信息</p>
                </div>

                <!-- 位置信息卡片 -->
                <div class="position-card" v-if="constructionSelected">
                    <div class="card-header">
                        <fa icon="map-marker-alt" class="card-icon" />
                        <span class="card-title">选择的位置信息</span>
                    </div>
                    
                    <div class="position-details">
                        <div class="detail-row">
                            <span class="detail-label">标记ID</span>
                            <span class="detail-value">{{ constructionSelected.id ?? '-' }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">X 坐标</span>
                            <span class="detail-value">{{ constructionSelected.x?.toFixed(3) ?? '-' }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Y 坐标</span>
                            <span class="detail-value">{{ constructionSelected.z?.toFixed(3) ?? '-' }}</span>
                        </div>
                    </div>

                    <div class="construction-info">
                        <fa icon="hard-hat" class="construction-info-icon" />
                        <span>施工标记点 {{ constructionSelected.id }} 将被添加到该点</span>
                    </div>
                </div>

                <!-- 操作按钮 -->
                <div class="dialog-actions">
                    <el-button 
                        class="action-btn cancel-btn" 
                        @click="cancelConstructionPoint"
                    >
                        <fa icon="times" />
                        取消
                    </el-button>
                    <el-button 
                        class="action-btn reselect-btn" 
                        @click="reselectConstructionPoint"
                    >
                        <fa icon="redo" />
                        重新选择
                    </el-button>
                    <el-button 
                        class="action-btn confirm-btn" 
                        type="primary"
                        @click="confirmConstructionPoint"
                    >
                        <fa icon="check" />
                        确定添加
                    </el-button>
                </div>
            </div>
        </el-dialog>


    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import CarList from '@/components/CarList.vue';
import CarButton from '@/components/CarButton.vue';
import Scene3D from '@/components/Scene3D/index.vue';
import VehicleTimeChart from '@/components/VehicleTimeChart.vue';
import DrivingBehaviorChart from '@/components/DrivingBehaviorChart.vue';
import { socketManager } from '@/utils/socketManager.js';
import { startPoseSelectionMode, stopPoseSelectionMode, startPointSelectionMode, stopPointSelectionMode, createConstructionMarkerAt, removeConstructionMarker } from '@/components/Scene3D/index.js';

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
        
        // 不再从服务端获取车辆数量，改为使用SocketManager的实时数据
    } catch (error) {
        console.error('获取服务状态失败:', error);
        serverStatus.value = {
            text: '状态未知',
            icon: 'question-circle',
            running: false,
            vehicleCount: 0
        };
        // 不修改onlineVehicles，保持SocketManager的实时数据
    }
};

let serverStatusInterval = null;

// 处理在线车辆数量变化事件
const handleOnlineVehiclesCountChanged = (event) => {
    const { count, vehicleIds } = event.detail;
    onlineVehicles.value = count;
    console.debug(`📊 主界面在线车辆数量更新: ${count}台, 车辆ID: [${vehicleIds.join(', ')}]`);
};

onMounted(() => {
    updateData();
    dataUpdateInterval = setInterval(updateData, 2000);
    
    // 启动服务状态检测
    updateServerStatus();
    serverStatusInterval = setInterval(updateServerStatus, 5000); // 每5秒检测一次服务状态
    
    // 监听在线车辆数量变化事件
    window.addEventListener('online-vehicles-count-changed', handleOnlineVehiclesCountChanged);
    
    // 初始获取当前在线车辆数量
    onlineVehicles.value = socketManager.getOnlineVehicleCount();
    console.debug(`🚗 初始在线车辆数量: ${onlineVehicles.value}台`);
});

onBeforeUnmount(() => {
    if (dataUpdateInterval) {
        clearInterval(dataUpdateInterval);
    }
    if (serverStatusInterval) {
        clearInterval(serverStatusInterval);
    }
    
    // 移除事件监听器
    window.removeEventListener('online-vehicles-count-changed', handleOnlineVehiclesCountChanged);
});

// 交互：发送事件给3D场景
const setTopDownView = () => {
    window.dispatchEvent(new CustomEvent('scene3d-topdown'));
};

const setDefaultView = () => {
    window.dispatchEvent(new CustomEvent('scene3d-default'));
};

// ============ 施工标记交互 ============
const constructionDialogVisible = ref(false);
const constructionSelected = ref({ x: 0, z: 0, id: null });

const startConstructionMark = () => {
    // 启用简单的点选择模式（不需要朝向）
    startPointSelectionMode(({ x, z }) => {
        // 结束选择模式
        stopPointSelectionMode();
        // 先创建临时施工标记（底部中点对齐）
        const res = createConstructionMarkerAt(x, z);
        if (res) {
            constructionSelected.value = { id: res.id, x, z };
        } else {
            constructionSelected.value = { id: null, x, z };
        }
        constructionDialogVisible.value = true;
    });
};

const confirmConstructionPoint = () => {
    constructionDialogVisible.value = false;
    // 已经创建了标记，直接退出
};

const reselectConstructionPoint = () => {
    // 移除临时标记后重新选择
    if (constructionSelected.value.id != null) {
        removeConstructionMarker(constructionSelected.value.id);
    }
    constructionDialogVisible.value = false;
    startConstructionMark();
};

const cancelConstructionPoint = () => {
    // 取消则移除临时标记并关闭
    if (constructionSelected.value.id != null) {
        removeConstructionMarker(constructionSelected.value.id);
    }
    constructionDialogVisible.value = false;
};
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
.scene-container::after {
    content: '';
    position: absolute;
    top: 0;
    right: 300px; /* 预留右侧菜单宽度，确保按钮在菜单左侧 */
    width: 0;
    height: 100%;
}


.floating-controls {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none; /* 子元素需要交互的要自己开启 */
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

.car-control-floating {
    position: absolute;
    pointer-events: auto;
    top: 140px;
    left: 20px;
    width: 220px;
    z-index: 1000; /* 提高层级确保下拉列表显示在最上层 */
    
    /* 移除外框，让子组件自己处理样式 */
    background: transparent;
    border: none;
    padding: 0;
}

/* 车辆选择和控制区域的表单组样式 */
.car-control-floating .form-group {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(0, 240, 255, 0.2);
    margin-bottom: 16px; /* 增加间距 */
    padding: 10px;
    border-radius: 8px;
}

/* 车辆控制区域标题字号调整 */
.car-control-floating .form-group .form-label {
    font-size: 11px !important;
    margin-bottom: 4px;
    gap: 4px;
}

/* 使用更高优先级确保生效 */
.floating-controls .car-control-floating .form-label {
    font-size: 11px !important;
}

/* 额外的强制样式覆盖 */
div.car-control-floating .form-group .form-label,
div.car-control-floating .form-label {
    font-size: 11px !important;
}

.vehicle-time-chart-floating {
    top: 525px; /* 大幅向下移动避免重叠 */
    left: 20px;
    width: 220px; /* 与上面元素宽度一致 */
    padding: 0; /* 图表组件自己有padding */
}

.driving-behavior-chart-floating {
    top: 700px; /* 大幅向下移动避免重叠 */
    left: 20px;
    width: 220px; /* 与上面元素宽度一致 */
    padding: 0; /* 图表组件自己有padding */
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

:deep(.car-control-floating .el-select .el-input__wrapper) {
    min-height: 26px !important;
    height: 26px !important;
}

:deep(.car-control-floating .el-select .el-input) {
    height: 26px !important;
}

:deep(.car-control-floating .el-select .el-input__inner) {
    font-size: 12px !important;
    padding: 2px 12px !important;
    line-height: 22px !important;
    height: 22px !important;
}

/* 更强制的高度控制 */
.car-control-floating :deep(.el-select .el-input__wrapper) {
    min-height: 26px !important;
    height: 26px !important;
    box-sizing: border-box !important;
}

.car-control-floating :deep(.el-input) {
    height: 26px !important;
}

.car-control-floating :deep(.el-input__inner) {
    height: 22px !important;
    line-height: 22px !important;
    padding: 2px 12px !important;
}

:deep(.floating-element .control-buttons),
.car-control-floating .control-buttons {
    gap: 6px !important;
    flex-direction: column !important;
}

:deep(.floating-element .control-btn),
.car-control-floating .control-btn {
    padding: 6px 12px !important;
    font-size: 11px !important;
    border-radius: 6px !important;
    min-height: 28px !important;
    width: 100% !important;
}

:deep(.floating-element .control-btn .fa),
.car-control-floating .control-btn .fa {
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
:deep(.car-control-floating .el-select) {
    width: 100% !important;
}

:deep(.car-control-floating .el-select .el-select__popper.el-popper) {
    width: 196px !important; /* 220px container - 24px padding */
    min-width: 196px !important;
}

:deep(.car-control-floating .el-select .el-select-dropdown) {
    width: 196px !important;
    min-width: 196px !important;
}

:deep(.car-control-floating .el-select .el-select-dropdown .el-select-dropdown__wrap) {
    max-height: 150px !important;
}

/* 小型仪表板 */
.mini-dashboard {
    position: absolute;
    bottom: 30px;
    left: calc(50% - 260px); /* 向左移动更多距离，给右下按钮留空间 */
    transform: translateX(-50%);
    display: flex;
    gap: 20px;
    z-index: 50;
    pointer-events: auto;
}

/* 右下角按钮组（与右上角系统时间右侧对齐同一右边距） */
.scene-container .scene-bottom-right-controls {
    position: absolute;
    right: 480px; /* 右侧内容区域预估宽度，确保按钮完全在其左侧，不被覆盖 */
    bottom: 30px;
    display: flex;
    gap: 10px;
    z-index: 1001; /* 高于其他浮层 */
    pointer-events: auto;
}

@media (max-width: 1600px) {
  .scene-container .scene-bottom-right-controls {
    right: 360px; /* 中屏时收窄右侧内容区域预估 */
  }
}

@media (max-width: 1366px) {
  .scene-container .scene-bottom-right-controls {
    right: 300px; /* 小屏进一步收窄，避免过度左移 */
  }
}

.scene-action-btn {
    background: linear-gradient(135deg, rgba(0, 240, 255, 0.15), rgba(0, 160, 220, 0.15));
    border: 1px solid rgba(0, 240, 255, 0.45);
    color: var(--text-primary);
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 6px 18px rgba(0, 240, 255, 0.15), inset 0 1px 0 rgba(255,255,255,0.08);
}

.scene-action-btn:hover {
    border-color: var(--primary);
    color: var(--primary);
    transform: translateY(-2px);
    box-shadow: 0 10px 24px rgba(0, 240, 255, 0.25), inset 0 1px 0 rgba(255,255,255,0.12);
}

/* 去掉主按钮选中态，统一样式 */

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

/* 施工标记确认弹窗样式 */
:deep(.construction-confirmation-dialog) {
    .el-dialog {
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        border: 1px solid #ffa500;
        border-radius: 16px;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 165, 0, 0.2);
        overflow: hidden;
    }
    
    .el-dialog__header {
        display: none;
    }
    
    .el-dialog__body {
        padding: 0;
        background: transparent;
    }
}

.construction-dialog-content {
    padding: 30px;
    color: #ffffff;
    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.dialog-header {
    text-align: center;
    margin-bottom: 25px;
}

.icon-container {
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #ffa500, #ff8c00);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 15px;
    box-shadow: 0 8px 25px rgba(255, 165, 0, 0.3);
}

.construction-icon {
    font-size: 24px;
    color: #1a1a1a;
}

.dialog-title {
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 8px 0;
    color: #ffffff;
    letter-spacing: 0.5px;
}

.dialog-subtitle {
    font-size: 14px;
    color: #b0b0b0;
    margin: 0;
    font-weight: 400;
}

.position-card {
    background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
    border: 1px solid rgba(255, 165, 0, 0.3);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 25px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.card-header {
    display: flex;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255, 165, 0, 0.2);
}

.card-icon {
    font-size: 16px;
    color: #ffa500;
    margin-right: 8px;
}

.card-title {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
}

.position-details {
    margin-bottom: 15px;
}

.detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.detail-row:last-child {
    border-bottom: none;
}

.detail-label {
    font-size: 14px;
    color: #b0b0b0;
    font-weight: 500;
}

.detail-value {
    font-size: 16px;
    color: #ffa500;
    font-weight: 700;
    font-family: 'Courier New', monospace;
}

.construction-info {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    background: rgba(255, 165, 0, 0.1);
    border-radius: 8px;
    font-size: 14px;
    color: #ffffff;
}

.construction-info-icon {
    font-size: 16px;
    color: #ffa500;
    margin-right: 8px;
}

.dialog-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
}

.action-btn {
    padding: 12px 20px !important;
    border-radius: 8px !important;
    font-weight: 600 !important;
    font-size: 14px !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    transition: all 0.3s ease !important;
    border: none !important;
    min-width: 110px !important;
    justify-content: center !important;
}

.cancel-btn {
    background: linear-gradient(135deg, #666666 0%, #555555 100%) !important;
    color: #ffffff !important;
    box-shadow: 0 4px 15px rgba(102, 102, 102, 0.3) !important;
}

.cancel-btn:hover {
    background: linear-gradient(135deg, #777777 0%, #666666 100%) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(102, 102, 102, 0.4) !important;
}

.reselect-btn {
    background: linear-gradient(135deg, #17a2b8 0%, #138496 100%) !important;
    color: #ffffff !important;
    box-shadow: 0 4px 15px rgba(23, 162, 184, 0.3) !important;
}

.reselect-btn:hover {
    background: linear-gradient(135deg, #20c0d7 0%, #17a2b8 100%) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(23, 162, 184, 0.4) !important;
}

.confirm-btn {
    background: linear-gradient(135deg, #ffa500 0%, #ff8c00 100%) !important;
    color: #1a1a1a !important;
    box-shadow: 0 4px 15px rgba(255, 165, 0, 0.3) !important;
}

.confirm-btn:hover {
    background: linear-gradient(135deg, #ffb84d 0%, #ffa500 100%) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(255, 165, 0, 0.4) !important;
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
    .car-control-floating {
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
    .car-control-floating {
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
.car-control-floating::-webkit-scrollbar {
    width: 4px;
}

.car-control-floating::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
}

.car-control-floating::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, 
        var(--primary), 
        var(--primary-dark)
    );
    border-radius: 2px;
    box-shadow: 0 0 3px rgba(0, 240, 255, 0.3);
}
</style>