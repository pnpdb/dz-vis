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
