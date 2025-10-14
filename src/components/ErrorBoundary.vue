<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <h2>应用遇到了一些问题</h2>
      <p class="error-message">{{ errorMessage }}</p>
      <div class="error-actions">
        <el-button type="primary" @click="handleReload">重新加载</el-button>
        <el-button @click="handleReset">重置状态</el-button>
        <el-button v-if="showDetails" @click="toggleDetails">隐藏详情</el-button>
        <el-button v-else @click="toggleDetails">显示详情</el-button>
      </div>
      <div v-if="showDetails" class="error-details">
        <h3>错误堆栈</h3>
        <pre>{{ errorStack }}</pre>
        <h3>组件信息</h3>
        <pre>{{ errorInfo }}</pre>
      </div>
    </div>
  </div>
  <slot v-else></slot>
</template>

<script setup>
import { ref, onErrorCaptured, getCurrentInstance } from 'vue';
import { logger } from '@/utils/logger';

const hasError = ref(false);
const errorMessage = ref('');
const errorStack = ref('');
const errorInfo = ref('');
const showDetails = ref(false);

/**
 * 捕获组件错误
 */
onErrorCaptured((err, instance, info) => {
  hasError.value = true;
  errorMessage.value = err.message || '未知错误';
  errorStack.value = err.stack || '';
  errorInfo.value = JSON.stringify(
    {
      componentName: instance?.$options?.name || '未知组件',
      info,
      timestamp: new Date().toISOString(),
    },
    null,
    2
  );

  // 记录错误日志
  logger.error('ErrorBoundary', '捕获到错误', {
    message: err.message,
    stack: err.stack,
    info,
  });

  // 阻止错误继续向上传播
  return false;
});

/**
 * 重新加载页面
 */
function handleReload() {
  window.location.reload();
}

/**
 * 重置错误状态
 */
function handleReset() {
  hasError.value = false;
  errorMessage.value = '';
  errorStack.value = '';
  errorInfo.value = '';
  showDetails.value = false;
}

/**
 * 切换详情显示
 */
function toggleDetails() {
  showDetails.value = !showDetails.value;
}
</script>

<style scoped>
.error-boundary {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 20px;
}

.error-content {
  background: white;
  border-radius: 12px;
  padding: 40px;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.error-icon {
  font-size: 64px;
  text-align: center;
  margin-bottom: 20px;
}

h2 {
  text-align: center;
  color: #333;
  margin-bottom: 16px;
  font-size: 24px;
}

.error-message {
  text-align: center;
  color: #666;
  font-size: 16px;
  margin-bottom: 30px;
  padding: 16px;
  background: #fff3cd;
  border-left: 4px solid #ffc107;
  border-radius: 4px;
}

.error-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 20px;
}

.error-details {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.error-details h3 {
  color: #333;
  font-size: 16px;
  margin-bottom: 12px;
}

.error-details pre {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
  color: #333;
  margin-bottom: 20px;
}
</style>

