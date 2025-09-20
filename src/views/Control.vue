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
                    playsinline
                    @loadstart="onVideoLoadStart"
                    @loadeddata="onVideoLoaded"
                    @error="onVideoError"
                    @canplay="onVideoCanPlay"
                    @contextmenu.prevent
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
                </div>
            </div>
        </div>

        <div class="form-group">
            <label class="form-label"
                ><fa icon="traffic-light"></fa> 交通信号控制</label
            >
            <div class="form-item">
                <label class="item-label">红绿灯编号</label>
                <el-select 
                    v-model.number="selectedTrafficLightId" 
                    @change="onTrafficLightChange"
                    placeholder="请选择红绿灯"
                    class="input-select"
                >
                    <el-option
                        v-for="id in trafficLightOptions"
                        :key="id"
                        :label="`#${id}`"
                        :value="id"
                    />
                </el-select>
            </div>
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
            <div class="device-control-grid">
                <div class="device-row">
                    <div class="device-label">
                        <fa icon="parking" class="device-icon"></fa>
                        <span>停车抬杠</span>
                    </div>
                    <div class="device-switch">
                        <el-switch
                            v-model="lightSettings.barrier"
                            active-color="#13ce66"
                        />
                    </div>
                </div>
                <div class="device-row">
                    <div class="device-label">
                        <fa icon="sun" class="device-icon"></fa>
                        <span>环境灯</span>
                    </div>
                    <div class="device-switch">
                        <el-switch
                            v-model="lightSettings.ambient"
                            active-color="#13ce66"
                        />
                    </div>
                </div>
                <div class="device-row">
                    <div class="device-label">
                        <fa icon="building" class="device-icon"></fa>
                        <span>建筑灯</span>
                    </div>
                    <div class="device-switch">
                        <el-switch
                            v-model="lightSettings.building"
                            active-color="#13ce66"
                        />
                    </div>
                </div>
                <div class="device-row">
                    <div class="device-label">
                        <fa icon="street-view" class="device-icon"></fa>
                        <span>路灯</span>
                    </div>
                    <div class="device-switch">
                        <el-switch
                            v-model="lightSettings.street"
                            active-color="#13ce66"
                        />
                    </div>
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
import { debug as plDebug, info as plInfo, warn as plWarn, error as plError } from '@tauri-apps/plugin-log';

// 摄像头相关
const cameras = ref([]);
const cameraId = ref('');
const selectedCamera = computed(() => cameras.value.find(cam => cam.id === cameraId.value));
const isLoading = ref(false);
const isStreaming = ref(false);
const videoRef = ref();
const cameraPreviewRef = ref();

// 保留端口配置（可能用于其他服务）
const streamServerPort = ref(9001);

// 计算属性
const cameraPlaceholderText = computed(() => {
    if (cameras.value.length === 0) {
        return '暂无可用摄像头，请先在设置中添加摄像头';
    }
    if (!selectedCamera.value) {
        return '请选择摄像头';
    }
    if (isLoading.value) {
        return '正在连接摄像头...';
    }
    if (!isStreaming.value) {
        if (selectedCamera.value.camera_type === 'USB') {
            return '准备连接USB摄像头';
        } else if (selectedCamera.value.camera_type === 'RJ45') {
            return '准备连接RTSP流';
        }
        return '准备连接摄像头';
    }
    return '暂无视频';
});

// 移除了 cameraOverlayText，简化UI显示
const updating = ref(false);

const trafficSettings = ref({
    redLight: 45,
    greenLight: 60,
});

// 红绿灯编号与数量
const selectedTrafficLightId = ref(1);
const trafficLightCount = ref(0);
const trafficLightOptions = computed(() => {
    const count = Math.max(1, Number(trafficLightCount.value || 0));
    return Array.from({ length: count }, (_, i) => i + 1);
});

const lightSettings = ref({
    barrier: true, // 停车抬杠
    ambient: true, // 环境灯
    building: false, // 建筑灯
    street: true, // 路灯
});

// 切换编号时加载该编号的时长
const onTrafficLightChange = async () => {
    await loadTrafficLightSettings();
};

