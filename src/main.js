import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';

import '@/icons/index.js'; // 图标库
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

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

app.mount('#app');

// 在Tauri环境中启动Socket服务器
console.log('🔍 检查Tauri环境:', Environment.isTauri());

if (Environment.isTauri()) {
    console.log('✅ 在Tauri环境中，准备启动Socket服务器');
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
    console.log('⚠️ 不在Tauri环境中，跳过Socket服务器启动');
}
