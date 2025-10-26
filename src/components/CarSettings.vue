<template>
    <div class="form-group">
        <label class="form-label"> <fa icon="route"> </fa> 车辆设置</label>
        <el-select 
            v-model="selectedCarId" 
            placeholder="请选择车辆"
            disabled
            @click="showDisabledMessage"
        >
            <el-option
                v-for="item in carList"
                :key="item.id"
                :label="item.name"
                :value="item.id"
            ></el-option>
        </el-select>
        <div class="sensor-grid">
            <div
                class="sensor-card disabled"
                v-for="item in toggleList"
                :key="item.name"
                @click="showDisabledMessage"
            >
                <div class="sensor-icon">
                    <fa :icon="item.icon"></fa>
                </div>

                <div class="sensor-name">{{ item.name }}</div>

                <div class="sensor-status status-error" v-show="!item.status">
                    关闭
                </div>
                <div class="sensor-status status-normal" v-show="item.status">
                    开启
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useCarStore } from '@/stores/car.js';
import { VehicleConnectionAPI } from '@/utils/vehicleAPI.js';
import { socketManager } from '@/utils/socketManager.js';
import Toast from '@/utils/toast.js';

const carStore = useCarStore();

// 从数据库加载的车辆列表
const databaseCarList = ref([]);
const loading = ref(false);

const toggleList = ref([
    {
        id: 1,
        name: '传感器',
        icon: 'microchip',
        status: false,
    },
    {
        id: 2,
        name: '建图',
        icon: 'crop',
        status: false,
    },
    {
        id: 3,
        name: '录制',
        icon: 'video',
        status: false,
    },
    {
        id: 4,
        name: '定位',
        icon: 'compass',
        status: false,
    },
    {
        id: 5,
        name: '自主导航',
        icon: 'location-arrow',
        status: false,
    },
    {
        id: 6,
        name: '图像识别',
        icon: 'image',
        status: false,
    },
    {
        id: 7,
        name: '打靶功能',
        icon: 'crosshairs',
        status: false,
    },
    {
        id: 8,
        name: '所有程序',
        icon: 'ban',
        status: false,
    },
]);

const selectedCarId = computed({
    get: () => carStore.selectedCarId,
    set: (value) => carStore.changeCarId(value),
});

// 使用数据库中的车辆列表，如果为空则使用store中的默认数据
const carList = computed(() => {
    return databaseCarList.value.length > 0 ? databaseCarList.value : carStore.carList;
});

// 加载车辆连接数据
const loadVehicleConnections = async () => {
    loading.value = true;
    try {
        const result = await VehicleConnectionAPI.getAllConnections();
        if (result.success) {
            // 转换数据库数据为组件需要的格式
            const normalized = result.data.map(connection => ({
                id: connection.vehicle_id,
                name: connection.name, // 只显示车辆名称，不带描述
                vehicleId: connection.vehicle_id,
                ipAddress: connection.ip_address,
                port: connection.port,
                description: connection.description,
                isActive: connection.is_active
            }));

            databaseCarList.value = normalized.sort((a, b) => a.vehicleId - b.vehicleId);
            
            console.debug('✅ 车辆设置页面加载车辆列表成功:', databaseCarList.value);
        } else {
            console.error('❌ 车辆设置页面加载车辆列表失败:', result.error);
        }
    } catch (error) {
        console.error('❌ 车辆设置页面加载车辆连接异常:', error);
    } finally {
        loading.value = false;
    }
};

// 组件挂载时加载数据
onMounted(() => {
    loadVehicleConnections();
});

// 显示功能禁用提示消息
const showDisabledMessage = () => {
    Toast.warning('管理员已禁用该功能');
};
</script>

<style lang="scss" scoped>
.sensor-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;

    .sensor-card {
        text-align: center;
        padding: 10px;
        background: rgba(10, 25, 47, 0.5);
        border-radius: 8px;
        border: 1px solid rgba(0, 240, 255, 0.1);
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .sensor-card:hover {
        transform: translateY(-3px);
        border-color: var(--primary);
    }

    // 禁用状态样式
    .sensor-card.disabled {
        opacity: 0.6;
        cursor: not-allowed;
        background: rgba(10, 25, 47, 0.3);
        border: 1px solid rgba(128, 128, 128, 0.3);
        
        &:hover {
            transform: none;
            border-color: rgba(128, 128, 128, 0.3);
        }

        .sensor-icon {
            color: #666;
        }

        .sensor-name {
            color: #666;
        }

        .sensor-status {
            color: #666;
        }
    }

    .sensor-icon {
        margin-bottom: 5px;
        font-size: 24px;
        color: #00f0ff;
    }

    .sensor-name {
        margin-bottom: 10px;
        font-size: 14px;
        color: #a0b3d0;
        user-select: none;
    }

    .sensor-status {
        font-size: 14px;
        margin-top: 3px;
    }
}
</style>