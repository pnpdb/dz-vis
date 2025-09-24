<template>
  <div class="video-performance-monitor">
    <div class="monitor-header">
      <h3><fa icon="chart-line" /> 视频处理性能监控</h3>
      <div class="monitor-controls">
        <button @click="refreshStats" class="btn btn-secondary" :disabled="loading">
          <fa icon="refresh" :class="{ 'fa-spin': loading }" />
          刷新
        </button>
        <button @click="clearStats" class="btn btn-warning">
          <fa icon="trash" />
          清空统计
        </button>
        <button @click="toggleAutoRefresh" class="btn btn-info">
          <fa :icon="autoRefresh ? 'pause' : 'play'" />
          {{ autoRefresh ? '暂停' : '启动' }}自动刷新
        </button>
      </div>
    </div>

    <!-- 性能摘要 -->
    <div class="performance-summary" v-if="summary">
      <div class="summary-card">
        <div class="summary-title">总体性能</div>
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-label">活跃车辆:</span>
            <span class="stat-value">{{ summary.active_vehicles }} / {{ summary.total_vehicles }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">总帧数:</span>
            <span class="stat-value">{{ summary.total_frames.toLocaleString() }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">成功率:</span>
            <span class="stat-value success-rate" :class="getSuccessRateClass(summary.success_rate)">
              {{ summary.success_rate.toFixed(1) }}%
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">平均帧率:</span>
            <span class="stat-value">{{ summary.average_fps.toFixed(1) }} FPS</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 性能比较 -->
    <div class="performance-comparison" v-if="comparison">
      <div class="comparison-card">
        <div class="comparison-title">Rust vs JavaScript 性能对比</div>
        <div class="comparison-stats">
          <div class="comparison-item">
            <span class="comparison-label">Rust平均处理时间:</span>
            <span class="comparison-value rust-time">{{ comparison.averageRustTimeMs.toFixed(2) }}ms</span>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">JavaScript平均处理时间:</span>
            <span class="comparison-value js-time">{{ comparison.averageJsTimeMs.toFixed(2) }}ms</span>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">性能提升:</span>
            <span class="comparison-value performance-gain" :class="getPerformanceGainClass(comparison.performanceGain)">
              {{ comparison.performanceGain > 0 ? '+' : '' }}{{ comparison.performanceGain.toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 车辆详细统计 -->
    <div class="vehicle-stats" v-if="vehicleStats.length > 0">
      <h4>车辆详细统计</h4>
      <div class="stats-table">
        <table>
          <thead>
            <tr>
              <th>车辆ID</th>
              <th>总帧数</th>
              <th>有效帧数</th>
              <th>当前帧率</th>
              <th>平均帧大小</th>
              <th>平均处理时间</th>
              <th>最后更新</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stats in vehicleStats" :key="stats.vehicle_id" :class="getVehicleRowClass(stats)">
              <td>{{ stats.vehicle_id }}</td>
              <td>{{ stats.total_frames.toLocaleString() }}</td>
              <td>{{ stats.valid_frames.toLocaleString() }}</td>
              <td>{{ stats.current_fps.toFixed(1) }} FPS</td>
              <td>{{ (stats.average_frame_size / 1024).toFixed(1) }}KB</td>
              <td>{{ (stats.average_processing_time_us / 1000).toFixed(2) }}ms</td>
              <td>{{ formatTime(stats.last_update) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="empty-state" v-if="!loading && vehicleStats.length === 0">
      <fa icon="chart-line" class="empty-icon" />
      <p>暂无视频处理统计数据</p>
      <p class="empty-hint">当有车辆发送视频帧时，统计信息将在此显示</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { videoProcessor } from '@/utils/videoProcessor.js'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const autoRefresh = ref(true)
const summary = ref(null)
const comparison = ref(null)
const vehicleStats = ref([])
let refreshTimer = null

// 刷新统计数据
const refreshStats = async () => {
  if (loading.value) return
  
  loading.value = true
  try {
    // 获取性能摘要
    const summaryData = await videoProcessor.getPerformanceSummary()
    if (summaryData) {
      summary.value = summaryData
    }

    // 获取所有车辆统计
    const allStats = await videoProcessor.getAllStats()
    vehicleStats.value = allStats.sort((a, b) => a.vehicle_id - b.vehicle_id)

    // 获取性能比较数据
    comparison.value = videoProcessor.getPerformanceComparison()
    
  } catch (error) {
    console.error('刷新统计数据失败:', error)
    ElMessage.error(`刷新统计失败: ${error.message}`)
  } finally {
    loading.value = false
  }
}

// 清空统计数据
const clearStats = async () => {
  try {
    await videoProcessor.resetAllStats()
    summary.value = null
    comparison.value = null
    vehicleStats.value = []
    ElMessage.success('已清空所有统计数据')
  } catch (error) {
    console.error('清空统计失败:', error)
    ElMessage.error(`清空统计失败: ${error.message}`)
  }
}

// 切换自动刷新
const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

// 启动自动刷新
const startAutoRefresh = () => {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = setInterval(() => {
    refreshStats()
  }, 3000) // 每3秒刷新一次
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// 格式化时间
const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

// 获取成功率样式类
const getSuccessRateClass = (rate) => {
  if (rate >= 95) return 'excellent'
  if (rate >= 90) return 'good'
  if (rate >= 80) return 'fair'
  return 'poor'
}

// 获取性能提升样式类
const getPerformanceGainClass = (gain) => {
  if (gain > 50) return 'excellent'
  if (gain > 30) return 'good'
  if (gain > 10) return 'fair'
  return 'poor'
}

// 获取车辆行样式类
const getVehicleRowClass = (stats) => {
  const now = Date.now()
  const timeDiff = now - stats.last_update
  
  if (timeDiff > 30000) return 'inactive' // 30秒未更新
  if (stats.current_fps < 10) return 'low-fps'
  return 'active'
}

onMounted(() => {
  refreshStats()
  if (autoRefresh.value) {
    startAutoRefresh()
  }
})

onBeforeUnmount(() => {
  stopAutoRefresh()
})
</script>

<style lang="scss" scoped>
.video-performance-monitor {
  background: var(--dark-card);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--dark-border);
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  h3 {
    margin: 0;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.monitor-controls {
  display: flex;
  gap: 8px;
  
  .btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
  
  .btn-secondary {
    background: var(--dark-border);
    color: var(--text-primary);
    &:hover:not(:disabled) {
      background: var(--primary);
    }
  }
  
  .btn-warning {
    background: var(--warning);
    color: var(--dark-bg);
    &:hover {
      background: #ffc107;
    }
  }
  
  .btn-info {
    background: var(--info);
    color: var(--dark-bg);
    &:hover {
      background: #17a2b8;
    }
  }
}

.performance-summary, .performance-comparison {
  margin-bottom: 20px;
}

.summary-card, .comparison-card {
  background: rgba(0, 240, 255, 0.05);
  border: 1px solid rgba(0, 240, 255, 0.2);
  border-radius: 8px;
  padding: 16px;
}

.summary-title, .comparison-title {
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 12px;
}

.summary-stats, .comparison-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.stat-item, .comparison-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label, .comparison-label {
  color: var(--text-secondary);
  font-size: 13px;
}

.stat-value, .comparison-value {
  font-weight: 600;
  color: var(--text-primary);
}

.success-rate {
  &.excellent { color: var(--success); }
  &.good { color: #28a745; }
  &.fair { color: var(--warning); }
  &.poor { color: var(--error); }
}

.rust-time {
  color: var(--success);
}

.js-time {
  color: var(--warning);
}

.performance-gain {
  &.excellent { color: var(--success); }
  &.good { color: #28a745; }
  &.fair { color: var(--warning); }
  &.poor { color: var(--error); }
}

.vehicle-stats {
  h4 {
    color: var(--text-primary);
    margin-bottom: 12px;
  }
}

.stats-table {
  overflow-x: auto;
  
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    
    th, td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid var(--dark-border);
    }
    
    th {
      background: rgba(0, 240, 255, 0.1);
      color: var(--primary);
      font-weight: 600;
    }
    
    tbody tr {
      &.active {
        background: rgba(0, 240, 255, 0.05);
      }
      
      &.inactive {
        background: rgba(255, 107, 107, 0.1);
        color: var(--text-secondary);
      }
      
      &.low-fps {
        background: rgba(255, 212, 59, 0.1);
      }
      
      &:hover {
        background: rgba(0, 240, 255, 0.1);
      }
    }
  }
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
  
  .empty-icon {
    font-size: 48px;
    color: rgba(0, 240, 255, 0.3);
    margin-bottom: 16px;
  }
  
  .empty-hint {
    font-size: 12px;
    margin-top: 8px;
  }
}
</style>
