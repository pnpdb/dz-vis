<template>
    <div class="panel-card">
        <div class="panel-header">
            <div class="panel-icon">
                <fa icon="robot"></fa>
            </div>
            <h2 class="panel-title">自动驾驶</h2>
        </div>

        <!-- 数据设置 -->
        <div class="form-group">
            <label class="form-label"> <fa icon="file" /> 数据设置</label>
            <div class="flex-item">
                <span>数据记录</span>
                <el-switch
                    v-model="dataRecord"
                    active-color="#13ce66"
                    inactive-color="#ff4949"
                ></el-switch>
            </div>
        </div>
        <!-- 自动驾驶出租车 -->
        <div class="form-group">
            <label class="form-label">
                <fa icon="taxi" /> 自动驾驶出租车</label
            >
            <div class="input-label">起点位置:</div>
            <div class="flex">
                <input
                    class="map-point-value"
                    placeholder="请在地图上选择起点"
                    readonly
                    v-model="taxi.startPoint"
                />

                <button class="btn btn-secondary btn-small" id="select-start">
                    <fa icon="map-marked-alt"></fa> 选择起点
                </button>
            </div>
            <div class="input-label">终点位置:</div>
            <div class="flex">
                <input
                    class="map-point-value"
                    placeholder="请在地图上选择终点"
                    readonly
                    v-model="taxi.endPoint"
                />
                <button class="btn btn-danger btn-small" id="select-end">
                    <fa icon="flag-checkered"></fa> 选择终点
                </button>
            </div>

            <button class="btn btn-primary">
                <fa icon="car-side"></fa> 呼叫出租车
            </button>
        </div>

        <!-- AVP自主代客泊车 -->
        <div class="form-group">
            <label class="form-label">
                <fa icon="parking" /> AVP自主代客泊车</label
            >
            <div class="input-label">选择车辆:</div>
            <div class="flex">
                <el-select v-model="parking.car" placeholder="请选择车辆">
                    <el-option
                        label="京A·12345 (在线)"
                        value="car-001"
                    ></el-option>
                    <el-option
                        label="京B·67890 (在线)"
                        value="car-002"
                    ></el-option>
                    <el-option
                        label="京C·24680 (离线)"
                        value="car-003"
                    ></el-option>
                </el-select>
            </div>
            <div class="input-label">选择车位:</div>

            <div class="flex">
                <input
                    class="map-point-value"
                    placeholder="请在地图上选择停车位"
                    readonly
                    v-model="parking.point"
                />
                <button class="btn btn-secondary btn-small">
                    <fa icon="map-marked-alt"></fa>
                    选择车位
                </button>
            </div>
            <button class="btn btn-primary">
                <fa icon="parking"></fa> 我要泊车
            </button>
        </div>

        <!-- AVP取车 -->
        <div class="form-group">
            <label class="form-label"> <fa icon="key" /> AVP取车</label>
            <div class="input-label">选择车辆:</div>
            <div class="flex">
                <el-select v-model="parking.car" placeholder="请选择车辆">
                    <el-option
                        label="京A·12345 (在线)"
                        value="car-001"
                    ></el-option>
                    <el-option
                        label="京B·67890 (在线)"
                        value="car-002"
                    ></el-option>
                    <el-option
                        label="京C·24680 (离线)"
                        value="car-003"
                    ></el-option>
                </el-select>
            </div>

            <button class="btn btn-primary">
                <fa icon="sign-in-alt"></fa> 我要取车
            </button>
        </div>
    </div>
</template>

<script>
export default {
    name: 'AutoDrive',
    data() {
        return {
            dataRecord: true,
            taxi: {
                startPoint: '',
                endPoint: '',
            },
            parking: {
                car: '',
                point: '',
            },
        };
    },
    methods: {},
};
</script>

<style lang="scss" scoped>
.flex-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.flex {
    margin-bottom: 10px;
}
.input-label {
    min-width: 70px;
    color: #a0b3d0;
    margin-bottom: 8px;
}
.map-point-value {
    flex-grow: 1;
    height: 44px;
    padding: 12px 15px;
    background: rgba(30, 58, 95, 0.5);
    border: 1px solid var(--dark-border);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 16px;
    margin-right: 10px;
}
</style>