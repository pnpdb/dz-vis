<template>
  <div class="parallel-driving-page">
    <!-- 自定义标题栏 - 与主界面保持一致 -->
    <TitleBar />
    
    <!-- 标题栏 -->
    <header class="header">
      <!-- 左侧返回按钮 -->
      <div class="left-section">
        <button class="back-btn notification-btn" @click="goBack" title="返回主界面">
          <fa icon="arrow-left" />
        </button>
      </div>

      <!-- 中间标题区域 -->
      <div class="title-section">
        <div class="title-text">{{ appTitle }}</div>
      </div>

      <!-- 右侧占位区域 -->
      <div class="right-section placeholder-section"></div>
    </header>

    <!-- 菜单导航栏 -->
    <nav class="nav-section">
      <div class="nav-tabs">
        <div class="nav-indicator">
          <fa icon="gamepad" />
          <span>平行驾驶模式</span>
        </div>
      </div>
    </nav>

    <!-- 主内容区域 -->
    <main class="main-content">
      <!-- 左侧摄像头画面区域 -->
      <div class="video-panel">
        <div class="video-container">
          <div class="video-frame">
            <div v-if="!videoSrc" class="video-placeholder">
              <fa icon="video" class="video-icon" />
              <p class="video-status-text">等待车辆摄像头连接...</p>
            </div>
            <img v-else ref="videoImg" :src="videoSrc" class="video-stream" alt="车载摄像头画面" />
            <div v-if="videoSrc && lastFrameTime" class="video-overlay">
              车辆{{ currentVehicleId }} | {{ frameRate }} FPS
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧仪表盘区域 -->
      <div class="dashboard-panel">
        <!-- 车速仪表盘 -->
        <div class="manual-card">
          <div class="manual-card-border"></div>
          <div class="manual-card-bg"></div>
          <div class="manual-card-content">
            <div class="instrument-title">车速</div>
            <div class="dashboard-wrap center">
              <div :class="['out-circle', { 'out-circle_rotate': currentSpeed > 0 }, 'center']">
                <div
                  v-for="item in 60"
                  :key="item"
                  :style="`--i: ${item}; `"
                  :class="['scend', { scend_active: item <= (currentSpeed * 60) }]"
                ></div>
                <div class="inner-circle">
                  <div class="speed">
                    <span class="speed-counter">{{ displaySpeed }}</span>
                  </div>
                  <div class="unit">速度</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 方向盘 -->
        <div class="manual-card">
          <div class="manual-card-border"></div>
          <div class="manual-card-bg"></div>
          <div class="manual-card-content">
            <div class="instrument-title">方向盘</div>
            <div class="steering-wheel">
              <div class="wheel-container">
                <div class="wheel" :style="{ transform: `rotate(${steeringAngle}deg)` }">
                  <img src="/Image/wheel.svg" alt="方向盘" class="wheel-svg" />
                </div>
              </div>
              <div class="steering-angle">
                {{ Math.abs(steeringAngle).toFixed(0) }}°
              </div>
            </div>
          </div>
        </div>

        <!-- 电池和档位 -->
        <div class="battery-gear-row">
          <!-- 电池电量 -->
          <div class="manual-card">
            <div class="manual-card-border"></div>
            <div class="manual-card-bg"></div>
            <div class="manual-card-content">
              <div class="instrument-title">电池电量</div>
              <div class="battery-content-wrapper">
                <div style="display: flex; flex-direction: row; align-items: center; justify-content: center;">
                  <div style="width: 80px; height: 36px; box-shadow: 0 0 0 2px rgb(0, 240, 255); border-radius: 4px; background: rgb(0, 0, 0); overflow: hidden; position: relative;">
                    <div 
                      :style="{
                        width: batteryLevel + '%',
                        height: '100%',
                        backgroundColor: batteryLevel > 50 ? '#66bb6a' : (batteryLevel > 20 ? '#ffa726' : '#ff4757')
                      }"
                    ></div>
                  </div>
                  <div style="width: 8px; min-width: 8px; height: 16px; min-height: 16px; background: rgb(0, 240, 255); background-color: rgb(0, 240, 255); border-radius: 0 3px 3px 0; flex-shrink: 0; flex-grow: 0; margin-left: 1px; box-shadow: 0 0 0 1px rgb(0, 240, 255), inset 0 0 0 10px rgb(0, 240, 255);"></div>
                </div>
                <div class="battery-text">{{ batteryLevel }}%</div>
              </div>
            </div>
          </div>

          <!-- 档位 -->
          <div class="manual-card">
            <div class="manual-card-border"></div>
            <div class="manual-card-bg"></div>
            <div class="manual-card-content">
              <div class="instrument-title">档位</div>
              <div class="gear-content-wrapper">
                <div class="gear-box">{{ currentGear }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 位置地图 -->
        <div class="manual-card map-card-manual">
          <div class="manual-card-border"></div>
          <div class="manual-card-bg"></div>
          <div class="manual-card-content">
            <div class="map-header">
              <div class="instrument-title">
                位置地图
                <span class="connection-indicator" :class="{ connected: vehicleConnected, disconnected: !vehicleConnected }">
                  <fa :icon="vehicleConnected ? 'circle' : 'times-circle'" />
                </span>
              </div>
              <div class="map-coordinates-header">
                [X: {{ vehicleCoords.x.toFixed(2) }} m, Y: {{ vehicleCoords.y.toFixed(2) }} m]
                <span v-if="!vehicleConnected" class="disconnected-text">(断开连接)</span>
              </div>
            </div>
            <div class="minimap">
              <div class="map-background">
                <img src="/Image/map.png" alt="地图" class="map-image" />
                <div class="vehicle-marker" 
                     :class="{ 'disconnected': !vehicleConnected }"
                     :style="{ 
                       left: vehiclePosition.x + '%', 
                       top: vehiclePosition.y + '%' 
                     }">
                  <div class="vehicle-dot" :class="{ 'disconnected': !vehicleConnected }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import Toast from '@/utils/toast.js'
