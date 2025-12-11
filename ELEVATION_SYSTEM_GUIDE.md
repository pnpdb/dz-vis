# 🌉 高架桥高度控制系统使用指南

**版本**: v1.0 | **日期**: 2025-12-11

---

## 📋 功能概述

高架桥高度控制系统能够根据车辆在沙盘上的位置，自动计算并应用正确的高度和倾角，使车辆在高架桥、上坡、下坡区域正确显示。

### 核心特性

✅ **区域自动识别**：根据X、Y坐标自动判断车辆所在区域  
✅ **平滑过渡**：上下坡使用线性插值，高度变化平滑自然  
✅ **倾角自动计算**：根据坡度自动计算车辆pitch角度  
✅ **实时调试**：提供丰富的调试工具，方便参数调整  
✅ **可视化边界**：可在沙盘上显示区域边界线

---

## 🎯 区域划分

系统将沙盘划分为4个区域：

```
┌─────────────────────────────────────────┐
│           🌉 高架桥区域 (Y > Y2)         │  ← 固定高度
├─────────────────────────────────────────┤
│ 📈上坡 │      正常道路区域        │ 📉下坡 │  ← Y1 < Y ≤ Y2
│ X≤X1  │   (X1 < X < X2)       │ X≥X2  │
├─────────────────────────────────────────┤
│           地面区域 (Y ≤ Y1)             │  ← 地面高度
└─────────────────────────────────────────┘
```

### 区域参数（车辆坐标系）

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `X1` | 0.790m | 左侧上坡区域右边界 |
| `X2` | 5.205m | 右侧下坡区域左边界 |
| `Y1` | 2.958m | 坡道起点（地面→上坡） |
| `Y2` | 3.913m | 高架起点（上坡→高架） |
| `BRIDGE_HEIGHT` | 0.15m | 高架桥高度增量 |

### 区域判断逻辑

1. **高架桥区域** (`Y > Y2`)：固定高度，无倾角
2. **左侧上坡** (`X ≤ X1` 且 `Y1 < Y ≤ Y2`)：高度线性增加，正向倾角
3. **右侧下坡** (`X ≥ X2` 且 `Y1 < Y ≤ Y2`)：高度线性减少，负向倾角
4. **地面区域**：其他所有位置，零高度零倾角

---

## 🚀 使用方法

### 1. 查看当前配置

在浏览器控制台运行：

```javascript
window.__debugElevation()
```

输出示例：
```
🌉 高架桥配置:
═══════════════════════════════════
启用状态: ✅ 已启用

📏 边界坐标 (车辆坐标系):
  X1 (左侧边界): 0.79m
  X2 (右侧边界): 5.205m
  Y1 (坡道起点): 2.958m
  Y2 (高架起点): 3.913m

📐 高度和坡度:
  高架桥高度: 0.15m (沙盘局部坐标)
  坡道长度: 0.955m
  坡度角: 8.94°
═══════════════════════════════════
```

### 2. 显示区域边界线

```javascript
// 显示边界线（可视化调试）
window.__showElevationLines()
```

边界线颜色说明：
- 🔴 **红色**：X1 左侧边界
- 🟢 **绿色**：X2 右侧边界  
- 🔵 **蓝色**：Y1 坡道起点
- 🟡 **黄色**：Y2 高架起点

```javascript
// 隐藏边界线
window.__hideElevationLines()
```

### 3. 测试指定坐标

```javascript
// 测试坐标 (3.0, 3.5) 的高度
window.__testElevation(3.0, 3.5)
```

输出示例：
```
🧪 坐标 (3.000, 3.500) 的高度测试:
  区域: left_upslope
  高度增量: 0.0850m
  倾角: 8.94° (0.1560 rad)
```

### 4. 调整配置参数

```javascript
// 更新单个参数
window.__updateElevation({
    BRIDGE_HEIGHT: 0.18  // 调整高架桥高度
})

// 更新多个参数
window.__updateElevation({
    X1: 0.8,
    X2: 5.2,
    Y1: 2.95,
    Y2: 3.92,
    BRIDGE_HEIGHT: 0.16
})

// 禁用系统
window.__updateElevation({ enabled: false })
```

---

## 🔧 参数调整指南

### 步骤1：确定高架桥实际高度

1. 运行测试客户端，将车辆开到高架桥上
2. 观察车辆是否在正确高度
3. 如果车辆偏高/偏低，调整 `BRIDGE_HEIGHT`：

```javascript
// 车辆偏低：增加高度
window.__updateElevation({ BRIDGE_HEIGHT: 0.18 })

// 车辆偏高：减少高度
window.__updateElevation({ BRIDGE_HEIGHT: 0.12 })
```

### 步骤2：微调边界坐标

1. 显示边界线：`window.__showElevationLines()`
2. 让车辆沿着上坡/下坡行驶
3. 观察车辆开始上坡/下坡的位置是否与边界线对齐
4. 微调 `X1`、`X2`、`Y1`、`Y2`：

