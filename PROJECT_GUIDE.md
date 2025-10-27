# DZ-VIZ 项目技术指南

## 📋 项目概述

DZ-VIZ 是一个基于 **Tauri + Vue 3 + Three.js** 的自动驾驶车辆可视化管理系统。该系统通过 3D 沙盘实时展示多辆自动驾驶车辆的位置、状态和行为，支持车辆控制、路径规划、施工标记等功能。

### 核心功能
- 🚗 多车辆实时 3D 可视化
- 📡 基于 UDP Socket 的车辆通信
- 🎯 车位选择和 AVP 自主代客泊车
- 🚕 打车服务（选择起点/终点）
- 🚧 施工标记管理
- 📊 车辆状态监控和统计
- ⚙️ 车辆连接配置管理

---

## ✨ 最近更新 (2025-10-27)

### 1. 平行驾驶界面优化

**位置地图显示优化**（`src/views/ParallelDriving.vue`）：
```vue
<!-- 地图容器使用 aspect-ratio 保持图片比例 -->
<div class="map-background">
  <img 
    src="/Image/map.jpg" 
    class="map-image" 
    style="object-fit: contain"  <!-- 按比例缩放，不变形 -->
  />
  <div 
    class="position-dot" 
    :style="{ left: vehiclePosition.x + '%', top: vehiclePosition.y + '%' }"
  />
</div>

<style>
/* 关键CSS：使用aspect-ratio确保容器按图片比例缩放 */
.map-background {
  position: relative;
  width: 100%;
  aspect-ratio: 481 / 281;  /* 地图图片的宽高比 */
  max-height: 100%;
  overflow: hidden;
  border-radius: 4px;
}

.map-image {
  width: 100%;
  height: 100%;
  object-fit: contain;  /* 按比例填充，不裁剪 */
}

/* 使用百分比定位红点，确保坐标准确 */
.position-dot {
  position: absolute;
  width: 8px;
  height: 8px;
  background: red;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
</style>
```

**关键要点**：
- 使用 `aspect-ratio` 而不是固定高度，确保图片按比例缩放
- `object-fit: contain` 保证图片不会变形
- 百分比定位红点，与坐标转换函数配合使用
- 地图容器垂直居中：`.minimap { justify-content: center }`

### 2. CardWithBorder 通用组件

**新增组件**（`src/components/CardWithBorder.vue`）：
```vue
<template>
  <CardWithBorder :custom-class="'my-panel'" :custom-style="{ width: '300px' }">
    <h3>标题</h3>
    <p>内容...</p>
  </CardWithBorder>
</template>

<script setup>
import CardWithBorder from '@/components/CardWithBorder.vue';
</script>
```

**特性**：
- 统一的深蓝色背景 + 青色边框样式
- 支持自定义class和style
- 使用slot插槽，灵活组合内容
- 自动处理事件穿透（`pointer-events`）

---

## 🛠️ 技术栈

### 前端
- **框架**: Vue 3 (Composition API)
- **UI 库**: Element Plus
- **3D 引擎**: Three.js (r158+)
- **图标**: Font Awesome 6 (Web Fonts 模式)
- **状态管理**: Pinia
- **样式**: SCSS

### 后端 (Rust - Tauri)
- **框架**: Tauri 2.x
- **数据库**: SQLite (sqlx)
- **网络**: tokio UDP socket
- **序列化**: serde, serde_json
- **日志**: log, env_logger

### 开发工具
- **包管理**: npm (前端), cargo (后端)
- **构建工具**: Vite
- **模型格式**: GLB (GLTF Binary)
- **压缩**: Draco (离线解码器)

---

## 🧭 快速进入新会话（当前进度与已知问题）

> 本小节帮助你在新会话中快速同步上下文并继续推进。

### A. Toast 通知系统 ✅ **已完成自定义实现** (2025-10-27)

- **问题**：Element Plus 的 `ElMessage` 在 Ubuntu WebKitGTK 下存在兼容性问题（icon不显示、背景色异常）
- **解决方案**：实现了完全自定义的 Toast 系统，完全替代 Element Plus Message

- **核心实现**（`src/utils/toast.js`）：
  ```javascript
  // 1. 对象池优化（减少DOM创建/销毁）
  const toastPool = [];
  const MAX_POOL_SIZE = 5;
  
  function getToastFromPool() {
    return toastPool.length > 0 ? toastPool.pop() : document.createElement('div');
  }
  
  function returnToastToPool(toast) {
    toast.className = '';
    toast.style.cssText = '';
    toast.innerHTML = '';
    if (toastPool.length < MAX_POOL_SIZE) {
      toastPool.push(toast);
    }
  }
  
  // 2. Vue插件化
  Toast.install = (app) => {
    app.config.globalProperties.$toast = Toast;
    app.provide('toast', Toast);
  };
  // 可以在main.js中: app.use(Toast)
  
  // 3. 内存泄漏修复
  if (toastContainer && toastContainer.children.length === 0) {
    if (toastContainer.parentNode) {
      toastContainer.parentNode.removeChild(toastContainer);
    }
    toastContainer = null;
  }
  ```

- **使用方式**：
  ```javascript
  import Toast from '@/utils/toast.js';
  
  Toast.success('操作成功');
  Toast.warning('当前车辆离线');
  Toast.error('操作失败');
  Toast.info('提示信息');
  ```

- **跨平台兼容**：
  - 使用纯CSS和JavaScript实现
  - 所有样式使用 `!important` 确保优先级
  - 使用 `rgb()` 颜色替代 `rgba()`（避免WebKitGTK渲染问题）
  - 移除 `backdrop-filter`（Ubuntu不兼容）