import { parseVehicleId, compareVehicleId } from '@/utils/vehicleTypes.js'
import eventBus, { EVENTS } from '@/utils/eventBus.js'
import { useCarStore } from '@/stores/car.js'
import { videoStreamManager } from '@/utils/videoStreamManager.js'
import { vehicleToMapPercent } from '@/utils/coordinateTransform.js'
import TitleBar from '@/components/TitleBar.vue'

const router = useRouter()
const route = useRoute()
const carStore = useCarStore()
const appTitle = ref('渡众智能沙盘云控平台')

const deriveVehicleId = () => {
  const queryId = parseVehicleId(route.query.vehicleId)
  if (queryId) {
    return queryId
  }
  if (carStore.selectedCarId) {
    return parseVehicleId(carStore.selectedCarId)
  }
  if (Array.isArray(carStore.carList) && carStore.carList.length) {
    const candidate = carStore.carList[0]
    if (candidate?.vehicleId) {
      return parseVehicleId(candidate.vehicleId)
    }
  }
  if (Array.isArray(carStore.defaultCarList) && carStore.defaultCarList.length) {
    const candidate = carStore.defaultCarList[0]
    if (candidate?.vehicleId) {
      return parseVehicleId(candidate.vehicleId)
    }
  }
  return 1
}

const currentVehicleId = ref(deriveVehicleId())
const currentRouteName = computed(() => router.currentRoute.value?.name)
const isRouteVisible = computed(() => currentRouteName.value === 'ParallelDriving')

const videoSrc = ref('')
const lastFrameTime = ref(0)
const frameRate = ref(0)
const vehicleConnected = ref(false)

const currentSpeed = ref(0)
const steeringAngle = ref(0)
const batteryLevel = ref(0)
const currentGear = ref('P')
const vehicleCoords = ref({ x: 2.405, y: 1.405 })

// 位置地图坐标转换
// 使用封装的坐标转换函数将车辆坐标转换为地图上的百分比位置
const vehiclePosition = computed(() => {
  return vehicleToMapPercent(vehicleCoords.value.x, vehicleCoords.value.y)
})

const displaySpeed = computed(() => {
  const numSpeed = Number(currentSpeed.value)
  if (numSpeed === 0) {
    return '0'
  }
  return numSpeed.toFixed(2)
})

const resetVideoState = () => {
  if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
    URL.revokeObjectURL(videoSrc.value)
  }
  videoSrc.value = ''
  lastFrameTime.value = 0
  frameRate.value = 0
}

const updateVideoSubscription = () => {
  if (isRouteVisible.value) {
    videoStreamManager.subscribe(currentVehicleId.value, handleVideoFrame)
  } else {
    videoStreamManager.unsubscribe(currentVehicleId.value, handleVideoFrame)
    resetVideoState()
  }
}

