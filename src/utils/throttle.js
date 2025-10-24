/**
 * 节流工具函数
 * 限制函数在指定时间内只执行一次
 */

/**
 * 创建节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} wait - 等待时间（毫秒）
 * @param {Object} options - 配置选项
 * @param {boolean} options.leading - 是否在开始时执行（默认 true）
 * @param {boolean} options.trailing - 是否在结束时执行（默认 true）
 * @returns {Function} 节流后的函数
 */
export function throttle(func, wait = 100, options = {}) {
    let timeout = null;
    let previous = 0;
    let result;
    
    const { leading = true, trailing = true } = options;

    const throttled = function (...args) {
        const now = Date.now();
        
        // 如果不需要立即执行，记录当前时间
        if (!previous && leading === false) {
            previous = now;
        }

        const remaining = wait - (now - previous);

        if (remaining <= 0 || remaining > wait) {
            // 时间到了，执行函数
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            result = func.apply(this, args);
        } else if (!timeout && trailing) {
            // 设置定时器，在剩余时间后执行
            timeout = setTimeout(() => {
                previous = leading === false ? 0 : Date.now();
                timeout = null;
                result = func.apply(this, args);
            }, remaining);
        }

        return result;
    };

    // 添加取消方法
    throttled.cancel = function () {
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
 * 延迟执行，如果在延迟期间再次调用则重新计时
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @param {boolean} immediate - 是否立即执行（默认 false）
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait = 100, immediate = false) {
    let timeout;

    const debounced = function (...args) {
        const later = () => {
            timeout = null;
            if (!immediate) {
                func.apply(this, args);
            }
        };

        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);

        if (callNow) {
            func.apply(this, args);
        }
    };

    // 添加取消方法
    debounced.cancel = function () {
        clearTimeout(timeout);
        timeout = null;
    };

    return debounced;
}

