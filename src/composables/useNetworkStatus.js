/**
 * 网络状态组合式函数
 * 提供网络连接状态监控功能
 */

import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useCarStore } from '@/stores/car.js';
import eventBus, { EVENTS } from '@/utils/eventBus.js';

/**
 * 使用网络状态监控
 * @returns {{
 *   networkStatus: import('vue').ComputedRef<{text: string, icon: string, connected: boolean}>,
 *   checkStatus: () => void
 * }}
 */
export function useNetworkStatus() {
    const serverInfo = ref(''); // Socket服务器信息（本机IP地址）

    /**
     * 网络状态计算属性
     * 左下角只显示本机IP地址
     */
    const networkStatus = computed(() => {
        return {
            text: serverInfo.value || '127.0.0.1',
            icon: 'network-wired',
            connected: true
        };
    });

    /**
     * 获取本机IP地址
     */
    const fetchLocalIP = async () => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const networkStatus = await invoke('get_network_status');
            
            if (networkStatus && networkStatus.ip) {
                serverInfo.value = networkStatus.ip;
            } else {
                serverInfo.value = '127.0.0.1';
            }
        } catch (error) {
            console.warn('获取本机IP失败:', error);
            serverInfo.value = '127.0.0.1';
        }
    };


    /**
     * 处理Socket服务器启动事件
     * 更新本机IP地址
     */
    const handleServerStarted = async () => {
        // Socket服务器启动后，重新获取IP（确保最新）
        await fetchLocalIP();
    };

    onMounted(async () => {
        // 立即获取本机IP
        await fetchLocalIP();
        
        // 监听Socket服务器启动事件
        eventBus.on(EVENTS.SOCKET_SERVER_STARTED, handleServerStarted);
    });

    onBeforeUnmount(() => {
        eventBus.off(EVENTS.SOCKET_SERVER_STARTED, handleServerStarted);
    });

    return {
        networkStatus
    };
}

