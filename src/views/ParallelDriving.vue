<template>
  <div class="parallel-driving-page">
    <!-- 标题栏 - 与主界面保持一致 -->
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
            <div class="instrument-title">位置地图</div>
            <div class="map-coordinates-header">
              [X: {{ vehicleCoords.x.toFixed(1) }}, Y: {{ vehicleCoords.y.toFixed(1) }}]
            </div>
          </div>
          <div class="minimap">
            <div class="map-background">
              <img src="/Image/map.jpg" alt="地图" class="map-image" />
              <div class="vehicle-marker" 
                   :style="{ 
                     left: vehiclePosition.x + '%', 
                     top: vehiclePosition.y + '%' 
                   }">
                <div class="vehicle-dot"></div>
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
import { listen } from '@tauri-apps/api/event'
import { debug as plDebug, info as plInfo, warn as plWarn, error as plError } from '@tauri-apps/plugin-log'

const router = useRouter()
const route = useRoute()
const appTitle = ref('渡众智能沙盘云控平台')

// 从路由参数获取车辆ID
const currentVehicleId = ref(parseInt(route.query.vehicleId) || 1)

// 仪表盘数据
const currentSpeed = ref(0) // 当前速度 0-1 (协议原始值)
const steeringAngle = ref(0) // 方向盘角度 度
const batteryLevel = ref(85) // 电池电量百分比
const currentGear = ref('P') // 当前档位
const vehicleCoords = ref({ x: 2.95, y: 2.2 }) // 车辆坐标(米)

// 摄像头相关
const videoSrc = ref('')
const cameraConnected = ref(false)
const lastFrameTime = ref(0)
const frameRate = ref(0)
const frameCount = ref(0)
const lastFrameCountTime = ref(Date.now())
const videoImg = ref(null)

// 事件监听器
let unlistenVideoFrame = null
let frameRateTimer = null
let videoTimeoutTimer = null

// 视频流超时时间（毫秒）
const VIDEO_TIMEOUT = 3000

// 计算属性
const displaySpeed = computed(() => {
  // 显示协议原始值：0-1范围，保留2位小数
  return currentSpeed.value.toFixed(2)
})

const speedAngle = computed(() => {
  // 速度仪表盘角度：0-1 对应 -135 到 135 度
  const maxSpeed = 1.0
  const minAngle = -135
  const maxAngle = 135
  const speed = Math.min(currentSpeed.value, maxSpeed)
  return minAngle + (speed / maxSpeed) * (maxAngle - minAngle)
})

const speedMarks = computed(() => {
  const marks = []
  for (let i = 0; i <= 10; i += 2) {
    const value = i / 10 // 0, 0.2, 0.4, 0.6, 0.8, 1.0
    const angle = -135 + (value / 1.0) * 270
    marks.push({ value: value.toFixed(1), angle })
  }
  return marks
})

const vehiclePosition = computed(() => {
  // 将车辆坐标转换为地图上的百分比位置
  // 地图像素尺寸：1080x785，左下角为(0,0)，右上角为(1080,785)
  // X: 0-1080 (向右为正), Y: 0-785 (向上为正)
  const mapWidth = 1080
  const mapHeight = 785
  return {
    x: (vehicleCoords.value.x / mapWidth) * 100, // X坐标百分比
    y: 100 - (vehicleCoords.value.y / mapHeight) * 100 // Y坐标百分比（翻转，因为CSS从上开始）
  }
})

// 档位映射
const gearMap = {
  1: 'P',
  2: 'R', 
  3: 'N',
  4: 'D'
}

// 处理车辆信息更新事件
const handleVehicleInfoUpdate = (event) => {
  const vehicleInfo = event.detail
  
  // 检查是否是当前车辆的数据
  if (vehicleInfo.vehicleId !== currentVehicleId.value && vehicleInfo.carId !== currentVehicleId.value) {
    return
  }
  
  // 更新仪表盘数据
  currentSpeed.value = vehicleInfo.speed // 0-1范围
  steeringAngle.value = vehicleInfo.steeringAngle // 方向盘角度
  batteryLevel.value = Math.round(vehicleInfo.battery) // 电池电量整数
  currentGear.value = gearMap[vehicleInfo.gear] || 'P' // 档位映射
  vehicleCoords.value = {
    x: vehicleInfo.position.x,
    y: vehicleInfo.position.y
  }
  
  console.debug(`🚗 平行驾驶界面更新车辆${currentVehicleId.value}数据:`, {
    speed: displaySpeed.value,
    steering: steeringAngle.value,
    battery: batteryLevel.value,
    gear: currentGear.value,
    position: vehicleCoords.value
  })
}

// 启动视频接收器
const startVideoReceiver = async () => {
  try {
    // 启动UDP视频服务器（如果尚未启动）
    await invoke('start_udp_video_server', { port: 8080 })
    
    // 监听UDP视频帧事件
    if (!unlistenVideoFrame) {
      unlistenVideoFrame = await listen('udp-video-frame', (event) => {
        handleVideoFrame(event.payload)
      })
    }
    
    // 启动帧率计算器
    startFrameRateCalculator()
    
    console.debug(`📹 平行驾驶界面启动视频接收器，车辆ID: ${currentVehicleId.value}`)
  } catch (error) {
    try { await plError(`启动UDP视频接收器失败: ${error}`) } catch (_) {}
  }
}

