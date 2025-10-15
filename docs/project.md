# DZ 智能沙盘云控平台 - 项目总结

## 📋 项目概述

一个基于 **Tauri 2 + Vue 3 + Rust** 的跨平台桌面应用，用于远程控制自动驾驶车辆和3D沙盘可视化。

---

## 🏗️ 核心架构

### 技术栈

- **前端**: Vue 3 + Pinia + Element Plus + Three.js + Vite
- **后端**: Rust (Tauri 2) + Tokio + SQLx + Axum
- **通信**: TCP Socket (车辆/沙盘) + UDP (视频流) + Tauri IPC

### 架构原则 ⚠️ **必须遵守**

#### 1. 前后端职责分离

- ✅ **Rust 负责**：
  - 二进制协议解析/构建
  - 网络通信（TCP Socket、UDP）
  - 数据库操作
  - 计算密集型逻辑（状态比对、批量处理）

- ✅ **JS 负责**：
  - UI 渲染
  - 状态管理（Pinia Store）
  - 用户交互
  - 3D 可视化（Three.js）

- ❌ **禁止**：
  - JS 手动拼接二进制协议
  - Rust 直接操作 DOM

#### 2. 统一消息类型定义

- 消息类型由 Rust 导出 (`src-tauri/src/protocol_processing/message_types_config.rs`)
- 前端动态加载 (`src/constants/messageTypesLoader.js`)
- **不要**在前端硬编码协议常量

#### 3. 状态管理集中化

- 所有应用状态存储在 **Pinia Store** (`src/stores/car.js`)
- `socketManager` 只负责通信，通过 `carStore` 管理状态
- 车辆状态结构：
  ```javascript
  vehicles: Map<vehicleId, {
    connection: { isOnline, lastSeen, addr },
    state: { position, speed, battery, gear, orientation, ... },
    camera: { isManualOn, isActive },
    parking: { slotId },
    readiness: { isReady }
  }>
  ```

---

## 🔌 通信协议

### 协议结构（所有消息统一格式）

```
[帧头 4B: 0xEF×4] [版本 1B] [时间戳 8B] [消息类型 2B] [数据长度 4B] [数据域 N] [CRC16 2B] [帧尾 4B: 0xFE×4]
```

### 关键消息类型

| 消息类型 | 方向 | 说明 |
|---------|------|------|
| `0x0001` | 车辆→服务器 | 心跳包 |
| `0x0002` | 车辆→服务器 | 车辆信息（位置/速度/电量/档位等） |
| `0x1001` | 服务器→车辆 | 转向控制 |
| `0x1002` | 服务器→车辆 | 速度控制 |
| `0x1003` | 服务器→车辆 | 导航控制 |
| `0x1004` | 服务器→车辆 | 摄像头控制 |
| `0x1006` | 服务器→车辆 | 功能设置（数据记录等） |
| `0x2003` | 服务器→沙盘 | 沙盘灯光控制 |
| `0x3001` | 沙盘→服务器 | 红绿灯状态（动态长度） |

### 协议处理流程

```
接收流程：
Rust: [TCP/UDP 接收] → [Parser 解析] → [Validator 验证] → [Converter 转换] → [JSON]
  ↓ Tauri IPC
JS: [socketManager 接收] → [更新 carStore] → [触发 eventBus] → [UI 更新]

发送流程：
JS: [用户操作] → [调用 Tauri 命令]
  ↓ Tauri IPC
Rust: [Builder 构建] → [添加 CRC/帧头帧尾] → [TCP Socket 发送]
```

---

## 📂 关键代码结构

### Rust 端 (`src-tauri/src/`)

```
lib.rs                          # 主入口，注册 Tauri 命令
├── commands/                   # Tauri 命令模块
│   ├── vehicle.rs             # 车辆控制命令（含批量发送优化）
│   ├── vehicle_state.rs       # Rust 侧状态比对（性能优化）
│   ├── protocol_config.rs     # 导出消息类型配置
│   ├── video_processing.rs    # 视频帧处理
│   └── ...
├── socket/
│   └── server.rs              # TCP Socket 服务器核心
├── udp_video/
│   └── server.rs              # UDP 视频流服务器
├── protocol_processing/        # 协议处理核心模块
│   ├── parser.rs              # 二进制协议解析
│   ├── builder.rs             # 二进制协议构建
│   ├── validator.rs           # 数据验证
│   ├── converter.rs           # 数据格式转换
│   ├── types.rs               # 协议类型定义
│   ├── message_types_config.rs # 消息类型配置（导出给前端）
│   └── batch_processor.rs     # 批量处理优化
├── database/                   # SQLite 数据库
│   ├── vehicle_db.rs          # 车辆数据管理
│   └── models.rs              # 数据模型
├── utils/                      # 工具函数
│   ├── byte_utils.rs          # 字节数组工具
│   ├── time_utils.rs          # 时间戳工具
│   └── validation.rs          # 验证工具
└── error.rs                    # 统一错误类型定义
```

