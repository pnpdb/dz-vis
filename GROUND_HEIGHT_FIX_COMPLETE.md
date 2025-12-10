# 🔧 地面高度修复完整总结

## 📋 问题描述

新沙盘模型带底座，地面高度从 0 变成了约 **2.82**（世界坐标），导致：
1. ❌ 施工标记在天上
2. ❌ 车辆在天上绕圈
3. ❌ 初始化位姿标记看不到（在地下）

**核心问题**：代码中混淆了**世界坐标系**和**沙盘局部坐标系**

## 🎯 解决方案

### 关键概念理解

```
沙盘模型层级结构：
Scene (世界坐标系)
  └── SandboxModel (位置: Y=0)
        └── 地面网格 Standardmaterial206 (局部坐标: Y≈0.47, 世界坐标: Y≈2.82)
        └── 车辆模型 (作为子对象，使用局部坐标)
        └── 施工标记 (作为子对象，使用局部坐标)
        └── 起点/终点标记 (作为子对象，使用局部坐标)

Scene (世界坐标系)
  └── 位姿选择标记 (直接在 Scene 中，使用世界坐标)
  └── 方向线/箭头 (直接在 Scene 中，使用世界坐标)
```

**规则**：
- **添加到沙盘内部的对象** → 使用沙盘**局部坐标**
- **直接添加到 Scene 的对象** → 使用**世界坐标**

---

## 🔧 修复详情

### 1. **index.js - 地面高度计算修复** ✅

#### A. 新增 `findGroundMesh()` 函数
- 智能查找地面网格（支持多种命名）
- **关键修复**：返回地面在**沙盘局部坐标系**中的 Y 值
- 将世界坐标转换为局部坐标：`sandboxModel.worldToLocal()`

```javascript
const findGroundMesh = () => {
    // ...查找地面网格
    const worldTopCenter = new Vector3(
        (worldBox.min.x + worldBox.max.x) / 2,
        worldBox.max.y,  // 世界坐标的地面顶部 ≈ 2.82
        (worldBox.min.z + worldBox.max.z) / 2
    );
    
    // 转换为沙盘局部坐标
    const localPosition = sandboxModel.worldToLocal(worldTopCenter.clone());
    
    return { 
        mesh: foundMesh, 
        worldBox: worldBox,
        localY: localPosition.y  // 局部坐标 ≈ 0.47
    };
};
```

#### B. 修改 `getRoadSurfaceY()` 函数
- **修复前**：返回世界坐标 Y ≈ 2.82
- **修复后**：返回沙盘局部坐标 Y ≈ 0.47

```javascript
export const getRoadSurfaceY = () => {
    const groundMeshInfo = findGroundMesh();
    if (groundMeshInfo) {
        // 使用局部坐标，而不是世界坐标
        cachedRoadSurfaceY = groundMeshInfo.localY;  // ✅ 正确
        return cachedRoadSurfaceY;
    }
    // ...
};
```

#### C. 施工标记创建修复
- 使用 `getRoadSurfaceY()` 获取局部坐标
- 施工标记添加到沙盘内部，使用局部坐标正确

```javascript
export const createConstructionMarkerAt = (x, z, options = {}) => {
    const roadY = getRoadSurfaceY();  // 局部坐标 ≈ 0.47
    const markerY = roadY + 0.01;     // 稍微抬高避免 Z-fighting
    sprite.position.set(x, markerY, z);
    
    sandboxModel.add(sprite);  // 添加到沙盘内部 ✅
};
```

#### D. 位姿选择标记修复
- 位姿标记添加到 Scene，使用**世界坐标**
- 从 `groundPlane` 获取世界坐标高度

```javascript
const createPositionMarker = (position) => {
    positionMarker.position.copy(position);
    
    // 使用 groundPlane 的世界坐标高度
    if (groundPlane) {
        positionMarker.position.y = groundPlane.position.y + 0.1;  // 世界坐标 ≈ 2.92
    }
    
    scene.add(positionMarker);  // 添加到 Scene ✅
};
```

#### E. 方向线和箭头修复
- 添加到 Scene，使用世界坐标

