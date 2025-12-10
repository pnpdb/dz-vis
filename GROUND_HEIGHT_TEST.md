# 地面高度测试指南

## 问题背景

新的 `sandbox.glb` 模型相比之前的模型：
- 底座变高了，地面高度不同
- 没有了 `MD_CaoPing`（草坪）参照物
- 使用 `Standardmaterial206` 作为新的地面参照物

## 已完成的修改

### 1. 修改地面检测逻辑 (`src/components/Scene3D/index.js`)

**位置**: 第 1471-1507 行

**改动**:
- 优先查找 `Standardmaterial206` 作为地面参照
- 保留 `MD_CaoPing` 作为备用（兼容旧模型）
- 如果都没找到，则查找最大的水平网格

```javascript
// 优先查找 Standardmaterial206（新模型）
if (child.name && child.name.includes('Standardmaterial206')) {
    // ... 找到并使用
}
// 备用：查找 MD_CaoPing（旧模型）
else if (child.name && child.name.includes('CaoPing')) {
    // ... 找到并使用
}
```

### 2. 获取并存储地面高度

**位置**: 第 1514-1533 行

**改动**:
- 计算地面的 Y 坐标高度（使用包围盒的 max.y）
- 存储到 `dimensions.ground.yPosition`
- 打印地面高度信息到控制台

```javascript
let groundYPosition = 0; // 地面的Y坐标高度

if (groundMesh) {
    groundBox = new Box3().setFromObject(groundMesh);
    groundYPosition = groundBox.max.y; // 使用包围盒顶部作为地面高度
    
    console.log('📍 地面高度信息:', {
        name: groundName,
        yMin: groundBox.min.y.toFixed(4),
        yMax: groundBox.max.y.toFixed(4),
        groundHeight: groundYPosition.toFixed(4)
    });
}
```

### 3. 应用地面高度到射线检测平面

**位置**: 第 2384-2425 行（`createGroundPlane` 函数）

**改动**:
- 使用实际的地面高度，而不是硬编码的 0
- 从 `dimensions.ground.yPosition` 获取高度
- 打印创建的地面平面信息

```javascript
// 使用实际的地面高度（如果有的话），否则默认为0
const groundY = dimensions.ground.found ? dimensions.ground.yPosition : 0;

groundPlane.position.set(centerX, groundY, centerZ); // 使用实际地面高度
```

### 4. 添加调试测试函数

**位置**: 第 520-620 行（`window.__scene3d__` 调试对象）

**新增功能**: `testGroundHeight()` 函数

这个函数会：
- 查找所有包含 `Standardmaterial206` 的网格
- 显示详细的位置、尺寸、高度信息
- 自动选择面积最大的作为地面
- 如果找不到，列出所有网格名称供参考

## 测试方法

### 步骤 1: 启动应用

```bash
npm run tauri:dev
```

### 步骤 2: 打开浏览器开发者工具

按 `F12` 或右键选择 "检查"

### 步骤 3: 在控制台执行测试命令

```javascript
// 测试地面高度（查找 Standardmaterial206）
window.__scene3d__.testGroundHeight()
```

### 预期输出

如果找到 `Standardmaterial206`，会显示：

```
🔍 测试地面高度 - 查找 Standardmaterial206
================================================================================
✅ 找到 1 个匹配的地面网格

[1] Standardmaterial206
  📍 局部坐标: X=0.0000 Y=0.0000 Z=0.0000
  🌍 世界坐标: X=0.0000 Y=0.5000 Z=0.0000  ← 这是地面高度
  📐 尺寸: X=28.860 Y=0.010 Z=16.860
  📦 Y范围: 0.4950 ~ 0.5050                ← 这是地面的Y范围
  📏 面积: 486.500

================================================================================
🎯 选定的地面网格 (面积最大):
  名称: Standardmaterial206
  地面高度(Y max): 0.5050                  ← 这个值会被用于 groundPlane
  地面底部(Y min): 0.4950
================================================================================

💡 提示: 地面高度已自动应用到射线检测平面 (groundPlane)
   可以使用 getSandboxDimensionsInfo() 查看完整信息
```

如果**没有**找到，会列出所有网格名称：