const handleVideoFrame = ({ blobUrl, timeout, frame, stats, fps }) => {
  if (timeout) {
    resetVideoState()
    return
  }

  if (typeof blobUrl !== 'string') {
    return
  }

  const targetId = currentVehicleId.value
  if (frame?.vehicle_id && !compareVehicleId(frame.vehicle_id, targetId)) {
    URL.revokeObjectURL(blobUrl)
    return
  }
  
  if (frame?.vehicleId && !compareVehicleId(frame.vehicleId, targetId)) {
    URL.revokeObjectURL(blobUrl)
    return
  }

  if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
    URL.revokeObjectURL(videoSrc.value)
  }
  
  videoSrc.value = blobUrl
  lastFrameTime.value = Date.now()
  if (typeof fps === 'number') {
    frameRate.value = Math.max(0, Math.round(fps))
  } else if (stats?.fps) {
    frameRate.value = Math.max(0, Math.round(stats.fps))
  }
}

const handleVehicleInfoUpdate = (payload) => {
  const detail = payload?.detail ?? payload
  if (!detail) {
    return
  }
  
  const targetId = currentVehicleId.value
  if (!compareVehicleId(detail.vehicleId, targetId) && !compareVehicleId(detail.carId, targetId)) {
    return
  }
  vehicleConnected.value = true
  if (typeof detail.speed === 'number') {
    currentSpeed.value = Math.max(0, Math.min(1, detail.speed))
  }
  if (typeof detail.steeringAngle === 'number') {
    steeringAngle.value = Math.max(-540, Math.min(540, detail.steeringAngle))
  }
  if (typeof detail.battery === 'number') {
    batteryLevel.value = Math.max(0, Math.min(100, Math.round(detail.battery)))
  }
  const gear = detail.gear ?? 'P'
  currentGear.value = typeof gear === 'string' ? gear : String(gear)
  if (detail.position?.x !== undefined && detail.position?.y !== undefined) {
    // detail.position 已经包含了偏移（在car.js的store中已处理）
    vehicleCoords.value = { 
      x: detail.position.x, 
      y: detail.position.y 
    }
  }
}

const handleVehicleConnectionStatus = (payload) => {
  const detail = payload?.detail ?? payload
  if (!detail) {
    return
  }
  const targetId = currentVehicleId.value
  if (!compareVehicleId(detail.carId, targetId)) {
    return
  }
  vehicleConnected.value = Boolean(detail?.isConnected)
  if (!vehicleConnected.value) {
    currentSpeed.value = 0
    steeringAngle.value = 0
    batteryLevel.value = 0
    currentGear.value = 'P'
  }
}

watch(isRouteVisible, updateVideoSubscription)
watch(() => carStore.selectedCarId, (newId) => {
  const parsedId = parseVehicleId(newId)
  if (parsedId && parsedId !== currentVehicleId.value) {
    currentVehicleId.value = parsedId
  }
})

watch(currentVehicleId, (vehicleId, prevVehicleId) => {
  if (prevVehicleId !== undefined) {
    videoStreamManager.unsubscribe(prevVehicleId, handleVideoFrame)
  }
  resetVideoState()
  if (isRouteVisible.value) {
    videoStreamManager.subscribe(vehicleId, handleVideoFrame)
  }
  eventBus.emit(EVENTS.REQUEST_VEHICLE_STATUS, { vehicleId })
})

onMounted(() => {
  updateVideoSubscription()
  eventBus.on(EVENTS.VEHICLE_INFO_UPDATE, handleVehicleInfoUpdate)
  eventBus.on(EVENTS.VEHICLE_CONNECTION_STATUS, handleVehicleConnectionStatus)
  eventBus.emit(EVENTS.REQUEST_VEHICLE_STATUS, { vehicleId: currentVehicleId.value })
})

onBeforeUnmount(() => {
  videoStreamManager.unsubscribe(currentVehicleId.value, handleVideoFrame)
  eventBus.off(EVENTS.VEHICLE_INFO_UPDATE, handleVehicleInfoUpdate)
  eventBus.off(EVENTS.VEHICLE_CONNECTION_STATUS, handleVehicleConnectionStatus)
})

// 返回主界面
const goBack = async () => {
  try {
    // 发送退出平行驾驶指令到沙盘
    const vehicleId = Number(currentVehicleId.value ?? 1)
    if (Number.isNaN(vehicleId)) {
      Toast.error('无效的车辆ID')
      return
    }
    
    await invoke('send_sandbox_exit_control', { vehicleId: vehicleId })
    Toast.success('已发送退出平行驾驶指令')
    
  } catch (e) {
    console.error('发送退出平行驾驶指令失败:', e)
    Toast.error(`发送退出指令失败: ${e}`)
  } finally {
    // 无论发送是否成功，都返回主界面（路由守卫会自动处理渲染恢复）
    router.push('/')
  }
}
</script>

