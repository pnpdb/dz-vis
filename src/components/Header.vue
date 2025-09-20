<template>
    <!-- 顶部导航栏 -->
    <header class="header" style="overflow: visible !important;">
        <div class="logo">
            <div class="logo-icon">
                <fa icon="car" />
            </div>
            <div class="logo-text">DZ CAR MANAGER</div>
        </div>

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
                title="文件查看器"
                content="选择并查看本地PDF/Word/Excel"
                placement="bottom-end"
            >
                <template #reference>
                    <button class="notification-btn btn-ripple" @click="openLocalDocument">
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
            
            <el-popover
                class="center"
                title="关于软件"
                content="点击查看软件信息"
                placement="bottom-end"
            >
                <template #reference>
                    <button class="notification-btn btn-ripple" @click="showAbout">
                        <fa icon="info-circle" />
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
                    <el-form label-width="120px" label-position="left" class="basic-settings-form">
                        
                        <el-form-item label="调试模式">
                            <el-switch v-model="settings.debugMode" />
                        </el-form-item>
                        <el-form-item label="日志级别">
                            <el-select 
                                v-model="settings.logLevel" 
                                placeholder="请选择日志级别" 
                                style="min-width: 180px;" 
                                :teleported="true"
                                popper-class="settings-select-popper"
                            >
                                <el-option label="DEBUG" value="DEBUG" />
                                <el-option label="INFO" value="INFO" />
                                <el-option label="WARNING" value="WARNING" />
                                <el-option label="ERROR" value="ERROR" />
                            </el-select>
                        </el-form-item>
                        <el-form-item label="缓存大小">
                            <el-input-number
                                v-model="settings.cacheSize"
                                :min="10"
                                :max="10240"
                                :step="10"
                                controls-position="right"
                                style="vertical-align: middle;"
                            />
                            <span style="margin-left: 8px; color: var(--text-secondary);">MB</span>
                        </el-form-item>
                    </el-form>
                </el-tab-pane>
                <el-tab-pane label="模型设置" name="model">
                    <el-form label-width="140px">
                        <el-form-item label="显示坐标轴">
                            <el-switch 
                                v-model="modelSettings.showAxes" 
                                @change="handleAxesVisibilityChange"
                                active-text="开启"
                                inactive-text="关闭"
                            />
                            <div class="setting-description">
                                控制沙盘和小车模型的XYZ坐标轴显示
                            </div>
                        </el-form-item>
                        <el-form-item label="显示地图网格">
                            <el-switch 
                                v-model="modelSettings.showGrid" 
                                @change="handleGridVisibilityChange"
                                active-text="开启"
                                inactive-text="关闭"
                            />
                            <div class="setting-description">
                                显示地面网格辅助线，帮助观察空间方向
                            </div>
                        </el-form-item>
                        <el-form-item label="地图尺寸">
                            <el-button 
                                type="primary" 
                                @click="showSandboxDimensions"
                                icon="InfoFilled"
                            >
                                查看沙盘尺寸信息
                            </el-button>
                        </el-form-item>
                    </el-form>
                </el-tab-pane>
                <el-tab-pane label="车辆设置" name="connection">
                    <VehicleConnectionManager />
                </el-tab-pane>
                <el-tab-pane label="沙盘设置" name="sandbox">
                    <SandboxSettingsManager />
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
        
        <!-- 关于软件模态框 -->
        <el-dialog
            v-model="aboutDialogVisible"
            title="关于软件"
            width="500px"
            :show-close="true"
            center
            :z-index="3003"
            class="about-dialog"
            top="15vh"
            :modal="true"
            :close-on-click-modal="true"
            :close-on-press-escape="true"
            destroy-on-close
            append-to-body
        >
            <div class="about-content">
                <div class="software-info">
                    <div class="logo-section">
                        <div class="about-logo">
                            <fa icon="car" class="about-icon" />
                        </div>
                        <h2 class="software-title">DZ CAR MANAGER</h2>
                        <p class="software-subtitle">智能车辆管理系统</p>
                    </div>
                    
                    <div class="info-section">
                        <div class="info-item">
                            <span class="info-label">软件版本：</span>
                            <span class="info-value">1.0.0</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">开发公司：</span>
                            <span class="info-value">北京渡众机器人科技有限公司</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">联系邮箱：</span>
                            <span class="info-value">support@dzrobot.com</span>
                        </div>
                    </div>
                    
                    <div class="copyright-section">
                        <p class="copyright">© 2025 北京渡众机器人科技有限公司</p>
                        <p class="rights">保留所有权利</p>
                    </div>
                </div>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button type="primary" @click="aboutDialogVisible = false">确定</el-button>
                </div>
            </template>
        </el-dialog>

        <!-- 沙盘尺寸信息弹窗 -->
        <el-dialog
            v-model="showSandboxDimensionsDialog"
            title="沙盘模型尺寸信息"
            width="800px"
            :close-on-click-modal="true"
            :close-on-press-escape="true"
            center
            class="sandbox-dimensions-custom-dialog"
        >
            <div v-if="sandboxDimensionsData" class="sandbox-content">
                <!-- 标题区域 -->
                <div class="title-section">
                    <h2>沙盘模型尺寸信息</h2>
                    <div class="title-line"></div>
                </div>

                <!-- 两列网格布局 -->
                <div class="grid-layout">
                    <!-- 第一行第一列 -->
                    <div class="info-card axes-card">
                        <h3>坐标轴对应</h3>
                        <div class="info-content">
                            <div>X轴 (红色): 沙盘宽度 - 左右方向</div>
                            <div>Y轴 (绿色): 沙盘高度 - 上下方向</div>
                            <div>Z轴 (蓝色): 沙盘深度 - 前后方向</div>
                        </div>
                    </div>

                    <!-- 第一行第二列 -->
                    <div class="info-card size-card">
                        <h3>场景实际尺寸</h3>
                        <div class="info-content">
                            <div class="data-row">
                                <span>宽度 (X轴):</span>
                                <span class="value">{{ sandboxDimensionsData.scaled.width.toFixed(3) }} 单位</span>
                            </div>
                            <div class="data-row">
                                <span>高度 (Y轴):</span>
                                <span class="value">{{ sandboxDimensionsData.scaled.height.toFixed(3) }} 单位</span>
                            </div>
                            <div class="data-row">
                                <span>深度 (Z轴):</span>
                                <span class="value">{{ sandboxDimensionsData.scaled.depth.toFixed(3) }} 单位</span>
                            </div>
                        </div>
                    </div>

                    <!-- 第二行第一列 -->
                    <div class="info-card center-card">
                        <h3>中心坐标</h3>
                        <div class="info-content">
                            <div class="data-row">
                                <span>X:</span>
                                <span class="value">{{ sandboxDimensionsData.center.x.toFixed(3) }}</span>
                            </div>
                            <div class="data-row">
                                <span>Y:</span>
                                <span class="value">{{ sandboxDimensionsData.center.y.toFixed(3) }}</span>
                            </div>
                            <div class="data-row">
                                <span>Z:</span>
                                <span class="value">{{ sandboxDimensionsData.center.z.toFixed(3) }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 第二行第二列 -->
                    <div class="info-card bounds-card">
                        <h3>坐标范围</h3>
                        <div class="info-content">
                            <div class="data-row">
                                <span>X轴:</span>
                                <span class="value">{{ sandboxDimensionsData.bounds.min.x.toFixed(3) }} ~ {{ sandboxDimensionsData.bounds.max.x.toFixed(3) }}</span>
                            </div>
                            <div class="data-row">
                                <span>Y轴:</span>
                                <span class="value">{{ sandboxDimensionsData.bounds.min.y.toFixed(3) }} ~ {{ sandboxDimensionsData.bounds.max.y.toFixed(3) }}</span>
                            </div>
                            <div class="data-row">
                                <span>Z轴:</span>
                                <span class="value">{{ sandboxDimensionsData.bounds.min.z.toFixed(3) }} ~ {{ sandboxDimensionsData.bounds.max.z.toFixed(3) }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 第三行跨两列 -->
                    <div class="info-card original-card full-width">
                        <h3>原始尺寸</h3>
                        <div class="info-content original-grid">
                            <div class="data-row">
                                <span>宽度:</span>
                                <span class="value">{{ sandboxDimensionsData.original.width.toFixed(1) }} 单位</span>
                            </div>
                            <div class="data-row">
                                <span>高度:</span>
                                <span class="value">{{ sandboxDimensionsData.original.height.toFixed(1) }} 单位</span>
                            </div>
                            <div class="data-row">
                                <span>深度:</span>
                                <span class="value">{{ sandboxDimensionsData.original.depth.toFixed(1) }} 单位</span>
                            </div>
                            <div class="data-row">
                                <span>缩放比例:</span>
                                <span class="value">{{ (sandboxDimensionsData.scale * 100).toFixed(1) }}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 使用说明居中 -->
                <div class="usage-section">
                    <div class="usage-card">
                        <h3>使用说明</h3>
                        <div class="usage-content">
                            <div>坐标范围用于车辆位置映射计算</div>
                            <div>中心点是沙盘几何中心位置</div>
                            <div>可通过设置面板控制坐标轴和网格显示</div>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="custom-dialog-footer">
                    <el-button type="primary" @click="closeSandboxDimensionsDialog">确定</el-button>
                </div>
            </template>
        </el-dialog>

        <!-- 文档预览弹窗（仅内嵌预览PDF，Word/Excel使用系统默认程序打开） -->
        <el-dialog
            v-model="documentViewerVisible"
            :title="documentTitle"
            width="80vw"
            top="8vh"
            :show-close="true"
            append-to-body
            destroy-on-close
            :close-on-click-modal="true"
            :close-on-press-escape="true"
            class="document-viewer-dialog"
        >
            <div v-if="documentType === 'pdf' && documentUrl" class="document-container">
                <iframe
                    :src="documentUrl"
                    class="pdf-frame"
                    title="PDF 预览"
                />
            </div>
            <div v-else class="document-fallback">
                <p>此文件类型暂不支持内嵌预览，已尝试使用系统默认程序打开。</p>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="closeDocumentViewer">关闭</el-button>
                </div>
            </template>
        </el-dialog>
    </header>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { TauriUtils } from '@/utils/tauri.js';
import { invoke } from '@tauri-apps/api/core';
import { ElMessage, ElMessageBox } from 'element-plus';
import VehicleConnectionManager from '@/components/VehicleConnectionManager.vue';
import SandboxSettingsManager from '@/components/SandboxSettingsManager.vue';
import { toggleAxesVisibility, toggleGridVisibility, getSandboxDimensionsInfo } from '@/components/Scene3D/index.js';
// 使用后端命令，避免前端插件导入问题
import { convertFileSrc } from '@tauri-apps/api/core';

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

// 关于弹窗相关
const aboutDialogVisible = ref(false);
const settings = ref({
    theme: 'dark',
    animations: true,
    showGrid: false,
    frameRate: 60,
    debugMode: false,
    logLevel: 'INFO',
    cacheSize: 1000
});

// 模型设置
const modelSettings = ref({
    showAxes: false,
    showGrid: false
});

// 沙盘尺寸信息弹窗状态
const showSandboxDimensionsDialog = ref(false);
const sandboxDimensionsData = ref(null);

// 文档预览
const documentViewerVisible = ref(false);
const documentTitle = ref('文档预览');
const documentUrl = ref('');
const documentType = ref(''); // 'pdf' | 'docx' | 'xlsx' | 'other'
let currentObjectUrl = '';

const selected = (item) => {
    selectedTab.value = item.path;
    router.push(item.path);
};

// 主题应用（固定深色）
const applyTheme = (theme) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'dark');
    root.style.setProperty('--dark-bg', '#0a1523');
    root.style.setProperty('--darker-card', '#091220');
    root.style.setProperty('--dark-card', '#0f1e2f');
    root.style.setProperty('--dark-border', '#1a324d');
    root.style.setProperty('--text-primary', '#e6f7ff');
    root.style.setProperty('--text-secondary', '#89a2c0');
    document.body.style.background = 'radial-gradient(circle at top left, #071220 0%, #0a1625 70%)';
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

// 显示关于弹窗
const showAbout = () => {
    console.log('关于按钮被点击，显示关于弹窗');
    aboutDialogVisible.value = true;
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
const saveSettings = async () => {
    try {
        const payload = {
            debug_model: settings.value.debugMode,
            log_level: settings.value.logLevel,
            cache_size: settings.value.cacheSize
        };
        const res = await invoke('update_app_settings', { request: payload });
        console.log('✅ 应用设置已保存:', res);
        ElMessage.success('设置已保存！');
        settingsDialogVisible.value = false;
    } catch (e) {
        console.error('❌ 保存应用设置失败:', e);
        ElMessage.error(`保存失败: ${e}`);
    }
};

// 重置设置
const resetSettings = () => {
    settings.value = {
        theme: 'dark',
        animations: true,
        showGrid: false,
        frameRate: 60,
        debugMode: false,
        logLevel: 'info',
        cacheSize: 1000
    };
    
    // 重置模型设置
    modelSettings.value = {
        showAxes: false,
        showGrid: false
    };
    
    // 应用模型设置
    toggleAxesVisibility(modelSettings.value.showAxes);
    toggleGridVisibility(modelSettings.value.showGrid);
    
    ElMessage.info('设置已重置！');
};

// 处理坐标轴显示切换
const handleAxesVisibilityChange = (visible) => {
    const success = toggleAxesVisibility(visible);
    if (success) {
        ElMessage.success(visible ? '坐标轴已显示' : '坐标轴已隐藏');
    } else {
        ElMessage.warning('操作失败，场景可能尚未初始化');
        // 回滚设置
        modelSettings.value.showAxes = !visible;
    }
};

// 处理地面网格显示切换
const handleGridVisibilityChange = (visible) => {
    const success = toggleGridVisibility(visible);
    if (success) {
        ElMessage.success(visible ? '地面网格已显示' : '地面网格已隐藏');
    } else {
        ElMessage.warning('操作失败，场景可能尚未初始化');
        // 回滚设置
        modelSettings.value.showGrid = !visible;
    }
};

// 显示沙盘尺寸信息
const showSandboxDimensions = () => {
    const dimensions = getSandboxDimensionsInfo();
    
    if (!dimensions) {
        ElMessage.warning('沙盘模型尚未加载完成，请稍后再试');
        return;
    }
    
    // 存储数据供模板使用
    sandboxDimensionsData.value = dimensions;
    showSandboxDimensionsDialog.value = true;
};

// 关闭弹窗
const closeSandboxDimensionsDialog = () => {
    showSandboxDimensionsDialog.value = false;
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

// 打开本地文档并预览（PDF内嵌，其他类型交由系统程序）
const openLocalDocument = async () => {
    try {
        const res = await TauriUtils.safeInvoke('pick_document');
        if (!res.success || !res.data) return;
        const filePath = res.data;
        const lower = filePath.toLowerCase();

        // 清理旧的对象URL
        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
            currentObjectUrl = '';
        }

        if (lower.endsWith('.pdf')) {
            // 内嵌预览PDF（使用convertFileSrc避免FS权限并减小内存占用）
            const url = convertFileSrc(filePath);
            documentUrl.value = url;
            documentType.value = 'pdf';
            documentTitle.value = `PDF 预览 - ${filePath.split('/').pop()}`;
            documentViewerVisible.value = true;
        } else if (lower.endsWith('.doc') || lower.endsWith('.docx') || lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
            // 使用后端命令调用系统默认程序打开
            await TauriUtils.safeInvoke('open_path', { path: filePath });
            documentType.value = 'other';
            documentTitle.value = '文档打开';
            documentUrl.value = '';
            ElMessage.info('已使用系统默认程序打开该文件');
        } else {
            ElMessage.warning('不支持的文件类型');
        }
    } catch (error) {
        console.error('打开文档失败:', error);
        ElMessage.error(`打开文档失败: ${error}`);
    }
};

const closeDocumentViewer = () => {
    documentViewerVisible.value = false;
    if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = '';
    }
    documentUrl.value = '';
    documentType.value = '';
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
    
    // 固定深色主题
    applyTheme('dark');

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
    // 加载应用设置
    invoke('get_app_settings').then((res) => {
        if (res) {
            settings.value.debugMode = !!res.debug_model;
            settings.value.logLevel = (res.log_level || 'INFO').toUpperCase();
            settings.value.cacheSize = Number(res.cache_size ?? 1000);
        }
    }).catch((e) => {
        console.warn('加载应用设置失败:', e);
    });
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

/* 对齐基本设置表单项，修正文字与控件垂直对齐偏差 */
::deep(.basic-settings-form .el-form-item) {
    align-items: center;
}
::deep(.basic-settings-form .el-form-item__label) {
    line-height: 32px; /* 接近输入框高度，文本垂直居中 */
}
::deep(.basic-settings-form .el-input-number),
::deep(.basic-settings-form .el-select .el-input__wrapper) {
    height: 32px;
}

/* 提升“日志级别”下拉弹层层级，防止被对话框或HUD遮挡 */
::v-deep(.settings-select-popper) {
    z-index: 4000 !important;
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

/* 文档查看器样式 */
::deep(.document-viewer-dialog) {
    .el-dialog__body {
        padding: 0 !important;
        background: #1a1a1a !important;
    }
}

.document-container {
    width: 100%;
    height: calc(80vh - 120px);
    background: #111;
}

.pdf-frame {
    width: 100%;
    height: 100%;
    border: none;
    background: #111;
}

.document-fallback {
    padding: 20px;
    color: var(--text-secondary);
}

/* 关于弹窗样式 */
:deep(.about-dialog) {
    .el-dialog {
        background: rgba(15, 30, 47, 0.95) !important;
        backdrop-filter: blur(20px) !important;
        border: 1px solid rgba(0, 240, 255, 0.3) !important;
        border-radius: 16px !important;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 240, 255, 0.1) !important;
    }
    
    .el-dialog__header {
        background: rgba(0, 240, 255, 0.1) !important;
        border-bottom: 1px solid rgba(0, 240, 255, 0.2) !important;
        border-radius: 16px 16px 0 0 !important;
        padding: 20px !important;
        
        .el-dialog__title {
            color: var(--primary) !important;
            font-weight: 600 !important;
            font-size: 18px !important;
        }
    }
    
    .el-dialog__body {
        padding: 30px !important;
        background: transparent !important;
    }
    
    .el-dialog__footer {
        background: rgba(0, 15, 30, 0.3) !important;
        border-top: 1px solid rgba(0, 240, 255, 0.2) !important;
        border-radius: 0 0 16px 16px !important;
        padding: 20px !important;
        text-align: center !important;
    }
}

.about-content {
    color: var(--text-primary);
    text-align: center;
}

.software-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 25px;
}

.logo-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 0;
    border-bottom: 1px solid rgba(0, 240, 255, 0.2);
    margin-bottom: 10px;
}

