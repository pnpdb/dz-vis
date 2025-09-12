# 🔌 Socket通信系统使用指南

## 🎯 系统概述

已成功实现完整的Socket通信系统，支持Tauri服务端接收小车客户端连接，按自定义二进制协议解析消息，并支持双向通信。

## 🚀 快速开始

### 1. 启动应用
```bash
npm run tauri:dev
```
应用启动后，Socket服务器会自动在端口8888启动。

### 2. 测试连接
```bash
# 运行Python测试客户端
python test_client.py
```

### 3. 查看日志
- **前端日志**: 浏览器开发者工具 Console
- **Rust日志**: Tauri开发控制台
- **Socket状态**: 前端会显示连接的车辆数量

## 📋 协议格式

### 数据包结构
```
+--------+--------+--------+--------+--------+--------+--------+--------+
| 帧头(4) | 版本(1) | 时间戳(8) | 消息类型(2) | 数据长度(4) | 数据域(N) | CRC(2) | 帧尾(4) |
+--------+--------+--------+--------+--------+--------+--------+--------+
```

### 字段说明
- **帧头**: `0xEF 0xEF 0xEF 0xEF`
- **版本**: `0x10` (1.0版本)
- **时间戳**: 64位无符号整数，小端序
- **消息类型**: 16位无符号整数，小端序
- **数据长度**: 32位无符号整数，小端序
- **数据域**: 实际数据
- **CRC**: CRC16校验码，小端序
- **帧尾**: `0xFE 0xFE 0xFE 0xFE`

## 🔄 消息类型

### 接收消息类型 (从小车接收)
```javascript
HEARTBEAT: 0x0001,       // 心跳包
VEHICLE_STATUS: 0x0002,  // 车辆状态
SENSOR_DATA: 0x0003,     // 传感器数据
GPS_LOCATION: 0x0004,    // GPS位置
ERROR_REPORT: 0x0006,    // 错误报告
// ... 更多类型见 messageTypes.js
```

### 发送消息类型 (发送给小车)
```javascript
START_VEHICLE: 0x1002,   // 启动车辆
STOP_VEHICLE: 0x1003,    // 停止车辆
EMERGENCY_BRAKE: 0x1005, // 紧急制动
SET_SPEED: 0x1004,       // 设置速度
// ... 更多类型见 messageTypes.js
```

## 🛠️ 前端API使用

### 基本操作
```javascript
import { socketManager } from '@/utils/socketManager.js'

// 启动Socket服务器 (应用启动时自动调用)
await socketManager.startServer(8888)

// 获取连接的车辆
const vehicles = await socketManager.getConnectedVehicles()

// 发送消息给指定车辆
await socketManager.sendToVehicle(carId, messageType, data)

// 广播消息给所有车辆
await socketManager.broadcastMessage(messageType, data)
```

### 车辆控制
```javascript
const carId = 'car_127.0.0.1'

// 启动车辆
await socketManager.startVehicle(carId)

// 停止车辆
await socketManager.stopVehicle(carId)

// 紧急制动
await socketManager.emergencyBrake(carId)

// 设置速度
await socketManager.setVehicleSpeed(carId, 30.0)

// 请求状态
await socketManager.requestVehicleStatus(carId)
```

### 自定义消息处理
```javascript
// 设置自定义消息处理器
socketManager.setMessageHandler(RECEIVE_MESSAGE_TYPES.CUSTOM_TYPE, (carId, data, timestamp) => {
    // 自定义处理逻辑
    console.log(`收到自定义消息 - 车辆: ${carId}`, data)
})

// 修改现有数据域解析方法
// 编辑 socketManager.js 中的 parseVehicleStatus 等方法
```

## 🔧 数据域解析示例

### 车辆状态解析
```javascript
// 在 socketManager.js 中修改此方法
parseVehicleStatus(carId, data, timestamp) {
    if (data.length >= 8) {
        const view = new DataView(new Uint8Array(data).buffer)
        
        const speed = view.getFloat32(0, true)     // 速度 (小端序)
        const battery = view.getUint8(4)           // 电池电量
        const status = view.getUint8(5)            // 车辆状态
        
        console.log(`车辆 ${carId} - 速度: ${speed}, 电量: ${battery}%, 状态: ${status}`)
        
        // 触发UI更新事件
        window.dispatchEvent(new CustomEvent('vehicle-status-update', {
            detail: { carId, speed, battery, status, timestamp }
        }))
    }
}
```

### GPS位置解析
```javascript
parseGPSLocation(carId, data, timestamp) {
    if (data.length >= 24) {
        const view = new DataView(new Uint8Array(data).buffer)
        
        const latitude = view.getFloat64(0, true)   // 纬度
        const longitude = view.getFloat64(8, true)  // 经度
        const altitude = view.getFloat32(16, true)  // 高度
        const speed = view.getFloat32(20, true)     // 速度
        
        console.log(`GPS位置 ${carId} - 纬度: ${latitude}, 经度: ${longitude}`)
        
        // 更新地图显示
        window.dispatchEvent(new CustomEvent('gps-location-update', {
            detail: { carId, latitude, longitude, altitude, speed, timestamp }
        }))
    }
}
```

