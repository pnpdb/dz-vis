<template>
    <div class="app-container">
        <!-- 主界面布局 - 始终存在，但可能被隐藏 -->
        <MainLayout v-show="!isParallelDrivingPage" />
        
        <!-- 平行驾驶页面 - 覆盖在主界面之上 -->
        <ParallelDriving v-if="isParallelDrivingPage" />
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import MainLayout from '@/views/MainLayout.vue';
import ParallelDriving from '@/views/ParallelDriving.vue';

const route = useRoute();

// 判断是否在平行驾驶页面
const isParallelDrivingPage = computed(() => {
    return route.name === 'ParallelDriving';
});
</script>

<style scoped>
.app-container {
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: hidden;
    background: #0f1419;
}
</style>