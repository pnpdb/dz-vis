/**
 * 统一日志工具 - 适配Tauri环境
 */

import { LOG_CONFIG } from '@/config/app.js';

class Logger {
    constructor() {
        this.config = LOG_CONFIG;
        this.logBuffer = [];
        this.maxBufferSize = 1000;
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
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            component,
            message: args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' '),
            raw: args
        };

        // 添加到缓冲区
        this.addToBuffer(logEntry);

        return logEntry;
    }

    /**
     * 添加到日志缓冲区
     * @param {object} logEntry - 日志条目
     */
    addToBuffer(logEntry) {
        this.logBuffer.unshift(logEntry);
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer = this.logBuffer.slice(0, this.maxBufferSize);
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

        // TODO: 在Tauri环境中可以添加文件日志
        // if (this.config.output.file && window.__TAURI__) {
        //     this.writeToFile(logEntry);
        // }
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
