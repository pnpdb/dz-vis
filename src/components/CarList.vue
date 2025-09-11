<template>
    <div class="form-group">
        <label class="form-label"><fa icon="car" /> 当前车辆</label>
        <el-select v-model="selectedCarId" placeholder="选择车辆">
            <el-option
                v-for="car in carList"
                :label="car.name"
                :value="car.id"
                :key="car.id"
            ></el-option>
        </el-select>
    </div>
</template>

<script>
export default {
    name: 'CarList',
    data() {
        return {
            selectedCarId: 'car-A',
            carList: [
                {
                    id: 'car-A',
                    name: '车辆 A - 自动驾驶出租车',
                    status: 'online',
                    lastUpdateTime: '2 分钟前'
                },
                {
                    id: 'car-B', 
                    name: '车辆 B - AVP测试车',
                    status: 'online',
                    lastUpdateTime: '1 分钟前'
                },
                {
                    id: 'car-C',
                    name: '车辆 C - 物流配送车',
                    status: 'offline',
                    lastUpdateTime: '5 分钟前'
                }
            ]
        };
    },
    methods: {
        onCarChange(carId) {
            this.$emit('car-change', carId);
        }
    },
    watch: {
        selectedCarId(newVal) {
            this.onCarChange(newVal);
        }
    }
};
</script>

<style lang="scss" scoped>
.vehicle-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    margin-top: 15px;

    .vehicle-card {
        background: rgba(10, 25, 47, 0.5);
        border-radius: 8px;
        padding: 15px;
        width: calc(50% - 8px);
        border: 1px solid rgba(0, 240, 255, 0.1);
        transition: all 0.3s ease;
        cursor: pointer;
    }

    .vehicle-card:hover {
        border-color: rgba(0, 240, 255, 0.5);
        transform: translateY(-3px);
    }

    .vehicle-card.active {
        border-color: #00f0ff;
        background: rgba(0, 240, 255, 0.1);
    }

    .vehicle-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }

    .vehicle-name {
        font-weight: 500;
        color: #00f0ff;
    }

    .vehicle-status {
        font-size: 12px;
        padding: 3px 8px;
        border-radius: 10px;
    }

    .vehicle-info {
        font-size: 13px;
        color: #a0b3d0;

        .vehicle-info-item {
            margin-bottom: 5px;
        }
    }
}
</style>