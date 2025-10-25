# 红绿灯控制功能实现总结

## ✅ 已完成的工作

### 1. 红绿灯结构分析 ✓
- 使用分析脚本 `scripts/analyze_traffic_lights.js` 分析了沙盘模型中的红绿灯结构
- 发现8个红绿灯组，每组包含：红灯、黄灯、绿灯、倒计时文字、灰色背景
- 识别材质共享问题：所有红绿灯共享材质，需要克隆材质实现独立控制

### 2. 前端实现 ✓

#### 2.1 红绿灯管理器 (`src/components/Scene3D/trafficLightManager.js`)
- **功能**：
  - 初始化时查找所有8个红绿灯组
  - 为每个灯克隆材质，解决材质共享问题
  - 提供红绿灯分组控制（1组6个，2组2个）
  - 通过自发光（emissive）控制灯的亮灭
- **关键方法**：
  - `initTrafficLightManager(sandbox)` - 初始化
  - `setTrafficLightState(index, color, countdown)` - 设置单个红绿灯
  - `updateTrafficLightGroup(groupIndex, color, countdown)` - 更新组状态

#### 2.2 Scene3D 集成 (`src/components/Scene3D/index.js`)
- 在沙盘模型加载完成后初始化红绿灯管理器
- 导出 `updateTrafficLightGroup` 和 `isTrafficLightManagerInitialized` 接口

#### 2.3 协议处理 (`src/utils/socketManager.js`)
- 添加 `0x3001` 协议处理器 `handleTrafficLightStatus`
- 接收沙盘服务发送的红绿灯状态数据（2组）
- 调用 Scene3D 接口更新红绿灯显示

### 3. 后端实现 ✓

#### 3.1 协议定义 (`src/constants/messageTypes.js`)
```javascript
// 接收消息类型
SANDBOX_TRAFFIC_LIGHT_STATUS: 0x3001

// 协议数据域定义（6字节）
export const SANDBOX_TRAFFIC_LIGHT_PROTOCOL = {
    // 组1（6个红绿灯）
    GROUP1_COLOR_OFFSET: 0,      // 1字节
    GROUP1_COUNTDOWN_OFFSET: 1,  // 2字节 UINT16
    
    // 组2（2个红绿灯）
    GROUP2_COLOR_OFFSET: 3,      // 1字节
    GROUP2_COUNTDOWN_OFFSET: 4,  // 2字节 UINT16
    
    TOTAL_SIZE: 6,
    
    // 颜色定义
    COLOR_RED: 1,
    COLOR_GREEN: 2,
    COLOR_YELLOW: 3
}
```

#### 3.2 Rust 数据结构 (`src-tauri/src/protocol_processing/types.rs`)
- 定义 `SandboxTrafficLightState` - 单个红绿灯状态
- 定义 `SandboxTrafficLightStatusData` - 红绿灯状态集合
- 添加到 `ParsedProtocolData` 枚举
- 在 `MessageTypes` 中添加 `SANDBOX_TRAFFIC_LIGHT_STATUS = 0x3001`

#### 3.3 协议解析 (`src-tauri/src/protocol_processing/parser.rs`)
- 实现 `parse_sandbox_traffic_light_status` 方法
- 正确解析 6 字节数据（1字节颜色 + 2字节倒计时 × 2组）
- 添加调试日志

#### 3.4 Socket 服务器 (`src-tauri/src/socket/server.rs`)
- 已有 `0x3001` 协议处理逻辑
- 解析后发送到前端：
```rust
parsed_payload = Some(serde_json::json!({
    "type": "sandbox_traffic_light_status",
    "lights": status.lights
}));
```

### 4. 测试脚本 ✓

#### `test/sandbox_client.py`
已修改为发送2个红绿灯状态：
- **1组（6个红绿灯）**：红(10s) → 黄(10s) → 绿(5s)
- **2组（2个红绿灯）**：绿(10s) → 黄(5s) → 红(10s)
- 每秒发送一次更新

## 📊 红绿灯分组映射

| 模型名称 | 索引 | 分组 | 对应协议 |
|---------|------|------|---------|
| MD_HongLvDeng_Zu1 (无编号) | 0 | 2组 (2个) | lights[1] |
| MD_HongLvDeng_Zu2 (1) | 1 | 1组 (6个) | lights[0] |
| MD_HongLvDeng_Zu3 (2) | 2 | 2组 (2个) | lights[1] |
| MD_HongLvDeng_Zu4 (3) | 3 | 1组 (6个) | lights[0] |
| MD_HongLvDeng_Zu5 (4) | 4 | 1组 (6个) | lights[0] |
| MD_HongLvDeng_Zu6 (5) | 5 | 1组 (6个) | lights[0] |
| MD_HongLvDeng_Zu7 (6) | 6 | 1组 (6个) | lights[0] |
| MD_HongLvDeng_Zu8 (7) | 7 | 1组 (6个) | lights[0] |

