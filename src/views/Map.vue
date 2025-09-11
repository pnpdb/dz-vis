<template>
    <div class="map-wrap">
        <!-- 地图区域 -->
        <div class="map-container">
            <div class="car-list-wrap">
                <CarList />
            </div>

            <div class="car-btn-wrap">
                <CarButton />
            </div>

            <div class="map-grid center">
                <Scene3D />
            </div>
        </div>

        <div class="echarts-wrap">
            <!-- 网络延迟图 -->
            <!-- <NetworkDelayChart /> -->
            <div class="temp-chart">
                <div class="form-group">
                    <label class="form-label">
                        <fa icon="chart-line" /> 网络延迟
                    </label>
                    <div class="chart-placeholder">
                        <fa icon="chart-line" />
                        <span>网络延迟图表</span>
                    </div>
                </div>
            </div>

            <!-- 自动驾驶行为统计 -->
            <!-- <AutoStatisticsChat /> -->
            <div class="temp-chart">
                <div class="form-group">
                    <label class="form-label">
                        <fa icon="robot" /> 自动驾驶统计
                    </label>
                    <div class="chart-placeholder">
                        <fa icon="robot" />
                        <span>自动驾驶统计图表</span>
                    </div>
                </div>
            </div>

            <!-- 车辆运行时间统计 -->
            <!-- <TimeStatisticsChart /> -->
            <div class="temp-chart">
                <div class="form-group">
                    <label class="form-label">
                        <fa icon="clock" /> 运行时间统计
                    </label>
                    <div class="chart-placeholder">
                        <fa icon="clock" />
                        <span>运行时间统计图表</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
// import CarList from '@/components/CarList.vue';
import CarList from '@/components/CarList.vue';
import CarButton from '@/components/CarButton.vue';
import Scene3D from '@/components/Scene3D/index.vue';

export default {
    components: {
        CarList,
        CarButton,
        Scene3D,
    },
};
</script>

<style lang="scss" scoped>
.map-container {
    flex: 1;
    position: relative;
    background: var(--darker-card);
    border-radius: 16px;
    box-shadow: var(--card-shadow);
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--dark-border);

    .map-grid {
        position: absolute;
        width: 100%;
        height: 100%;
        background-image:
            linear-gradient(rgba(0, 240, 255, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 240, 255, 0.08) 1px, transparent 1px);
        background-size: 31px 31px;
    }
}

/* 临时3D场景样式 */
.temp-3d-scene {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
    
    .scene-icon {
        font-size: 4rem;
        margin-bottom: 20px;
        color: var(--primary);
        opacity: 0.7;
    }
    
    .scene-text {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 10px;
        color: var(--text-primary);
    }
    
    .scene-desc {
        font-size: 1rem;
        color: var(--text-gray);
    }
}

/* 车辆列表 */
.car-list-wrap {
    position: absolute;
    z-index: 9;
    top: 0;
    left: 0;

    .form-group {
        width: 343px;
        min-height: 93px;
        margin: 0;
        background-color: rgba(0, 0, 0, 0.2);
        background-blend-mode: multiply;
    }
}

/* 车辆控制按钮 */
.car-btn-wrap {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 9;
    height: 124px;

    .form-group {
        min-height: 93px;
    }
}

/* 图表区域 */
.echarts-wrap {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    gap: 15px;

    .temp-chart {
        flex-grow: 1;
        
        .form-group {
            width: 100%;
            margin: 0;
        }
    }
    
    .chart-placeholder {
        height: 120px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: rgba(255, 255, 255, 0.4);
        
        .fa {
            font-size: 2rem;
        }
    }
}

/* 地图控制按钮 */
.map-overlay {
    position: absolute;
    bottom: 20px;
    left: 20px;
    background: rgba(15, 30, 47, 0.9);
    padding: 12px 20px;
    border-radius: 12px;
    display: flex;
    gap: 15px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    border: 1px solid var(--dark-border);
    backdrop-filter: blur(5px);

    .map-control-btn {
        padding: 10px 18px;
        background: var(--dark-card);
        color: var(--text-primary);
        border: 1px solid var(--dark-border);
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        transition: var(--transition);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .map-control-btn:hover {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--dark-bg);
        transform: translateY(-2px);
    }
}
</style>