# DZ-VIZ 项目快速参考

**版本**: v1.8 | **更新**: 2025-12-13

---

## 项目概述

自动驾驶车辆可视化管理系统：Tauri + Vue 3 + Three.js

**核心功能**：多车辆实时3D可视化、AVP泊车、打车服务、施工标记、红绿灯系统、摄像头、高架桥倾角、路径显示

---

## 核心系统

### 1. 坐标系统（最关键！）

**三层坐标系**：
```
车辆坐标: X(0-6m), Y(0-5m)     ← UDP协议发送
    ↓ vehicleToModelCoordinates()
模型坐标: X(-3~3), Z(-2.5~2.5) ← 沙盘局部坐标，添加车辆模型用
    ↓ 沙盘缩放6倍
世界坐标: X(-18~18), Z(-15~15) ← Three.js场景坐标
```

**转换函数**（`coordinateTransform.js`）：
- `vehicleToModelCoordinates(vehicleX, vehicleY)` → `{x, z}` 模型坐标
- `modelToVehicleCoordinates(modelX, modelZ)` → `{x, y}` 车辆坐标

**关键规则**：
- 车辆模型添加到 `sandboxModel` 内部 → 使用模型坐标
- groundPlane 添加到 `scene` → 使用世界坐标
- 地面高度：约2.82（世界坐标）

### 2. 高架桥倾角系统

**配置参数**（`vehicleManager.js` 第57-78行）：
```javascript
const ELEVATION_CONFIG = {
    enabled: true,
    X1: 0.790,    // 左侧上坡起点 X坐标（车辆坐标系）
    X2: 5.205,    // 右侧下坡起点 X坐标
    Y1: 2.958,    // 上下坡起点 Y坐标
    Y2: 3.913,    // 高架开始 Y坐标
    BRIDGE_HEIGHT: 0.244  // 高架高度（模型坐标）
};
```

**区域判断逻辑**（`calculateVehicleElevation()` 第80-144行）：
```javascript
// 地面：X在范围外 且 Y < Y1
// 上坡：(X < X1 或 X > X2) 且 Y1 ≤ Y < Y2，线性插值高度
// 下坡：同上坡条件，根据orientation方向判断
// 高架：Y ≥ Y2，固定高度BRIDGE_HEIGHT
```

**倾角计算**：
- 坡度角 = `Math.atan((Y2-Y1) / BRIDGE_HEIGHT)`
- 上坡：`rotation.x` = 坡度角（车头上仰）
- 下坡：`rotation.x` = -坡度角（车头下倾）
- 关键：`vehicleModel.rotation.order = 'YXZ'`（确保pitch在局部坐标系）

**调试命令**：
```javascript
window.__scene3d__.testElevationAt(x, y, orientation)  // 测试指定位置
window.__scene3d__.updateElevationConfig({BRIDGE_HEIGHT: 0.3})  // 调整参数
window.__showElevationLines()  // 显示边界线
```

**鼠标交互与标记放置**（`index.js`）：
- Raycaster 优先与沙盘3D模型相交（`intersectObjects([sandboxModel], true)`），获取模型表面真实坐标
- 地面平面仅作为后备（无模型交点时使用）
- 初始化位姿、施工标记、打车标记：直接使用 raycaster 交点坐标（包含正确高度）
- 坐标传递：`{ x, y, z }` 局部坐标 → 标记创建函数接收可选 `y` 参数

### 3. 红绿灯系统

**组号映射**（`trafficLightManager.js` 第305行）：
```javascript
// 协议组号与实际组号反向映射
const actualGroupIndex = groupIndex === 0 ? 1 : 0;
```
- 协议第一组(0) → 控制沙盘第二组(8个红绿灯)
- 协议第二组(1) → 控制沙盘第一组(8个红绿灯)

**配置**（第40-60行）：
- 第一组：索引0-7，groupIndex=0
- 第二组：索引8-15，groupIndex=1
- 颜色：1=红，2=绿，3=黄

### 4. 关键文件结构

```
src/utils/coordinateTransform.js              ⭐⭐⭐ 坐标转换
src/components/Scene3D/index.js               ⭐⭐⭐ 场景初始化、地面检测、标记创建
src/components/Scene3D/vehicleManager.js      ⭐⭐⭐ 车辆管理、高架倾角、缓存管理
src/components/Scene3D/pathRenderer.js        ⭐⭐ 路径绘制（Line2）
src/components/Scene3D/trafficLightManager.js ⭐⭐ 红绿灯控制
src/utils/pathManager.js                      ⭐⭐ 路径数据处理、重试机制
src/views/MainLayout.vue                      ⭐⭐ 主布局、右侧面板
src/stores/car.js                             ⭐ 车辆状态
src-tauri/src/socket_server/                  UDP通信
src-tauri/src/services/path_loader/           路径文件加载
src-tauri/src/commands/path.rs                路径数据命令
```

