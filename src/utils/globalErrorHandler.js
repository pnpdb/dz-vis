/**
 * 全局错误处理器
 * 统一处理前端运行时错误、Promise未捕获错误、资源加载错误等
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
 * 格式化错误信息
 */
function formatError(error, type, context = {}) {
    return {
        type,
        message: error.message || '未知错误',
        stack: error.stack || '',
        name: error.name || 'Error',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        context,
    };
}

/**
 * 判断错误严重级别
 */
function getErrorSeverity(error, type) {
    // Tauri命令错误通常是高优先级
    if (type === ErrorType.TAURI) {
        return ErrorSeverity.HIGH;
    }
    
    // 网络错误
    if (type === ErrorType.NETWORK) {
        return ErrorSeverity.MEDIUM;
    }
    
    // 资源加载错误通常优先级较低
    if (type === ErrorType.RESOURCE) {
        return ErrorSeverity.LOW;
    }
    
    // Promise错误
    if (type === ErrorType.PROMISE) {
        // 根据错误消息判断
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('critical') || msg.includes('fatal')) {
            return ErrorSeverity.CRITICAL;
        }
        return ErrorSeverity.MEDIUM;
    }
    
    // 运行时错误
    if (type === ErrorType.RUNTIME) {
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('cannot read property') || msg.includes('undefined')) {
            return ErrorSeverity.HIGH;
        }
        return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.MEDIUM;
}

/**
 * 显示错误提示
 */
function showErrorMessage(error, severity) {
    const messageConfig = {
        offset: DEFAULTS.MESSAGE_OFFSET,
        duration: severity === ErrorSeverity.CRITICAL ? 0 : 3000,
    };
    
    switch (severity) {
        case ErrorSeverity.CRITICAL:
            ElMessage.error({
                ...messageConfig,
                message: `严重错误: ${error.message}。请刷新页面重试`,
                showClose: true,
            });
            break;
            
        case ErrorSeverity.HIGH:
            ElMessage.error({
                ...messageConfig,
                message: `错误: ${error.message}`,
            });
            break;
            
        case ErrorSeverity.MEDIUM:
            ElMessage.warning({
                ...messageConfig,
                message: error.message,
            });
            break;
            
        case ErrorSeverity.LOW:
        default:
            // 低优先级错误不显示提示
            break;
    }
}

/**
 * 处理错误
 */
function handleError(error, type, context = {}) {
    const formattedError = formatError(error, type, context);
    const severity = getErrorSeverity(error, type);
    
    // 记录日志
    logger.error('GlobalErrorHandler', `[${type}] ${error.message}`, formattedError);
    
    // 显示用户提示
    if (severity !== ErrorSeverity.LOW) {
        showErrorMessage(error, severity);
    }
    
    // 如果是严重错误，可以考虑上报到监控系统
    if (severity === ErrorSeverity.CRITICAL) {
        // TODO: 发送到错误监控系统（如Sentry）
        console.error('CRITICAL ERROR:', formattedError);
    }
}

/**
 * 安装全局错误处理器
 */
export function setupGlobalErrorHandler(app) {
    // 1. Vue错误处理器
    app.config.errorHandler = (err, instance, info) => {
        handleError(err, ErrorType.RUNTIME, {
            componentName: instance?.$options?.name || '未知组件',
            info,
        });
    };
    
    // 2. Vue警告处理器
    app.config.warnHandler = (msg, instance, trace) => {
        logger.warn('GlobalErrorHandler', 'Vue Warning:', { msg, trace });
    };
    
    // 3. 全局未捕获错误
    window.addEventListener('error', (event) => {
        // 区分资源加载错误和运行时错误
        if (event.target !== window) {
            handleError(
                new Error(`资源加载失败: ${event.target.src || event.target.href}`),
                ErrorType.RESOURCE,
                { target: event.target }
            );
        } else {
            handleError(event.error, ErrorType.RUNTIME, {
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
            
        handleError(error, ErrorType.PROMISE, {
            promise: event.promise,
        });
        
        // 阻止默认行为
        event.preventDefault();
    });
}

/**
 * 包装Tauri命令调用，自动处理错误
 */
export function wrapTauriCommand(commandFn, commandName) {
    return async (...args) => {
        try {
            return await commandFn(...args);
        } catch (error) {
            handleError(
                error instanceof Error ? error : new Error(String(error)),
                ErrorType.TAURI,
                { commandName, args }
            );
            throw error; // 重新抛出，让调用者可以决定如何处理
        }
    };
}

/**
 * 包装网络请求，自动处理错误
 */
export function wrapNetworkRequest(requestFn, requestName) {
    return async (...args) => {
        try {
            return await requestFn(...args);
        } catch (error) {
            handleError(
                error instanceof Error ? error : new Error(String(error)),
                ErrorType.NETWORK,
                { requestName, args }
            );
            throw error;
        }
    };
}

export default {
    setupGlobalErrorHandler,
    wrapTauriCommand,
    wrapNetworkRequest,
    ErrorType,
    ErrorSeverity,
};

