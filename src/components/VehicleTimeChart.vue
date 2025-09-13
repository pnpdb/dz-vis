<template>
    <div class="chart-container">
        <div class="chart-header">
            <h3 class="chart-title">车辆运行时间统计</h3>
        </div>
        <div class="chart-content">
            <div v-if="loading" class="loading">
                加载中...
            </div>
            <div v-else-if="chartData.length === 0" class="no-data">
                暂无数据
            </div>
            <div v-else class="mini-bar-chart">
                <div 
                    v-for="(item, index) in chartData.slice(-5)" 
                    :key="index"
                    class="bar-item"
                >
                    <div class="bar-container">
                        <div 
                            class="bar-fill"
                            :style="{ height: `${item.percentage}%` }"
                        ></div>
                    </div>
                    <div class="bar-label">{{ item.date }}</div>
                    <div class="bar-value">{{ item.minutes }}m</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { StatisticsAPI } from '@/utils/vehicleAPI.js';

const chartData = ref([]);
const loading = ref(true);

// 获取车辆在线统计数据
const fetchOnlineStats = async () => {
    try {
        loading.value = true;
        const result = await StatisticsAPI.getVehicleOnlineStats();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        const response = result.data;
        
        // 处理数据，按日期聚合
        const dailyData = {};
        response.forEach(record => {
            if (!dailyData[record.date]) {
                dailyData[record.date] = 0;
            }
            dailyData[record.date] += record.online_minutes;
        });
        
        // 转换为图表数据
        const rawData = Object.entries(dailyData)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-5) // 最近5天
            .map(([date, minutes]) => ({
                date: formatDate(date),
                minutes: minutes
            }));
        
        // 计算百分比
        const maxMinutes = Math.max(...rawData.map(d => d.minutes), 1);
        chartData.value = rawData.map(item => ({
            ...item,
            percentage: (item.minutes / maxMinutes) * 100
        }));
    } catch (error) {
        console.error('获取车辆在线统计失败:', error);
    } finally {
        loading.value = false;
    }
};

// 格式化日期
const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
};

// 定时更新数据
let updateInterval = null;

onMounted(() => {
    fetchOnlineStats();
    // 每2分钟更新一次数据
    updateInterval = setInterval(fetchOnlineStats, 120000);
});

onUnmounted(() => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});
</script>

<style lang="scss" scoped>
.chart-container {
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 15px;
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


.chart-content {
    min-height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.loading, .no-data {
    color: rgba(0, 240, 255, 0.7);
    font-size: 12px;
}

.mini-bar-chart {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    width: 100%;
    height: 80px;
    padding: 0 8px;
}

.bar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    margin: 0 2px;
}

.bar-container {
    width: 20px;
    height: 50px;
    background: rgba(0, 240, 255, 0.1);
    border-radius: 2px;
    display: flex;
    align-items: flex-end;
    margin-bottom: 4px;
}

.bar-fill {
    width: 100%;
    background: linear-gradient(to top, #00f0ff, #0080ff);
    border-radius: 2px;
    min-height: 2px;
    transition: height 0.6s ease;
}

.bar-label {
    font-size: 10px;
    color: rgba(0, 240, 255, 0.8);
    margin-bottom: 2px;
}

.bar-value {
    font-size: 10px;
    color: #00f0ff;
    font-weight: 600;
}
</style>