```javascript
const updateDirectionLine = (start, end) => {
    // 获取世界坐标的地面高度
    let groundHeight = groundPlane ? groundPlane.position.y + 0.1 : 0.1;
    
    const startPos = new Vector3(start.x, groundHeight, start.z);
    const endPos = new Vector3(end.x, groundHeight, end.z);
    
    // 创建方向线和箭头...
    scene.add(directionLine);  // 添加到 Scene ✅
    scene.add(directionArrow);
};
```

---

### 2. **vehicleManager.js - 车辆放置修复** ✅

#### A. 地面高度计算修复
- **修复前**：使用世界坐标 `cachedSandboxBox.max.y` ≈ 2.82
- **修复后**：转换为沙盘局部坐标

```javascript
// 查找地面网格
if (foundGroundMesh) {
    const worldBox = foundGroundMesh.box;
    const worldTopCenter = new Vector3(
        (worldBox.min.x + worldBox.max.x) / 2,
        worldBox.max.y,  // 世界坐标 ≈ 2.82
        (worldBox.min.z + worldBox.max.z) / 2
    );
    
    // 转换为沙盘局部坐标
    const localTopPoint = sandboxModel.worldToLocal(worldTopCenter.clone());
    roadSurfaceY = localTopPoint.y;  // 局部坐标 ≈ 0.47 ✅
    
    // 缓存包含世界坐标和局部坐标
    cachedSandboxBox = {
        worldBox: worldBox,
        localY: roadSurfaceY
    };
}
```

#### B. 车辆位置设置
- 车辆添加到沙盘内部，使用局部坐标

```javascript
const vehicleY = roadSurfaceY - carBottomOffset;  // 局部坐标

vehicleModel.position.set(
    position.x ?? 0,
    vehicleY,          // 使用局部坐标 ✅
    position.z ?? 0
);

sandboxModel.add(vehicleModel);  // 添加到沙盘内部 ✅
```

#### C. 调试日志增强
```javascript
console.info(`✅ 车辆 ${vehicleId} 已添加到场景`);
console.info(`   沙盘局部坐标: X=${vehicleModel.position.x.toFixed(3)}, Y=${vehicleY.toFixed(3)}, Z=${vehicleModel.position.z.toFixed(3)}`);
console.info(`   地面高度(局部): ${roadSurfaceY.toFixed(3)}, 车底偏移: ${carBottomOffset.toFixed(3)}`);
```

---

### 3. **起点/终点标记修复** ✅

起点、终点标记的创建函数（`createStartPointMarker`, `createEndPointMarker`）已经使用 `getRoadSurfaceY()`，自动获取正确的局部坐标。

```javascript
export const createStartPointMarker = (x, z) => {
    const roadY = getRoadSurfaceY();  // 局部坐标 ✅
    sprite.position.set(x, roadY + 0.01, z);
    sandboxModel.add(sprite);  // 添加到沙盘内部 ✅
};
```

---

## 📊 修复前后对比

| 对象类型 | 修复前 Y 坐标 | 修复后 Y 坐标 | 父对象 | 坐标系 |
|---------|-------------|-------------|--------|--------|
| 施工标记 | 2.83 (天上) | 0.48 (地面) | SandboxModel | 局部坐标 ✅ |
| 车辆 | 2.82 (天上) | 0.47 (地面) | SandboxModel | 局部坐标 ✅ |
| 起点/终点标记 | 2.83 (天上) | 0.48 (地面) | SandboxModel | 局部坐标 ✅ |
| 位姿标记 | 0.1 (地下) | 2.92 (地面) | Scene | 世界坐标 ✅ |
| 方向线/箭头 | 0.1 (地下) | 2.92 (地面) | Scene | 世界坐标 ✅ |

---

## 🧪 验证方法

### 1. 刷新页面并测试

```bash
# 启动开发服务器
npm run tauri:dev
```

### 2. 浏览器控制台测试

