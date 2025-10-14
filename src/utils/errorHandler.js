/**
 * 统一错误处理系统
 * 整合了全局错误捕获、错误分类、日志记录和用户通知
 */

import { ElMessage } from 'element-plus';
import { logger } from '@/utils/logger';
import { DEFAULTS } from '@/config/constants';

/**
 * 错误类型枚举
 */
export const ErrorType = {
    RUNTIME: 'RUNTIME',           // 运行时错误
    PROMISE: 'PROMISE',           // Promise未捕获错误
    RESOURCE: 'RESOURCE',         // 资源加载错误
    NETWORK: 'NETWORK',           // 网络错误
    TAURI: 'TAURI',              // Tauri命令错误
    VUE: 'VUE',                  // Vue组件错误
    UNKNOWN: 'UNKNOWN',          // 未知错误
};

/**
 * 错误严重级别
 */
export const ErrorSeverity = {
    LOW: 'LOW',                   // 低 - 仅记录日志
    MEDIUM: 'MEDIUM',             // 中 - 记录日志+用户提示
    HIGH: 'HIGH',                 // 高 - 记录日志+用户提示+可能影响功能
    CRITICAL: 'CRITICAL',         // 严重 - 记录日志+用户提示+需要重启
};

/**
 * 自定义错误类
 */
export class TauriError extends Error {
    constructor(message, code = null) {
        super(message);
        this.name = 'TauriError';
        this.code = code;
        this.timestamp = new Date().toISOString();
    }
}

export class NetworkError extends Error {
    constructor(message, statusCode = null) {
        super(message);
        this.name = 'NetworkError';
        this.statusCode = statusCode;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * 统一错误处理器
 */
export class ErrorHandler {
    static errorQueue = [];
    static maxQueueSize = 50;
    static listeners = new Set(); // 错误监听器

    /**
     * 格式化错误信息
     * @private
     */
    static formatError(error, type, context = {}) {
        return {
            id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            message: error.message || '未知错误',
            stack: error.stack || '',
            name: error.name || 'Error',
            code: error.code,
            timestamp: new Date().toISOString(),
            severity: this.getSeverity(error, type),
            userAgent: navigator.userAgent,
            url: window.location.href,
            context,
        };
    }

    /**
     * 判断错误严重级别
     * @private
     */
    static getSeverity(error, type) {
        // 自定义错误类型
        if (error instanceof TauriError) {
            return ErrorSeverity.HIGH;
        }
        if (error instanceof NetworkError) {
            return ErrorSeverity.MEDIUM;
        }

        // 基于错误类型判断
        if (type === ErrorType.TAURI) {
            return ErrorSeverity.HIGH;
        }
        if (type === ErrorType.NETWORK) {
            return ErrorSeverity.MEDIUM;
        }
        if (type === ErrorType.RESOURCE) {
            return ErrorSeverity.LOW;
        }

        // 基于错误消息判断
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('critical') || msg.includes('fatal') || msg.includes('crash')) {
            return ErrorSeverity.CRITICAL;
        }
        if (msg.includes('cannot read property') || msg.includes('undefined is not')) {
            return ErrorSeverity.HIGH;
        }

        // Promise和运行时错误
        if (type === ErrorType.PROMISE || type === ErrorType.RUNTIME || type === ErrorType.VUE) {
            return ErrorSeverity.MEDIUM;
        }

        return ErrorSeverity.MEDIUM;
    }

    /**
     * 处理错误（主入口）
     * @param {Error} error - 错误对象
     * @param {string} type - 错误类型
     * @param {Object} context - 上下文信息
     * @returns {Object} 格式化的错误信息
     */
    static handle(error, type = ErrorType.UNKNOWN, context = {}) {
        const formattedError = this.formatError(error, type, context);

        // 添加到错误队列
        this.addToQueue(formattedError);

        // 记录日志
        this.logError(formattedError);

        // 显示用户通知
        this.showNotification(formattedError);

        // 触发监听器
        this.emitError(formattedError);

        // 严重错误特殊处理
        if (formattedError.severity === ErrorSeverity.CRITICAL) {
            this.handleCriticalError(formattedError);
        }

        return formattedError;
    }

    /**
     * 添加到错误队列
     * @private
     */
    static addToQueue(errorInfo) {
        this.errorQueue.unshift(errorInfo);
        if (this.errorQueue.length > this.maxQueueSize) {
            this.errorQueue = this.errorQueue.slice(0, this.maxQueueSize);
        }
    }

    /**
     * 记录日志
     * @private
     */
    static logError(errorInfo) {
        const logMethod = errorInfo.severity === ErrorSeverity.CRITICAL || errorInfo.severity === ErrorSeverity.HIGH
            ? 'error'
            : 'warn';

        logger[logMethod](
            'ErrorHandler',
            `[${errorInfo.type}] ${errorInfo.message}`,
            errorInfo
        );
    }

    /**
     * 显示用户通知
     * @private
     */
    static showNotification(errorInfo) {
        // 低优先级错误不显示通知
        if (errorInfo.severity === ErrorSeverity.LOW) {
            return;
        }

        const messageConfig = {
            offset: DEFAULTS?.MESSAGE_OFFSET || 60,
            duration: errorInfo.severity === ErrorSeverity.CRITICAL ? 0 : 3000,
        };

        switch (errorInfo.severity) {
            case ErrorSeverity.CRITICAL:
                ElMessage.error({
                    ...messageConfig,
                    message: `严重错误: ${errorInfo.message}。请刷新页面重试`,
                    showClose: true,
                });
                break;

            case ErrorSeverity.HIGH:
                ElMessage.error({
                    ...messageConfig,
                    message: `错误: ${errorInfo.message}`,
                });
                break;

            case ErrorSeverity.MEDIUM:
                ElMessage.warning({
                    ...messageConfig,
                    message: errorInfo.message,
                });
                break;

            default:
                break;
        }
    }

    /**
     * 触发错误监听器
     * @private
     */
    static emitError(errorInfo) {
        this.listeners.forEach(listener => {
            try {
                listener(errorInfo);
            } catch (err) {
                console.error('错误监听器执行失败:', err);
            }
        });
    }

    /**
     * 处理严重错误
     * @private
     */
    static handleCriticalError(errorInfo) {
        console.error('🚨 CRITICAL ERROR:', errorInfo);
        // TODO: 发送到错误监控系统（如Sentry）
        // 可以在这里添加自动上报逻辑
    }

    /**
     * 订阅错误事件
     * @param {Function} listener - 监听器函数
     * @returns {Function} 取消订阅函数
     */
    static subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * 获取最近的错误
     * @param {number} limit - 数量限制
     * @returns {Array} 错误列表
     */
    static getRecentErrors(limit = 10) {
        return this.errorQueue.slice(0, limit);
    }

    /**
     * 清空错误队列
     */
    static clearErrors() {
        this.errorQueue = [];
    }

    /**
     * 获取错误统计
     * @returns {Object} 统计信息
     */
    static getStatistics() {
        const stats = {
            total: this.errorQueue.length,
            byType: {},
            bySeverity: {},
        };

        this.errorQueue.forEach(error => {
            stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
            stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
        });

        return stats;
    }
}

/**
 * 安装全局错误处理器
 * @param {Object} app - Vue应用实例
 */
export function setupGlobalErrorHandler(app) {
    // 1. Vue错误处理器
    if (app) {
        app.config.errorHandler = (err, instance, info) => {
            ErrorHandler.handle(err, ErrorType.VUE, {
                componentName: instance?.$options?.name || instance?.__name || '未知组件',
                info,
            });
        };

        // 2. Vue警告处理器
        app.config.warnHandler = (msg, instance, trace) => {
            logger.warn('ErrorHandler', 'Vue Warning:', { msg, trace });
        };
    }

    // 3. 全局未捕获错误
    window.addEventListener('error', (event) => {
        // 区分资源加载错误和运行时错误
        if (event.target !== window) {
            ErrorHandler.handle(
                new Error(`资源加载失败: ${event.target.src || event.target.href}`),
                ErrorType.RESOURCE,
                {
                    tagName: event.target.tagName,
                    src: event.target.src,
                    href: event.target.href,
                }
            );
        } else if (event.error) {
            ErrorHandler.handle(event.error, ErrorType.RUNTIME, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
            });
        }

        // 阻止默认行为
        event.preventDefault();
    }, true);

