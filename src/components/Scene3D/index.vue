<template>
  <div id="scene3D" class="scene3d-container">
    <!-- 添加加载指示器 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <div class="loading-text">加载3D场景中...</div>
        <div class="loading-progress">{{ loadingProgress }}%</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { destroyScene, initScene } from "./index.js";
import eventBus, { EVENTS } from '@/utils/eventBus.js'

const isLoading = ref(true);
const loadingProgress = ref(0);
let appCloseHandler = null;

onMounted(async () => {
  // 确保DOM准备就绪后再初始化3D场景
  await nextTick();
  
  // 使用setTimeout让界面先渲染，然后再开始3D初始化
  setTimeout(async () => {
    try {
      const container = document.getElementById("scene3D");
      if (!container) {
        console.error('Scene3D container not found');
        return;
      }

      // 异步初始化3D场景
      await initSceneAsync(container);
      
    } catch (error) {
      console.error('Scene3D初始化失败:', error);
      isLoading.value = false;
    }
  }, 100); // 给主界面100ms时间先渲染
  
  // 监听应用关闭事件
  appCloseHandler = () => {
    destroyScene();
  };
  window.addEventListener('beforeunload', appCloseHandler);
});

// 异步场景初始化
const initSceneAsync = async (container) => {
  return new Promise((resolve, reject) => {
    try {
      // 监听加载进度
      const progressHandler = (event) => {
        loadingProgress.value = event.detail || 0;
      };
      
      const completeHandler = () => {
        // 基础场景完成后隐藏加载界面，但继续监听模型加载进度
        isLoading.value = false;
        
        // 继续监听模型加载进度，但不再阻塞交互
        const modelProgressHandler = (() => {
          let lastProgress = -1;
          return (event) => {
            const progress = event?.detail ?? 0;
            if (progress <= lastProgress || progress === 0) {
              return;
            }
            lastProgress = progress;
            if (progress === 100) {
              console.log('所有模型加载完成');
              eventBus.off(EVENTS.SCENE3D_PROGRESS, modelProgressHandler);
            } else {
              console.log(`模型加载进度: ${progress}%`);
            }
          };
        })();
        
        // 移除旧的监听器
        eventBus.off(EVENTS.SCENE3D_PROGRESS, progressHandler);
        eventBus.off(EVENTS.SCENE3D_COMPLETE, completeHandler);
        
        // 添加新的模型进度监听器
        eventBus.on(EVENTS.SCENE3D_PROGRESS, modelProgressHandler);
        
        resolve();
      };
      
      eventBus.on(EVENTS.SCENE3D_PROGRESS, progressHandler);
      eventBus.on(EVENTS.SCENE3D_COMPLETE, completeHandler);
      
      // 启动3D场景初始化
      initScene(container);
      
    } catch (error) {
      isLoading.value = false;
      reject(error);
    }
  });
};

onUnmounted(() => {
  destroyScene();
  
  if (appCloseHandler) {
    window.removeEventListener('beforeunload', appCloseHandler);
  }
});
</script>

<style scoped>
#scene3D {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.scene3d-container {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1a1f25 0%, #2c3e50 100%);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 15, 30, 0.9);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  text-align: center;
  color: #00f0ff;
}

.spinner {
  width: 60px;
  height: 60px;
  border: 3px solid rgba(0, 240, 255, 0.3);
  border-top: 3px solid #00f0ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 10px;
  font-family: 'Orbitron', sans-serif;
  text-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
}

.loading-progress {
  font-size: 14px;
  color: rgba(0, 240, 255, 0.8);
  font-family: 'Orbitron', monospace;
}
</style>