```
❌ 未找到包含 "Standardmaterial206" 的网格

🔍 尝试列出所有网格名称:
  - Mesh001
  - Mesh002
  - Ground
  - Floor
  ...
```

### 步骤 4: 查看完整的沙盘尺寸信息

```javascript
// 查看沙盘尺寸和地面信息
window.__scene3d__.getSandboxDimensionsInfo()
```

输出示例：

```javascript
{
  scaled: { width: 36.0, height: 5.2, depth: 30.0 },
  original: { width: 6.0, height: 0.867, depth: 5.0 },
  center: { x: 0, y: 2.5, z: 0 },
  bounds: {
    min: { x: -18.0, y: 0, z: -15.0 },
    max: { x: 18.0, y: 5.2, z: 15.0 }
  },
  ground: {
    name: "Standardmaterial206",
    found: true,
    yPosition: 2.8236  // ← 这是地面高度（新模型实际值）
  },
  scale: 6
}
```

## 其他有用的调试命令

```javascript
// 查看所有网格的详细分析
window.__scene3d__.analyzeSandboxMeshes()

// 查看沙盘和车辆对齐信息
window.__scene3d__.logAlignmentInfo()

// 查看沙盘基本信息
window.__scene3d__.logSandboxInfo()
```

## 验证地面高度是否生效

### 方法 1: 查看控制台日志

在应用加载时，会自动打印：

```
🌿 地面基准: Standardmaterial206 ✅
   📍 地面高度(Y): 0.5050 单位
```

### 方法 2: 测试点击交互

1. 进入位姿选择模式（点击"初始化位姿"按钮）
2. 点击沙盘表面
3. 查看控制台的 groundPlane 创建日志：

```
🎯 地面检测平面已创建: {
  center: { x: 0, y: 0.505, z: 0 },  ← Y坐标应该是地面高度，不是0
  size: { width: 43.29, depth: 25.29 },
  groundReference: "Standardmaterial206"
}
```

### 方法 3: 检查车辆是否贴合地面

车辆应该正好停在地面上，而不是悬空或穿模。

## 故障排查

### 问题 1: 找不到 Standardmaterial206

**解决方案**:
1. 执行 `window.__scene3d__.testGroundHeight()` 查看所有网格名称
2. 如果名称不完全匹配，修改代码中的搜索关键字
3. 或者使用 `analyzeSandboxMeshes()` 找到最大的水平网格

### 问题 2: 地面高度看起来不对

**解决方案**:
1. 使用 `testGroundHeight()` 查看包围盒的 Y 范围
2. 可能需要使用 `yMin` 而不是 `yMax`
3. 修改代码第 1527 行：
   ```javascript
   // 如果需要使用底部而不是顶部
   groundYPosition = groundBox.min.y; 
   ```

### 问题 3: 车辆悬空或穿模

**解决方案**:
1. 检查车辆模型的 Y 偏移
2. 使用 `window.__scene3d__.adjustCarPosition(0, Y, 0)` 微调
3. 检查车辆模型的锚点位置

## 代码修改位置总结

| 文件 | 行数 | 修改内容 |
|------|------|----------|
| `src/components/Scene3D/index.js` | 1471-1507 | 查找 Standardmaterial206 地面网格 |
| `src/components/Scene3D/index.js` | 1514-1533 | 获取并存储地面高度 |
| `src/components/Scene3D/index.js` | 1582-1585 | 在 dimensions 中添加 ground.yPosition |
| `src/components/Scene3D/index.js` | 1598-1600 | 打印地面高度日志 |
| `src/components/Scene3D/index.js` | 2384-2425 | 使用实际地面高度创建 groundPlane |
| `src/components/Scene3D/index.js` | 520-620 | 添加 testGroundHeight() 调试函数 |

## 总结

✅ 代码已修改为自动检测 `Standardmaterial206` 地面
✅ 地面高度会自动应用到射线检测平面
✅ 提供了完整的调试工具进行测试
✅ 兼容旧模型（如果找不到新地面，会尝试查找 CaoPing）

现在只需：
1. 启动应用
2. 打开控制台
3. 运行 `window.__scene3d__.testGroundHeight()`
4. 检查输出是否正确

如果找到了 Standardmaterial206 并显示了正确的高度，说明修改成功！