// 停止视频接收器
const stopVideoReceiver = () => {
  if (unlistenVideoFrame) {
    unlistenVideoFrame()
    unlistenVideoFrame = null
  }
  
  if (frameRateTimer) {
    clearInterval(frameRateTimer)
    frameRateTimer = null
  }
  
  if (videoTimeoutTimer) {
    clearTimeout(videoTimeoutTimer)
    videoTimeoutTimer = null
  }
  
  // 清理blob URL
  if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
    URL.revokeObjectURL(videoSrc.value)
  }
  
  videoSrc.value = ''
  lastFrameTime.value = 0
  frameRate.value = 0
  frameCount.value = 0
  cameraConnected.value = false
}

// 处理接收到的视频帧
const handleVideoFrame = (frame) => {
  // 检查是否是当前选中的车辆
  if (frame.vehicle_id !== currentVehicleId.value) {
    return // 不是当前车辆的视频，忽略
  }
  
  // 验证数据有效性
  if (!frame.jpeg_data || frame.jpeg_data.length === 0) {
    return
  }
  
  try {
    // 验证Base64数据格式
    if (!/^[A-Za-z0-9+/]+=*$/.test(frame.jpeg_data)) {
      try { plWarn('UDP视频帧Base64校验失败').catch(() => {}) } catch (_) {}
      return
    }
    
    // 更高效的Base64解码
    const binaryString = atob(frame.jpeg_data)
    const uint8Array = Uint8Array.from(binaryString, char => char.charCodeAt(0))
    
    // 验证JPEG文件头
    if (uint8Array.length >= 2 && uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) {
      // 创建Blob URL
      const blob = new Blob([uint8Array], { type: 'image/jpeg' })
      
      // 清理之前的blob URL
      if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
        URL.revokeObjectURL(videoSrc.value)
      }
      
      videoSrc.value = URL.createObjectURL(blob)
      lastFrameTime.value = Date.now()
      frameCount.value++
      cameraConnected.value = true
      
      // 重置超时检查
      checkVideoTimeout()
    }
  } catch (error) {
    try { plError(`处理UDP视频帧失败: ${error}`).catch(() => {}) } catch (_) {}
  }
}

// 启动帧率计算器
const startFrameRateCalculator = () => {
  if (frameRateTimer) {
    clearInterval(frameRateTimer)
  }
  
  frameRateTimer = setInterval(() => {
    const now = Date.now()
    const timeDiff = now - lastFrameCountTime.value
    
    if (timeDiff >= 1000) { // 每秒计算一次
      frameRate.value = Math.round((frameCount.value * 1000) / timeDiff)
      frameCount.value = 0
      lastFrameCountTime.value = now
    }
  }, 1000)
}

// 检查视频流超时
const checkVideoTimeout = () => {
  if (videoTimeoutTimer) {
    clearTimeout(videoTimeoutTimer)
  }
  
  videoTimeoutTimer = setTimeout(() => {
    if (videoSrc.value) {
      videoSrc.value = ''
      lastFrameTime.value = 0
      frameRate.value = 0
      cameraConnected.value = false
    }
  }, VIDEO_TIMEOUT)
}

// 监听路由变化
watch(() => route.query.vehicleId, (newVehicleId) => {
  if (newVehicleId) {
    currentVehicleId.value = parseInt(newVehicleId)
    console.debug(`🔄 平行驾驶界面车辆切换: ${currentVehicleId.value}`)
  }
})

// 加载应用标题和初始化
onMounted(async () => {
  try {
    const res = await invoke('get_app_settings')
    if (res && res.app_title) {
      appTitle.value = res.app_title
    }
  } catch (error) {
    console.error('加载应用设置失败:', error)
  }
  
  // 监听车辆信息更新事件
  window.addEventListener('vehicle-info-update', handleVehicleInfoUpdate)
  
  // 启动视频接收器
  startVideoReceiver()
  
  console.debug(`🚗 平行驾驶界面初始化，车辆ID: ${currentVehicleId.value}`)
})

onBeforeUnmount(() => {
  // 清理事件监听器
  window.removeEventListener('vehicle-info-update', handleVehicleInfoUpdate)
  
  // 停止视频接收器
  stopVideoReceiver()
  
  console.debug('🚗 平行驾驶界面清理完成')
})

// 返回主界面
const goBack = () => {
  // 路由跳转回主界面（路由守卫会自动处理渲染恢复）
  router.push('/')
}
</script>

<style scoped>
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
  margin-bottom: 0;
  overflow: visible !important;
  border: none;
  box-shadow: none;
  
  /* 启用窗口拖动 */
  -webkit-app-region: drag;
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
</style>