<style lang="scss" scoped>
.parallel-driving-page {
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at center, 
      rgba(0, 20, 40, 0.95) 0%, 
      rgba(0, 10, 25, 0.98) 50%, 
      rgba(0, 5, 15, 1) 100%
  );
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  
  /* 左右边框效果 - 与主界面保持一致 */
  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(0, 240, 255, 0.3) 10%,
      rgba(0, 240, 255, 0.6) 50%,
      rgba(0, 240, 255, 0.3) 90%,
      transparent 100%
    );
    z-index: 1000;
    pointer-events: none;
  }
  
  &::before {
    left: 0;
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
  }
  
  &::after {
    right: 0;
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
  }
}

/* 标题栏样式 - 与主界面Header.vue保持一致 */
.header {
  position: relative;
  z-index: 99;
  height: 60px;
  width: 100%;
  background: url('/Image/header2.png') no-repeat center;
  background-size: cover;
  color: #fff;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
  margin-top: 30px; /* 为自定义标题栏留出空间 */
  margin-bottom: 0;
  overflow: visible !important;
  border: none;
  box-shadow: none;
  
  /* 禁用窗口拖动（由自定义标题栏处理） */
  -webkit-app-region: no-drag;
}

/* 菜单导航栏 - 与主界面保持一致 */
.nav-section {
  width: 100%;
  padding: 10px 0;
  background: rgb(0, 15, 30) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  display: flex !important;
  justify-content: center;
  align-items: center;
  margin-top: -2px;
  border-bottom: 1px solid rgba(0, 240, 255, 0.3);
  min-height: 60px;
  z-index: 900;
  position: relative;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  
  /* 启用窗口拖动 */
  -webkit-app-region: drag;
}

.nav-tabs {
  display: flex !important;
  gap: 8px;
  justify-content: center;
  align-items: center;
  min-height: 40px;
  width: 100%;
  
  /* 禁用拖动以允许点击 */
  -webkit-app-region: no-drag;
}

.nav-indicator {
  display: flex !important;
  align-items: center;
  gap: 10px;
  padding: 8px 24px;
  border-radius: 8px;
  background: rgba(0, 240, 255, 0.1);
  color: #00f0ff;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid rgba(0, 240, 255, 0.3);
  text-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
  pointer-events: none;
}

/* 标题区域样式 */
.title-section {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  
  /* 禁用拖动以允许点击 */
  -webkit-app-region: no-drag;
}

.title-text {
  line-height: 1.2;
  font-size: 25px;
  letter-spacing: 2px;
  font-weight: 600;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0, 240, 255, 0.8);
  white-space: nowrap;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  transform: translateY(8px);
}

/* 左侧区域样式 */
.left-section {
  display: flex;
  align-items: center;
  gap: 15px;
  width: 150px;
  flex-shrink: 0;
  
  /* 禁用拖动以允许点击 */
  -webkit-app-region: no-drag;
}

/* 右侧占位区域 */
.right-section {
  width: 150px;
  flex-shrink: 0;
}

.placeholder-section {
  width: 150px;
  flex-shrink: 0;
}

/* 返回按钮样式 - 白色箭头 */
.back-btn.notification-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgb(0, 15, 30) !important;
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  cursor: pointer;
  -webkit-app-region: no-drag; /* 确保按钮可点击 */
  transition: all 0.3s ease;
  font-weight: 800;
  font-size: 20px;
  font-style: normal;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}