### 5. 沙盘参数

**尺寸**：6m × 5m（逻辑），缩放因子6
**地面高度**：2.82（世界坐标）
**地面Mesh**：`Standardmaterial206`

**缓存机制**（`vehicleManager.js`）：
- `cachedSandboxBox`：沙盘包围盒（沙盘重新加载时清空）
- `cachedCarTemplateBox`：车辆模板包围盒（用于计算底盘高度）
- `cachedRoadSurfaceY`：地面高度（模型坐标）
- **重要**：`clearSandboxCache()` 清空所有缓存，需重新计算

### 6. 车辆管理关键逻辑

**车辆添加/移除**（`vehicleManager.js`）：
- `addVehicle()`：创建车辆模型，计算包围盒，设置初始位置
- `removeVehicle()`：清理模型、缓存（`lastPositions`）、插值数据
- `clearAllVehicles()`：清空所有车辆及相关缓存

**车辆重连修复**：
- 问题：重连后车辆高度错误（`cachedCarTemplateBox` 被清空但未重算）
- 修复：`loadCarModelTemplate()` 检查缓存丢失并重新计算
- 清理：`removeVehicle()` 和 `clearAllVehicles()` 清除 `lastPositions` 缓存

**高度计算**（`processBatchUpdates()` 第513-567行）：
```javascript
// 1. 获取沙盘地面高度（缓存）
const roadY = getRoadSurfaceY();
// 2. 计算高架桥/坡道增量
const elevation = calculateVehicleElevation(vehicleX, vehicleY, orientation);
// 3. 计算车辆底盘高度
const carBottomY = cachedCarTemplateBox.min.y;
// 4. 最终Y坐标
const finalY = roadY + elevation.height - carBottomY;
```

### 7. 路径显示系统

**路径文件**（`src-tauri/src/services/path_loader/`）：
- 预加载：启动时读取 `public/routes/*.txt` 到内存
- 格式：每行 `x,y,theta`（车辆坐标系，单位米）
- 合并：支持多路径编号合并（`get_merged_path_data`）
- **注意**：路径编号从 1 开始，不要使用 0 号路径

**路径显示流程**（`pathManager.js`）：
```javascript
// 1. 接收协议 0x0003（路径编号列表）
// 2. 检查车辆是否开启路径显示
// 3. 调用 Rust 获取路径数据（已应用偏移）
// 4. 转换坐标：车辆坐标 → 模型坐标
// 5. 计算每个点的高架/坡道高度
// 6. 发送 'vehicle-path-draw' 事件
```

**重试机制**（路径显示在工控机上的修复）：
- 问题：沙盘未加载完成时 `getRoadSurfaceY()` 返回 0
- 修复：检测到 `roadY === 0` 时延迟重试（最多5次，延迟递增）
- 参数：首次 500ms，每次增加 200ms

**路径绘制**（`pathRenderer.js`）：
- 使用 `Line2` + `LineMaterial`（支持线宽）
- 添加到 `sandboxModel` 内部（使用模型坐标）
- 高度：`roadY + elevationHeight + 0.01`（略高于地面避免 Z-fighting）

### 8. 地面高度检测

**getRoadSurfaceY()**（`index.js` 第2008-2032行）：
- 返回沙盘局部坐标系的地面高度（Y值）
- **缓存策略**：返回 0 时不缓存，避免错误值传播
- **调用顺序**：
  1. 检查缓存 `cachedRoadSurfaceY`
  2. 检查沙盘模型是否加载
  3. 调用 `findGroundMesh()` 查找地面网格
  4. 计算并缓存地面高度

**findGroundMesh()**（`index.js` 第1974-2006行）：
- 查找最大水平面积的网格作为地面
- **关键**：调用 `sandboxModel.updateMatrixWorld(true)` 强制更新变换矩阵
- 返回：`{ mesh, worldBox, localY }`

### 9. UI布局

**右侧面板折叠**（`MainLayout.vue`）：
- 状态：`isPanelCollapsed`
- 按钮位置：`right: 440px`（展开），`right: 20px`（折叠）
- 动画：`transform: translateX(calc(100% + 20px))`
- 图标：展开 `>`，折叠 `<`
- 圆角：始终左侧，`border-radius: 12px 0 0 12px`

---

## 性能优化

