<template>
    <!-- 显示设置面板 -->
    <div class="panel-card" id="display-settings-panel">
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
const showAllPaths = ref(true);
</script>

<style lang="scss" scoped></style>