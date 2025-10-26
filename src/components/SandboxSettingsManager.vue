<template>
    <div class="sandbox-settings-manager">
        <!-- 沙盘服务设置 -->
        <div class="settings-section">
            <div class="section-header">
                <h4 class="section-title">
                    <fa icon="server" />
                    沙盘服务设置
                </h4>
                <div class="section-actions">
                    <el-button 
                        @click="refreshServiceSettings" 
                        size="small"
                        :loading="serviceLoading"
                        class="refresh-btn"
                    >
                        <fa icon="sync-alt" />
                        刷新
                    </el-button>
                </div>
            </div>

            <div v-loading="serviceLoading" class="service-settings-form">
                <el-form ref="serviceFormRef" :model="serviceForm" :rules="serviceRules" label-width="120px">
                    <el-form-item label="服务IP地址" prop="ipAddress">
                        <el-input v-model="serviceForm.ipAddress" placeholder="请输入沙盘服务IP地址" />
                    </el-form-item>
                    <el-form-item label="红绿灯数量" prop="trafficLightCount">
                        <el-input-number 
                            v-model="serviceForm.trafficLightCount" 
                            :min="0"
                            :step="1"
                            :controls="false"
                            placeholder="请输入红绿灯数量"
                            style="width: 100%"
                        />
                    </el-form-item>
                    <el-form-item class="service-actions-item">
                        <div class="service-actions">
                            <el-button 
                                type="primary" 
                                @click="saveServiceSettings"
                                :loading="serviceSaving"
                            >
                                <fa icon="save" />
                                保存设置
                            </el-button>
                            <el-button 
                                v-if="hasServiceSettings"
                                type="danger" 
                                @click="deleteServiceSettings"
                                :loading="serviceDeleting"
                            >
                                <fa icon="trash" />
                                删除设置
                            </el-button>
                        </div>
                    </el-form-item>
                </el-form>
            </div>
        </div>

        <!-- 沙盘摄像头设置 -->
        <div class="settings-section">
            <div class="section-header">
                <h4 class="section-title">
                    <fa icon="video" />
                    沙盘摄像头设置
                </h4>
                <div class="section-actions">
                    <el-button 
                        type="primary" 
                        @click="showAddCameraDialog" 
                        size="small"
                        class="add-btn"
                    >
                        <fa icon="plus" />
                        新增摄像头
                    </el-button>
                    <el-button 
                        @click="refreshCameras" 
                        size="small"
                        :loading="camerasLoading"
                        class="refresh-btn"
                    >
                        <fa icon="sync-alt" />
                        刷新
                    </el-button>
                </div>
            </div>

            <!-- 摄像头列表 -->
            <div class="cameras-list" v-loading="camerasLoading">
                <div 
                    v-for="camera in cameras" 
                    :key="camera.id"
                    class="camera-item"
                >
                    <div class="camera-header">
                        <div class="camera-info">
                            <div class="camera-name">
                                {{ camera.name }}
                            </div>
                            <div class="camera-type">{{ camera.camera_type }}</div>
                        </div>
                        <div class="camera-actions">
                            <el-button 
                                @click="editCamera(camera)" 
                                size="small"
                                type="primary"
                                link
                            >
                                <fa icon="edit" />
                                编辑
                            </el-button>
                            <el-button 
                                @click="deleteCamera(camera)" 
                                size="small"
                                type="danger"
                                link
                            >
                                <fa icon="trash" />
                                删除
                            </el-button>
                        </div>
                    </div>
                    <div class="camera-details">
                        <div v-if="camera.camera_type === 'RJ45'" class="camera-detail">
                            <span class="detail-label">RTSP地址:</span>
                            <span class="detail-value">{{ camera.rtsp_url }}</span>
                        </div>
                        <div v-if="camera.camera_type === 'USB'" class="camera-detail">
                            <span class="detail-label">设备索引:</span>
                            <span class="detail-value">{{ camera.device_index }}</span>
                        </div>
                        <div class="camera-detail">
                            <span class="detail-label">创建时间:</span>
                            <span class="detail-value">{{ formatDateTime(camera.created_at) }}</span>
                        </div>
                    </div>
                </div>

                <div v-if="cameras.length === 0" class="empty-state">
                    <fa icon="video-slash" class="empty-icon" />
                    <p>暂无摄像头配置</p>
                </div>
            </div>
        </div>

        <!-- 摄像头添加/编辑对话框 -->
        <el-dialog
            v-model="cameraDialogVisible"
            :title="isEditingCamera ? '编辑摄像头' : '新增摄像头'"
            width="500px"
            @close="resetCameraForm"
        >
            <el-form ref="cameraFormRef" :model="cameraForm" :rules="cameraRules" label-width="120px">
                <el-form-item label="摄像头名称" prop="name">
                    <el-input v-model="cameraForm.name" placeholder="请输入摄像头名称" />
                </el-form-item>
                <el-form-item label="摄像头类型" prop="cameraType">
                    <el-radio-group v-model="cameraForm.cameraType" @change="onCameraTypeChange">
                        <el-radio value="RJ45">RJ45</el-radio>
                        <el-radio value="USB">USB</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item 
                    v-if="cameraForm.cameraType === 'RJ45'" 
                    label="RTSP地址" 
                    prop="rtspUrl"
                >
                    <el-input 
                        v-model="cameraForm.rtspUrl" 
                        placeholder="请输入RTSP地址 (例: rtsp://192.168.1.100:554/stream)"
                    />
                </el-form-item>
                <el-form-item 
                    v-if="cameraForm.cameraType === 'USB'" 
                    label="设备索引" 
                    prop="deviceIndex"
                >
                    <el-input-number 
                        v-model="cameraForm.deviceIndex" 
                        :min="0" 
                        :controls="false"
                        placeholder="请输入设备文件索引"
                        style="width: 100%"
                    />
                </el-form-item>
            </el-form>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="cameraDialogVisible = false">取消</el-button>
                    <el-button 
                        type="primary" 
                        @click="saveCameraSettings"
                        :loading="cameraSaving"
                    >
                        {{ isEditingCamera ? '更新' : '创建' }}
                    </el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { ElMessageBox } from 'element-plus';
