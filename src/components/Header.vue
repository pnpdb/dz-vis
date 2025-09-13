<template>
    <!-- 顶部导航栏 -->
    <header class="header" style="overflow: visible !important;">
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
            :close-on-click-modal="false"
            :close-on-press-escape="false"
            class="custom-login-dialog"
            append-to-body
            :teleported="true"
            @open="onDialogOpen"
            @opened="onDialogOpened"
            @close="onDialogClose"
            @closed="onDialogClosed"
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
                            @click="closeLogin"
                            class="cancel-btn"
                        >
                            Cancel
                        </el-button>
                    </div>
                </el-form>
                
                <!-- 手动关闭按钮 -->
                <button class="manual-close-btn" @click="closeLogin" title="关闭">
                    <fa icon="times" />
                </button>
            </div>
        </el-dialog>
        
        <!-- 设置模态框 -->
        <el-dialog
            v-model="settingsDialogVisible"
            title="系统设置"
            width="600px"
            :show-close="true"
            center
            :z-index="3002"
            append-to-body
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
                <el-tab-pane label="车辆设置" name="connection">
                    <VehicleConnectionManager />
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
import { ref, watch, onMounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { TauriUtils } from '@/utils/tauri.js';
import { ElMessage } from 'element-plus';
import VehicleConnectionManager from '@/components/VehicleConnectionManager.vue';

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

// 关闭登录框
const closeLogin = () => {
    console.log('关闭登录框');
    loginDialogVisible.value = false;
};

// Element Plus对话框事件监听器
const onDialogOpen = () => {
    console.log('🟢 对话框开始打开');
};

const onDialogOpened = () => {
    console.log('✅ 对话框完全打开');
    
    // 立即检查对话框的实际渲染状态
    setTimeout(() => {
        const dialog = document.querySelector('.el-dialog');
        const overlay = document.querySelector('.el-overlay');
        
        if (dialog) {
            const dialogRect = dialog.getBoundingClientRect();
            const dialogStyles = getComputedStyle(dialog);
            
            console.log('🔍 对话框实际状态检查:');
            console.log('位置:', dialogRect);
            console.log('z-index:', dialogStyles.zIndex);
            console.log('display:', dialogStyles.display);
            console.log('visibility:', dialogStyles.visibility);
            console.log('opacity:', dialogStyles.opacity);
            console.log('position:', dialogStyles.position);
            
            // 强制将对话框挂载到body，脱离父容器限制
            const dialogWrapper = dialog.closest('.el-overlay');
            if (dialogWrapper && dialogWrapper.parentNode !== document.body) {
                console.log('🔧 将对话框移动到body');
                document.body.appendChild(dialogWrapper);
            }
            
            // 强制设置最高z-index和正确位置
            dialog.style.zIndex = '99999';
            dialog.style.position = 'fixed';
            dialog.style.top = '50%';
            dialog.style.left = '50%';
            dialog.style.transform = 'translate(-50%, -50%)';
            dialog.style.display = 'block';
            dialog.style.visibility = 'visible';
            dialog.style.opacity = '1';
            dialog.style.width = '420px';
            dialog.style.height = 'auto';
            dialog.style.maxHeight = '90vh';
            
            // 强制应用主题背景样式
            dialog.style.background = 'rgba(15, 30, 47, 0.95)';
            dialog.style.backdropFilter = 'blur(20px)';
            dialog.style.border = '1px solid rgba(0, 240, 255, 0.2)';
            dialog.style.borderRadius = '24px';
            dialog.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 240, 255, 0.1)';
            
            // 详细检查DOM结构并移除多余边框
            console.log('🔍 对话框DOM结构:', dialog);
            console.log('🔍 对话框所有子元素:', dialog.children);
            
            // 移除对话框本身可能的多余样式
            dialog.style.boxShadow = 'none'; // 先移除可能的双重阴影
            dialog.style.border = 'none';    // 移除可能的内层边框
            
            // 检查并移除所有子元素的边框
            Array.from(dialog.children).forEach((child, index) => {
                console.log(`🔍 子元素 ${index}:`, child.className, child);
                child.style.border = 'none';
                child.style.background = 'transparent';
                child.style.boxShadow = 'none';
            });
            
            // 移除Element Plus的默认样式
            const dialogBody = dialog.querySelector('.el-dialog__body');
            if (dialogBody) {
                dialogBody.style.background = 'transparent';
                dialogBody.style.border = 'none';
                dialogBody.style.padding = '0';
                dialogBody.style.boxShadow = 'none';
                console.log('🧹 移除dialog__body边框完成');
            }
            
            const dialogHeader = dialog.querySelector('.el-dialog__header');
            if (dialogHeader) {
                dialogHeader.style.display = 'none';
                console.log('🧹 隐藏dialog__header完成');
            }
            
            // 检查是否有el-dialog__wrapper等包装元素
            const wrapper = dialog.closest('.el-dialog__wrapper');
            if (wrapper) {
                wrapper.style.border = 'none';
                wrapper.style.background = 'transparent';
                wrapper.style.boxShadow = 'none';
                console.log('🧹 移除wrapper边框完成');
            }
            
            // 最后重新应用外层样式
            dialog.style.background = 'rgba(15, 30, 47, 0.95)';
            dialog.style.backdropFilter = 'blur(20px)';
            dialog.style.border = '1px solid rgba(0, 240, 255, 0.2)';
            dialog.style.borderRadius = '24px';
            dialog.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 240, 255, 0.1)';
            
            // 特别检查关闭按钮的父容器
            const closeBtn = dialog.querySelector('.manual-close-btn');
            if (closeBtn) {
                const closeBtnParent = closeBtn.parentElement;
                console.log('🔍 关闭按钮的父容器:', closeBtnParent.className, closeBtnParent);
                // 移除关闭按钮父容器的边框
                closeBtnParent.style.border = 'none';
                closeBtnParent.style.background = 'transparent';
                closeBtnParent.style.boxShadow = 'none';
                console.log('🧹 移除关闭按钮父容器边框完成');
            }
            
            // 特别检查login-container
            const loginContainer = dialog.querySelector('.login-container');
            if (loginContainer) {
                console.log('🔍 login-container样式:', getComputedStyle(loginContainer));
                loginContainer.style.border = 'none';
                loginContainer.style.background = 'transparent';
                loginContainer.style.boxShadow = 'none';
                loginContainer.style.outline = 'none';
                console.log('🧹 强制移除login-container边框完成');
            }
            
            // 检查表单和其他可能的边框元素
            const form = dialog.querySelector('.login-form');
            if (form) {
                form.style.border = 'none';
                form.style.background = 'transparent';
                form.style.boxShadow = 'none';
                console.log('🧹 移除表单边框完成');
            }
            
            // 检查所有可能有边框的元素
            const possibleBorderElements = dialog.querySelectorAll('div, form, .el-form, .el-form-item');
            possibleBorderElements.forEach((element, index) => {
                element.style.border = 'none';
                element.style.background = 'transparent';
                element.style.boxShadow = 'none';
                element.style.outline = 'none';
                console.log(`🧹 移除元素${index}边框: ${element.className}`);
            });
            
            console.log('🧹 所有边框清理完成');
            
            console.log('🎨 强制应用主题样式完成');
            
            // 验证样式是否正确应用
            const finalStyles = getComputedStyle(dialog);
            console.log('🎨 最终背景色:', finalStyles.backgroundColor);
            console.log('🎨 最终边框:', finalStyles.border);
            console.log('🎨 最终圆角:', finalStyles.borderRadius);
            
            console.log('🔧 强制修复后的位置:', dialog.getBoundingClientRect());
        }
        
        if (overlay) {
            // 确保遮罩层也在body下
            if (overlay.parentNode !== document.body) {
                console.log('🔧 将遮罩层移动到body');
                document.body.appendChild(overlay);
            }
            overlay.style.zIndex = '99998';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            console.log('🔍 遮罩层z-index:', getComputedStyle(overlay).zIndex);
        }
    }, 100);
};

