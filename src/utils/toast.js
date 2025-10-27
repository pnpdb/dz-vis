/**
 * 自定义 Toast 通知系统
 * 解决 Ubuntu WebKitGTK 下 Element Plus Message 的兼容性问题
 * 使用对象池优化性能，减少DOM创建/销毁开销
 */

// Toast 容器
let toastContainer = null;

// Toast 对象池
const toastPool = [];
const MAX_POOL_SIZE = 5; // 最多缓存5个toast元素

// Toast 类型配置
const TOAST_TYPES = {
    success: {
        icon: '✓',
        color: '#67c23a',
        bgColor: '#f0f9eb',
        borderColor: '#67c23a'
    },
    warning: {
        icon: '⚠',
        color: '#e6a23c',
        bgColor: '#fdf6ec',
        borderColor: '#e6a23c'
    },
    error: {
        icon: '✕',
        color: '#f56c6c',
        bgColor: '#fef0f0',
        borderColor: '#f56c6c'
    },
    info: {
        icon: 'ℹ',
        color: '#909399',
        bgColor: '#f4f4f5',
        borderColor: '#909399'
    }
};

/**
 * 初始化 Toast 容器
 */
function initToastContainer() {
    if (toastContainer) return;
    
    toastContainer = document.createElement('div');
    toastContainer.className = 'custom-toast-container';
    toastContainer.style.cssText = `
        position: fixed !important;
        top: 50px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 10001 !important;
        pointer-events: none !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 10px !important;
        background-color: transparent !important;
    `;
    document.body.appendChild(toastContainer);
}

/**
 * 从对象池获取toast元素
 * @returns {HTMLElement} toast元素
 */
function getToastFromPool() {
    if (toastPool.length > 0) {
        return toastPool.pop();
    }
    // 池为空，创建新元素
    const toast = document.createElement('div');
    return toast;
}

/**
 * 将toast元素归还到对象池
 * @param {HTMLElement} toast - toast元素
 */
function returnToastToPool(toast) {
    // 清理元素状态
    toast.className = '';
    toast.style.cssText = '';
    toast.innerHTML = '';
    
    // 如果池未满，放入池中
    if (toastPool.length < MAX_POOL_SIZE) {
        toastPool.push(toast);
    }
    // 否则不缓存，让其被垃圾回收
}

/**
 * 显示 Toast
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型：success, warning, error, info
 * @param {number} duration - 显示时长（毫秒），默认3000ms
 */
function showToast(message, type = 'info', duration = 3000) {
    initToastContainer();
    
    const config = TOAST_TYPES[type] || TOAST_TYPES.info;
    
    // 从对象池获取 toast 元素
    const toast = getToastFromPool();
    toast.className = 'custom-toast custom-toast-' + type;
    toast.style.cssText = `
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        width: fit-content !important;
        max-width: 80vw !important;
        min-width: 120px !important;
        padding: 10px 16px !important;
        border-radius: 4px !important;
        background: ${config.bgColor} !important; /* 覆盖任何 background 简写 */
        background-color: ${config.bgColor} !important; /* 兜底 */
        border: 1px solid ${config.borderColor} !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        color: ${config.color} !important;
        font-size: 14px !important;
        box-sizing: border-box !important;
        backdrop-filter: none !important;
        position: relative !important;
        overflow: hidden !important;
        pointer-events: auto !important;
        opacity: 0 !important;
        transform: translateY(-20px) !important;
        transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1) !important;
    `;

    // 额外的背景图层，确保任何外部样式都无法改变背景显示效果
    const bg = document.createElement('div');
    bg.style.cssText = `
        position: absolute !important;
        inset: 0 !important;
        background: ${config.bgColor} !important;
        border-radius: 4px !important;
        z-index: 0 !important;
        pointer-events: none !important;
    `;
    
    // 创建图标
    const icon = document.createElement('span');
    icon.className = 'custom-toast-icon';
    icon.style.cssText = `
        margin-right: 10px !important;
        font-size: 18px !important;
        font-weight: bold !important;
        flex-shrink: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 18px !important;
        height: 18px !important;
        line-height: 1 !important;
        color: ${config.color} !important;
        background-color: transparent !important;
        position: relative !important;
        z-index: 1 !important;
    `;
    icon.textContent = config.icon;
    
    // 创建消息文本
    const content = document.createElement('span');
    content.className = 'custom-toast-content';
    content.style.cssText = `
        line-height: 1.5 !important;
        color: ${config.color} !important;
        background-color: transparent !important;
        position: relative !important;
        z-index: 1 !important;
    `;
    content.textContent = message;
    
    // 组装 toast
    // 背景层置于最底层
    toast.appendChild(bg);
    // 提示内容置于上层
    toast.appendChild(icon);
    toast.appendChild(content);
    toastContainer.appendChild(toast);
    
    // 触发动画
    requestAnimationFrame(() => {
        toast.style.setProperty('opacity', '1', 'important');
        toast.style.setProperty('transform', 'translateY(0)', 'important');
    });
    
    // 自动关闭
    setTimeout(() => {
        toast.style.setProperty('opacity', '0', 'important');
        toast.style.setProperty('transform', 'translateY(-20px)', 'important');
        
        setTimeout(() => {
            if (toast.parentNode) {
                toastContainer.removeChild(toast);
            }
            
            // 将toast归还到对象池
            returnToastToPool(toast);
            
            // 如果容器为空，完全移除容器（包括从DOM中移除）
            if (toastContainer && toastContainer.children.length === 0) {
                if (toastContainer.parentNode) {
                    toastContainer.parentNode.removeChild(toastContainer);
                }
                toastContainer = null;
            }
        }, 300);
    }, duration);
    
    return toast;
}

/**
 * Toast API
 */
export const Toast = {
    /**
     * 显示成功消息
     */
    success(message, duration = 3000) {
        return showToast(message, 'success', duration);
    },
    
    /**
     * 显示警告消息
     */
    warning(message, duration = 3000) {
        return showToast(message, 'warning', duration);
    },
    
    /**
     * 显示错误消息
     */
    error(message, duration = 3000) {
        return showToast(message, 'error', duration);
    },
    
    /**
     * 显示信息消息
     */
    info(message, duration = 3000) {
        return showToast(message, 'info', duration);
    },
    
    /**
     * Vue插件安装函数
     * 用法：
     * import Toast from '@/utils/toast.js'
     * app.use(Toast)
     * 
     * 然后在组件中使用：
     * this.$toast.success('成功')
     * 或在setup中使用：
     * import { getCurrentInstance } from 'vue'
     * const { proxy } = getCurrentInstance()
     * proxy.$toast.success('成功')
     */
    install(app) {
        // 注册全局属性
        app.config.globalProperties.$toast = Toast;
        
        // 也可以通过provide/inject使用
        app.provide('toast', Toast);
    }
};

// 默认导出
export default Toast;