.about-logo {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, var(--primary), rgba(0, 240, 255, 0.6));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 30px rgba(0, 240, 255, 0.3);
}

.about-icon {
    font-size: 36px;
    color: var(--dark-bg);
}

.software-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--primary);
    margin: 0;
    letter-spacing: 2px;
}

.software-subtitle {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
    font-weight: 300;
}

.info-section {
    display: flex;
    flex-direction: column;
    gap: 15px;
    width: 100%;
    max-width: 350px;
}

.info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: rgba(0, 15, 30, 0.4);
    border: 1px solid rgba(0, 240, 255, 0.1);
    border-radius: 8px;
    transition: all 0.3s ease;
}

.info-item:hover {
    background: rgba(0, 240, 255, 0.05);
    border-color: rgba(0, 240, 255, 0.3);
    transform: translateY(-2px);
}

.info-label {
    font-weight: 500;
    color: var(--text-secondary);
    font-size: 14px;
}

.info-value {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 14px;
}

.copyright-section {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid rgba(0, 240, 255, 0.2);
    text-align: center;
}

.copyright,
.rights {
    margin: 5px 0;
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 300;
}

.copyright {
    font-weight: 400;
}

/* 模型设置样式 */
.setting-description {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 5px;
    line-height: 1.4;
    opacity: 0.8;
}

