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
      <div class="content-placeholder">
        <div class="placeholder-icon">
          <fa icon="gamepad" />
        </div>
        <h2>平行驾驶模式</h2>
        <p>此功能正在开发中...</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'

const router = useRouter()
const appTitle = ref('渡众智能沙盘云控平台')

// 加载应用标题
onMounted(async () => {
  try {
    const res = await invoke('get_app_settings')
    if (res && res.app_title) {
      appTitle.value = res.app_title
    }
  } catch (error) {
    console.error('加载应用设置失败:', error)
  }
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
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.content-placeholder {
  text-align: center;
  color: #94a3b8;
}

.placeholder-icon {
  font-size: 64px;
  color: #00f0ff;
  margin-bottom: 24px;
  text-shadow: 0 0 20px rgba(0, 240, 255, 0.5);
}

.content-placeholder h2 {
  font-size: 32px;
  margin-bottom: 16px;
  color: #ffffff;
  text-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
}

.content-placeholder p {
  font-size: 18px;
  color: #94a3b8;
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
