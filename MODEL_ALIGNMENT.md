# 🎯 模型位置自动对齐说明

## 📋 功能概述

为了确保沙盘底座贴地、小车在道路表面上正确对齐，我们实现了**自动位置对齐系统**。

---

## ✨ 自动对齐机制

### 1. 沙盘底座自动贴地

**问题**：
- 之前沙盘模型浮在空中（Y=1.4）
- 底座不在Y=0平面上

**解决方案**：
```javascript
// 计算沙盘包围盒
const box = new Box3().setFromObject(sandboxModel);

// 计算偏移量：让底部贴地
const offsetY = -box.min.y;
sandboxModel.position.y = offsetY;
```

**效果**：
- ✅ 沙盘底座现在贴在Y=0平面上
- ✅ 整个沙盘不再浮空

---

### 2. 小车自动放置在道路表面

**问题**：
- 小车之前在固定高度（Y=0.5）
- 与沙盘道路表面不对齐

**解决方案**：
```javascript
// 假设道路表面在沙盘顶部附近
const roadSurfaceY = box.max.y - 0.05;  // 略低于顶部
carModel.position.y = roadSurfaceY;
```

**效果**：
- ✅ 小车现在在沙盘道路表面上
- ✅ 不会悬空或穿模

---

## 🔍 调试信息

启动软件后，在控制台会看到：

```
📐 沙盘模型自动对齐:
  - 包围盒最低点: Y=1.234
  - 包围盒最高点: Y=1.456
  - 偏移量: -1.234
  - 调整后位置: Y=0.000 (底座贴地)
  - 小车位置调整: Y=1.406 (在道路表面)
✅ 沙盘和小车位置对齐完成
```

---

## 🔧 微调位置（如果需要）

如果自动对齐后位置还需要微调，可以使用调试工具：

### 查看当前位置
```javascript
window.__scene3d__.logSandboxInfo();
```

### 调整沙盘位置
```javascript
// 格式: adjustSandboxPosition(x, y, z)
window.__scene3d__.adjustSandboxPosition(0, 0, 0);
```

### 调整小车高度
```javascript
// 如果小车太高或太低，微调Y轴
window.__scene3d__.adjustCarPosition(0, 1.2, 0);  // Y=1.2
window.__scene3d__.adjustCarPosition(0, 1.3, 0);  // Y=1.3
window.__scene3d__.adjustCarPosition(0, 1.4, 0);  // Y=1.4
```

### 实时查看包围盒
```javascript
// 查看沙盘包围盒
const sandbox = window.__scene3d__.getSandboxModel();
const box = new THREE.Box3().setFromObject(sandbox);
console.log('沙盘包围盒:');
console.log('  最低点:', box.min);
console.log('  最高点:', box.max);
console.log('  尺寸:', box.getSize(new THREE.Vector3()));
```

---

## 📊 技术细节

### 包围盒计算

```javascript
// Three.js的Box3自动计算模型的最小/最大范围
const box = new Box3().setFromObject(model);

// 包围盒属性：
box.min  // Vector3 {x, y, z} - 最小点
box.max  // Vector3 {x, y, z} - 最大点

// 实用方法：
box.getSize(vector)     // 获取尺寸
box.getCenter(vector)   // 获取中心点
```

### 对齐算法

**沙盘底座贴地**：
```
新Y位置 = 0 - 包围盒最低点Y
        = -box.min.y
```

**小车在道路表面**：
```
新Y位置 = 包围盒最高点Y - 微调偏移
        = box.max.y - 0.05
```

---

## 🎮 常见调整场景

### 场景1：小车悬空（离道路太高）
```javascript
// 降低小车
window.__scene3d__.adjustCarPosition(0, 1.2, 0);
```

### 场景2：小车穿模（陷入道路）
```javascript
// 抬高小车
window.__scene3d__.adjustCarPosition(0, 1.5, 0);
```

### 场景3：沙盘整体太高/太低
```javascript
// 调整沙盘Y位置
window.__scene3d__.adjustSandboxPosition(0, 0.1, 0);  // 稍微抬高
window.__scene3d__.adjustSandboxPosition(0, -0.1, 0); // 稍微降低
```

### 场景4：沙盘缩放不对
```javascript
// 调整缩放
window.__scene3d__.adjustSandboxScale(5);   // 缩小
window.__scene3d__.adjustSandboxScale(7);   // 放大
```

---

## 📐 坐标系说明

Three.js使用右手坐标系：

```
      Y (上)
      |
      |
      |_______ X (右)
     /
    /
   Z (前)
```

- **X轴（红色）**：左右方向
- **Y轴（绿色）**：上下方向（高度）
- **Z轴（蓝色）**：前后方向

**我们的对齐**：
- Y=0：地面
- 沙盘底座：调整到Y=0
- 小车：调整到道路表面（接近沙盘顶部）

---

## 🧪 测试步骤

1. **重启软件**
2. **查看控制台日志**：确认自动对齐已执行
3. **观察3D场景**：
   - 沙盘底座是否贴地？
   - 小车是否在道路上？
4. **如需微调**：使用调试命令
5. **记录最佳参数**：如果找到最佳偏移量，可以硬编码

---

## 💡 优化建议

### 如果道路表面高度不准确

可以修改代码中的偏移量：

```javascript
// 在 index.js 中找到这行：
const roadSurfaceY = dimensions.bounds.max.y - 0.05;

// 调整偏移量：
const roadSurfaceY = dimensions.bounds.max.y - 0.1;   // 更低
const roadSurfaceY = dimensions.bounds.max.y - 0.02;  // 更高
const roadSurfaceY = dimensions.bounds.max.y;         // 顶部
```

### 如果不同车辆高度不同

可以为每个车辆设置不同的高度偏移：

```javascript
// 在车辆信息更新时调整
const vehicleHeightOffset = {
    1: 0.05,  // 车辆1偏移
    2: 0.08,  // 车辆2偏移
    3: 0.06,  // 车辆3偏移
};
```

---

## 🔍 问题诊断

### Q: 沙盘还是浮空的

**A**: 检查控制台是否有错误日志，确认自动对齐代码是否执行。

### Q: 小车位置完全错误

**A**: 可能是包围盒计算有问题，使用 `logSandboxInfo()` 查看详细信息。

### Q: 自动对齐后位置不精确

**A**: 这是正常的，使用调试命令微调，然后将最佳值写入代码。

---

## 📝 更新日志

**2025-10-23**
- ✅ 实现沙盘底座自动贴地功能
- ✅ 实现小车自动放置在道路表面
- ✅ 添加 `adjustCarPosition()` 调试工具
- ✅ 更新初始位置为 [0, 0, 0]，由自动对齐系统处理
- ✅ 同时支持异步加载和同步加载路径

---

**最后更新**：2025-10-23  
**作者**：AI Assistant  
**版本**：1.0