.back-btn.notification-btn:hover {
  background: rgba(0, 240, 255, 0.2);
  color: #ffffff;
  border-color: rgba(0, 240, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
}

/* 主内容区域 */
.main-content {
  flex: 1;
  display: flex;
  gap: 20px;
  padding: 20px;
  overflow: hidden;
  min-height: 0;
}

/* 左侧摄像头区域 */
.video-panel {
  flex: 3;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.video-container {
  flex: 1;
  background: rgb(0, 15, 30) !important;
  border: 2px solid rgba(0, 240, 255, 0.3);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  z-index: 1;
}

.video-frame {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000000;
}

.video-placeholder {
  text-align: center;
  color: #94a3b8;
}

.video-icon {
  font-size: 80px;
  color: #00f0ff;
  margin-bottom: 40px;
  text-shadow: 0 0 20px rgba(0, 240, 255, 0.5);
}

.video-status-text {
  font-size: 20px;
  margin-bottom: 16px;
  color: #ffffff;
}

.connection-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 16px;
  color: #ff6b6b;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff6b6b;
  animation: pulse 2s infinite;
}

.status-dot.online {
  background: #00ff00;
  animation: none;
}

.video-stream {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.video-overlay {
  position: absolute;
  top: 16px;
  left: 16px;
  background: rgb(0, 0, 0) !important;
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-family: 'Orbitron', monospace;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 右侧仪表盘区域 */
.dashboard-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  min-height: 0;
}

.instrument-card {
  background: rgb(0, 15, 30) !important;
  border-radius: 8px !important;
  padding: 8px !important;
  box-shadow: 
    0 0 0 2px rgb(0, 240, 255),
    0 4px 16px rgba(0, 0, 0, 0.3) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  display: flex !important;
  flex-direction: column !important;
  flex-shrink: 1;
  min-height: 0;
}

.instrument-card.small {
  flex: 0 0 auto;
  min-height: 0;
}

.instrument-card.map-card {
  flex: 1 1 auto;
  min-height: 0;
}

.instrument-title {
  text-align: center;
  font-size: 14px;
  font-weight: bold;
  color: #00f0ff;
  margin-bottom: 10px;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.5);
}

/* 地图头部布局 */
.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.map-header .instrument-title {
  margin-bottom: 0;
  text-align: left;
  flex: 1;
}

.map-coordinates-header {
  font-size: 11px;
  color: #ffffff;
  font-family: 'Orbitron', monospace;
  background: rgb(0, 0, 0) !important;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid rgba(0, 240, 255, 0.3);
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  white-space: nowrap;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}

/* 速度仪表盘 - Dashboard样式 */
.dashboard-wrap {
  flex-grow: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.center {
  display: flex;
  justify-content: center;
  align-items: center;
}

.out-circle {
  min-width: 100px;
  min-height: 100px;
  border-radius: 50%;
  perspective: 500px;
  transform-style: preserve-3d;
  position: relative;
}

.out-circle_rotate::after {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  content: '';
  border: 1px solid #39485b;
  background-image: conic-gradient(
    from 46deg at 50% 50%,
    transparent,
    #24b8ee90 20%,
    #70ffae31 27%,
    transparent 17%
  );
  border-right: 2px #24ddee solid;
  animation: rotate 3s linear infinite;
}

@keyframes rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.scend {
  position: absolute;
  top: 50%;
  left: 50%;
  height: 50%;
  width: 1px;
  border-bottom: 6px solid #39485b;
  transform-origin: top center;
  transform: rotate(calc(var(--i) * 6deg));
  transition: all 0.3s ease-in-out;
}

.scend_active {
  width: 4px;
  border-bottom: 10px solid var(--primary);
}

.inner-circle {
  width: 80px;
  height: 80px;
  position: absolute;
  z-index: 9;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  box-shadow: #24b8ee90 0px 0px 20px inset;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.speed {
  color: rgb(255, 255, 255);
  font-size: 22px;
  font-weight: 700;
  font-family: 'Orbitron', sans-serif !important;
  text-shadow:
    0px 1px 0px #17c0ff,
    0px 2px 0px #17c0ff,
    0px 3px 0px #17c0ff,
    0px 4px 0px #17c0ff,
    0px 5px 10px rgba(23, 192, 255, 0.5);
}

.unit {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

/* 方向盘 */
.steering-wheel {
  text-align: center;
}

.wheel-container {
  width: 85px;
  height: 85px;
  margin: 0 auto 6px;
  position: relative;
}

.wheel {
  width: 100%;
  height: 100%;
  transition: transform 0.2s ease;
}

.wheel-svg {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgba(0, 240, 255, 0.3));
}

.steering-angle {
  text-align: center;
  font-size: 14px;
  color: #ffffff;
  font-weight: bold;
  margin-top: 4px;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.8);
}

/* 电池和档位行 */
.battery-gear-row {
  display: flex;
  gap: 16px;
  flex: 0 0 auto;
}

/* 手动绘制的卡片 - 用div模拟边框 */
.manual-card {
  flex: 0 0 auto;
  position: relative;
  padding: 8px;
  border-radius: 8px;
  overflow: hidden;
}

/* 电池和档位在行内平分宽度 */
.battery-gear-row .manual-card {
  flex: 1 1 0;
}

.manual-card.map-card-manual {
  flex: 1 1 auto;
  min-height: 0;
}

.manual-card-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgb(0, 15, 30);
  border-radius: 8px;
  z-index: 1;
}