/* 沙盘尺寸弹窗样式 */
:deep(.sandbox-dimensions-dialog) {
    /* 弹窗背景遮罩层 */
    .el-overlay {
        background-color: rgba(0, 0, 0, 0.8) !important;
    }
    
    /* MessageBox 外层容器 */
    .el-message-box__wrapper {
        background: transparent !important;
        padding: 0 !important;
    }
    
    .el-message-box {
        background: #1a1a1a !important;
        backdrop-filter: blur(20px) !important;
        border: 1px solid #444 !important;
        border-radius: 16px !important;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 212, 255, 0.1) !important;
        max-width: 1000px !important;
        width: auto !important;
        min-width: 800px !important;
        margin: 0 auto !important;
        padding: 0 !important;
        box-sizing: border-box !important;
    }
    
    .el-message-box__header {
        background: #1a1a1a !important;
        border-bottom: none !important;
        border-radius: 16px 16px 0 0 !important;
        padding: 0 !important;
        display: none !important;
    }
    
    .el-message-box__title {
        color: #ffffff !important;
        font-weight: 600 !important;
        font-size: 18px !important;
    }
    
    .el-message-box__content {
        padding: 0 !important;
        max-height: 80vh !important;
        overflow-y: auto !important;
        background: #1a1a1a !important;
        border-radius: 16px 16px 0 0 !important;
        margin: 0 !important;
        width: 100% !important;
        box-sizing: border-box !important;
    }
    
    .el-message-box__message {
        color: #e8e8e8 !important;
        line-height: 1.6 !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #1a1a1a !important;
    }
    
    .el-message-box__btns {
        background: #1a1a1a !important;
        border-top: 1px solid #333 !important;
        border-radius: 0 0 16px 16px !important;
        padding: 20px 0 20px 0 !important;
        margin: 0 !important;
        text-align: right !important;
        display: flex !important;
        justify-content: flex-start !important;
        box-sizing: border-box !important;
        width: 100% !important;
        position: relative !important;
    }
    
    .el-button--primary {
        background: linear-gradient(135deg, #00d4ff, #0099cc) !important;
        border: none !important;
        color: #1a1a1a !important;
        font-weight: 600 !important;
        border-radius: 8px !important;
        padding: 12px 24px !important;
        font-size: 14px !important;
        transition: all 0.3s ease !important;
        box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3) !important;
        position: absolute !important;
        right: 20px !important;
        
        &:hover {
            background: linear-gradient(135deg, #33ddff, #00aadd) !important;
            transform: translateY(-2px) !important;
            box-shadow: 0 6px 20px rgba(0, 212, 255, 0.4) !important;
        }
        
        &:active {
            transform: translateY(0px) !important;
        }
    }
    
    /* 自定义滚动条 */
    .el-message-box__content::-webkit-scrollbar {
        width: 6px;
    }
    
    .el-message-box__content::-webkit-scrollbar-track {
        background: #2a2a2a;
        border-radius: 3px;
    }
    
    .el-message-box__content::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #00d4ff, #0099cc);
        border-radius: 3px;
    }
    
    .el-message-box__content::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, #33ddff, #00aadd);
    }
}

