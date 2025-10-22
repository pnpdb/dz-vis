# 沙盘模型显示问题诊断指南

## 问题描述
新的 `public/model/final.glb` 模型在软件中显示不出来，但在线网站可以打开。

## 诊断步骤

### 1. 查看控制台调试信息

启动软件后，打开浏览器的开发者工具（F12），查看控制台输出：

```
🔍 沙盘模型调试信息:
  - 位置: Vector3 {x: 0, y: 1.4, z: 0}
  - 缩放: Vector3 {x: 0.01, y: 0.01, z: 0.01}
  - 旋转: Euler {_x: 0, _y: 0, _z: 0}
  - 是否可见: true/false
  - 边界框尺寸: Vector3 {x: ?, y: ?, z: ?}
  - 边界框最小点: Vector3 {x: ?, y: ?, z: ?}
  - 边界框最大点: Vector3 {x: ?, y: ?, z: ?}
  - 网格数量: ?
```

### 2. 常见问题及解决方案

#### 问题1: 模型太小或太大（缩放问题）

**症状**: 
- 边界框尺寸接近0或非常大（如 > 1000）
- 模型加载完成但看不见

**原因**: 新模型的单位和旧模型不同，当前的缩放值 `0.01` 不合适

**解决方案**: 修改 `src/components/Scene3D/index.js` 中的缩放值

找到第426行和第517行，修改 `scale` 值：

```javascript
// 异步加载版本 (第426行)
loadModelAsync(loader, '/model/final.glb', 'final', {
    scale: 0.01,  // ← 修改这里
    position: [0, 1.4, 0],
    ...
})

// 同步加载版本 (第517行)
loadModel(loader, '/model/final.glb', 'final', {
    scale: 0.01,  // ← 修改这里
    position: [0, 1.4, 0],
    ...
})
```

**尝试以下值**:
- 如果边界框太小（< 1）: 尝试 `scale: 0.1` 或 `scale: 1`
- 如果边界框太大（> 100）: 尝试 `scale: 0.001` 或 `scale: 0.0001`
- 理想的边界框尺寸应该在 10-50 之间

#### 问题2: 模型位置不对

**症状**:
- 边界框的最小点/最大点 Y 值为负数或很大
- 模型可能在地下或天上

**原因**: 新模型的中心点和旧模型不同

**解决方案**: 修改 `position` 值

```javascript
loadModelAsync(loader, '/model/final.glb', 'final', {
    scale: 0.01,
    position: [0, 1.4, 0],  // ← 修改这里 [x, y, z]
    ...
})
```

**调整建议**:
- Y 值 (上下): 如果模型在地下，增大 Y 值（如 `2.0`, `3.0`）
- X/Z 值 (水平): 通常保持 `[0, y, 0]` 即可

#### 问题3: 模型不可见（visible = false）

**症状**: 控制台显示 `是否可见: false`

**解决方案**: 这不应该发生，如果发生了，需要检查模型文件本身

#### 问题4: 网格数量为0

**症状**: 控制台显示 `网格数量: 0`

**原因**: 
- 模型文件损坏
- 模型加载失败
- 文件路径错误

**解决方案**:
1. 确认 `public/model/final.glb` 文件存在且完整
2. 尝试重新导出模型文件
3. 检查模型文件在 Blender 或其他工具中是否有实际的网格对象

#### 问题5: 材质问题

**症状**: 模型加载了但显示全黑或透明

**原因**: 材质优化代码可能影响了新模型的材质

**临时解决方案**: 禁用材质优化

```javascript
loadModelAsync(loader, '/model/final.glb', 'final', {
    scale: 0.01,
    position: [0, 1.4, 0],
    processMaterial: false,  // ← 改为 false
    ...
})
```

### 3. 快速测试调整

#### 方法1: 临时调整（在浏览器控制台中）

打开浏览器控制台，输入以下代码来临时调整模型：

```javascript
// 获取沙盘模型
const sandbox = window.scene.children.find(c => c.name === 'final' || c.type === 'Group');

// 调整缩放
sandbox.scale.setScalar(0.1);  // 尝试不同的值

// 调整位置
sandbox.position.y = 2.0;  // 调整高度

// 使模型可见
sandbox.visible = true;
```

#### 方法2: 修改代码（永久调整）

修改 `src/components/Scene3D/index.js` 中的参数后，重新加载页面查看效果。

### 4. 推荐的调试流程

1. **第一步**: 查看控制台的边界框尺寸
   - 如果尺寸 < 1: 模型太小，增大 scale
   - 如果尺寸 > 100: 模型太大，减小 scale
   - 目标: 边界框尺寸在 10-50 之间

2. **第二步**: 检查边界框的 Y 值范围
   - 如果 Y.min < 0: 模型部分在地下，增大 position[1]
   - 如果 Y.min > 5: 模型太高，减小 position[1]

3. **第三步**: 如果还看不见，尝试禁用材质优化
   - 设置 `processMaterial: false`

4. **第四步**: 如果还是不行，检查模型文件
   - 确认网格数量 > 0
   - 尝试用其他GLB查看器打开文件

### 5. 常用的缩放参考值

不同建模软件导出的模型单位可能不同：

| 建模软件 | 单位 | 推荐的 scale 值 |
|---------|------|----------------|
| Blender (米) | 1 unit = 1m | 0.01 - 0.1 |
| Blender (厘米) | 1 unit = 1cm | 0.1 - 1.0 |
| 3ds Max (米) | 1 unit = 1m | 0.01 - 0.1 |
| SketchUp | 1 unit = 1cm | 0.1 - 1.0 |

## 需要的话，可以在控制台查看完整的场景信息

```javascript
// 查看场景中所有对象
console.log(window.scene.children);

// 查看所有加载的模型
console.log(window.models);

// 查看相机位置
console.log(window.camera.position);
```

## 联系开发者

如果以上方法都不能解决问题，请提供：
1. 控制台的完整调试信息截图
2. 新模型的边界框信息
3. 模型文件的来源和制作软件