// 从数据库加载所选红绿灯的时长
const loadTrafficLightSettings = async () => {
    try {
        const result = await TrafficLightAPI.getLightItem(Number(selectedTrafficLightId.value || 1));
        if (result.success && result.data) {
            trafficSettings.value.redLight = result.data.red_light_duration ?? 30;
            trafficSettings.value.greenLight = result.data.green_light_duration ?? 30;
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
        // 发送到沙盘：先检查沙盘是否在线（有无沙盘连接）
        try {
            if (!trafficLightOptions.value.includes(selectedTrafficLightId.value)) {
                ElMessage.warning('请选择有效的红绿灯编号');
                return;
            }
            await invoke('send_sandbox_traffic_light_duration', {
                lightId: selectedTrafficLightId.value,
                redSeconds: trafficSettings.value.redLight,
                greenSeconds: trafficSettings.value.greenLight
            });
            ElMessage.success('发送成功');
            // 发送成功后保存到DB，并刷新显示
            const save = await TrafficLightAPI.updateLightItem(
                Number(selectedTrafficLightId.value),
                Number(trafficSettings.value.redLight),
                Number(trafficSettings.value.greenLight)
            );
            if (!save.success) {
                console.warn('⚠️ 保存到数据库失败:', save.error);
            } else {
                await loadTrafficLightSettings();
            }
        } catch (e) {
            // Rust端如果未连接会返回错误"设备离线"或其它
            ElMessage.error('设备离线');
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

// 读取沙盘服务设置（获取红绿灯数量）
const loadSandboxServiceSettings = async () => {
    try {
        const res = await SandboxAPI.getServiceSettings();
        if (res.success && res.data) {
            const count = Number(res.data.traffic_light_count || 0);
            trafficLightCount.value = count;
            if (selectedTrafficLightId.value > Math.max(1, count)) {
                selectedTrafficLightId.value = 1;
            }
        }
    } catch (err) {
        console.warn('读取沙盘服务设置失败:', err);
    }
};

// 视频流处理方法
const startVideoStream = async (camera) => {
    if (!camera) {
        console.log('📹 没有选择摄像头');
        return;
    }

    try { await plInfo(`🎥 开始连接摄像头: ${camera.name} (${camera.camera_type})`); } catch (_) {}
    
    // 设置加载状态
    isLoading.value = true;
    isStreaming.value = false;
    
    // 确保video元素已清理
    if (videoRef.value) {
        videoRef.value.removeAttribute('src');
        videoRef.value.srcObject = null;
        videoRef.value.load();
    }

    try {
        if (camera.camera_type === 'USB') {
            // USB摄像头 - 使用getUserMedia API
            await startUSBCamera(camera);
        } else if (camera.camera_type === 'RJ45') {
            // RTSP摄像头 - 使用RTSP流
            await startRTSPCamera(camera);
        }
    } catch (error) {
        try { await plError(`❌ 启动视频流失败: ${error.message || error}`); } catch (_) {}
        ElMessage.error(`连接摄像头失败: ${error.message || error}`);
        isStreaming.value = false;
    } finally {
        isLoading.value = false;
    }
};

// USB摄像头处理
const startUSBCamera = async (camera) => {
    try {
        try { await plDebug(`🔌 尝试连接USB摄像头，设备索引: ${camera.device_index}`); } catch (_) {}
        
        // 首先获取所有可用的摄像头设备
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        // 调试信息保留在控制台，避免大量写入文件
        console.debug('📹 可用摄像头设备:', videoDevices.map(d => ({ label: d.label, deviceId: d.deviceId })));
        
        let constraints;
        
        if (camera.device_index !== null && camera.device_index >= 0 && camera.device_index < videoDevices.length) {
            // 使用指定索引的摄像头
            const targetDevice = videoDevices[camera.device_index];
            console.debug(`🎯 使用指定摄像头: ${targetDevice.label || 'Unknown'}`);
            
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
            console.debug('📷 使用默认摄像头');
            constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.debug('🎉 getUserMedia成功，获得视频流');
        
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
        try { await plError(`❌ USB摄像头连接失败: ${error.name} ${error.message}`); } catch (_) {}
        
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

// 等待HLS流就绪
const waitForHLSReady = async (hlsUrl, maxRetries = 10, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`🔍 检查HLS流是否就绪... (${i + 1}/${maxRetries})`);
            const response = await fetch(hlsUrl, { 
                method: 'HEAD',
                cache: 'no-cache'
            });
            if (response.ok) {
                console.log('✅ HLS流已就绪');
                return;
            }
        } catch (error) {
            console.log(`⏳ HLS流还未就绪: ${error.message}`);
        }
        
        if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    console.warn('⚠️ HLS流可能还未完全就绪，但将尝试播放');
};

// RTSP摄像头处理（通过Rust后端转换为HLS）
const startRTSPCamera = async (camera) => {
    if (!camera.rtsp_url) {
        throw new Error('RTSP地址不能为空');
    }

    try {
        try { await plInfo(`🎥 启动RTSP到HLS转换: ${camera.rtsp_url}`); } catch (_) {}
        
        // 先启动HLS服务器
        try {
            await invoke('start_hls_server', { port: 9002 });
            console.debug('✅ HLS服务器已启动');
        } catch (error) {
            console.debug('ℹ️ HLS服务器已在运行或启动中');
        }
        
        // 启动RTSP到HLS转换
        const hlsPath = await invoke('start_rtsp_conversion', {
            cameraId: camera.id,
            rtspUrl: camera.rtsp_url
        });
        
        console.debug(`🔄 HLS路径: ${hlsPath}`);
        
        // 等待一下让FFmpeg开始处理
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 获取完整的HLS URL
        const hlsUrl = await invoke('get_hls_url', {
            cameraId: camera.id,
            hlsPort: 9002
        });
        
        console.debug(`🎬 HLS URL: ${hlsUrl}`);
        
        // 检查HLS流是否真的可用
        await waitForHLSReady(hlsUrl);
        
        // 先设置streaming状态让video元素显示
        isStreaming.value = true;
        
        // 等待DOM更新，确保video元素已创建
        await nextTick();
        
        if (videoRef.value) {
            // 清除之前的源
            videoRef.value.src = '';
            videoRef.value.srcObject = null;
            
            // 设置播放属性优化性能
            videoRef.value.autoplay = true;
            videoRef.value.muted = true;
            videoRef.value.playsInline = true;
            // controls已在模板中设置
            
            // 设置HLS URL到video元素
            videoRef.value.src = hlsUrl;
            
            // 尝试播放
            try {
                await videoRef.value.play();
                console.log('✅ HLS流播放成功');
            } catch (playError) {
                console.warn('⚠️ 自动播放失败，用户可手动点击播放:', playError.message);
                // 不设置为false，保持视频元素显示，用户可以手动播放
            }
        } else {
            // 如果还是找不到video元素，重置状态
            isStreaming.value = false;
            throw new Error('video元素未找到，请重试');
        }
        
    } catch (error) {
        try { await plError(`❌ RTSP摄像头连接失败: ${error.message || error}`); } catch (_) {}
        isStreaming.value = false; // 发生错误时重置状态
        throw new Error(`RTSP流连接失败: ${error.message || error}`);
    }
};

// 停止视频流
const stopVideoStream = async () => {
    console.debug('🛑 开始停止视频流...');
    
    try {
        // 停止USB摄像头流
        if (videoRef.value && videoRef.value.srcObject) {
            console.debug('📹 停止USB摄像头流');
            const tracks = videoRef.value.srcObject.getTracks();
            tracks.forEach(track => {
                track.stop();
                console.log(`🔌 已停止轨道: ${track.kind}`);
            });
            videoRef.value.srcObject = null;
        }
        
        // 停止RTSP/HLS流
        if (videoRef.value && videoRef.value.src) {
            console.debug('📺 停止RTSP/HLS流');
            videoRef.value.pause(); // 暂停播放
            videoRef.value.removeAttribute('src'); // 完全移除src属性
            videoRef.value.load(); // 清除缓冲
        }
        
        // 如果当前摄像头是RTSP类型，停止后端转换
        if (selectedCamera.value && selectedCamera.value.camera_type === 'RJ45') {
            try {
                await invoke('stop_rtsp_conversion', { cameraId: selectedCamera.value.id });
                console.debug('🛑 RTSP转换已停止');
            } catch (error) {
                console.warn('⚠️ 停止RTSP转换时出现警告:', error);
            }
        }
        
        // 重置所有状态
        isStreaming.value = false;
        isLoading.value = false;
        
        // 等待一下确保清理完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.debug('✅ 视频流已完全停止');
        
    } catch (error) {
        console.warn('⚠️ 停止视频流时出现警告:', error.message);
        isStreaming.value = false;
        isLoading.value = false;
    }
};

// 视频事件处理
const onVideoLoadStart = () => {
    console.debug('📹 视频开始加载...');
    isLoading.value = true;
};

const onVideoLoaded = () => {
    console.debug('✅ 视频加载完成');
    isLoading.value = false;
    isStreaming.value = true;
};

const onVideoCanPlay = () => {
    console.debug('🎬 视频可以播放');
    isLoading.value = false;
    if (videoRef.value) {
        // 确保视频开始播放
        videoRef.value.play().catch(error => {
            console.warn('⚠️ 自动播放失败:', error.message);
        });
    }
};

const onVideoError = (event) => {
    console.error('❌ 视频加载错误:', event);
    const videoEl = event.target;
    
    // 详细的错误信息
    if (videoEl && videoEl.error) {
        const errorCode = videoEl.error.code;
        const errorMessage = videoEl.error.message;
        console.error(`视频错误代码: ${errorCode}, 消息: ${errorMessage}`);
        
        // 根据摄像头类型和错误类型提供具体建议
        let userMessage = '视频流播放失败';
        const isRTSP = selectedCamera.value?.camera_type === 'RJ45';
        
        switch (errorCode) {
            case 1: // MEDIA_ERR_ABORTED
                userMessage = '视频播放被中断';
                break;
            case 2: // MEDIA_ERR_NETWORK
                userMessage = isRTSP ? '网络错误，请检查RTSP服务是否可用' : '网络错误，请检查连接';
                break;
            case 3: // MEDIA_ERR_DECODE
                userMessage = isRTSP ? '视频解码失败，请检查RTSP流格式' : '视频解码失败';
                break;
            case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                userMessage = isRTSP ? '不支持的视频格式或RTSP协议' : '不支持的视频格式，请检查摄像头兼容性';
                break;
        }
        
        // 对于RTSP摄像头，可能需要更多时间让HLS流准备就绪
        if (isRTSP && errorCode === 4) {
            console.log('🔄 HLS流可能还在准备中，等待一下再重试...');
            // 对于RTSP，给HLS转换更多时间
            setTimeout(async () => {
                if (selectedCamera.value?.camera_type === 'RJ45' && videoRef.value) {
                    try {
                        const hlsUrl = await invoke('get_hls_url', {
                            cameraId: selectedCamera.value.id,
                            hlsPort: 9002
                        });
                    console.debug('🔄 重新尝试播放HLS流:', hlsUrl);
                        videoRef.value.src = hlsUrl;
                        videoRef.value.load();
                    } catch (retryError) {
                        console.error('❌ 重试失败:', retryError);
                        ElMessage.error('RTSP转换失败，请检查RTSP流是否可用');
                    }
                }
            }, 3000); // 再等3秒
            return; // 不显示错误消息，等待重试
        }
        
        // 只有在真正出错时才显示错误消息，避免切换时的误报
        if (isStreaming.value || isLoading.value) {
            ElMessage.error(userMessage);
        }
    }
    
    isLoading.value = false;
    isStreaming.value = false;
};

// 监听摄像头选择变化
watch(cameraId, async (newCameraId, oldCameraId) => {
    if (newCameraId !== oldCameraId) {
        console.log(`🔄 摄像头切换: ${oldCameraId} → ${newCameraId}`);
        
        try {
            // 停止之前的流（包括清理RTSP转换）
            await stopVideoStream();
            
            // 启动新的流
            const camera = cameras.value.find(cam => cam.id === newCameraId);
            if (camera) {
                // 等待DOM更新和清理完成
                await nextTick();
                await startVideoStream(camera);
            }
        } catch (error) {
            console.error('❌ 摄像头切换失败:', error);
            ElMessage.error(`摄像头切换失败: ${error.message}`);
        }
    }
});


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


// 组件挂载时加载设置
onMounted(async () => {
    await loadSandboxServiceSettings();
    await loadTrafficLightSettings();
    loadCameras();
    
    // 检查摄像头权限
    await checkCameraPermission();
});

// 组件卸载时清理资源
onBeforeUnmount(() => {
    stopVideoStream();
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
    
    /* 完全隐藏视频控制条 */
    &::-webkit-media-controls {
        display: none !important;
    }
    
    &::-webkit-media-controls-panel {
        display: none !important;
    }
    
    &::-webkit-media-controls-play-button {
        display: none !important;
    }
    
    &::-webkit-media-controls-start-playback-button {
        display: none !important;
    }
    
    /* Firefox */
    &::-moz-media-controls {
        display: none !important;
    }
    
    /* 禁用右键菜单但保留播放功能 */
    &::-webkit-media-controls-overlay-play-button {
        display: none !important;
    }
    
    /* 禁用视频的默认右键菜单 */
    &:focus {
        outline: none;
    }
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

/* 重新设计的设备控制区域 */
.device-control-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.device-row {
    display: flex;
    align-items: center;
    padding: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(0, 240, 255, 0.2);
    border-radius: 8px;
    transition: all 0.3s ease;
}

.device-row:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(0, 240, 255, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 240, 255, 0.1);
}

.device-label {
    display: flex;
    align-items: center;
    flex: 1;
    margin-right: 12px;
    font-size: 12px; /* 调小字号 */
}

.device-icon {
    font-size: 12px; /* 调小图标 */
    margin-right: 6px;
    color: var(--primary);
}

.device-switch {
    flex-shrink: 0;
}

/* 调整Element Plus开关大小 */
.device-switch :deep(.el-switch) {
    --el-switch-on-color: #13ce66;
    --el-switch-off-color: #dcdfe6;
    height: 20px !important;
    min-width: 36px !important;
}

.device-switch :deep(.el-switch__core) {
    height: 20px !important;
    min-width: 36px !important;
    border-radius: 10px !important;
}

.device-switch :deep(.el-switch__action) {
    height: 16px !important;
    width: 16px !important;
    top: 2px !important;
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