<template>
    <!-- 顶部导航栏 -->
    <header class="header">
        <el-popover
            class="center"
            title="关于"
            content=""
            placement="bottom-end"
        >
            <template #reference>
                <div class="logo">
                    <div class="logo-icon">
                        <i class="fas fa-car"></i>
                        <fa icon="car" />
                    </div>
                    <div class="logo-text">DZ CAR MANAGER</div>
                </div>
            </template>
        </el-popover>

        <div class="nav-tabs">
            <TransitionGroup name="fade">
                <button
                    v-for="item in tabs"
                    :key="item.id"
                    :class="{
                        active: selectedTab === item.path,
                        'nav-btn': true,
                    }"
                    @click="selected(item)"
                >
                    <fa :icon="item.icon" /> {{ item.name }}
                </button>
            </TransitionGroup>
        </div>

        <div class="user-section">
            <el-popover
                class="center"
                title="文件管理器"
                content="点击打开指定文件夹"
                placement="bottom-end"
            >
                <template #reference>
                    <button class="notification-btn btn-ripple" @click="openFolder">
                        <fa icon="folder-open" />
                    </button>
                </template>
            </el-popover>
            
            <el-popover
                class="center"
                title="系统设置"
                content="点击打开系统设置"
                placement="bottom-end"
            >
                <template #reference>
                    <button class="notification-btn btn-ripple" @click="showLogin">
                        <fa icon="cog" />
                    </button>
                </template>
            </el-popover>
        </div>
        
        <!-- 登录模态框 -->
        <el-dialog
            v-model="loginDialogVisible"
            width="420px"
            :show-close="false"
            center
            class="login-modal"
        >
            <div class="login-container">
                <div class="login-icon">
                    <fa icon="lock" />
                </div>
                <h2 class="login-title">Welcome Back</h2>
                <p class="login-subtitle">Please sign in to access settings</p>
                
                <el-form
                    ref="loginFormRef"
                    :model="loginForm"
                    :rules="loginRules"
                    @submit.prevent="handleLogin"
                    class="login-form"
                >
                    <el-form-item prop="username">
                        <el-input
                            v-model="loginForm.username"
                            placeholder="Username"
                            size="large"
                            @keyup.enter="handleLogin"
                        >
                            <template #prefix>
                                <fa icon="user" />
                            </template>
                        </el-input>
                    </el-form-item>
                    <el-form-item prop="password">
                        <el-input
                            v-model="loginForm.password"
                            type="password"
                            placeholder="Password"
                            size="large"
                            show-password
                            @keyup.enter="handleLogin"
                        >
                            <template #prefix>
                                <fa icon="lock" />
                            </template>
                        </el-input>
                    </el-form-item>
                    
                    <div class="login-actions">
                        <el-button 
                            type="primary" 
                            size="large"
                            @click="handleLogin" 
                            :loading="loginLoading"
                            class="login-btn"
                        >
                            <span v-if="!loginLoading">Sign In</span>
                            <span v-else>Signing In...</span>
                        </el-button>
                        
                        <el-button 
                            size="large"
                            @click="loginDialogVisible = false"
                            class="cancel-btn"
                        >
                            Cancel
                        </el-button>
                    </div>
                </el-form>
            </div>
        </el-dialog>
        
        <!-- 设置模态框 -->
        <el-dialog
            v-model="settingsDialogVisible"
            title="系统设置"
            width="600px"
            :show-close="true"
            center
        >
            <el-tabs v-model="activeSettingsTab" type="border-card">
                <el-tab-pane label="基本设置" name="basic">
                    <el-form label-width="120px">
                        <el-form-item label="系统主题">
                            <el-radio-group v-model="settings.theme">
                                <el-radio label="dark">深色主题</el-radio>
                                <el-radio label="light">浅色主题</el-radio>
                            </el-radio-group>
                        </el-form-item>
                        <el-form-item label="语言设置">
                            <el-select v-model="settings.language" placeholder="请选择语言">
                                <el-option label="简体中文" value="zh-CN" />
                                <el-option label="English" value="en-US" />
                            </el-select>
                        </el-form-item>
                        <el-form-item label="自动保存">
                            <el-switch v-model="settings.autoSave" />
                        </el-form-item>
                    </el-form>
                </el-tab-pane>
                <el-tab-pane label="显示设置" name="display">
                    <el-form label-width="120px">
                        <el-form-item label="动画效果">
                            <el-switch v-model="settings.animations" />
                        </el-form-item>
                        <el-form-item label="显示网格">
                            <el-switch v-model="settings.showGrid" />
                        </el-form-item>
                        <el-form-item label="帧率限制">
                            <el-slider
                                v-model="settings.frameRate"
                                :min="30"
                                :max="120"
                                :step="10"
                                show-stops
                                show-input
                            />
                        </el-form-item>
                    </el-form>
                </el-tab-pane>
                <el-tab-pane label="高级设置" name="advanced">
                    <el-form label-width="120px">
                        <el-form-item label="调试模式">
                            <el-switch v-model="settings.debugMode" />
                        </el-form-item>
                        <el-form-item label="日志级别">
                            <el-select v-model="settings.logLevel" placeholder="请选择日志级别">
                                <el-option label="ERROR" value="error" />
                                <el-option label="WARN" value="warn" />
                                <el-option label="INFO" value="info" />
                                <el-option label="DEBUG" value="debug" />
                            </el-select>
                        </el-form-item>
                        <el-form-item label="缓存大小">
                            <el-input-number
                                v-model="settings.cacheSize"
                                :min="100"
                                :max="10000"
                                :step="100"
                                controls-position="right"
                            />
                            <span style="margin-left: 8px; color: var(--text-secondary);">MB</span>
                        </el-form-item>
                    </el-form>
                </el-tab-pane>
            </el-tabs>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="settingsDialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="saveSettings">保存设置</el-button>
                    <el-button @click="resetSettings">重置</el-button>
                </div>
            </template>
        </el-dialog>
    </header>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { TauriUtils } from '@/utils/tauri.js';