const onDialogClose = () => {
    console.log('🔴 对话框开始关闭');
    // 防止意外关闭 - 只有明确调用closeLogin才应该关闭
    console.trace('对话框关闭调用栈');
};

const onDialogClosed = () => {
    console.log('❌ 对话框完全关闭');
};

// 显示登录框 - 简化版本
const showLogin = () => {
    console.log('设置按钮被点击，显示登录框');
    
    // 清空表单
    loginForm.value = {
        username: '',
        password: ''
    };
    
    // 简单设置状态，不进行复杂的DOM操作
    loginDialogVisible.value = true;
    console.log('登录框显示状态:', loginDialogVisible.value);
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
        if (username === 'dz' && password === '123456') {
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
    overflow: visible !important; /* 确保对话框不被裁剪 */
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
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
    background: rgba(15, 30, 47, 0.95) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid rgba(0, 240, 255, 0.3) !important;
    border-radius: 16px !important;
    z-index: 3000 !important; /* 确保在HUD层之上 */
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 240, 255, 0.1) !important;
}

:deep(.el-overlay) {
    z-index: 2999 !important; /* 遮罩层也需要设置高z-index */
    background: rgba(0, 10, 20, 0.8) !important; /* 深色科技感遮罩 */
    backdrop-filter: blur(8px) !important;
}

/* 登录模态框特定样式 */
.login-modal {
    z-index: 3001 !important;
}

:deep(.login-modal .el-dialog) {
    background: rgba(15, 30, 47, 0.95) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid rgba(0, 240, 255, 0.2) !important;
    border-radius: 24px !important;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 240, 255, 0.1) !important;
    z-index: 3001 !important;
    display: block !important;
    visibility: visible !important;
}

/* 更强的样式覆盖 */
:deep(.el-dialog.login-modal) {
    background: rgba(15, 30, 47, 0.95) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid rgba(0, 240, 255, 0.2) !important;
    border-radius: 24px !important;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 240, 255, 0.1) !important;
}

