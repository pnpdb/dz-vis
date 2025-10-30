/**
 * 统一日志工具 - 适配Tauri环境
 */

import { LOG_CONFIG } from '@/config/app.js';
import { debug as plDebug, info as plInfo, warn as plWarn, error as plError } from '@tauri-apps/plugin-log';

class Logger {
    constructor() {
        this.config = LOG_CONFIG;
        this.logBuffer = [];
        this.maxBufferSize = 1000;

        // 高频日志节流（每 key 至多 interval 输出一次到插件日志）
        this.throttleMap = new Map(); // key -> { last:number, timer:any, pending:{level,component,args} }
        this.defaultThrottleMs = 200; // 200ms 合并一次
        this.maxThrottleMapSize = 100; // 限制 throttleMap 大小，防止内存泄漏

        // 订阅者（用于前端实时日志查看器）
        this.listeners = new Set(); // (entry) => void
        
        // 定期清理 throttleMap 中过期的键
        this.startThrottleMapCleanup();
    }
    
    /**
     * 启动 throttleMap 清理定时器（防止无限增长）
     */
    startThrottleMapCleanup() {
        if (typeof window === 'undefined') return;
        
        this.throttleMapCleanupTimer = setInterval(() => {
            if (this.throttleMap.size <= this.maxThrottleMapSize) return;
            
            const now = Date.now();
            const maxAge = 60000; // 1分钟未使用的键视为过期
            const keysToDelete = [];
            
            for (const [key, value] of this.throttleMap.entries()) {
                if (now - value.last > maxAge) {
                    if (value.timer) clearTimeout(value.timer);
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => this.throttleMap.delete(key));
            
            if (keysToDelete.length > 0) {
                console.debug(`🧹 Logger throttleMap 清理了 ${keysToDelete.length} 个过期键`);
            }
        }, 30000); // 每30秒清理一次
    }
    
    /**
     * 清理所有资源
     */
    cleanup() {
        if (this.throttleMapCleanupTimer) {
            clearInterval(this.throttleMapCleanupTimer);
            this.throttleMapCleanupTimer = null;
        }
        
        // 清理所有待处理的定时器
        for (const [key, value] of this.throttleMap.entries()) {
            if (value.timer) clearTimeout(value.timer);
        }
        this.throttleMap.clear();
        
        console.log('✅ Logger 资源已清理');
    }

    /**
     * 检查日志级别是否应该输出
     * @param {number} level - 日志级别
     * @returns {boolean}
     */
    shouldLog(level) {
        return level >= this.config.currentLevel;
    }

    /**
     * 格式化日志消息
     * @param {string} level - 日志级别
     * @param {string} component - 组件名
     * @param {Array} args - 日志参数
     * @returns {object}
     */
    formatMessage(level, component, args) {
        const safeToString = (arg) => {
            if (arg == null) return String(arg);
            if (typeof arg === 'string') return arg;
            if (typeof arg !== 'object') return String(arg);
            try {
                // 避免循环引用与超大对象
                return JSON.stringify(arg, (key, value) => {
                    if (key === 'target' || key === 'srcElement' || key === 'currentTarget') return undefined;
                    return value;
                });
            } catch (_) {
                try {
                    return Object.prototype.toString.call(arg);
                } catch (__) {
                    return '[Unserializable Object]';
                }
            }
        };

        let message = args.map(safeToString).join(' ');
        // 限制单条日志长度，避免阻塞控制台
        if (message.length > 4000) {
            message = message.slice(0, 4000) + '... [truncated]';
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            component,
            message,
            raw: args
        };

        this.addToBuffer(logEntry);
        return logEntry;
    }

    /**
     * 添加到日志缓冲区
     * @param {object} logEntry - 日志条目
     */
    addToBuffer(logEntry) {
        this.logBuffer.push(logEntry);
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift();
        }

        // 通知订阅者
        if (this.listeners.size > 0) {
            try {
                this.listeners.forEach(cb => {
                    try { cb(logEntry); } catch (_) {}
                });
            } catch (_) {}
        }
    }

    /**
     * 输出日志到控制台
     * @param {object} logEntry - 日志条目
     */
    outputToConsole(logEntry) {
        if (!this.config.output.console) return;

        const { level, timestamp, component, message } = logEntry;
        const prefix = this.config.format.timestamp 
            ? `[${timestamp}]` 
            : '';
        const componentPrefix = this.config.format.component && component
            ? `[${component}]`
            : '';
        const levelPrefix = this.config.format.level
            ? `[${level}]`
            : '';

        const fullMessage = `${prefix}${levelPrefix}${componentPrefix} ${message}`;

        switch (level) {
            case 'DEBUG':
                console.debug(`%c${fullMessage}`, 'color: #888; font-size: 12px;');
                break;
            case 'INFO':
                console.info(`%c${fullMessage}`, 'color: #0066cc;');
                break;
            case 'WARN':
                console.warn(`%c${fullMessage}`, 'color: #ff8800;');
                break;
            case 'ERROR':
                console.error(`%c${fullMessage}`, 'color: #cc0000; font-weight: bold;');
                break;
            default:
                console.log(fullMessage);
        }
    }

