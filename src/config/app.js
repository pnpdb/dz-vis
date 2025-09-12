/**
 * Tauri应用配置常量
 */

// 应用信息
export const APP_CONFIG = {
    name: 'DZ Car Manager',
    version: '0.1.0',
    description: '智能车辆管理系统',
    
    // 开发者信息
    developer: {
        name: 'DZ Technologies',
        website: 'https://dz-tech.com',
        contact: 'support@dz-tech.com'
    },
    
    // 环境配置
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    isTauri: typeof window !== 'undefined' && window.__TAURI__ !== undefined,
    
    // 默认设置
    defaults: {
        theme: 'dark',
        language: 'zh-CN',
        autoSave: true,
        animations: true,
        showGrid: false,
        frameRate: 60,
        debugMode: false,
        logLevel: 'info',
        cacheSize: 1000
    }
};

// 性能配置
export const PERFORMANCE_CONFIG = {
    // Three.js 性能配置
    three: {
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
        logarithmicDepthBuffer: false,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false,
        maxPixelRatio: 1.5,
        shadowMap: false,
        sortObjects: false
    },
    
    // 渲染配置
    rendering: {
        targetFPS: 60,
        lowFPSThreshold: 20,
        highFPSThreshold: 50,
        frameSkip: false,
        adaptiveQuality: true
    },
    
    // 内存配置
    memory: {
        maxCacheSize: 100 * 1024 * 1024, // 100MB
        warningThreshold: 0.8, // 80%
        errorThreshold: 0.9, // 90%
        gcInterval: 30000 // 30秒
    }
};

// UI配置
export const UI_CONFIG = {
    // 动画配置
    animations: {
        duration: 300,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        disabled: false
    },
    
    // 布局配置
    layout: {
        headerHeight: 80,
        sidebarWidth: 280,
        minWindowWidth: 1200,
        minWindowHeight: 800
    },
    
    // 组件配置
    components: {
        updateInterval: 1000, // 1秒
        errorRetryCount: 3,
        loadingTimeout: 10000 // 10秒
    }
};

// 网络配置
export const NETWORK_CONFIG = {
    timeout: 10000, // 10秒
    retryCount: 3,
    retryDelay: 1000, // 1秒
    
    // API配置
    api: {
        baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
        timeout: 5000
    },
    
    // WebSocket配置
    websocket: {
        reconnectInterval: 5000, // 5秒
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000 // 30秒
    }
};

// 存储配置
export const STORAGE_CONFIG = {
    // LocalStorage键名
    keys: {
        settings: 'dz-car-manager-settings',
        userPrefs: 'dz-car-manager-user-prefs',
        cache: 'dz-car-manager-cache',
        logs: 'dz-car-manager-logs'
    },
    
    // 过期时间
    expiry: {
        cache: 24 * 60 * 60 * 1000, // 24小时
        logs: 7 * 24 * 60 * 60 * 1000, // 7天
        userPrefs: 30 * 24 * 60 * 60 * 1000 // 30天
    }
};

// 日志配置
export const LOG_CONFIG = {
    levels: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    },
    
    // 当前日志级别
    currentLevel: import.meta.env.DEV ? 0 : 2, // 开发环境DEBUG，生产环境WARN
    
    // 日志格式
    format: {
        timestamp: true,
        level: true,
        component: true,
        stack: false // 仅错误级别显示堆栈
    },
    
    // 输出配置
    output: {
        console: true,
        file: false, // Tauri中可以启用文件日志
        remote: false // 远程日志服务
    }
};

// 导出所有配置
export default {
    APP_CONFIG,
    PERFORMANCE_CONFIG,
    UI_CONFIG,
    NETWORK_CONFIG,
    STORAGE_CONFIG,
    LOG_CONFIG
};