### B. 3D 红绿灯倒计时 ✅ **已解决** (2025-10-27)

- **最终实现**：使用 `CanvasTexture + emissiveMap` 直接驱动原模型数字区域（性能最佳）。
- **模型更新**（2025-10-27）：
  - 倒计时区域名称：`MD_HongLvDeng_WenZi` → `MD_HongLvDeng_Hui`
  - 后缀格式：空格+括号 ` (1)` → 下划线+括号 `_(1)`
  - 组结构：保留 `MD_HongLvDeng_Zu1` ~ `MD_HongLvDeng_Zu8`
  - 已移除装饰性的"88"数字

- **关键技术细节**：
  ```javascript
  // 文件：src/components/Scene3D/trafficLightManager.js
  
  // 1. 红绿灯分组（重要！）
  const TRAFFIC_LIGHT_GROUPS = {
    GROUP_2: [0, 2],  // Zu1, Zu3 - 2组（2个红绿灯）
    GROUP_1: [1, 3, 4, 5, 6, 7]  // Zu2, Zu4-Zu8 - 1组（6个红绿灯）
  };
  
  // 2. 命名规则
  // Zu1 (索引0): 无后缀
  //   - MD_HongLvDeng_Hong, MD_HongLvDeng_Huang, MD_HongLvDeng_Lv, MD_HongLvDeng_Hui
  // Zu2-Zu8 (索引1-7): 使用 _(N) 后缀
  //   - MD_HongLvDeng_Hong_(1), MD_HongLvDeng_Huang_(1), ...
  
  // 3. Canvas纹理翻转（修正UV坐标系差异）
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(1, -1);  // 只垂直翻转，不水平翻转
  ctx.fillText(text, 0, 0);
  ctx.restore();
  
  // 4. 材质配置（暗色背景 + 亮色数字）
  material.color.setHex(0x323232);      // 深灰色背景（可调整）
  material.emissive.setHex(0xffffff);   // 白色发光（让数字显示彩色）
  material.emissiveIntensity = 1;
  
  // 5. 数字颜色（根据灯状态）
  // 红灯：#ff0000, 绿灯：#00ff00, 黄灯：#ffff00
  ```

- **诊断工具**：
  - `scripts/check_countdown_uv.js` - UV映射检查（已更新）
  - `scripts/debug_traffic_light_names.js` - 对象名称调试
  
- **可调参数**（`trafficLightManager.js` 顶部）：
  - `COUNTDOWN_CANVAS_SIZE` - Canvas尺寸（默认512）
  - `COUNTDOWN_FONT_SIZE` - 字体大小（默认320）
  - `LIGHT_ON_INTENSITY` - 灯光强度（默认3）
  - `COUNTDOWN_ON_INTENSITY` - 数字发光强度（默认5）
  - 倒计时背景颜色：第131行 `material.color.setHex(0x??????)`

---

## 🎯 核心概念：坐标系统（重要！）

### 1. 车辆坐标系统（用户视角）
这是车辆发送的原始坐标系统，也是用户配置和显示使用的坐标系统。

```
特点：
- 原点：左下角
- X 轴：向右（正方向），范围 0 ~ 4.81m
- Y 轴：向上（正方向），范围 0 ~ 2.81m
- 朝向角度：X 轴正方向为 0 弧度
  - 逆时针旋转为正（0 到 π）
  - 顺时针旋转为负（-π 到 0）

车位坐标（硬编码在 coordinateTransform.js）：
- 1号车位：X: 3.46875m, Y: 0.72991m
- 2号车位：X: 3.93503m, Y: 0.72991m
```

### 2. 沙盘模型坐标系统（Three.js 局部坐标）
这是 Three.js 中沙盘模型的局部坐标系统。

```
特点：
- 原点：模型中心
- 缩放系数：6（sandboxModel.scale = 6）
- X 轴：向右，范围 -14.430 ~ 14.430（缩放前 -2.405 ~ 2.405）
- Z 轴：向前/向后，范围 -8.430 ~ 8.430（缩放前 -1.405 ~ 1.405）
- Y 轴：向上（高度）

重要：沙盘的地面网格名为 'MD_CaoPing'（草坪）
```

### 3. Three.js 世界坐标系统
场景的全局坐标系统，用于所有模型的最终定位。

### 4. 坐标转换逻辑（关键！）

#### A. 车辆坐标 → 模型坐标
```javascript
// 文件：src/utils/coordinateTransform.js
function vehicleToModelCoordinates(vehicleX, vehicleY) {
  // 1. 应用用户配置的偏移量（设置菜单中的 X/Y 偏移）
  const offsetVehicleX = vehicleX + coordinateOffset.x;
  const offsetVehicleY = vehicleY + coordinateOffset.y;
  
  // 2. 坐标系转换
  // 车辆 X (0-4.81) → 模型 X (-2.405 to 2.405)
  const modelX = (offsetVehicleX - 2.405) / 6;
  
  // 车辆 Y (0-2.81) → 模型 Z (1.405 to -1.405)
  // 注意：Y 轴方向相反！
  const modelZ = (1.405 - offsetVehicleY) / 6;
  
  return { x: modelX, z: modelZ };
}
```

#### B. 模型坐标 → 车辆坐标
```javascript
function modelToVehicleCoordinates(modelX, modelZ) {
  // 反向转换
  const vehicleX = modelX * 6 + 2.405;
  const vehicleY = 1.405 - modelZ * 6;
  
  return { x: vehicleX, z: vehicleY };
}
```

