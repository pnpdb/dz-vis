# 🌐 Socket网络通信流程详解

## 📋 系统架构概述

```
小车客户端 <---> Tauri Socket服务端 <---> Vue前端界面
    |              |                      |
    |              |                      |
   TCP           Rust                  JavaScript
  Socket       后端处理                事件驱动
```

## 🔄 完整通信流程

### 1. 服务器启动流程

#### 1.1 前端启动Socket服务器
```javascript
// 文件: src/utils/socketManager.js
socketManager.startServer(8888)
  ↓
// 调用Tauri命令
invoke('start_socket_server', { port: 8888 })
  ↓
// Rust端处理
src-tauri/src/lib.rs::start_socket_server()
  ↓
// 创建Socket服务器
src-tauri/src/socket/server.rs::SocketServer::new()
  ↓
// 启动异步监听
server.start() -> TcpListener::bind("0.0.0.0:8888")
```

#### 1.2 服务器监听连接
```rust
// 文件: src-tauri/src/socket/server.rs
SocketServer::start()
  ↓
loop {
    listener.accept().await
    ↓
    tokio::spawn(handle_client)  // 为每个客户端创建独立任务
}
```

### 2. 客户端连接流程

#### 2.1 客户端连接建立
```
小车客户端连接 -> TCP Socket -> Tauri服务器
  ↓
handle_client(stream, addr, connections, app_handle)
  ↓
创建 mpsc::unbounded_channel 用于发送数据
  ↓
保存连接到 ConnectionManager (HashMap<String, ClientConnection>)
  ↓
生成临时car_id = "car_{ip_address}"
```

#### 2.2 连接管理
```rust
// 文件: src-tauri/src/socket/server.rs
ConnectionManager: Arc<RwLock<HashMap<String, ClientConnection>>>
  ↓
ClientConnection {
    car_id: String,
    addr: SocketAddr,
    sender: mpsc::UnboundedSender<Vec<u8>>
}
```

### 3. 数据接收流程

#### 3.1 原始数据接收
```rust
// 文件: src-tauri/src/socket/server.rs::handle_client()
tokio::select! {
    result = stream.read(&mut buffer) => {
        parser.feed_data(&buffer[..n])  // 添加到协议解析器
        ↓
        while let Ok(Some(message)) = parser.try_parse_message() {
            handle_message(message, car_id, app_handle)
        }
    }
}
```

#### 3.2 协议解析流程
```rust
// 文件: src-tauri/src/socket/protocol.rs
ProtocolParser::try_parse_message()
  ↓
1. 查找帧头 (0xEF 0xEF 0xEF 0xEF)
  ↓
2. 验证协议版本 (0x10)
  ↓
3. 解析时间戳 (8字节, 小端序)
  ↓
4. 解析消息类型 (2字节, 小端序)
  ↓
5. 解析数据域长度 (4字节, 小端序)
  ↓
6. 提取数据域 (N字节)
  ↓
7. 验证CRC16校验码 (2字节, 小端序)
  ↓
8. 验证帧尾 (0xFE 0xFE 0xFE 0xFE)
  ↓
返回 SocketMessage { timestamp, message_type, data }
```

#### 3.3 消息分发到前端
```rust
// 文件: src-tauri/src/socket/server.rs::handle_message()
创建前端消息 {
    "type": "socket_message",
    "car_id": car_id,
    "message_type": message_type,
    "timestamp": timestamp,
    "data": data
}
  ↓
app_handle.emit("socket-message", frontend_message)
```

### 4. 前端消息处理流程

#### 4.1 监听Socket消息
```javascript
// 文件: src/utils/socketManager.js
listen('socket-message', (event) => {
    socketManager.handleIncomingMessage(event.payload)
})
```

#### 4.2 消息类型分发
```javascript
// 文件: src/utils/socketManager.js::handleIncomingMessage()
const { car_id, message_type, timestamp, data } = payload
  ↓
// 查找对应的消息处理器
const handler = this.messageHandlers.get(message_type)
  ↓
if (handler) {
    handler(car_id, data, timestamp)  // 调用处理器
} else {
    handleUnknownMessage(car_id, message_type, data, timestamp)
}
```

#### 4.3 数据域解析 (用户自定义)
```javascript
// 文件: src/utils/socketManager.js
// 根据消息类型解析数据域
switch(message_type) {
    case RECEIVE_MESSAGE_TYPES.VEHICLE_STATUS:
        parseVehicleStatus(car_id, data, timestamp)
        break
    case RECEIVE_MESSAGE_TYPES.SENSOR_DATA:
        parseSensorData(car_id, data, timestamp)
        break
    // ... 其他消息类型
}
```

#### 4.4 UI更新
```javascript
// 文件: src/utils/socketManager.js::parseVehicleStatus()
// 解析完数据后触发UI更新事件
window.dispatchEvent(new CustomEvent('vehicle-status-update', {
    detail: { carId, speed, battery, status, timestamp }
}))
```

### 5. 前端发送消息流程

