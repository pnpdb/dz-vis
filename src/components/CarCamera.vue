<template>
    <div class="form-group">
        <div class="flex">
            <label class="form-label"><fa icon="camera" /> 车载摄像头</label>
            <el-switch
                v-model="cameraOn"
                active-color="#13ce66"
                inactive-color="#ff4949"
            ></el-switch>
        </div>

        <div class="camera-preview">
            <fa icon="camera" class="camera-icon" />
            <div class="camera-desc">暂无视频</div>
            <div class="camera-overlay">监控相机 • 720P • 30FPS</div>
        </div>
        <div class="camera-controls">
            <button class="btn btn-secondary">
                <fa icon="camera" /> 连接/断开摄像头
            </button>
            <button class="btn btn-primary">
                <fa icon="gamepad" /> 平行驾驶
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';

const cameraOn = ref(false);

const toggleCamera = () => {
    cameraOn.value = !cameraOn.value;
    // TODO: 实现摄像头切换逻辑
};

const startParallelDriving = () => {
    // TODO: 实现平行驾驶功能
    console.log('启动平行驾驶模式');
};
</script>

<style lang="scss" scoped>
.camera-preview {
    width: 100%;
    height: 140px;
    background: linear-gradient(45deg, #1a1f25, #2c3e50);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    margin-bottom: 10px;
}

.camera-icon {
    font-size: 3rem;
    color: rgba(255, 255, 255, 0.2);
    margin-bottom: 10px;
}

.camera-desc {
    color: rgba(255, 255, 255, 0.6);
    font-size: 16px;
    margin-bottom: 10px;
}

.camera-overlay {
    position: absolute;
    bottom: 10px;
    left: 10px;
    color: white;
    font-size: 12px;
    background: rgba(0, 0, 0, 0.5);
    padding: 4px 8px;
    border-radius: 4px;
}

.camera-preview::before {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.15),
        rgba(0, 0, 0, 0.15) 1px,
        transparent 1px,
        transparent 4px
    );
}

.camera-controls {
    display: flex;
    gap: 10px;
    flex-direction: column;
}

.flex {
    margin-bottom: 8px;
}
</style>