/* 全局弹窗遮罩强制样式 */
.el-overlay.sandbox-dimensions-dialog {
    background-color: rgba(0, 0, 0, 0.8) !important;
}

/* 强制移除所有白色背景 */
:deep(.sandbox-dimensions-dialog) {
    /* 移除所有可能的白色背景和边框 */
    * {
        background-color: transparent !important;
        background: transparent !important;
        border: none !important;
        outline: none !important;
    }
    
    /* 恢复关键元素的背景 */
    .el-message-box,
    .el-message-box__content,
    .el-message-box__message,
    .el-message-box__btns {
        background: #1a1a1a !important;
        background-color: #1a1a1a !important;
    }
    
    /* 恢复边框样式 */
    .el-message-box {
        border: 1px solid #444 !important;
        border-radius: 16px !important;
    }
    
    .el-message-box__btns {
        border-top: 1px solid #333 !important;
    }
}

/* 全局强制样式 - 覆盖Element Plus默认样式 */
.el-message-box.sandbox-dimensions-dialog {
    background: #1a1a1a !important;
    border: 1px solid #444 !important;
    border-radius: 16px !important;
    padding: 0 !important;
    margin: 0 auto !important;
    max-width: 1000px !important;
    width: auto !important;
    min-width: 800px !important;
    box-sizing: border-box !important;
}