#### C. 世界坐标 → 模型坐标（点击场景时）
```javascript
// 在 Scene3D/index.js 中
// 使用 raycaster 获取世界坐标后
const worldPosition = intersects[0].point;

// 转换为沙盘模型的局部坐标
const localPosition = sandboxModel.worldToLocal(worldPosition.clone());

// 然后再转换为车辆坐标用于显示和协议
const vehicleCoords = modelToVehicleCoordinates(localPosition.x, localPosition.z);
```

#### D. 发送坐标时应用偏移
```javascript
function applyOffsetToSend(x, y) {
  return {
    x: x + coordinateOffset.x,
    y: y + coordinateOffset.y
  };
}
```

#### E. 车辆坐标 → 地图百分比 ✨ **新增** (2025-10-27)
```javascript
// 文件：src/utils/coordinateTransform.js
// 用途：在平行驾驶界面显示车辆在小地图上的位置（红点）
function vehicleToMapPercent(vehicleX, vehicleY) {
  // 沙盘尺寸（硬编码）
  const SANDBOX_DIMENSIONS = {
    width: 4.81,   // X方向
    depth: 2.81    // Y方向
  };
  
  // 参数验证
  if (typeof vehicleX !== 'number' || typeof vehicleY !== 'number') {
    console.error('❌ 地图坐标转换参数必须为数字:', { vehicleX, vehicleY });
    return { x: 50, y: 50 };
  }
  
  if (isNaN(vehicleX) || isNaN(vehicleY)) {
    console.error('❌ 地图坐标转换参数不能为NaN:', { vehicleX, vehicleY });
    return { x: 50, y: 50 };
  }
  
  // 转换为百分比（0-100）
  const xPercent = (vehicleX / SANDBOX_DIMENSIONS.width) * 100;
  
  // Y轴需要翻转（车辆坐标系Y向上，地图坐标系Y向下）
  const yPercent = 100 - (vehicleY / SANDBOX_DIMENSIONS.depth) * 100;
  
  return {
    x: xPercent,  // 0-100
    y: yPercent   // 0-100
  };
}

// 使用示例（在 ParallelDriving.vue 中）
const vehiclePosition = computed(() => {
  return vehicleToMapPercent(vehicleCoords.value.x, vehicleCoords.value.y)
})
```

### 5. 车辆朝向转换
```javascript
// Three.js 中车辆的旋转（Y轴旋转）
vehicleModel.rotation.y = orientation - Math.PI / 2;

// 原因：
// - 车辆模型的默认朝向是 Z 轴负方向（车头）
// - 车辆坐标系的 0 弧度是 X 轴正方向
// - 需要 -90° (Math.PI/2) 的偏移
```

---

## 📁 项目结构

```
dz-viz/
├── src/                          # 前端源码
│   ├── components/               # Vue 组件
│   │   ├── Scene3D/             # 3D 场景核心模块 ⭐
│   │   │   ├── index.js         # 场景初始化、模型加载
│   │   │   ├── index.vue        # Vue 包装组件
│   │   │   └── vehicleManager.js # 车辆模型动态管理 ⭐
│   │   ├── CarList.vue          # 车辆选择下拉
│   │   ├── CarButton.vue        # 车辆控制按钮（初始化位姿）
│   │   ├── CarInfo.vue          # 车辆信息面板
│   │   ├── AutoDrive.vue        # 自动驾驶控制（AVP、打车）
│   │   ├── SandboxControl.vue   # 沙盘设置
│   │   └── VehicleConnectionManager.vue # 车辆连接管理
│   ├── views/
│   │   ├── Map.vue              # 主视图（3D场景容器）⭐
│   │   └── MainLayout.vue       # 应用布局框架
│   ├── stores/                   # Pinia 状态管理
│   │   └── car.js               # 车辆状态 Store ⭐
│   ├── utils/                    # 工具函数
│   │   ├── coordinateTransform.js  # 坐标转换 ⭐⭐⭐
│   │   ├── socketManager.js     # Socket 通信管理
│   │   ├── vehicleBridge.js     # 车辆通信桥接
│   │   ├── eventBus.js          # 事件总线
│   │   └── logger.js            # 日志系统
│   ├── constants/                # 常量定义（模块化）
│   │   ├── index.js             # 统一导出
│   │   ├── timing.js            # 时间相关常量
│   │   ├── limits.js            # 限制相关常量
│   │   ├── defaults.js          # 默认值
│   │   ├── ui.js                # UI 相关常量
│   │   ├── performance.js       # 性能相关
│   │   ├── protocol.js          # 协议相关
│   │   ├── validation.js        # 验证规则
│   │   ├── messageTypes.js      # 协议消息类型定义 ⭐
│   │   └── messageTypesLoader.js # 协议类型加载器
│   └── main.js                   # 应用入口
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs              # Tauri 主程序
│   │   ├── commands/            # Tauri 命令
│   │   │   ├── mod.rs
│   │   │   ├── vehicle.rs       # 车辆控制命令 ⭐
│   │   │   └── database.rs      # 数据库命令
│   │   ├── database/            # 数据库模块
│   │   │   ├── mod.rs
│   │   │   ├── vehicle_db.rs    # 车辆连接数据库 ⭐
│   │   │   └── models.rs        # 数据模型
│   │   ├── protocol_processing/ # 协议处理 ⭐
│   │   │   ├── mod.rs
│   │   │   ├── types.rs         # 协议类型定义
│   │   │   ├── parser.rs        # 协议解析器
│   │   │   ├── builder.rs       # 协议构建器
│   │   │   └── validator.rs     # 协议验证器
│   │   └── socket_server/       # Socket 服务器
│   │       ├── mod.rs
│   │       └── udp_server.rs    # UDP 服务器实现 ⭐
│   ├── Cargo.toml
│   └── tauri.conf.json
├── public/
│   ├── model/                    # 3D 模型文件
│   │   └── final.glb            # 沙盘模型（含车辆模型）
│   └── draco/                    # Draco 解码器（离线）
├── test/
│   ├── test_client.py           # 车辆模拟客户端 1
│   └── test_client2.py          # 车辆模拟客户端 2
└── package.json
```

