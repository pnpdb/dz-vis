<template>
    <div class="steering-wheel-wrapper">
        <div class="steering-wheel" :style="{ transform: `rotate(${angle}deg)` }">
            <!-- 方向盘外圈 -->
            <div class="wheel-outer"></div>
            <!-- 方向盘内圈 -->
            <div class="wheel-inner"></div>
            <!-- 方向盘辐条 -->
            <div class="wheel-spoke spoke-1"></div>
            <div class="wheel-spoke spoke-2"></div>
            <div class="wheel-spoke spoke-3"></div>
            <!-- 中心logo区域 -->
            <div class="wheel-center">
                <fa icon="car" />
            </div>
            <!-- 转角指示点 -->
            <div class="angle-indicator"></div>
        </div>
        <!-- 转角数值显示 -->
        <div class="angle-display">
            {{ Math.abs(angle).toFixed(0) }}°
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    angle: {
        type: Number,
        default: 0 // 转角度数，正值为右转，负值为左转
    }
});
</script>

<style lang="scss" scoped>
.steering-wheel-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    position: relative;
}

.steering-wheel {
    width: 80px;
    height: 80px;
    position: relative;
    transition: transform 0.3s ease;
    margin-bottom: 8px;
}

/* 方向盘外圈 */
.wheel-outer {
    width: 100%;
    height: 100%;
    border: 3px solid #00ff88;
    border-radius: 50%;
    position: absolute;
    box-shadow: 
        0 0 10px rgba(0, 255, 136, 0.3),
        inset 0 0 10px rgba(0, 255, 136, 0.1);
}

/* 方向盘内圈 */
.wheel-inner {
    width: 60%;
    height: 60%;
    border: 2px solid #00cc6a;
    border-radius: 50%;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 255, 136, 0.1);
}

/* 方向盘辐条 */
.wheel-spoke {
    position: absolute;
    background: #00ff88;
    border-radius: 2px;
    box-shadow: 0 0 5px rgba(0, 255, 136, 0.5);
}

.spoke-1 {
    width: 2px;
    height: 35%;
    top: 5%;
    left: 50%;
    transform: translateX(-50%);
}

.spoke-2 {
    width: 35%;
    height: 2px;
    top: 50%;
    left: 5%;
    transform: translateY(-50%);
}

.spoke-3 {
    width: 35%;
    height: 2px;
    top: 50%;
    right: 5%;
    transform: translateY(-50%);
}

/* 中心logo */
.wheel-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    background: rgba(0, 25, 47, 0.8);
    border: 1px solid #00ff88;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    color: #00ff88;
}

/* 转角指示点 */
.angle-indicator {
    position: absolute;
    top: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    background: #ff4444;
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(255, 68, 68, 0.8);
}

/* 转角数值显示 */
.angle-display {
    font-size: 12px;
    color: #00ff88;
    font-weight: bold;
    text-align: center;
    min-width: 40px;
    background: rgba(0, 25, 47, 0.6);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(0, 255, 136, 0.3);
}

/* 响应式调整 */
@media (max-width: 768px) {
    .steering-wheel {
        width: 60px;
        height: 60px;
    }
    
    .angle-display {
        font-size: 10px;
    }
}
</style>