.el-message-box.sandbox-dimensions-dialog * {
    background: transparent !important;
    border: none !important;
}

.el-message-box.sandbox-dimensions-dialog .el-message-box__content,
.el-message-box.sandbox-dimensions-dialog .el-message-box__message,
.el-message-box.sandbox-dimensions-dialog .el-message-box__btns {
    background: #1a1a1a !important;
}

/* 更具体的Element Plus样式覆盖 */
.el-overlay .sandbox-dimensions-dialog,
.el-overlay .sandbox-dimensions-dialog .el-message-box,
.sandbox-dimensions-dialog,
.sandbox-dimensions-dialog .el-message-box {
    background: #1a1a1a !important;
    border: 1px solid #444 !important;
    border-radius: 16px !important;
    max-width: 1000px !important;
    width: auto !important;
    min-width: 800px !important;
    box-sizing: border-box !important;
}

/* 针对所有可能的白色背景元素 */
.sandbox-dimensions-dialog,
.sandbox-dimensions-dialog *,
.el-overlay .sandbox-dimensions-dialog,
.el-overlay .sandbox-dimensions-dialog * {
    box-shadow: none !important;
    background-color: transparent !important;
    background-image: none !important;
    background: transparent !important;
}

/* 恢复必要的背景 */
.sandbox-dimensions-dialog .el-message-box,
.el-overlay .sandbox-dimensions-dialog .el-message-box,
.sandbox-dimensions-dialog .el-message-box__content,
.sandbox-dimensions-dialog .el-message-box__message,
.sandbox-dimensions-dialog .el-message-box__btns {
    background: #1a1a1a !important;
    background-color: #1a1a1a !important;
}