---

## 🔑 关键模块详解

### 1. Scene3D/index.js - 3D 场景核心

**职责**：
- Three.js 场景初始化
- 沙盘模型加载和对齐
- 用户交互（点击、鼠标移动）
- 标记管理（施工、起点、终点）
- 坐标转换的应用

**重要函数**：

```javascript
// 场景初始化
initScene(container)

// 沙盘对齐（只对齐沙盘，车辆动态加载）
alignSandbox()

// 鼠标事件处理（使用 raycaster）
onMouseDown(event)
onMouseMove(event)

// 点击模式切换
startPoseSelectionMode(callback)      // 初始化位姿
startPointSelectionMode(callback)      // 选择起点/终点
startParkingSlotSelectionMode(callback) // 选择车位
startConstructionMarkMode(callback)    // 施工标记

// 标记管理
createConstructionMarkerAt(position)
createStartPointMarker(position)
createEndPointMarker(position)

// 调试工具（暴露到 window.__scene3d__）
logSandboxInfo()
logAlignmentInfo()
```

**关键逻辑：Raycasting**
```javascript
// ⚠️ 重要：直接对沙盘模型进行 raycasting，而不是对 groundPlane
// 这样可以确保坐标精确
const intersects = raycaster.intersectObject(sandboxModel, true);
if (intersects.length > 0) {
  const worldPosition = intersects[0].point;
  
  // 转换为模型局部坐标
  const localPosition = sandboxModel.worldToLocal(worldPosition.clone());
  
  // 转换为车辆坐标用于显示
  const vehicleCoords = modelToVehicleCoordinates(localPosition.x, localPosition.z);
}
```

**性能优化：Dirty 检查机制**
```javascript
// 只在场景真正改变时才渲染
let isDirty = true;

function markDirty() {
  isDirty = true;
}

function animate() {
  requestAnimationFrame(animate);
  
  if (isDirty) {
    renderer.render(scene, camera);
    isDirty = false;
  }
}

// OrbitControls 变化时标记为 dirty
controls.addEventListener('change', markDirty);
```

### 2. Scene3D/vehicleManager.js - 车辆模型管理

**职责**：
- 动态加载车辆模型模板（只加载一次）
- 管理多辆车的实例（clone）
- 实时更新车辆位置和朝向
- 车辆模型清理

**重要函数**：

```javascript
// 加载车辆模型模板（单例模式）
loadCarModelTemplate()

// 添加车辆到场景
addVehicle(vehicleId, color)

// 更新车辆位置和朝向
updateVehicle(vehicleId, { position, orientation })

// 移除车辆
removeVehicle(vehicleId)
```

**关键逻辑：车辆缩放**
```javascript
// ⚠️ 重要：车辆模型需要设置 scale = 1
// 因为它会被添加到 sandboxModel 作为子节点，继承缩放
carModelTemplate.scale.set(1, 1, 1);

// 最终渲染时的缩放 = sandboxModel.scale * carModel.scale
// = 6 * 1 = 6
```

### 3. coordinateTransform.js - 坐标转换 ⭐⭐⭐

**这是最关键的模块，必须理解！**

```javascript
// 全局坐标偏移（从设置菜单配置）
const coordinateOffset = reactive({
  x: 0,  // 默认 0
  y: 0   // 默认 0
});

// 车辆坐标 → 模型坐标（用于 3D 渲染）
function vehicleToModelCoordinates(vehicleX, vehicleY) {
  // 步骤1：应用偏移
  const offsetVehicleX = vehicleX + coordinateOffset.x;
  const offsetVehicleY = vehicleY + coordinateOffset.y;
  
  // 步骤2：坐标系映射
  // 车辆 (0-4.81, 0-2.81) → 模型 (-2.405~2.405, -1.405~1.405)
  const modelX = (offsetVehicleX - 2.405) / 6;
  const modelZ = (1.405 - offsetVehicleY) / 6; // 注意：Y反向映射到Z
  
  return { x: modelX, z: modelZ };
}

// 模型坐标 → 车辆坐标（用于显示和发送协议）
function modelToVehicleCoordinates(modelX, modelZ) {
  const vehicleX = modelX * 6 + 2.405;
  const vehicleY = 1.405 - modelZ * 6;
  
  return { x: vehicleX, z: vehicleY };
}

// 发送协议时应用偏移
function applyOffsetToSend(x, y) {
  return {
    x: x + coordinateOffset.x,
    y: y + coordinateOffset.y
  };
}

// 车位坐标（硬编码）
export const PARKING_SLOTS_MODEL = {
  1: { x: 3.46875, y: 0.72991 },
  2: { x: 3.93503, y: 0.72991 }
};
```

**使用示例**：

