<template>
        <div class="form-group camera-container-group">
            <div class="flex">
            <label class="form-label"><fa icon="camera" /> 车载摄像头</label>
            <el-switch
                v-model="cameraOn"
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
            <button class="btn btn-primary" :disabled="parallelDrivingMode" @click="requestParallelDriving">
                <fa icon="gamepad" /> {{ parallelDrivingMode ? '当前平行驾驶模式' : '平行驾驶' }}
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ElMessage } from 'element-plus';
import { useCarStore } from '@/stores/car.js';

const carStore = useCarStore();

const cameraOn = ref(false);
const parallelDrivingMode = ref(false);
const lastNavConfirmedParallel = ref(false);
const videoSrc = ref('');
const lastFrameTime = ref(0);
const frameRate = ref(0);
const frameCount = ref(0);
const lastFrameCountTime = ref(Date.now());
const videoImg = ref(null);

// 当前选中的车辆ID
const currentVehicleId = computed(() => carStore.selectedCarId);

// Tauri事件监听器
let unlistenVideoFrame = null;
let frameRateTimer = null;
let videoTimeoutTimer = null;

// 视频流超时时间（毫秒）
const VIDEO_TIMEOUT = 3000; // 3秒无新帧则认为超时

const toggleCamera = () => {
    cameraOn.value = !cameraOn.value;
    if (cameraOn.value) {
        startVideoReceiver();
    } else {
        stopVideoReceiver();
    }
};

let revertTimer = null;

const clearRevertTimer = () => {
    if (revertTimer) {
        clearTimeout(revertTimer);
        revertTimer = null;
    }
};

// 切换平行驾驶模式的统一函数
const setParallelDrivingMode = (mode) => {
    parallelDrivingMode.value = mode;
    window.dispatchEvent(new CustomEvent('parallel-driving-mode-change', { detail: { mode } }));
    if (mode && !cameraOn.value) {
        cameraOn.value = true;
        startVideoReceiver();
    }
};

const requestParallelDriving = async () => {
    // 只能主动触发“平行驾驶”，不能主动切回“自动驾驶”
    if (parallelDrivingMode.value) return;
    try {
        const vehicleId = Number(currentVehicleId.value ?? 1);
        if (Number.isNaN(vehicleId)) return;
        // 1) 检查沙盘是否在线
        const sandboxOnline = await invoke('is_sandbox_connected');
        if (!sandboxOnline) {
            ElMessage.error('调度服务离线');
            return;
        }
        // 2) 检查车辆是否在线
        if (!window?.socketManager?.isVehicleConnected) {
            ElMessage.error('车辆管理器未初始化');
            return;
        }
        const carOnline = window.socketManager.isVehicleConnected(vehicleId);
        if (!carOnline) {
            ElMessage.error('车辆离线');
            return;
        }
        // 3) 发送到沙盘
        await invoke('send_sandbox_control', { vehicleId: vehicleId });
        // 本地先切入平行驾驶UI，等待车端3秒内回报导航=15确认，否则回退
        setParallelDrivingMode(true);
        ElMessage.success('已请求平行驾驶');
        clearRevertTimer();
        revertTimer = setTimeout(() => {
            // 3秒后若未确认(由socketManager根据车辆消息触发确认)，则回退
            if (!lastNavConfirmedParallel.value) {
                setParallelDrivingMode(false);
                ElMessage.warning('未收到车辆确认, 已恢复自动驾驶');
            }
            lastNavConfirmedParallel.value = false;
            clearRevertTimer();
        }, 3000);
    } catch (e) {
        console.error('发送平行驾驶指令失败:', e);
        ElMessage.error(`发送失败: ${e}`);
    }
};

// 启动视频接收器
const startVideoReceiver = async () => {
    try {
        // 启动UDP视频服务器（如果尚未启动）
        await invoke('start_udp_video_server', { port: 8080 });
        
        // 监听UDP视频帧事件
        if (!unlistenVideoFrame) {
            unlistenVideoFrame = await listen('udp-video-frame', (event) => {
                handleVideoFrame(event.payload);
            });
        }
        
        // 启动帧率计算器
        startFrameRateCalculator();
        
    } catch (error) {
        // 启动视频接收器失败
    }
};

// 停止视频接收器
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
    
    // 清理blob URL
    if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
        URL.revokeObjectURL(videoSrc.value);
    }
    
    videoSrc.value = '';
    lastFrameTime.value = 0;
    frameRate.value = 0;
    frameCount.value = 0;
    
};

