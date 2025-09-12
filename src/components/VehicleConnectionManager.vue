<template>
    <div class="vehicle-connection-manager">
        <!-- 工具栏 -->
        <div class="toolbar">
            <div class="toolbar-left">
                <h4 class="section-title">
                    <fa icon="network-wired" />
                    车辆连接配置
                </h4>
                <span class="connection-count">共 {{ vehicleConnections.length }} 辆车</span>
            </div>
            <div class="toolbar-right">
                <el-button 
                    type="primary" 
                    @click="showAddDialog" 
                    size="small"
                    class="add-btn"
                >
                    <fa icon="plus" />
                    新增车辆
                </el-button>
                <el-button 
                    @click="refreshConnections" 
                    size="small"
                    :loading="loading"
                    class="refresh-btn"
                >
                    <fa icon="sync-alt" />
                    刷新
                </el-button>
            </div>
        </div>

        <!-- 车辆连接列表 -->
        <div class="connection-list" v-loading="loading">
            <div 
                v-for="connection in vehicleConnections" 
                :key="connection.id"
                class="connection-item"
                :class="{ disabled: !connection.is_active }"
            >
                <div class="connection-header">
                    <div class="connection-info">
                        <div class="vehicle-name">
                            <fa :icon="connection.is_active ? 'car' : 'car-crash'" />
                            {{ connection.name }}
                        </div>
                        <div class="vehicle-id">ID: {{ connection.vehicle_id }}</div>
                    </div>
                    <div class="connection-status">
                        <el-switch 
                            v-model="connection.is_active" 
                            @change="toggleConnectionStatus(connection)"
                            :disabled="updating === connection.id"
                        />
                    </div>
                </div>
                
                <div class="connection-details">
                    <div class="detail-item">
                        <span class="detail-label">IP地址:</span>
                        <span class="detail-value">{{ connection.ip_address }}</span>
                    </div>
                    <div class="detail-item" v-if="connection.description">
                        <span class="detail-label">描述:</span>
                        <span class="detail-value">{{ connection.description }}</span>
                    </div>
                </div>
                
                <div class="connection-actions">
                    <el-button 
                        size="small" 
                        @click="editConnection(connection)"
                        :disabled="updating === connection.id"
                        class="edit-btn"
                    >
                        <fa icon="edit" />
                        编辑
                    </el-button>
                    <el-button 
                        size="small" 
                        type="danger" 
                        @click="deleteConnection(connection)"
                        :disabled="updating === connection.id"
                        class="delete-btn"
                    >
                        <fa icon="trash" />
                        删除
                    </el-button>
                </div>
            </div>
            
            <!-- 空状态 -->
            <div v-if="vehicleConnections.length === 0 && !loading" class="empty-state">
                <fa icon="car-side" class="empty-icon" />
                <p>暂无车辆连接配置</p>
                <el-button type="primary" @click="showAddDialog">
                    <fa icon="plus" />
                    添加第一辆车
                </el-button>
            </div>
        </div>

        <!-- 添加/编辑对话框 -->
        <el-dialog
            v-model="dialogVisible"
            :title="editingConnection ? '编辑车辆连接' : '添加车辆连接'"
            width="500px"
            :close-on-click-modal="false"
        >
            <el-form 
                ref="formRef"
                :model="formData" 
                :rules="formRules" 
                label-width="100px"
                class="connection-form"
            >
                <el-form-item label="车辆编号" prop="vehicle_id">
                    <el-input-number 
                        v-model="formData.vehicle_id" 
                        :min="1" 
                        :max="999"
                        placeholder="1"
                        controls-position="right"
                        style="width: 100%"
                        :disabled="!!editingConnection"
                    />
                </el-form-item>
                <el-form-item label="车辆名称" prop="name">
                    <el-input v-model="formData.name" placeholder="1号车" />
                </el-form-item>
                <el-form-item label="IP地址" prop="ip_address">
                    <el-input v-model="formData.ip_address" placeholder="如: 192.168.1.100" />
                </el-form-item>
                <el-form-item label="描述" prop="description">
                    <el-input 
                        v-model="formData.description" 
                        type="textarea" 
                        :rows="2"
                        placeholder="车辆描述信息（可选）"
                    />
                </el-form-item>
            </el-form>
            
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="dialogVisible = false">取消</el-button>
                    <el-button 
                        type="primary" 
                        @click="submitForm"
                        :loading="submitting"
                    >
                        {{ editingConnection ? '保存' : '添加' }}
                    </el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import VehicleConnectionAPI from '@/utils/vehicleAPI.js';

