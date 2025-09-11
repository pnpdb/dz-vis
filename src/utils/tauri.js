import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Tauri utilities for system integration
 */
export class TauriUtils {
    /**
     * Open the current directory in file manager
     */
    static async openFolder() {
        try {
            await invoke('open_folder');
            return { success: true };
        } catch (error) {
            console.error('Failed to open folder:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * Get system information
     */
    static async getSystemInfo() {
        try {
            const info = await invoke('get_system_info');
            return { success: true, data: info };
        } catch (error) {
            console.error('Failed to get system info:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * Window control utilities
     */
    static async minimizeWindow() {
        try {
            await invoke('minimize_window');
            return { success: true };
        } catch (error) {
            console.error('Failed to minimize window:', error);
            return { success: false, error: error.toString() };
        }
    }

    static async maximizeWindow() {
        try {
            await invoke('maximize_window');
            return { success: true };
        } catch (error) {
            console.error('Failed to maximize window:', error);
            return { success: false, error: error.toString() };
        }
    }

    static async closeWindow() {
        try {
            await invoke('close_window');
            return { success: true };
        } catch (error) {
            console.error('Failed to close window:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * Check if running in Tauri environment
     */
    static isTauri() {
        return window.__TAURI__ !== undefined;
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
        if (!this.isTauri()) return;

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

    /**
     * Show notification (fallback to browser notification if not in Tauri)
     */
    static async showNotification(title, body, icon = null) {
        if (this.isTauri()) {
            // TODO: Implement Tauri notification when plugin is available
            console.log('Tauri notification:', { title, body, icon });
        } else {
            // Fallback to browser notification
            if ('Notification' in window) {
                if (Notification.permission === 'granted') {
                    new Notification(title, { body, icon });
                } else if (Notification.permission !== 'denied') {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        new Notification(title, { body, icon });
                    }
                }
            }
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