```javascript
// 1. 接收车辆信息时（car.js）
const position = data.position; // { x: 2.5, z: 1.2 }（车辆坐标）

// 存储原始坐标用于显示
state.state.position = { ...position };

// 转换为模型坐标用于 3D 渲染
const modelPosition = vehicleToModelCoordinates(position.x, position.z);
eventBus.emit(EVENTS.VEHICLE_STATE_UPDATED, {
  position: modelPosition, // 发送模型坐标
  orientation: data.orientation
});

// 2. 用户点击场景时（Scene3D/index.js）
const worldPos = intersects[0].point;
const localPos = sandboxModel.worldToLocal(worldPos.clone());
const vehicleCoords = modelToVehicleCoordinates(localPos.x, localPos.z);

// 显示车辆坐标
console.log(`X: ${vehicleCoords.x.toFixed(2)}m, Y: ${vehicleCoords.z.toFixed(2)}m`);

// 3. 发送协议时（如初始化位姿）
const coordsToSend = applyOffsetToSend(vehicleCoords.x, vehicleCoords.z);
await invoke('send_vehicle_control_command', {
  data: {
    x: coordsToSend.x,
    y: coordsToSend.y,
    orientation: orientation
  }
});
```

### 4. stores/car.js - 车辆状态管理

**职责**：
- 管理所有车辆的连接信息
- 存储车辆实时状态（位置、速度、电量等）
- 响应事件总线的车辆更新事件
- 提供计算属性（当前选中车辆、在线车辆等）

**关键状态**：

```javascript
const state = reactive({
  // 车辆连接列表（从数据库加载）
  vehicles: [],
  
  // 当前选中的车辆 ID
  selectedCarId: null,
  
  // 车辆状态映射表 { vehicleId: {...状态} }
  vehicleStates: {},
  
  // 坐标偏移配置
  coordinateOffset: { x: 0, y: 0 }
});
```

**重要函数**：

```javascript
// 更新车辆状态（接收协议数据）
updateVehicleState(vehicleInfo) {
  // 存储原始坐标（车辆坐标系）用于显示
  state.state.position = { x: vehicleInfo.x, z: vehicleInfo.y };
  
  // 转换为模型坐标用于 3D 渲染
  const modelPosition = vehicleToModelCoordinates(vehicleInfo.x, vehicleInfo.y);
  
  // 发送事件给 vehicleManager
  eventBus.emit(EVENTS.VEHICLE_STATE_UPDATED, {
    vehicleId: vehicleInfo.vehicleId,
    position: modelPosition,  // 模型坐标
    orientation: vehicleInfo.orientation,
    // ... 其他状态
  });
}
```

### 5. 协议处理 (Rust)

#### 接收协议结构
```rust
// 协议头（固定 5 字节）
pub struct ProtocolHeader {
    pub header: u8,        // 0xAA
    pub protocol_id: u16,  // 消息类型 ID (小端序)
    pub data_length: u16,  // 数据域长度 (小端序)
}

// 车辆信息协议 (0x0001)
pub struct VehicleInfo {
    pub vehicle_id: u8,         // 车辆编号
    pub speed: f64,             // 车速 (m/s)
    pub position_x: f64,        // X坐标 (车辆坐标系)
    pub position_y: f64,        // Y坐标 (车辆坐标系)
    pub orientation: f64,       // 朝向 (弧度)
    pub battery: f64,           // 电量 (0-100)
    pub gear: u8,               // 档位
    pub steering_angle: f64,    // 方向盘转角
    pub navigation_state: u8,   // 导航状态
    pub camera_state: u8,       // 相机状态
    pub lidar_state: u8,        // 激光雷达状态
    pub gyro_state: u8,         // 陀螺仪状态
    pub parking_spot: u8,       // 车位占用状态
}
```

#### 发送协议 ID 映射
```rust
// ⚠️ 重要：发送和接收的协议 ID 不同！
pub struct SendMessageTypes;
impl SendMessageTypes {
    pub const VEHICLE_CONTROL: u16 = 0x1001;  // 车辆控制（初始化位姿）
    pub const AVP_PARKING: u16 = 0x1004;      // AVP 停车
    pub const TAXI_SERVICE: u16 = 0x1005;     // 打车服务
    pub const CONSTRUCTION_MARKER: u16 = 0x1006; // 施工标记
}

pub struct MessageTypes;
impl MessageTypes {
    pub const VEHICLE_INFO: u16 = 0x0001;     // 接收车辆信息
    pub const PATH_FILE_SELECTION: u16 = 0x0003; // 接收路径文件编号
}
```

---

## 🔄 事件总线机制

### 事件定义 (eventBus.js)

```javascript
export const EVENTS = {
  // 车辆相关
  VEHICLE_STATE_UPDATED: 'vehicle_state_updated',
  VEHICLE_CONNECTION_CHANGED: 'vehicle_connection_changed',
  ONLINE_VEHICLES_COUNT_CHANGED: 'online_vehicles_count_changed',
  
  // 菜单相关
  MENU_VISIBILITY_CHANGED: 'menu_visibility_changed',
  
  // 场景相关
  SCENE3D_PROGRESS: 'scene3d_progress',
  SCENE3D_COMPLETE: 'scene3d_complete',
};
```

### 使用模式

```javascript
// 发送事件
eventBus.emit(EVENTS.VEHICLE_STATE_UPDATED, {
  vehicleId: 1,
  position: { x: 1.2, z: 0.5 },
  orientation: 0.5
});

// 监听事件
onMounted(() => {
  eventBus.on(EVENTS.VEHICLE_STATE_UPDATED, (data) => {
    console.log('车辆状态更新', data);
  });
});

// 移除监听（重要：防止内存泄漏）
onBeforeUnmount(() => {
  eventBus.off(EVENTS.VEHICLE_STATE_UPDATED);
});
```

---

## 🧹 代码质量与最佳实践 (2025-10-27)

### 1. 代码清理原则

**定期清理项目**：
- ✅ 删除未使用的变量和导入
- ✅ 删除注释掉的调试代码（`console.log`, `console.debug`）
- ✅ 删除废弃的CSS规则
- ✅ 删除未使用的组件导入

