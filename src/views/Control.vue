<template>
    <!-- 沙盘控制面板 - 悬浮样式 -->
    <div class="floating-control-panel" id="sandbox-control-panel">
        <div class="panel-header">
            <div class="panel-icon">
                <fa icon="sliders-h"></fa>
            </div>
            <h2 class="panel-title">沙盘控制</h2>
            <div class="panel-indicator">
                <div class="indicator-pulse"></div>
            </div>
        </div>

        <div class="form-group">
            <label class="form-label"><fa icon="video"></fa> 沙盘摄像头</label>
            <div class="flex">
                <el-select v-model="cameraId" placeholder="请选择沙盘监控相机">
                    <el-option
                        v-for="camera in cameras"
                        :key="camera.id"
                        :label="camera.name"
                        :value="camera.id"
                    ></el-option>
                </el-select>
            </div>
            <div class="camera-preview">
                <i
                    class="fas fa-video fa-3x"
                    style="color: rgba(255, 255, 255, 0.2)"
                ></i>
                <div class="camera-desc">暂无视频</div>
                <div class="camera-overlay">监控相机 • 720P • 30FPS</div>
            </div>
        </div>

        <div class="form-group">
            <label class="form-label"
                ><fa icon="traffic-light"></fa> 交通信号控制</label
            >
            <div class="form-item">
                <label class="item-label color-red">红灯默认时长 (秒)</label>

                <el-input-number
                    class="input-number"
                    v-model="trafficSettings.redLight"
                    :min="0"
                    controls-position="right"
                    :step="1"
                />
            </div>
            <div class="form-item">
                <label class="item-label color-green">绿灯默认时长 (秒)</label>
                <el-input-number
                    class="input-number"
                    v-model="trafficSettings.greenLight"
                    controls-position="right"
                    :min="0"
                    :step="1"
                />
            </div>
            <button class="btn btn-primary">
                <fa icon="refresh"></fa> 更新时长
            </button>
        </div>
        <div class="form-group">
            <label class="form-label"
                ><fa icon="lightbulb"></fa> 设备控制</label
            >
            <div class="light-controls">
                <div class="light-item">
                    <span
                        ><fa icon="parking" class="light-icon"></fa>
                        停车抬杠</span
                    >
                    <el-switch
                        v-model="lightSettings.barrier"
                        active-color="#13ce66"
                    />
                </div>
                <div class="light-item">
                    <span><fa icon="sun" class="light-icon"></fa> 环境灯</span>
                    <el-switch
                        v-model="lightSettings.ambient"
                        active-color="#13ce66"
                    />
                </div>
                <div class="light-item">
                    <span
                        ><fa icon="building" class="light-icon"></fa>
                        建筑灯</span
                    >
                    <el-switch
                        v-model="lightSettings.building"
                        active-color="#13ce66"
                    />
                </div>
                <div class="light-item">
                    <span
                        ><fa icon="street-view" class="light-icon"></fa>
                        路灯</span
                    >
                    <el-switch
                        v-model="lightSettings.street"
                        active-color="#13ce66"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';

const cameras = ref([
    { id: '1', name: '沙盘监控相机1' },
    { id: '2', name: '沙盘监控相机2' },
    { id: '3', name: '沙盘监控相机3' },
    { id: '4', name: '沙盘监控相机4' },
    { id: '5', name: '沙盘监控相机5' },
    { id: '6', name: '沙盘监控相机6' },
]);

const cameraId = ref('');

const trafficSettings = ref({
    redLight: 45,
    greenLight: 60,
});

const lightSettings = ref({
    barrier: true, // 停车抬杠
    ambient: true, // 环境灯
    building: false, // 建筑灯
    street: true, // 路灯
});

const updateLightDuration = () => {
    console.log('更新信号灯时长:', trafficSettings.value);
    // TODO: 实现信号灯控制逻辑
};
</script>

<style lang="scss" scoped>
.floating-control-panel {
    padding: 25px;
    height: 100%;
    overflow-y: auto;
    position: relative;
}

.panel-header {
    margin-bottom: 20px;
    padding-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 2px solid rgba(0, 240, 255, 0.3);
    position: relative;
}

.panel-icon {
    width: 36px;
    height: 36px;
    font-size: 20px;
    color: var(--dark-bg);
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
}

.panel-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    background: linear-gradient(90deg, var(--primary), var(--primary-light));
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    flex: 1;
}

.panel-indicator {
    margin-left: auto;
}

