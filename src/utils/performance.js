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

export default {
    debounce,
    throttle,
    LRUCache
};
