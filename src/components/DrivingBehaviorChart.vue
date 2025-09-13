<template>
    <div class="chart-container">
        <div class="chart-header">
            <h3 class="chart-title">自动驾驶行为统计</h3>
            <div class="chart-divider"></div>
        </div>
        <div class="chart-content">
            <div v-if="loading" class="loading">
                加载中...
            </div>
            <div v-else class="behavior-stats">
                <div 
                    v-for="item in behaviorData" 
                    :key="item.key"
                    class="behavior-item"
                >
                    <div class="behavior-label">{{ item.label }}</div>
                    <div class="behavior-bar-container">
                        <div class="behavior-bar-bg">
                            <div 
                                class="behavior-bar-fill"
                                :style="{ width: `${item.percentage}%` }"
                            ></div>
                        </div>
                        <div class="behavior-count">{{ item.count }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { StatisticsAPI } from '@/utils/vehicleAPI.js';

const statsData = ref({
    taxi_orders: 0,
    avp_pickup: 0,
    avp_parking: 0
});
const loading = ref(true);

// 计算行为数据
const behaviorData = computed(() => {
    const data = [
        { key: 'taxi', label: '自动驾驶打车', count: statsData.value.taxi_orders },
        { key: 'pickup', label: 'AVP自动取车', count: statsData.value.avp_pickup },
        { key: 'parking', label: 'AVP自动泊车', count: statsData.value.avp_parking }
    ];
    
    // 计算最大值用于百分比计算
    const maxCount = Math.max(...data.map(item => item.count), 1);
    
    return data.map(item => ({
        ...item,
        percentage: maxCount > 0 ? (item.count / maxCount) * 100 : 0
    }));
});

// 获取自动驾驶行为统计数据
const fetchBehaviorStats = async () => {
    try {
        loading.value = true;
        const result = await StatisticsAPI.getDrivingBehaviorStats();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        const response = result.data;
        statsData.value = {
            taxi_orders: response.taxi_orders || 0,
            avp_pickup: response.avp_pickup || 0,
            avp_parking: response.avp_parking || 0
        };
    } catch (error) {
        console.error('获取自动驾驶行为统计失败:', error);
    } finally {
        loading.value = false;
    }
};

// 定时更新数据
let updateInterval = null;

onMounted(() => {
    fetchBehaviorStats();
    // 每2分钟更新一次数据
    updateInterval = setInterval(fetchBehaviorStats, 120000);
});

onUnmounted(() => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});
</script>

<style lang="scss" scoped>
.chart-container {
    background: rgba(0, 20, 40, 0.8);
    border: 1px solid rgba(0, 240, 255, 0.3);
    border-radius: 8px;
    padding: 15px;
    backdrop-filter: blur(10px);
}

.chart-header {
    margin-bottom: 15px;
}

.chart-title {
    font-size: 14px;
    font-weight: 600;
    color: #00f0ff;
    margin: 0 0 8px 0;
    text-align: center;
}

.chart-divider {
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, transparent, #00f0ff, transparent);
}

.chart-content {
    min-height: 90px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.loading {
    color: rgba(0, 240, 255, 0.7);
    font-size: 12px;
}

.behavior-stats {
    width: 100%;
}

.behavior-item {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    
    &:last-child {
        margin-bottom: 0;
    }
}

.behavior-label {
    font-size: 11px;
    color: #00f0ff;
    min-width: 65px;
    margin-right: 8px;
    text-align: left;
}

.behavior-bar-container {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
}

.behavior-bar-bg {
    flex: 1;
    height: 6px;
    background: rgba(0, 240, 255, 0.2);
    border-radius: 3px;
    overflow: hidden;
    position: relative;
}

.behavior-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #00f0ff, #0080ff);
    border-radius: 3px;
    transition: width 0.6s ease;
    min-width: 2px;
}

.behavior-count {
    font-size: 11px;
    color: #00f0ff;
    font-weight: 600;
    min-width: 18px;
    text-align: right;
}
</style>
