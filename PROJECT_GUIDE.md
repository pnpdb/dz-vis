# DZ-VIZ 项目快速参考

**版本**: v1.6 | **更新**: 2025-12-12

---

## 项目概述

自动驾驶车辆可视化管理系统：Tauri + Vue 3 + Three.js

**核心功能**：多车辆实时3D可视化、AVP泊车、打车服务、施工标记、红绿灯系统、摄像头、高架桥倾角

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
src/components/Scene3D/index.js               ⭐⭐⭐ 场景初始化、地面检测
src/components/Scene3D/vehicleManager.js      ⭐⭐⭐ 车辆管理、高架倾角
src/components/Scene3D/trafficLightManager.js ⭐⭐ 红绿灯控制
src/views/MainLayout.vue                      ⭐⭐ 主布局、右侧面板
src/stores/car.js                             ⭐ 车辆状态
src-tauri/src/socket_server/                  UDP通信
```

### 5. 沙盘参数

**尺寸**：6m × 5m（逻辑），缩放因子6
**地面高度**：2.82（世界坐标）
**地面Mesh**：`Standardmaterial206`
**缓存高度**：`cachedSandboxBox`、`cachedCarTemplateBox`（`vehicleManager.js`）

### 6. UI布局

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
- `0x1001` 车辆控制 | `0x1004` AVP停车 | `0x1005` 打车 | `0x1006` 施工标记

**接收协议**：
- `0x0001` 车辆信息 | `0x0002` 红绿灯状态 | `0x0003` 路径文件

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

## 常见问题

**车辆位置错误**：
- 检查 `updateMatrixWorld(true)` 调用
- 确认使用正确坐标系（模型 vs 世界）
- 检查 `vehicleToModelCoordinates()` 转换

**车辆倾角错误**：
- 确认 `rotation.order = 'YXZ'`
- 检查 `ELEVATION_CONFIG` 参数
- 使用 `testElevationAt()` 测试

**红绿灯控制反向**：
- 已修复：协议组号自动交换映射
- 第一组 → 实际第二组，第二组 → 实际第一组

**点击沙盘无响应**：
- 检查 `groundPlane` 使用世界坐标尺寸
- 确认地面高度不是硬编码 `y=0`

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

**版本**: v1.6 | **更新**: 2025-12-12 | **状态**: ✅ 高架倾角、红绿灯、UI折叠
