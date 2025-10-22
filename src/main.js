import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';

// Font Awesome Web Fonts 模式（使用 CSS + 字体文件）
// 解决 Ubuntu WebKit compositing 模式下 SVG 图标不显示的问题
import '@fortawesome/fontawesome-free/css/all.css';

import ElementPlus from 'element-plus';
import 'element-plus/theme-chalk/dark/css-vars.css';
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
        offset: 40  // 为自定义标题栏（30px）留出空间，额外留10px边距
    }
});

// 全局注册 Font Awesome 包装组件（Web Fonts 模式）
app.component('fa', FontAwesomeIcon);

// 挂载应用
const mountedApp = app.mount('#app');

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

// 延迟初始化，确保应用完全挂载
setTimeout(() => {
    initializeApp();
}, 1000);

// 在Tauri环境中启动Socket服务器
const shouldStartSocket = Environment.isTauri() || import.meta.env.TAURI_ENV_PLATFORM;

if (shouldStartSocket) {
    // 延迟启动Socket服务器，确保应用完全初始化
    setTimeout(async () => {
        try {
            const result = await socketManager.startServer();
        } catch (error) {
            await jsError('Socket服务器启动失败:', error);
            await jsError('错误详情:', error.stack || error);
        }
    }, 2000); // 增加延迟时间
} else {
    await jsInfo('不启动Socket服务器');
}
