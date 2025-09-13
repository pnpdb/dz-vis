<template>
    <!-- 显示设置面板 -->
    <div class="floating-settings-panel" id="display-settings-panel">
        <div class="panel-header">
            <div class="panel-icon">
                <fa icon="cog" />
            </div>
            <h2 class="panel-title">功能设置</h2>
        </div>
        <CarSettings />
        <div class="form-group">
            <label class="form-label"> <fa icon="route"> </fa> 路径设置</label>
            <div class="flex">
                <span>显示所有路径</span>
                <el-switch
                    v-model="showAllPaths"
                    active-color="#13ce66"
                    inactive-color="#ff4949"
                ></el-switch>
            </div>
            <button class="btn btn-warning">
                <fa icon="eraser" />
                清空当前地图所有路径
            </button>
        </div>

        <div class="form-group">
            <label class="form-label">
                <fa icon="car"> </fa>
                车辆路径
            </label>
            <el-select v-model="selectedCar">
                <el-option
                    label="车辆 A - 自动驾驶出租车"
                    value="A"
                ></el-option>
                <el-option
                    label="车辆 B - AVP测试车"
                    value="B"
                    selected
                ></el-option>
                <el-option label="车辆 C - 物流配送车" value="C"></el-option>
            </el-select>

            <button class="btn btn-secondary">
                <fa icon="route" />
                查看车辆路径
            </button>
            <!-- <button class="btn btn-warning">
                <fa icon="eraser" />
                清空所有路线
            </button> -->
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import CarSettings from '@/components/CarSettings.vue';

const selectedCar = ref('B');
const showAllPaths = ref(false);
</script>

<style lang="scss" scoped>
.floating-settings-panel {
    padding: 25px;
    height: 100%;
    overflow-y: auto;
    position: relative;
}

.panel-header {
    margin-bottom: 20px;
    padding-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 2px solid rgba(0, 240, 255, 0.3);
    position: relative;
}

.panel-icon {
    width: 36px;
    height: 36px;
    font-size: 20px;
    color: var(--dark-bg);
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
}

.panel-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    background: linear-gradient(90deg, var(--primary), var(--primary-light));
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    flex: 1;
}

/* 滚动条样式 */
.floating-settings-panel::-webkit-scrollbar {
    width: 6px;
}

.floating-settings-panel::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
}

.floating-settings-panel::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, 
        var(--primary), 
        var(--primary-dark)
    );
    border-radius: 3px;
    box-shadow: 0 0 5px rgba(0, 240, 255, 0.3);
}

.floating-settings-panel::-webkit-scrollbar-thumb:hover {
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
}
</style>