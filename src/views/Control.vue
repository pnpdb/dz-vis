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

        <div class="form-group camera-container-group">
            <label class="form-label"><fa icon="video"></fa> 沙盘摄像头</label>
            <div class="flex">
                <el-select 
                    v-model="cameraId" 
                    placeholder="请选择相机" 
                    clearable
                    class="custom-camera-select"
                >
                    <el-option
                        v-for="camera in cameras"
                        :key="camera.id"
                        :label="camera.name"
                        :value="camera.id"
                    ></el-option>
                </el-select>
            </div>
            <div class="camera-preview" ref="cameraPreviewRef">
                <!-- 视频播放 -->
                <video 
                    v-if="selectedCamera && isStreaming"
                    ref="videoRef"
                    class="camera-video"
                    autoplay
                    muted
                    @loadstart="onVideoLoadStart"
                    @loadeddata="onVideoLoaded"
                    @error="onVideoError"
                >
                    您的浏览器不支持视频播放
                </video>
                
                <!-- 加载状态 -->
                <div v-else-if="isLoading" class="camera-loading">
                    <fa icon="spinner" class="fa-spin" />
                    <span>正在连接摄像头...</span>
                </div>
                
                <!-- 默认状态：显示相机图标和提示 -->
                <div v-else class="camera-placeholder">
                    <fa icon="camera" class="camera-icon" />
                    <p>{{ cameraPlaceholderText }}</p>
                    <el-button 
                        v-if="selectedCamera && selectedCamera.camera_type === 'USB'" 
                        type="primary" 
                        size="small"
                        @click="requestCameraPermission"
                    >
                        请求摄像头权限
                    </el-button>
                </div>
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
            <button class="btn btn-primary" @click="updateTrafficLightSettings" :disabled="updating">
                <fa icon="refresh"></fa> {{ updating ? '更新中...' : '更新时长' }}
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
import { ref, onMounted, watch, onBeforeUnmount, computed, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { TrafficLightAPI, SandboxAPI } from '@/utils/vehicleAPI.js';
import { invoke } from '@tauri-apps/api/core';

// 摄像头相关
const cameras = ref([]);
const cameraId = ref('');
const selectedCamera = computed(() => cameras.value.find(cam => cam.id === cameraId.value));
const isLoading = ref(false);
const isStreaming = ref(false);
const videoRef = ref();
const cameraPreviewRef = ref();

// 视频流服务器相关
const streamServerPort = ref(9001);
const streamServerStarted = ref(false);
const websocketConnection = ref(null);

// 计算属性
const cameraPlaceholderText = computed(() => {
    if (cameras.value.length === 0) {
        return '暂无可用摄像头，请先在设置中添加摄像头';
    }
    if (!selectedCamera.value) {
        return '暂无视频';
    }
    if (!isStreaming.value && !isLoading.value) {
        return '请点击连接摄像头';
    }
    return '暂无视频';
});

// 移除了 cameraOverlayText，简化UI显示
const updating = ref(false);

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

// 从数据库加载交通灯设置
const loadTrafficLightSettings = async () => {
    try {
        const result = await TrafficLightAPI.getSettings();
        if (result.success) {
            trafficSettings.value.redLight = result.data.red_light_duration;
            trafficSettings.value.greenLight = result.data.green_light_duration;
            console.log('✅ 交通灯设置加载成功:', result.data);
        } else {
            console.error('❌ 交通灯设置加载失败:', result.error);
            ElMessage.error('加载交通灯设置失败: ' + result.error);
        }
    } catch (error) {
        console.error('❌ 交通灯设置加载异常:', error);
        ElMessage.error('加载交通灯设置异常');
    }
};

// 更新交通灯设置
const updateTrafficLightSettings = async () => {
    // 验证输入
    if (trafficSettings.value.redLight < 1 || trafficSettings.value.redLight > 300) {
        ElMessage.warning('红灯时长必须在1-300秒之间');
        return;
    }
    
    if (trafficSettings.value.greenLight < 1 || trafficSettings.value.greenLight > 300) {
        ElMessage.warning('绿灯时长必须在1-300秒之间');
        return;
    }

    updating.value = true;
    
    try {
        const updateData = {
            red_light_duration: trafficSettings.value.redLight,
            green_light_duration: trafficSettings.value.greenLight
        };
        
        const result = await TrafficLightAPI.updateSettings(updateData);
        
        if (result.success) {
            ElMessage.success('交通灯时长更新成功！');
            console.log('✅ 交通灯设置更新成功:', result.data);
            
            // 更新本地数据以确保一致性
            trafficSettings.value.redLight = result.data.red_light_duration;
            trafficSettings.value.greenLight = result.data.green_light_duration;
        } else {
            ElMessage.error('更新失败: ' + result.error);
            console.error('❌ 交通灯设置更新失败:', result.error);
        }
    } catch (error) {
        ElMessage.error('更新异常: ' + error.message);
        console.error('❌ 交通灯设置更新异常:', error);
    } finally {
        updating.value = false;
    }
};

// 加载摄像头列表
const loadCameras = async () => {
    try {
        const result = await SandboxAPI.getAllCameras();
        if (result.success) {
            cameras.value = result.data || [];
            console.log('✅ 加载摄像头列表成功:', cameras.value);
            
            // 不自动选择摄像头，让用户手动选择
        } else {
            cameras.value = [];
            console.log('📝 暂无摄像头配置');
        }
    } catch (error) {
        console.error('❌ 加载摄像头列表失败:', error);
        cameras.value = [];
    }
};

// 视频流处理方法
const startVideoStream = async (camera) => {
    if (!camera) {
        console.log('📹 没有选择摄像头');
        return;
    }

    isLoading.value = true;
    isStreaming.value = false;

    try {
        console.log(`🎥 开始连接摄像头: ${camera.name} (${camera.camera_type})`);
        
        if (camera.camera_type === 'USB') {
            // USB摄像头 - 使用getUserMedia API
            await startUSBCamera(camera);
        } else if (camera.camera_type === 'RJ45') {
            // RTSP摄像头 - 使用RTSP流
            await startRTSPCamera(camera);
        }
    } catch (error) {
        console.error('❌ 启动视频流失败:', error);
        ElMessage.error(`连接摄像头失败: ${error.message || error}`);
    } finally {
        isLoading.value = false;
    }
};

// USB摄像头处理
const startUSBCamera = async (camera) => {
    try {
        console.log(`🔌 尝试连接USB摄像头，设备索引: ${camera.device_index}`);
        
        // 首先获取所有可用的摄像头设备
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        console.log('📹 可用摄像头设备:', videoDevices.map(d => ({ 
            label: d.label, 
            deviceId: d.deviceId 
        })));
        
        let constraints;
        
        if (camera.device_index !== null && camera.device_index >= 0 && camera.device_index < videoDevices.length) {
            // 使用指定索引的摄像头
            const targetDevice = videoDevices[camera.device_index];
            console.log(`🎯 使用指定摄像头: ${targetDevice.label || 'Unknown'}`);
            
            constraints = {
                video: {
                    deviceId: { exact: targetDevice.deviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };
        } else {
            // 使用默认摄像头
            console.log('📷 使用默认摄像头');
            constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('🎉 getUserMedia成功，获得视频流');
        
        // 先设置流状态为true，这样video元素会显示
        isStreaming.value = true;
        
        // 等待下一个tick确保DOM更新
        await nextTick();
        
        if (videoRef.value) {
            videoRef.value.srcObject = stream;
            console.log('✅ USB摄像头连接成功，视频流已设置到video元素');
        } else {
            console.error('❌ video元素引用为空');
            throw new Error('video元素未找到');
        }
    } catch (error) {
        console.error('❌ USB摄像头连接失败:', error);
        console.error('错误详情:', error.name, error.message);
        
        // 重置状态
        isStreaming.value = false;
        
        // 提供更具体的错误信息
        let errorMessage = '无法访问USB摄像头';
        if (error.name === 'NotFoundError') {
            errorMessage = '未找到摄像头设备';
        } else if (error.name === 'NotAllowedError') {
            errorMessage = '摄像头权限被拒绝，请在浏览器设置中允许摄像头访问';
        } else if (error.name === 'NotReadableError') {
            errorMessage = '摄像头被其他应用占用';
        } else if (error.name === 'OverconstrainedError') {
            errorMessage = '摄像头不支持指定的分辨率';
        }
        
        throw new Error(errorMessage);
    }
};

// RTSP摄像头处理（使用Rust后端）
const startRTSPCamera = async (camera) => {
    if (!camera.rtsp_url) {
        throw new Error('RTSP地址不能为空');
    }

    try {
        // 确保视频流服务器已启动
        if (!streamServerStarted.value) {
            await startVideoStreamServer();
        }

        // 建立WebSocket连接处理RTSP流
        await connectRTSPWebSocket(camera);
        
    } catch (error) {
        console.error('❌ RTSP摄像头连接失败:', error);
        throw new Error(`RTSP流连接失败: ${error.message || error}`);
    }
};

// 停止视频流
const stopVideoStream = () => {
    // 停止USB摄像头流
    if (videoRef.value && videoRef.value.srcObject) {
        const tracks = videoRef.value.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.value.srcObject = null;
    }
    
    // 停止RTSP流
    if (videoRef.value && videoRef.value.src) {
        videoRef.value.src = '';
    }
    
    // 关闭WebSocket连接
    if (websocketConnection.value) {
        const selectedCameraValue = selectedCamera.value;
        if (selectedCameraValue) {
            // 发送停止流的消息
            const message = {
                type: 'stop_stream',
                camera_id: selectedCameraValue.id
            };
            websocketConnection.value.send(JSON.stringify(message));
        }
        closeWebSocketConnection();
    }
    
    isStreaming.value = false;
    console.log('🛑 视频流已停止');
};

// 视频事件处理
const onVideoLoadStart = () => {
    console.log('📹 视频开始加载...');
    isLoading.value = true;
};

const onVideoLoaded = () => {
    console.log('✅ 视频加载完成');
    isLoading.value = false;
    isStreaming.value = true;
};

const onVideoError = (event) => {
    console.error('❌ 视频加载错误:', event);
    isLoading.value = false;
    isStreaming.value = false;
    ElMessage.error('视频流播放失败');
};

// 监听摄像头选择变化
watch(cameraId, async (newCameraId, oldCameraId) => {
    if (newCameraId !== oldCameraId) {
        console.log(`🔄 摄像头切换: ${oldCameraId} → ${newCameraId}`);
        
        // 停止之前的流
        stopVideoStream();
        
        // 启动新的流
        const camera = cameras.value.find(cam => cam.id === newCameraId);
        if (camera) {
            await nextTick(); // 等待DOM更新
            await startVideoStream(camera);
        }
    }
});

// 启动视频流服务器
const startVideoStreamServer = async () => {
    if (streamServerStarted.value) {
        return;
    }
    
    try {
        console.log('🚀 启动视频流服务器...');
        const result = await invoke('start_video_stream_server', { 
            port: streamServerPort.value 
        });
        streamServerStarted.value = true;
        console.log('✅ 视频流服务器启动成功:', result);
    } catch (error) {
        console.error('❌ 启动视频流服务器失败:', error);
        ElMessage.error(`启动视频流服务器失败: ${error}`);
        throw error;
    }
};

// 连接RTSP WebSocket
const connectRTSPWebSocket = async (camera) => {
    try {
        const wsUrl = await invoke('get_camera_websocket_url', { 
            cameraId: camera.id,
            serverPort: streamServerPort.value 
        });
        
        console.log(`🔌 连接WebSocket: ${wsUrl}`);
        
        const ws = new WebSocket(wsUrl);
        websocketConnection.value = ws;
        
        ws.onopen = () => {
            console.log('✅ WebSocket连接成功');
            
            // 发送启动流的消息
            const message = {
                type: 'start_stream',
                camera_id: camera.id,
                rtsp_url: camera.rtsp_url
            };
            ws.send(JSON.stringify(message));
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('❌ 解析WebSocket消息失败:', error);
            }
        };
        
        ws.onclose = () => {
            console.log('🔌 WebSocket连接关闭');
            isStreaming.value = false;
            websocketConnection.value = null;
        };
        
        ws.onerror = (error) => {
            console.error('❌ WebSocket错误:', error);
            ElMessage.error('WebSocket连接失败');
            isStreaming.value = false;
        };
        
    } catch (error) {
        console.error('❌ 创建WebSocket连接失败:', error);
        throw error;
    }
};

// 处理WebSocket消息
const handleWebSocketMessage = (data) => {
    switch (data.type) {
        case 'frame_data':
            // 处理帧数据
            if (data.camera_id === selectedCamera.value?.id) {
                displayVideoFrame(data.data);
            }
            break;
            
        case 'status':
            console.log(`📡 摄像头状态: ${data.camera_id} - ${data.status}`);
            if (data.status === 'streaming') {
                isStreaming.value = true;
            }
            break;
            
        case 'error':
            console.error('❌ 服务器错误:', data.message);
            ElMessage.error(`视频流错误: ${data.message}`);
            break;
            
        default:
            console.log('📨 未处理的WebSocket消息:', data);
    }
};

// 显示视频帧（简化版本）
const displayVideoFrame = (frameData) => {
    // 这里可以将base64编码的帧数据显示在canvas上
    // 或者创建blob URL显示在video元素中
    console.log('📺 收到视频帧数据，长度:', frameData.length);
    
    // 简化实现：显示提示信息
    if (!isStreaming.value) {
        isStreaming.value = true;
        console.log('✅ 开始接收RTSP视频流');
    }
};

// 关闭WebSocket连接
const closeWebSocketConnection = () => {
    if (websocketConnection.value) {
        websocketConnection.value.close();
        websocketConnection.value = null;
    }
};

// 检查摄像头权限
const checkCameraPermission = async () => {
    try {
        const permission = await navigator.permissions.query({ name: 'camera' });
        console.log('📹 摄像头权限状态:', permission.state);
        
        if (permission.state === 'denied') {
            ElMessage.warning('摄像头权限被拒绝，请在浏览器设置中允许摄像头访问');
        }
        
        return permission.state;
    } catch (error) {
        console.log('⚠️ 无法检查摄像头权限:', error);
        return 'unknown';
    }
};

// 请求摄像头权限
const requestCameraPermission = async () => {
    try {
        console.log('🔐 请求摄像头权限...');
        
        // 通过尝试获取摄像头来请求权限
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: false 
        });
        
        // 立即停止流，我们只是为了获取权限
        stream.getTracks().forEach(track => track.stop());
        
        console.log('✅ 摄像头权限获取成功');
        ElMessage.success('摄像头权限获取成功，请重新选择摄像头');
        
        // 重新连接当前选择的摄像头
        if (selectedCamera.value) {
            await startVideoStream(selectedCamera.value);
        }
        
    } catch (error) {
        console.error('❌ 摄像头权限请求失败:', error);
        
        let message = '摄像头权限请求失败';
        if (error.name === 'NotAllowedError') {
            message = '摄像头权限被拒绝，请在浏览器地址栏点击摄像头图标并允许访问';
        } else if (error.name === 'NotFoundError') {
            message = '未找到摄像头设备，请检查设备连接';
        }
        
        ElMessage.error(message);
    }
};

// 组件挂载时加载设置
onMounted(async () => {
    loadTrafficLightSettings();
    loadCameras();
    
    // 检查摄像头权限
    await checkCameraPermission();
    
    // 预启动视频流服务器
    startVideoStreamServer().catch(error => {
        console.log('⚠️ 预启动视频流服务器失败，将在需要时重试:', error);
    });
});

// 组件卸载时清理资源
onBeforeUnmount(() => {
    stopVideoStream();
    closeWebSocketConnection();
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
    font-size: 12px;
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

/* 调整摄像头区域的间距 */
.form-group > .camera-preview {
    margin-top: 0px !important;
    margin-bottom: 2px !important;
}

/* 减少下拉框与摄像头区域的间距 */
.form-group > .flex {
    margin-bottom: 5px !important;
}

/* 为摄像头所在的form-group减少gap */
.form-group:has(.camera-preview) {
    gap: 5px !important;
}

/* 兼容性方案：直接针对包含摄像头的form-group */
.camera-container-group {
    gap: 5px !important;
}

/* 摄像头下拉框清除按钮样式 - 多种选择器尝试 */
:deep(.camera-container-group .el-select .el-input__clear),
:deep(.camera-container-group .el-input__clear),
.camera-container-group :deep(.el-input__clear),
:deep(.el-select .el-input__clear) {
    font-size: 16px !important;
    color: #ff4757 !important;
    transition: all 0.3s ease !important;
}

:deep(.camera-container-group .el-select .el-input__clear:hover),
:deep(.camera-container-group .el-input__clear:hover),
.camera-container-group :deep(.el-input__clear:hover),
:deep(.el-select .el-input__clear:hover) {
    color: #ff3742 !important;
    transform: scale(1.1) !important;
}

/* 全局强制覆盖清除按钮样式 */
</style>

<style>
/* 不使用scoped，全局覆盖 */
.camera-container-group .el-select .el-input__clear {
    font-size: 16px !important;
    color: #ff4757 !important;
    transition: all 0.3s ease !important;
}

.camera-container-group .el-select .el-input__clear:hover {
    color: #ff3742 !important;
    transform: scale(1.1) !important;
}

/* 更通用的全局样式 */
.el-input__clear {
    font-size: 16px !important;
    color: #ff4757 !important;
    transition: all 0.3s ease !important;
}

.el-input__clear:hover {
    color: #ff3742 !important;
    transform: scale(1.1) !important;
}

/* 尝试更多可能的类名 */
.el-input__suffix-inner .el-input__clear,
.el-input__suffix .el-input__clear,
.el-input .el-input__clear,
.el-select .el-input .el-input__clear,
i.el-input__clear,
.el-icon-circle-close:before {
    font-size: 16px !important;
    color: #ff4757 !important;
}

.el-input__suffix-inner .el-input__clear:hover,
.el-input__suffix .el-input__clear:hover,
.el-input .el-input__clear:hover,
.el-select .el-input .el-input__clear:hover,
i.el-input__clear:hover,
.el-icon-circle-close:hover:before {
    color: #ff3742 !important;
    transform: scale(1.1) !important;
}

/* 如果是新版本Element Plus使用的是SVG图标 */
.el-input__clear svg,
.el-input__clear .el-icon {
    width: 16px !important;
    height: 16px !important;
    color: #ff4757 !important;
    fill: #ff4757 !important;
}

.el-input__clear:hover svg,
.el-input__clear:hover .el-icon {
    color: #ff3742 !important;
    fill: #ff3742 !important;
    transform: scale(1.1) !important;
}

/* 针对自定义摄像头选择器的强制样式 */
.custom-camera-select .el-input__clear,
.custom-camera-select .el-input__suffix .el-input__clear,
.custom-camera-select .el-input__suffix-inner .el-input__clear {
    font-size: 16px !important;
    color: #ff4757 !important;
    transition: all 0.3s ease !important;
    opacity: 1 !important;
    visibility: visible !important;
}

.custom-camera-select .el-input__clear:hover,
.custom-camera-select .el-input__suffix .el-input__clear:hover,
.custom-camera-select .el-input__suffix-inner .el-input__clear:hover {
    color: #ff3742 !important;
    transform: scale(1.1) !important;
}

/* 强制覆盖所有可能的Element Plus清除按钮样式 */
.custom-camera-select .el-input__clear,
.custom-camera-select [class*="clear"],
.custom-camera-select [class*="close"] {
    font-size: 16px !important;
    color: #ff4757 !important;
}

/* 相机预览增强 */
.camera-preview {
    width: 100%;
    background: linear-gradient(45deg, #1a1f25, #2c3e50);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(0, 240, 255, 0.3);
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

.camera-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    z-index: 2;
    position: relative;
    
    p {
        color: rgba(255, 255, 255, 0.6);
        font-size: 12px !important;
        margin: 5px 0;
        text-align: center;
    }
}

/* 更高优先级的选择器确保字号生效 */
.camera-container-group .camera-placeholder p,
.form-group .camera-placeholder p {
    font-size: 12px !important;
    color: rgba(255, 255, 255, 0.6) !important;
}

.camera-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 6px;
    background: #000;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
}

.camera-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--primary);
    font-size: 12px;
    z-index: 10;
    background: rgba(0, 0, 0, 0.8);
    padding: 16px;
    border-radius: 8px;
    
    .fa-spin {
        font-size: 20px;
    }
}

.camera-icon {
    font-size: 3rem;
    color: rgba(255, 255, 255, 0.2);
    margin-bottom: 5px;
}

.camera-desc {
    color: rgba(255, 255, 255, 0.6);
    font-size: 16px;
    margin-bottom: 10px;
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
    gap: 8px;

    .light-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(0, 240, 255, 0.2);
        border-radius: 8px;
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
            font-size: 11px;
        }
        
        .light-icon {
            font-size: 14px;
            margin-right: 6px;
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