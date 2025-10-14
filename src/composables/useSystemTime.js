/**
 * 系统时间组合式函数
 * 提供实时系统时间显示功能
 */

import { ref, onMounted, onBeforeUnmount } from 'vue';

/**
 * 使用系统时间
 * @returns {{ currentTime: import('vue').Ref<string> }}
 */
export function useSystemTime() {
    const currentTime = ref('');
    let timer = null;

    /**
     * 更新时间显示
     */
    const updateTime = () => {
        const now = new Date();
        currentTime.value = now.toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    onMounted(() => {
        updateTime();
        timer = setInterval(updateTime, 1000);
    });

    onBeforeUnmount(() => {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    });

    return { currentTime };
}