## 🎛️ Vue组件集成

### 监听车辆状态
```vue
<script setup>
import { onMounted, onUnmounted } from 'vue'

const handleVehicleStatusUpdate = (event) => {
    const { carId, speed, battery, status } = event.detail
    // 更新组件状态
}

onMounted(() => {
    window.addEventListener('vehicle-status-update', handleVehicleStatusUpdate)
})

onUnmounted(() => {
    window.removeEventListener('vehicle-status-update', handleVehicleStatusUpdate)
})
</script>
```

### 发送控制命令
```vue
<template>
    <button @click="startVehicle">启动车辆</button>
    <button @click="stopVehicle">停止车辆</button>
</template>

<script setup>
import { socketManager } from '@/utils/socketManager.js'

const currentCarId = 'car_127.0.0.1'

const startVehicle = async () => {
    try {
        await socketManager.startVehicle(currentCarId)
        ElMessage.success('启动命令已发送')
    } catch (error) {
        ElMessage.error('启动失败')
    }
}

const stopVehicle = async () => {
    try {
        await socketManager.stopVehicle(currentCarId)
        ElMessage.success('停止命令已发送')
    } catch (error) {
        ElMessage.error('停止失败')
    }
}
</script>
```

## 🐛 测试和调试

### 1. 使用Python测试客户端
```bash
# 启动测试客户端
python test_client.py

# 测试客户端会发送以下数据:
# - 心跳包 (每10秒)
# - 车辆状态 (每8秒)
# - 传感器数据 (每8秒)
# - GPS位置 (每8秒)
# - 错误报告 (每40秒)
```

### 2. 查看连接状态
```javascript
// 在浏览器控制台执行
const vehicles = await socketManager.getConnectedVehicles()
console.log('已连接车辆:', vehicles)
```

### 3. 手动发送消息
```javascript
// 发送自定义消息
await socketManager.sendToVehicle(
    'car_127.0.0.1', 
    0x1001, 
    new TextEncoder().encode('test_command')
)
```

### 4. 网络抓包分析
使用Wireshark抓取localhost的TCP流量，过滤器：
```
tcp.port == 8888
```

## 📁 文件结构

### 后端文件 (Rust)
```
src-tauri/src/
├── lib.rs                 # Tauri命令定义
└── socket/
    ├── mod.rs             # 模块导出
    ├── protocol.rs        # 协议解析和构建
    └── server.rs          # Socket服务器逻辑
```

### 前端文件 (JavaScript)
```
src/
├── constants/
│   └── messageTypes.js    # 消息类型定义
├── utils/
│   └── socketManager.js   # Socket管理器
└── components/
    └── CarButton.vue      # 车辆控制组件 (示例)
```

### 测试和文档
```
├── test_client.py         # Python测试客户端
├── network.md            # 网络流程详解
└── SOCKET_USAGE_GUIDE.md # 本使用指南
```

## ⚠️ 注意事项

### 1. 端口配置
- 默认端口: 8888
- 可在 `src/config/app.js` 中修改
- 确保防火墙允许此端口

### 2. 车辆ID管理
- 目前使用IP地址生成临时ID: `car_{ip}`
- 建议通过协议消息获取真实车辆ID
- 可在连接建立后发送身份验证消息

### 3. 错误处理
- 所有Socket操作都有异常处理
- 连接断开会自动清理资源
- 协议解析错误会跳过无效数据包

### 4. 性能考虑
- 使用异步IO，支持大量并发连接
- 协议解析优化，支持粘包和分包
- 自动垃圾数据清理

## 🔄 扩展开发

### 1. 添加新消息类型
1. 在 `messageTypes.js` 中添加常量
2. 在 `socketManager.js` 中添加处理器
3. 根据需要添加发送方法

### 2. 修改协议格式
1. 更新 `protocol.rs` 解析逻辑
2. 同步更新Python测试客户端
3. 更新文档

### 3. 添加身份验证
1. 定义认证消息类型
2. 在连接建立后进行身份验证
3. 维护车辆ID到连接的映射

### 4. 数据持久化
1. 将接收的数据保存到数据库
2. 实现历史数据查询
3. 添加数据统计功能

## ✅ 完成状态

- [x] Socket协议解析和构建
- [x] Rust Socket服务器实现
- [x] 前端Socket管理器
- [x] Vue组件集成
- [x] Python测试客户端
- [x] 完整的错误处理
- [x] 详细的文档说明
- [x] 网络流程说明

Socket通信系统已完全实现并可以投入使用! 🎉