import Toast from '@/utils/toast.js';
import { SandboxAPI } from '@/utils/vehicleAPI.js';

// 服务设置相关
const serviceLoading = ref(false);
const serviceSaving = ref(false);
const serviceDeleting = ref(false);
const hasServiceSettings = ref(false);
const serviceFormRef = ref();

const serviceForm = reactive({
    ipAddress: '',
    trafficLightCount: 0
});

const serviceRules = {
    ipAddress: [
        { required: true, message: '请输入IP地址', trigger: 'blur' },
        { 
            validator: (rule, value, callback) => {
                if (!value) {
                    callback(new Error('请输入IP地址'));
                } else if (!SandboxAPI.validateIPAddress(value)) {
                    callback(new Error('IP地址格式不正确'));
                } else {
                    callback();
                }
            },
            trigger: 'blur' 
        }
    ],
    trafficLightCount: [
        { required: true, message: '请输入红绿灯数量', trigger: 'blur' },
        { 
            validator: (rule, value, callback) => {
                if (value == null || value < 0) {
                    callback(new Error('红绿灯数量必须为非负整数'));
                } else {
                    callback();
                }
            },
            trigger: 'change'
        }
    ]
};

// 摄像头设置相关
const camerasLoading = ref(false);
const cameraSaving = ref(false);
const cameras = ref([]);
const cameraDialogVisible = ref(false);
const isEditingCamera = ref(false);
const editingCameraId = ref(null);
const cameraFormRef = ref();

const cameraForm = reactive({
    name: '',
    cameraType: 'RJ45',
    rtspUrl: '',
    deviceIndex: 0
});

const cameraRules = {
    name: [
        { required: true, message: '请输入摄像头名称', trigger: 'blur' }
    ],
    cameraType: [
        { required: true, message: '请选择摄像头类型', trigger: 'change' }
    ],
    rtspUrl: [
        { 
            required: true, 
            message: '请输入RTSP地址', 
            trigger: 'blur',
            validator: (rule, value, callback) => {
                if (cameraForm.cameraType === 'RJ45') {
                    if (!value) {
                        callback(new Error('请输入RTSP地址'));
                    } else if (!SandboxAPI.validateRTSPUrl(value)) {
                        callback(new Error('RTSP地址格式不正确，必须以rtsp://开头'));
                    } else {
                        callback();
                    }
                } else {
                    callback();
                }
            }
        }
    ],
    deviceIndex: [
        { 
            required: true, 
            message: '请输入设备索引', 
            trigger: 'blur',
            validator: (rule, value, callback) => {
                if (cameraForm.cameraType === 'USB') {
                    if (value == null || value < 0) {
                        callback(new Error('设备索引必须为非负整数'));
                    } else {
                        callback();
                    }
                } else {
                    callback();
                }
            }
        }
    ]
};

// 加载沙盘服务设置
const loadServiceSettings = async () => {
    serviceLoading.value = true;
    try {
        const result = await SandboxAPI.getServiceSettings();
        if (result.success && result.data) {
            serviceForm.ipAddress = result.data.ip_address;
            serviceForm.trafficLightCount = result.data.traffic_light_count ?? 0;
            hasServiceSettings.value = true;
        } else {
            hasServiceSettings.value = false;
            console.debug('📝 暂无沙盘服务设置');
        }
    } catch (error) {
        console.error('❌ 加载沙盘服务设置失败:', error);
        Toast.error(`加载沙盘服务设置失败: ${error}`);
        hasServiceSettings.value = false;
    } finally {
        serviceLoading.value = false;
    }
};

