/**
 * 事件节流和防抖工具
 * 用于优化高频事件，减少不必要的重渲染
 */

/**
 * 节流函数
 * 确保函数在指定时间间隔内最多执行一次
 * @param {Function} func - 要节流的函数
 * @param {number} wait - 等待时间（毫秒）
 * @param {Object} options - 选项 {leading: boolean, trailing: boolean}
 * @returns {Function} 节流后的函数
 */
export function throttle(func, wait = 100, options = {}) {
    let timeout = null;
    let previous = 0;
    let result;
    
    const { leading = true, trailing = true } = options;
    
    const throttled = function(...args) {
        const now = Date.now();
        
        // 如果不需要前导调用，则重置previous
        if (!previous && !leading) {
            previous = now;
        }
        
        const remaining = wait - (now - previous);
        
        if (remaining <= 0 || remaining > wait) {
            // 超过等待时间，立即执行
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            result = func.apply(this, args);
        } else if (!timeout && trailing) {
            // 设置定时器，在剩余时间后执行
            timeout = setTimeout(() => {
                previous = leading ? Date.now() : 0;
                timeout = null;
                result = func.apply(this, args);
            }, remaining);
        }
        
        return result;
    };
    
    // 取消方法
    throttled.cancel = function() {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        previous = 0;
    };
    
    return throttled;
}

/**
 * 防抖函数
 * 延迟执行函数，如果在延迟期间再次触发，则重新计时
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @param {boolean} immediate - 是否立即执行
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait = 100, immediate = false) {
    let timeout = null;
    let result;
    
    const debounced = function(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) {
                result = func.apply(this, args);
            }
        };
        
        const callNow = immediate && !timeout;
        
        if (timeout) {
            clearTimeout(timeout);
        }
        
        timeout = setTimeout(later, wait);
        
        if (callNow) {
            result = func.apply(this, args);
        }
        
        return result;
    };
    
    // 取消方法
    debounced.cancel = function() {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
    };
    
    return debounced;
}

/**
 * 创建节流的事件发射器
 * @param {Object} eventBus - 事件总线对象
 * @param {string} eventName - 事件名称
 * @param {number} wait - 节流等待时间
 * @returns {Function} 节流后的emit函数
 */
export function createThrottledEmitter(eventBus, eventName, wait = 100) {
    return throttle((payload) => {
        eventBus.emit(eventName, payload);
    }, wait);
}

/**
 * 创建防抖的事件发射器
 * @param {Object} eventBus - 事件总线对象
 * @param {string} eventName - 事件名称
 * @param {number} wait - 防抖等待时间
 * @returns {Function} 防抖后的emit函数
 */
export function createDebouncedEmitter(eventBus, eventName, wait = 100) {
    return debounce((payload) => {
        eventBus.emit(eventName, payload);
    }, wait);
}

/**
 * RAF（RequestAnimationFrame）节流
 * 使用浏览器的帧率来节流，确保每帧最多执行一次
 * @param {Function} func - 要节流的函数
 * @returns {Function} 节流后的函数
 */
export function rafThrottle(func) {
    let rafId = null;
    let lastArgs = null;
    
    const throttled = function(...args) {
        lastArgs = args;
        
        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                func.apply(this, lastArgs);
                rafId = null;
                lastArgs = null;
            });
        }
    };
    
    throttled.cancel = function() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
            lastArgs = null;
        }
    };
    
    return throttled;
}

/**
 * 批量节流
 * 收集多次调用的数据，批量处理
 * @param {Function} func - 要批量执行的函数
 * @param {number} wait - 等待时间
 * @param {number} maxBatchSize - 最大批量大小
 * @returns {Function} 批量处理函数
 */
export function batchThrottle(func, wait = 100, maxBatchSize = 100) {
    let batch = [];
    let timeout = null;
    
    const flush = function() {
        if (batch.length > 0) {
            func(batch);
            batch = [];
        }
        timeout = null;
    };
    
    const batched = function(item) {
        batch.push(item);
        
        // 达到最大批量，立即执行
        if (batch.length >= maxBatchSize) {
            if (timeout) {
                clearTimeout(timeout);
            }
            flush();
            return;
        }
        
        // 设置定时器
        if (!timeout) {
            timeout = setTimeout(flush, wait);
        }
    };
    
    batched.flush = flush;
    
    batched.cancel = function() {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        batch = [];
    };
    
    return batched;
}

export default {
    throttle,
    debounce,
    createThrottledEmitter,
    createDebouncedEmitter,
    rafThrottle,
    batchThrottle,
};

