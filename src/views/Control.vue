<template>
    <!-- 沙盘控制面板 -->
    <div class="panel-card" id="sandbox-control-panel">
        <div class="panel-header">
            <div class="panel-icon">
                <fa icon="sliders-h"></fa>
            </div>
            <h2 class="panel-title">沙盘控制</h2>
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
/* 表单项样式 */
.form-item {
    margin-bottom: 15px;
}

.item-label {
    display: block;
    margin-bottom: 8px;
    color: #a0b3d0;
    font-size: 14px;
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

/* 确保Element Plus输入框组件占满宽度 */
:deep(.el-input-number) {
    width: 100%;
}

:deep(.el-input-number .el-input__wrapper) {
    width: 100%;
}

/* 灯光控制 */
.light-controls {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;

    .light-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        background: rgba(30, 58, 95, 0.3);
        border-radius: 8px;

        .light-label {
            display: flex;
            align-items: center;
        }
        .light-icon {
            font-size: 22px;
            margin-right: 6px;
        }
    }
}
</style>