// 保存沙盘服务设置
const saveServiceSettings = async () => {
    if (!serviceFormRef.value) return;
    
    const valid = await serviceFormRef.value.validate().catch(() => false);
    if (!valid) return;
    
    serviceSaving.value = true;
    try {
        const settingsData = {
            ip_address: serviceForm.ipAddress,
            traffic_light_count: serviceForm.trafficLightCount
        };
        
        const result = await SandboxAPI.createOrUpdateServiceSettings(settingsData);
        if (result.success) {
            Toast.success('沙盘服务设置保存成功！');
            hasServiceSettings.value = true;
        } else {
            Toast.error(`保存沙盘服务设置失败: ${result.error}`);
        }
    } catch (error) {
        console.error('❌ 保存沙盘服务设置失败:', error);
        Toast.error(`保存沙盘服务设置失败: ${error}`);
    } finally {
        serviceSaving.value = false;
    }
};

// 删除沙盘服务设置
const deleteServiceSettings = async () => {
    try {
        await ElMessageBox.confirm(
            '确定要删除沙盘服务设置吗？',
            '确认删除',
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning',
            }
        );
        
        serviceDeleting.value = true;
        const result = await SandboxAPI.deleteServiceSettings();
        
        if (result.success) {
            Toast.success('沙盘服务设置删除成功！');
            serviceForm.ipAddress = '';
            serviceForm.port = 8080;
            hasServiceSettings.value = false;
        } else {
            Toast.error(`删除沙盘服务设置失败: ${result.error}`);
        }
    } catch (error) {
        if (error === 'cancel') return;
        console.error('❌ 删除沙盘服务设置失败:', error);
        Toast.error(`删除沙盘服务设置失败: ${error}`);
    } finally {
        serviceDeleting.value = false;
    }
};

// 刷新服务设置
const refreshServiceSettings = () => {
    loadServiceSettings();
};

// 加载摄像头列表
const loadCameras = async () => {
    camerasLoading.value = true;
    try {
        const result = await SandboxAPI.getAllCameras();
        if (result.success) {
            cameras.value = result.data || [];
        } else {
            cameras.value = [];
            if (result.error) {
                Toast.error(`加载摄像头列表失败: ${result.error}`);
            }
        }
    } catch (error) {
        console.error('❌ 加载摄像头列表失败:', error);
        Toast.error(`加载摄像头列表失败: ${error}`);
        cameras.value = [];
    } finally {
        camerasLoading.value = false;
    }
};

// 显示添加摄像头对话框
const showAddCameraDialog = () => {
    isEditingCamera.value = false;
    editingCameraId.value = null;
    resetCameraForm();
    cameraDialogVisible.value = true;
};

// 编辑摄像头
const editCamera = (camera) => {
    isEditingCamera.value = true;
    editingCameraId.value = camera.id;
    cameraForm.name = camera.name;
    cameraForm.cameraType = camera.camera_type;
    cameraForm.rtspUrl = camera.rtsp_url || '';
    cameraForm.deviceIndex = camera.device_index || 0;
    cameraDialogVisible.value = true;
};

// 删除摄像头
const deleteCamera = async (camera) => {
    try {
        await ElMessageBox.confirm(
            `确定要删除摄像头 "${camera.name}" 吗？`,
            '确认删除',
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning',
            }
        );
        
        const result = await SandboxAPI.deleteCamera(camera.id);
        if (result.success) {
            Toast.success('摄像头删除成功！');
            await loadCameras();
        } else {
            Toast.error(`删除摄像头失败: ${result.error}`);
        }
    } catch (error) {
        if (error === 'cancel') return;
        console.error('❌ 删除摄像头失败:', error);
        Toast.error(`删除摄像头失败: ${error}`);
    }
};

// 保存摄像头设置
const saveCameraSettings = async () => {
    if (!cameraFormRef.value) return;
    
    const valid = await cameraFormRef.value.validate().catch(() => false);
    if (!valid) return;
    
    cameraSaving.value = true;
    try {
        const request = {
            name: cameraForm.name,
            camera_type: cameraForm.cameraType,
            rtsp_url: cameraForm.cameraType === 'RJ45' ? cameraForm.rtspUrl : null,
            device_index: cameraForm.cameraType === 'USB' ? cameraForm.deviceIndex : null
        };
        
        let result;
        if (isEditingCamera.value) {
            result = await SandboxAPI.updateCamera(editingCameraId.value, request);
            if (result.success) {
                Toast.success('摄像头更新成功！');
            }
        } else {
            result = await SandboxAPI.createCamera(request);
            if (result.success) {
                Toast.success('摄像头创建成功！');
            }
        }
        
        if (result.success) {
            cameraDialogVisible.value = false;
            await loadCameras();
        } else {
            Toast.error(`保存摄像头设置失败: ${result.error}`);
        }
    } catch (error) {
        console.error('❌ 保存摄像头设置失败:', error);
        Toast.error(`保存摄像头设置失败: ${error}`);
    } finally {
        cameraSaving.value = false;
    }
};