/* 模型设置开关样式优化 */
:deep(.el-switch) {
    .el-switch__core {
        background-color: rgba(255, 255, 255, 0.2) !important;
        border: 1px solid rgba(0, 240, 255, 0.3) !important;
        
        &::after {
            background: var(--text-secondary) !important;
        }
    }
    
    &.is-checked .el-switch__core {
        background-color: var(--primary) !important;
        border-color: var(--primary) !important;
        
        &::after {
            background: var(--dark-bg) !important;
        }
    }
}

/* 模型设置按钮样式 */
.el-form-item__content .el-button--primary {
    background: linear-gradient(135deg, var(--primary), var(--primary-dark)) !important;
    border: 1px solid var(--primary) !important;
    color: var(--dark-bg) !important;
    font-weight: 500 !important;
    border-radius: 8px !important;
    padding: 8px 16px !important;
    transition: all 0.3s ease !important;
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.2) !important;
    
    &:hover {
        background: linear-gradient(135deg, var(--primary-light), var(--primary)) !important;
        box-shadow: 0 0 15px rgba(0, 240, 255, 0.4) !important;
        transform: translateY(-2px) !important;
    }
    
    &:active {
        transform: translateY(0px) !important;
    }
}

/* 最高优先级的宽度强制覆盖 */
.sandbox-dimensions-dialog.el-message-box {
    max-width: 1000px !important;
    width: auto !important;
    min-width: 800px !important;
    box-sizing: border-box !important;
    margin: 0 auto !important;
}

