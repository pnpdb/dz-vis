<template>
    <div class="main-layout">
        <!-- 自定义标题栏 -->
        <TitleBar />
        
        <!-- 科技背景层 -->
        <div class="tech-background">
            <div class="grid-overlay"></div>
            <div class="particle-field"></div>
            <div class="hologram-lines"></div>
        </div>
        
        <!-- 悬浮导航栏 -->
        <Header class="floating-header" />
        
        <!-- 主3D内容区 - 全屏显示 -->
        <div class="main-scene">
            <Map class="fullscreen-3d" />
        </div>
        
        <!-- 悬浮控制面板 -->
        <div class="floating-panels">
            <Suspense>
                <component :is="currentComponent" v-if="currentComponent" />
                <template #fallback>
                    <div class="loading-panel">
                        <div class="loading-spinner">
                            <div class="spinner"></div>
                            <span>加载中...</span>
                        </div>
                    </div>
                </template>
            </Suspense>
        </div>

        <!-- HUD状态指示器 -->
        <div class="hud-overlay">
            <!-- 施工标记列表 - FPS左侧 -->
            <div v-if="constructionMarkers.length > 0" class="status-indicator top-right-construction" :class="{ collapsed: constructionListCollapsed }">
                <div class="construction-list">
                    <div class="construction-header" @click.stop="toggleConstructionList">
                        <fa icon="hard-hat" class="construction-list-icon" />
                        <span class="construction-title">施工标记 ({{ constructionMarkers.length }})</span>
                        <fa :icon="constructionListCollapsed ? 'chevron-right' : 'chevron-down'" class="collapse-icon" />
                    </div>
                    <div v-show="!constructionListCollapsed" class="construction-items">
                        <div 
                            v-for="marker in constructionMarkers" 
                            :key="marker.id"
                            class="construction-item"
                        >
                            <div class="marker-info">
                                <span class="marker-id">ID: {{ marker.id }}</span>
                                <span class="marker-coords">{{ marker.x.toFixed(2) }}, {{ marker.z.toFixed(2) }}</span>
                            </div>
                            <span 
                                class="delete-text" 
                                @click.stop="deleteConstructionMarker(marker.id)"
                                title="删除施工标记"
                            >
                                删除
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <!-- FPS显示 - 右上角时间左侧 -->
            <div class="status-indicator top-right-fps">
                <div class="performance-monitor">
                    <span>FPS: {{ fps.toString().padStart(2, ' ') }}</span>
                    <div class="fps-bar">
                        <div class="fps-fill" :style="{ width: fpsPercentage + '%' }"></div>
                    </div>
                </div>
            </div>
            <!-- 系统时间 - 右上角 -->
            <div class="status-indicator top-right">
                <div class="timestamp">{{ currentTime }}</div>
            </div>
            <div class="status-indicator bottom-left">
                <div class="network-status">
                    <fa :icon="networkStatus.icon" />
                    <span>{{ networkStatus.text }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import TitleBar from '@/components/TitleBar.vue';
import Header from '@/components/Header.vue';
import Map from '@/views/Map.vue';
import { getConstructionMarkersDetails, removeConstructionMarker } from '@/components/Scene3D/index.js';
import { ElMessage } from 'element-plus';
import eventBus, { EVENTS } from '@/utils/eventBus.js';
import vehicleBridge from '@/utils/vehicleBridge.js';

// ✅ 使用组合式函数（代码复用优化）
import { useSystemTime } from '@/composables/useSystemTime.js';
import { useFPS } from '@/composables/useFPS.js';
import { useNetworkStatus } from '@/composables/useNetworkStatus.js';

// 懒加载组件 - 提升初始加载性能
const Cars = defineAsyncComponent(() => import('@/views/Cars.vue'));
const AutoDrive = defineAsyncComponent(() => import('@/views/AutoDrive.vue'));
const Control = defineAsyncComponent(() => import('@/views/Control.vue'));
const Settings = defineAsyncComponent(() => import('@/views/Settings.vue'));

const route = useRoute();

// 根据路由显示对应组件
const currentComponent = computed(() => {
    const componentMap = {
        'Cars': Cars,
        'AutoDrive': AutoDrive,
        'Control': Control,
        'Settings': Settings
    };
    
    return componentMap[route.name] || Cars;
});

// ✅ 使用组合式函数获取状态数据
const { currentTime } = useSystemTime();
const { fps, fpsPercentage } = useFPS();
const { networkStatus } = useNetworkStatus();

// 施工标记列表状态
const constructionMarkers = ref([]);
const constructionListCollapsed = ref(false);

// 窗口 resize 处理
const handleResize = () => {
    eventBus.emit(EVENTS.APP_RESIZE, {
        width: window.innerWidth,
        height: window.innerHeight
    });
};

// 施工标记列表管理
const updateConstructionMarkersList = () => {
    try {
        const markers = getConstructionMarkersDetails();
        constructionMarkers.value = markers;
    } catch (error) {
        console.warn('获取施工标记列表失败:', error);
        constructionMarkers.value = [];
    }
};

const toggleConstructionList = () => {
    constructionListCollapsed.value = !constructionListCollapsed.value;
};

// 处理日志查看器切换事件

const deleteConstructionMarker = async (markerId) => {
    try {
        // 从场景中移除标记
        const success = removeConstructionMarker(markerId);
        if (success) {
            updateConstructionMarkersList();
            
            // 获取删除后剩余的所有施工标记并广播
            const remainingMarkers = getConstructionMarkersDetails();
            
            const result = await vehicleBridge.broadcastAllConstructionMarkers(remainingMarkers);
            
            // 显示成功消息
            ElMessage({
                message: result,
                type: 'success',
                duration: 3000
            });
        } else {
            console.warn(`删除施工标记 ${markerId} 失败`);
            ElMessage({
                message: `删除施工标记 ${markerId} 失败`,
                type: 'error',
                duration: 3000
            });
        }
    } catch (error) {
        console.error('删除施工标记时出错:', error);
        ElMessage({
            message: '删除施工标记失败: ' + error,
            type: 'error',
            duration: 3000
        });
    }
};

onMounted(() => {
    // 绑定resize事件
    window.addEventListener('resize', handleResize);

    // 初始化施工标记列表
    updateConstructionMarkersList();
    
    // 监听施工标记变化事件
    eventBus.on(EVENTS.CONSTRUCTION_MARKER_ADDED, updateConstructionMarkersList);
    eventBus.on(EVENTS.CONSTRUCTION_MARKER_REMOVED, updateConstructionMarkersList);
});

onBeforeUnmount(() => {
    // 清理事件监听器
    window.removeEventListener('resize', handleResize);
    eventBus.off(EVENTS.CONSTRUCTION_MARKER_ADDED, updateConstructionMarkersList);
    eventBus.off(EVENTS.CONSTRUCTION_MARKER_REMOVED, updateConstructionMarkersList);
});
</script>

<style lang="scss" scoped>
@use '@/styles/main-layout.scss';
</style>
