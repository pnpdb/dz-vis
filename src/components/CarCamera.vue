<template>
        <div class="form-group camera-container-group">
            <div class="flex">
            <label class="form-label"><fa icon="camera" /> 车载摄像头</label>
            <el-switch
                :model-value="cameraOn"
                @change="handleCameraToggle"
                active-color="#13ce66"
                inactive-color="#ff4949"
            ></el-switch>
        </div>

        <div class="camera-preview" :class="{ 'has-video': cameraOn && videoSrc }">
            <!-- 双缓冲图片，避免闪烁 -->
            <img v-show="cameraOn && videoSrc" ref="videoImg" class="video-stream" alt="车载摄像头画面" />
            <div v-show="!cameraOn || !videoSrc">
            <fa icon="camera" class="camera-icon" />
                <div class="camera-desc">{{ cameraOn ? '等待视频信号...' : '摄像头已关闭' }}</div>
            </div>
            <div v-if="cameraOn && lastFrameTime" class="camera-overlay">
                车辆{{ currentVehicleId }} | {{ frameRate }} FPS
            </div>
        </div>
        <div class="camera-controls">
            <!-- 注释掉连接/断开摄像头按钮，因为右上角已有滑块按钮可以使用 -->
            <!-- <button class="btn btn-secondary">
                <fa icon="camera" /> 连接/断开摄像头
            </button> -->
            <button class="btn btn-primary" @click="requestParallelDriving">
                <fa icon="gamepad" /> 平行驾驶
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { useCarStore } from '@/stores/car.js';
import { warn as plWarn, error as plError } from '@tauri-apps/plugin-log';
import { debounce } from '@/utils/performance.js';
import { videoProcessor } from '@/utils/videoProcessor.js';

const carStore = useCarStore();
const router = useRouter();

const videoSrc = ref('');
const lastFrameTime = ref(0);
const frameRate = ref(0);
const frameCount = ref(0);
const lastFrameCountTime = ref(Date.now());
const videoImg = ref(null);

const cameraOn = ref(false);
const isRouteVisible = ref(true);
const currentRouteName = computed(() => router.currentRoute.value?.name);
const currentVehicleId = computed(() => carStore.selectedCarId);

let unlistenVideoFrame = null;
let frameRateTimer = null;
let videoTimeoutTimer = null;
let udpServerPromise = null;

const VIDEO_TIMEOUT = 3000;

const requestParallelDriving = async () => {
    try {
        const vehicleId = Number(currentVehicleId.value ?? 1);
        if (Number.isNaN(vehicleId)) {
            ElMessage.error('无效的车辆ID');
            return;
        }

        const sandboxOnline = await invoke('is_sandbox_connected');
        if (!sandboxOnline) {
            ElMessage.error('调度服务离线');
            return;
        }

        if (!window?.socketManager?.isVehicleConnected) {
            ElMessage.error('车辆管理器未初始化');
            return;
        }
        const carOnline = window.socketManager.isVehicleConnected(vehicleId);
        if (!carOnline) {
            ElMessage.error('车辆离线');
            return;
        }

        await invoke('send_sandbox_control', { vehicleId });
        ElMessage.success('已发送平行驾驶指令');

        router.push({
            name: 'ParallelDriving',
            query: { vehicleId: currentVehicleId.value },
        });
    } catch (e) {
        console.error('发送平行驾驶指令失败:', e);
        ElMessage.error(`发送失败: ${e}`);
    }
};

const startFrameRateCalculator = () => {
    if (frameRateTimer) {
        clearInterval(frameRateTimer);
        frameRateTimer = null;
    }

    if (!cameraOn.value || !isRouteVisible.value) {
        return;
    }

    frameRateTimer = setInterval(() => {
        const now = Date.now();
        const timeDiff = now - lastFrameCountTime.value;

        if (timeDiff >= 1000) {
            frameRate.value = Math.round((frameCount.value * 1000) / timeDiff);
            frameCount.value = 0;
            lastFrameCountTime.value = now;
        }
    }, 1000);
};

const checkVideoTimeout = () => {
    if (videoTimeoutTimer) {
        clearTimeout(videoTimeoutTimer);
    }

    if (!cameraOn.value || !isRouteVisible.value) {
        return;
    }

    videoTimeoutTimer = setTimeout(() => {
        if (cameraOn.value && isRouteVisible.value && videoSrc.value) {
            videoSrc.value = '';
            lastFrameTime.value = 0;
            frameRate.value = 0;
        }
    }, VIDEO_TIMEOUT);
};

const startVideoReceiver = async () => {
    if (!cameraOn.value || !isRouteVisible.value || unlistenVideoFrame) {
        return;
    }

    try {
        if (!udpServerPromise) {
            udpServerPromise = invoke('start_udp_video_server', { port: 8080 }).catch((error) => {
                udpServerPromise = null;
                throw error;
            });
        }
        await udpServerPromise;

        unlistenVideoFrame = await listen('udp-video-frame', (event) => {
            handleVideoFrame(event.payload);
        });

        startFrameRateCalculator();
    } catch (error) {
        try {
            await plError(`启动UDP视频接收器失败: ${error}`);
        } catch (_) {}
    }
};