/* 针对Element Plus可能的容器限制 */
body .el-message-box.sandbox-dimensions-dialog,
html .el-message-box.sandbox-dimensions-dialog {
    max-width: 1000px !important;
    width: auto !important;
    min-width: 800px !important;
    box-sizing: border-box !important;
    margin: 0 auto !important;
}

/* 自定义沙盘尺寸弹窗样式 */
:deep(.sandbox-dimensions-custom-dialog) {
    .el-dialog {
        background: #1a1a1a;
        border: 1px solid #444;
        border-radius: 16px;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 212, 255, 0.1);
    }
    
    .el-dialog__header {
        background: #1a1a1a;
        border-bottom: 1px solid #333;
        border-radius: 16px 16px 0 0;
        padding: 20px;
    }
    
    .el-dialog__title {
        color: #ffffff;
        font-weight: 600;
        font-size: 18px;
    }
    
    .el-dialog__body {
        background: #1a1a1a;
        padding: 0;
        max-height: 70vh;
        overflow-y: auto;
    }
    
    .el-dialog__footer {
        background: #1a1a1a;
        border-top: 1px solid #333;
        border-radius: 0 0 16px 16px;
        padding: 16px 20px 20px 20px;
    }
    
    /* 强制设置信息卡片边框 - 更明显的边框 */
    .info-card.axes-card {
        border: 1px solid rgba(0, 212, 255, 0.5) !important;
        border-left: 4px solid #00d4ff !important;
    }
    
    .info-card.size-card {
        border: 1px solid rgba(76, 175, 80, 0.5) !important;
        border-left: 4px solid #4CAF50 !important;
    }
    
    .info-card.center-card {
        border: 1px solid rgba(255, 152, 0, 0.5) !important;
        border-left: 4px solid #FF9800 !important;
    }
    
    .info-card.bounds-card {
        border: 1px solid rgba(156, 39, 176, 0.5) !important;
        border-left: 4px solid #9C27B0 !important;
    }
    
    .info-card.original-card {
        border: 1px solid rgba(244, 67, 54, 0.5) !important;
        border-left: 4px solid #F44336 !important;
    }
}

