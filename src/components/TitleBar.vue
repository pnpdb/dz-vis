<template>
    <div class="custom-title-bar">
        <div class="title-bar-drag-area" data-tauri-drag-region @dblclick="toggleMaximize">
            <span class="title-bar-title" data-tauri-drag-region>
                DZ Car Manager
            </span>
        </div>
        <div class="title-bar-controls">
            <button class="title-bar-btn minimize-btn" @click="minimizeWindow" title="最小化">
                <svg width="12" height="12" viewBox="0 0 12 12">
                    <rect x="0" y="5" width="12" height="2" fill="currentColor"/>
                </svg>
            </button>
            <button class="title-bar-btn maximize-btn" @click="toggleMaximize" title="最大化/还原">
                <svg width="12" height="12" viewBox="0 0 12 12">
                    <rect x="1" y="1" width="10" height="10" stroke="currentColor" stroke-width="1.5" fill="none"/>
                </svg>
            </button>
            <button class="title-bar-btn close-btn" @click="closeWindow" title="关闭">
                <svg width="12" height="12" viewBox="0 0 12 12">
                    <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" stroke-width="1.5"/>
                    <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" stroke-width="1.5"/>
                </svg>
            </button>
        </div>
    </div>
</template>

<script setup>
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

const minimizeWindow = async () => {
    await appWindow.minimize();
};

const toggleMaximize = async () => {
    const isMaximized = await appWindow.isMaximized();
    if (isMaximized) {
        await appWindow.unmaximize();
    } else {
        await appWindow.maximize();
    }
};

const closeWindow = async () => {
    await appWindow.close();
};
</script>

<style>
/* 注意：-webkit-app-region 在 scoped 样式中可能不生效，所以这里不使用 scoped */
.custom-title-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 30px;
    background-color: #222222;
    display: flex;
    align-items: center;
    z-index: 10000;
    user-select: none;
    -webkit-user-select: none;
}

.title-bar-drag-area {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-app-region: drag;
    app-region: drag;
}

.title-bar-title {
    color: #ffffff;
    font-size: 12px;
    font-weight: 500;
    pointer-events: none;
}

.title-bar-controls {
    display: flex;
    height: 100%;
    -webkit-app-region: no-drag;
    app-region: no-drag;
}

.title-bar-btn {
    width: 46px;
    height: 100%;
    border: none;
    background: transparent;
    color: #ffffff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s ease;
    padding: 0;
    outline: none;
}

.title-bar-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
}

.close-btn:hover {
    background-color: #e81123;
}

.title-bar-btn svg {
    pointer-events: none;
}
</style>

