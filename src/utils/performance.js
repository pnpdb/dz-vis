/**
 * 性能优化工具函数
 * 提供防抖、节流、缓存等优化功能
 */

/**
 * 防抖函数 - 延迟执行，多次调用只执行最后一次
 * @param {Function} func 要执行的函数
 * @param {number} delay 延迟时间（毫秒）
 * @param {boolean} immediate 是否立即执行第一次
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, delay = 300, immediate = false) {
    let timeoutId = null;
    let isInvoked = false;
    
    return function debounced(...args) {
        const context = this;
        
        const callNow = immediate && !isInvoked;
        
        clearTimeout(timeoutId);
        
        timeoutId = setTimeout(() => {
            timeoutId = null;
            isInvoked = false;
            if (!immediate) {
                func.apply(context, args);
            }
        }, delay);
        
        if (callNow) {
            isInvoked = true;
            return func.apply(context, args);
        }
    };
}

/**
 * 节流函数 - 限制执行频率
 * @param {Function} func 要执行的函数
 * @param {number} delay 节流间隔（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(func, delay = 100) {
    let timeoutId = null;
    let lastExecTime = 0;
    
    return function throttled(...args) {
        const context = this;
        const currentTime = Date.now();
        
        if (currentTime - lastExecTime > delay) {
            func.apply(context, args);
            lastExecTime = currentTime;
        } else {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(context, args);
                lastExecTime = Date.now();
            }, delay - (currentTime - lastExecTime));
        }
    };
}

/**
 * 简单的LRU缓存实现
 */
export class LRUCache {
    constructor(capacity = 50) {
        this.capacity = capacity;
        this.cache = new Map();
    }
    
    get(key) {
        if (this.cache.has(key)) {
            // 移到最前面（最近使用）
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            return value;
        }
        return null;
    }
    
    set(key, value) {
        if (this.cache.has(key)) {
            // 更新现有值
            this.cache.delete(key);
        } else if (this.cache.size >= this.capacity) {
            // 删除最久未使用的项
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, value);
    }
    
    has(key) {
        return this.cache.has(key);
    }
    
    clear() {
        this.cache.clear();
    }
    
    get size() {
        return this.cache.size;
    }
}

/**
 * 异步任务队列，避免同时执行过多异步操作
 */
export class AsyncQueue {
    constructor(concurrency = 3) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }
    
    async add(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                task,
                resolve,
                reject
            });
            
            this.process();
        });
    }
    
    async process() {
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }
        
        this.running++;
        const { task, resolve, reject } = this.queue.shift();
        
        try {
            const result = await task();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.running--;
            this.process(); // 处理下一个任务
        }
    }
    
    get pending() {
        return this.queue.length;
    }
    
    get active() {
        return this.running;
    }
}

/**
 * 内存使用监控
 */
export class MemoryMonitor {
    static getMemoryInfo() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }
    
    static isMemoryPressure(threshold = 0.8) {
        const info = this.getMemoryInfo();
        if (!info) return false;
        
        return info.used / info.limit > threshold;
    }
    
    static logMemoryUsage(label = '') {
        const info = this.getMemoryInfo();
        if (info) {
            console.debug(`🧠 内存使用 ${label}: ${info.used}MB / ${info.limit}MB (${Math.round(info.used / info.limit * 100)}%)`);
        }
    }
}

/**
 * 请求去重，避免重复的网络请求
 */
export class RequestDeduplicator {
    constructor() {
        this.pending = new Map();
    }
    
    async dedupe(key, requestFn) {
        if (this.pending.has(key)) {
            // 返回正在进行的请求
            return this.pending.get(key);
        }
        
        const promise = requestFn().finally(() => {
            // 请求完成后清除缓存
            this.pending.delete(key);
        });
        
        this.pending.set(key, promise);
        return promise;
    }
    
    clear() {
        this.pending.clear();
    }
    
    get size() {
        return this.pending.size;
    }
}

// 全局实例
export const globalCache = new LRUCache(100);
export const globalQueue = new AsyncQueue(5);
export const globalDeduplicator = new RequestDeduplicator();

/**
 * Vue组合式函数：性能监控
 */
export function usePerformanceMonitor() {
    const startTime = performance.now();
    
    const measureTime = (label = 'Operation') => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.debug(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
        return duration;
    };
    
    const measureMemory = (label = 'Memory') => {
        MemoryMonitor.logMemoryUsage(label);
    };
    
    return {
        measureTime,
        measureMemory
    };
}

export default {
    debounce,
    throttle,
    LRUCache,
    AsyncQueue,
    MemoryMonitor,
    RequestDeduplicator,
    usePerformanceMonitor
};
