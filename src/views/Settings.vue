<template>
    <!-- 显示设置面板 -->
    <div class="floating-settings-panel" id="display-settings-panel">
        <div class="panel-header">
            <div class="panel-icon">
                <fa icon="cog" />
            </div>
            <h2 class="panel-title">功能设置</h2>
        </div>
        <!-- 车辆设置区域已禁用 -->
        <!-- <CarSettings /> -->
        <div class="form-group">
            <label class="form-label"> <fa icon="route"> </fa> 路径设置</label>
            <div class="flex">
                <span>显示所有路径</span>
                <el-switch
                    v-model="showAllPaths"
                    active-color="#13ce66"
                    inactive-color="#ff4949"
                ></el-switch>
            </div>
        </div>

        <div class="form-group">
            <label class="form-label">
                <fa icon="car"> </fa>
                车辆路径
            </label>
            <el-select 
                v-model="selectedCar" 
                placeholder="请选择车辆"
                :loading="loading"
                loading-text="加载车辆列表..."
            >
                <el-option
                    v-for="vehicle in vehicleList"
                    :key="vehicle.id"
                    :label="vehicle.name"
                    :value="vehicle.id"
                ></el-option>
            </el-select>

            <button class="btn btn-secondary" @click="handleViewVehiclePath">
                <fa icon="route" />
                查看车辆路径
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
// import CarSettings from '@/components/CarSettings.vue';  // 车辆设置已禁用
import { VehicleConnectionAPI } from '@/utils/vehicleAPI.js';
import { socketManager } from '@/utils/socketManager.js';
import { ElMessage } from 'element-plus';

const selectedCar = ref('');
const showAllPaths = ref(false);
const vehicleList = ref([]);
const loading = ref(false);
const isRestoringState = ref(false); // 防止递归更新的标志位

// 加载车辆连接数据
const loadVehicleConnections = async () => {
    loading.value = true;
    try {
        const result = await VehicleConnectionAPI.getAllConnections();
        if (result.success) {
            // 转换数据库数据为组件需要的格式
            vehicleList.value = result.data.map(connection => ({
                id: connection.vehicle_id,
                name: connection.name, // 只显示车辆名称
                vehicleId: connection.vehicle_id,
                ipAddress: connection.ip_address,
                port: connection.port,
                description: connection.description,
                isActive: connection.is_active
            }));
            
            // 如果没有选中的车辆，默认选择第一个
            if (!selectedCar.value && vehicleList.value.length > 0) {
                selectedCar.value = vehicleList.value[0].id;
            }
            
            console.log('✅ 路径设置页面加载车辆列表成功:', vehicleList.value);
        } else {
            console.error('❌ 加载车辆列表失败:', result.error);
            vehicleList.value = [];
        }
    } catch (error) {
        console.error('❌ 加载车辆列表异常:', error);
        vehicleList.value = [];
    } finally {
        loading.value = false;
    }
};

// 查看车辆路径事件处理
const handleViewVehiclePath = async () => {
    // 检查是否选择了车辆
    if (!selectedCar.value) {
        ElMessage.warning({
            message: '请先选择车辆',
            duration: 3000
        });
        return;
    }

    // 检查选中的车辆是否在线
    if (!socketManager.isVehicleConnected(selectedCar.value)) {
        ElMessage.warning({
            message: '选中的车辆未在线',
            duration: 3000
        });
        return;
    }

    try {
        // 发送车辆路径显示控制指令（开启路径发送）
        await socketManager.sendVehiclePathDisplay(selectedCar.value, 1);
        
        // 成功提示
        ElMessage.success({
            message: '车辆路径显示指令发送成功',
            duration: 3000
        });
        
    } catch (error) {
        console.error('发送车辆路径显示指令失败:', error);
        ElMessage.error({
            message: '发送车辆路径显示指令失败: ' + error.message,
            duration: 3000
        });
    }
};

// 监听显示所有路径开关变化
watch(showAllPaths, async (newValue, oldValue) => {
    // 如果是程序内部恢复状态的操作，跳过处理
    if (isRestoringState.value) {
        isRestoringState.value = false;
        return;
    }
    
    try {
        // 获取所有在线车辆
        const onlineVehicleIds = socketManager.getOnlineVehicleIds();
        
        // 如果是打开操作（从 false 到 true），检查是否有在线车辆
        if (newValue && onlineVehicleIds.length === 0) {
            ElMessage.warning({
                message: '当前未有车辆在线',
                duration: 3000
            });
            // 恢复开关到关闭状态
            isRestoringState.value = true;
            showAllPaths.value = false;
            return;
        }
        
        // 如果是关闭操作且没有在线车辆，静默跳过
        if (!newValue && onlineVehicleIds.length === 0) {
            console.log('没有在线车辆，跳过批量路径显示指令发送');
            return;
        }
        
        // 批量发送路径显示控制指令给所有在线车辆
        const displayPath = newValue ? 1 : 0;
        await socketManager.sendBatchVehiclePathDisplay(onlineVehicleIds, displayPath);
        
        ElMessage.success({
            message: newValue 
                ? `已开启 ${onlineVehicleIds.length} 辆车的路径显示` 
                : `已关闭 ${onlineVehicleIds.length} 辆车的路径显示`,
            duration: 3000
        });
    } catch (error) {
        console.error('批量发送路径显示指令失败:', error);
        ElMessage.error({
            message: '批量发送路径显示指令失败: ' + error.message,
            duration: 3000
        });
        // 发送失败时恢复开关状态
        isRestoringState.value = true;
        showAllPaths.value = !newValue;
    }
});

// 组件挂载时加载数据
onMounted(() => {
    loadVehicleConnections();
});
</script>

<style lang="scss" scoped>
.floating-settings-panel {
    padding: 25px;
    height: 100%;
    overflow-y: auto;
    position: relative;
}

.panel-header {
    margin-bottom: 20px;
    padding-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 2px solid rgba(0, 240, 255, 0.3);
    position: relative;
}

.panel-icon {
    width: 36px;
    height: 36px;
    font-size: 20px;
    color: var(--dark-bg);
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
}

.panel-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    background: linear-gradient(90deg, var(--primary), var(--primary-light));
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    flex: 1;
}

/* 滚动条样式 */
.floating-settings-panel::-webkit-scrollbar {
    width: 6px;
}

.floating-settings-panel::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
}

.floating-settings-panel::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, 
        var(--primary), 
        var(--primary-dark)
    );
    border-radius: 3px;
    box-shadow: 0 0 5px rgba(0, 240, 255, 0.3);
}

.floating-settings-panel::-webkit-scrollbar-thumb:hover {
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
}
</style>