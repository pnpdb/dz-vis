<template>
        <div class="form-group camera-container-group">
            <div class="flex">
            <label class="form-label"><fa icon="camera" /> 车载摄像头</label>
            <el-switch
                :model-value="cameraEnabled"
                @change="toggleCamera"
                active-color="#13ce66"
                inactive-color="#ff4949"
            ></el-switch>
        </div>

        <div class="camera-preview" :class="{ 'has-video': cameraEnabled && videoSrc }">
            <!-- 双缓冲图片，避免闪烁 -->
            <img v-show="cameraEnabled && videoSrc" ref="videoImg" class="video-stream" alt="车载摄像头画面" />
            <div v-show="!cameraEnabled || !videoSrc">
            <fa icon="camera" class="camera-icon" />
                <div class="camera-desc">{{ cameraEnabled ? '等待视频信号...' : '摄像头已关闭' }}</div>
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
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useCarStore } from '@/stores/car.js'
import eventBus, { EVENTS } from '@/utils/eventBus.js'
import { videoStreamManager } from '@/utils/videoStreamManager.js'

const carStore = useCarStore()
const router = useRouter()

const videoSrc = ref('')
const lastFrameTime = ref(0)
const videoImg = ref(null)
const aspectRatio = ref(4 / 3)

const cameraEnabled = computed(() => carStore.cameraEnabled)
const currentRouteName = computed(() => router.currentRoute.value?.name)
const currentVehicleId = computed(() => carStore.selectedCarId)

const isRouteVisible = computed(() => currentRouteName.value === 'Cars')

let wasManualEnabledBeforeHide = null
let wasManualEnabledBeforeSwitch = null

const updateVideoReceiver = () => {
  if (cameraEnabled.value && isRouteVisible.value) {
    subscribeVideo()
  } else {
    unsubscribeVideo()
  }
}

const subscribeVideo = () => {
  videoStreamManager.subscribe(currentVehicleId.value, handleVideoFrame)
}

const unsubscribeVideo = () => {
  videoStreamManager.unsubscribe(currentVehicleId.value, handleVideoFrame)
  if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
    URL.revokeObjectURL(videoSrc.value)
  }
  videoSrc.value = ''
  lastFrameTime.value = 0
}

const handleVideoFrame = ({ blobUrl, frame }) => {
  const img = videoImg.value
  const targetVehicleId = Number(currentVehicleId.value)
  const frameVehicleId = Number(frame?.vehicle_id ?? frame?.vehicleId)

  if (!cameraEnabled.value || !isRouteVisible.value || !img || !blobUrl) {
    if (typeof blobUrl === 'string') {
      URL.revokeObjectURL(blobUrl)
    }
    return
  }

  if (Number.isFinite(frameVehicleId) && Number.isFinite(targetVehicleId) && frameVehicleId !== targetVehicleId) {
    URL.revokeObjectURL(blobUrl)
    return
  }

  if (videoSrc.value && videoSrc.value.startsWith('blob:')) {
    URL.revokeObjectURL(videoSrc.value)
  }

  videoSrc.value = blobUrl
  img.src = blobUrl
  lastFrameTime.value = Date.now()

  nextTick(() => {
    if (img.naturalWidth && img.naturalHeight) {
      aspectRatio.value = img.naturalWidth / img.naturalHeight
    }
  })
}

const toggleCamera = async () => {
  const vehicleId = currentVehicleId.value
  if (!vehicleId) {
    ElMessage.error('请先选择车辆')
    return
  }

  const willEnable = !carStore.cameraEnabled
  carStore.setCameraEnabled(willEnable)
  carStore.setManualCameraState(vehicleId, willEnable)

  try {
    await window.socketManager.toggleVehicleCamera(vehicleId, willEnable)
    if (!willEnable) {
      unsubscribeVideo()
    } else if (isRouteVisible.value) {
      subscribeVideo()
    }
  } catch (error) {
    carStore.setCameraEnabled(!willEnable)
    carStore.setManualCameraState(vehicleId, !willEnable)
    ElMessage.error(`摄像头开关操作失败: ${error}`)
  }
}

