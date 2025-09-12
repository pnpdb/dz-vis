import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { APP_CONFIG, LOG_CONFIG } from '@/config/app.js';

/**
 * Tauri工具类 - 提供系统集成功能
 */
export class TauriUtils {
    /**
     * 检查是否在Tauri环境中运行
     */
    static isTauri() {
        return APP_CONFIG.isTauri;
    }

    /**
     * 安全地调用Tauri命令
     * @param {string} command - 命令名
     * @param {object} params - 参数
     * @returns {Promise<object>} 结果对象
     */
    static async safeInvoke(command, params = {}) {
        if (!TauriUtils.isTauri()) {
            console.warn(`Tauri命令 "${command}" 在非Tauri环境中被调用`);
            return { success: false, error: 'Not in Tauri environment' };
        }

        try {
            const result = await invoke(command, params);
            return { success: true, data: result };
        } catch (error) {
            console.error(`Tauri命令 "${command}" 执行失败:`, error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 打开当前目录
     */
    static async openFolder() {
        return await this.safeInvoke('open_folder');
    }

    /**
     * 获取系统信息
     */
    static async getSystemInfo() {
        return await this.safeInvoke('get_system_info');
    }

    /**
     * Window control utilities
     */
    static async minimizeWindow() {
        return await this.safeInvoke('minimize_window');
    }

    static async maximizeWindow() {
        return await this.safeInvoke('maximize_window');
    }

    static async closeWindow() {
        return await this.safeInvoke('close_window');
    }

    /**
     * 发送系统通知 (简化版本 - 仅使用浏览器通知)
     * @param {string} title - 通知标题
     * @param {string} body - 通知内容
     * @param {object} options - 其他选项
     */
    static async showNotification(title, body, options = {}) {
        // 在开发环境中，只使用console.log来显示通知
        if (import.meta.env.DEV) {
            console.info(`🔔 通知: ${title} - ${body}`);
            return { success: true };
        }

        // 生产环境尝试使用浏览器通知
        if ('Notification' in window) {
            try {
                if (Notification.permission === 'granted') {
                    new Notification(title, { body, ...options });
                    return { success: true };
                } else if (Notification.permission !== 'denied') {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        new Notification(title, { body, ...options });
                        return { success: true };
                    }
                }
            } catch (error) {
                console.warn('浏览器通知失败:', error);
            }
        }
        
        // 回退到控制台输出
        console.info(`📢 ${title}: ${body}`);
        return { success: true };
    }

    /**
     * Get current window instance
     */
    static getCurrentWindow() {
        return getCurrentWindow();
    }

    /**
     * Listen to window events
     */
    static async listenToWindowEvents(callbacks = {}) {
        if (!TauriUtils.isTauri()) return;

        const appWindow = getCurrentWindow();
        
        // Listen to window close event
        if (callbacks.onClose) {
            await appWindow.listen('tauri://close-requested', callbacks.onClose);
        }

        // Listen to window resize event
        if (callbacks.onResize) {
            await appWindow.listen('tauri://resize', callbacks.onResize);
        }

        // Listen to window focus event
        if (callbacks.onFocus) {
            await appWindow.listen('tauri://focus', callbacks.onFocus);
        }

        // Listen to window blur event
        if (callbacks.onBlur) {
            await appWindow.listen('tauri://blur', callbacks.onBlur);
        }
    }


}

/**
 * Environment detection utilities
 */
export const Environment = {
    isDevelopment: () => import.meta.env.DEV,
    isProduction: () => import.meta.env.PROD,
    isTauri: () => TauriUtils.isTauri(),
    getMode: () => import.meta.env.MODE,
    getBaseUrl: () => import.meta.env.BASE_URL,
};

/**
 * Export as default for easy importing
 */
export default TauriUtils;