#### 5.1 UI事件触发
```javascript
// 文件: 各个Vue组件 (CarButton.vue, AutoDrive.vue等)
用户点击按钮
  ↓
调用 socketManager.startVehicle(carId)
  ↓
socketManager.sendToVehicle(carId, SEND_MESSAGE_TYPES.START_VEHICLE, data)
```

#### 5.2 前端发送请求
```javascript
// 文件: src/utils/socketManager.js::sendToVehicle()
invoke('send_to_vehicle', {
    car_id: carId,
    message_type: messageType,
    data: Array.from(data)
})
```

#### 5.3 后端消息构建和发送
```rust
// 文件: src-tauri/src/lib.rs::send_to_vehicle()
let connections = app.state::<ConnectionManager>()
  ↓
SocketServer::send_to_vehicle(&connections, &car_id, message_type, &data)
  ↓
// 文件: src-tauri/src/socket/server.rs::send_to_vehicle()
1. 查找目标车辆连接
2. 使用 build_message() 构建协议包
3. 通过 mpsc::channel 发送给对应的客户端任务
```

#### 5.4 协议包构建
```rust
// 文件: src-tauri/src/socket/protocol.rs::build_message()
1. 添加帧头 (0xEF 0xEF 0xEF 0xEF)
2. 添加协议版本 (0x10)
3. 添加时间戳 (8字节, 小端序)
4. 添加消息类型 (2字节, 小端序)
5. 添加数据域长度 (4字节, 小端序)
6. 添加数据域 (N字节)
7. 计算并添加CRC16校验码 (2字节, 小端序)
8. 添加帧尾 (0xFE 0xFE 0xFE 0xFE)
```

## 📁 文件和函数调用关系

### 核心文件结构
```
src-tauri/src/
├── lib.rs                     # Tauri命令定义
├── socket/
│   ├── mod.rs                 # 模块导出
│   ├── protocol.rs            # 协议解析和构建
│   └── server.rs              # Socket服务器逻辑

src/
├── constants/
│   └── messageTypes.js        # 消息类型常量
├── utils/
│   └── socketManager.js       # 前端Socket管理
└── components/
    ├── CarButton.vue          # 车辆控制按钮
    ├── AutoDrive.vue          # 自动驾驶控制
    └── ...                    # 其他UI组件
```

### 函数调用链

#### 接收数据流
```
小车客户端 -> TCP Socket
  ↓
server.rs::handle_client()
  ↓
protocol.rs::ProtocolParser::try_parse_message()
  ↓
server.rs::handle_message()
  ↓
app_handle.emit("socket-message")
  ↓
socketManager.js::handleIncomingMessage()
  ↓
socketManager.js::parseXXXData() (用户自定义)
  ↓
Vue组件UI更新
```

#### 发送数据流
```
Vue组件按钮点击
  ↓
socketManager.js::sendToVehicle()
  ↓
invoke('send_to_vehicle')
  ↓
lib.rs::send_to_vehicle()
  ↓
server.rs::SocketServer::send_to_vehicle()
  ↓
protocol.rs::build_message()
  ↓
mpsc::channel -> TCP Socket -> 小车客户端
```

## ⚙️ 配置和使用

### 1. 启动Socket服务器
```javascript
import { socketManager } from '@/utils/socketManager.js'

// 在应用启动时调用
socketManager.startServer(8888)
```

### 2. 自定义消息处理
```javascript
// 添加自定义消息处理器
socketManager.setMessageHandler(RECEIVE_MESSAGE_TYPES.CUSTOM_TYPE, (carId, data, timestamp) => {
    // 自定义解析逻辑
})

// 或直接修改socketManager.js中的parseXXXData方法
```

### 3. 发送控制命令
```javascript
// 启动车辆
await socketManager.startVehicle('car_192.168.1.100')

// 设置速度
await socketManager.setVehicleSpeed('car_192.168.1.100', 30.0)

// 紧急制动
await socketManager.emergencyBrake('car_192.168.1.100')
```

### 4. 监听车辆状态更新
```javascript
// 在Vue组件中监听状态更新
window.addEventListener('vehicle-status-update', (event) => {
    const { carId, speed, battery, status } = event.detail
    // 更新UI
})
```

## 🐛 调试和测试

### 1. 使用Python测试客户端
```bash
# 启动Tauri应用后运行
python test_client.py
```

### 2. 查看日志
- **Rust日志**: 在Tauri开发控制台查看
- **前端日志**: 在浏览器开发者工具查看
- **Socket连接**: 使用 `socketManager.getConnectedVehicles()`

### 3. 协议调试
- 使用Wireshark抓包分析TCP流量
- 检查CRC16校验是否正确
- 验证小端序字节序

## 🔧 扩展和维护

### 1. 添加新消息类型
1. 在 `messageTypes.js` 中添加新的消息类型常量
2. 在 `socketManager.js` 中添加对应的处理器
3. 根据需要添加发送方法

### 2. 修改协议格式
1. 更新 `protocol.rs` 中的解析和构建逻辑
2. 同步更新Python测试客户端
3. 更新文档

### 3. 性能优化
1. 调整缓冲区大小
2. 优化消息处理频率
3. 添加连接池管理

这个网络通信系统提供了完整的双向通信能力，支持多车辆连接和实时数据交换。
