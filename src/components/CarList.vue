<template>
    <div class="form-group">
        <label class="form-label"><fa icon="car" /> 当前车辆</label>
        <el-select 
            v-model="selectedCarId" 
            placeholder="选择车辆"
            class="compact-select"
            popper-class="compact-select-dropdown"
            ref="selectRef"
            @visible-change="handleDropdownVisible"
        >
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
import { useCarStore } from '@/stores/car.js';

export default {
    name: 'CarList',
    setup() {
        const carStore = useCarStore();
        return { carStore };
    },
    computed: {
        carList() {
            return this.carStore.availableCarList;
        },
        selectedCarId: {
            get() {
                return this.carStore.selectedCarId;
            },
            set(value) {
                this.carStore.changeCarId(value);
            }
        }
    },
    async mounted() {
        await this.carStore.loadVehicleConnections();
    },
    methods: {
        onCarChange(carId) {
            this.$emit('car-change', carId);
        },
        handleDropdownVisible(visible) {
            if (visible) {
                this.$nextTick(() => {
                    // 获取输入框的实际宽度
                    const selectElement = this.$refs.selectRef.$el;
                    const inputWidth = selectElement.offsetWidth;
                    
                    // 查找下拉列表元素
                    const dropdown = document.querySelector('.compact-select-dropdown');
                    if (dropdown) {
                        // 设置下拉列表宽度与输入框一致
                        dropdown.style.width = inputWidth + 'px';
                        dropdown.style.minWidth = inputWidth + 'px';
                        dropdown.style.maxWidth = inputWidth + 'px';
                        
                        // 获取输入框的位置信息，确保对齐
                        const rect = selectElement.getBoundingClientRect();
                        dropdown.style.left = rect.left + 'px';
                    }
                });
            }
        }
    }
};
</script>

<style lang="scss" scoped>
/* 紧凑下拉框样式 */
:deep(.compact-select) {
    width: 100%;
    font-size: 11px !important;
}

:deep(.compact-select .el-input__wrapper) {
    min-height: 24px !important;
    height: 24px !important;
    border-radius: 6px;
}

:deep(.compact-select .el-input__inner) {
    height: 20px !important;
    line-height: 20px !important;
    padding: 1px 8px !important;
    font-size: 11px !important;
}

:deep(.compact-select .el-input__inner::placeholder) {
    font-size: 11px !important;
}

/* 确保选中值的字体大小一致 */
:deep(.compact-select .el-select__selected-item) {
    font-size: 11px !important;
}

:deep(.compact-select .el-select__input) {
    font-size: 11px !important;
}

:deep(.compact-select .el-input__suffix) {
    height: 24px !important;
}

:deep(.compact-select .el-select__caret) {
    font-size: 12px !important;
}

/* 表单组样式 */
.form-group {
    position: relative;
}

/* 标题字号调整 */
.form-label {
    font-size: 13px !important;
}

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