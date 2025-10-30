<template>
    <div v-show="visible" class="log-viewer" :style="{ top: `${pos.y}px`, left: `${pos.x}px`, width: `${size.w}px`, height: `${size.h}px` }">
        <div class="log-header" @mousedown="startDrag">
            <div class="title">日志查看器</div>
            <div class="actions" @mousedown.stop>
                <select v-model="level" class="level">
                    <option value="DEBUG">DEBUG</option>
                    <option value="INFO">INFO</option>
                    <option value="WARN">WARN</option>
                    <option value="ERROR">ERROR</option>
                </select>
                <input v-model="keyword" class="filter" type="text" placeholder="关键字过滤" />
                <button class="btn" @click="pause = !pause">{{ pause ? '继续' : '暂停' }}</button>
                <button class="btn" @click="clearLogs">清空</button>
                <button class="btn" @click="close">关闭</button>
            </div>
        </div>
        <div class="log-body" ref="bodyRef" @dblclick="autoScroll = !autoScroll">
            <pre class="line" v-for="(line, idx) in filtered" :key="idx">{{ format(line) }}</pre>
        </div>
        <div class="resizer" @mousedown="startResize"></div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { logger } from '@/utils/logger.js';

const props = defineProps({
    modelValue: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);

const visible = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v)
});

const pos = ref({ x: 80, y: 120 });
const size = ref({ w: 860, h: 420 });
const dragging = ref(false);
const resizing = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const bodyRef = ref(null);
const autoScroll = ref(true);
const pause = ref(false);
const level = ref('DEBUG');
const keyword = ref('');

const buffer = ref(logger.getHistory(1000));

let unsub = null;

const levelValue = (lvl) => ({ DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 })[lvl] ?? 0;

const filtered = computed(() => {
    const min = levelValue(level.value);
    const key = keyword.value.trim().toLowerCase();
    return buffer.value.filter(l => levelValue(l.level) >= min && (!key || (l.message || '').toLowerCase().includes(key)));
});

const append = (entry) => {
    if (pause.value) return;
    buffer.value.push(entry);
    if (buffer.value.length > 2000) buffer.value.shift();
    if (autoScroll.value && bodyRef.value) {
        requestAnimationFrame(() => {
            bodyRef.value.scrollTop = bodyRef.value.scrollHeight;
        });
    }
};

const startDrag = (e) => {
    dragging.value = true;
    dragOffset.value = { x: e.clientX - pos.value.x, y: e.clientY - pos.value.y };
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
};

const onDrag = (e) => {
    if (!dragging.value) return;
    pos.value = { x: Math.max(0, e.clientX - dragOffset.value.x), y: Math.max(0, e.clientY - dragOffset.value.y) };
};

const stopDrag = () => {
    dragging.value = false;
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
};

const startResize = (e) => {
    resizing.value = true;
    dragOffset.value = { x: e.clientX - size.value.w, y: e.clientY - size.value.h };
    window.addEventListener('mousemove', onResize);
    window.addEventListener('mouseup', stopResize);
};

const onResize = (e) => {
    if (!resizing.value) return;
    size.value = { w: Math.max(400, e.clientX - dragOffset.value.x), h: Math.max(200, e.clientY - dragOffset.value.y) };
};

const stopResize = () => {
    resizing.value = false;
    window.removeEventListener('mousemove', onResize);
    window.removeEventListener('mouseup', stopResize);
};

const clearLogs = () => {
    buffer.value = [];
};

const close = () => {
    visible.value = false;
};

onMounted(() => {
    unsub = logger.subscribe(append);
    // 首次自动滚动到底
    requestAnimationFrame(() => { if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight; });
});

onBeforeUnmount(() => {
    if (unsub) unsub();
    
    // 清理可能残留的 window 事件监听器
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
    window.removeEventListener('mousemove', onResize);
    window.removeEventListener('mouseup', stopResize);
});

const format = (entry) => {
    return `[${entry.timestamp}] [${entry.level}] ${entry.component ? '[' + entry.component + '] ' : ''}${entry.message}`;
};
</script>

<style scoped>
.log-viewer {
    position: fixed;
    background: #0b0f14;
    color: #cfe8ff;
    border: 1px solid rgba(0, 240, 255, 0.3);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    /* 放开边界限制，允许拖出可视区域（可选，部分系统仍会限制到窗口内） */
}
.log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: #0f1720;
    cursor: move;
    user-select: none;
}
.title { font-weight: 700; color: #00f0ff; white-space: nowrap; }
.actions { display: flex; gap: 6px; align-items: center; flex-wrap: nowrap; }
.level, .filter, .btn { background: #111a22; color: #cfe8ff; border: 1px solid #1f2d3a; border-radius: 4px; padding: 4px 8px; }
.level, .filter { font-size: 12px; }
.log-body { flex: 1; overflow: auto; background: #0b0f14; padding: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px; }
.line { white-space: pre-wrap; word-break: break-word; margin: 0; }
.resizer { position: absolute; right: 0; bottom: 0; width: 12px; height: 12px; cursor: se-resize; background: linear-gradient(135deg, transparent 0, transparent 50%, #173448 50%, #173448 100%); }
</style>