```javascript
// 如果上坡太早/太晚，调整 Y1
window.__updateElevation({ Y1: 2.97 })

// 如果左侧上坡区域不准确，调整 X1
window.__updateElevation({ X1: 0.8 })
```

### 步骤3：验证所有区域

使用测试命令检查关键位置：

```javascript
// 测试左侧上坡中点
window.__testElevation(0.5, 3.4)  // 应该是 left_upslope，高度约为一半

// 测试高架桥
window.__testElevation(3.0, 4.5)  // 应该是 bridge，高度为 BRIDGE_HEIGHT

// 测试右侧下坡
window.__testElevation(5.5, 3.4)  // 应该是 right_downslope，高度逐渐降低

// 测试地面
window.__testElevation(3.0, 2.0)  // 应该是 ground，高度为 0
```

---

## 🐛 常见问题

### Q1: 车辆在高架桥上还是掉到地面了

**原因**：`BRIDGE_HEIGHT` 太小  
**解决**：增加 `BRIDGE_HEIGHT` 值

```javascript
window.__updateElevation({ BRIDGE_HEIGHT: 0.20 })
```

### Q2: 车辆在坡道上"飞起来"了

**原因**：`BRIDGE_HEIGHT` 太大  
**解决**：减少 `BRIDGE_HEIGHT` 值

```javascript
window.__updateElevation({ BRIDGE_HEIGHT: 0.12 })
```

### Q3: 车辆上坡位置不对

**原因**：`X1`、`Y1` 边界不准确  
**解决**：显示边界线，观察并微调

```javascript
window.__showElevationLines()
window.__updateElevation({ Y1: 2.97, X1: 0.8 })
```

### Q4: 车辆倾角太大/太小

**原因**：坡度是自动计算的，取决于 `BRIDGE_HEIGHT` 和坡道长度  
**解决**：调整 `BRIDGE_HEIGHT` 或 `Y1`/`Y2` 距离

```javascript
// 减小倾角：增加坡道长度
window.__updateElevation({ Y1: 2.9, Y2: 4.0 })

// 或减小高度差
window.__updateElevation({ BRIDGE_HEIGHT: 0.12 })
```

### Q5: 如何测量实际坐标？

使用 Scene3D 的坐标测试功能：

```javascript
// 点击沙盘任意位置，会显示该位置的坐标
window.__scene3d__.testGroundHeight()
```

---

## 📊 调试技巧

### 1. 实时监控车辆状态

```javascript
// 查看所有车辆的位置信息
window.__debugVehicles()
```

### 2. 批量测试坐标

```javascript
// 沿着坡道测试多个点
const testPoints = [
    [0.5, 2.8], [0.5, 3.0], [0.5, 3.2], 
    [0.5, 3.4], [0.5, 3.6], [0.5, 3.8], [0.5, 4.0]
];

testPoints.forEach(([x, y]) => {
    console.log(`\n测试点 (${x}, ${y}):`);
    window.__testElevation(x, y);
});
```

### 3. 保存成功的配置

找到合适的参数后，记录下来：

```javascript
const config = window.__debugElevation();
console.log('最终配置:', JSON.stringify(config, null, 2));
```

然后更新代码中的 `ELEVATION_CONFIG` 默认值。

---

## 🎓 高级用法

### 自定义区域形状

如果你的沙盘有更复杂的高架结构，可以修改 `calculateVehicleElevation` 函数，添加更多区域判断逻辑。

### 动态高度曲线

目前使用线性插值，如果需要平滑曲线（如缓入缓出），可以使用 easing 函数：

```javascript
// 在 calculateVehicleElevation 中修改
const progress = (vehicleY - Y1) / SLOPE_LENGTH;  // 0-1
const easedProgress = progress * progress;  // 平方缓入
return {
    height: easedProgress * BRIDGE_HEIGHT,
    pitchAngle: SLOPE_ANGLE * (2 * progress)  // 动态倾角
};
```

---

## 📝 代码位置

- **配置文件**：`src/components/Scene3D/vehicleManager.js` (第53-79行)
- **计算函数**：`calculateVehicleElevation()` (第82-126行)
- **应用逻辑**：`processBatchUpdates()` 和 `addVehicle()` 函数
- **调试工具**：`debugElevationConfig()` 等 (第1000+行)

---

## 🎉 总结

使用高架桥高度控制系统的流程：

1. ✅ 启动应用，系统自动加载默认配置
2. 🔍 运行 `window.__debugElevation()` 查看配置
3. 🎨 运行 `window.__showElevationLines()` 显示边界
4. 🚗 测试车辆行驶，观察效果
5. 🔧 使用 `window.__updateElevation()` 微调参数
6. 💾 保存最终配置到代码中

**祝你调试顺利！** 🎊

如有问题，请查看控制台输出或使用调试工具排查。
