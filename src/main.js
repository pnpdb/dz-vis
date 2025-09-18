import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';

import '@/icons/index.js'; // 图标库
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
// 避免自动注入样式导致在不同平台/打包环境下样式缺失或冲突
config.autoAddCss = false;

import ElementPlus from 'element-plus';
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'element-plus/dist/index.css';
import './styles/main.css';
import './styles/customer.scss';

// Import error handling
import { setupGlobalErrorHandling, ErrorHandler } from '@/utils/errorHandler.js';
import { Environment } from '@/utils/tauri.js';
import { socketManager } from '@/utils/socketManager.js';

// Setup global error handling
setupGlobalErrorHandling();

const app = createApp(App);

// Error handling for Vue app
app.config.errorHandler = (err, instance, info) => {
    ErrorHandler.handle(err, {
        type: 'vueError',
        component: instance?.$?.type?.name || 'Unknown',
        info
    });
};

// Development mode enhancements
if (Environment.isDevelopment()) {
    app.config.performance = true;
    console.log('🚀 DZ Car Manager - Development Mode');
    console.log('📊 Environment:', {
        mode: Environment.getMode(),
        isTauri: Environment.isTauri(),
        baseUrl: Environment.getBaseUrl()
    });
}

app.use(createPinia());
app.use(router);

app.use(ElementPlus, {
    // Element Plus configuration can go here
});

// 全局注册Font Awesome组件
app.component('fa', FontAwesomeIcon);

// 挂载应用
const mountedApp = app.mount('#app');

// 初始化应用数据
async function initializeApp() {
    try {
        // 获取store实例
        const { useCarStore } = await import('./stores/car.js');
        const carStore = useCarStore();
        
        // 加载车辆连接数据
        console.log('🚗 正在加载车辆连接数据...');
        await carStore.loadVehicleConnections();
        console.log('✅ 车辆连接数据加载完成');
    } catch (error) {
        console.error('❌ 应用初始化失败:', error);
    }
}

// 延迟初始化，确保应用完全挂载
setTimeout(() => {
    initializeApp();
}, 1000);

// 在Tauri环境中启动Socket服务器
console.log('🔍 调试Tauri环境检测:');
console.log('  - window.__TAURI_INTERNALS__:', typeof window !== 'undefined' ? '__TAURI_INTERNALS__' in window : 'window未定义');
console.log('  - window.__TAURI__:', typeof window !== 'undefined' ? '__TAURI__' in window : 'window未定义');
console.log('  - import.meta.env.DEV:', import.meta.env.DEV);
console.log('  - import.meta.env.TAURI_ENV_PLATFORM:', import.meta.env.TAURI_ENV_PLATFORM);
console.log('  - Environment.isTauri():', Environment.isTauri());

// 强制启动Socket服务器进行调试（临时）
const shouldStartSocket = Environment.isTauri() || import.meta.env.TAURI_ENV_PLATFORM;

console.log('🔍 检查是否应启动Socket服务器:', shouldStartSocket);

if (shouldStartSocket) {
    console.log('✅ 准备启动Socket服务器');
    // 延迟启动Socket服务器，确保应用完全初始化
    setTimeout(async () => {
        try {
            console.log('🚀 开始启动Socket服务器...');
            const result = await socketManager.startServer(8888);
            console.log('✅ Socket服务器启动成功:', result);
        } catch (error) {
            console.error('❌ Socket服务器启动失败:', error);
            console.error('错误详情:', error.stack || error);
        }
    }, 2000); // 增加延迟时间
} else {
    console.log('⚠️ 不启动Socket服务器');
}