import { ElMessage } from 'element-plus';

const router = useRouter();
const route = useRoute();

const selectedTab = ref('/');
const tabs = ref([
    {
        id: 1,
        path: '/',
        icon: 'car-side',
        name: '车辆信息',
    },
    {
        id: 2,
        path: '/auto-drive',
        icon: 'robot',
        name: '自动驾驶',
    },
    {
        id: 3,
        path: '/control',
        icon: 'sliders-h',
        name: '沙盘控制',
    },
    {
        id: 4,
        path: '/settings',
        icon: 'cog',
        name: '功能设置',
    },
]);

// 登录相关
const loginDialogVisible = ref(false);
const loginLoading = ref(false);
const loginFormRef = ref();
const loginForm = ref({
    username: '',
    password: ''
});

const loginRules = {
    username: [
        { required: true, message: '请输入账号', trigger: 'blur' }
    ],
    password: [
        { required: true, message: '请输入密码', trigger: 'blur' }
    ]
};

// 设置相关
const settingsDialogVisible = ref(false);
const activeSettingsTab = ref('basic');
const settings = ref({
    theme: 'dark',
    language: 'zh-CN',
    autoSave: true,
    animations: true,
    showGrid: false,
    frameRate: 60,
    debugMode: false,
    logLevel: 'info',
    cacheSize: 1000
});

const selected = (item) => {
    selectedTab.value = item.path;
    router.push(item.path);
};

// 显示登录框
const showLogin = () => {
    loginDialogVisible.value = true;
    // 清空表单
    loginForm.value = {
        username: '',
        password: ''
    };
};

// 处理登录
const handleLogin = async () => {
    if (!loginFormRef.value) return;
    
    const valid = await loginFormRef.value.validate().catch(() => false);
    if (!valid) return;
    
    loginLoading.value = true;
    
    // 模拟登录延迟
    setTimeout(() => {
        const { username, password } = loginForm.value;
        
        // 硬编码的账号密码
        if (username === 'admin' && password === '123456') {
            ElMessage.success('登录成功！');
            loginDialogVisible.value = false;
            settingsDialogVisible.value = true;
            activeSettingsTab.value = 'basic';
        } else {
            ElMessage.error('账号或密码错误！');
        }
        
        loginLoading.value = false;
    }, 1000);
};

// 保存设置
const saveSettings = () => {
    // 这里可以实现设置的保存逻辑
    ElMessage.success('设置已保存！');
    settingsDialogVisible.value = false;
    console.log('当前设置:', settings.value);
};

// 重置设置
const resetSettings = () => {
    settings.value = {
        theme: 'dark',
        language: 'zh-CN',
        autoSave: true,
        animations: true,
        showGrid: false,
        frameRate: 60,
        debugMode: false,
        logLevel: 'info',
        cacheSize: 1000
    };
    ElMessage.info('设置已重置！');
};

// 打开文件夹 - Tauri 版本
const openFolder = async () => {
    const result = await TauriUtils.openFolder();
    if (result.success) {
        console.log('文件夹已打开');
        await TauriUtils.showNotification('成功', '文件夹已打开');
    } else {
        console.error('打开文件夹失败:', result.error);
        await TauriUtils.showNotification('错误', `打开文件夹失败: ${result.error}`);
    }
};

// 监听路由变化
watch(
    () => route.path,
    (newPath) => {
        selectedTab.value = newPath;
    },
    { immediate: true }
);

