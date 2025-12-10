<template>
    <div class="form-group">
        <label class="form-label"><fa icon="gamepad" /> 车辆控制</label>

        <div class="control-buttons">
            <button class="btn control-btn start-btn" @click="startCar()">
                <fa icon="play" /> 启动车辆
            </button>
            <button class="btn control-btn stop-btn" @click="stopCar()">
                <fa icon="stop" /> 停止车辆
            </button>

            <button class="btn control-btn btn-secondary" @click="initPose()">
                <fa icon="refresh" /> 初始化位姿
            </button>
            <button
                class="btn control-btn emergency-btn"
                @click="emergencyBrake()"
            >
                <fa icon="exclamation-triangle" /> 紧急制动
            </button>
        </div>
    </div>

    <!-- 位姿确认对话框 -->
    <el-dialog
        v-model="showPoseDialog"
        title=""
        width="500px"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="false"
        center
        class="pose-confirmation-dialog"
    >
        <div class="pose-dialog-content">
            <!-- 图标和标题 -->
            <div class="dialog-header">
                <div class="icon-container">
                    <fa icon="crosshairs" class="location-icon" />
                </div>
                <h2 class="dialog-title">确认初始化位姿</h2>
                <p class="dialog-subtitle">请确认车辆的初始位置和朝向</p>
            </div>

            <!-- 位置信息卡片 -->
            <div class="position-card" v-if="selectedPoseData">
                <div class="card-header">
                    <fa icon="map-marker-alt" class="card-icon" />
                    <span class="card-title">选择的位置信息</span>
                </div>
                
                <div class="position-details">
                    <div class="detail-row">
                        <span class="detail-label">X 坐标</span>
                        <span class="detail-value">{{ selectedPoseData.x.toFixed(3) }} m</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Y 坐标</span>
                        <span class="detail-value">{{ selectedPoseData.z.toFixed(3) }} m</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">朝向角度</span>
                        <span class="detail-value">{{ selectedPoseData.orientation.toFixed(2) }} rad ({{ (selectedPoseData.orientation * 180 / Math.PI).toFixed(1) }}°)</span>
                    </div>
                </div>

                <div class="vehicle-info">
                    <fa icon="car" class="vehicle-icon" />
                    <span>车辆 {{ selectedVehicleId }} 将被初始化到此位置</span>
                </div>
            </div>

            <!-- 操作按钮 -->
            <div class="dialog-actions">
                <el-button 
                    class="action-btn cancel-btn" 
                    @click="cancelPoseSelection"
                >
                    <fa icon="times" />
                    取消
                </el-button>
                <el-button 
                    class="action-btn reselect-btn" 
                    @click="reselectPose"
                >
                    <fa icon="redo" />
                    重新选择
                </el-button>
                <el-button 
                    class="action-btn confirm-btn" 
                    type="primary"
                    @click="confirmPoseInitialization"
                >
                    <fa icon="check" />
                    确定初始化
                </el-button>
            </div>
        </div>
    </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElDialog, ElButton } from 'element-plus';
import { socketManager } from '@/utils/socketManager.js';
import { useCarStore } from '@/stores/car.js';
import { startPoseSelectionMode, stopPoseSelectionMode } from '@/components/Scene3D/index.js';
import { modelToVehicleCoordinates, applyOffsetToSend } from '@/utils/coordinateTransform.js';
import Toast from '@/utils/toast.js';

const carStore = useCarStore();

// 当前选中的车辆ID
const currentCarId = computed(() => carStore.selectedCarId);

// 位姿确认对话框状态
const showPoseDialog = ref(false);
const selectedPoseData = ref(null);  // 用于显示（车辆坐标系）
const selectedPoseModelData = ref(null);  // 用于发送（模型坐标系）
const selectedVehicleId = ref(null);

// 显示成功或失败消息，持续时间3秒
const showMsg = (isSuccess, message) => {
    if (isSuccess) {
        Toast.success(message || '操作成功');
    } else {
        Toast.error(message || '操作失败');
    }
};

// 检查车辆是否在线 - 统一的在线检查逻辑
const checkVehicleOnline = (vehicleId) => {
    const isOnline = socketManager.isVehicleConnected(vehicleId);
    if (!isOnline) {
        Toast.warning('当前车辆离线');
    }
    return isOnline;
};

const startCar = async () => {
    const vehicleId = currentCarId.value;
    if (!vehicleId) {
        showMsg(false, '请先选择车辆');
        return;
    }

    if (!checkVehicleOnline(vehicleId)) {
        return;
    }

    try {
        console.debug(`🚗 开始发送启动指令给车辆${vehicleId}`);
        const result = await socketManager.startVehicle(vehicleId);
        console.debug(`✅ 启动指令发送结果:`, result);
        showMsg(true, `车辆${vehicleId}启动指令发送成功`);
    } catch (error) {
        console.error('启动车辆失败:', error);
        showMsg(false, '启动车辆失败: ' + error.message);
    }
};