const handleTimeout = ({ vehicleId }) => {
  if (Number(vehicleId) === Number(currentVehicleId.value)) {
    videoSrc.value = ''
    lastFrameTime.value = 0
  }
}

const requestParallelDriving = () => {
  if (!currentVehicleId.value) {
    ElMessage.error('请先选择车辆')
    return
  }
  router.push({
    name: 'ParallelDriving',
    query: { vehicleId: currentVehicleId.value }
  })
}

watch(cameraEnabled, (enabled) => {
  if (enabled && isRouteVisible.value) {
    subscribeVideo()
  } else {
    unsubscribeVideo()
  }
})

watch(isRouteVisible, async (visible) => {
  const vehicleId = currentVehicleId.value
  if (!vehicleId) return

  if (!visible) {
    // 记录当前手动状态，用于恢复
    wasManualEnabledBeforeHide = carStore.isManualCameraEnabled(vehicleId)

    // 如果是进入平行驾驶，保持摄像头开启逻辑由路由统一处理
    if (router.currentRoute.value?.name === 'ParallelDriving') {
      unsubscribeVideo()
      return
    }

    unsubscribeVideo()

    if (wasManualEnabledBeforeHide) {
      try {
        await window.socketManager?.toggleVehicleCamera?.(vehicleId, false)
      } catch (error) {
        console.warn('隐藏摄像头区域时关闭摄像头失败:', error)
      }
    }
  } else {
    if (wasManualEnabledBeforeHide) {
      try {
        await window.socketManager?.toggleVehicleCamera?.(vehicleId, true)
        subscribeVideo()
      } catch (error) {
        console.warn('显示摄像头区域时开启摄像头失败:', error)
      }
    }
    wasManualEnabledBeforeHide = null
  }
})

watch(currentVehicleId, async (newVehicleId, oldVehicleId) => {
  if (oldVehicleId) {
    wasManualEnabledBeforeSwitch = carStore.isManualCameraEnabled(oldVehicleId)
    unsubscribeVideo()

    if (router.currentRoute.value?.name !== 'ParallelDriving') {
      try {
        await window.socketManager.toggleVehicleCamera(oldVehicleId, false)
      } catch (error) {
        console.warn('切换车辆时关闭旧车辆摄像头失败:', error)
      }
    }
  }

  if (!newVehicleId) {
    carStore.setCameraEnabled(false)
    return
  }

  const manualEnabled = carStore.isManualCameraEnabled(newVehicleId)
  carStore.setCameraEnabled(manualEnabled)

  const currentRoute = router.currentRoute.value?.name
  const routeVisible = currentRoute === 'Cars'

  if (routeVisible && manualEnabled) {
    try {
      await window.socketManager.toggleVehicleCamera(newVehicleId, true)
      subscribeVideo()
    } catch (error) {
      console.warn('切换车辆时开启新车辆摄像头失败:', error)
    }
  }
})

onMounted(() => {
  updateVideoReceiver()
  eventBus.on(EVENTS.VIDEO_STREAM_TIMEOUT, handleTimeout)
  window.socketManager?.enforceCameraStatesOnShow?.(currentVehicleId.value)
})

onBeforeUnmount(() => {
  unsubscribeVideo()
  eventBus.off(EVENTS.VIDEO_STREAM_TIMEOUT, handleTimeout)

  if (router.currentRoute.value?.name !== 'ParallelDriving') {
    window.socketManager?.enforceCameraStatesOnHide?.(currentVehicleId.value)
  }
})
</script>

<style lang="scss" scoped>
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
    margin-bottom: 5px;
}

.video-stream {
    width: 100%;
    height: auto;
    aspect-ratio: v-bind(aspectRatio);
    object-fit: contain;
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