**示例（已完成）**：
```javascript
// ❌ 删除未使用的变量（main.js）
// const originalElMessage = ElMessage;

// ❌ 删除注释的导入
// import 'element-plus/theme-chalk/dark/css-vars.css';

// ❌ 删除调试日志（Header.vue, Map.vue等）
// console.log('打开对话框', dialogName);
// logHelper.debug('按钮点击', data);

// ❌ 删除未使用的CSS（main.css）
// .el-message { display: none !important; }

// ❌ 删除注释的组件导入（Settings.vue）
// import CarSettings from '@/components/CarSettings.vue';
```

### 2. 性能优化

**Toast对象池**（`src/utils/toast.js`）：
```javascript
// 避免频繁创建和销毁DOM元素
const toastPool = [];
const MAX_POOL_SIZE = 5;

// 复用DOM元素
function getToastFromPool() {
  return toastPool.length > 0 ? toastPool.pop() : document.createElement('div');
}

function returnToastToPool(toast) {
  // 清理状态后放回池中
  toast.className = '';
  toast.style.cssText = '';
  toast.innerHTML = '';
  if (toastPool.length < MAX_POOL_SIZE) {
    toastPool.push(toast);
  }
}
```

**定时器清理**：
```javascript
// ✅ 组件卸载时清理定时器（ParallelDriving.vue）
onBeforeUnmount(() => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
});
```

**事件监听器清理**：
```javascript
// ✅ 移除事件监听（防止内存泄漏）
onBeforeUnmount(() => {
  eventBus.off(EVENTS.VEHICLE_STATE_UPDATED);
  eventBus.off(EVENTS.ONLINE_VEHICLES_COUNT_CHANGED);
});
```

### 3. 代码复用

**封装通用函数**：
```javascript
// ✅ 坐标转换函数封装（coordinateTransform.js）
// 之前：在多个组件中重复计算
// 现在：统一使用 vehicleToMapPercent()

export function vehicleToMapPercent(vehicleX, vehicleY) {
  // 参数验证
  if (typeof vehicleX !== 'number' || typeof vehicleY !== 'number') {
    return { x: 50, y: 50 };
  }
  
  // 统一的转换逻辑
  const xPercent = (vehicleX / SANDBOX_DIMENSIONS.width) * 100;
  const yPercent = 100 - (vehicleY / SANDBOX_DIMENSIONS.depth) * 100;
  
  return { x: xPercent, y: yPercent };
}
```

**组件化**：
```javascript
// ✅ 提取通用UI组件（CardWithBorder.vue）
// 之前：在多个组件中重复写边框样式
// 现在：统一使用 <CardWithBorder> 组件
```

### 4. 生产环境优化

**禁用调试日志**：
```javascript
// logger.js 中根据环境变量控制
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  debug: isDevelopment ? console.log : () => {},
  info: console.info,
  warn: console.warn,
  error: console.error
};
```

**资源优化**：
- 使用 Draco 压缩 3D 模型
- 离线 Draco 解码器（避免CDN依赖）
- 图片资源优化（WebP格式）

---

## 🚨 开发注意事项

### 1. 坐标转换的黄金法则

```
✅ 正确的数据流：

接收车辆信息:
  车辆坐标 → 存储原始坐标 → 转换为模型坐标 → 发送事件 → 3D渲染

用户点击场景:
  世界坐标 → worldToLocal → 模型坐标 → 转换为车辆坐标 → 显示/发送

发送控制命令:
  车辆坐标 → 应用偏移 → 发送给 Rust

❌ 常见错误：
1. 忘记 worldToLocal，直接使用世界坐标
2. 重复转换坐标（转换两次）
3. 混淆 X/Y 轴和 X/Z 轴
4. 忘记应用用户配置的偏移量
```

### 2. Three.js 渲染优化

```javascript
// ✅ 使用 dirty 检查，避免不必要的渲染
function markDirty() {
  isDirty = true;
}

// ⚠️ 重要：任何视觉变化后都要调用 markDirty()
createMarker() {
  // ... 创建标记
  markDirty(); // 触发重新渲染
}

// ⚠️ OrbitControls 需要手动监听
controls.addEventListener('change', markDirty);
```

### 3. 模型加载和缓存

```javascript
// ✅ 沙盘模型只加载一次
let sandboxModel = null;

// ✅ 车辆模型模板只加载一次（单例）
let carModelTemplate = null;

// ✅ 车辆实例使用 clone()
const carInstance = carModelTemplate.clone();

// ✅ DRACOLoader 单例
const sharedDracoLoader = new DRACOLoader();
sharedDracoLoader.setDecoderPath('/draco/'); // 离线解码器
```

### 4. 内存管理

```javascript
// ✅ 移除车辆时释放资源
removeVehicle(vehicleId) {
  const vehicle = vehicles.get(vehicleId);
  if (vehicle) {
    vehicle.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    sandboxModel.remove(vehicle);
    vehicles.delete(vehicleId);
  }
}
```

### 5. 车辆模型缩放问题

```javascript
// ⚠️ 关键：车辆模型的缩放必须设置为 1
// 原因：车辆会作为子节点添加到 sandboxModel
// 最终缩放 = sandboxModel.scale (6) * carModel.scale (1) = 6

carModelTemplate.scale.set(1, 1, 1); // 不是 6！
```

### 6. 异步操作的顺序

```javascript
// ✅ 正确的初始化顺序
async initScene() {
  // 1. 创建基础场景
  await initSceneCore();
  
  // 2. 加载沙盘模型
  await loadFinalModel();
  
  // 3. 对齐沙盘
  alignSandbox();
  
  // 4. 预加载资源
  preloadMarkerTextures();
  
  // 5. 标记完成
  markDirty();
}
```