.manual-card-border {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 8px;
  background: 
    linear-gradient(rgba(0, 240, 255, 0.3), rgba(0, 240, 255, 0.3)) top left / 100% 2px no-repeat,
    linear-gradient(rgba(0, 240, 255, 0.3), rgba(0, 240, 255, 0.3)) top right / 2px 100% no-repeat,
    linear-gradient(rgba(0, 240, 255, 0.3), rgba(0, 240, 255, 0.3)) bottom left / 100% 2px no-repeat,
    linear-gradient(rgba(0, 240, 255, 0.3), rgba(0, 240, 255, 0.3)) top left / 2px 100% no-repeat;
  z-index: 2;
  pointer-events: none;
}

.manual-card-content {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 电池和档位内容包装器 */
.battery-content-wrapper,
.gear-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

/* 电池样式 - 主要使用内联样式 */
.battery-text {
  font-size: 16px;
  font-weight: bold;
  color: #ffffff;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.8);
}

/* 档位样式 */
.gear-box {
  width: 50px;
  height: 50px;
  background: rgb(0, 0, 0);
  box-shadow: 0 0 0 2px rgb(0, 240, 255);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: bold;
  color: #00ff00;
  text-shadow: 0 0 12px rgba(0, 255, 0, 0.8);
}

/* 小地图 */
.minimap {
  width: 100%;
  height: 100%;
  position: relative;
}

.map-background {
  width: 100%;
  height: calc(100% - 30px);
  position: relative;
  border: 2px solid rgba(0, 240, 255, 0.3);
  border-radius: 8px;
  overflow: hidden;
  background: #000000;
}

.map-image {
  width: 100%;
  height: 100%;
  object-fit: fill;
  opacity: 0.8;
}

.vehicle-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 2;
}

.vehicle-dot {
  width: 12px;
  height: 12px;
  background: #ff4757;
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 0 12px rgba(255, 71, 87, 0.8);
  animation: vehiclePulse 2s infinite;
}


@keyframes vehiclePulse {
  0%, 100% { 
    transform: scale(1);
    box-shadow: 0 0 12px rgba(255, 71, 87, 0.8);
  }
  50% { 
    transform: scale(1.2);
    box-shadow: 0 0 20px rgba(255, 71, 87, 1);
  }
}


/* 响应式设计 - 与主界面Header.vue保持一致 */
@media (max-width: 1400px) {
  .title-text {
    font-size: 22px;
    letter-spacing: 1.5px;
  }
}

@media (max-width: 1200px) {
  .title-text {
    font-size: 20px;
    letter-spacing: 1px;
  }
}

@media (max-width: 900px) {
  .title-text {
    font-size: 18px;
  }
  
  .back-btn.notification-btn {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }
  
  .content-placeholder h2 {
    font-size: 24px;
  }
  
  .placeholder-icon {
    font-size: 48px;
  }
}

@media (max-width: 768px) {
  .header {
    padding: 0 20px;
  }
  
  .content-placeholder h2 {
    font-size: 20px;
  }
  
  .placeholder-icon {
    font-size: 40px;
  }
}

/* 连接状态指示器样式 */
.connection-indicator {
  margin-left: 8px;
  font-size: 8px;
}

.connection-indicator.connected {
  color: #10b981;
  animation: pulse-green 2s infinite;
}

.connection-indicator.disconnected {
  color: #ef4444;
  animation: pulse-red 2s infinite;
}

.disconnected-text {
  color: #ef4444;
  font-size: 12px;
  margin-left: 8px;
  opacity: 0.8;
}

@keyframes pulse-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes pulse-red {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* 车辆标记断开连接样式 */
.vehicle-marker.disconnected {
  opacity: 0.6;
}

.vehicle-dot.disconnected {
  background: linear-gradient(135deg, #6b7280, #9ca3af);
  border: 2px solid #ef4444;
  animation: pulse-disconnected 2s infinite;
}

@keyframes pulse-disconnected {
  0%, 100% { 
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.6;
  }
  50% { 
    transform: translate(-50%, -50%) scale(1.1);
    opacity: 0.3;
  }
}
</style>
