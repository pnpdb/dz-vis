<template>
    <div class="container">
        <Header />
        <!-- 主内容区 -->
        <div class="main-content">
            <Map />
            <RouterView />
        </div>
    </div>
</template>

<script setup>
import { RouterView } from 'vue-router';
import Header from '@/components/Header.vue';
import Map from '@/views/Map.vue';

// 窗口 resize 处理
const handleResize = () => {
    window.dispatchEvent(new CustomEvent('app-resize', {
        detail: {
            width: window.innerWidth,
            height: window.innerHeight
        }
    }));
};

// 挂载后绑定事件
window.addEventListener('resize', handleResize);

// 组件卸载时清理事件
// onBeforeUnmount(() => {
//     window.removeEventListener('resize', handleResize);
// });
</script>

<style lang="scss" scoped>
/* 主内容区 */
.main-content {
    display: flex;
    flex: 1;
    gap: 15px;
    height: calc(100% - 180px);
    max-height: 100vh;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s;
}

.fade-enter,
.fade-leave-to {
    opacity: 0;
}
</style>
