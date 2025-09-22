# 端口配置说明

## 概述

DZ-VIZ 应用使用多个端口来提供不同的服务。现在所有端口都集中在配置模块中管理，方便统一修改。

## 默认端口配置

| 服务 | 默认端口 | 用途 |
|-----|---------|------|
| Socket服务器 | 8888 | 车辆通信、数据传输 |
| UDP视频服务器 | 8080 | UDP视频流接收 |
| 视频流服务器 | 9001 | HTTP视频流、WebSocket |
| HLS服务器 | 9002 | HLS视频流服务 |

## 修改端口的方法

### 方法1：修改源代码（推荐）

编辑 `src/config.rs` 文件，在 `AppPorts::default()` 方法中修改默认值：

```rust
impl Default for AppPorts {
    fn default() -> Self {
        Self {
            socket_server: 8888,        // 修改这里
            udp_video_server: 8080,     // 修改这里
            video_stream_server: 9001,  // 修改这里
            hls_server: 9002,           // 修改这里
        }
    }
}
```

### 方法2：使用环境变量

设置以下环境变量来覆盖默认端口：

```bash
# macOS/Linux
export DZ_VIZ_SOCKET_PORT=8888
export DZ_VIZ_UDP_VIDEO_PORT=8080
export DZ_VIZ_VIDEO_STREAM_PORT=9001
export DZ_VIZ_HLS_PORT=9002

# Windows
set DZ_VIZ_SOCKET_PORT=8888
set DZ_VIZ_UDP_VIDEO_PORT=8080
set DZ_VIZ_VIDEO_STREAM_PORT=9001
set DZ_VIZ_HLS_PORT=9002
```

## 获取当前端口配置

应用提供了以下 API 来获取当前端口配置：

### 前端调用示例

```javascript
import { invoke } from '@tauri-apps/api/tauri';

// 获取车辆服务器端口
const vehiclePorts = await invoke('get_vehicle_server_ports');
console.log('Socket服务器端口:', vehiclePorts.socket_server);

// 获取媒体服务器端口
const mediaPorts = await invoke('get_media_server_ports');
console.log('视频流服务器端口:', mediaPorts.video_stream_server);
console.log('HLS服务器端口:', mediaPorts.hls_server);
console.log('UDP视频服务器端口:', mediaPorts.udp_video_server);
```

## 启动服务器时的端口使用

### Socket服务器
- 可以指定端口：`start_socket_server(port)`
- 推荐使用配置的默认端口

### UDP视频服务器
- 可以指定端口：`start_udp_video_server(port)` 
- 如果不指定端口，将使用配置的默认端口

### 视频流服务器
- 可以指定端口：`start_video_stream_server(port)`
- URL生成时会使用配置的默认端口（如果未指定）

### HLS服务器
- 可以指定端口：`start_hls_server(port)`
- 如果不指定端口，将使用配置的默认端口

## 应用启动时的端口信息

应用启动时会在日志中输出当前的端口配置：

```
[INFO] 🔧 端口配置:
[INFO]   Socket服务器: 8888
[INFO]   UDP视频服务器: 8080
[INFO]   视频流服务器: 9001
[INFO]   HLS服务器: 9002
```

## 注意事项

1. **端口冲突**：确保选择的端口没有被其他应用占用
2. **防火墙**：确保选择的端口没有被防火墙阻止
3. **重新编译**：修改源代码后需要重新编译应用
4. **环境变量优先级**：环境变量的设置会覆盖代码中的默认值