const stopCar = async () => {
    const vehicleId = currentCarId.value;
    if (!vehicleId) {
        showMsg(false, '请先选择车辆');
        return;
    }

    if (!checkVehicleOnline(vehicleId)) {
        return;
    }

    try {
        await socketManager.stopVehicle(vehicleId);
        showMsg(true, `车辆${vehicleId}停止指令发送成功`);
    } catch (error) {
        console.error('停止车辆失败:', error);
        showMsg(false, '停止车辆失败: ' + error.message);
    }
};


const initPose = async () => {
    const vehicleId = currentCarId.value;
    if (!vehicleId) {
        showMsg(false, '请先选择车辆');
        return;
    }

    if (!checkVehicleOnline(vehicleId)) {
        return;
    }

    // 启动位姿选择模式
    const success = startPoseSelectionMode((selectedPose) => {
        showPoseConfirmDialog(vehicleId, selectedPose);
    });
    
    if (!success) {
        showMsg(false, '无法启动位姿选择模式，请确认3D场景已加载');
        return;
    }
    
    showMsg(true, '请在沙盘地图上点击并拖拽选择车辆位置和朝向');
};

// 显示位姿确认对话框
const showPoseConfirmDialog = (vehicleId, pose) => {
    // 停止位姿选择模式
    stopPoseSelectionMode();
    
    // 保存模型坐标（用于发送协议）
    selectedPoseModelData.value = {
        x: pose.x,
        z: pose.z,
        orientation: pose.orientation  // 弧度
    };
    
    // 转换为车辆坐标系用于显示
    const vehicleCoords = modelToVehicleCoordinates(pose.x, pose.z);
    selectedPoseData.value = {
        x: vehicleCoords.x,  // 车辆坐标系 X (0-6.0m)
        z: vehicleCoords.y,  // 车辆坐标系 Y (0-5.0m)，显示为Z
        orientation: pose.orientation  // 弧度 (-π 到 π)
    };
    
    console.log('🎯 位姿选择结果:');
    console.log('  模型坐标:', pose.x.toFixed(3), pose.z.toFixed(3));
    console.log('  车辆坐标:', vehicleCoords.x.toFixed(3), vehicleCoords.y.toFixed(3));
    console.log('  朝向角度:', pose.orientation.toFixed(3), 'rad');
    
    selectedVehicleId.value = vehicleId;
    showPoseDialog.value = true;
};

// 确认位姿初始化
const confirmPoseInitialization = () => {
    // 使用模型坐标发送给车辆（需要转换为车辆坐标系）
    const modelPose = selectedPoseModelData.value;
    const vehicleId = selectedVehicleId.value;
    
    // 转换为车辆坐标系
    const vehicleCoords = modelToVehicleCoordinates(modelPose.x, modelPose.z);
    
    // 应用偏移量（发送坐标减偏移量）
    const finalCoords = applyOffsetToSend(vehicleCoords.x, vehicleCoords.y);
    
    executePoseInitialization(vehicleId, finalCoords.x, finalCoords.y, modelPose.orientation);
    showPoseDialog.value = false;
};

// 重新选择位姿
const reselectPose = () => {
    showPoseDialog.value = false;
    const vehicleId = selectedVehicleId.value;
    
    // 延迟重新启动选择模式，避免立即触发
    setTimeout(() => {
        const success = startPoseSelectionMode((newPose) => {
            showPoseConfirmDialog(vehicleId, newPose);
        });
        if (success) {
            showMsg(true, '请重新在沙盘地图上选择位置和朝向');
        }
    }, 100);
};

// 取消位姿选择
const cancelPoseSelection = () => {
    showPoseDialog.value = false;
    selectedPoseData.value = null;
    selectedPoseModelData.value = null;
    selectedVehicleId.value = null;
};

// 执行位姿初始化
const executePoseInitialization = async (vehicleId, x, y, orientation) => {
    try {
        // x, y 已经是车辆坐标系 (0-6.0m, 0-5.0m)
        // orientation 是弧度 (-π 到 π)
        console.log(`📤 发送初始化位姿 - 车辆${vehicleId}: X=${x.toFixed(3)}m, Y=${y.toFixed(3)}m, 朝向=${orientation.toFixed(3)}rad`);
        await socketManager.initializePose(vehicleId, x, y, orientation);
        showMsg(true, `车辆${vehicleId}位姿初始化指令发送成功`);
    } catch (error) {
        console.error('初始化位姿失败:', error);
        showMsg(false, '初始化位姿失败: ' + error.message);
    }
};

const emergencyBrake = async () => {
    const vehicleId = currentCarId.value;
    if (!vehicleId) {
        showMsg(false, '请先选择车辆');
        return;
    }

    if (!checkVehicleOnline(vehicleId)) {
        return;
    }

    try {
        await socketManager.emergencyBrake(vehicleId);
        showMsg(true, `车辆${vehicleId}紧急制动指令发送成功`);
    } catch (error) {
        console.error('紧急制动失败:', error);
        showMsg(false, '紧急制动失败: ' + error.message);
    }
};

