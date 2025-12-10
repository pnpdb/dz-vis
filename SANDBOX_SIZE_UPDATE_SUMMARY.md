# 沙盘尺寸更新总结

## 📊 更新概述

**更新时间**: 2024-12-10

**原因**: 更换了新的 sandbox.glb 模型

### 尺寸变更

| 项目 | 旧值 | 新值 | 比例 |
|------|------|------|------|
| **宽度 (X轴)** | 4.81m | 6.0m | ×1.247 |
| **深度 (Y/Z轴)** | 2.81m | 5.0m | ×1.779 |
| **地面高度 (Y)** | ~0 | 2.8236 | - |
| **地面参照物** | MD_CaoPing | Standardmaterial206 | - |

### 坐标系变更

#### 旧坐标系
```
车辆坐标: X(0-4.81m), Y(0-2.81m)
模型坐标: X(-2.405 to 2.405), Z(-1.405 to 1.405)
```

#### 新坐标系
```
车辆坐标: X(0-6.0m), Y(0-5.0m)
模型坐标: X(-3.0 to 3.0), Z(-2.5 to 2.5)
```

## ✅ 已完成的修改

### 1. 测试客户端文件

#### test/test_client.py
```python
# 第 488-489 行
self.SANDBOX_WIDTH = 6.0   # 原 4.81
self.SANDBOX_DEPTH = 5.0   # 原 2.81
```

#### test/test_client2.py
```python
# 第 418-419 行
self.SANDBOX_WIDTH = 6.0   # 原 4.81
self.SANDBOX_DEPTH = 5.0   # 原 2.81
```

#### test/test_client_high_freq.py
```python
# 第 489-490 行
self.SANDBOX_WIDTH = 6.0   # 原 4.81
self.SANDBOX_DEPTH = 5.0   # 原 2.81
```

### 2. 前端核心文件

#### src/utils/coordinateTransform.js

**常量定义** (第 21-26 行):
```javascript
export const SANDBOX_DIMENSIONS = {
    width: 6.0,   // X轴总宽度（米） - 原 4.81
    depth: 5.0,   // Z轴总深度（米） - 原 2.81
    halfWidth: 3.0,   // 原 2.405
    halfDepth: 2.5    // 原 1.405
};
```

**车位坐标** (第 32-37 行):
```javascript
export const PARKING_SLOTS = {
    1: { x: 4.326, y: 1.299 },  // 1号车位（按比例缩放的临时值）
    2: { x: 4.907, y: 1.299 }   // 2号车位（按比例缩放的临时值）
};
```

⚠️ **注意**: 车位坐标是按比例计算的临时值，需要根据新模型实际测量后更新！

**注释更新**:
- 第 7-13 行：坐标系说明
- 第 101-102 行：函数参数注释
- 第 250-258 行：地图百分比转换注释

#### src/components/CarButton.vue

**注释更新** (第 223-224 行):
```javascript
x: vehicleCoords.x,  // 车辆坐标系 X (0-6.0m) - 原 4.81m
z: vehicleCoords.y,  // 车辆坐标系 Y (0-5.0m) - 原 2.81m
```

**注释更新** (第 280 行):
```javascript
// x, y 已经是车辆坐标系 (0-6.0m, 0-5.0m) - 原 (0-4.81m, 0-2.81m)
```

### 3. 文档更新

#### PROJECT_GUIDE.md

更新了以下章节：
- **§ 核心概念：坐标系统** (第 1554-1564 行)
- **§ 坐标转换逻辑** (第 1593-1596, 1607-1610 行)
- **§ 重要配置项速查** (第 1700-1701 行)
- **§ 坐标转换测试** (第 2605-2607 行)

#### GROUND_HEIGHT_TEST.md

更新了示例输出 (第 156 行)，反映新的地面高度和尺寸。

### 4. 地面高度自动检测

#### src/components/Scene3D/index.js

**地面检测逻辑** (第 1471-1533 行):
- ✅ 优先查找 `Standardmaterial206`（新模型）
- ✅ 保留 `MD_CaoPing` 作为备用（旧模型兼容）
- ✅ 自动获取地面 Y 坐标高度
- ✅ 存储到 `dimensions.ground.yPosition`

**地面平面应用** (第 2384-2425 行):
- ✅ 使用实际地面高度 `2.8236` 创建 `groundPlane`
- ✅ 自动从 `dimensions.ground.yPosition` 获取

**调试工具** (第 520-620 行):
- ✅ 新增 `testGroundHeight()` 函数
- ✅ 详细输出地面信息

## 🧪 测试验证

### 测试地面高度检测

在浏览器控制台执行：
```javascript
window.__scene3d__.testGroundHeight()
```

**预期输出**:
```
✅ 找到 1 个匹配的地面网格

[1] Standardmaterial206
  📍 局部坐标: X=0.0000 Y=0.0000 Z=0.0000
  🌍 世界坐标: X=0.0000 Y=0.4152 Z=0.0000
  📐 尺寸: X=32.298 Y=0.064 Z=13.572
  📦 Y范围: 2.7600 ~ 2.8236
  📏 面积: 438.362

🎯 选定的地面网格 (面积最大):
  名称: Standardmaterial206
  地面高度(Y max): 2.8236  ✅
  地面底部(Y min): 2.7600
```

### 测试坐标转换

