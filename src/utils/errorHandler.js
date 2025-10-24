/**
 * 统一错误处理工具
 * 提供一致的错误处理、日志记录和用户反馈机制
 */

/**
 * 错误级别
 */
export const ErrorLevel = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    FATAL: 'fatal'
};

/**
 * 错误类别
 */
export const ErrorCategory = {
    VALIDATION: 'validation',      // 验证错误
    NETWORK: 'network',            // 网络错误
    RESOURCE: 'resource',          // 资源错误
    PERMISSION: 'permission',      // 权限错误
    STATE: 'state',                // 状态错误
    UNKNOWN: 'unknown'             // 未知错误
};

/**
 * 应用错误类（扩展原生 Error）
 */
export class AppError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = 'AppError';
        this.level = options.level || ErrorLevel.ERROR;
        this.category = options.category || ErrorCategory.UNKNOWN;
        this.code = options.code;
        this.context = options.context || {};
        this.timestamp = new Date();
        this.originalError = options.originalError;
        
        // 保持正确的堆栈跟踪
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }
    
    /**
     * 转换为日志友好的格式
     */
    toLogFormat() {
        return {
            name: this.name,
            message: this.message,
            level: this.level,
            category: this.category,
            code: this.code,
            context: this.context,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack
        };
    }
}

/**
 * 错误处理器类
 */
class ErrorHandler {
    constructor() {
        this.errorListeners = [];
        this.errorHistory = [];
        this.maxHistorySize = 100;
    }
    
    /**
     * 注册错误监听器
     * @param {Function} listener - 监听器函数
     */
    addListener(listener) {
        if (typeof listener === 'function') {
            this.errorListeners.push(listener);
        }
    }
    
    /**
     * 移除错误监听器
     * @param {Function} listener - 监听器函数
     */
    removeListener(listener) {
        const index = this.errorListeners.indexOf(listener);
        if (index > -1) {
            this.errorListeners.splice(index, 1);
        }
    }
    
    /**
     * 处理错误
     * @param {Error|AppError|string} error - 错误对象或消息
     * @param {Object} options - 选项
     */
    handle(error, options = {}) {
        let appError;
        
        // 将普通错误转换为 AppError
        if (error instanceof AppError) {
            appError = error;
        } else if (error instanceof Error) {
            appError = new AppError(error.message, {
                ...options,
                originalError: error
            });
        } else if (typeof error === 'string') {
            appError = new AppError(error, options);
        } else {
            appError = new AppError('未知错误', {
                ...options,
                context: { originalError: error }
            });
        }
        
        // 记录到历史
        this.addToHistory(appError);
        
        // 日志输出
        this.logError(appError);
        
        // 通知监听器
        this.notifyListeners(appError);
        
        return appError;
    }
    
    /**
     * 记录错误到历史
     */
    addToHistory(error) {
        this.errorHistory.push(error);
        
        // 限制历史记录大小
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }
    }
    
    /**
     * 日志输出
     */
    logError(error) {
        const logData = error.toLogFormat();
        
        switch (error.level) {
            case ErrorLevel.DEBUG:
                console.debug(`[${error.category}]`, logData);
                break;
            case ErrorLevel.INFO:
                console.info(`[${error.category}]`, logData);
                break;
            case ErrorLevel.WARN:
                console.warn(`⚠️ [${error.category}]`, logData.message, logData);
                break;
            case ErrorLevel.ERROR:
                console.error(`❌ [${error.category}]`, logData.message, logData);
                break;
            case ErrorLevel.FATAL:
                console.error(`💥 [FATAL][${error.category}]`, logData.message, logData);
                break;
            default:
                console.log(`[${error.category}]`, logData);
        }
    }
    
    /**
     * 通知监听器
     */
    notifyListeners(error) {
        this.errorListeners.forEach(listener => {
            try {
                listener(error);
            } catch (e) {
                console.error('错误监听器执行失败:', e);
            }
        });
    }
    
    /**
     * 获取错误历史
     */
    getHistory(filter = null) {
        if (!filter) {
            return [...this.errorHistory];
        }
        
        return this.errorHistory.filter(filter);
    }
    
    /**
     * 清空错误历史
     */
    clearHistory() {
        this.errorHistory = [];
    }
    
    /**
     * 获取错误统计
     */
    getStats() {
        const stats = {
            total: this.errorHistory.length,
            byLevel: {},
            byCategory: {}
        };
        
        this.errorHistory.forEach(error => {
            // 按级别统计
            stats.byLevel[error.level] = (stats.byLevel[error.level] || 0) + 1;
            
            // 按类别统计
            stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
        });
        
        return stats;
    }
}

