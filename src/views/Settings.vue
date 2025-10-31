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
                {{ pathButtonText }}
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, onBeforeUnmount } from 'vue';
import { VehicleConnectionAPI } from '@/utils/vehicleAPI.js';
import { socketManager } from '@/utils/socketManager.js';
import Toast from '@/utils/toast.js';
import eventBus, { EVENTS } from '@/utils/eventBus.js';
import { pathEnabledVehicles, enablePath, disablePath, enablePaths, clearAllPaths } from '@/utils/pathManager.js';

const selectedCar = ref('');
const showAllPaths = ref(false);
const vehicleList = ref([]);
const loading = ref(false);
const isRestoringState = ref(false); // 防止递归更新的标志位

// 使用全局的 pathEnabledVehicles (从 pathManager.js)

// 计算按钮文字：根据选中车辆是否在 map 中
const pathButtonText = computed(() => {
    if (!selectedCar.value) {
        return '查看车辆路径';
    }
    return pathEnabledVehicles.value.has(selectedCar.value) 
        ? '关闭全局路径' 
        : '查看车辆路径';
});

// 处理车辆连接事件
const handleVehicleConnectionStatus = (payload) => {
    const { carId, isConnected } = payload;
    
    // 只有在"显示所有路径"开启时，才自动添加新连接的车辆
    if (isConnected && showAllPaths.value) {
        console.log(`车辆 ${carId} 已连接，自动开启路径显示`);
        enablePath(carId); // 使用全局方法
        
        // 发送路径显示指令给新连接的车辆
        socketManager.sendVehiclePathDisplay(carId, 1).catch(error => {
            console.error(`为新连接车辆 ${carId} 开启路径显示失败:`, error);
        });
    }
};

// 加载车辆连接数据
const loadVehicleConnections = async () => {
    loading.value = true;
    try {
        const result = await VehicleConnectionAPI.getAllConnections();
        if (result.success) {
            // 转换并按车辆ID升序排序
            vehicleList.value = result.data
                .slice()
                .sort((a, b) => (a.vehicle_id ?? 0) - (b.vehicle_id ?? 0))
                .map(connection => ({
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
        Toast.warning('请先选择车辆');
        return;
    }

    // 检查选中的车辆是否在线
    if (!socketManager.isVehicleConnected(selectedCar.value)) {
        Toast.warning('当前车辆离线');
        return;
    }

    try {
        // 判断车辆是否已经在路径显示集合中
        const isPathEnabled = pathEnabledVehicles.value.has(selectedCar.value);
        
        // 如果"显示所有路径"已开启，且用户尝试关闭单个车辆路径，则阻止操作
        if (showAllPaths.value && isPathEnabled) {
            Toast.warning('当前所有路径显示处于启用状态');
            return;
        }
        
        // 如果已开启，则关闭（第二个字节为0）；如果未开启，则开启（第二个字节为1）
        const displayPath = isPathEnabled ? 0 : 1;
        
        // 【重要】先更新本地状态，再发送协议
        // 因为车端收到协议后会立即返回0x0003，此时需要确保车辆已在集合中
        if (isPathEnabled) {
            // 关闭路径显示，从集合中移除
            disablePath(selectedCar.value);
        } else {
            // 开启路径显示，添加到集合中
            enablePath(selectedCar.value);
        }
        
        // 发送车辆路径显示控制指令
        await socketManager.sendVehiclePathDisplay(selectedCar.value, displayPath);
        
        // 显示提示消息
        if (isPathEnabled) {
            Toast.success('已关闭车辆路径显示');
        } else {
            Toast.success('已开启车辆路径显示');
        }
        
    } catch (error) {
        console.error('发送车辆路径显示指令失败:', error);
        Toast.error('发送车辆路径显示指令失败: ' + error.message);
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
        
        // 如果是打开操作（从 false 到 true）
        if (newValue) {
            // 检查是否有在线车辆
            if (onlineVehicleIds.length === 0) {
                Toast.warning('当前未有车辆在线');
                // 恢复开关到关闭状态
                isRestoringState.value = true;
                showAllPaths.value = false;
                return;
            }
            
            // 将所有在线车辆添加到路径显示集合
            enablePaths(onlineVehicleIds); // 使用全局方法
            
            // 批量发送路径显示控制指令给所有在线车辆
            await socketManager.sendBatchVehiclePathDisplay(onlineVehicleIds, 1);
            
            Toast.success(`已开启 ${onlineVehicleIds.length} 辆车的路径显示`);
        } else {
            // 关闭操作：先获取需要关闭的车辆列表
            const vehicleIdsToDisable = Array.from(pathEnabledVehicles.value);
            
            // 如果没有车辆需要关闭，静默跳过
            if (vehicleIdsToDisable.length === 0) {
                console.log('没有开启路径显示的车辆，跳过关闭操作');
                return;
            }
            
            // 【重要】先清空路径显示集合，再发送协议
            clearAllPaths();
            
            // 批量发送关闭指令给所有之前开启的车辆
            await socketManager.sendBatchVehiclePathDisplay(vehicleIdsToDisable, 0);
            
            Toast.success(`已关闭 ${vehicleIdsToDisable.length} 辆车的路径显示`);
        }
    } catch (error) {
        console.error('批量发送路径显示指令失败:', error);
        Toast.error('批量发送路径显示指令失败: ' + error.message);
        // 发送失败时恢复开关状态
        isRestoringState.value = true;
        showAllPaths.value = !newValue;
    }
});

// 组件挂载时加载数据和监听事件
onMounted(() => {
    loadVehicleConnections();
    
    // 监听车辆连接状态变化事件
    eventBus.on(EVENTS.VEHICLE_CONNECTION_STATUS, handleVehicleConnectionStatus);
});

// 组件卸载时移除事件监听
onBeforeUnmount(() => {
    // 移除事件监听，防止内存泄漏
    eventBus.off(EVENTS.VEHICLE_CONNECTION_STATUS, handleVehicleConnectionStatus);
});
</script>

<style lang="scss" scoped>
.floating-settings-panel {
    padding: 25px;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    /* 🔧 触屏滚动支持 */
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
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