在浏览器控制台执行：
```javascript
import { vehicleToModelCoordinates, modelToVehicleCoordinates } 
  from '@/utils/coordinateTransform.js';

// 测试中心点
const center = { x: 3.0, z: 2.5 };
const model = vehicleToModelCoordinates(center.x, center.z);
const back = modelToVehicleCoordinates(model.x, model.z);

console.log('车辆中心点:', center);      // { x: 3.0, z: 2.5 }
console.log('模型坐标:', model);         // { x: 0, z: 0 }
console.log('转换回来:', back);          // { x: 3.0, z: 2.5 }
```

### 测试车辆运动

启动测试客户端：
```bash
cd test
python test_client.py
```

**预期结果**:
- ✅ 车辆在新尺寸的沙盘上正常移动
- ✅ 车辆不会超出边界 (0-6.0m, 0-5.0m)
- ✅ 车辆贴合地面（Y = 2.8236）

## ⚠️ 待完成事项

### 1. 车位坐标重新测量 🔴 **重要**

当前车位坐标是按比例计算的临时值：
```javascript
PARKING_SLOTS = {
    1: { x: 4.326, y: 1.299 },  // ⚠️ 临时值
    2: { x: 4.907, y: 1.299 }   // ⚠️ 临时值
};
```

**需要做的**:
1. 在 3D 场景中实际测量车位位置
2. 更新 `src/utils/coordinateTransform.js` 中的 `PARKING_SLOTS`
3. 测试 AVP 停车功能是否正常

**测量方法**:
```javascript
// 在浏览器控制台
// 1. 进入位姿选择模式
// 2. 点击车位中心
// 3. 查看控制台输出的坐标
window.__scene3d__.logSandboxInfo()
```

### 2. 路径文件检查 🟡 **可选**

路径文件 (`public/routes/*.txt`) 中的坐标可能需要重新录制，因为：
- 旧路径基于 4.81m × 2.81m 尺寸
- 新沙盘是 6.0m × 5.0m

**检查方法**:
1. 加载现有路径
2. 观察车辆是否沿正确路径行驶
3. 如果路径不合适，使用录制功能重新录制

### 3. 地图图片更新 🟢 **建议**

如果地图图片 (`public/Image/map.jpg`) 是基于旧模型的，建议更新：
1. 截取新模型的俯视图
2. 替换 `map.jpg`
3. 确保 `vehicleToMapPercent()` 转换正确

## 📝 代码修改位置索引

| 文件 | 行数 | 修改内容 |
|------|------|----------|
| `test/test_client.py` | 488-489 | 沙盘尺寸 |
| `test/test_client2.py` | 418-419 | 沙盘尺寸 |
| `test/test_client_high_freq.py` | 489-490 | 沙盘尺寸 |
| `src/utils/coordinateTransform.js` | 7-13 | 坐标系说明 |
| `src/utils/coordinateTransform.js` | 21-26 | SANDBOX_DIMENSIONS |
| `src/utils/coordinateTransform.js` | 32-37 | PARKING_SLOTS（临时值） |
| `src/utils/coordinateTransform.js` | 101-102 | 函数注释 |
| `src/utils/coordinateTransform.js` | 250-258 | 地图转换注释 |
| `src/components/CarButton.vue` | 223-224 | 注释 |
| `src/components/CarButton.vue` | 280 | 注释 |
| `src/components/Scene3D/index.js` | 1471-1533 | 地面检测逻辑 |
| `src/components/Scene3D/index.js` | 2384-2425 | groundPlane 创建 |
| `src/components/Scene3D/index.js` | 520-620 | 调试工具 |
| `PROJECT_GUIDE.md` | 多处 | 文档更新 |
| `GROUND_HEIGHT_TEST.md` | 156 | 示例输出 |

## 🚀 后续步骤

1. **立即测试**:
   ```bash
   # 启动应用
   npm run tauri:dev
   
   # 在另一个终端启动测试客户端
   cd test
   python test_client.py
   ```

2. **验证地面高度**:
   ```javascript
   // 浏览器控制台
   window.__scene3d__.testGroundHeight()
   window.__scene3d__.getSandboxDimensionsInfo()
   ```

3. **重新测量车位坐标**:
   - 使用位姿选择功能点击车位
   - 记录精确坐标
   - 更新 `coordinateTransform.js`

4. **测试所有功能**:
   - ✅ 车辆移动
   - ✅ 初始化位姿
   - ⚠️ AVP 停车（需要新车位坐标）
   - ✅ 打车服务
   - ✅ 施工标记

## 📊 影响范围

### 直接影响 ✅ 已修复
- 车辆坐标转换
- 地面射线检测
- 测试客户端运动范围
- 文档和注释

### 间接影响 ⚠️ 需注意
- 车位坐标（临时值）
- 历史路径文件（可能需要重新录制）
- 地图图片显示（如果使用旧图）

### 不受影响 ✅
- 红绿灯系统
- 车辆模型
- UI 布局
- 通信协议

## 🎯 总结

✅ **已完成**:
- 所有代码中的硬编码尺寸已更新
- 地面高度自动检测并应用
- 测试客户端适配新尺寸
- 文档全面更新

⚠️ **待完成**:
- 车位坐标需要实际测量
- 路径文件可能需要重新录制（可选）
- 地图图片建议更新（可选）

🚀 **下一步**:
1. 启动应用测试基本功能
2. 重新测量并更新车位坐标
3. 根据需要重新录制路径