// 全局错误处理器实例（单例）
const globalErrorHandler = new ErrorHandler();

/**
 * 包装异步函数，自动处理错误
 * @param {Function} fn - 异步函数
 * @param {Object} errorOptions - 错误选项
 * @returns {Function} 包装后的函数
 */
export function wrapAsync(fn, errorOptions = {}) {
    return async function (...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            const handledError = globalErrorHandler.handle(error, errorOptions);
            
            // 如果需要重新抛出错误
            if (errorOptions.rethrow !== false) {
                throw handledError;
            }
            
            return errorOptions.defaultValue;
        }
    };
}

/**
 * 包装同步函数，自动处理错误
 * @param {Function} fn - 同步函数
 * @param {Object} errorOptions - 错误选项
 * @returns {Function} 包装后的函数
 */
export function wrapSync(fn, errorOptions = {}) {
    return function (...args) {
        try {
            return fn.apply(this, args);
        } catch (error) {
            const handledError = globalErrorHandler.handle(error, errorOptions);
            
            // 如果需要重新抛出错误
            if (errorOptions.rethrow !== false) {
                throw handledError;
            }
            
            return errorOptions.defaultValue;
        }
    };
}

/**
 * 创建特定类别的错误处理器
 * @param {string} category - 错误类别
 * @param {Object} defaultOptions - 默认选项
 * @returns {Object} 错误处理器方法集
 */
export function createCategoryHandler(category, defaultOptions = {}) {
    return {
        handle: (error, options = {}) => {
            return globalErrorHandler.handle(error, {
                category,
                ...defaultOptions,
                ...options
            });
        },
        
        wrapAsync: (fn, options = {}) => {
            return wrapAsync(fn, {
                category,
                ...defaultOptions,
                ...options
            });
        },
        
        wrapSync: (fn, options = {}) => {
            return wrapSync(fn, {
                category,
                ...defaultOptions,
                ...options
            });
        }
    };
}

// 导出全局错误处理器
export default globalErrorHandler;

// 便捷方法
export const handleError = (error, options) => globalErrorHandler.handle(error, options);
export const getErrorHistory = (filter) => globalErrorHandler.getHistory(filter);
export const getErrorStats = () => globalErrorHandler.getStats();
export const clearErrorHistory = () => globalErrorHandler.clearHistory();
export const addErrorListener = (listener) => globalErrorHandler.addListener(listener);
export const removeErrorListener = (listener) => globalErrorHandler.removeListener(listener);

/**
 * 为 Vue 应用设置全局错误处理器
 * @param {Vue.App} app - Vue 应用实例
 */
export function setupGlobalErrorHandler(app) {
    if (!app) {
        console.warn('⚠️ setupGlobalErrorHandler: Vue 应用实例未提供');
        return;
    }
    
    // 设置 Vue 全局错误处理器
    app.config.errorHandler = (err, instance, info) => {
        const error = globalErrorHandler.handle(err, {
            level: ErrorLevel.ERROR,
            category: ErrorCategory.UNKNOWN,
            context: {
                componentName: instance?.$options?.name || '未知组件',
                info
            }
        });
        
        // 在开发环境下重新抛出错误以便调试
        if (import.meta.env.DEV) {
            console.error('Vue Error:', error);
        }
    };
    
    // 设置 Vue 警告处理器
    app.config.warnHandler = (msg, instance, trace) => {
        globalErrorHandler.handle(msg, {
            level: ErrorLevel.WARN,
            category: ErrorCategory.UNKNOWN,
            context: {
                componentName: instance?.$options?.name || '未知组件',
                trace
            }
        });
    };
    
    // 设置全局未捕获错误处理器
    window.addEventListener('error', (event) => {
        globalErrorHandler.handle(event.error || event.message, {
            level: ErrorLevel.ERROR,
            category: ErrorCategory.UNKNOWN,
            context: {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            }
        });
    });
    
    // 设置全局未捕获 Promise 错误处理器
    window.addEventListener('unhandledrejection', (event) => {
        globalErrorHandler.handle(event.reason, {
            level: ErrorLevel.ERROR,
            category: ErrorCategory.UNKNOWN,
            context: {
                promise: event.promise,
                type: 'unhandledRejection'
            }
        });
    });
    
    console.info('✅ 全局错误处理器已安装');
}