/* 沙盘内容样式 */
.sandbox-content {
    padding: 20px;
    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #e8e8e8;
}

.title-section {
    text-align: center;
    margin-bottom: 20px;
}

.title-section h2 {
    color: #ffffff;
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.5px;
}

.title-line {
    width: 60px;
    height: 3px;
    background: linear-gradient(90deg, #00d4ff, #0099cc);
    margin: 8px auto;
    border-radius: 2px;
}

.grid-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 16px;
}

/* 响应式布局 - 小屏幕时改为单列 */
@media (max-width: 900px) {
    :deep(.sandbox-dimensions-custom-dialog) {
        .el-dialog {
            width: 95% !important;
            margin: 10px !important;
        }
    }
    
    .grid-layout {
        grid-template-columns: 1fr;
        gap: 16px;
    }
    
    .original-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
    }
    
    .sandbox-content {
        padding: 16px;
    }
}

@media (max-width: 480px) {
    :deep(.sandbox-dimensions-custom-dialog) {
        .el-dialog {
            width: 98% !important;
            margin: 5px !important;
        }
    }
    
    .original-grid {
        grid-template-columns: 1fr;
        gap: 12px;
    }
    
    .sandbox-content {
        padding: 12px;
    }
}

.info-card {
    background: linear-gradient(135deg, #2a2a2a 0%, #333 100%);
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.info-card.axes-card {
    border: 1px solid rgba(0, 212, 255, 0.5) !important;
    border-left: 4px solid #00d4ff !important;
}

.info-card.size-card {
    border: 1px solid rgba(76, 175, 80, 0.5) !important;
    border-left: 4px solid #4CAF50 !important;
}

.info-card.center-card {
    border: 1px solid rgba(255, 152, 0, 0.5) !important;
    border-left: 4px solid #FF9800 !important;
}

.info-card.bounds-card {
    border: 1px solid rgba(156, 39, 176, 0.5) !important;
    border-left: 4px solid #9C27B0 !important;
}

.info-card.original-card {
    border: 1px solid rgba(244, 67, 54, 0.5) !important;
    border-left: 4px solid #F44336 !important;
}

.full-width {
    grid-column: 1 / -1;
}

.info-card h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 500;
}

.axes-card h3 { color: #00d4ff; }
.size-card h3 { color: #4CAF50; }
.center-card h3 { color: #FF9800; }
.bounds-card h3 { color: #9C27B0; }
.original-card h3 { color: #F44336; }

.info-content {
    color: #c8c8c8;
    font-size: 14px;
    line-height: 1.8;
}

.data-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
}

.data-row .value {
    color: #ffffff;
    font-weight: 500;
}

.original-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 30px;
}

.usage-section {
    text-align: center;
    margin-bottom: 12px;
}

.usage-card {
    background: linear-gradient(135deg, #0d4f3c 0%, #1a5f4a 100%);
    padding: 20px;
    border-radius: 8px;
    border: 1px solid rgba(76, 175, 80, 0.4);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    display: inline-block;
    max-width: 600px;
}

.usage-card h3 {
    color: #4CAF50;
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 500;
}

.usage-content {
    color: #c8f2dc;
    font-size: 13px;
    line-height: 1.7;
    text-align: left;
}

.usage-content div {
    margin-bottom: 4px;
}

.custom-dialog-footer {
    display: flex;
    justify-content: flex-end;
}

.custom-dialog-footer .el-button--primary {
    background: linear-gradient(135deg, #00d4ff, #0099cc);
    border: none;
    color: #1a1a1a;
    font-weight: 600;
    border-radius: 8px;
    padding: 12px 24px;
    font-size: 14px;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3);
}

.custom-dialog-footer .el-button--primary:hover {
    background: linear-gradient(135deg, #33ddff, #00aadd);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 212, 255, 0.4);
}

.custom-dialog-footer .el-button--primary:active {
    transform: translateY(0px);
}
</style>

<style>
/* 全局：提升“日志级别”下拉弹层层级，确保不被遮罩/对话框覆盖 */
.settings-select-popper {
    z-index: 100010 !important; /* 高于手动设置的 overlay(99998) 与 dialog(99999) */
}
</style>