onMounted(() => {
    // 组件挂载时可以检查Socket连接状态
    console.debug('CarButton组件已挂载，当前车辆ID:', currentCarId.value);
});
</script>

<style lang="scss" scoped>
/* 标题字号调整 */
.form-label {
    font-size: 13px !important;
}

.control-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.control-btn {
    width: auto;
    flex: 1;
    padding: 8px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    transition: all 0.3s ease;
    min-height: 32px;
}

.start-btn {
    background: linear-gradient(90deg, #00d2ff, #00f0ff);
    color: #002b4d;
    border: 1px solid rgba(0, 240, 255, 0.3);
}

.stop-btn {
    background: rgba(255, 77, 77, 0.2);
    color: #ff4d4d;
    border: 1px solid rgba(255, 77, 77, 0.3);
}

.emergency-btn {
    background: rgba(255, 204, 0, 0.2);
    color: #ffcc00;
    border: 1px solid rgba(255, 204, 0, 0.3);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(255, 204, 0, 0.4);
    }

    70% {
        box-shadow: 0 0 0 10px rgba(255, 204, 0, 0);
    }

    100% {
        box-shadow: 0 0 0 0 rgba(255, 204, 0, 0);
    }
}

.control-btn:hover {
    transform: translateY(-3px);
}

.start-btn:hover {
    box-shadow: 0 5px 20px rgba(0, 240, 255, 0.4);
}

.stop-btn:hover {
    box-shadow: 0 5px 20px rgba(255, 77, 77, 0.3);
}

.emergency-btn:hover {
    box-shadow: 0 5px 20px rgba(255, 204, 0, 0.4);
}
</style>

<style>
/* 位姿确认对话框样式 */
:deep(.pose-confirmation-dialog) {
    .el-dialog {
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        border: 1px solid #65d36c;
        border-radius: 16px;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(101, 211, 108, 0.2);
        overflow: hidden;
    }
    
    .el-dialog__header {
        display: none;
    }
    
    .el-dialog__body {
        padding: 0;
        background: transparent;
    }
}

.pose-dialog-content {
    padding: 30px;
    color: #ffffff;
    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.dialog-header {
    text-align: center;
    margin-bottom: 25px;
}

.icon-container {
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #65d36c, #4caf50);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 15px;
    box-shadow: 0 8px 25px rgba(101, 211, 108, 0.3);
}

.location-icon {
    font-size: 24px;
    color: #1a1a1a;
}

.dialog-title {
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 8px 0;
    color: #ffffff;
    letter-spacing: 0.5px;
}

.dialog-subtitle {
    font-size: 14px;
    color: #b0b0b0;
    margin: 0;
    font-weight: 400;
}

.position-card {
    background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
    border: 1px solid rgba(101, 211, 108, 0.3);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 25px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.card-header {
    display: flex;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(101, 211, 108, 0.2);
}

.card-icon {
    font-size: 16px;
    color: #65d36c;
    margin-right: 8px;
}

.card-title {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
}

.position-details {
    margin-bottom: 15px;
}

.detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.detail-row:last-child {
    border-bottom: none;
}

.detail-label {
    font-size: 14px;
    color: #b0b0b0;
    font-weight: 500;
}

.detail-value {
    font-size: 16px;
    color: #65d36c;
    font-weight: 700;
    font-family: 'Courier New', monospace;
}

.vehicle-info {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    background: rgba(101, 211, 108, 0.1);
    border-radius: 8px;
    font-size: 14px;
    color: #ffffff;
}

.vehicle-icon {
    font-size: 16px;
    color: #65d36c;
    margin-right: 8px;
}

.dialog-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
}

.action-btn {
    padding: 12px 20px !important;
    border-radius: 8px !important;
    font-weight: 600 !important;
    font-size: 14px !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    transition: all 0.3s ease !important;
    min-width: 110px !important;
    justify-content: center !important;
}

.cancel-btn {
    background: rgba(255, 77, 77, 0.2) !important;
    border: 1px solid rgba(255, 77, 77, 0.4) !important;
    color: #ff4d4d !important;
}

.cancel-btn:hover {
    background: rgba(255, 77, 77, 0.3) !important;
    border-color: #ff4d4d !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(255, 77, 77, 0.3) !important;
}

.reselect-btn {
    background: rgba(255, 193, 7, 0.2) !important;
    border: 1px solid rgba(255, 193, 7, 0.4) !important;
    color: #ffc107 !important;
}

.reselect-btn:hover {
    background: rgba(255, 193, 7, 0.3) !important;
    border-color: #ffc107 !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(255, 193, 7, 0.3) !important;
}

.confirm-btn {
    background: linear-gradient(135deg, #65d36c, #4caf50) !important;
    border: none !important;
    color: #1a1a1a !important;
}

.confirm-btn:hover {
    background: linear-gradient(135deg, #7de085, #66bb6a) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(101, 211, 108, 0.4) !important;
}

.confirm-btn:active {
    transform: translateY(0px) !important;
}
</style>