### 7. 协议发送的 ID 选择

```rust
// ❌ 错误：使用接收协议 ID
let protocol_id = MessageTypes::VEHICLE_CONTROL; // 0x0003

// ✅ 正确：使用发送协议 ID
let protocol_id = SendMessageTypes::VEHICLE_CONTROL; // 0x1001
```

### 8. 沙盘地面识别

```javascript
// ⚠️ 沙盘模型包含多个子网格
// 地面网格的名称是 'MD_CaoPing'（草坪）
// 计算沙盘尺寸时要特别找出这个网格

function calculateSandboxDimensions() {
  let groundMesh = null;
  sandboxModel.traverse((child) => {
    if (child.name === 'MD_CaoPing') {
      groundMesh = child;
    }
  });
  
  if (groundMesh) {
    const groundBox = new Box3().setFromObject(groundMesh);
    // 使用 groundBox 计算真实的 X/Z 尺寸
  }
}
```

### 9. Raycasting 精度

```javascript
// ❌ 错误：使用单独的 groundPlane
const intersects = raycaster.intersectObject(groundPlane);

// ✅ 正确：直接对沙盘模型进行 raycasting
const intersects = raycaster.intersectObject(sandboxModel, true);
// 第二个参数 true 表示递归检测所有子节点
```

### 10. 响应式数据更新

```javascript
// ✅ 正确：更新响应式对象的属性
state.vehicleStates[vehicleId] = {
  ...state.vehicleStates[vehicleId],
  position: newPosition
};

// ❌ 错误：直接修改嵌套属性（可能不触发响应）
state.vehicleStates[vehicleId].position = newPosition;
```

---

## 🛠️ 调试工具

### 1. Scene3D 调试接口

在浏览器控制台：

```javascript
// 查看沙盘信息
window.__scene3d__.logSandboxInfo()

// 查看对齐信息
window.__scene3d__.logAlignmentInfo()

// 调整沙盘缩放（实验）
window.__scene3d__.adjustSandboxScale(7)

// 调整沙盘位置（实验）
window.__scene3d__.adjustSandboxPosition(0, 0.1, 0)

// 分析沙盘网格
window.__scene3d__.analyzeSandboxMeshes()

// 直接访问 Three.js 对象
window.__scene3d__.scene
window.__scene3d__.camera
window.__scene3d__.renderer
window.__scene3d__.sandboxModel
```

### 2. Event Bus 调试

```javascript
// 查看活跃的监听器
window.__eventBus__.getActiveListeners()

// 检测内存泄漏
window.__eventBus__.detectLeaks()

// 查看统计信息
window.__eventBus__.getStats()
```

### 3. 坐标转换测试

```javascript
import { vehicleToModelCoordinates, modelToVehicleCoordinates } 
  from '@/utils/coordinateTransform.js';

// 测试往返转换
const vehicle = { x: 2.4, z: 1.4 };
const model = vehicleToModelCoordinates(vehicle.x, vehicle.z);
const back = modelToVehicleCoordinates(model.x, model.z);

console.log('车辆坐标:', vehicle);
console.log('模型坐标:', model);
console.log('转换回来:', back);
// back 应该约等于 vehicle
```

---

## 📝 协议格式示例

### 发送：初始化位姿 (0x1001)

```
Hex: AA 01 10 19 00 01 3D 0A D7 A3 70 3D 00 40 ...
     ↑  ↑-----↑ ↑-----↑ ↑  ↑-----------------...
     头  协议ID   长度   车辆ID  位置X (double)
```

```javascript
{
  vehicle_id: 1,
  position_x: 2.5,  // 车辆坐标（应用了偏移）
  position_y: 1.2,
  orientation: 0.5,
  target_speed: 0.3
}
```

### 接收：车辆信息 (0x0001)

```
Hex: AA 01 00 38 00 01 00 00 00 00 00 00 00 00 ...
     ↑  ↑-----↑ ↑-----↑ ↑  ↑-----------------...
     头  协议ID   长度   车辆ID  速度 (double)
```

```javascript
{
  vehicleId: 1,
  speed: 0.5,
  x: 2.3,           // 车辆坐标
  y: 1.1,
  orientation: 0.8,
  battery: 85.5,
  gear: 4,
  steering_angle: 0.2,
  navigation_state: 1,
  camera_state: 1,
  lidar_state: 1,
  gyro_state: 1,
  parking_spot: 0
}
```

---

## 🎨 UI 组件层级

```
MainLayout (根布局)
├── Header (顶部导航栏)
│   ├── 车辆信息 (v-if="show_car_info")
│   ├── 自动驾驶 (v-if="show_auto_drive")
│   ├── 沙盘控制 (v-if="show_sandbox_control")
│   └── 功能设置 (v-if="show_function_settings")
├── Map (主视图)
│   ├── Scene3D (3D 场景)
│   ├── CarList (车辆选择)
│   ├── CarButton (车辆控制按钮)
│   ├── VehicleTimeChart (运行时间统计)
│   └── DrivingBehaviorChart (自动驾驶统计)
└── 其他面板组件
```

---

## 📊 数据流图

