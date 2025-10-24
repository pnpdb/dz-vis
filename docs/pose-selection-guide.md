# 位姿选择功能使用指南

## 概述

位姿选择模式允许用户在沙盘上选择一个位置和朝向。修改后的功能：

1. **坐标系统**：返回沙盘模型的局部坐标（需要转换为车辆坐标系显示）
2. **角度系统**：
   - X轴正向为 0 弧度
   - 逆时针旋转：0 到 π（正值）
   - 顺时针旋转：-π 到 0（负值）

## 使用方法

### 1. 在 Vue 组件中导入

```javascript
import { startPoseSelectionMode, stopPoseSelectionMode } from '@/components/Scene3D/index.js';
import { modelToVehicleCoordinates } from '@/utils/coordinateTransform.js';
```

### 2. 启动位姿选择模式

```javascript
const selectInitialPose = () => {
    ElMessage.info('请在地图上点击并拖动设置初始位姿');
    
    startPoseSelectionMode(({ x, z, orientation }) => {
        // 结束选择模式
        stopPoseSelectionMode();
        
        // x, z 是模型局部坐标
        // orientation 是弧度角度（-π 到 π）
        
        // 转换为车辆坐标系用于显示
        const vehicleCoords = modelToVehicleCoordinates(x, z);
        
        console.log('选择的位姿:');
        console.log('  模型坐标:', x.toFixed(3), z.toFixed(3));
        console.log('  车辆坐标:', vehicleCoords.x.toFixed(3), vehicleCoords.y.toFixed(3));
        console.log('  朝向角度:', orientation.toFixed(3), 'rad');
        
        // 显示确认弹窗
        ElMessageBox.confirm(
            `确认选择的初始位姿？
             位置: X=${vehicleCoords.x.toFixed(2)}m, Y=${vehicleCoords.y.toFixed(2)}m
             朝向: ${orientation.toFixed(2)} rad (${(orientation * 180 / Math.PI).toFixed(1)}°)`,
            '确认初始位姿',
            {
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                type: 'info'
            }
        ).then(() => {
            // 用户确认，发送给车辆
            // 注意：发送给车辆时使用车辆坐标系
            sendInitialPose(vehicleCoords.x, vehicleCoords.y, orientation);
        }).catch(() => {
            // 用户取消
            console.log('用户取消了位姿选择');
        });
    });
};
```

### 3. 角度说明

拖动射线时，屏幕上会显示实时角度（弧度制）：

- **0 rad**: 箭头指向右侧（X轴正向）
- **π/2 rad (90°)**: 箭头指向上方（逆时针）
- **π rad (180°)**: 箭头指向左侧
- **-π/2 rad (-90°)**: 箭头指向下方（顺时针）

### 4. 坐标转换

```javascript
// 模型局部坐标范围: X: -2.405 ~ +2.405, Z: -1.405 ~ +1.405
// 车辆坐标系范围:   X: 0 ~ 4.81m,      Y: 0 ~ 2.81m

import { modelToVehicleCoordinates } from '@/utils/coordinateTransform.js';

const vehicleCoords = modelToVehicleCoordinates(modelX, modelZ);
// vehicleCoords.x (0-4.81m)
// vehicleCoords.y (0-2.81m)
```

## 完整示例

参考 `src/views/Map.vue` 中的施工标记和起点/终点选择实现。

## 注意事项

1. 显示给用户的坐标应该使用车辆坐标系（0-4.81m, 0-2.81m）
2. 发送给车辆的坐标也应该使用车辆坐标系
3. 角度使用弧度制，范围 -π 到 π
4. 模型局部坐标仅用于内部计算