// 重置摄像头表单
const resetCameraForm = () => {
    cameraForm.name = '';
    cameraForm.cameraType = 'RJ45';
    cameraForm.rtspUrl = '';
    cameraForm.deviceIndex = 0;
    if (cameraFormRef.value) {
        cameraFormRef.value.clearValidate();
    }
};

// 摄像头类型变化处理
const onCameraTypeChange = () => {
    // 清除对应字段的验证错误
    if (cameraFormRef.value) {
        if (cameraForm.cameraType === 'RJ45') {
            cameraFormRef.value.clearValidate(['deviceIndex']);
        } else {
            cameraFormRef.value.clearValidate(['rtspUrl']);
        }
    }
};

// 刷新摄像头列表
const refreshCameras = () => {
    loadCameras();
};

// 格式化日期时间（复用现有的格式化方法）
const formatDateTime = (dateTime) => {
    return SandboxAPI.formatCreatedAt(dateTime);
};

// 页面加载时获取数据
onMounted(() => {
    loadServiceSettings();
    loadCameras();
});
</script>

<style lang="scss" scoped>
.sandbox-settings-manager {
    padding: 0;
}

.settings-section {
    margin-bottom: 32px;
    
    &:last-child {
        margin-bottom: 0;
    }
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(0, 240, 255, 0.2);
}

.section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
}

.section-actions {
    display: flex;
    gap: 8px;
}

.add-btn, .refresh-btn {
    display: flex;
    align-items: center;
    gap: 6px;
}

.service-settings-form {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(0, 240, 255, 0.1);
    border-radius: 8px;
    padding: 20px;
}

.service-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    width: 100%;
}

// 按钮所在表单项的特定样式
:deep(.service-actions-item) {
    .el-form-item__content {
        display: flex;
        justify-content: flex-end;
        margin-left: 0 !important;
    }
}

.cameras-list {
    max-height: 400px;
    overflow-y: auto;
}

.camera-item {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(0, 240, 255, 0.1);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    transition: all 0.3s ease;
    
    &:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(0, 240, 255, 0.3);
        box-shadow: 0 2px 8px rgba(0, 240, 255, 0.1);
    }
    
    &:last-child {
        margin-bottom: 0;
    }
}

.camera-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}

.camera-info {
    flex: 1;
}

.camera-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
}

.camera-type {
    font-size: 12px;
    color: var(--text-secondary);
    background: rgba(0, 240, 255, 0.1);
    padding: 2px 8px;
    border-radius: 12px;
    display: inline-block;
}

.camera-actions {
    display: flex;
    gap: 8px;
}

.camera-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.camera-detail {
    display: flex;
    align-items: center;
    font-size: 12px;
}

.detail-label {
    color: var(--text-secondary);
    min-width: 80px;
    margin-right: 8px;
}

.detail-value {
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
    background: rgba(0, 240, 255, 0.05);
    padding: 2px 6px;
    border-radius: 4px;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: var(--text-secondary);
}

.empty-icon {
    font-size: 48px;
    color: rgba(0, 240, 255, 0.3);
    margin-bottom: 16px;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

// Element Plus样式覆盖
:deep(.el-form-item__label) {
    color: var(--text-primary) !important;
}

:deep(.el-input__wrapper) {
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(0, 240, 255, 0.2);
}

:deep(.el-input__wrapper:hover) {
    border-color: rgba(0, 240, 255, 0.4);
}

:deep(.el-input__wrapper.is-focus) {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(0, 240, 255, 0.2);
}

:deep(.el-radio) {
    color: var(--text-primary);
}

:deep(.el-radio__input.is-checked .el-radio__inner) {
    background-color: var(--primary);
    border-color: var(--primary);
}

:deep(.el-button) {
    display: flex;
    align-items: center;
    gap: 6px;
}

// 滚动条样式
.cameras-list::-webkit-scrollbar {
    width: 6px;
}

.cameras-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
}

.cameras-list::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, 
        var(--primary), 
        var(--primary-dark)
    );
    border-radius: 3px;
    box-shadow: 0 0 5px rgba(0, 240, 255, 0.3);
}

.cameras-list::-webkit-scrollbar-thumb:hover {
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
}
</style>