    /**
     * 通用日志方法
     * @param {string} level - 日志级别
     * @param {string} component - 组件名
     * @param {...any} args - 日志参数
     */
    log(level, component, ...args) {
        const levelValue = this.config.levels[level.toUpperCase()];
        
        if (!this.shouldLog(levelValue)) return;

        const logEntry = this.formatMessage(level.toUpperCase(), component, args);
        
        // 输出到控制台
        this.outputToConsole(logEntry);

        // 输出到 Tauri 插件日志（仅在存在 Tauri 环境时）
        if (window.__TAURI__?.metadata) {
            this.outputToPlugin(level.toUpperCase(), component, args);
        }
    }

    // 将日志输出到插件（带节流选项）
    outputToPlugin(level, component, args, options = {}) {
        const { throttle = false, throttleKey = null, interval = this.defaultThrottleMs } = options;

        if (!throttle) {
            return this.writePlugin(level, component, args);
        }

        const key = throttleKey || `${level}|${component}`;
        const now = Date.now();
        const prev = this.throttleMap.get(key);

        if (!prev) {
            this.throttleMap.set(key, { last: now, timer: null, pending: null });
            return this.writePlugin(level, component, args);
        }

        // 如果间隔已过，立即输出并更新时间；否则合并为待处理
        if (now - prev.last >= interval) {
            prev.last = now;
            this.throttleMap.set(key, prev);
            return this.writePlugin(level, component, args);
        } else {
            prev.pending = { level, component, args };
            if (!prev.timer) {
                prev.timer = setTimeout(() => {
                    const state = this.throttleMap.get(key);
                    if (state?.pending) {
                        this.writePlugin(state.pending.level, state.pending.component, state.pending.args);
                        state.last = Date.now();
                        state.pending = null;
                        state.timer = null;
                        this.throttleMap.set(key, state);
                    } else {
                        // 无待处理，清空定时器
                        this.throttleMap.set(key, { last: Date.now(), timer: null, pending: null });
                    }
                }, interval);
                this.throttleMap.set(key, prev);
            }
        }
    }

    async writePlugin(level, component, args) {
        const message = this.formatMessage(level, component, args).message;
        try {
            switch (level) {
                case 'DEBUG':
                    await plDebug(message);
                    break;
                case 'INFO':
                    await plInfo(message);
                    break;
                case 'WARN':
                    await plWarn(message);
                    break;
                case 'ERROR':
                    await plError(message);
                    break;
                default:
                    await plInfo(message);
            }
        } catch (e) {
            // 插件不可用时忽略
        }
    }

    /**
     * Debug 级别日志
     * @param {string} component - 组件名
     * @param {...any} args - 日志参数
     */
    debug(component, ...args) {
        this.log('DEBUG', component, ...args);
    }

    /**
     * Info 级别日志
     * @param {string} component - 组件名
     * @param {...any} args - 日志参数
     */
    info(component, ...args) {
        this.log('INFO', component, ...args);
    }

    /**
     * Warning 级别日志
     * @param {string} component - 组件名
     * @param {...any} args - 日志参数
     */
    warn(component, ...args) {
        this.log('WARN', component, ...args);
    }

    /**
     * Error 级别日志
     * @param {string} component - 组件名
     * @param {...any} args - 日志参数
     */
    error(component, ...args) {
        this.log('ERROR', component, ...args);
        
        // 错误级别显示堆栈跟踪
        if (this.config.format.stack) {
            const stack = new Error().stack;
            this.log('ERROR', component, 'Stack trace:', stack);
        }
    }

    /**
     * 获取日志历史
     * @param {number} limit - 限制数量
     * @param {string} level - 过滤级别
     * @returns {Array}
     */
    getHistory(limit = 100, level = null) {
        let logs = this.logBuffer;
        
        if (level) {
            logs = logs.filter(log => log.level === level.toUpperCase());
        }
        
        return logs.slice(0, limit);
    }

    /**
     * 清空日志缓冲区
     */
    clear() {
        this.logBuffer = [];
        console.clear();
    }

    /**
     * 设置日志级别
     * @param {string} level - 日志级别
     */
    setLevel(level) {
        const levelValue = this.config.levels[level.toUpperCase()];
        if (levelValue !== undefined) {
            this.config.currentLevel = levelValue;
        }
    }

    // 供实时查看器使用
    subscribe(callback) {
        if (typeof callback === 'function') {
            this.listeners.add(callback);
        }
        return () => this.listeners.delete(callback);
    }
}

// 创建全局日志实例
export const logger = new Logger();

// 创建便捷的日志方法
export const createLogger = (component) => ({
    debug: (...args) => logger.debug(component, ...args),
    info: (...args) => logger.info(component, ...args),
    warn: (...args) => logger.warn(component, ...args),
    error: (...args) => logger.error(component, ...args),
});

// 默认导出
export default logger;