### Vue 端 (`src/`)

```
main.js                         # 应用入口，加载消息类型配置
├── stores/
│   └── car.js                 # Pinia 状态管理（核心！）
├── utils/
│   ├── socketManager.js       # Socket 通信管理（已优化：委托状态到 carStore）
│   ├── videoStreamManager.js  # 视频流管理（已优化：Blob URL 回收）
│   ├── videoProcessor.js      # 视频处理（已优化：超时清理）
│   ├── errorHandler.js        # 统一错误处理
│   ├── eventBus.js           # 事件总线
│   ├── eventThrottle.js      # 节流/防抖（性能优化）
│   ├── logger.js             # 日志工具
│   └── vehicleTypes.js       # 车辆类型工具
├── components/
│   ├── Scene3D/
│   │   ├── index.js          # Three.js 3D 场景（⚠️ 2300+ 行，待拆分）
│   │   └── index.vue         # 3D 场景组件包装
│   ├── ErrorBoundary.vue     # 错误边界组件
│   ├── TitleBar.vue          # 自定义标题栏
│   └── ...
├── views/
│   ├── MainLayout.vue        # 主界面布局
│   ├── Control.vue           # 控制界面（⚠️ 1300+ 行，待拆分）
│   ├── ParallelDriving.vue   # 平行驾驶界面
│   └── Map.vue               # 3D 地图视图
├── composables/               # Vue 组合式函数
│   ├── useSystemTime.js      # 系统时间
│   ├── useFPS.js             # FPS 监控
│   └── useNetworkStatus.js   # 网络状态
├── config/
│   └── constants.js          # 统一配置常量
└── constants/
    ├── messageTypes.js       # 消息类型（向后兼容，已废弃）
    └── messageTypesLoader.js # 动态加载消息类型
```

---

## 🎨 设计细节

### 性能优化（已实现）

1. **Rust 状态比对**
   - `is_vehicle_state_changed` 命令
   - 避免 JS 重复计算浮点数比较
   - 返回详细变化字段

2. **批量操作**
   - `batch_send_to_vehicles`: 并发发送不同消息到多车
   - `batch_broadcast_to_vehicles`: 广播相同消息到多车
   - 使用 `futures_util::join_all` 减少 IPC 开销

3. **事件节流**
   - `createThrottledEmitter` 用于高频事件
   - 车辆信息更新: 50ms
   - 连接状态: 100ms
   - 在线数量统计: 200ms

4. **Blob URL 回收**
   - `videoStreamManager` 自动释放旧视频帧
   - 防止内存泄漏

5. **超时清理**
   - `videoProcessor` 清理超时任务（10s）
   - 防止处理队列积压

6. **Tokio 优化**
   - 只启用必需的 features
   - `rt-multi-thread`, `macros`, `sync`, `time`, `net`, `io-util`, `fs`, `process`

### 错误处理（已统一）

#### Rust 端
- `error.rs` 定义 `AppError` 枚举
- 分类：车辆/协议/网络/数据库/文件/视频错误
- 使用 `thiserror` 简化错误定义

#### Vue 端
- `errorHandler.js` 全局捕获
  - Runtime 错误
  - Promise 未捕获错误
  - 资源加载错误
  - 网络错误
  - Vue 组件错误
- `ErrorBoundary.vue` 包裹关键组件（Scene3D）
- 错误分级：LOW / MEDIUM / HIGH / CRITICAL

### 代码规范

- **命名风格**：
  - Rust: `snake_case`
  - JS: `camelCase`
  - 常量: `UPPER_SNAKE_CASE`

- **常量管理**：
  - 集中在 `config/constants.js`
  - 分类：TIMING / LIMITS / DEFAULTS / VALIDATION

- **类型安全**：
  - 使用 `parseVehicleId()` 统一车辆 ID 类型
  - 使用 `normalizeVehicleData()` 标准化车辆数据

---

## ⚠️ 重要注意事项

### 修改代码时必须遵守

#### 1. 协议修改流程

```
步骤1: 更新 Rust 协议定义
  └─> src-tauri/src/protocol_processing/types.rs

步骤2: 更新消息类型配置（如果新增消息类型）
  └─> src-tauri/src/protocol_processing/message_types_config.rs

步骤3: 更新解析/构建逻辑
  ├─> parser.rs (接收)
  └─> builder.rs (发送)

步骤4: 前端自动加载
  └─> 无需修改，启动时自动从 Rust 加载
```

#### 2. 状态更新规范

