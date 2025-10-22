<template>
    <i :class="iconClass"></i>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    icon: {
        type: String,
        required: true
    }
});

// 将 icon 名称转换为 Font Awesome CSS 类
// 例如: "save" -> "fa-save", "sync-alt" -> "fa-sync-alt"
const iconClass = computed(() => {
    return `fas fa-${props.icon}`;
});
</script>

<style scoped>
/* 继承父元素的颜色和大小 */
i {
    display: inline-block;
}
</style>

