<template>
    <div class="menu-visibility-settings">
        <div class="settings-header">
            <h4 class="settings-title">
                <fa icon="bars" />
                菜单显示设置
            </h4>
        </div>

        <el-form v-loading="loading" label-width="140px">
            <el-form-item label="车辆信息">
                <el-switch
                    v-model="settings.show_vehicle_info"
                    active-text="显示"
                    inactive-text="隐藏"
                />
            </el-form-item>

            <el-form-item label="自动驾驶">
                <el-switch
                    v-model="settings.show_auto_drive"
                    active-text="显示"
                    inactive-text="隐藏"
                />
                <div class="form-item-tip">
                    <fa icon="info-circle" />
                    隐藏此菜单时，"自动驾驶行为统计"也会同时隐藏
                </div>
            </el-form-item>

            <el-form-item label="沙盘控制">
                <el-switch
                    v-model="settings.show_sandbox_control"
                    active-text="显示"
                    inactive-text="隐藏"
                />
            </el-form-item>

            <el-form-item label="功能设置">
                <el-switch
                    v-model="settings.show_settings"
                    active-text="显示"
                    inactive-text="隐藏"
                />
            </el-form-item>
        </el-form>

        <div class="settings-header" style="margin-top: 32px;">
            <h4 class="settings-title">
                <fa icon="toggle-on" />
                功能显示设置
            </h4>
        </div>

        <el-form v-loading="loading" label-width="140px">
            <el-form-item label="平行驾驶">
                <el-switch
                    v-model="settings.show_parallel_driving"
                    active-text="显示"
                    inactive-text="隐藏"
                />
            </el-form-item>
        </el-form>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import Toast from '@/utils/toast.js';
import eventBus, { EVENTS } from '@/utils/eventBus';

const loading = ref(false);

const settings = ref({
    show_vehicle_info: true,
    show_auto_drive: true,
    show_sandbox_control: true,
    show_settings: true,
    show_parallel_driving: true
});

// 保存原始设置（用于重置）
const originalSettings = ref({
    show_vehicle_info: true,
    show_auto_drive: true,
    show_sandbox_control: true,
    show_settings: true,
    show_parallel_driving: true
});

// 加载菜单可见性设置
const loadSettings = async () => {
    loading.value = true;
    try {
        const result = await invoke('get_menu_visibility_settings');
        if (result) {
            const loadedSettings = {
                show_vehicle_info: result.show_vehicle_info,
                show_auto_drive: result.show_auto_drive,
                show_sandbox_control: result.show_sandbox_control,
                show_settings: result.show_settings,
                show_parallel_driving: result.show_parallel_driving
            };
            settings.value = { ...loadedSettings };
            originalSettings.value = { ...loadedSettings };
            console.log('✅ 菜单可见性设置加载成功:', settings.value);
        }
    } catch (error) {
        console.error('❌ 加载菜单可见性设置失败:', error);
        Toast.error(`加载菜单可见性设置失败: ${error}`);
    } finally {
        loading.value = false;
    }
};

// 保存菜单可见性设置（供父组件调用）
const saveSettings = async () => {
    try {
        const request = {
            show_vehicle_info: settings.value.show_vehicle_info,
            show_auto_drive: settings.value.show_auto_drive,
            show_sandbox_control: settings.value.show_sandbox_control,
            show_settings: settings.value.show_settings,
            show_parallel_driving: settings.value.show_parallel_driving
        };

        const result = await invoke('update_menu_visibility_settings', { request });
        if (result) {
            // 更新原始设置为当前保存的设置
            originalSettings.value = { ...settings.value };
            // 发送事件通知其他组件更新菜单显示
            eventBus.emit(EVENTS.MENU_VISIBILITY_CHANGED, settings.value);
            console.log('✅ 菜单可见性设置已保存:', result);
            return true;
        }
    } catch (error) {
        console.error('❌ 保存菜单可见性设置失败:', error);
        throw error;
    }
};

// 重置菜单可见性设置为默认值（供父组件调用）
const resetSettings = () => {
    settings.value = {
        show_vehicle_info: true,
        show_auto_drive: true,
        show_sandbox_control: true,
        show_settings: true,
        show_parallel_driving: true
    };
    console.log('✅ 菜单可见性设置已重置为默认状态（全部显示）');
};

// 暴露方法给父组件
defineExpose({
    saveSettings,
    loadSettings,
    resetSettings
});

// 组件挂载时加载设置
onMounted(() => {
    loadSettings();
});
</script>

<style lang="scss" scoped>
.menu-visibility-settings {
    padding: 0;
}

.settings-header {
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(0, 240, 255, 0.2);
}

.settings-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
}

.settings-desc {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0;
}

.form-item-tip {
    margin-top: 8px;
    font-size: 12px;
    color: #faad14;
    display: flex;
    align-items: center;
    gap: 6px;
}

// Element Plus 样式覆盖
:deep(.el-form-item__label) {
    color: var(--text-primary) !important;
}

:deep(.el-switch__label) {
    color: var(--text-secondary);
}
</style>