onMounted(() => {
    selectedTab.value = route.path;
    
    // 初始化 Tauri 事件监听
    if (TauriUtils.isTauri()) {
        TauriUtils.listenToWindowEvents({
            onResize: (event) => {
                console.log('Window resized:', event);
                // 可以在这里添加窗口大小变化的处理逻辑
            },
            onFocus: () => {
                console.log('Window focused');
            },
            onBlur: () => {
                console.log('Window blurred');
            }
        });
    }
});
</script>

<style lang="scss" scoped>
/* 顶部导航栏 */

.header {
    margin-bottom: 0;
    background: transparent;
    border-radius: 0;
    box-shadow: none;
    padding: 15px 30px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
    border: none;
    backdrop-filter: none;
    flex-shrink: 0;
    
    /* 启用窗口拖动 */
    -webkit-app-region: drag;
}

.header::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(
        90deg,
        transparent,
        var(--primary),
        transparent
    );
}

.logo {
    display: flex;
    align-items: center;
    gap: 15px;
    cursor: pointer;
    
    /* 禁用拖动以允许点击 */
    -webkit-app-region: no-drag;
}

.logo-icon {
    width: 42px;
    height: 42px;
    background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--dark-bg);
    font-size: 24px;
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.5);
}

.logo-text {
    font-family: 'Orbitron', sans-serif;
    font-size: 22px;
    font-weight: 800;
    background: linear-gradient(90deg, var(--primary), var(--primary-dark));
    background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
}

.nav-tabs {
    display: flex;
    gap: 5px;
    background: var(--darker-card);
    padding: 6px;
    border-radius: 12px;
    border: 1px solid var(--dark-border);
    
    /* 禁用拖动以允许点击 */
    -webkit-app-region: no-drag;
}

.nav-btn {
    padding: 10px 24px;
    border-radius: 10px;
    background: transparent;
    border: none;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    overflow: hidden;
    user-select: none;
    transform: translateZ(0);
    will-change: transform;
}

.nav-btn:hover {
    color: white;
    transform: translateY(-2px) scale(1.02);
}

.nav-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        135deg,
        var(--primary) 0%,
        var(--primary-dark) 100%
    );
    opacity: 0;
    transition: var(--transition);
    z-index: -1;
}

.nav-btn:hover::before {
    opacity: 0.2;
}

.nav-btn.active {
    background: linear-gradient(
        135deg,
        var(--primary) 0%,
        var(--primary-dark) 100%
    );
    color: var(--dark-bg);
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
}

.nav-btn.active i {
    color: var(--dark-bg);
}

.user-section {
    display: flex;
    align-items: center;
    gap: 15px;
    
    /* 禁用拖动以允许点击 */
    -webkit-app-region: no-drag;
}

.notification-btn,
.user-btn {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--darker-card);
    border: 1px solid var(--dark-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    cursor: pointer;
    transition: var(--transition);
    font-weight: 800;
    font-size: 20px;
    font-style: italic;
}

.notification-btn:hover,
.user-btn:hover {
    background: var(--primary);
    color: var(--dark-bg);
    border-color: var(--primary);
    transform: translateY(-2px);
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
}

/* 模态框样式 */
:deep(.el-dialog) {
    background: var(--darker-card);
    border: 1px solid var(--dark-border);
    border-radius: 16px;
}

/* 登录模态框特定样式 */
:deep(.login-modal) {
    .el-dialog {
        background: rgba(15, 30, 47, 0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(0, 240, 255, 0.2);
        border-radius: 24px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 240, 255, 0.1);
    }
    
    .el-dialog__header {
        display: none !important;
    }
    
    .el-dialog__body {
        padding: 0;
        background: transparent;
    }
}

.login-container {
    padding: 40px;
    text-align: center;
}

.login-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 30px;
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    color: var(--dark-bg);
    box-shadow: 0 10px 30px rgba(0, 240, 255, 0.3);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% {
        box-shadow: 0 10px 30px rgba(0, 240, 255, 0.3);
    }
    50% {
        box-shadow: 0 10px 40px rgba(0, 240, 255, 0.5);
        transform: translateY(-2px);
    }
    100% {
        box-shadow: 0 10px 30px rgba(0, 240, 255, 0.3);
    }
}

.login-title {
    font-size: 28px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 8px 0;
    font-family: 'Orbitron', sans-serif;
}

.login-subtitle {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0 0 40px 0;
    opacity: 0.8;
}

.login-form {
    .el-form-item {
        margin-bottom: 24px;
    }
    
    .el-form-item__content {
        display: flex;
        justify-content: center;
    }
}

.login-actions {
    display: flex;
    flex-direction: row;
    gap: 16px;
    margin-top: 32px;
    justify-content: center;
}

.login-btn {
    flex: 1;
    min-width: 120px;
    height: 48px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%) !important;
    border: none !important;
    color: var(--dark-bg) !important;
    transition: all 0.3s ease;
}

.login-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 240, 255, 0.4) !important;
}