    // 4. 全局未捕获Promise错误
    window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error
            ? event.reason
            : new Error(String(event.reason));

        ErrorHandler.handle(error, ErrorType.PROMISE, {
            promise: event.promise,
        });

        // 阻止默认行为
        event.preventDefault();
    });

    logger.info('ErrorHandler', '全局错误处理器已安装');
}

/**
 * 包装Tauri命令调用，自动处理错误
 * @param {Function} commandFn - Tauri命令函数
 * @param {string} commandName - 命令名称
 * @returns {Function} 包装后的函数
 */
export function wrapTauriCommand(commandFn, commandName) {
    return async (...args) => {
        try {
            return await commandFn(...args);
        } catch (error) {
            const err = error instanceof Error ? error : new TauriError(String(error));
            ErrorHandler.handle(err, ErrorType.TAURI, { commandName, args });
            throw err; // 重新抛出，让调用者可以决定如何处理
        }
    };
}

/**
 * 包装网络请求，自动处理错误
 * @param {Function} requestFn - 网络请求函数
 * @param {string} requestName - 请求名称
 * @returns {Function} 包装后的函数
 */
export function wrapNetworkRequest(requestFn, requestName) {
    return async (...args) => {
        try {
            return await requestFn(...args);
        } catch (error) {
            const err = error instanceof Error ? error : new NetworkError(String(error));
            ErrorHandler.handle(err, ErrorType.NETWORK, { requestName, args });
            throw err;
        }
    };
}

/**
 * 创建错误边界包装器（用于组件）
 * @param {Function} fn - 要包装的函数
 * @param {string} context - 上下文描述
 * @returns {Function} 包装后的函数
 */
export function withErrorBoundary(fn, context = 'unknown') {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            ErrorHandler.handle(err, ErrorType.RUNTIME, { context, args });
            throw err;
        }
    };
}

// 默认导出
export default {
    ErrorHandler,
    setupGlobalErrorHandler,
    wrapTauriCommand,
    wrapNetworkRequest,
    withErrorBoundary,
    ErrorType,
    ErrorSeverity,
    TauriError,
    NetworkError,
};