// 响应式数据
const loading = ref(false);
const updating = ref(null);
const submitting = ref(false);
const vehicleConnections = ref([]);
const dialogVisible = ref(false);
const editingConnection = ref(null);
const formRef = ref();

// 表单数据
const formData = ref({
    vehicle_id: 1,
    name: '',
    ip_address: '',
    description: ''
});

// 表单验证规则
const formRules = {
    vehicle_id: [
        { required: true, message: '请输入车辆编号', trigger: 'blur' },
        { type: 'number', min: 1, max: 999, message: '车辆编号必须在1-999之间', trigger: 'blur' }
    ],
    name: [
        { required: true, message: '请输入车辆名称', trigger: 'blur' }
    ],
    ip_address: [
        { required: true, message: '请输入IP地址', trigger: 'blur' },
        { 
            pattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 
            message: '请输入有效的IP地址', 
            trigger: 'blur' 
        }
    ]
};

// 获取车辆连接列表
const loadVehicleConnections = async () => {
    loading.value = true;
    const result = await VehicleConnectionAPI.getAllConnections();
    
    if (result.success) {
        vehicleConnections.value = result.data;
    } else {
        ElMessage.error(`获取车辆连接列表失败: ${result.error}`);
    }
    
    loading.value = false;
};

// 刷新连接列表
const refreshConnections = () => {
    loadVehicleConnections();
};

// 显示添加对话框
const showAddDialog = () => {
    editingConnection.value = null;
    formData.value = {
        vehicle_id: 1,
        name: '',
        ip_address: '',
        description: ''
    };
    dialogVisible.value = true;
};

// 编辑连接
const editConnection = (connection) => {
    editingConnection.value = connection;
    formData.value = {
        vehicle_id: connection.vehicle_id,
        name: connection.name,
        ip_address: connection.ip_address,
        description: connection.description || ''
    };
    dialogVisible.value = true;
};

// 提交表单
const submitForm = async () => {
    if (!formRef.value) return;
    
    const valid = await formRef.value.validate().catch(() => false);
    if (!valid) return;
    
    submitting.value = true;
    let result;
    
    if (editingConnection.value) {
        // 更新
        const updateData = {
            vehicle_id: formData.value.vehicle_id !== editingConnection.value.vehicle_id ? formData.value.vehicle_id : null,
            name: formData.value.name !== editingConnection.value.name ? formData.value.name : null,
            ip_address: formData.value.ip_address !== editingConnection.value.ip_address ? formData.value.ip_address : null,
            description: formData.value.description !== editingConnection.value.description ? formData.value.description : null
        };
        result = await VehicleConnectionAPI.updateConnection(editingConnection.value.id, updateData);
    } else {
        // 创建
        const createData = {
            vehicle_id: formData.value.vehicle_id,
            name: formData.value.name,
            ip_address: formData.value.ip_address,
            description: formData.value.description || null
        };
        result = await VehicleConnectionAPI.createConnection(createData);
    }
    
    if (result.success) {
        ElMessage.success(editingConnection.value ? '车辆连接更新成功！' : '车辆连接添加成功！');
        dialogVisible.value = false;
        await loadVehicleConnections();
    } else {
        ElMessage.error(`操作失败: ${result.error}`);
    }
    
    submitting.value = false;
};

// 切换连接状态
const toggleConnectionStatus = async (connection) => {
    updating.value = connection.id;
    
    const result = await VehicleConnectionAPI.updateConnection(connection.id, {
        is_active: connection.is_active
    });
    
    if (result.success) {
        ElMessage.success(`车辆 ${connection.name} ${connection.is_active ? '已启用' : '已禁用'}`);
    } else {
        // 恢复状态
        connection.is_active = !connection.is_active;
        ElMessage.error(`更新状态失败: ${result.error}`);
    }
    
    updating.value = null;
};

// 删除连接
const deleteConnection = async (connection) => {
    try {
        await ElMessageBox.confirm(
            `确定要删除车辆 "${connection.name}" 的连接配置吗？此操作不可撤销。`,
            '确认删除',
            {
                confirmButtonText: '删除',
                cancelButtonText: '取消',
                type: 'warning',
                confirmButtonClass: 'el-button--danger'
            }
        );
        
        updating.value = connection.id;
        
        const result = await VehicleConnectionAPI.deleteConnection(connection.id);
        
        if (result.success) {
            ElMessage.success('车辆连接删除成功！');
            await loadVehicleConnections();
        } else {
            ElMessage.error(`删除失败: ${result.error}`);
        }
        
    } catch (error) {
        if (error !== 'cancel') {
            console.error('❌ 删除连接失败:', error);
            ElMessage.error(`删除失败: ${error}`);
        }
    } finally {
        updating.value = null;
    }
};

