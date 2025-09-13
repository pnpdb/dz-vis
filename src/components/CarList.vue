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
import { VehicleConnectionAPI } from '@/utils/vehicleAPI.js';

import { useCarStore } from '@/stores/car.js';

export default {
    name: 'CarList',
    setup() {
        const carStore = useCarStore();
        return { carStore };
    },
    data() {
        return {
            carList: [],
            loading: false
        };
    },
    computed: {
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
        await this.loadVehicleConnections();
    },
    methods: {
        async loadVehicleConnections() {
            this.loading = true;
            try {
                const result = await VehicleConnectionAPI.getAllConnections();
                if (result.success) {
                    // 转换数据库数据为组件需要的格式
                    this.carList = result.data.map(connection => ({
                        id: connection.vehicle_id,
                        name: connection.name, // 只显示车辆名称
                        status: connection.is_active ? 'online' : 'offline',
                        lastUpdateTime: this.formatTime(connection.updated_at),
                        ipAddress: connection.ip_address,
                        port: connection.port,
                        vehicleId: connection.vehicle_id
                    }));
                    
                    // 如果没有选中的车辆，默认选择第一个
                    if (!this.carStore.selectedCarId && this.carList.length > 0) {
                        this.carStore.changeCarId(this.carList[0].id);
                    }
                    
                    console.log('✅ 加载车辆列表成功:', this.carList);
                } else {
                    console.error('❌ 加载车辆列表失败:', result.error);
                    // 如果加载失败，使用默认数据
                    this.carList = [
                        {
                            id: 'default-car',
                            name: '默认车辆 - 请在设置中添加车辆',
                            status: 'offline',
                            lastUpdateTime: '无数据'
                        }
                    ];
                }
            } catch (error) {
                console.error('❌ 加载车辆连接异常:', error);
            } finally {
                this.loading = false;
            }
        },
        
        formatTime(isoString) {
            try {
                const date = new Date(isoString);
                const now = new Date();
                const diffMs = now - date;
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                
                if (diffMinutes < 1) return '刚刚';
                if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
                if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} 小时前`;
                return `${Math.floor(diffMinutes / 1440)} 天前`;
            } catch {
                return '未知时间';
            }
        },
        
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