.indicator-pulse {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--primary);
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.6);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% {
        transform: scale(1);
        opacity: 1;
    }
    50% {
        transform: scale(1.2);
        opacity: 0.7;
    }
}

/* 表单项样式 */
.form-item {
    margin-bottom: 15px;
}

.item-label {
    display: block;
    margin-bottom: 8px;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
}

.color-red {
    color: #ff6b6b;
}

.color-green {
    color: #51cf66;
}

.input-number {
    width: 100%;
}

/* 相机预览增强 */
.camera-preview {
    background: linear-gradient(145deg, 
        rgba(0, 15, 30, 0.8) 0%, 
        rgba(0, 25, 50, 0.9) 50%, 
        rgba(0, 15, 30, 0.8) 100%
    );
    border: 1px solid rgba(0, 240, 255, 0.3);
    position: relative;
    overflow: hidden;
}

.camera-preview::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
        repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 240, 255, 0.05) 2px,
            rgba(0, 240, 255, 0.05) 4px
        );
    animation: scanLine 3s linear infinite;
}

@keyframes scanLine {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
}

.camera-overlay {
    background: rgba(0, 240, 255, 0.1);
    border: 1px solid rgba(0, 240, 255, 0.3);
    color: var(--primary);
    font-family: 'Orbitron', monospace;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
}

/* 确保Element Plus输入框组件占满宽度 */
:deep(.el-input-number) {
    width: 100%;
}

:deep(.el-input-number .el-input__wrapper) {
    width: 100%;
    background: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid rgba(0, 240, 255, 0.3) !important;
    border-radius: 8px;
}

:deep(.el-input-number .el-input__wrapper:hover) {
    border-color: rgba(0, 240, 255, 0.5) !important;
}

:deep(.el-input-number .el-input__wrapper.is-focus) {
    border-color: var(--primary) !important;
    box-shadow: 0 0 0 2px rgba(0, 240, 255, 0.2) !important;
}

:deep(.el-select .el-input__wrapper) {
    background: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid rgba(0, 240, 255, 0.3) !important;
    border-radius: 8px;
}

:deep(.el-select .el-input__wrapper:hover) {
    border-color: rgba(0, 240, 255, 0.5) !important;
}

/* 灯光控制增强 */
.light-controls {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;

    .light-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(0, 240, 255, 0.2);
        border-radius: 10px;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;

        &:hover {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(0, 240, 255, 0.4);
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 240, 255, 0.1);
        }

        &::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
                90deg,
                transparent,
                rgba(0, 240, 255, 0.1),
                transparent
            );
            transition: left 0.5s ease;
        }

        &:hover::before {
            left: 100%;
        }

        .light-label {
            display: flex;
            align-items: center;
            color: var(--text-primary);
            font-weight: 500;
        }
        
        .light-icon {
            font-size: 18px;
            margin-right: 8px;
            color: var(--primary);
        }
    }
}

/* 按钮增强 */
.btn {
    background: linear-gradient(135deg, 
        rgba(0, 240, 255, 0.1) 0%, 
        rgba(0, 180, 255, 0.2) 100%
    );
    border: 1px solid rgba(0, 240, 255, 0.4);
    color: var(--primary);
    font-weight: 600;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;

    &:hover {
        background: linear-gradient(135deg, 
            rgba(0, 240, 255, 0.2) 0%, 
            rgba(0, 180, 255, 0.3) 100%
        );
        border-color: var(--primary);
        transform: translateY(-2px);
        box-shadow: 0 5px 20px rgba(0, 240, 255, 0.3);
    }

    &::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        transition: width 0.3s ease, height 0.3s ease;
    }

    &:active::before {
        width: 200px;
        height: 200px;
    }
}

/* 开关样式增强 */
:deep(.el-switch.is-checked .el-switch__core) {
    background-color: var(--primary) !important;
    border-color: var(--primary) !important;
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
}

:deep(.el-switch .el-switch__core) {
    background-color: rgba(255, 255, 255, 0.1) !important;
    border-color: rgba(0, 240, 255, 0.3) !important;
}

/* 滚动条样式 */
.floating-control-panel::-webkit-scrollbar {
    width: 6px;
}

.floating-control-panel::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
}

.floating-control-panel::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, 
        var(--primary), 
        var(--primary-dark)
    );
    border-radius: 3px;
    box-shadow: 0 0 5px rgba(0, 240, 255, 0.3);
}

.floating-control-panel::-webkit-scrollbar-thumb:hover {
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
}
</style>