// 检查视频流超时
const checkVideoTimeout = () => {
    if (videoTimeoutTimer) {
        clearTimeout(videoTimeoutTimer);
    }
    
    videoTimeoutTimer = setTimeout(() => {
        if (cameraOn.value && videoSrc.value) {
            videoSrc.value = '';
            lastFrameTime.value = 0;
            frameRate.value = 0;
        }
    }, VIDEO_TIMEOUT);
};

// 处理接收到的视频帧
const handleVideoFrame = (frame) => {
    // 检查是否是当前选中的车辆
    if (frame.vehicle_id !== currentVehicleId.value) {
        return; // 不是当前车辆的视频，忽略
    }
    
    // 检查摄像头是否开启
    if (!cameraOn.value) {
        return; // 摄像头关闭，忽略
    }
    
    // 验证数据有效性
    if (!frame.jpeg_data || frame.jpeg_data.length === 0) {
        return;
    }
    
    try {
        // 验证Base64数据格式
        if (!/^[A-Za-z0-9+/]+=*$/.test(frame.jpeg_data)) {
            return;
        }
        
        // 更高效的Base64解码
        const binaryString = atob(frame.jpeg_data);
        const uint8Array = Uint8Array.from(binaryString, char => char.charCodeAt(0));
        
        // 验证JPEG文件头
        if (uint8Array.length >= 2 && uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) {
            // 创建Blob URL
            const blob = new Blob([uint8Array], { type: 'image/jpeg' });
            const blobUrl = URL.createObjectURL(blob);
            
            // 预加载避免闪烁
            if (videoImg.value) {
                const newImg = new Image();
                newImg.onload = () => {
                    // 清理上一个blob URL
                    if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
                        URL.revokeObjectURL(videoSrc.value);
                    }
                    
                    // 更新显示
                    videoSrc.value = blobUrl;
                    videoImg.value.src = blobUrl;
                };
                newImg.onerror = () => {
                    URL.revokeObjectURL(blobUrl);
                };
                newImg.src = blobUrl;
            } else {
                if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
                    URL.revokeObjectURL(videoSrc.value);
                }
                videoSrc.value = blobUrl;
            }
        }
    } catch (error) {
        // 静默处理错误，避免控制台污染
    }
    
    lastFrameTime.value = Date.now();
    
    // 重置超时计时器
    checkVideoTimeout();
    frameCount.value++;
};

// 启动帧率计算
const startFrameRateCalculator = () => {
    if (frameRateTimer) {
        clearInterval(frameRateTimer);
    }
    
    frameRateTimer = setInterval(() => {
        const now = Date.now();
        const timeDiff = now - lastFrameCountTime.value;
        
        if (timeDiff >= 1000) { // 每秒计算一次
            frameRate.value = Math.round((frameCount.value * 1000) / timeDiff);
            frameCount.value = 0;
            lastFrameCountTime.value = now;
        }
    }, 1000);
};

// 监听摄像头开关状态变化
watch(cameraOn, (newVal) => {
    if (newVal) {
        startVideoReceiver();
    } else {
        stopVideoReceiver();
    }
});

// 监听车辆切换
watch(currentVehicleId, (newVehicleId, oldVehicleId) => {
    if (newVehicleId !== oldVehicleId) {
        // 清除当前视频
        if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
            URL.revokeObjectURL(videoSrc.value);
        }
        videoSrc.value = '';
        frameCount.value = 0;
        lastFrameTime.value = 0;
        frameRate.value = 0;
        
        // 清除超时计时器
        if (videoTimeoutTimer) {
            clearTimeout(videoTimeoutTimer);
            videoTimeoutTimer = null;
        }
    }
});

onMounted(() => {
    // 组件挂载时如果摄像头已开启，启动接收器
    if (cameraOn.value) {
        startVideoReceiver();
    }
    // 监听由车辆状态驱动的平行驾驶模式切换
    window.addEventListener('parallel-driving-mode-change', (event) => {
        const mode = !!event.detail?.mode;
        parallelDrivingMode.value = mode;
        if (mode && !cameraOn.value) {
            cameraOn.value = true;
            startVideoReceiver();
        }
    });

    // 监听车辆导航状态确认事件
    window.addEventListener('vehicle-info-update', (event) => {
        const info = event.detail;
        if (info?.navigation?.code != null) {
            if (info.navigation.code === 15) {
                lastNavConfirmedParallel.value = true;
                clearRevertTimer();
            } else if (parallelDrivingMode.value) {
                // 车端非15，自动恢复自动驾驶
                setParallelDrivingMode(false);
            }
        }
    });
});

onBeforeUnmount(() => {
    stopVideoReceiver();
    
    // 清理blob URL
    if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
        URL.revokeObjectURL(videoSrc.value);
        videoSrc.value = '';
    }
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