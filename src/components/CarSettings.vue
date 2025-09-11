<template>
    <div class="form-group">
        <label class="form-label"> <fa icon="route"> </fa> 车辆设置</label>
        <el-select v-model="selectedCarId" placeholder="请选择车辆">
            <el-option
                v-for="item in carList"
                :key="item.id"
                :label="item.name"
                :value="item.id"
            ></el-option>
        </el-select>
        <div class="sensor-grid">
            <div
                class="sensor-card"
                v-for="item in toggleList"
                :key="item.name"
                @click="toggleSensorStatus(item)"
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
import { ref, computed } from 'vue';
import { useCarStore } from '@/stores/car.js';

const carStore = useCarStore();

const toggleList = ref([
    {
        id: 1,
        name: '传感器',
        icon: 'microchip',
        status: true,
    },
    {
        id: 2,
        name: '建图',
        icon: 'crop',
        status: false,
    },
    {
        id: 3,
        name: '录制路径',
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
        status: true,
    },
    {
        id: 8,
        name: '所有程序',
        icon: 'ban',
        status: true,
    },
]);

const selectedCarId = computed({
    get: () => carStore.selectedCarId,
    set: (value) => carStore.changeCarId(value),
});

const carList = computed(() => carStore.carList);

const toggleSensorStatus = (item) => {
    if (item.id === 8) {
        toggleList.value.forEach((e) => {
            e.status = !item.status;
        });
    } else {
        const selectedItem = toggleList.value.find((e) => e.id === item.id);
        if (selectedItem) {
            selectedItem.status = !selectedItem.status;
        }
    }
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