// 组件挂载时加载数据
onMounted(() => {
    loadVehicleConnections();
});
</script>

<style lang="scss" scoped>
.vehicle-connection-manager {
    padding: 0;
}

.toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 15px 20px;
    background: rgba(0, 15, 30, 0.5);
    border-radius: 8px;
    border: 1px solid rgba(0, 240, 255, 0.2);
}

.toolbar-left {
    display: flex;
    align-items: center;
    gap: 15px;
}

.section-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--primary);
    display: flex;
    align-items: center;
    gap: 8px;
}

.connection-count {
    font-size: 12px;
    color: var(--text-secondary);
    background: rgba(0, 240, 255, 0.1);
    padding: 4px 12px;
    border-radius: 20px;
    border: 1px solid rgba(0, 240, 255, 0.2);
}

.toolbar-right {
    display: flex;
    gap: 10px;
}

.add-btn, .refresh-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    padding: 6px 12px;
    border-radius: 6px;
}

.connection-list {
    max-height: 400px;
    overflow-y: auto;
    padding-right: 5px;
}

.connection-item {
    background: rgba(0, 15, 30, 0.3);
    border: 1px solid rgba(0, 240, 255, 0.4);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    transition: all 0.3s ease;
    
    &:hover {
        border-color: rgba(0, 240, 255, 0.6);
        background: rgba(0, 20, 40, 0.4);
    }
    
    &.disabled {
        opacity: 0.6;
        background: rgba(60, 60, 60, 0.2);
        border-color: rgba(128, 128, 128, 0.5);
    }
}

.connection-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
}

.connection-info {
    flex: 1;
}

.vehicle-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.vehicle-id {
    font-size: 12px;
    color: var(--text-secondary);
    font-family: 'Courier New', monospace;
}

.connection-status {
    margin-left: 15px;
}

.connection-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
    margin-bottom: 15px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.detail-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.detail-label {
    font-size: 12px;
    color: var(--text-secondary);
    min-width: 50px;
}

.detail-value {
    font-size: 12px;
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
    background: rgba(0, 240, 255, 0.05);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid rgba(0, 240, 255, 0.1);
}

.connection-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.edit-btn, .delete-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    padding: 6px 12px;
    border-radius: 4px;
}

.empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
}

.empty-icon {
    font-size: 48px;
    margin-bottom: 20px;
    opacity: 0.3;
}

.connection-form {
    .el-form-item {
        margin-bottom: 18px;
    }
}

/* 滚动条样式 */
.connection-list::-webkit-scrollbar {
    width: 6px;
}

.connection-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
}

.connection-list::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, 
        var(--primary), 
        var(--primary-dark)
    );
    border-radius: 3px;
    box-shadow: 0 0 5px rgba(0, 240, 255, 0.3);
}

.connection-list::-webkit-scrollbar-thumb:hover {
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
}

/* 对话框样式覆盖 */
:deep(.el-dialog) {
    background: rgba(15, 30, 47, 0.95) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid rgba(0, 240, 255, 0.3) !important;
    border-radius: 12px !important;
}

:deep(.el-dialog__header) {
    background: transparent !important;
    border-bottom: 1px solid rgba(0, 240, 255, 0.2) !important;
    padding: 20px 24px !important;
}

:deep(.el-dialog__title) {
    color: var(--text-primary) !important;
    font-family: 'Orbitron', sans-serif !important;
    font-weight: 600 !important;
}

:deep(.el-dialog__body) {
    padding: 20px 24px !important;
    background: transparent !important;
}

:deep(.el-dialog__footer) {
    background: transparent !important;
    border-top: 1px solid rgba(0, 240, 255, 0.2) !important;
    padding: 15px 24px !important;
}

/* 表单控件样式 */
:deep(.el-input__wrapper) {
    background: rgba(0, 15, 30, 0.8) !important;
    border: 1px solid rgba(0, 240, 255, 0.3) !important;
    border-radius: 6px !important;
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

:deep(.el-textarea__inner) {
    background: rgba(0, 15, 30, 0.8) !important;
    border: 1px solid rgba(0, 240, 255, 0.3) !important;
    border-radius: 6px !important;
    color: var(--text-primary) !important;
}

:deep(.el-textarea__inner:hover) {
    border-color: var(--primary) !important;
}

:deep(.el-textarea__inner:focus) {
    border-color: var(--primary) !important;
    box-shadow: 0 0 0 2px rgba(0, 240, 255, 0.2) !important;
}

:deep(.el-input-number) {
    width: 100%;
}

:deep(.el-switch.is-checked .el-switch__core) {
    background-color: var(--primary) !important;
}
</style>
