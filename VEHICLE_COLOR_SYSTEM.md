# 🎨 车辆颜色系统实现说明

## 功能概述

为每辆连接的车辆设置不同的颜色，包括：
- **轮子**（4个）：统一黑色 `#1a1a1a`
- **激光雷达面板**：深灰色 `#2a2a2a`
- **激光发射头**：稍浅灰色 `#3a3a3a`
- **车壳**：使用每个车辆在设置中分配的自定义颜色

## 实现原理

### 1. 模型结构
根据 Blender 分析，car.glb 包含 7 个部件：

| 部件 | 对象名 | 材质名 | 颜色设置 |
|------|--------|--------|----------|
| 轮子1 | empty_2 / Mesh_0 | Material_0 | 黑色 |
| 轮子2 | empty_3 / Mesh_1 | Material_1 | 黑色 |
| 轮子3 | empty_4 / Mesh_2 | Material_2 | 黑色 |
| 轮子4 | empty_5 / Mesh_3 | Material_3 | 黑色 |
| 车壳 | empty_6 / Mesh_4 | Material_4 | **自定义颜色** |
| 激光雷达面板 | empty_7 / Mesh_5 | Material_5 | 深灰色 |
| 激光发射头 | empty_8 / Mesh_6 | Material_6 | 稍浅灰色 |

---

## 代码实现

### 修改文件 1：`src/components/Scene3D/vehicleManager.js`

#### 1.1 导入 `MeshStandardMaterial`
```javascript
import { MeshStandardMaterial } from 'three';
```

#### 1.2 新增函数：`applyVehicleColors`
```javascript
const applyVehicleColors = (clonedModel, bodyColor) => {
    // 定义固定颜色
    const WHEEL_COLOR = '#1a1a1a';
    const LIDAR_PANEL_COLOR = '#2a2a2a';
    const LIDAR_HEAD_COLOR = '#3a3a3a';
    
    // 遍历模型树，为每个 Mesh 克隆材质并设置颜色
    clonedModel.traverse((child) => {
        if (child.isMesh && child.material) {
            // 🔑 关键：克隆材质，避免多个车辆共享同一个材质对象
            const newMaterial = child.material.clone();
            
            // 根据材质名称判断部件类型并设置颜色
            if (materialName.includes('material_0') || 
                materialName.includes('material_1') || 
                materialName.includes('material_2') || 
                materialName.includes('material_3')) {
                newMaterial.color = new Color(WHEEL_COLOR);
            } 
            else if (materialName.includes('material_4')) {
                newMaterial.color = new Color(bodyColor); // 自定义颜色
            }
            // ... 其他部件
            
            child.material = newMaterial;
        }
    });
};
```

#### 1.3 在 `addVehicle` 中调用
```javascript
export const addVehicle = async (vehicleId, position, orientation = 0, color = '#409EFF') => {
    // ... 克隆模型
    const carMesh = carModelTemplate.clone();
    
    // 🎨 设置颜色（在添加到场景前）
    applyVehicleColors(carMesh, color);
    
    // ... 添加到场景
};
```

#### 1.4 暴露 `vehicleModels` 供调试
```javascript
if (typeof window !== 'undefined') {
    window.__vehicleModels = vehicleModels;
}
```

---

### 修改文件 2：`src/views/Map.vue`

#### 2.1 从 carStore 获取车辆颜色
```javascript
const handleVehicleStateUpdate = (vehicleInfo) => {
    const { vehicleId, position, orientation } = vehicleInfo;
    
    if (hasVehicle(vehicleId)) {
        updateVehiclePosition(vehicleId, position, orientation);
    } else {
        // 🎨 从 carStore 获取车辆的自定义颜色
        const vehicleData = carStore.carList.find(car => car.id === vehicleId);
        const vehicleColor = vehicleData?.color || '#409EFF'; // 默认蓝色
        
        addVehicle(vehicleId, position, orientation, vehicleColor);
    }
};
```

---

## 性能优化

### 1. **材质克隆**
每个车辆都克隆一份独立的材质，避免共享导致颜色互相影响。

```javascript
const newMaterial = originalMaterial.clone();
```

**内存开销**：每个材质 ~1KB，7个部件 = 7KB/车辆
- 10辆车：70KB
- 100辆车：700KB（可接受）

### 2. **只在添加时设置一次**
颜色在车辆添加到场景时设置一次，之后不再修改，避免运行时开销。

