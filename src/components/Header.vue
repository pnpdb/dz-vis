<template>
    <!-- 顶部导航栏 -->
    <header class="header">
        <el-popover
            class="center"
            title="关于"
            content=""
            placement="bottom-end"
        >
            <template #reference>
                <div class="logo">
                    <div class="logo-icon">
                        <i class="fas fa-car"></i>
                        <fa icon="car" />
                    </div>
                    <div class="logo-text">DZ CAR MANAGER</div>
                </div>
            </template>
        </el-popover>

        <div class="nav-tabs">
            <TransitionGroup name="fade">
                <button
                    v-for="item in tabs"
                    :key="item.id"
                    :class="{
                        active: selectedTab === item.path,
                        'nav-btn': true,
                    }"
                    @click="selected(item)"
                >
                    <fa :icon="item.icon" /> {{ item.name }}
                </button>
            </TransitionGroup>
        </div>

        <div class="user-section">
            <el-popover
                class="center"
                title="文件管理器"
                content="点击打开指定文件夹"
                placement="bottom-end"
            >
                <template #reference>
                    <button class="notification-btn btn-ripple" @click="openFolder">
                        <fa icon="folder-open" />
                    </button>
                </template>
            </el-popover>
        </div>
    </header>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { TauriUtils } from '@/utils/tauri.js';

const router = useRouter();
const route = useRoute();

const selectedTab = ref('/');
const tabs = ref([
    {
        id: 1,
        path: '/',
        icon: 'car-side',
        name: '车辆信息',
    },
    {
        id: 2,
        path: '/auto-drive',
        icon: 'robot',
        name: '自动驾驶',
    },
    {
        id: 3,
        path: '/control',
        icon: 'sliders-h',
        name: '沙盘控制',
    },
    {
        id: 4,
        path: '/settings',
        icon: 'cog',
        name: '功能设置',
    },
]);

const selected = (item) => {
    selectedTab.value = item.path;
    router.push(item.path);
};

// 打开文件夹 - Tauri 版本
const openFolder = async () => {
    const result = await TauriUtils.openFolder();
    if (result.success) {
        console.log('文件夹已打开');
        await TauriUtils.showNotification('成功', '文件夹已打开');
    } else {
        console.error('打开文件夹失败:', result.error);
        await TauriUtils.showNotification('错误', `打开文件夹失败: ${result.error}`);
    }
};

// 监听路由变化
watch(
    () => route.path,
    (newPath) => {
        selectedTab.value = newPath;
    },
    { immediate: true }
);

onMounted(() => {
    selectedTab.value = route.path;
    
    // 初始化 Tauri 事件监听
    if (TauriUtils.isTauri()) {
        TauriUtils.listenToWindowEvents({
            onResize: (event) => {
                console.log('Window resized:', event);
                // 可以在这里添加窗口大小变化的处理逻辑
            },
            onFocus: () => {
                console.log('Window focused');
            },
            onBlur: () => {
                console.log('Window blurred');
            }
        });
    }
});
</script>

<style lang="scss" scoped>
/* 顶部导航栏 */

.header {
    margin-bottom: 15px;
    background: rgba(15, 30, 47, 0.8);
    border-radius: 16px;
    box-shadow: var(--card-shadow);
    padding: 15px 30px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
    border: 1px solid var(--dark-border);
    backdrop-filter: blur(5px);
    flex-shrink: 0;
    
    /* 启用窗口拖动 */
    -webkit-app-region: drag;
}

.header::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(
        90deg,
        transparent,
        var(--primary),
        transparent
    );
}

.logo {
    display: flex;
    align-items: center;
    gap: 15px;
    cursor: pointer;
    
    /* 禁用拖动以允许点击 */
    -webkit-app-region: no-drag;
}

.logo-icon {
    width: 42px;
    height: 42px;
    background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--dark-bg);
    font-size: 24px;
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.5);
}

.logo-text {
    font-family: 'Orbitron', sans-serif;
    font-size: 22px;
    font-weight: 800;
    background: linear-gradient(90deg, var(--primary), var(--primary-dark));
    background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
}

.nav-tabs {
    display: flex;
    gap: 5px;
    background: var(--darker-card);
    padding: 6px;
    border-radius: 12px;
    border: 1px solid var(--dark-border);
    
    /* 禁用拖动以允许点击 */
    -webkit-app-region: no-drag;
}

.nav-btn {
    padding: 10px 24px;
    border-radius: 10px;
    background: transparent;
    border: none;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    overflow: hidden;
    user-select: none;
    transform: translateZ(0);
    will-change: transform;
}

.nav-btn:hover {
    color: white;
    transform: translateY(-2px) scale(1.02);
}

.nav-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        135deg,
        var(--primary) 0%,
        var(--primary-dark) 100%
    );
    opacity: 0;
    transition: var(--transition);
    z-index: -1;
}

.nav-btn:hover::before {
    opacity: 0.2;
}

.nav-btn.active {
    background: linear-gradient(
        135deg,
        var(--primary) 0%,
        var(--primary-dark) 100%
    );
    color: var(--dark-bg);
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
}

.nav-btn.active i {
    color: var(--dark-bg);
}

.user-section {
    display: flex;
    align-items: center;
    gap: 15px;
    
    /* 禁用拖动以允许点击 */
    -webkit-app-region: no-drag;
}

.notification-btn,
.user-btn {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--darker-card);
    border: 1px solid var(--dark-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    cursor: pointer;
    transition: var(--transition);
    font-weight: 800;
    font-size: 20px;
    font-style: italic;
}

.notification-btn:hover,
.user-btn:hover {
    background: var(--primary);
    color: var(--dark-bg);
    border-color: var(--primary);
    transform: translateY(-2px);
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
}
</style>