```
车辆客户端 (test_client.py)
    ↓ UDP (车辆信息 0x0001)
Rust UDP Server (src-tauri/src/socket_server)
    ↓ 解析协议
Protocol Parser (src-tauri/src/protocol_processing)
    ↓ 转发到前端
WebSocket / IPC
    ↓
Socket Manager (src/utils/socketManager.js)
    ↓ 更新 Store
Car Store (src/stores/car.js)
    ├─→ 存储原始坐标（车辆坐标系）
    └─→ 转换为模型坐标
        ↓ 发送事件
Event Bus (VEHICLE_STATE_UPDATED)
    ↓ 监听事件
Vehicle Manager (src/components/Scene3D/vehicleManager.js)
    ↓ 更新 3D 模型
Three.js Scene
    ↓ 渲染
WebGL Canvas
```

---

## 🔧 常见问题排查

### 问题1：车辆不显示或位置错误

**检查清单**：
1. ✅ 坐标转换是否正确？
   ```javascript
   // 在 car.js 中
   const modelPosition = vehicleToModelCoordinates(x, y);
   ```

2. ✅ 是否发送了事件？
   ```javascript
   eventBus.emit(EVENTS.VEHICLE_STATE_UPDATED, {...});
   ```

3. ✅ Vehicle Manager 是否监听了事件？
   ```javascript
   eventBus.on(EVENTS.VEHICLE_STATE_UPDATED, handleUpdate);
   ```

4. ✅ 车辆模型是否加载成功？
   ```javascript
   console.log(carModelTemplate); // 应该不是 null
   ```

5. ✅ 是否调用了 markDirty()?
   ```javascript
   updateVehicle(...);
   markDirty(); // 触发渲染
   ```

### 问题2：点击场景坐标不准

**检查清单**：
1. ✅ 是否使用了 worldToLocal？
   ```javascript
   const localPos = sandboxModel.worldToLocal(worldPos.clone());
   ```

2. ✅ 是否对正确的对象进行 raycasting？
   ```javascript
   // ✅ 正确
   raycaster.intersectObject(sandboxModel, true);
   
   // ❌ 错误
   raycaster.intersectObject(groundPlane);
   ```

3. ✅ 坐标转换方向是否正确？
   ```javascript
   // 模型坐标 → 车辆坐标
   const vehicleCoords = modelToVehicleCoordinates(localPos.x, localPos.z);
   ```

### 问题3：模型不渲染或卡顿

**检查清单**：
1. ✅ Dirty 检查是否工作？
   ```javascript
   console.log('isDirty', isDirty); // 应该在变化时为 true
   ```

2. ✅ OrbitControls 是否触发 markDirty？
   ```javascript
   controls.addEventListener('change', markDirty);
   ```

3. ✅ 是否有性能瓶颈？
   ```javascript
   // 使用 Chrome DevTools → Performance 分析
   ```

### 问题4：协议发送/接收错误

**检查清单**：
1. ✅ 协议 ID 是否正确？
   ```rust
   // 发送时使用 SendMessageTypes
   SendMessageTypes::VEHICLE_CONTROL // 0x1001
   ```

2. ✅ 字节序是否正确？（小端序）
   ```rust
   writer.write_u16::<LittleEndian>(protocol_id)?;
   ```

3. ✅ 数据长度是否匹配？
   ```rust
   let data_length = /* 实际数据字节数 */;
   ```

4. ✅ 是否应用了坐标偏移？
   ```javascript
   const coordsToSend = applyOffsetToSend(x, y);
   ```

---

## 🚀 启动和测试

### 开发模式

```bash
# 启动开发服务器
npm run tauri:dev

# 在另一个终端启动测试客户端
cd test
python test_client.py   # 车辆1
python test_client2.py  # 车辆2（可选）
```

### 生产构建

```bash
# Ubuntu
npm run tauri:build

# macOS
npm run tauri:build
```

### 测试客户端说明

```python
# test_client.py 模拟车辆1
# - 逆时针绕沙盘移动
# - 发送车辆信息 (0x0001)
# - 每秒发送 2 次

# test_client2.py 模拟车辆2
# - 顺时针绕沙盘移动
# - 车辆 ID = 2
# - 其他同车辆1
```

---

## 📚 参考资料

### Three.js
- [Three.js 官方文档](https://threejs.org/docs/)
- [GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader)
- [DRACOLoader](https://threejs.org/docs/#examples/en/loaders/DRACOLoader)

### Tauri
- [Tauri 官方文档](https://tauri.app/)
- [Tauri 命令系统](https://tauri.app/v1/guides/features/command/)

### Vue 3
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Pinia](https://pinia.vuejs.org/)

---

## 🎯 总结

### 核心要点

1. **坐标系统理解**：车辆坐标 ↔ 模型坐标 ↔ 世界坐标
2. **转换时机**：接收时转换、显示时转换、发送时应用偏移
3. **模型管理**：沙盘单例、车辆模板单例、车辆实例 clone
4. **事件驱动**：Event Bus 解耦组件通信
5. **性能优化**：Dirty 检查、资源缓存、内存管理
6. **协议映射**：发送和接收的协议 ID 分离

### 开发建议

1. **修改坐标相关代码前**：先在纸上画出坐标系和转换流程
2. **修改渲染逻辑前**：确保理解 dirty 检查机制
3. **添加新功能前**：先在 test_client.py 中模拟数据
4. **遇到问题时**：使用 `window.__scene3d__` 调试工具
5. **提交代码前**：测试多车场景、坐标转换、内存泄漏

---

**最后更新**: 2025-10-27  
**作者**: AI Assistant  
**版本**: v1.2
**更新内容**: 
- 红绿灯系统适配新模型（命名规则、Canvas翻转、材质配置）
- Toast系统优化（对象池、Vue插件化、内存泄漏修复）
- 坐标转换封装（vehicleToMapPercent）
- 平行驾驶界面优化（地图aspect-ratio自适应）
- 代码质量提升（删除未使用代码、注释清理）
- CardWithBorder通用组件