**前端逻辑**：
```javascript
// lights[0] -> 1组（6个红绿灯）-> groupIndex = 1
// lights[1] -> 2组（2个红绿灯）-> groupIndex = 0
updateTrafficLightGroup(1, lights[0].color, lights[0].remaining);
updateTrafficLightGroup(0, lights[1].color, lights[1].remaining);
```

## 🧪 测试步骤

### 1. 启动应用
```bash
npm run tauri dev
```

### 2. 等待沙盘模型加载
查看控制台日志，确认：
```
✅ 红绿灯管理器已初始化
```

### 3. 启动沙盘客户端
```bash
python3 test/sandbox_client.py
```

### 4. 观察现象
- **1组（6个红绿灯）**：
  - 红灯亮10秒 → 黄灯亮10秒 → 绿灯亮5秒 → 循环
- **2组（2个红绿灯）**：
  - 绿灯亮10秒 → 黄灯亮5秒 → 红灯亮10秒 → 循环
- 倒计时数字区域也会随灯光颜色变化

### 5. 检查日志
浏览器控制台应显示：
```
[INFO][SocketManager] 收到红绿灯状态 - 1组(6个): 红灯 10秒, 2组(2个): 绿灯 10秒
```

Rust 日志应显示：
```
[INFO] 沙盘红绿灯状态: 2 个灯
[INFO]   - 灯0: 红灯 剩余 10 秒
[INFO]   - 灯1: 绿灯 剩余 10 秒
```

## 🎨 技术要点

### 材质克隆
Three.js 中多个对象共享材质时，修改一个会影响所有。解决方案：
```javascript
if (light.redLight && light.redLight.material) {
    light.redLight.material = light.redLight.material.clone();
}
```

### 自发光控制
使用 `emissive` 和 `emissiveIntensity` 控制灯的亮度：
```javascript
// 点亮红灯
material.emissive.setHex(0xff0000);
material.emissiveIntensity = 2;

// 熄灭
material.emissive.setHex(0x000000);
material.emissiveIntensity = 0;
```

### 倒计时显示
目前倒计时区域只显示颜色，不显示具体数字（数字建模较复杂）。
倒计时文字对象（`MD_HongLvDeng_WenZi`）会随灯光颜色同步发光。

### 协议映射
- **前端索引**：0-7（对应 Zu1-Zu8）
- **协议分组**：0 = 1组(6个), 1 = 2组(2个)
- **转换**：前端根据协议分组更新对应的红绿灯索引

## 📝 已知限制

1. **倒计时数字不显示具体数值**
   - 原因：`MD_HongLvDeng_WenZi` 是一个 Mesh，不是动态文本
   - 当前方案：只显示颜色发光，不显示数字
   - 改进方向：如果需要显示数字，可以：
     - 使用 CanvasTexture 动态生成数字纹理
     - 在倒计时对象上添加 Sprite
     - 修改 Blender 模型添加数字显示机制

2. **颜色值限制**
   - 协议只支持 1=红, 2=绿, 3=黄
   - 不支持其他颜色或灯全灭状态

## 🚀 下一步优化建议

1. **倒计时数字显示**
   - 使用 CanvasTexture 在倒计时区域动态绘制数字
   - 或使用 TextGeometry 创建 3D 文字

2. **性能优化**
   - 批量更新同组红绿灯，减少渲染调用
   - 添加红绿灯状态缓存，避免重复更新

3. **UI 增强**
   - 在设置界面添加红绿灯控制面板
   - 支持手动控制红绿灯切换

4. **协议扩展**
   - 支持更多灯光状态（闪烁、灭灯等）
   - 支持独立控制每个红绿灯

## 📂 相关文件清单

### 前端
- `src/components/Scene3D/trafficLightManager.js` - 红绿灯管理器（新建）
- `src/components/Scene3D/index.js` - Scene3D 集成
- `src/utils/socketManager.js` - 协议处理
- `src/constants/messageTypes.js` - 协议定义
- `scripts/analyze_traffic_lights.js` - 分析脚本（新建）

### 后端
- `src-tauri/src/protocol_processing/types.rs` - 数据结构定义
- `src-tauri/src/protocol_processing/parser.rs` - 协议解析
- `src-tauri/src/socket/server.rs` - Socket 服务器处理

### 测试
- `test/sandbox_client.py` - 沙盘客户端测试脚本

---

**实现完成时间**: 2025-10-25
**实现者**: AI Assistant
**状态**: ✅ 完成并可测试

