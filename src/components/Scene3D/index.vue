<template>
  <div id="scene3D" class="scene3d-container">
    <div class="scene3d-placeholder">
      <fa icon="car" class="scene3d-icon" />
      <div class="scene3d-title">3D 场景</div>
      <div class="scene3d-description">Three.js 3D 地图场景</div>
      <div class="scene3d-info">
        <div class="info-item">
          <span class="info-label">摄像机:</span>
          <span class="info-value">透视摄像机</span>
        </div>
        <div class="info-item">
          <span class="info-label">渲染器:</span>
          <span class="info-value">WebGL 渲染器</span>
        </div>
        <div class="info-item">
          <span class="info-label">状态:</span>
          <span class="info-value status-ready">就绪</span>
        </div>
      </div>
      <div class="scene3d-controls">
        <button class="scene-btn">
          <fa icon="play" /> 启动场景
        </button>
        <button class="scene-btn">
          <fa icon="refresh" /> 重置视角
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from "vue";

let appCloseHandler = null;

onMounted(() => {
  // TODO: 实现 Three.js 场景初始化
  console.log('Scene3D mounted - ready for Three.js implementation');
  
  // 监听应用关闭事件
  appCloseHandler = () => {
    // TODO: 清理 Three.js 资源
    console.log('Scene3D cleanup');
  };
  window.addEventListener('app-will-close', appCloseHandler);
});

onUnmounted(() => {
  // TODO: 清理 Three.js 资源
  console.log('Scene3D unmounted');
  
  if (appCloseHandler) {
    window.removeEventListener('app-will-close', appCloseHandler);
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

.scene3d-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
  padding: 20px;
}

.scene3d-icon {
  font-size: 4rem;
  color: var(--primary);
  margin-bottom: 20px;
  opacity: 0.8;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.scene3d-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 10px;
  color: var(--text-primary);
  font-family: 'Orbitron', sans-serif;
}

.scene3d-description {
  font-size: 1rem;
  color: var(--text-gray);
  margin-bottom: 30px;
}

.scene3d-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 30px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(0, 240, 255, 0.2);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 200px;
}

.info-label {
  color: var(--text-gray);
  font-size: 0.9rem;
}

.info-value {
  color: var(--primary);
  font-weight: 600;
  font-size: 0.9rem;
}

.status-ready {
  color: var(--success) !important;
}

.scene3d-controls {
  display: flex;
  gap: 15px;
}

.scene-btn {
  padding: 10px 20px;
  background: rgba(0, 240, 255, 0.1);
  color: var(--primary);
  border: 1px solid rgba(0, 240, 255, 0.3);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.scene-btn:hover {
  background: rgba(0, 240, 255, 0.2);
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 240, 255, 0.3);
}

/* 网格背景效果 */
.scene3d-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image:
    linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
}
</style>