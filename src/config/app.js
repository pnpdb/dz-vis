/**
 * Tauri应用配置常量
 */

// 检测是否在Tauri环境中
const detectTauriEnvironment = () => {
    // 官方推荐的检测方法 - 使用多种检测方式确保准确性
    if (typeof window !== 'undefined') {
        // Tauri v2 主要检测方法
        if ('__TAURI_INTERNALS__' in window) {
            return true;
        }
        
        // Tauri v1 兼容性检测
        if ('__TAURI__' in window) {
            return true;
        }
        
        // 检测 Tauri API 是否可用
        try {
            return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
        } catch (e) {
            // 如果在开发环境且有 Tauri 相关的 meta 信息
            if (import.meta.env.DEV && import.meta.env.TAURI_ENV_PLATFORM) {
                return true;
            }
        }
    }
    return false;
};

// 应用信息
export const APP_CONFIG = {
    name: 'DZ Car Manager',
    version: '1.100',
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
    isTauri: detectTauriEnvironment(),
    
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

// 网络配置 - 将从Rust配置中动态获取
export const NETWORK_CONFIG = {
    timeout: 10000, // 10秒
    retryCount: 3,
    retryDelay: 1000, // 1秒
    
    // API配置
    api: {
        baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
        timeout: 5000
    },
    
    // Socket服务器配置 - 这些值将被Rust配置覆盖
    socket: {
        defaultPort: 8888, // 默认值，实际将从Rust获取
        heartbeatInterval: 10000, // 10秒
        connectionTimeout: 30000, // 30秒
        maxConnections: 100
    }
};

// 配置获取函数 - 从Rust后端获取统一配置
let cachedConfig = null;

export const getAppConfig = async () => {
    if (cachedConfig) {
        return cachedConfig;
    }
    
    try {
        // 检查是否在Tauri环境中
        if (APP_CONFIG.isTauri) {
            const { invoke } = await import('@tauri-apps/api/core');
            const rustConfig = await invoke('get_app_config');
            
            // 合并配置，Rust配置优先
            cachedConfig = {
                ...APP_CONFIG,
                ports: rustConfig.ports,
                performance: {
                    ...PERFORMANCE_CONFIG,
                    ...rustConfig.performance
                },
                network: {
                    ...NETWORK_CONFIG,
                    timeout: rustConfig.network.timeout,
                    retryCount: rustConfig.network.retry_count,
                    retryDelay: rustConfig.network.retry_delay,
                    socket: {
                        ...NETWORK_CONFIG.socket,
                        defaultPort: rustConfig.ports.socket_server,
                        heartbeatInterval: rustConfig.network.heartbeat_interval
                    }
                }
            };
        } else {
            // Web环境使用默认配置
            cachedConfig = {
                ...APP_CONFIG,
                performance: PERFORMANCE_CONFIG,
                network: NETWORK_CONFIG
            };
        }
        
        return cachedConfig;
    } catch (error) {
        console.warn('获取Rust配置失败，使用默认配置:', error);
        
        // 失败时使用默认配置
        cachedConfig = {
            ...APP_CONFIG,
            performance: PERFORMANCE_CONFIG,
            network: NETWORK_CONFIG
        };
        
        return cachedConfig;
    }
};

// 获取端口配置的快捷函数
export const getPortConfig = async () => {
    try {
        if (APP_CONFIG.isTauri) {
            const { invoke } = await import('@tauri-apps/api/core');
            return await invoke('get_port_config');
        }
    } catch (error) {
        console.warn('获取端口配置失败，使用默认配置:', error);
    }
    
    // 返回默认端口配置
    return {
        socket_server: 8888,
        udp_video_server: 8080,
        video_stream_server: 9001,
        hls_server: 9002
    };
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
    
    // 初始日志级别（会被SQLite配置覆盖）
    currentLevel: import.meta.env.DEV ? 0 : 2, // 开发环境DEBUG，生产环境WARN（仅作为初始值）
    
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