.cancel-btn {
    flex: 1;
    min-width: 120px;
    height: 48px;
    background: transparent !important;
    border: 1px solid var(--dark-border) !important;
    color: var(--text-secondary) !important;
    border-radius: 12px;
    transition: all 0.3s ease;
}

.cancel-btn:hover {
    border-color: var(--primary) !important;
    color: var(--primary) !important;
    background: rgba(0, 240, 255, 0.05) !important;
}

:deep(.el-dialog__header) {
    display: none !important;
}

:deep(.el-dialog__body) {
    padding: 30px;
    background: var(--darker-card);
}

:deep(.el-dialog__footer) {
    background: var(--darker-card);
    border-top: 1px solid var(--dark-border);
    padding: 20px 30px;
    border-radius: 0 0 16px 16px;
}

/* 表单样式 */
:deep(.el-form-item__label) {
    color: var(--text-primary) !important;
    font-weight: 600;
}

/* 登录表单输入框样式 */
:deep(.login-form) {
    .el-input__wrapper {
        background: rgba(255, 255, 255, 0.05) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 12px !important;
        height: 48px !important;
        padding: 0 20px !important;
        transition: all 0.3s ease !important;
    }
    
    .el-input__wrapper:hover {
        border-color: rgba(0, 240, 255, 0.4) !important;
        background: rgba(0, 240, 255, 0.05) !important;
    }
    
    .el-input__wrapper.is-focus {
        border-color: var(--primary) !important;
        box-shadow: 0 0 0 3px rgba(0, 240, 255, 0.1) !important;
        background: rgba(0, 240, 255, 0.08) !important;
    }
    
    .el-input__inner {
        color: var(--text-primary) !important;
        background: transparent !important;
        font-size: 15px !important;
        padding-left: 16px !important;
    }
    
    .el-input__inner::placeholder {
        color: rgba(255, 255, 255, 0.4) !important;
        font-weight: 400;
    }
    
    .el-input__prefix {
        color: rgba(255, 255, 255, 0.6) !important;
        font-size: 16px;
    }
    
    .el-input__suffix {
        color: rgba(255, 255, 255, 0.6) !important;
    }
}

:deep(.el-input__wrapper) {
    background: var(--card-bg) !important;
    border: 1px solid var(--dark-border) !important;
    border-radius: 8px;
}

:deep(.el-input__wrapper:hover) {
    border-color: var(--primary) !important;
}

:deep(.el-input__wrapper.is-focus) {
    border-color: var(--primary) !important;
    box-shadow: 0 0 0 2px rgba(0, 240, 255, 0.2) !important;
}

:deep(.el-input__inner) {
    color: var(--text-primary) !important;
    background: transparent !important;
}

:deep(.el-input__inner::placeholder) {
    color: var(--text-secondary) !important;
}

/* Tabs 样式 */
:deep(.el-tabs--border-card) {
    background: var(--card-bg);
    border: 1px solid var(--dark-border);
    border-radius: 8px;
}

:deep(.el-tabs__header) {
    background: var(--darker-card);
    border-bottom: 1px solid var(--dark-border);
}

:deep(.el-tabs__item) {
    color: var(--text-secondary) !important;
    border-right: 1px solid var(--dark-border) !important;
}

:deep(.el-tabs__item:hover) {
    color: var(--primary) !important;
}

:deep(.el-tabs__item.is-active) {
    color: var(--primary) !important;
    background: var(--card-bg) !important;
}

:deep(.el-tabs__content) {
    padding: 20px;
}

/* 选项样式 */
:deep(.el-radio) {
    color: var(--text-primary) !important;
}

:deep(.el-radio__input.is-checked .el-radio__inner) {
    background: var(--primary) !important;
    border-color: var(--primary) !important;
}

:deep(.el-select .el-input.is-focus .el-input__wrapper) {
    border-color: var(--primary) !important;
}

:deep(.el-switch.is-checked .el-switch__core) {
    background-color: var(--primary) !important;
}

:deep(.el-slider__runway) {
    background: var(--dark-border) !important;
}

:deep(.el-slider__bar) {
    background: var(--primary) !important;
}

:deep(.el-slider__button) {
    border: 2px solid var(--primary) !important;
    background: var(--primary) !important;
}

/* 按钮样式 */
:deep(.el-button--primary) {
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%) !important;
    border: none !important;
    color: var(--dark-bg) !important;
    font-weight: 600;
}

:deep(.el-button--primary:hover) {
    background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%) !important;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 240, 255, 0.3);
}

:deep(.el-button) {
    background: var(--card-bg) !important;
    color: var(--text-primary) !important;
    border: 1px solid var(--dark-border) !important;
    font-weight: 500;
}

:deep(.el-button:hover) {
    border-color: var(--primary) !important;
    color: var(--primary) !important;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}
</style>