### 3. **无纹理贴图**
car.glb 是纯色模型（无贴图），只需修改 `material.color`，性能开销极小。

---

## 调试工具

### 1. 分析模型结构
将 `analyze-car-model.js` 的内容复制到浏览器控制台运行：

```javascript
// 自动分析第一辆车的模型结构
window.__analyzeCarModel();
```

### 2. 检查车辆状态
```javascript
// 查看所有车辆
window.__debugVehicles();

// 访问车辆模型
const vehicleModels = window.__vehicleModels;
vehicleModels.forEach((model, id) => {
    console.log(`车辆 ${id}:`, model);
});
```

---

## 颜色配置

### 当前颜色方案
| 部件 | 颜色 | 说明 |
|------|------|------|
| 轮子 | `#1a1a1a` | 深黑色，接近真实轮胎 |
| 车壳 | 自定义 | 从设置中获取（如 `#409EFF`） |
| 激光雷达面板 | `#2a2a2a` | 深灰色 |
| 激光发射头 | `#3a3a3a` | 稍浅灰色 |

### 如何修改颜色
在 `vehicleManager.js` 的 `applyVehicleColors` 函数中修改：

```javascript
const WHEEL_COLOR = '#1a1a1a';        // 修改轮子颜色
const LIDAR_PANEL_COLOR = '#2a2a2a';  // 修改雷达面板颜色
const LIDAR_HEAD_COLOR = '#3a3a3a';   // 修改发射头颜色
```

---

## 测试步骤

### 1. 连接多辆车
```bash
# 终端1
python test/test_client.py

# 终端2  
python test/test_client_high_freq.py
```

### 2. 在设置中为每辆车分配不同颜色
- 车辆1：蓝色 `#409EFF`
- 车辆2：绿色 `#67C23A`
- 车辆3：橙色 `#E6A23C`

### 3. 观察效果
- ✅ 每辆车的车壳应该是不同颜色
- ✅ 所有车的轮子都是黑色
- ✅ 激光雷达部件都是深灰色
- ✅ 车辆断开重连后颜色保持一致

### 4. 验证材质独立性
打开浏览器控制台，检查材质是否被正确克隆：

```javascript
const models = window.__vehicleModels;
const car1 = models.get(1);
const car2 = models.get(2);

// 获取车壳的材质
let car1BodyMaterial, car2BodyMaterial;
car1.traverse(child => {
    if (child.material?.name?.includes('Material_4')) {
        car1BodyMaterial = child.material;
    }
});
car2.traverse(child => {
    if (child.material?.name?.includes('Material_4')) {
        car2BodyMaterial = child.material;
    }
});

// 检查材质是否不同
console.log('车1材质:', car1BodyMaterial);
console.log('车2材质:', car2BodyMaterial);
console.log('材质是否独立:', car1BodyMaterial !== car2BodyMaterial); // 应该是 true
```

---

## 潜在问题与解决方案

### 问题1：颜色设置不生效
**原因**：材质名称与预期不符

**解决方案**：
1. 运行 `analyze-car-model.js` 查看实际的材质名称
2. 修改 `applyVehicleColors` 中的条件判断

### 问题2：所有车辆颜色相同
**原因**：材质没有被正确克隆，共享了同一个材质对象

**解决方案**：
检查 `material.clone()` 是否被正确调用，确保每个车辆有独立材质。

### 问题3：性能下降
**原因**：材质克隆导致内存增加

**解决方案**：
- 限制同时在线车辆数量（已实现：50辆上限）
- 车辆断开时正确释放材质（已实现：`disposeObject3D`）

---

## 内存管理

### 材质清理
车辆模型删除时，`disposeObject3D` 会递归清理所有材质：

```javascript
// resourceCleanup.js 中的实现
if (object.material) {
    object.material.dispose(); // ✅ 释放材质内存
}
```

### 内存占用估算
| 项目 | 单车占用 | 10辆车 | 50辆车 |
|------|----------|--------|--------|
| 模型几何体 | ~2MB | 20MB | 100MB |
| 材质（7个） | ~7KB | 70KB | 350KB |
| 纹理（标签） | ~50KB | 500KB | 2.5MB |
| **总计** | ~2.06MB | ~21MB | ~103MB |

---

**实现日期**: 2025-11-03  
**涉及文件**: 
- `src/components/Scene3D/vehicleManager.js`
- `src/views/Map.vue`
- `analyze-car-model.js` (调试工具)

**状态**: ✅ 实现完成，待测试验证

