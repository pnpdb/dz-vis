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
    const carStore = useCarStore();
    const onlineVehicleCount = ref(0);
    const sandboxConnected = ref(false);

    /**
     * 网络状态计算属性
     */
    const networkStatus = computed(() => {
        // 检查沙盘连接状态
        if (!sandboxConnected.value) {
            return {
                text: '沙盘离线',
                icon: 'times-circle',
                connected: false
            };
        }

        // 检查车辆在线数量
        if (onlineVehicleCount.value === 0) {
            return {
                text: '无车辆在线',
                icon: 'exclamation-circle',
                connected: true
            };
        }

        return {
            text: `${onlineVehicleCount.value} 辆车在线`,
            icon: 'check-circle',
            connected: true
        };
    });

    /**
     * 更新在线车辆数量
     */
    const updateOnlineCount = () => {
        onlineVehicleCount.value = carStore.getOnlineVehicleCount();
    };

    /**
     * 更新沙盘连接状态
     */
    const updateSandboxStatus = () => {
        sandboxConnected.value = carStore.isSandboxConnected();
    };

    /**
     * 检查状态（手动触发）
     */
    const checkStatus = () => {
        updateOnlineCount();
        updateSandboxStatus();
    };

    /**
     * 处理在线车辆数变化事件
     */
    const handleOnlineCountChanged = (count) => {
        onlineVehicleCount.value = count ?? carStore.getOnlineVehicleCount();
    };

    /**
     * 处理沙盘连接状态变化事件
     */
    const handleSandboxStatusChanged = (status) => {
        sandboxConnected.value = status ?? carStore.isSandboxConnected();
    };

    onMounted(() => {
        // 初始化状态
        checkStatus();

        // 监听事件
        eventBus.on(EVENTS.ONLINE_VEHICLES_COUNT_CHANGED, handleOnlineCountChanged);
        eventBus.on(EVENTS.SANDBOX_CONNECTION_STATUS, handleSandboxStatusChanged);
    });

    onBeforeUnmount(() => {
        eventBus.off(EVENTS.ONLINE_VEHICLES_COUNT_CHANGED, handleOnlineCountChanged);
        eventBus.off(EVENTS.SANDBOX_CONNECTION_STATUS, handleSandboxStatusChanged);
    });

    return {
        networkStatus,
        checkStatus
    };
}