**关键优化**：
- 禁用插值系统（50Hz高频数据）
- 批量车辆更新：`maxUpdatesPerFrame: 10`
- 删除每帧 `scene.traverse()`
- 前端快速比对，减少Rust IPC
- 效果：单帧15-30ms → 3-5ms

---

## 协议通信

**UDP端口**: 8888（车辆）| **WebSocket**: 3030（前后端）

**发送协议**：
- `0x1001` 车辆控制 | `0x1004` AVP停车 | `0x1005` 打车 | `0x1006` 施工标记 | `0x1007` 路径显示控制

**接收协议**：
- `0x0001` 车辆信息（50Hz）| `0x0002` 红绿灯状态 | `0x0003` 路径文件编号列表

---

## 调试命令

```javascript
// 高架桥系统
window.__scene3d__.testElevationAt(x, y, orientation)  // 测试指定位置倾角
window.__scene3d__.updateElevationConfig({BRIDGE_HEIGHT: 0.3})  // 动态调整
window.__showElevationLines()  // 显示区域边界线
window.__hideElevationLines()  // 隐藏边界线

// 场景信息
window.__scene3d__.testGroundHeight()  // 地面高度检测
window.__scene3d__.getSandboxDimensionsInfo()  // 沙盘尺寸
window.__scene3d__.logSandboxInfo()  // 沙盘详细信息

// 事件系统
window.__eventBus__.getActiveListeners()  // 查看活跃监听器
```

---

## 常见问题与修复

**车辆断电不移除（已修复）**：
- 问题：车辆直接断电后，3D 模型仍留在沙盘上，导致界面卡顿
- 原因 1：TCP 连接进入"半开"状态，无法检测到断开
- 原因 2：前端只更新连接状态，未移除 3D 模型
- 修复方案：**基于心跳超时检测**
  - 车端按 50Hz 发送心跳（0x0001）
  - 后端检测：连续 1 秒（50 次心跳间隔）没收到任何数据包 → 主动断开连接
  - 前端收到断开事件 → 立即移除 3D 模型和路径
  - 代码位置：`socket/server.rs` 第 243-268 行，`car.js` 第 225-235 行

**车辆重连后高度错误**：
- 原因：`cachedCarTemplateBox` 被 `clearSandboxCache()` 清空但未重算
- 修复：`loadCarModelTemplate()` 检测缓存丢失并重新计算
- 清理：`removeVehicle()` 清除 `lastPositions` 缓存

**车辆位置错误**：
- 检查 `updateMatrixWorld(true)` 调用（特别是 `findGroundMesh()`）
- 确认使用正确坐标系（模型 vs 世界）
- 检查 `vehicleToModelCoordinates()` 转换

**车辆倾角错误**：
- 确认 `rotation.order = 'YXZ'`
- 检查 `ELEVATION_CONFIG` 参数
- 使用 `testElevationAt()` 测试

**红绿灯控制反向**：
- 已修复：协议组号自动交换映射
- 第一组 → 实际第二组，第二组 → 实际第一组

**标记高度不对（坡道/高架）**：
- 确保使用 raycaster 交点坐标（包含正确 Y 值）
- 创建标记时传递可选 `y` 参数
- 回退使用 `calculateVehicleElevation()` 计算

---

## 快速启动

```bash
# 开发模式
npm run tauri:dev

# 测试客户端（内圈路径）
python test/test_client.py --id 1           # 2Hz
python test/test_client_high_freq.py --id 1 # 50Hz

# 测试路径：6m×5m沙盘，距边缘0.43m内圈矩形
```

---

## 修改注意事项

**缓存管理**：
- 沙盘重新加载时必须调用 `clearSandboxCache()`
- 车辆移除时清理 `lastPositions`、插值数据
- `getRoadSurfaceY()` 返回 0 时不缓存

**坐标转换**：
- 添加到 `sandboxModel` 使用模型坐标
- 添加到 `scene` 使用世界坐标
- Raycaster 交点是沙盘局部坐标

**高度计算**：
- 标记/车辆：`roadY + elevationHeight - carBottomY`
- 路径线：`roadY + elevationHeight + 0.01`
- 优先使用 raycaster 检测真实高度

**变换矩阵**：
- 坐标转换前调用 `updateMatrixWorld(true)`
- 特别是 `findGroundMesh()` 和 `worldToLocal()`

**日志记录**：
- 使用 Tauri 日志插件记录错误/警告（`plWarn`、`plError`）
- 不使用 emoji，纯文本日志便于分析
- 关键位置：路径加载失败、沙盘未加载、车辆高度异常

---

**版本**: v1.9 | **更新**: 2025-12-13 | **状态**: ✅ 高架倾角、标记高度、车辆重连、路径显示重试、**心跳超时断开**