const stopVideoReceiver = () => {
    if (unlistenVideoFrame) {
        unlistenVideoFrame();
        unlistenVideoFrame = null;
    }

    if (frameRateTimer) {
        clearInterval(frameRateTimer);
        frameRateTimer = null;
    }

    if (videoTimeoutTimer) {
        clearTimeout(videoTimeoutTimer);
        videoTimeoutTimer = null;
    }

    if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
        URL.revokeObjectURL(videoSrc.value);
    }

    videoSrc.value = '';
    lastFrameTime.value = 0;
    frameRate.value = 0;
    frameCount.value = 0;
};

const updateReceiverState = () => {
    if (cameraOn.value && isRouteVisible.value) {
        startVideoReceiver();
    } else {
        stopVideoReceiver();
    }
};

const handleVideoFrame = async (frame) => {
    if (frame.vehicle_id !== currentVehicleId.value || !cameraOn.value || !isRouteVisible.value || !videoImg.value) {
        return;
    }

    if (!frame.jpeg_data || frame.jpeg_data.length === 0) {
        return;
    }

    try {
        if (!/^[A-Za-z0-9+/]+=*$/.test(frame.jpeg_data)) {
            try {
                plWarn('UDP视频帧Base64校验失败').catch(() => {});
            } catch (_) {}
            return;
        }

        const processingResult = await videoProcessor.processVideoFrame(
            frame.vehicle_id,
            frame.jpeg_data,
            frame.frame_id,
        );

        if (!processingResult.success || !processingResult.frame?.jpeg_base64) {
            try {
                plWarn(`Rust视频帧处理失败: ${processingResult.error || '未知错误'}`).catch(() => {});
            } catch (_) {}
            return;
        }

        const processedBinary = atob(processingResult.frame.jpeg_base64);
        const processedArray = Uint8Array.from(processedBinary, (char) => char.charCodeAt(0));
        const blob = new Blob([processedArray], { type: 'image/jpeg' });
        const blobUrl = URL.createObjectURL(blob);

        const targetImg = videoImg.value;
        if (!cameraOn.value || !isRouteVisible.value || !targetImg) {
            URL.revokeObjectURL(blobUrl);
            return;
        }

        const newImg = new Image();
        newImg.onload = () => {
            const img = videoImg.value;
            if (!cameraOn.value || !isRouteVisible.value || !img) {
                URL.revokeObjectURL(blobUrl);
                return;
            }

            if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
                URL.revokeObjectURL(videoSrc.value);
            }

            videoSrc.value = blobUrl;
            img.src = blobUrl;
        };
        newImg.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            try {
                plWarn('UDP视频帧Blob预加载失败').catch(() => {});
            } catch (_) {}
        };
        newImg.src = blobUrl;
    } catch (error) {
        try {
            plError(`视频帧处理异常: ${error.message}`).catch(() => {});
        } catch (_) {}
        return;
    }

    lastFrameTime.value = Date.now();
    checkVideoTimeout();
    frameCount.value++;
};

const handleCameraToggle = (value) => {
    carStore.setCameraEnabled(Boolean(value));
};

const debouncedVehicleSwitch = debounce((newVehicleId, oldVehicleId) => {
    if (newVehicleId !== oldVehicleId) {
        if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
            URL.revokeObjectURL(videoSrc.value);
        }
        videoSrc.value = '';
        frameCount.value = 0;
        lastFrameTime.value = 0;
        frameRate.value = 0;

        if (videoTimeoutTimer) {
            clearTimeout(videoTimeoutTimer);
            videoTimeoutTimer = null;
        }
    }
}, 200);

watch(currentVehicleId, debouncedVehicleSwitch);

watch(
    () => carStore.cameraEnabled,
    (enabled) => {
        cameraOn.value = Boolean(enabled);
        updateReceiverState();
    },
    { immediate: true },
);

watch(
    currentRouteName,
    (name) => {
        isRouteVisible.value = name === 'Cars';
        updateReceiverState();
    },
    { immediate: true },
);

onMounted(() => {
    updateReceiverState();
});

onBeforeUnmount(() => {
    stopVideoReceiver();
});
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
    margin-bottom: 5px;
}

.video-stream {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
    background-color: #2c3e50; /* 防止加载时闪白 */
    transition: none; /* 移除可能的过渡效果 */
    position: relative;
    z-index: 2; /* 确保视频在扫描线之上 */
}

.camera-icon {
    font-size: 3rem;
    color: rgba(255, 255, 255, 0.2);
    margin-bottom: 5px;
}

.camera-desc {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    margin: 5px 0;
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

/* 只在没有视频时显示扫描线效果 */
.camera-preview:not(.has-video)::before {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.15),
        rgba(0, 0, 0, 0.15) 1px,
        transparent 4px
    );
    z-index: 1;
}

/* 确保有视频时不显示扫描线 */
.camera-preview.has-video::before {
    display: none !important;
    content: none !important;
    background: none !important;
}

.camera-controls {
    display: flex;
    gap: 10px;
    flex-direction: column;
}

.flex {
    margin-bottom: 8px;
}

/* 调整车载摄像头区域的间距 */
.camera-container-group {
    gap: 5px !important;
}

.camera-container-group > .flex {
    margin-bottom: 5px !important;
}

.camera-container-group > .camera-preview {
    margin-top: 0px !important;
    margin-bottom: 5px !important;
}
</style>