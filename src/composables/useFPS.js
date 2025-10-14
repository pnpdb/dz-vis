/**
 * FPS监控组合式函数
 * 提供帧率监控和显示功能
 */

import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import eventBus, { EVENTS } from '@/utils/eventBus.js';

/**
 * 使用FPS监控
 * @returns {{
 *   fps: import('vue').Ref<number>,
 *   fpsPercentage: import('vue').ComputedRef<number>
 * }}
 */
export function useFPS() {
    const fps = ref(60);

    /**
     * FPS百分比（相对于60FPS）
     */
    const fpsPercentage = computed(() => {
        return Math.min((fps.value / 60) * 100, 100);
    });

    /**
     * 处理FPS更新事件
     * @param {Object} payload - FPS数据
     */
    const handleFPSUpdate = (payload) => {
        if (payload && typeof payload.fps === 'number') {
            fps.value = payload.fps;
        }
    };

    onMounted(() => {
        eventBus.on(EVENTS.FPS_UPDATE, handleFPSUpdate);
    });

    onBeforeUnmount(() => {
        eventBus.off(EVENTS.FPS_UPDATE, handleFPSUpdate);
    });

    return {
        fps,
        fpsPercentage
    };
}

