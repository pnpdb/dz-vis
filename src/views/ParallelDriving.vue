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
        <div class="instrument-card">
          <div class="instrument-title">车速</div>
          <div class="speedometer">
            <div class="speedometer-circle">
              <div class="speed-gradient-arc"></div>
              <div class="speed-needle" :style="{ transform: `rotate(${speedAngle}deg)` }"></div>
              <div class="speed-center">
                <div class="speed-value">{{ displaySpeed }}</div>
                <div class="speed-unit">速度</div>
              </div>
            </div>
            <div class="speed-scale">
              <div v-for="mark in speedMarks" :key="mark.value" 
                   class="speed-mark" 
                   :style="{ transform: `rotate(${mark.angle}deg)` }">
                <div class="mark-line"></div>
                <div class="mark-text">{{ mark.value }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 方向盘 -->
        <div class="instrument-card">
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

        <!-- 电池和档位 -->
        <div class="battery-gear-row">
          <!-- 电池电量 -->
          <div class="instrument-card small">
            <div class="instrument-title">电池电量</div>
            <div class="battery-display">
              <div class="battery-shell">
                <div class="battery-fill" :style="{ width: batteryLevel + '%' }"></div>
                <div class="battery-tip"></div>
              </div>
              <div class="battery-percentage">{{ batteryLevel }}%</div>
            </div>
          </div>

          <!-- 档位 -->
          <div class="instrument-card small">
            <div class="instrument-title">档位</div>
            <div class="gear-display">
              <div class="gear-indicator">{{ currentGear }}</div>
            </div>
          </div>
        </div>

        <!-- 位置地图 -->
        <div class="instrument-card map-card">
          <div class="map-header">
            <div class="instrument-title">
              位置地图
              <span class="connection-indicator" :class="{ connected: vehicleConnected, disconnected: !vehicleConnected }">
                <fa :icon="vehicleConnected ? 'circle' : 'times-circle'" />
              </span>
            </div>
            <div class="map-coordinates-header">
              [X: {{ vehicleCoords.x.toFixed(1) }}, Y: {{ vehicleCoords.y.toFixed(1) }}]
              <span v-if="!vehicleConnected" class="disconnected-text">(断开连接)</span>
            </div>
          </div>
          <div class="minimap">
            <div class="map-background">
              <img src="/Image/map.jpg" alt="地图" class="map-image" />
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
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { ElMessage } from 'element-plus'
import { parseVehicleId, compareVehicleId } from '@/utils/vehicleTypes.js'
import eventBus, { EVENTS } from '@/utils/eventBus.js'
import { useCarStore } from '@/stores/car.js'
import { videoStreamManager } from '@/utils/videoStreamManager.js'
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
const vehicleCoords = ref({ x: 540, y: 392.5 })
const vehiclePosition = computed(() => {
  const mapWidth = 1080
  const mapHeight = 785
  return {
    x: (vehicleCoords.value.x / mapWidth) * 100,
    y: 100 - (vehicleCoords.value.y / mapHeight) * 100,
  }
})

const displaySpeed = computed(() => currentSpeed.value.toFixed(2))
const speedAngle = computed(() => {
  const maxSpeed = 1
  const minAngle = -135
  const maxAngle = 135
  return minAngle + Math.min(currentSpeed.value, maxSpeed) * (maxAngle - minAngle)
})

const speedMarks = [
  { value: '0.0', angle: -135 },
  { value: '0.2', angle: -81 },
  { value: '0.4', angle: -27 },
  { value: '0.6', angle: 27 },
  { value: '0.8', angle: 81 },
  { value: '1.0', angle: 135 },
]

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
    vehicleCoords.value = { x: detail.position.x, y: detail.position.y }
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
      ElMessage.error('无效的车辆ID')
      return
    }
    
    await invoke('send_sandbox_exit_control', { vehicleId: vehicleId })
    ElMessage.success('已发送退出平行驾驶指令')
    
  } catch (e) {
    console.error('发送退出平行驾驶指令失败:', e)
    ElMessage.error(`发送退出指令失败: ${e}`)
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
  background: rgba(0, 15, 30, 0.6);
  backdrop-filter: blur(10px);
  display: flex !important;
  justify-content: center;
  align-items: center;
  margin-top: -2px;
  border-bottom: 1px solid rgba(0, 240, 255, 0.3);
  min-height: 60px;
  z-index: 900;
  position: relative;
  
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
  background: rgba(0, 15, 30, 0.8);
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
  backdrop-filter: blur(10px);
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
}

