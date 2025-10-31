import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';

// Font Awesome Web Fonts 模式（使用 CSS + 字体文件）
// 解决 Ubuntu WebKit compositing 模式下 SVG 图标不显示的问题
import '@fortawesome/fontawesome-free/css/all.css';

import ElementPlus, { ElMessage } from 'element-plus';
import 'element-plus/dist/index.css';
import './styles/main.css';
import './styles/customer.scss';

// 导入自定义 Font Awesome 包装组件（Web Fonts 模式）
import FontAwesomeIcon from '@/components/FontAwesomeIcon.vue';

// Import unified error handling
import { setupGlobalErrorHandler } from '@/utils/errorHandler.js';
import { Environment } from '@/utils/tauri.js';
import { socketManager } from '@/utils/socketManager.js';
import { logger } from '@/utils/logger.js';
import { invoke } from '@tauri-apps/api/core';
import { debug as jsDebug, info as jsInfo, warn as jsWarn, error as jsError } from '@tauri-apps/plugin-log';
import { loadMessageTypesConfig } from '@/constants/messageTypesLoader.js';
import { initPathManager } from '@/utils/pathManager.js';
import Toast from '@/utils/toast.js';

// 将 Toast 暴露到 window 对象供全局使用
window.Toast = Toast;

// 生产环境禁用console.debug，提升性能
if (!Environment.isDevelopment()) {
    const noop = () => {};
    console.debug = noop;
    // 保留原始console用于必要时使用
    window.__originalConsoleDebug = console.debug;
}

// 在Tauri环境启动时初始化配置
if (Environment.isTauri()) {
    try {
        // 读取日志级别
        const appSettings = await invoke('get_app_settings');
        const lvl = (appSettings?.log_level || '').toString().toUpperCase();
        if (lvl) {
            logger.setLevel(lvl);
            try { await jsInfo(`前端日志级别已应用: ${lvl}`); } catch (_) {}
        }
        
        // 预加载消息类型配置（统一前后端定义）
        try {
            await loadMessageTypesConfig();
            await jsInfo('✅ 消息类型配置已从Rust后端加载');
        } catch (e) {
            await jsWarn(`消息类型配置加载失败，使用默认配置: ${e}`);
        }
    } catch (_) {
        // 忽略读取失败
    }
}

// 将 socketManager 暴露到 window 对象供组件使用
window.socketManager = socketManager;

const app = createApp(App);

// 安装统一的全局错误处理器
setupGlobalErrorHandler(app);

// Development mode enhancements
if (Environment.isDevelopment()) {
    app.config.performance = true;
    await jsDebug('DZ Car Manager - Development Mode');
}

app.use(createPinia());
app.use(router);

app.use(ElementPlus, {
    message: {
        max: 0  // 禁用 Element Plus 的 Message 组件
    }
});

// 全局注册 Font Awesome 包装组件（Web Fonts 模式）
app.component('fa', FontAwesomeIcon);

// 挂载应用
const mountedApp = app.mount('#app');

// 完全禁用 Element Plus 的全局 Message，防止误触发
if (app.config.globalProperties.$message) {
    app.config.globalProperties.$message = () => {
        console.warn('Element Plus Message 已被禁用，请使用自定义 Toast');
    };
}

// 覆盖 Element Plus 的 Message 函数，重定向到自定义 Toast
['success', 'warning', 'info', 'error'].forEach(type => {
    ElMessage[type] = (message, options) => {
        console.warn(`Element Plus Message.${type} 被调用，已重定向到自定义 Toast:`, message);
        return Toast[type](typeof message === 'string' ? message : message.message);
    };
});
// 重写主函数
const newElMessage = (options) => {
    const type = options.type || 'info';
    const message = options.message || options;
    console.warn(`Element Plus Message() 被调用，已重定向到自定义 Toast:`, message);
    return Toast[type](typeof message === 'string' ? message : message.message || message);
};
Object.assign(newElMessage, ElMessage);
ElMessage.prototype = newElMessage;

// 初始化路径管理器
initPathManager();

// 初始化应用数据
async function initializeApp() {
    try {
        // JS 侧日志插件测试
        await jsInfo('前端启动 initializeApp');
        // 获取store实例
        const { useCarStore } = await import('./stores/car.js');
        const carStore = useCarStore();
        
        // 加载车辆连接数据
        await jsInfo('正在加载车辆连接数据');
        await carStore.loadVehicleConnections();
        await jsInfo('车辆连接数据加载完成');
    } catch (error) {
        await jsError(`应用初始化失败: ${error}`);
    }
}

// 保存启动定时器ID，用于可能的清理
const startupTimers = {
    appInit: null,
    socketInit: null
};

// 延迟初始化，确保应用完全挂载
startupTimers.appInit = setTimeout(() => {
    initializeApp();
    startupTimers.appInit = null; // 执行后清除
}, 1000);

// 在Tauri环境中启动Socket服务器
const shouldStartSocket = Environment.isTauri() || import.meta.env.TAURI_ENV_PLATFORM;

if (shouldStartSocket) {
    // 延迟启动Socket服务器，确保应用完全初始化
    startupTimers.socketInit = setTimeout(async () => {
        try {
            const result = await socketManager.startServer();
        } catch (error) {
            await jsError('Socket服务器启动失败:', error);
            await jsError('错误详情:', error.stack || error);
        }
        startupTimers.socketInit = null; // 执行后清除
    }, 2000);
} else {
    await jsInfo('不启动Socket服务器');
}

// 暴露清理函数供测试或特殊情况使用
window.__cleanupStartupTimers = () => {
    if (startupTimers.appInit) {
        clearTimeout(startupTimers.appInit);
        startupTimers.appInit = null;
    }
    if (startupTimers.socketInit) {
        clearTimeout(startupTimers.socketInit);
        startupTimers.socketInit = null;
    }
};

// 应用关闭时清理所有资源
window.addEventListener('beforeunload', () => {
    console.log('🧹 应用关闭，清理资源...');
    
    // 清理启动定时器
    window.__cleanupStartupTimers();
    
    // 清理 Scene3D
    try {
        import('@/components/Scene3D/index.js').then(({ destroyScene }) => {
            if (destroyScene) destroyScene();
        }).catch(() => {});
    } catch (e) {}
    
    // 清理路径渲染器
    try {
        import('@/components/Scene3D/pathRenderer.js').then(({ destroyPathRenderer }) => {
            if (destroyPathRenderer) destroyPathRenderer();
        }).catch(() => {});
    } catch (e) {}
    
    // 清理 SocketManager
    if (socketManager && socketManager.cleanup) {
        socketManager.cleanup();
    }
    
    // 清理 VideoProcessor
    if (window.__videoProcessorCleanup) {
        window.__videoProcessorCleanup();
    }
    
    // 清理 Logger
    if (logger && logger.cleanup) {
        logger.cleanup();
    }
    
    console.log('✅ 应用资源清理完成');
});
