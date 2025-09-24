<!-- 协议处理性能监控组件 -->
<template>
  <div class="protocol-performance-monitor">
    <div class="monitor-header">
      <h3 class="monitor-title">
        <i class="fas fa-chart-line"></i>
        协议处理性能监控
      </h3>
      <div class="monitor-controls">
        <el-button 
          size="small" 
          :type="isMonitoring ? 'danger' : 'primary'"
          @click="toggleMonitoring"
        >
          {{ isMonitoring ? '停止监控' : '开始监控' }}
        </el-button>
        <el-button 
          size="small" 
          type="warning"
          @click="resetStats"
        >
          重置统计
        </el-button>
      </div>
    </div>

    <div class="stats-grid" v-if="stats">
      <!-- 批处理统计 -->
      <div class="stats-card">
        <h4>批处理统计</h4>
        <div class="stats-content">
          <div class="stat-item">
            <span class="stat-label">总任务数:</span>
            <span class="stat-value">{{ stats.batch_processing.total_tasks }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">成功任务:</span>
            <span class="stat-value success">{{ stats.batch_processing.successful_tasks }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">失败任务:</span>
            <span class="stat-value error">{{ stats.batch_processing.failed_tasks }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">平均处理时间:</span>
            <span class="stat-value">{{ formatTime(stats.batch_processing.average_time_us) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">吞吐量:</span>
            <span class="stat-value">{{ stats.batch_processing.throughput.toFixed(2) }} 任务/秒</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">并行效率:</span>
            <span class="stat-value" :class="getEfficiencyClass(stats.batch_processing.parallel_efficiency)">
              {{ (stats.batch_processing.parallel_efficiency * 100).toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>

      <!-- 验证统计 -->
      <div class="stats-card">
        <h4>验证统计</h4>
        <div class="stats-content">
          <div class="stat-item">
            <span class="stat-label">验证成功:</span>
            <span class="stat-value success">{{ stats.validation.success_count }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">验证失败:</span>
            <span class="stat-value error">{{ stats.validation.failure_count }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">成功率:</span>
            <span class="stat-value" :class="getSuccessRateClass(stats.validation.success_rate)">
              {{ (stats.validation.success_rate * 100).toFixed(1) }}%
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">平均验证时间:</span>
            <span class="stat-value">{{ formatTime(stats.validation.average_time_us) }}</span>
          </div>
        </div>
      </div>

      <!-- 转换统计 -->
      <div class="stats-card">
        <h4>零拷贝转换统计</h4>
        <div class="stats-content">
          <div class="stat-item">
            <span class="stat-label">零拷贝转换:</span>
            <span class="stat-value success">{{ stats.conversion.zero_copy_conversions }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">内存拷贝转换:</span>
            <span class="stat-value warning">{{ stats.conversion.memory_copy_conversions }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">零拷贝效率:</span>
            <span class="stat-value" :class="getEfficiencyClass(stats.conversion.zero_copy_efficiency)">
              {{ (stats.conversion.zero_copy_efficiency * 100).toFixed(1) }}%
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">节省字节:</span>
            <span class="stat-value">{{ formatBytes(stats.conversion.saved_bytes) }}</span>
          </div>
        </div>
      </div>

      <!-- 解析统计 -->
      <div class="stats-card">
        <h4>解析统计</h4>
        <div class="stats-content">
          <div class="stat-item">
            <span class="stat-label">总处理时间:</span>
            <span class="stat-value">{{ formatTime(stats.parsing.total_time_us) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">处理字节数:</span>
            <span class="stat-value">{{ formatBytes(stats.parsing.bytes_processed) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 性能趋势图 -->
    <div class="performance-chart" v-if="chartData.length > 0">
      <h4>性能趋势 (最近10分钟)</h4>
      <div class="chart-container">
        <canvas ref="chartCanvas" width="400" height="200"></canvas>
      </div>
    </div>

    <!-- 错误信息 -->
    <div class="error-message" v-if="error">
      <i class="fas fa-exclamation-triangle"></i>
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { ElButton, ElMessage } from 'element-plus'
import protocolProcessor from '@/utils/protocolProcessor.js'

// 响应式数据
const stats = ref(null)
const isMonitoring = ref(false)
const error = ref('')
const chartData = ref([])
const chartCanvas = ref(null)

// 监控相关
let monitoringInterval = null
let chart = null

// 生命周期
onMounted(async () => {
  await loadInitialStats()
  await nextTick()
  initChart()
})

onUnmounted(() => {
  stopMonitoring()
  if (chart) {
    chart.destroy()
  }
})

// 方法
const loadInitialStats = async () => {
  try {
    const initialStats = await protocolProcessor.getStats()
    if (initialStats) {
      stats.value = initialStats
    }
  } catch (err) {
    error.value = `加载统计信息失败: ${err.message}`
  }
}

const toggleMonitoring = () => {
  if (isMonitoring.value) {
    stopMonitoring()
  } else {
    startMonitoring()
  }
}

const startMonitoring = async () => {
  try {
    isMonitoring.value = true
    error.value = ''
    
    monitoringInterval = setInterval(async () => {
      try {
        const newStats = await protocolProcessor.getStats()
        if (newStats) {
          stats.value = newStats
          
          // 添加到图表数据
          const now = new Date()
          chartData.value.push({
            time: now,
            throughput: newStats.batch_processing.throughput,
            averageTime: newStats.batch_processing.average_time_us / 1000, // 转换为毫秒
            successRate: newStats.validation.success_rate * 100
          })
          
          // 保持最近10分钟的数据
          const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000)
          chartData.value = chartData.value.filter(item => item.time > tenMinutesAgo)
          
          updateChart()
        }
      } catch (err) {
        error.value = `监控更新失败: ${err.message}`
      }
    }, 2000) // 每2秒更新一次
    
    ElMessage.success('协议处理性能监控已启动')
  } catch (err) {
    error.value = `启动监控失败: ${err.message}`
    isMonitoring.value = false
  }
}

const stopMonitoring = () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
    monitoringInterval = null
  }
  isMonitoring.value = false
  ElMessage.info('协议处理性能监控已停止')
}

const resetStats = async () => {
  try {
    const success = await protocolProcessor.resetStats()
    if (success) {
      stats.value = null
      chartData.value = []
      await loadInitialStats()
      ElMessage.success('统计信息已重置')
    } else {
      throw new Error('重置失败')
    }
  } catch (err) {
    error.value = `重置统计信息失败: ${err.message}`
    ElMessage.error(error.value)
  }
}

const initChart = () => {
  if (!chartCanvas.value) return
  
  const ctx = chartCanvas.value.getContext('2d')
  
  // 简单的图表实现
  chart = {
    ctx,
    canvas: chartCanvas.value,
    destroy: () => {}
  }
}

const updateChart = () => {
  if (!chart || chartData.value.length === 0) return
  
  const ctx = chart.ctx
  const canvas = chart.canvas
  const width = canvas.width
  const height = canvas.height
  
  // 清空画布
  ctx.clearRect(0, 0, width, height)
  
  // 绘制网格
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 1
  
  // 垂直网格线
  for (let i = 0; i <= 10; i++) {
    const x = (width / 10) * i
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  
  // 水平网格线
  for (let i = 0; i <= 5; i++) {
    const y = (height / 5) * i
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  
  if (chartData.value.length < 2) return
  
  // 绘制吞吐量线
  ctx.strokeStyle = '#409EFF'
  ctx.lineWidth = 2
  ctx.beginPath()
  
  const maxThroughput = Math.max(...chartData.value.map(d => d.throughput))
  
  chartData.value.forEach((point, index) => {
    const x = (width / (chartData.value.length - 1)) * index
    const y = height - (point.throughput / maxThroughput) * height
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  
  ctx.stroke()
}

// 工具函数
const formatTime = (microseconds) => {
  if (microseconds < 1000) {
    return `${microseconds.toFixed(0)}μs`
  } else if (microseconds < 1000000) {
    return `${(microseconds / 1000).toFixed(2)}ms`
  } else {
    return `${(microseconds / 1000000).toFixed(2)}s`
  }
}

const formatBytes = (bytes) => {
  if (bytes < 1024) {
    return `${bytes}B`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`
  }
}

const getEfficiencyClass = (efficiency) => {
  if (efficiency >= 0.8) return 'success'
  if (efficiency >= 0.6) return 'warning'
  return 'error'
}

const getSuccessRateClass = (rate) => {
  if (rate >= 0.95) return 'success'
  if (rate >= 0.8) return 'warning'
  return 'error'
}
</script>

<style scoped>
.protocol-performance-monitor {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin: 20px 0;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #e0e0e0;
}

.monitor-title {
  margin: 0;
  color: #2c3e50;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.monitor-title i {
  color: #409EFF;
}

.monitor-controls {
  display: flex;
  gap: 10px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stats-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.stats-card h4 {
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 16px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 8px;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  color: #666;
  font-size: 14px;
}

.stat-value {
  font-weight: 600;
  font-size: 14px;
}

.stat-value.success {
  color: #67C23A;
}

.stat-value.warning {
  color: #E6A23C;
}

.stat-value.error {
  color: #F56C6C;
}

.performance-chart {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
}

.performance-chart h4 {
  margin: 0 0 16px 0;
  color: #2c3e50;
}

.chart-container {
  position: relative;
  height: 200px;
}

.chart-container canvas {
  width: 100%;
  height: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.error-message {
  background: #fef0f0;
  color: #f56c6c;
  padding: 12px;
  border-radius: 4px;
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-message i {
  font-size: 16px;
}
</style>