/* 左侧摄像头区域 */
.video-panel {
  flex: 3;
  display: flex;
  flex-direction: column;
}

.video-container {
  flex: 1;
  background: rgba(0, 15, 30, 0.8);
  border: 2px solid rgba(0, 240, 255, 0.3);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
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
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-family: 'Orbitron', monospace;
  backdrop-filter: blur(4px);
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
  overflow-y: auto;
}

.instrument-card {
  background: rgba(0, 15, 30, 0.85);
  border: 2px solid rgba(0, 240, 255, 0.3);
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.instrument-card.small {
  flex: 1;
}

.instrument-card.map-card {
  flex: 2;
  min-height: 250px;
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
  background: rgba(0, 0, 0, 0.6);
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid rgba(0, 240, 255, 0.3);
  backdrop-filter: blur(4px);
  white-space: nowrap;
}

/* 速度仪表盘 */
.speedometer {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto;
}

.speedometer-circle {
  width: 100%;
  height: 100%;
  border: 3px solid rgba(0, 240, 255, 0.3);
  border-radius: 50%;
  position: relative;
  background: radial-gradient(circle, rgba(0, 15, 30, 0.8) 0%, rgba(0, 50, 100, 0.2) 100%);
}

.speed-gradient-arc {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 90%;
  height: 90%;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: conic-gradient(
    from 225deg,
    transparent 0deg,
    #00ff00 0deg,
    #66ff00 60deg,
    #ffff00 120deg,
    #ff9900 180deg,
    #ff4400 240deg,
    #ff0000 270deg,
    transparent 270deg
  );
  mask: radial-gradient(circle, transparent 65%, black 65%, black 85%, transparent 85%);
  -webkit-mask: radial-gradient(circle, transparent 65%, black 65%, black 85%, transparent 85%);
  opacity: 0.8;
  z-index: 1;
}

.speed-needle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 50px;
  background: linear-gradient(180deg, #ff4757, #00f0ff);
  transform-origin: bottom center;
  margin-left: -1px;
  margin-top: -50px;
  border-radius: 1px;
  transition: transform 0.3s ease;
  box-shadow: 0 0 8px rgba(255, 71, 87, 0.6);
  z-index: 3;
}

.speed-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 2;
}

.speed-value {
  font-size: 24px;
  font-weight: bold;
  color: #ffffff;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.8);
}

.speed-unit {
  font-size: 12px;
  color: #94a3b8;
}

.speed-scale {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.speed-mark {
  position: absolute;
  top: 10px;
  left: 50%;
  transform-origin: 50% 60px;
  margin-left: -1px;
}

.mark-line {
  width: 2px;
  height: 8px;
  background: rgba(0, 240, 255, 0.6);
  margin: 0 auto;
}

.mark-text {
  font-size: 10px;
  color: #94a3b8;
  text-align: center;
  margin-top: 2px;
}

/* 方向盘 */
.steering-wheel {
  text-align: center;
}

.wheel-container {
  width: 100px;
  height: 100px;
  margin: 0 auto 8px;
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
  font-size: 16px;
  color: #ffffff;
  font-weight: bold;
  margin-top: 8px;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.8);
}

/* 电池和档位行 */
.battery-gear-row {
  display: flex;
  gap: 16px;
}

/* 电池显示 */
.battery-display {
  text-align: center;
}

.battery-shell {
  width: 80px;
  height: 36px;
  border: 2px solid rgba(0, 240, 255, 0.6);
  border-radius: 4px;
  position: relative;
  margin: 0 auto 8px;
  background: rgba(0, 15, 30, 0.8);
}

.battery-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff4757 0%, #ffa726 50%, #66bb6a 100%);
  border-radius: 2px;
  transition: width 0.5s ease;
  position: relative;
}

.battery-tip {
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 16px;
  background: rgba(0, 240, 255, 0.6);
  border-radius: 0 2px 2px 0;
}

.battery-percentage {
  font-size: 16px;
  font-weight: bold;
  color: #ffffff;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.8);
}

/* 档位显示 */
.gear-display {
  text-align: center;
}

.gear-indicator {
  width: 60px;
  height: 60px;
  margin: 0 auto;
  background: rgba(0, 50, 100, 0.4);
  border: 3px solid #00f0ff;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
  color: #00ff00;
  text-shadow: 0 0 12px rgba(0, 255, 0, 0.8);
  box-shadow: 
    inset 0 0 20px rgba(0, 240, 255, 0.2),
    0 0 20px rgba(0, 240, 255, 0.3);
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
  object-fit: contain; /* 保持宽高比，完整显示，两侧可能有空隙 */
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