/* 通过custom-class强制覆盖 */
:deep(.login-modal-dialog) {
    background: rgba(15, 30, 47, 0.95) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid rgba(0, 240, 255, 0.2) !important;
    border-radius: 24px !important;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 240, 255, 0.1) !important;
}

:deep(.login-modal .el-dialog__header) {
    display: none !important;
}

:deep(.login-modal .el-dialog__body) {
    padding: 0 !important;
    background: transparent !important;
}

.login-container {
    padding: 40px;
    text-align: center;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
    position: relative;
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

/* 设置对话框标题样式 */
:deep(.el-dialog__header) {
    background: transparent !important;
    border-bottom: 1px solid rgba(0, 240, 255, 0.2) !important;
    padding: 20px 30px !important;
}

:deep(.el-dialog__title) {
    color: var(--text-primary) !important;
    font-family: 'Orbitron', sans-serif !important;
    font-weight: 600 !important;
    font-size: 18px !important;
}

/* 登录对话框隐藏标题 */
:deep(.login-modal .el-dialog__header) {
    display: none !important;
}

:deep(.el-dialog__body) {
    padding: 30px !important;
    background: transparent !important;
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
}

/* 设置对话框Tab样式 */
:deep(.el-tabs) {
    .el-tabs__header {
        background: rgba(0, 15, 30, 0.5) !important;
        border-radius: 8px !important;
        padding: 5px !important;
        border: 1px solid rgba(0, 240, 255, 0.2) !important;
    }
    
    .el-tabs__nav-wrap {
        background: transparent !important;
    }
    
    .el-tabs__nav {
        border: none !important;
    }
    
    .el-tabs__item {
        color: var(--text-secondary) !important;
        border: none !important;
        padding: 8px 16px !important;
        border-radius: 6px !important;
        margin-right: 4px !important;
        transition: all 0.3s ease !important;
        font-family: 'Orbitron', sans-serif !important;
        font-weight: 500 !important;
    }
    
    .el-tabs__item:hover {
        color: var(--primary) !important;
        background: rgba(0, 240, 255, 0.1) !important;
    }
    
    .el-tabs__item.is-active {
        color: var(--dark-bg) !important;
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%) !important;
        border: none !important;
        box-shadow: 0 4px 15px rgba(0, 240, 255, 0.3) !important;
    }
    
    .el-tabs__active-bar {
        display: none !important;
    }
    
    .el-tabs__content {
        padding: 20px 0 !important;
    }
}

:deep(.el-input__inner::placeholder) {
    color: var(--text-secondary) !important;
}

/* 设置对话框表单控件样式 */
:deep(.el-radio-group) {
    .el-radio {
        margin-right: 20px !important;
        
        .el-radio__input {
            .el-radio__inner {
                background: rgba(0, 15, 30, 0.8) !important;
                border: 1px solid rgba(0, 240, 255, 0.3) !important;
            }
            
            &.is-checked .el-radio__inner {
                background: var(--primary) !important;
                border-color: var(--primary) !important;
            }
        }
        
        .el-radio__label {
            color: var(--text-primary) !important;
            font-weight: 500 !important;
        }
    }
}

:deep(.el-select) {
    .el-input__wrapper {
        background: rgba(0, 15, 30, 0.8) !important;
        border: 1px solid rgba(0, 240, 255, 0.3) !important;
        border-radius: 8px !important;
    }
    
    .el-input__wrapper:hover {
        border-color: var(--primary) !important;
    }
    
    .el-input__wrapper.is-focus {
        border-color: var(--primary) !important;
        box-shadow: 0 0 0 2px rgba(0, 240, 255, 0.2) !important;
    }
}

:deep(.el-switch) {
    .el-switch__core {
        background: rgba(255, 255, 255, 0.2) !important;
        border: 1px solid rgba(0, 240, 255, 0.3) !important;
    }
    
    &.is-checked .el-switch__core {
        background: var(--primary) !important;
        border-color: var(--primary) !important;
    }
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

/* 自定义登录对话框样式 */
:deep(.custom-login-dialog) {
    background: rgba(15, 30, 47, 0.95) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid rgba(0, 240, 255, 0.2) !important;
    border-radius: 24px !important;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 240, 255, 0.1) !important;
    z-index: 99999 !important;
    position: fixed !important;
}

/* 强制覆盖Element Plus默认样式 */
:deep(.el-dialog.custom-login-dialog) {
    background: rgba(15, 30, 47, 0.95) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid rgba(0, 240, 255, 0.2) !important;
    border-radius: 24px !important;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 240, 255, 0.1) !important;
}

/* 移除内部元素的边框和背景 */
:deep(.el-dialog__body) {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
}

:deep(.el-dialog__header) {
    display: none !important;
}

/* 手动关闭按钮 */
.manual-close-btn {
    position: absolute;
    top: 15px;
    right: 15px;
    width: 32px;
    height: 32px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(0, 240, 255, 0.8);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s ease;
    z-index: 10;
}

.manual-close-btn:hover {
    background: rgba(255, 0, 0, 0.2);
    color: #ff4d6d;
    transform: scale(1.1);
}
</style>