```javascript
// ✅ 正确：通过 carStore 更新
const carStore = useCarStore()
carStore.updateVehicleConnection(vehicleId, true)
carStore.updateVehicleState(vehicleId, vehicleInfo)

// ❌ 错误：直接修改 socketManager
socketManager.connectedVehicles.set(vehicleId, true) // 已移除
```

#### 3. 事件通信规范

```javascript
// ✅ 正确：使用 eventBus + EVENTS 常量
import eventBus, { EVENTS } from '@/utils/eventBus'
eventBus.emit(EVENTS.VEHICLE_INFO_UPDATE, payload)

// ✅ 正确：高频事件使用节流
const throttledEmit = createThrottledEmitter(eventBus, EVENTS.VEHICLE_INFO_UPDATE, 50)
throttledEmit(payload)

// ❌ 错误：硬编码事件名
eventBus.emit('vehicle-info-update', payload)
```

#### 4. 资源清理规范

```javascript
// ✅ 正确：对称的资源管理
onMounted(() => {
  eventBus.on(EVENTS.SOME_EVENT, handler)
  window.addEventListener('resize', resizeHandler)
})

onBeforeUnmount(() => {
  eventBus.off(EVENTS.SOME_EVENT, handler)
  window.removeEventListener('resize', resizeHandler)
})

// ✅ 正确：Blob URL 清理
const blobUrl = URL.createObjectURL(blob)
// ... 使用后
URL.revokeObjectURL(blobUrl)
```

#### 5. 大文件拆分原则

- **单个文件不超过 1000 行**
- **单个函数不超过 100 行**
- **组件职责单一**

当前需要拆分：
- `Scene3D/index.js` (2300+ 行)
- `Control.vue` (1300+ 行)

---

## 🐛 已知问题

### 需要修复
1. **停车位状态不一致**: `state.parkingSlot` 和 `state.parking.slotId` 重复存储
2. **Blob URL 清理时机**: 应先创建新 URL，成功后再释放旧 URL

### 需要优化
1. **SQLx 版本过旧**: 当前 0.6，建议升级到 0.8 或迁移 rusqlite
2. **调试日志过多**: 部分日志未条件化，生产环境仍输出
3. **Scene3D 渲染**: 每帧遍历整个场景，应维护动画对象列表

### 待实现
1. **大组件拆分**: Scene3D 和 Control 组件过大
2. **数据库索引**: 高频查询字段缺少索引
3. **响应式优化**: Pinia Store 的 `vehicles` Map 可用 `shallowRef`

---

## 📦 打包配置

### Cargo 优化 (`src-tauri/Cargo.toml`)

```toml
[profile.release]
opt-level = 3              # 优化速度
lto = "thin"               # 链接时优化（平衡模式）
strip = true               # 移除调试符号
codegen-units = 16         # 平衡编译速度和优化
```

### Vite 优化 (`vite.config.js`)

```javascript
build: {
  minify: 'terser',
  terserOptions: {
    compress: {
      drop_console: true,    // 移除 console
      drop_debugger: true,
      pure_funcs: ['console.log', 'console.info', 'console.debug']
    }
  },
  rollupOptions: {
    output: {
      manualChunks: {
        'three': ['three'],          // 独立打包 Three.js
        'element-plus': ['element-plus']
      }
    }
  }
}
```

### Tauri 配置

- 开启 `devtools` 用于生产调试
- CSP 策略：允许 `ipc:`, `blob:`, `tauri:` 协议

---

## 🚀 继续开发建议

### 优先级 P0（立即修复）
1. 停车位状态不一致问题
2. Blob URL 清理时机问题

### 优先级 P1（本迭代）
1. Scene3D 渲染优化（维护动画对象列表）
2. 空值检查和类型安全
3. 并发安全性（Mutex → RwLock）
4. 事件监听器对称清理

### 优先级 P2（下迭代）
1. 大组件拆分（Scene3D、Control）
2. Pinia Store 响应式优化
3. 数据库查询索引
4. VideoProcessor 缓存键优化

### 优先级 P3（持续改进）
1. SQLx 版本升级
2. 调试日志条件化
3. JSDoc 文档补充
4. Rust 模块可见性收紧

---

## 📚 技术文档索引

- **协议文档**: 见各客户端测试代码 (`test/sandbox_client.py`)
- **数据库 Schema**: `src-tauri/src/database/vehicle_db.rs`
- **API 文档**: Rust 侧 `cargo doc --open`
- **架构图**: 见 `docs/architecture.md`（待创建）

---

## 🔗 快速链接

- **启动开发**: `npm run tauri:dev`
- **打包生产**: `npm run tauri:build`
- **Rust 检查**: `cargo check --manifest-path=src-tauri/Cargo.toml`
- **前端构建**: `npm run build`

---

**最后更新**: 2025-10-15
**版本**: v0.1.0

