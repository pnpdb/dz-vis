# 编码规范与命名约定

## 目录

1. [命名规范](#命名规范)
2. [文件组织](#文件组织)
3. [代码风格](#代码风格)
4. [错误处理](#错误处理)
5. [注释规范](#注释规范)

## 命名规范

### Rust 命名规范

遵循 Rust 标准命名约定（`snake_case`）：

```rust
// ✅ 正确示例
// 模块名：snake_case
mod protocol_processing;
mod vehicle_control;

// 函数名：snake_case
fn parse_vehicle_info() { }
fn send_control_command() { }

// 变量名：snake_case
let vehicle_id = 1;
let current_timestamp = get_timestamp();

// 常量名：SCREAMING_SNAKE_CASE
const MAX_VEHICLE_COUNT: u8 = 255;
const DEFAULT_PORT: u16 = 8888;

// 类型名（结构体、枚举、Trait）：PascalCase
struct VehicleInfo { }
enum MessageType { }
trait Processor { }

// 枚举变体：PascalCase
enum AppError {
    VehicleNotConnected(i32),
    InvalidMessageType(u16),
}
```

```rust
// ❌ 错误示例
fn parseVehicleInfo() { }  // 应该是 parse_vehicle_info
let vehicleId = 1;         // 应该是 vehicle_id
const maxVehicleCount = 255; // 应该是 MAX_VEHICLE_COUNT
```

### JavaScript/Vue 命名规范

遵循 JavaScript 标准命名约定（`camelCase`）：

```javascript
// ✅ 正确示例
// 文件名：camelCase 或 PascalCase（组件）
// socketManager.js
// CarInfo.vue

// 变量名、函数名：camelCase
const vehicleId = 1;
function parseVehicleInfo() { }
const currentTimestamp = getCurrentTimestamp();

// 常量：SCREAMING_SNAKE_CASE
const MAX_VEHICLE_COUNT = 255;
const DEFAULT_PORT = 8888;

// 类名、组件名：PascalCase
class VehicleManager { }
export default {
  name: 'CarInfo'
}

// 私有成员：_camelCase（可选）
const _internalState = {};
function _helperFunction() { }
```

```javascript
// ❌ 错误示例
const VehicleId = 1;         // 应该是 vehicleId
function ParseVehicleInfo() { } // 应该是 parseVehicleInfo
const max_vehicle_count = 255; // 应该是 MAX_VEHICLE_COUNT
```

### 跨语言对应关系

Rust 和 JavaScript 之间的命名转换：

| Rust (snake_case)       | JavaScript (camelCase)  | 说明           |
|-------------------------|-------------------------|----------------|
| `vehicle_id`            | `vehicleId`             | 变量           |
| `parse_vehicle_info`    | `parseVehicleInfo`      | 函数           |
| `is_valid_ip`           | `isValidIp`             | 布尔函数       |
| `MAX_VEHICLE_COUNT`     | `MAX_VEHICLE_COUNT`     | 常量（一致）   |
| `VehicleInfo`           | `VehicleInfo`           | 类型（一致）   |

## 文件组织

### Rust 项目结构

```
src-tauri/src/
├── commands/           # Tauri 命令（前端调用接口）
├── protocol_processing/ # 协议处理
├── utils/              # 通用工具
├── error.rs            # 统一错误类型
├── config.rs           # 配置管理
└── lib.rs              # 库入口
```

**规则**：
- 每个功能模块独立目录
- 使用 `mod.rs` 作为模块入口
- 相关功能分组（如 `protocol_processing/`）

### JavaScript 项目结构

```
src/
├── components/         # Vue 组件（PascalCase）
├── views/              # 页面组件（PascalCase）
├── utils/              # 工具函数（camelCase）
├── stores/             # Pinia 状态管理
├── config/             # 配置
└── constants/          # 常量定义
```

**规则**：
- Vue 组件使用 PascalCase
- 工具模块使用 camelCase
- 每个模块单一职责

## 代码风格

### Rust 代码风格

```rust
// ✅ 使用 clippy 和 rustfmt
// 运行前格式化：cargo fmt
// 运行检查：cargo clippy

// 函数文档注释
/// 解析车辆信息
/// 
/// # Arguments
/// * `data` - 原始字节数据
/// 
/// # Returns
/// 解析后的车辆信息结构
/// 
/// # Errors
/// 如果数据格式无效，返回 `AppError::ProtocolParseFailed`
pub fn parse_vehicle_info(data: &[u8]) -> AppResult<VehicleInfo> {
    // 实现...
}

// 使用类型别名简化
pub type AppResult<T> = Result<T, AppError>;

// 优先使用 ? 操作符处理错误
let value = read_u8(data, offset)?;
```

### JavaScript 代码风格

```javascript
// ✅ 使用 JSDoc 注释
/**
 * 解析车辆信息
 * @param {Uint8Array} data - 原始字节数据
 * @returns {Object} 解析后的车辆信息
 * @throws {Error} 如果数据格式无效
 */
export function parseVehicleInfo(data) {
    // 实现...
}

// 使用解构和箭头函数
const { vehicleId, speed } = vehicleInfo;
const filtered = vehicles.filter(v => v.isOnline);

// 优先使用 const/let，避免 var
const MAX_SPEED = 10;
let currentSpeed = 0;

// 使用模板字符串
const message = `车辆${vehicleId}当前速度：${speed} m/s`;
```

## 错误处理

### Rust 错误处理

```rust
// ✅ 使用统一的 AppError 类型
use crate::error::{AppError, AppResult};

// Tauri 命令返回 Result<T, String>
#[tauri::command]
pub async fn send_vehicle_control(
    vehicle_id: u8,
    command: String,
) -> Result<String, String> {
    match internal_send(vehicle_id, command) {
        Ok(result) => Ok(result),
        Err(e) => Err(e.to_string()),  // AppError 自动转换为 String
    }
}

// 内部函数使用 AppResult
fn internal_send(vehicle_id: u8, command: String) -> AppResult<String> {
    if vehicle_id == 0 {
        return Err(AppError::InvalidVehicleId(vehicle_id));
    }
    
    // 使用 ? 操作符传播错误
    let connection = get_connection(vehicle_id)?;
    connection.send(command)?;
    
    Ok("成功".to_string())
}
```

### JavaScript 错误处理

```javascript
// ✅ 使用 try-catch + async/await
import { wrapTauriCommand } from '@/utils/globalErrorHandler';

async function sendVehicleControl(vehicleId, command) {
    try {
        // 使用包装的 Tauri 命令，自动处理错误
        const result = await wrapTauriCommand(
            invoke,
            'send_vehicle_control'
        )('send_vehicle_control', { vehicleId, command });
        
        return result;
    } catch (error) {
        // 特定错误处理
        if (error.code === 'VEHICLE_NOT_CONNECTED') {
            ElMessage.warning('车辆未连接');
        }
        throw error; // 重新抛出供上层处理
    }
}
```

## 注释规范

### Rust 注释

```rust
//! 模块级文档（在文件顶部）
//! 
//! 协议处理模块
//! 负责所有二进制协议的解析和组装

/// 结构体文档
/// 
/// 车辆信息数据结构
#[derive(Debug, Clone)]
pub struct VehicleInfo {
    /// 车辆ID（1-255）
    pub vehicle_id: u8,
    
    /// 当前速度（m/s）
    pub speed: f64,
}

/// 函数文档
/// 
/// # 示例
/// ```
/// let info = parse_vehicle_info(&data)?;
/// println!("速度: {}", info.speed);
/// ```
pub fn parse_vehicle_info(data: &[u8]) -> AppResult<VehicleInfo> {
    // 内联注释：解释复杂逻辑
    let offset = PROTOCOL_CONSTANTS.header_size + 8; // 跳过帧头和时间戳
    
    // TODO: 添加CRC校验
    // FIXME: 处理大端序数据
    
    Ok(VehicleInfo { /* ... */ })
}
```

### JavaScript 注释

```javascript
/**
 * 车辆管理器
 * @module utils/vehicleManager
 */

/**
 * 车辆信息类
 * @class
 */
export class VehicleInfo {
    /**
     * 创建车辆信息实例
     * @param {number} vehicleId - 车辆ID
     * @param {number} speed - 速度
     */
    constructor(vehicleId, speed) {
        /** @type {number} 车辆ID */
        this.vehicleId = vehicleId;
        
        /** @type {number} 当前速度（m/s） */
        this.speed = speed;
    }
    
    /**
     * 判断是否在运动
     * @returns {boolean} 是否在运动
     */
    isMoving() {
        return this.speed > 0.1;
    }
}

// 单行注释：解释复杂逻辑
const offset = HEADER_SIZE + 8; // 跳过帧头和时间戳

// TODO: 添加CRC校验
// FIXME: 处理大端序数据
```

## 常量和配置

### Rust 常量

```rust
// 集中在专用模块
pub mod constants {
    /// 最大车辆数量
    pub const MAX_VEHICLE_COUNT: u8 = 255;
    
    /// 默认端口
    pub const DEFAULT_PORT: u16 = 8888;
    
    /// 协议版本
    pub const PROTOCOL_VERSION: u8 = 0x10;
}
```

### JavaScript 常量

```javascript
// 集中在 config/constants.js
export const TIMING = {
    APP_INIT_DELAY: 1000,
    SOCKET_START_DELAY: 2000,
};

export const LIMITS = {
    MAX_VEHICLE_COUNT: 255,
    MAX_BATCH_SIZE: 100,
};
```

## 工具函数

### 避免重复代码

**原则**：如果同一逻辑出现 3 次或以上，应提取为工具函数

#### Rust 工具函数

```rust
// src-tauri/src/utils/byte_utils.rs
pub fn bytes_to_hex(bytes: &[u8]) -> String { /* ... */ }
pub fn read_u8(data: &[u8], offset: usize) -> Result<u8, String> { /* ... */ }
```

#### JavaScript 工具函数

```javascript
// src/utils/byteUtils.js
export function bytesToHex(bytes) { /* ... */ }
export function readU8(data, offset) { /* ... */ }
```

## 性能最佳实践

### Rust

```rust
// ✅ 避免不必要的克隆
fn process_data(data: &[u8]) { }  // 使用引用

// ✅ 使用迭代器而不是循环
let sum: u32 = values.iter().sum();

// ✅ 并发处理
use futures_util::future::join_all;
let results = join_all(tasks).await;
```

### JavaScript

```javascript
// ✅ 使用节流/防抖
import { throttle } from '@/utils/eventThrottle';
const handleUpdate = throttle(update, 50);

// ✅ 避免不必要的重渲染
const memoizedValue = computed(() => expensiveComputation());

// ✅ 批量操作
await batchSendToVehicles(messages);
```

## 总结

### 核心原则

1. **一致性**：同一语言内保持命名风格一致
2. **清晰性**：函数和变量名清晰表达意图
3. **简洁性**：避免冗长的命名，但不牺牲可读性
4. **文档化**：关键函数和复杂逻辑必须有注释
5. **DRY 原则**：Don't Repeat Yourself - 提取重复代码为工具函数
6. **职责分离**：Rust 处理性能关键逻辑，JavaScript 处理 UI 和用户交互

### 检查清单

编写代码前问自己：
- [ ] 命名是否遵循语言约定？
- [ ] 是否有重复代码可以提取？
- [ ] 错误处理是否统一和完善？
- [ ] 是否有必要的文档注释？
- [ ] 是否使用了合适的常量而非魔法数字？
- [ ] 性能是否已优化（节流、批量操作）？

