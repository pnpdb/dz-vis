<template>
    <div class="main-layout">
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

        <!-- 浮动日志查看器（可拖拽） -->
        <LogViewer v-model="showLogViewer" />
        
        <!-- HUD状态指示器 -->
        <div class="hud-overlay">
            <!-- 施工标记列表 - FPS左侧 -->
            <div v-if="constructionMarkers.length > 0" class="status-indicator top-right-construction">
                <div class="construction-list">
                    <div class="construction-header" @click.stop="toggleConstructionList">
                        <fa icon="hard-hat" class="construction-list-icon" />
                        <span>施工标记 ({{ constructionMarkers.length }})</span>
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
import { ref, onMounted, onBeforeUnmount, computed, defineAsyncComponent, Suspense } from 'vue';
import { useRoute } from 'vue-router';
import Header from '@/components/Header.vue';
import Map from '@/views/Map.vue';
import LogViewer from '@/components/LogViewer.vue';
import { error as jsError } from '@tauri-apps/plugin-log';
import { getConstructionMarkersDetails, removeConstructionMarker } from '@/components/Scene3D/index.js';
import { ElMessage } from 'element-plus';

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

// 实时状态数据
const currentTime = ref('');
const fps = ref(60);
const fpsPercentage = ref(100);
const networkStatus = ref({
    text: '检测网络中...',
    icon: 'signal',
    connected: false
});

// 施工标记列表状态
const constructionMarkers = ref([]);
const constructionListCollapsed = ref(false);
const showLogViewer = ref(false);

// 更新时间
const updateTime = () => {
    const now = new Date();
    currentTime.value = now.toLocaleTimeString('zh-CN', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

// 真实FPS监控
const updateFPS = (fpsData) => {
    if (fpsData && typeof fpsData.fps === 'number') {
        fps.value = fpsData.fps;
        fpsPercentage.value = Math.min((fps.value / 60) * 100, 100);
    }
};

// 监听3D场景的FPS事件
const handleFPSUpdate = (event) => {
    updateFPS(event.detail);
};

// 窗口 resize 处理
const handleResize = () => {
    window.dispatchEvent(new CustomEvent('app-resize', {
        detail: {
            width: window.innerWidth,
            height: window.innerHeight
        }
    }));
};

// 检测网络连接状态（使用Rust后端）
const checkNetworkStatus = async () => {
    try {
        // 首先检查浏览器的在线状态
        if (!navigator.onLine) {
            networkStatus.value = {
                text: '网络断开',
                icon: 'times-circle',
                connected: false
            };
            return;
        }

        // 调用Rust后端获取网络状态
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('get_network_status');
        
        networkStatus.value = {
            text: result.text,
            icon: result.icon,
            connected: result.connected
        };
        
    } catch (error) {
        await jsError('网络状态检测失败:', error);
        networkStatus.value = {
            text: '网络状态未知',
            icon: 'question-circle',
            connected: false
        };
    }
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
const handleToggleLogViewer = (e) => {
    showLogViewer.value = !!(e?.detail?.visible);
};

const deleteConstructionMarker = async (markerId) => {
    try {
        // 从场景中移除标记
        const success = removeConstructionMarker(markerId);
        if (success) {
            updateConstructionMarkersList();
            
            // 获取删除后剩余的所有施工标记并广播
            const { invoke } = await import('@tauri-apps/api/core');
            const remainingMarkers = getConstructionMarkersDetails();
            
            const result = await invoke('broadcast_all_construction_markers', {
                markers: remainingMarkers
            });
            
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

let timeInterval = null;
let networkInterval = null;

onMounted(() => {
    // 启动实时更新
    updateTime();
    timeInterval = setInterval(updateTime, 1000);
    
    // 启动网络状态检测
    checkNetworkStatus();
    networkInterval = setInterval(checkNetworkStatus, 30000); // 每30秒检测一次
    
    // 监听网络状态变化
    window.addEventListener('online', checkNetworkStatus);
    window.addEventListener('offline', checkNetworkStatus);
    
    // 监听FPS更新事件
    window.addEventListener('fps-update', handleFPSUpdate);
    
    // 绑定resize事件
    window.addEventListener('resize', handleResize);

    // 根据设置动态控制日志查看器显示
    window.addEventListener('toggle-log-viewer', handleToggleLogViewer);
    
    // 初始化施工标记列表
    updateConstructionMarkersList();
    
    // 监听施工标记变化事件
    window.addEventListener('construction-marker-added', updateConstructionMarkersList);
    window.addEventListener('construction-marker-removed', updateConstructionMarkersList);
});

onBeforeUnmount(() => {
    // 清理定时器和事件
    if (timeInterval) clearInterval(timeInterval);
    if (networkInterval) clearInterval(networkInterval);
    
    window.removeEventListener('fps-update', handleFPSUpdate);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('online', checkNetworkStatus);
    window.removeEventListener('offline', checkNetworkStatus);
    // 移除toggle-log-viewer事件监听器（使用命名函数以确保正确移除）
    window.removeEventListener('toggle-log-viewer', handleToggleLogViewer);
    window.removeEventListener('construction-marker-added', updateConstructionMarkersList);
    window.removeEventListener('construction-marker-removed', updateConstructionMarkersList);
});
</script>

<style lang="scss" scoped>
@use '@/styles/main-layout.scss';
</style>