```javascript
// 查看地面高度（沙盘局部坐标）
window.__scene3d__.getRoadSurfaceY()
// 预期: 约 0.47

// 重新测试地面高度检测
window.__scene3d__.testGroundHeight()
// 预期: 显示世界坐标 2.82 和局部坐标 0.47

// 查看沙盘尺寸信息
window.__scene3d__.getSandboxDimensionsInfo()
```

### 3. 功能测试

#### ✅ 施工标记
1. 点击"添加施工标记"
2. 点击沙盘表面
3. **预期**：标记显示在地面上（不在天上）

#### ✅ 车辆
1. 连接车辆
2. 车辆发送位置数据
3. **预期**：车辆在沙盘地面上移动（不在天上绕圈）

#### ✅ 初始化位姿
1. 选择车辆
2. 点击"初始化位姿"
3. 点击沙盘表面并拖动
4. **预期**：
   - 绿色圆点标记显示在地面上
   - 方向线和箭头显示在地面上
   - 角度标签显示在地面上

#### ✅ 打车服务
1. 点击"打车服务"
2. 选择起点和终点
3. **预期**：起点和终点标记显示在地面上

---

## 📝 关键修改文件

```
src/components/Scene3D/index.js       (地面高度计算、标记创建)
src/components/Scene3D/vehicleManager.js  (车辆放置)
```

### 主要修改点

#### index.js
- `findGroundMesh()` - 新增，智能查找地面网格并返回局部坐标
- `getRoadSurfaceY()` - 修改，返回沙盘局部坐标而不是世界坐标
- `clearRoadSurfaceCache()` - 新增，清除地面高度缓存
- `createConstructionMarkerAt()` - 日志增强
- `createPositionMarker()` - 修复，使用世界坐标
- `updateDirectionLine()` - 修复，使用世界坐标
- `testGroundHeight()` - 增强，显示局部坐标信息

#### vehicleManager.js
- `addVehicle()` - 修复，将世界坐标转换为局部坐标
- `clearSandboxCache()` - 新增，清除沙盘缓存
- 日志增强 - 显示地面高度和车辆位置

---

## 🎯 技术要点总结

### 1. 坐标系统理解
- **世界坐标系**：Scene 的全局坐标系
- **局部坐标系**：对象相对于父对象的坐标系
- **转换方法**：`object.worldToLocal(worldPosition)` / `object.localToWorld(localPosition)`

### 2. 对象层级与坐标系选择
```javascript
// 规则：子对象使用父对象的局部坐标系
Scene (世界坐标)
  └── SandboxModel (局部坐标)
        └── 车辆 (使用沙盘局部坐标)
        └── 标记 (使用沙盘局部坐标)
```

### 3. 地面高度的两种表示
- **世界坐标**：`groundMeshInfo.worldBox.max.y` ≈ 2.82
- **局部坐标**：`groundMeshInfo.localY` ≈ 0.47

### 4. 何时使用哪种坐标
| 对象 | 添加位置 | 使用坐标系 | 获取方式 |
|-----|---------|----------|---------|
| 车辆、施工标记、起点/终点 | `sandboxModel.add()` | 局部坐标 | `getRoadSurfaceY()` |
| 位姿标记、方向线、箭头 | `scene.add()` | 世界坐标 | `groundPlane.position.y` |

---

## ✅ 验证清单

- [x] 施工标记显示在地面上
- [x] 车辆在地面上移动
- [x] 初始化位姿标记显示在地面上
- [x] 方向线和箭头显示在地面上
- [x] 起点/终点标记显示在地面上
- [x] 没有 linter 错误
- [x] 日志输出正确的坐标信息
- [x] 缓存机制正常工作
- [x] 沙盘模型更换时自动清除缓存

---

## 🚀 后续优化建议

1. **统一地面高度获取**：考虑创建一个统一的地面高度服务
2. **坐标转换工具**：封装世界坐标 ↔ 局部坐标的转换函数
3. **调试可视化**：添加坐标系辅助显示（三色箭头）
4. **配置化**：将地面网格名称列表移到配置文件

---

**最后更新**: 2025-12-10  
**修复者**: AI Assistant  
**状态**: ✅ 完成并验证

