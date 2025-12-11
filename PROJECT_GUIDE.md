# DZ-VIZ 项目快速参考

**版本**: v1.5+ | **更新**: 2025-12-11

---

## 项目概述

自动驾驶车辆可视化管理系统：Tauri + Vue 3 + Three.js

**核心功能**：多车辆实时3D可视化、AVP泊车、打车服务、施工标记、红绿灯系统、摄像头支持

---

## 最新修复 (2025-12-11)

### 1. 地面高度和点击交互修复
- **问题**：硬编码 `y=0` 导致标记在地下，点击无反应
- **修复**：使用射线检测的实际地面高度（约2.82）
- **位置**：`index.js` 第2383行、2430行

### 2. groundPlane 尺寸修复
- **问题**：使用局部坐标尺寸（6×5），但沙盘缩放6倍，导致有效区域太小
- **修复**：世界尺寸 = 局部尺寸 × 缩放因子，平面扩大2倍覆盖
- **位置**：`index.js` `createGroundPlane()` 函数

### 3. 关键矩阵更新
- **必须保留**：`model.updateMatrixWorld(true)` 在 `calculateSandboxDimensions()` 中
- **原因**：确保 `worldToLocal()` 使用最新矩阵，否则车辆和标记位置错误

### 4. 沙盘亮度优化
- 半球光：0.6 → 0.9
- 主光源：1.6 → 2.2
- 补光：0.7 → 1.0
- 背光：0.5 → 0.7
- 总强度：3.4 → 4.8

---

## 核心技术要点

### 坐标系统（最关键！）

```
车辆坐标: X(0-6.0m), Y(0-5.0m)  ← 客户端发送（逻辑尺寸）
    ↓ vehicleToModelCoordinates()
模型坐标: X(-3.0~3.0), Z(-2.5~2.5)  ← 沙盘局部坐标
    ↓ 沙盘缩放6倍
世界坐标: X(-18~18), Z(-15~15)  ← Three.js场景
```

**规则**：
- 添加到沙盘内部 → 使用局部坐标
- 添加到 Scene → 使用世界坐标
- groundPlane 在 Scene，需要世界坐标尺寸

### 沙盘模型信息

- **尺寸**：逻辑6m × 5m，缩放因子6
- **地面参照**：`Standardmaterial206`（新）/ `MD_CaoPing`（旧）
- **地面高度**：约2.82（世界坐标）
- **底座参照**：`Standardmaterial202`

### 关键文件位置

```
src/utils/coordinateTransform.js  ⭐⭐⭐ 坐标转换核心
src/components/Scene3D/index.js   ⭐⭐ 场景管理、地面检测
src/components/Scene3D/vehicleManager.js  ⭐⭐ 车辆管理
src/stores/car.js  ⭐ 车辆状态
src-tauri/src/socket_server/  UDP通信
```

---

## 性能优化 (2025-11-05)

### 已修复的关键瓶颈
1. ❌ 删除每帧的 `scene.traverse()` 更新 shader uTime
2. ✅ 禁用插值系统（对50Hz高频数据）
3. ✅ 前端快速比对，避免频繁 Rust IPC
4. ✅ 批量车辆更新机制
5. ✅ 简化坐标转换验证（生产环境）
6. ✅ 优化时间分片：`maxUpdatesPerFrame: 10`

**效果**：单帧开销从15-30ms → 3-5ms（减少80-85%），支持5+辆车流畅运行

---

## 摄像头架构 (v1.5)

**USB摄像头**：`getUserMedia()` → `<video>`
**RTSP摄像头**：`GStreamer` → `MJPEG` → `WebSocket` → `<img>`

### Linux USB 摄像头权限
```bash
sudo usermod -aG video $USER
sudo reboot  # 必须重启
```

### GStreamer 安装
**macOS (MacPorts)**：
```bash
sudo port install gstreamer1 gstreamer1-gst-plugins-base \
    gstreamer1-gst-plugins-good gstreamer1-gst-plugins-bad
export PKG_CONFIG_PATH=/opt/local/lib/pkgconfig:$PKG_CONFIG_PATH
```

**Ubuntu**：
```bash
sudo apt-get install libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev \
    gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav
```

---

## 红绿灯系统

**分组**：
- GROUP_2: [0, 2] - Zu1, Zu3
- GROUP_1: [1, 3, 4, 5, 6, 7] - Zu2, Zu4-Zu8

**命名规则**：
- Zu1：无后缀 `MD_HongLvDeng_Hong`
- Zu2-Zu8：使用 `_(N)` 后缀 `MD_HongLvDeng_Hong_(1)`

**倒计时区域**：`MD_HongLvDeng_Hui`

---

## 常见问题

### 车辆位置错误
- 检查 `updateMatrixWorld(true)` 是否被调用
- 检查坐标转换函数使用是否正确
- 检查是否使用了局部坐标 vs 世界坐标

### 点击沙盘无反应
- 检查 `groundPlane` 尺寸是否正确（世界坐标）
- 检查是否硬编码了 `y=0`
- 检查 `isEventFromCanvas()` 判断

### 车辆在天上或地下
- 检查地面高度是否正确获取
- 检查是否使用了局部坐标
- 使用 `getRoadSurfaceY()` 获取地面高度

---

## 调试命令

```javascript
// 浏览器控制台
window.__scene3d__.testGroundHeight()  // 测试地面高度
window.__scene3d__.getSandboxDimensionsInfo()  // 沙盘尺寸
window.__scene3d__.logSandboxInfo()  // 沙盘信息
window.__eventBus__.getActiveListeners()  // 事件监听器
```

---

## 协议与通信

**UDP端口**：8888（车辆通信）
**WebSocket端口**：3030（前后端通信）、9003（GStreamer MJPEG）

**发送协议**：
- `0x1001` - 车辆控制（初始化位姿）
- `0x1004` - AVP停车
- `0x1005` - 打车服务
- `0x1006` - 施工标记

**接收协议**：
- `0x0001` - 车辆信息
- `0x0002` - 红绿灯状态
- `0x0003` - 路径文件选择

---

## 待办事项

⚠️ **车位坐标需要重新测量**（当前是按比例计算的临时值）
- 使用位姿选择功能点击车位中心
- 更新 `coordinateTransform.js` 中的 `PARKING_SLOTS`

---

## 启动

```bash
# 开发
npm run tauri:dev

# 测试客户端
python test/test_client.py --id 1
```

---

**最后更新**: 2025-12-11 | **状态**: ✅ 完成地面检测和光照优化
