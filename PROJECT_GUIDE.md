# DZ-VIZ 项目技术指南

> **版本**: v1.5 | **更新日期**: 2025-11-02 | **作者**: AI Assistant

---

## 📑 文档目录

### 🚀 快速开始
- [项目概述](#-项目概述)
- [技术栈](#-技术栈)
- [快速进入新会话（当前进度与已知问题）](#-快速进入新会话当前进度与已知问题)
  - [快速故障排查索引](#-快速故障排查索引)
  - [Toast 通知系统](#a-toast-通知系统--已完成自定义实现-2025-10-27)
  - [3D 红绿灯倒计时](#b-3d-红绿灯倒计时--已解决-2025-10-27)
  - [GStreamer MJPEG & Linux 摄像头](#c-gstreamer-mjpeg-流媒体--linux-摄像头权限--已完成-2025-11-02)

### 📚 核心概念
- [最近更新](#-最近更新)
- [坐标系统（重要！）](#-核心概念坐标系统重要)
- [重要配置项速查](#-重要配置项速查)

### 🔧 开发指南
- [项目结构](#-项目结构)
- [关键模块详解](#-关键模块详解)
- [开发工作流程](#-开发工作流程)
- [调试技巧速查](#调试技巧速查)
- [常见修改场景](#常见修改场景)

### 🎨 架构与设计
- [事件总线机制](#-事件总线机制)
- [数据流图](#-数据流图)
- [UI 组件层级](#-ui-组件层级)

### 📊 运维与优化
- [性能监控与优化](#-性能监控与优化)
- [常见问题排查](#-常见问题排查)
- [启动和测试](#-启动和测试)
- [代码质量与最佳实践](#-代码质量与最佳实践-2025-10-27)

### 📖 参考
- [版本历史与重要里程碑](#-版本历史与重要里程碑)
- [开发注意事项](#-开发注意事项)
- [参考资料](#-参考资料)
- [总结](#-总结)

---

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

## ✨ 最近更新

### 🎥 v1.5 (2025-11-02) - GStreamer MJPEG 流媒体架构 & 全面内存泄漏修复

#### 1. RTSP 流媒体方案彻底重构：MSE → GStreamer + MJPEG

**架构变更**：
```
旧方案（v1.3-v1.4）：RTSP → FFmpeg → fMP4(stdout) → WebSocket → MSE → <video>
新方案（v1.5）：     RTSP → GStreamer → JPEG → WebSocket → <img>/<canvas>
```

**核心优势**：
- ✅ **跨平台稳定性**：解决 Ubuntu 下 RTSP 播放问题（帧率低、延迟高）
- ✅ **简化架构**：MJPEG 比 fMP4 更简单，无需复杂的 MediaSource API
- ✅ **更好的兼容性**：<img> 和 <canvas> 支持所有浏览器和 WebView
- ✅ **低延迟**：直接显示 JPEG 帧，无需解码缓冲
- ✅ **内存效率**：智能帧跳过机制，防止积压

**关键技术决策**：
1. **为什么选择 GStreamer**：
   - 原生支持 RTSP（比 FFmpeg 更稳定）
   - 强大的 pipeline 架构（易于优化）
   - 跨平台支持（macOS/Ubuntu/Windows）
   - 活跃的社区和文档

2. **为什么选择 MJPEG**：
   - 简单直接（每帧独立 JPEG）
   - 无需维护解码器状态
   - 兼容性极好（所有浏览器）
   - 便于实现帧跳过

3. **为什么使用 <img> 而非 <video>**：
   - MJPEG 不是标准视频格式
   - <img> 更轻量，性能更好
   - 支持 USB 和 RTSP 双模式切换

**核心文件变更**：

1. **前端 MJPEG 播放器**（`src/utils/mjpegPlayer.js` - ✅ 新增）
   ```javascript
   export class MjpegPlayer {
     constructor(element, wsUrl, cameraId) {
       this.element = element;        // <img> 或 <canvas>
       this.ws = null;                // WebSocket 连接
       this.isProcessingFrame = false; // 帧处理标志
       this.pendingFrame = null;      // 待处理帧
       this.droppedFrames = 0;        // 丢帧计数
       this._currentObjectUrl = null;  // 当前 Blob URL
     }
     
     // 智能帧跳过：优先显示最新帧
     async handleJpegFrame(jpegData) {
       if (this.isProcessingFrame) {
         this.pendingFrame = jpegData;  // 保存最新帧
         this.droppedFrames++;
         return;
       }
       
       this.isProcessingFrame = true;
       
       if (this.element.tagName === 'IMG') {
         // <img> 模式：使用 Blob URL
         const blob = new Blob([jpegData], { type: 'image/jpeg' });
         const url = URL.createObjectURL(blob);
         this.element.src = url;
         
         // 等待加载完成后释放旧 URL
         this.element.onload = () => {
           if (this._currentObjectUrl) {
             URL.revokeObjectURL(this._currentObjectUrl);
           }
           this._currentObjectUrl = url;
           this.isProcessingFrame = false;
           this.processNextFrame();  // 处理待处理帧
         };
       } else if (this.element.tagName === 'CANVAS') {
         // <canvas> 模式：使用 createImageBitmap（更高性能）
         const blob = new Blob([jpegData], { type: 'image/jpeg' });
         const imageBitmap = await createImageBitmap(blob);
         
         const ctx = this.element.getContext('2d');
         ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
         imageBitmap.close();  // 释放资源
         
         this.isProcessingFrame = false;
         this.processNextFrame();
       }
     }
     
     processNextFrame() {
       if (this.pendingFrame) {
         const frame = this.pendingFrame;
         this.pendingFrame = null;
         this.handleJpegFrame(frame);
       }
     }
   }
   ```

2. **Rust GStreamer 流管理器**（`src-tauri/src/gstreamer_streamer/mod.rs` - ✅ 新增）
   ```rust
   pub struct GStreamerStreamer {
       pipelines: Arc<RwLock<HashMap<u32, gst::Pipeline>>>,
       broadcasters: Arc<RwLock<HashMap<u32, broadcast::Sender<Vec<u8>>>>>,
   }
   
   impl GStreamerStreamer {
       pub async fn start_stream(&self, camera_id: u32, rtsp_url: String) -> Result<()> {
           // 构建 GStreamer pipeline
           let pipeline_str = format!(
               "rtspsrc location={} latency=0 ! \
                rtph264depay ! avdec_h264 ! \
                videoscale ! videoconvert ! \
                jpegenc ! appsink name=sink",
               rtsp_url
           );
           
           let pipeline = gst::parse_launch(&pipeline_str)?;
           let appsink = pipeline.by_name("sink").unwrap()
               .dynamic_cast::<gst_app::AppSink>().unwrap();
           
           // 创建广播通道（容量 10，低延迟）
           let (tx, _) = broadcast::channel(10);
           
           // appsink 回调：拉取 JPEG 数据并广播
           appsink.set_callbacks(
               gst_app::AppSinkCallbacks::builder()
                   .new_sample(move |sink| {
                       let sample = sink.pull_sample().map_err(|_| gst::FlowError::Error)?;
                       let buffer = sample.buffer().ok_or(gst::FlowError::Error)?;
                       let map = buffer.map_readable().map_err(|_| gst::FlowError::Error)?;
                       
                       let jpeg_data = map.as_slice().to_vec();
                       let _ = tx.send(jpeg_data);  // 广播给所有 WebSocket 客户端
                       
                       Ok(gst::FlowSuccess::Ok)
                   })
                   .build(),
           );
           
           // 启动 pipeline
           pipeline.set_state(gst::State::Playing)?;
           
           // 监听 pipeline 错误
           self.spawn_bus_message_handler(camera_id, pipeline.clone());
           
           Ok(())
       }
   }
   ```

3. **WebSocket 服务器**（`src-tauri/src/gstreamer_streamer/websocket.rs` - ✅ 新增）
   ```rust
   pub async fn start_websocket_server(port: u16) -> Result<()> {
       let app = Router::new()
           .route("/mjpeg", get(handle_mjpeg_stream));
       
       let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port)).await?;
       axum::serve(listener, app).await?;
       Ok(())
   }
   
   async fn handle_mjpeg_stream(ws: WebSocketUpgrade) -> Response {
       ws.on_upgrade(|socket| async move {
           let (mut sender, mut receiver) = socket.split();
           
           // 接收客户端订阅消息
           let camera_id = /* 从消息解析 */;
           
           // 订阅 JPEG 广播
           let mut rx = get_global_streamer().subscribe(camera_id).await;
           
           // 持续推送 JPEG 数据
           while let Ok(jpeg_data) = rx.recv().await {
               if sender.send(Message::Binary(jpeg_data)).await.is_err() {
                   break;
               }
           }
       })
   }
   ```

4. **前端集成**（`src/views/Control.vue` - 大幅修改）
   ```vue
   <template>
     <!-- 条件渲染：USB 使用 <video>，RTSP 使用 <img> -->
     <video 
       v-if="selectedCamera?.camera_type === 'USB'"
       v-show="isStreaming"
       ref="videoRef"
       autoplay muted playsinline
     />
     
     <img 
       v-else-if="selectedCamera?.camera_type === 'RJ45'"
       v-show="isStreaming"
       ref="videoRef"
       class="camera-video"
       &:not([src]) { opacity: 0; pointer-events: none; }
     />
     
     <!-- 加载动画：只在真正加载时显示 -->
     <div v-if="isLoading && !isStreaming" class="camera-loading">
       <fa icon="spinner" class="fa-spin" />
       <span>正在连接摄像头...</span>
     </div>
   </template>
   
   <script setup>
   import { MjpegPlayer } from '@/utils/mjpegPlayer.js';
   
   const mjpegPlayer = ref(null);
   
   const startRTSPCamera = async (camera) => {
       // 1. 启动 Rust 端 GStreamer 流
       await invoke('start_gstreamer_stream', {
           cameraId: camera.id,
           rtspUrl: camera.rtsp_url
       });
       
       // 2. 等待 <img> 元素就绪
       await nextTick();
       while (!videoRef.value) {
           await new Promise(resolve => setTimeout(resolve, 50));
       }
       
       // 3. 获取 WebSocket URL
       const wsUrl = await invoke('get_mjpeg_websocket_url');
       
       // 4. 创建 MJPEG 播放器
       mjpegPlayer.value = new MjpegPlayer(videoRef.value, wsUrl, camera.id);
       await mjpegPlayer.value.start();
       
       // 5. 监听第一帧加载完成（避免显示 alt 文字）
       const loadHandler = () => {
           isStreaming.value = true;  // 第一帧显示后才设置
           isLoading.value = false;
           videoRef.value.removeEventListener('load', loadHandler);
       };
       videoRef.value.addEventListener('load', loadHandler);
   };
   
   const stopVideoStream = async () => {
       if (mjpegPlayer.value) {
           mjpegPlayer.value.stop();    // 清理 WebSocket、Object URL
           mjpegPlayer.value = null;
       }
       
       if (videoRef.value?.tagName === 'VIDEO') {
           // USB 摄像头：停止 MediaStream
           if (videoRef.value.srcObject) {
               videoRef.value.srcObject.getTracks().forEach(t => t.stop());
               videoRef.value.srcObject = null;
           }
       } else if (videoRef.value?.tagName === 'IMG') {
           // RTSP 摄像头：清理 <img>
           videoRef.value.src = '';  // 触发 CSS opacity: 0
       }
       
       await invoke('stop_gstreamer_stream', { cameraId });
   };
   </script>
   ```

**配置说明**：
- WebSocket 端口：`9003`（GStreamer MJPEG，可在 `src-tauri/src/lib.rs` 修改）
- GStreamer pipeline 参数：
  ```
  rtspsrc location={url} latency=0
  rtph264depay → avdec_h264 → videoscale → videoconvert → jpegenc → appsink
  ```
- 广播通道容量：`10` 帧（低延迟优先）
- 帧跳过策略：保留最新帧，丢弃中间帧

**性能优化**：
1. **智能帧跳过**：`isProcessingFrame` + `pendingFrame` 机制
2. **Blob URL 管理**：及时释放旧 URL，防止内存泄漏
3. **createImageBitmap**：<canvas> 模式异步解码，性能更好
4. **低延迟配置**：GStreamer `latency=0`，广播通道容量 10

**故障排查**：
```javascript
// 1. 检查 WebSocket 连接
// 浏览器控制台应显示：✅ MJPEG WebSocket 已连接

// 2. 检查元素类型
console.log(videoRef.value.tagName);  // 应该是 'IMG' (RTSP) 或 'VIDEO' (USB)

// 3. 查看帧率和丢帧
// 浏览器控制台会显示：📊 MJPEG FPS: 25.3, 丢帧: 5

// 4. 查看 Rust 日志
// [INFO] ✅ GStreamer pipeline 已启动: camera_id=1
// [INFO] ✅ MJPEG WebSocket 服务器已就绪: ws://127.0.0.1:9003
```

**平台安装指南**：
- **Ubuntu**：
  ```bash
  sudo apt-get install libgstreamer1.0-dev \
                       libgstreamer-plugins-base1.0-dev \
                       libgstreamer-plugins-bad1.0-dev \
                       gstreamer1.0-plugins-good \
                       gstreamer1.0-plugins-bad \
                       gstreamer1.0-libav
  ```

- **macOS (MacPorts)**：
  ```bash
  sudo port install gstreamer1 \
                    gstreamer1-gst-plugins-base \
                    gstreamer1-gst-plugins-good \
                    gstreamer1-gst-plugins-bad
  
  # 配置环境变量（添加到 ~/.zshrc）
  export PATH=/opt/local/bin:/opt/local/sbin:$PATH
  export PKG_CONFIG_PATH=/opt/local/lib/pkgconfig:$PKG_CONFIG_PATH
  ```

#### 2. 内存泄漏全面修复（12 个关键泄漏点）

**JavaScript 端修复（10 个）**：

| 泄漏点 | 位置 | 问题 | 修复 | 风险等级 |
|-------|------|------|------|---------|
| 1 | Scene3D/index.js | 场景初始化 `setTimeout` 未清理 | 添加 `sceneInitTimers` 数组追踪 | 高 |
| 2 | Scene3D/index.js | 批处理 `setTimeout` 未清理 | 增强 `batchProcessingTimers` 清理 | 高 |
| 3 | Scene3D/pathRenderer.js | window resize 监听器未移除 | 验证已正确移除 | 高 |
| 4 | protocolProcessor.js | `setInterval` 未清理 | 添加 `activeMonitoringTimers` Set | 中 |
| 5 | videoStreamManager.js | 多个定时器未清理 | 实现完整的 `destroy()` 方法 | 中 |
| 6 | logger.js | 节流定时器未清理 | 验证 `cleanup()` 正确性 | 中 |
| 7 | main.js | 全局资源未清理 | 添加 `beforeunload` 清理 | 中 |
| 8 | mjpegPlayer.js | WebSocket 事件监听器未清理 | 在 `stop()` 中完整清理 | 高 |
| 9 | mjpegPlayer.js | Object URL 未释放 | 添加 `_currentObjectUrl` 管理 | 高 |
| 10 | mjpegPlayer.js | 帧处理定时器未清理 | 清理 `fpsUpdateInterval` | 中 |

**详细修复示例**：

```javascript
// 1. Scene3D 定时器清理（src/components/Scene3D/index.js）
let sceneInitTimers = [];
let batchProcessingTimers = [];

function destroyScene() {
    // 清理场景初始化定时器
    sceneInitTimers.forEach((timer, index) => {
        if (timer !== null && timer !== undefined) {
            clearTimeout(timer);
            console.debug(`✅ 清理场景初始化定时器 ${index}`);
        }
    });
    sceneInitTimers = [];
    
    // 清理批处理定时器
    batchProcessingTimers.forEach((timer, index) => {
        if (timer !== null && timer !== undefined) {
            clearTimeout(timer);
            console.debug(`✅ 清理批处理定时器 ${index}`);
        }
    });
    batchProcessingTimers = [];
}

// 2. MjpegPlayer 完整清理（src/utils/mjpegPlayer.js）
stop() {
    this.isStopping = true;
    
    // 清理 WebSocket 事件监听器（避免触发错误）
    if (this.ws) {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.close(1000);
        }
    }
    
    // 清理 Object URL（防止内存泄漏）
    if (this._currentObjectUrl) {
        URL.revokeObjectURL(this._currentObjectUrl);
        this._currentObjectUrl = null;
    }
    
    // 清理定时器
    if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
    }
    
    if (this.fpsUpdateInterval) {
        clearInterval(this.fpsUpdateInterval);
        this.fpsUpdateInterval = null;
    }
}

// 3. 全局资源清理（src/main.js）
window.addEventListener('beforeunload', () => {
    // 清理协议处理器
    if (window.protocolProcessor) {
        window.protocolProcessor.destroy();
    }
    
    // 清理视频流管理器
    if (window.videoStreamManager) {
        window.videoStreamManager.destroy();
    }
});
```

**Rust 端修复（2 个）**：

| 泄漏点 | 位置 | 问题 | 修复 |
|-------|------|------|------|
| 1 | gstreamer_streamer/mod.rs | Bus 消息监听僵尸任务 | 添加超时和 pipeline 存在检查 |
| 2 | gstreamer_streamer/mod.rs | Pipeline 未正确停止 | 添加 `tokio::time::sleep` 等待 |

```rust
// Rust 内存泄漏修复
async fn spawn_bus_message_handler(&self, camera_id: u32, pipeline: gst::Pipeline) {
    let pipelines = self.pipelines.clone();
    
    tokio::spawn(async move {
        let bus = pipeline.bus().unwrap();
        let mut messages = bus.stream();
        
        // 设置超时：30 秒无消息自动退出
        let timeout = tokio::time::Duration::from_secs(30);
        
        loop {
            match tokio::time::timeout(timeout, messages.next()).await {
                Ok(Some(msg)) => {
                    // 检查 pipeline 是否还存在
                    let exists = pipelines.read().await.contains_key(&camera_id);
                    if !exists {
                        log::debug!("Pipeline {} 已移除，退出监听", camera_id);
                        break;
                    }
                    
                    // 处理消息...
                },
                Ok(None) => break,  // 流结束
                Err(_) => {
                    log::warn!("Pipeline {} 消息超时，退出监听", camera_id);
                    break;
                }
            }
        }
    });
}

pub async fn stop_stream(&self, camera_id: u32) -> Result<()> {
    // 停止 pipeline
    if let Some(pipeline) = self.pipelines.write().await.remove(&camera_id) {
        pipeline.set_state(gst::State::Null)?;
        
        // 等待 pipeline 完全停止
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }
    
    // 移除广播通道
    self.broadcasters.write().await.remove(&camera_id);
    
    Ok(())
}
```

**验证方法**：
```javascript
// Chrome DevTools → Memory → Take Heap Snapshot
// 1. 连接摄像头
// 2. 切换摄像头 100+ 次
// 3. 再次拍摄快照
// 4. 对比内存增长 → 应保持稳定（±10MB）
```

#### 3. Linux 摄像头权限配置（USB 摄像头支持）

**问题**：
Ubuntu 下使用 USB 摄像头时出现 `NotAllowedError`，提示权限被拒绝。

**原因**：
- Linux 需要用户在 `video` 组中才能访问 `/dev/video*` 设备
- 这是系统级别的权限限制，不是浏览器或应用权限

**解决方案**：

提供了 3 个文档和 1 个自动化脚本：

1. **快速修复脚本**（`fix-camera-permission.sh` - ✅ 新增）
   ```bash
   chmod +x fix-camera-permission.sh
   ./fix-camera-permission.sh
   sudo reboot  # 必须重启生效
   ```

2. **详细配置指南**（`LINUX_CAMERA_SETUP.md` - ✅ 新增）
   - 方案 1：将用户添加到 video 组（推荐）
   - 方案 2：临时更改设备权限（测试用）
   - 方案 3：创建 udev 规则（开发环境）
   - 完整的故障排查步骤

3. **摄像头问题总排查**（`CAMERA_TROUBLESHOOTING.md` - ✅ 新增）
   - USB 和 RTSP 摄像头问题
   - 跨平台（Ubuntu/macOS）解决方案
   - 调试模式和日志查看
   - 系统要求和依赖安装

4. **改进错误提示**（`src/views/Control.vue`）
   ```javascript
   if (error.name === 'NotAllowedError') {
       errorMessage = '摄像头权限被拒绝。Linux系统请确保已将用户添加到video组';
   }
   ```

**Tauri 配置更新**（`tauri.conf.json`）：
```json
{
  "bundle": {
    "linux": {
      "deb": {
        "depends": [
          "libgstreamer1.0-0",
          "gstreamer1.0-plugins-base",
          "gstreamer1.0-plugins-good",
          "gstreamer1.0-plugins-bad",
          "gstreamer1.0-libav",
          "v4l-utils"
        ],
        "files": {
          "../LINUX_CAMERA_SETUP.md": "usr/share/doc/dz-car-manager/",
          "../fix-camera-permission.sh": "usr/share/doc/dz-car-manager/"
        }
      }
    }
  }
}
```

**快速检查命令**：
```bash
# 1. 检查是否在 video 组
groups $USER | grep video

# 2. 检查摄像头设备
ls -l /dev/video*

# 3. 测试摄像头
ffplay /dev/video0
```

#### 4. 文件清理与新增

**新增文件**：
```
✅ src/utils/mjpegPlayer.js              - MJPEG 播放器（375 行）
✅ src-tauri/src/gstreamer_streamer/     - GStreamer 流管理
   ├── mod.rs                            - Pipeline 管理器（273 行）
   └── websocket.rs                      - WebSocket 服务器（153 行）
✅ src-tauri/src/commands/gstreamer.rs   - GStreamer Tauri 命令
✅ LINUX_CAMERA_SETUP.md                 - Linux 摄像头配置指南
✅ fix-camera-permission.sh              - 自动修复脚本
✅ CAMERA_TROUBLESHOOTING.md             - 摄像头故障排查总指南
```

**删除文件**（不再使用 MSE）：
```
❌ src/utils/msePlayer.js                - MSE 播放器（已废弃）
❌ src-tauri/src/mse_streamer/           - MSE 流管理器（已废弃）
❌ MSE_LOGGER_MIGRATION.md               - MSE 日志迁移文档（已过时）
```

**配置文件更新**：
```toml
# src-tauri/Cargo.toml
[dependencies]
gstreamer = "0.22"         # ✅ 新增
gstreamer-app = "0.22"     # ✅ 新增
gstreamer-video = "0.22"   # ✅ 新增
axum = "0.7"               # ✅ 新增（WebSocket 服务器）
```

#### 5. 跨平台兼容性总结

| 平台 | WebView | MJPEG 支持 | GStreamer | USB 摄像头 | 测试状态 |
|------|---------|-----------|-----------|-----------|---------|
| **Windows** | WebView2 | ✅ | ✅ | ✅ | ✅ 完全兼容 |
| **macOS** | WKWebView | ✅ | ✅ (MacPorts) | ✅ | ✅ 完全兼容 |
| **Ubuntu 22.04** | WebKitGTK 4.0 | ✅ | ✅ (apt) | ✅ (需配置权限) | ✅ 完全兼容 |

**平台特殊说明**：
- **macOS**：需要使用 MacPorts 安装 GStreamer，并配置 `PKG_CONFIG_PATH`
- **Ubuntu**：需要将用户添加到 `video` 组，并重启系统
- **Windows**：通常开箱即用，可能需要安装 GStreamer 运行时

---

### 📝 v1.4 (2025-11-01) - 日志系统标准化 & 实时流监控优化

#### 1. MSE 播放器日志迁移到 Tauri 日志插件

**变更内容**：
所有 `console.*` 日志迁移到 `@tauri-apps/plugin-log`，实现持久化日志记录。

**核心变更**（`src/utils/msePlayer.js`）：
```javascript
// 之前：console 日志（不持久化）
console.log('🎬 启动 MSE 播放器:', { cameraId, wsUrl });
console.warn('⚠️ 实时流延迟过大:', latency);
console.error('❌ WebSocket 错误:', error);

// 现在：Tauri 日志（自动写入文件）
import { info, warn, error, debug } from '@tauri-apps/plugin-log';

info(`🎬 启动 MSE 播放器 - 摄像头: ${cameraId}, URL: ${wsUrl}`);
warn(`⚠️ 实时流延迟过大: ${latency.toFixed(2)}s`);
error(`❌ WebSocket 错误: ${errorEvent.type}`);
```

**日志级别映射**：
| 原方法 | 新方法 | 用途 |
|--------|--------|------|
| `console.log` | `info()` | 一般信息（启动、连接、状态变化） |
| `console.warn` | `warn()` | 警告（延迟、队列积压、卡顿） |
| `console.error` | `error()` | 错误（连接失败、编解码器不支持） |
| `console.debug` | `debug()` | 调试信息（buffer 清理、状态监控） |

**日志文件位置**：
- **macOS**: `~/Library/Logs/com.dz-viz.app/`
- **Linux**: `~/.local/share/com.dz-viz.app/logs/`
- **Windows**: `%APPDATA%\com.dz-viz.app\logs\`

**查看日志**：
```bash
# macOS
tail -f ~/Library/Logs/com.dz-viz.app/*.log

# Linux
tail -f ~/.local/share/com.dz-viz.app/logs/*.log

# Windows PowerShell
Get-Content $env:APPDATA\com.dz-viz.app\logs\*.log -Wait
```

**诊断工具保留**：
`detectVideoCodecSupport()` 采用**双重输出**策略（控制台 + 日志文件）：
```javascript
const logBoth = (msg) => {
    console.log(msg);  // ← 保留，用于浏览器控制台显示
    info(msg);         // ← 同时记录到文件
};
```

**优势**：
- ✅ 日志持久化，便于问题追溯
- ✅ 支持级别过滤（debug/info/warn/error）
- ✅ 生产环境可收集客户端日志
- ✅ 日志自动轮转，防止文件过大

#### 2. 实时流监控逻辑简化

**移除的复杂检测**：
```javascript
// ❌ 删除：初始化片段检测（过度干预）
this.hasReceivedInitSegment = false;
this.initSegmentSize = 0;

// 检查 ftyp + moov box
// 丢弃非初始化片段
// ...

// ❌ 删除：基于 readyState 的卡死检测（误判率高）
if (readyState < 3 && latency > 1.0) {
    // 清空 SourceBuffer 重新开始
    this.sourceBuffer.remove(...);
}

// ❌ 删除：延迟阈值过高（8秒 → 用户体验差）
if (latency > 8.0) {
    warn(`实时流延迟严重: ${latency.toFixed(2)}s`);
}
```

**保留的核心监控**（`startLiveStreamMonitor()`）：
```javascript
// ✅ 简化的实时流监控（每秒检查一次）
this.liveStreamMonitor = setInterval(() => {
    // 1. 延迟检测（2秒阈值）
    const latency = bufferEnd - currentTime;
    if (latency > 2.0) {
        warn(`⚠️ 实时流延迟过大: ${latency.toFixed(2)}s，跳到最新帧`);
        this.video.currentTime = bufferEnd - 0.1;
    }
    
    // 2. 卡顿检测（currentTime 不变）
    if (Math.abs(currentTime - this.lastCurrentTime) < 0.01 && 
        !this.video.paused && latency > 0.5) {
        warn(`⚠️ 视频卡顿检测，尝试跳帧`);
        this.video.currentTime = Math.min(currentTime + 0.1, bufferEnd - 0.1);
        
        // 如果暂停，强制重新播放
        if (this.video.paused) {
            this.video.play().catch(err => {
                error(`重新播放失败: ${err.message || err}`);
            });
        }
    }
    
    // 3. 定期状态输出（10% 概率，避免刷屏）
    if (Math.random() < 0.1) {
        debug(`📊 视频状态: 当前=${currentTime.toFixed(2)}s, 缓冲=${bufferEnd.toFixed(2)}s, 延迟=${latency.toFixed(2)}s`);
    }
}, 1000);
```

**优化效果**：
- ✅ 延迟阈值降低到 2 秒（更快响应）
- ✅ 移除过度干预（不再清空 SourceBuffer）
- ✅ 简化逻辑，减少误判
- ✅ 日志输出更清晰（使用 Tauri 日志插件）

**调试建议**：
```bash
# 查看实时流监控日志
tail -f ~/Library/Logs/com.dz-viz.app/*.log | grep "视频状态\|延迟\|卡顿"
```

---

### 🎥 v1.3 (2025-10-30) - RTSP 流媒体系统重构

#### 1. MSE 流媒体方案（完全替代 MediaMTX + WebRTC）

**架构变更**：
```
旧方案：RTSP → FFmpeg → MediaMTX(RTMP/WebRTC) → 前端
新方案：RTSP → FFmpeg → fMP4(stdout) → WebSocket → MSE → Video
```

**核心优势**：
- ✅ **跨平台兼容**：纯 Web 标准，支持 Windows/macOS/Ubuntu
- ✅ **低延迟**：1-2秒延迟（vs MediaMTX 3-4秒）
- ✅ **无外部依赖**：不需要 MediaMTX 二进制文件（减少 47MB）
- ✅ **内存效率高**：直接流式传输，无中间缓存
- ✅ **WebKitGTK 兼容**：解决 Ubuntu Tauri 2.1 的 WebRTC 限制

**关键文件**：

1. **前端 MSE 播放器**（`src/utils/msePlayer.js`）
   ```javascript
   export class MsePlayer {
     constructor(videoElement, wsUrl, cameraId) {
       this.video = videoElement;
       this.ws = null;               // WebSocket 连接
       this.mediaSource = null;      // MediaSource API
       this.sourceBuffer = null;     // fMP4 数据缓冲
       this.queue = [];              // 数据队列
       this.isStopping = false;      // 停止标志（静默关闭）
       this.objectUrl = null;        // Object URL（防止泄漏）
     }
     
     async start() {
       // 1. 创建 MediaSource
       this.mediaSource = new MediaSource();
       this.objectUrl = URL.createObjectURL(this.mediaSource);
       this.video.src = this.objectUrl;
       
       // 2. 添加 SourceBuffer（H.264 + AAC）
       this.sourceBuffer = this.mediaSource.addSourceBuffer(
         'video/mp4; codecs="avc1.64001f,mp4a.40.2"'
       );
       
       // 3. 连接 WebSocket 接收 fMP4 数据
       await this.connectWebSocket();
     }
     
     stop() {
       // ⚠️ 关键：所有资源必须清理
       this.isStopping = true;  // 静默错误
       if (this.ws) this.ws.close(1000);
       if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
       // ... 清理 SourceBuffer, MediaSource
     }
   }
   ```

2. **Rust FFmpeg 流管理器**（`src-tauri/src/mse_streamer/mod.rs`）
   ```rust
   pub struct MseStreamer {
       processes: Arc<RwLock<HashMap<u32, Child>>>,        // FFmpeg 进程
       broadcasters: Arc<RwLock<HashMap<u32, broadcast::Sender<Vec<u8>>>>>,  // 广播通道
   }
   
   impl MseStreamer {
       pub async fn start_stream(&self, camera_id: u32, rtsp_url: String) {
           // 启动 FFmpeg: RTSP → fMP4 (stdout)
           let mut ffmpeg = Command::new("ffmpeg")
               .args(&[
                   "-rtsp_transport", "tcp",
                   "-i", &rtsp_url,
                   "-c:v", "copy",           // 视频不重编码
                   "-c:a", "aac",            // 音频转 AAC
                   "-movflags", "frag_keyframe+empty_moov",  // fMP4 标志
                   "-f", "mp4",
                   "pipe:1"                  // 输出到 stdout
               ])
               .stdout(Stdio::piped())
               .spawn()?;
           
           // 读取 stdout 并广播给所有 WebSocket 客户端
           let stdout = ffmpeg.stdout.take().unwrap();
           tokio::spawn(async move {
               let mut reader = BufReader::new(stdout);
               let mut buffer = vec![0u8; 8192];
               loop {
                   match reader.read(&mut buffer).await {
                       Ok(n) => tx.send(buffer[..n].to_vec()),
                       _ => break
                   }
               }
           });
       }
   }
   ```

3. **WebSocket 服务器**（`src-tauri/src/mse_streamer/websocket.rs`）
   ```rust
   pub async fn start_websocket_server(port: u16) {
       let listener = TcpListener::bind(format!("127.0.0.1:{}", port)).await?;
       
       while let Ok((stream, peer)) = listener.accept().await {
           tokio::spawn(handle_client(stream, peer));
       }
   }
   
   async fn handle_client(ws_stream: WebSocketStream<TcpStream>, peer: SocketAddr) {
       // 接收客户端订阅消息
       let camera_id = /* 从 JSON 解析 */;
       
       // 订阅 fMP4 广播
       let mut receiver = get_mse_streamer().subscribe(camera_id).await;
       
       // 持续推送数据
       loop {
           match receiver.recv().await {
               Ok(chunk) => ws_sender.send(Message::Binary(chunk)).await,
               _ => break
           }
       }
   }
   ```

4. **前端集成**（`src/views/Control.vue`）
   ```vue
   <template>
     <!-- v-show 确保元素始终在 DOM 中（防止 MSE 找不到元素） -->
     <video 
       v-show="selectedCamera && isStreaming"
       ref="videoRef"
       autoplay muted playsinline
     />
     
     <!-- 清理标志防止误报错误 -->
     <div v-if="isLoading && !isStreaming" class="camera-loading">
       <fa icon="spinner" class="fa-spin" />
       <span>正在连接摄像头...</span>
     </div>
   </template>
   
   <script setup>
   import { MsePlayer } from '@/utils/msePlayer.js';
   
   const msePlayer = ref(null);
   const isCleaningVideo = ref(false);  // 清理标志
   
   const startRTSPCamera = async (camera) => {
       // 1. 启动 Rust 端流转换
       await invoke('start_mse_stream', {
           cameraId: camera.id,
           rtspUrl: camera.rtsp_url
       });
       
       // 2. 等待 video 元素就绪
       await nextTick();
       while (!videoRef.value) {
           await new Promise(resolve => setTimeout(resolve, 50));
       }
       
       // 3. 创建 MSE 播放器
       const wsUrl = 'ws://127.0.0.1:9003';
       msePlayer.value = new MsePlayer(videoRef.value, wsUrl, camera.id);
       await msePlayer.value.start();
   };
   
   const stopVideoStream = async () => {
       isCleaningVideo.value = true;  // 标记清理中
       
       // 清理 MSE 播放器
       if (msePlayer.value) {
           msePlayer.value.stop();
           msePlayer.value = null;
       }
       
       // 停止 Rust 端流转换
       await invoke('stop_mse_stream', { cameraId });
       
       // 延迟重置标志（等待异步事件完成）
       setTimeout(() => { isCleaningVideo.value = false; }, 200);
   };
   </script>
   ```

**配置说明**：
- WebSocket 端口：`9003`（可在 `src-tauri/src/lib.rs` 修改）
- FFmpeg 参数：自动检测 RTSP，添加 `-rtsp_transport tcp` 等优化
- Buffer 大小：8KB（平衡内存和性能）
- 广播通道容量：100 个 fMP4 片段

**故障排查**：
```javascript
// 1. 检查 WebSocket 连接
// 浏览器控制台应显示：✅ WebSocket 已连接

// 2. 检查视频元素
console.log(videoRef.value);  // 应该不是 null

// 3. 检查 MSE 支持
console.log(MediaSource.isTypeSupported('video/mp4; codecs="avc1.64001f"'));
// 应该返回 true

// 4. 查看 Rust 日志
// [INFO] ✅ FFmpeg 已启动: PID=xxxxx
// [INFO] ✅ MSE WebSocket 服务器已就绪: ws://127.0.0.1:9003
```

#### 2. 内存泄漏全面修复（9个关键泄漏点）

**JavaScript 端修复（8 个）**：

| 泄漏点 | 位置 | 问题 | 修复 |
|-------|------|------|------|
| 1 | Scene3D | 性能调整 `setTimeout` 未清理 | 添加 `performanceAdjustTimer` 追踪 |
| 2 | Scene3D | 批处理 `setTimeout` 未清理 | 添加 `batchProcessingTimers` 数组 |
| 3 | Control.vue | HLS 重试定时器未清理 | 在 `stopVideoStream` 中 `clearTimeout` |
| 4 | Control.vue | video 事件监听器未移除 | 保存引用并在清理时移除 |
| 5 | Scene3D/index.vue | 模型加载进度监听器未清理 | 在 `onUnmounted` 中清理 |
| 6 | socketManager.js | Tauri `listen` 监听器未清理 | 保存 `unlisten` 函数并调用 |
| 7 | videoProcessor.js | 文件级 `setInterval` 未清理 | 导出 `cleanup()` 函数 |
| 8 | LogViewer.vue | window 事件监听器未移除 | 在 `onBeforeUnmount` 中移除 |

**Rust 端修复（1 个）**：
```rust
// 问题：FFmpeg stderr 使用同步 I/O，阻塞线程
// 修复：使用异步 AsyncBufReadExt
let reader = BufReader::new(stderr);
let mut lines = reader.lines();
while let Ok(Some(line)) = lines.next_line().await {  // 异步读取
    // 处理日志
}
```

**MsePlayer 内存泄漏修复**（新增）：
```javascript
// 1. Object URL 撤销
if (this.objectUrl) {
    URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
}

// 2. SourceBuffer 事件监听器清理
if (this.updateEndHandler) {
    this.sourceBuffer.removeEventListener('updateend', this.updateEndHandler);
    this.updateEndHandler = null;
}

// 3. WebSocket 连接超时定时器清理
if (this.wsConnectTimeout) {
    clearTimeout(this.wsConnectTimeout);
    this.wsConnectTimeout = null;
}

// 4. WebSocket 事件监听器清理
this.ws.onopen = null;
this.ws.onmessage = null;
this.ws.onerror = null;
this.ws.onclose = null;
```

**验证方法**：
```javascript
// Chrome DevTools → Memory → Take Heap Snapshot
// 1. 连接摄像头
// 2. 切换摄像头 50+ 次
// 3. 再次拍摄快照
// 4. 对比内存增长 → 应保持稳定
```

#### 3. 静默清理机制（消除误报错误）

**问题**：关闭 RTSP 摄像头时出现大量错误日志
```
[ERROR] FFmpeg Broken pipe
[Error] WebSocket connection failed
[Error] 视频加载错误
[Error] Unsupported source type
```

**解决方案**：

1. **Rust 端：识别正常停止信号**
   ```rust
   // src-tauri/src/mse_streamer/mod.rs
   while let Ok(Some(line)) = lines.next_line().await {
       // "Broken pipe" 是正常的流停止信号
       if line.contains("Broken pipe") {
           log::debug!("FFmpeg[{}] 流已停止 (Broken pipe)", camera_id);
           break;  // 停止读取，不报错
       }
       
       if line.contains("error") {
           log::error!("FFmpeg[{}] 错误: {}", camera_id, line);
       }
   }
   ```

2. **前端：清理标志拦截事件**
   ```javascript
   // src/views/Control.vue
   const isCleaningVideo = ref(false);  // 新增标志
   
   const onVideoLoadStart = () => {
       if (isCleaningVideo.value) return;  // 忽略清理期间的事件
       isLoading.value = true;
   };
   
   const onVideoError = (event) => {
       if (isCleaningVideo.value) return;  // 忽略清理期间的错误
       console.error('❌ 视频加载错误:', event);
   };
   
   const stopVideoStream = async () => {
       isCleaningVideo.value = true;
       // ... 清理操作
       
       // 延迟重置（等待异步事件完成）
       setTimeout(() => { isCleaningVideo.value = false; }, 200);
   };
   ```

3. **MsePlayer：静默 WebSocket 关闭**
   ```javascript
   stop() {
       this.isStopping = true;  // 标记停止中
       
       this.ws.onerror = (error) => {
           if (this.isStopping) return;  // 静默处理
           console.error('❌ WebSocket 错误:', error);
       };
       
       // 只在已连接时关闭（避免浏览器原生错误）
       if (this.ws.readyState === WebSocket.OPEN) {
           this.ws.close(1000, 'Client stopped');
       }
   }
   ```

**效果**：
```
修复前：关闭摄像头 → 4-5 条红色错误
修复后：关闭摄像头 → 仅 1 条 DEBUG 日志 ✅
```

#### 4. 跨平台兼容性总结

| 平台 | WebView | MSE 支持 | WebRTC 支持 | 测试状态 |
|------|---------|----------|-------------|---------|
| Windows | WebView2 (Chromium) | ✅ | ✅ | ✅ 完全兼容 |
| macOS | WKWebView | ✅ | ✅ | ✅ 完全兼容 |
| Ubuntu 22.04 | WebKitGTK 4.0 | ✅ | ❌ | ✅ MSE 方案可用 |

**Ubuntu WebRTC 限制说明**：
- Tauri 2.1 在 Ubuntu 上使用 WebKitGTK 4.0（内部依赖）
- WebKitGTK 4.0 不支持 WebRTC API
- 即使安装 `libwebkit2gtk-4.1-0`，Tauri 仍使用 4.0
- **解决方案**：使用 MSE 方案，完全不依赖 WebRTC

#### 5. 文件清理

**删除的文件**（不再需要 MediaMTX）：
```
❌ src-tauri/resources/mediamtx（47MB 二进制文件）
❌ src-tauri/resources/mediamtx.yml（配置文件）
❌ src-tauri/src/commands/mediamtx.rs（MediaMTX 命令）
❌ src-tauri/src/mediamtx_manager.rs（MediaMTX 管理器）
```

**新增的文件**：
```
✅ src/utils/msePlayer.js（MSE 播放器）
✅ src-tauri/src/mse_streamer/mod.rs（流管理器）
✅ src-tauri/src/mse_streamer/websocket.rs（WebSocket 服务器）
✅ src-tauri/src/commands/mse.rs（MSE 命令）
✅ MSE_LOGGER_MIGRATION.md（日志迁移文档 - v1.4）
```

**配置文件更新**：
```toml
# src-tauri/tauri.conf.json
"resources": {
  "../public/routes/*.txt": "routes/"
  // ❌ 删除 MediaMTX 资源配置
}

# src-tauri/Cargo.toml
[dependencies]
tokio-tungstenite = "0.21"  // ✅ 新增 WebSocket 支持
// ❌ 移除 webkit2gtk 特性（避免编译错误）
```

---

### 📦 v1.2 (2025-10-27)

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
- **日志**: @tauri-apps/plugin-log (v2.7.0)

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

### 🔍 快速故障排查索引

#### 车辆相关
- **车辆不显示** → 检查坐标转换、事件监听、车辆模型加载
- **车辆位置不准** → 检查 `worldToLocal`、坐标偏移配置
- **车辆卡顿** → 检查 `markDirty()` 调用、Three.js 渲染循环
- **车辆颜色不对** → 检查材质遍历、颜色设置逻辑

#### 红绿灯相关  
- **红绿灯不切换** → 检查分组配置 `TRAFFIC_LIGHT_GROUPS`
- **倒计时不显示** → 检查对象名称 `MD_HongLvDeng_Hui`、Canvas 纹理
- **倒计时数字反了** → 检查 Canvas `ctx.scale(1, -1)` 翻转
- **倒计时背景颜色** → `trafficLightManager.js` 第131行

#### UI/交互相关
- **点击场景无响应** → 检查 raycaster、沙盘模型加载
- **地图红点位置不准** → 检查 `vehicleToMapPercent` 函数
- **Toast 不显示** → 检查 `Toast.js` 导入、容器创建
- **Element Plus 样式异常** → 已弃用，使用自定义 Toast

#### 网络/通信相关
- **收不到车辆数据** → 检查 UDP 端口、协议解析、Socket Manager
- **发送命令无效** → 检查协议 ID（SendMessageTypes）、字节序
- **WebSocket 断开** → 检查 Rust 服务器状态、网络防火墙

#### 摄像头相关（v1.5 新增）
- **Ubuntu USB 摄像头权限被拒绝** → 运行 `fix-camera-permission.sh`，重启系统
- **RTSP 摄像头帧率低/延迟高** → 已使用 GStreamer MJPEG 方案解决
- **摄像头切换报错** → 检查元素类型（USB=video, RTSP=img）
- **macOS GStreamer 编译失败** → 配置 PKG_CONFIG_PATH（见 v1.5）
- **画面黑屏显示 alt 文字** → 已修复（v1.5）

---

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

### C. GStreamer MJPEG 流媒体 & Linux 摄像头权限 ✅ **已完成** (2025-11-02)

- **架构升级**：从 MSE（v1.3-v1.4）→ GStreamer MJPEG（v1.5）
- **核心变更**：
  ```
  旧方案: RTSP → FFmpeg → fMP4 → WebSocket → MSE → <video>
  新方案: RTSP → GStreamer → JPEG → WebSocket → <img>/<canvas>
  ```

- **关键文件**：
  - `src/utils/mjpegPlayer.js` - MJPEG 播放器（智能帧跳过）
  - `src-tauri/src/gstreamer_streamer/mod.rs` - GStreamer 管理器
  - `src-tauri/src/gstreamer_streamer/websocket.rs` - MJPEG WebSocket 服务器
  - `src/views/Control.vue` - 条件渲染（USB=video, RTSP=img）
  
- **为什么选择 GStreamer + MJPEG**：
  - ✅ GStreamer 对 RTSP 的原生支持比 FFmpeg 更稳定
  - ✅ MJPEG 架构简单（每帧独立 JPEG，无需解码器状态）
  - ✅ 解决 Ubuntu 下 RTSP 播放问题（帧率低、延迟高）
  - ✅ `<img>` 比 `<video>` 更轻量，支持 USB/RTSP 双模式切换
  - ✅ 智能帧跳过机制（`isProcessingFrame` + `pendingFrame`）

- **Linux USB 摄像头权限配置**：
  ```bash
  # 问题：Ubuntu 下 getUserMedia() 返回 NotAllowedError
  # 原因：用户不在 video 组，无法访问 /dev/video*
  
  # 快速修复（提供了自动化脚本）
  chmod +x fix-camera-permission.sh
  ./fix-camera-permission.sh
  sudo reboot  # 必须重启生效
  
  # 手动修复
  sudo usermod -aG video $USER
  sudo reboot
  
  # 验证
  groups $USER | grep video    # 应显示 video
  ls -l /dev/video*            # 应显示 crw-rw---- root video
  ```

- **GStreamer 安装**：
  - **Ubuntu**：
    ```bash
    sudo apt-get install libgstreamer1.0-dev \
                         libgstreamer-plugins-base1.0-dev \
                         libgstreamer-plugins-bad1.0-dev \
                         gstreamer1.0-plugins-good \
                         gstreamer1.0-plugins-bad \
                         gstreamer1.0-libav
    ```
  
  - **macOS (MacPorts)**：
    ```bash
    sudo port install gstreamer1 \
                      gstreamer1-gst-plugins-base \
                      gstreamer1-gst-plugins-good \
                      gstreamer1-gst-plugins-bad
    
    # 配置环境变量（添加到 ~/.zshrc）
    export PATH=/opt/local/bin:/opt/local/sbin:$PATH
    export PKG_CONFIG_PATH=/opt/local/lib/pkgconfig:$PKG_CONFIG_PATH
    
    # 验证
    pkg-config --modversion gstreamer-1.0
    ```

- **配置说明**：
  - WebSocket 端口：`9003`（MJPEG，可在 `src-tauri/src/lib.rs` 修改）
  - GStreamer pipeline：`rtspsrc → rtph264depay → avdec_h264 → videoscale → videoconvert → jpegenc → appsink`
  - 广播通道容量：`10` 帧（低延迟优先）
  - 智能帧跳过：保留最新帧，丢弃中间帧

- **故障排查**：
  ```bash
  # 1. 检查 GStreamer 安装
  gst-launch-1.0 --version
  pkg-config --modversion gstreamer-1.0
  
  # 2. 测试 RTSP 连接
  ffplay -rtsp_transport tcp rtsp://192.168.1.100:554/stream1
  
  # 3. 检查 USB 摄像头（Linux）
  groups $USER | grep video
  ls -l /dev/video*
  v4l2-ctl --list-devices
  
  # 4. 测试 WebSocket 连接
  # 浏览器控制台应显示：✅ MJPEG WebSocket 已连接
  
  # 5. 查看帧率和丢帧
  # 浏览器控制台：📊 MJPEG FPS: 25.3, 丢帧: 5
  ```

- **重要文档**：
  - `LINUX_CAMERA_SETUP.md` - Linux 摄像头权限完整配置指南
  - `CAMERA_TROUBLESHOOTING.md` - 摄像头问题总排查指南（USB + RTSP）
  - `fix-camera-permission.sh` - 自动修复 Linux 摄像头权限脚本

- **内存泄漏修复**（v1.5 同步完成）：
  - ✅ MjpegPlayer WebSocket 事件监听器清理
  - ✅ Object URL 及时释放（`_currentObjectUrl` 管理）
  - ✅ 定时器清理（`reconnectTimer`, `fpsUpdateInterval`）
  - ✅ GStreamer Bus 消息监听僵尸任务防护（超时 + pipeline 存在检查）
  - ✅ Scene3D 初始化定时器清理（`sceneInitTimers`）

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

## ⚙️ 重要配置项速查

### 坐标系统配置

```javascript
// src/utils/coordinateTransform.js

// 沙盘尺寸（硬编码，与3D模型匹配）
export const SANDBOX_DIMENSIONS = {
  width: 4.81,   // X方向，米
  depth: 2.81    // Y方向（对应Z轴），米
};

// 坐标偏移（用户可在设置中调整）
const coordinateOffset = reactive({
  x: 0,  // X轴偏移（米）
  y: 0   // Y轴偏移（米）
});

// 沙盘模型缩放系数（与Three.js场景匹配）
const SANDBOX_SCALE = 6;

// 车位坐标（硬编码）
export const PARKING_SLOTS_MODEL = {
  1: { x: 3.46875, y: 0.72991 },
  2: { x: 3.93503, y: 0.72991 }
};
```

### 网络配置

```javascript
// Rust 后端 (src-tauri/src/socket_server/udp_server.rs)
const DEFAULT_UDP_PORT: u16 = 8888;  // UDP监听端口
const WEBSOCKET_PORT: u16 = 3030;    // WebSocket端口

// 前端 (src/utils/socketManager.js)
const RECONNECT_INTERVAL = 3000;     // 重连间隔（毫秒）
const MAX_RECONNECT_ATTEMPTS = 5;    // 最大重连次数
```

### Three.js 场景配置

```javascript
// src/components/Scene3D/index.js

// 相机配置
const camera = new PerspectiveCamera(
  75,                    // FOV
  width / height,        // 宽高比
  0.1,                   // 近裁剪面
  1000                   // 远裁剪面
);

// 沙盘模型配置
sandboxModel.scale.set(6, 6, 6);  // 统一缩放6倍
sandboxModel.position.set(0, 0, 0);

// 车辆模型配置
carModel.scale.set(1, 1, 1);      // 不缩放（继承沙盘缩放）
```

### 红绿灯配置

```javascript
// src/components/Scene3D/trafficLightManager.js

// Canvas配置
const COUNTDOWN_CANVAS_SIZE = 512;      // 纹理尺寸
const COUNTDOWN_FONT_SIZE = 320;        // 字体大小
const COUNTDOWN_FONT_FAMILY = 'Arial';

// 发光强度
const LIGHT_ON_INTENSITY = 3;           // 灯光发光强度
const COUNTDOWN_ON_INTENSITY = 5;       // 数字发光强度

// 材质颜色（第131行）
material.color.setHex(0x323232);        // 背景颜色（深灰色）
material.emissive.setHex(0xffffff);     // 发光颜色（白色）

// 红绿灯分组
const TRAFFIC_LIGHT_GROUPS = {
  GROUP_2: [0, 2],                      // Zu1, Zu3
  GROUP_1: [1, 3, 4, 5, 6, 7]          // Zu2, Zu4-Zu8
};
```

### Toast配置

```javascript
// src/utils/toast.js

const DEFAULT_DURATION = 3000;          // 默认显示时长（毫秒）
const MAX_POOL_SIZE = 5;                // 对象池最大尺寸
const ANIMATION_DURATION = 300;         // 动画时长（毫秒）
```

### 性能配置

```javascript
// src/components/Scene3D/index.js

// Three.js 渲染器
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制DPR
renderer.shadowMap.enabled = false;     // 禁用阴影（性能优化）

// 帧率控制（使用 requestAnimationFrame + dirty检查）
let isDirty = true;
function animate() {
  requestAnimationFrame(animate);
  if (isDirty) {
    renderer.render(scene, camera);
    isDirty = false;
  }
}
```

### 数据库配置

```rust
// src-tauri/src/database/mod.rs

// SQLite 数据库路径
// macOS: ~/Library/Application Support/com.dz.carmanager/
// Linux: ~/.local/share/com.dz.carmanager/
// Windows: C:\Users\<用户名>\AppData\Roaming\com.dz.carmanager\

// 车辆连接表结构
CREATE TABLE IF NOT EXISTS vehicle_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL UNIQUE,
    ip_address TEXT NOT NULL,
    port INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### 协议配置

```rust
// src-tauri/src/protocol_processing/types.rs

// 协议头
const PROTOCOL_HEADER: u8 = 0xAA;       // 固定头标识

// 接收协议ID
const VEHICLE_INFO: u16 = 0x0001;       // 车辆信息
const TRAFFIC_LIGHT_STATUS: u16 = 0x0002; // 红绿灯状态
const PATH_FILE_SELECTION: u16 = 0x0003;  // 路径文件选择

// 发送协议ID
const VEHICLE_CONTROL: u16 = 0x1001;    // 车辆控制
const AVP_PARKING: u16 = 0x1004;        // AVP停车
const TAXI_SERVICE: u16 = 0x1005;       // 打车服务
const CONSTRUCTION_MARKER: u16 = 0x1006; // 施工标记
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

## 🔄 开发工作流程

### 新功能开发流程

1. **规划阶段**
   ```
   - 确认需求和技术方案
   - 评估是否需要修改协议（需协调车辆端）
   - 确定涉及的模块和文件
   ```

2. **前端开发**
   ```bash
   # 启动开发服务器（热重载）
   npm run tauri:dev
   
   # 修改代码
   # - Vue组件：src/components/ 或 src/views/
   # - 工具函数：src/utils/
   # - 状态管理：src/stores/
   # - 样式：src/styles/
   ```

3. **后端开发（Rust）**
   ```bash
   # 修改 Rust 代码
   # - 命令：src-tauri/src/commands/
   # - 协议：src-tauri/src/protocol_processing/
   # - 数据库：src-tauri/src/database/
   
   # 开发服务器会自动重新编译
   ```

4. **测试**
   ```bash
   # 启动测试客户端
   cd test
   python test_client.py        # 车辆模拟
   python test_traffic_light.py # 红绿灯模拟
   
   # 检查功能
   # - 打开浏览器开发者工具（F12）
   # - 查看控制台日志
   # - 使用 window.__scene3d__ 调试工具
   ```

5. **调试技巧**
   ```javascript
   // 前端调试
   console.log('调试信息', data);
   window.__scene3d__.logSandboxInfo();
   window.__eventBus__.getActiveListeners();
   
   // Rust调试
   log::debug!("调试信息: {:?}", data);
   ```

6. **提交前检查**
   ```bash
   # 代码清理
   - 删除 console.log / console.debug
   - 删除未使用的导入和变量
   - 删除注释掉的代码
   - 检查 linter 错误
   
   # 测试
   - 多车辆场景
   - 网络异常处理
   - 内存泄漏检查（长时间运行）
   ```

### 调试技巧速查

#### 前端调试（浏览器开发者工具）

```javascript
// 1. 查看Three.js场景
window.__scene3d__.scene
window.__scene3d__.camera
window.__scene3d__.sandboxModel
window.__scene3d__.models  // Map: 所有加载的模型

// 2. 查看车辆状态
window.__scene3d__.vehicles  // Map: 所有车辆实例

// 3. 查看事件监听器
window.__eventBus__.getActiveListeners()
window.__eventBus__.getStats()

// 4. 测试坐标转换
import { vehicleToModelCoordinates, modelToVehicleCoordinates } 
  from '@/utils/coordinateTransform.js';
const model = vehicleToModelCoordinates(2.4, 1.4);
const back = modelToVehicleCoordinates(model.x, model.z);

// 5. 手动更新红绿灯
window.__trafficLightManager__.setTrafficLightState(0, 'RED', 5);
```

#### 后端调试（Rust日志）

```rust
// 在 src-tauri/src/ 代码中添加日志
log::debug!("调试信息: {:?}", variable);
log::info!("正常信息: {}", message);
log::warn!("警告信息: {}", warning);
log::error!("错误信息: {}", error);

// 查看日志
// macOS: ~/Library/Logs/com.dz.carmanager/
// Linux: ~/.local/share/com.dz.carmanager/logs/
// Windows: C:\Users\<用户名>\AppData\Roaming\com.dz.carmanager\logs\
```

### 常见修改场景

#### 1. 修改坐标偏移
```javascript
// 文件：src/utils/coordinateTransform.js
// 修改默认偏移值
const coordinateOffset = reactive({
  x: 0.1,  // 修改这里
  y: -0.05
});
```

#### 2. 修改车辆模型颜色
```javascript
// 文件：src/components/Scene3D/vehicleManager.js
// 在 addVehicle() 函数中修改颜色应用逻辑
carInstance.traverse((child) => {
  if (child.isMesh && child.material) {
    child.material.color.setHex(color);  // 修改这里
  }
});
```

#### 3. 修改UDP端口
```rust
// 文件：src-tauri/src/socket_server/udp_server.rs
const DEFAULT_UDP_PORT: u16 = 9999;  // 修改这里

// 注意：需要同步修改测试客户端的端口配置
```

#### 4. 添加新的协议消息类型
```rust
// 1. 在 src-tauri/src/protocol_processing/types.rs 添加常量
pub const NEW_MESSAGE: u16 = 0x0010;

// 2. 在 parser.rs 添加解析逻辑
match protocol_id {
    MessageTypes::NEW_MESSAGE => {
        // 解析逻辑
    }
}

// 3. 在前端 src/constants/messageTypes.js 添加类型
export const MESSAGE_TYPES = {
  NEW_MESSAGE: 0x0010
};
```

#### 5. 修改红绿灯倒计时颜色
```javascript
// 文件：src/components/Scene3D/trafficLightManager.js
// 第131行：修改背景颜色
trafficLight.countdown.material.color.setHex(0x??????);

// 第439行：修改数字颜色
const colorMap = {
  RED: '#ff0000',     // 修改这里
  YELLOW: '#ffff00',
  GREEN: '#00ff00'
};
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

## ⚠️ 常见错误代码和解决方案

### 前端错误

#### 错误 1: `Cannot read property 'traverse' of null`
```
原因：模型尚未加载完成就尝试访问
解决：检查模型加载顺序，使用 await 或事件监听
```

```javascript
// ❌ 错误
sandboxModel.traverse(...);  // sandboxModel 可能为 null

// ✅ 正确
await loadSandboxModel();
if (sandboxModel) {
  sandboxModel.traverse(...);
}
```

#### 错误 2: `worldToLocal is not a function`
```
原因：对非 Object3D 对象调用 worldToLocal
解决：确保只对 Three.js 对象调用
```

```javascript
// ✅ 正确
const localPos = sandboxModel.worldToLocal(worldPos.clone());
// 注意：必须 clone()，否则会修改原对象
```

#### 错误 3: `EventBus memory leak detected`
```
原因：组件卸载时未移除事件监听器
解决：在 onBeforeUnmount 中清理
```

```javascript
// ✅ 正确
onBeforeUnmount(() => {
  eventBus.off(EVENTS.VEHICLE_STATE_UPDATED);
  eventBus.off(EVENTS.ONLINE_VEHICLES_COUNT_CHANGED);
});
```

#### 错误 4: `Toast container not found`
```
原因：Toast 容器未创建或被意外删除
解决：检查 toastContainer 初始化逻辑
```

```javascript
// Toast.js 中会自动创建容器
// 通常不需要手动处理
```

#### 错误 5: 坐标显示 `NaN` 或 `undefined`
```
原因：坐标转换函数接收到非数字参数
解决：添加参数验证
```

```javascript
// ✅ 已在 vehicleToMapPercent 中实现
if (typeof vehicleX !== 'number' || isNaN(vehicleX)) {
  return { x: 50, y: 50 };
}
```

### 后端错误（Rust）

#### 错误 1: `Failed to bind UDP socket`
```
原因：端口被占用或权限不足
解决：
1. 检查是否有其他程序占用 8888 端口
2. 尝试使用其他端口
3. Linux/macOS 可能需要 sudo（端口 < 1024）
```

```bash
# 查看端口占用（macOS/Linux）
lsof -i :8888

# 查看端口占用（Windows）
netstat -ano | findstr :8888
```

#### 错误 2: `Database locked`
```
原因：多个进程同时访问 SQLite 数据库
解决：确保只有一个应用实例运行
```

#### 错误 3: `Protocol parse error: Invalid header`
```
原因：收到的数据不是有效的协议包
解决：
1. 检查测试客户端是否正确发送协议头（0xAA）
2. 检查字节序（小端序）
3. 验证数据长度字段
```

#### 错误 4: `WebSocket connection failed`
```
原因：前端无法连接到 Rust 后端 WebSocket
解决：
1. 检查 WebSocket 服务器是否启动（端口 3030）
2. 检查防火墙设置
3. 查看 Rust 日志中的错误信息
```

### Three.js 错误

#### 错误 1: `THREE.WebGLRenderer: Context Lost`
```
原因：GPU 资源耗尽或驱动崩溃
解决：
1. 减少场景复杂度
2. 检查是否有内存泄漏
3. 重启浏览器
```

#### 错误 2: `THREE.GLTFLoader: No DRACOLoader instance provided`
```
原因：加载 Draco 压缩的模型时未设置解码器
解决：
```

```javascript
// ✅ 在 Scene3D/index.js 中已配置
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
gltfLoader.setDRACOLoader(dracoLoader);
```

#### 错误 3: `Material is undefined`
```
原因：尝试访问不存在的材质
解决：遍历前检查材质是否存在
```

```javascript
// ✅ 正确
model.traverse((child) => {
  if (child.isMesh && child.material) {
    // 安全访问
    child.material.color.set(color);
  }
});
```

### 协议相关错误

#### 错误 1: 车辆收不到控制命令
```
排查步骤：
1. 检查协议 ID（发送用 0x1001，不是 0x0001）
2. 检查目标 IP 和端口
3. 检查数据长度字段是否正确
4. 使用 Wireshark 抓包验证
```

#### 错误 2: 坐标偏移量不生效
```
原因：发送命令时未应用偏移
解决：使用 applyOffsetToSend 函数
```

```javascript
// ✅ 正确
const coordsToSend = applyOffsetToSend(vehicleCoords.x, vehicleCoords.z);
await invoke('send_vehicle_control_command', {
  data: {
    x: coordsToSend.x,
    y: coordsToSend.y,
    ...
  }
});
```

#### 错误 3: 红绿灯不同步
```
原因：
1. 红绿灯分组配置错误
2. 协议解析错误
3. 状态更新延迟

解决：
1. 检查 TRAFFIC_LIGHT_GROUPS 配置
2. 查看控制台日志中的红绿灯状态
3. 确认收到的协议数据正确
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

#### macOS
```bash
npm run tauri:build
# 输出: src-tauri/target/release/bundle/macos/DZ Car Manager.app
```

#### Ubuntu/Linux
```bash
npm run tauri:build
# 输出: 
# - src-tauri/target/release/bundle/deb/dz-car-manager_0.1.0_amd64.deb
# - src-tauri/target/release/bundle/appimage/dz-car-manager_0.1.0_amd64.AppImage
```

#### Windows
```bash
# 需要在 Windows 系统上执行
npm run tauri:build

# 输出:
# - src-tauri/target/release/dz-viz.exe
# - src-tauri/target/release/bundle/nsis/DZ Car Manager_0.1.0_x64-setup.exe
# - src-tauri/target/release/bundle/msi/DZ Car Manager_0.1.0_x64_en-US.msi
```

**Windows 打包前准备**：
1. 安装 [Rust](https://www.rust-lang.org/tools/install)
2. 安装 [Node.js](https://nodejs.org/)
3. 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)
   - 选择 "使用 C++ 的桌面开发"
4. WebView2 运行时（Windows 10/11 通常已预装）

### 测试客户端详细说明

#### test_client.py - 车辆模拟器
```python
# 功能：
# - 模拟车辆1运动（逆时针绕沙盘）
# - 发送车辆信息协议 (0x0001)
# - 模拟传感器状态
# - 支持键盘控制

# 配置（代码中可修改）：
VEHICLE_ID = 1              # 车辆ID
TARGET_IP = "127.0.0.1"     # 目标IP（本机或Tauri应用IP）
TARGET_PORT = 8888          # UDP端口
SEND_INTERVAL = 0.5         # 发送间隔（秒）

# 启动参数：
python test_client.py --ip 192.168.1.100 --port 8888 --id 1

# 运动模式：
# - 逆时针圆周运动
# - 速度可调（按上下键）
# - 位置实时更新
```

#### test_traffic_light.py - 红绿灯模拟器
```python
# 功能：
# - 模拟红绿灯状态切换
# - 发送红绿灯协议 (0x0002)
# - 支持两组红绿灯

# 状态切换序列：
# 1组: 红灯(30s) → 黄灯(3s) → 绿灯(30s) → 黄灯(3s) → ...
# 2组: 绿灯(30s) → 黄灯(3s) → 红灯(30s) → 黄灯(3s) → ...

# 启动：
python test_traffic_light.py
```

#### test_udp_camera_sender.py - 相机数据模拟器
```python
# 功能：
# - 模拟车载相机图像数据
# - 发送视频帧到Tauri应用
# - 支持多种图片格式

# 启动：
python test_udp_camera_sender.py --vehicle-id 1
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

## 📊 性能监控与优化

### 性能指标监控

#### 前端性能
```javascript
// 在浏览器控制台查看FPS
// 使用 Chrome DevTools → Performance 标签

// 1. Three.js 渲染统计
window.__scene3d__.renderer.info
// 输出：
// {
//   render: { calls: 10, triangles: 5000, ... },
//   memory: { geometries: 20, textures: 5 }
// }

// 2. 内存使用
performance.memory
// 输出：
// {
//   usedJSHeapSize: 50000000,
//   totalJSHeapSize: 100000000,
//   jsHeapSizeLimit: 2000000000
// }

// 3. 事件监听器统计
window.__eventBus__.getStats()
```

#### 后端性能（Rust）
```rust
// 查看 UDP 包处理速度
// 在日志中搜索 "Processing time" 关键字

// 查看内存使用
// 使用 htop / Activity Monitor 监控进程
```

### 性能优化清单

#### ✅ 已实施的优化

1. **Three.js 渲染**
   - Dirty 检查机制（避免无意义渲染）
   - 限制 devicePixelRatio ≤ 2
   - 禁用阴影（shadowMap.enabled = false）
   - 单例模式加载模型

2. **Toast 对象池**
   - DOM 元素复用
   - 减少 GC 压力
   - 最大池容量限制

3. **车辆模型管理**
   - 模板单例模式
   - clone() 创建实例
   - 及时释放资源

4. **事件系统**
   - 事件节流（throttle）
   - 自动清理监听器
   - 内存泄漏检测

5. **资源加载**
   - Draco 压缩 3D 模型
   - 离线解码器（避免 CDN）
   - 预加载关键资源

#### 🔍 可优化项

1. **图片优化**
   ```
   - 考虑使用 WebP 格式
   - 压缩贴图尺寸
   - 使用纹理图集
   ```

2. **代码分割**
   ```javascript
   // 使用动态导入
   const component = () => import('@/components/HeavyComponent.vue');
   ```

3. **数据库查询**
   ```rust
   // 添加索引、批量操作
   ```

### 性能基准测试

#### 典型场景性能

| 场景 | FPS | 内存 | CPU | 说明 |
|------|-----|------|-----|------|
| 空闲状态 | 60 | ~80MB | <5% | 仅加载沙盘 |
| 1辆车运行 | 60 | ~100MB | ~10% | 实时更新位置 |
| 4辆车运行 | 60 | ~150MB | ~15% | 多车场景 |
| 8辆车+红绿灯 | 55-60 | ~200MB | ~20% | 复杂场景 |

*测试环境：macOS, M1, 16GB RAM, Chrome*

---

## 📜 版本历史与重要里程碑

### v1.5 (2025-11-02) - 当前版本 🎥
**核心更新**：
- ✅ **GStreamer MJPEG 架构**：彻底替代 MSE 方案
- ✅ **内存泄漏全面修复**：12 个关键泄漏点（JS 10 + Rust 2）
- ✅ **Linux 摄像头权限**：USB 摄像头配置指南和自动化脚本
- ✅ **跨平台稳定性**：解决 Ubuntu RTSP 播放问题
- ✅ **智能帧跳过**：低延迟 MJPEG 播放

**关键文件变更**：
- `src/utils/mjpegPlayer.js` - ✅ 新增（MJPEG 播放器）
- `src-tauri/src/gstreamer_streamer/` - ✅ 新增（GStreamer 流管理）
- `src-tauri/src/commands/gstreamer.rs` - ✅ 新增（GStreamer 命令）
- `src/views/Control.vue` - 大幅重构（条件渲染 + 权限修复）
- `LINUX_CAMERA_SETUP.md` - ✅ 新增（Linux 配置指南）
- `fix-camera-permission.sh` - ✅ 新增（自动修复脚本）
- `CAMERA_TROUBLESHOOTING.md` - ✅ 新增（故障排查总指南）
- `src/utils/msePlayer.js` - ❌ 删除（已废弃）
- `src-tauri/src/mse_streamer/` - ❌ 删除（已废弃）

**技术亮点**：
- GStreamer 原生 RTSP 支持（稳定性优于 FFmpeg）
- MJPEG 简化架构（无需 MediaSource API）
- 智能帧跳过机制（优先显示最新帧）
- 完整的内存管理（无泄漏）
- 跨平台兼容（macOS/Ubuntu/Windows）

### v1.3 (2025-10-30) 🎥
**核心更新**：
- ✅ **MSE 流媒体系统**：完全替代 MediaMTX + WebRTC
- ✅ **RTSP 摄像头支持**：纯 FFmpeg + WebSocket + MSE 方案
- ✅ **内存泄漏修复**：9 个关键泄漏点全面修复（JS + Rust）
- ✅ **静默清理机制**：消除关闭摄像头时的误报错误
- ✅ **跨平台兼容**：Windows/macOS/Ubuntu 全面支持
- ✅ **文件清理**：删除 MediaMTX 依赖（减少 47MB）

**关键文件变更**：
- `src/utils/msePlayer.js` - ✅ 新增（MSE 播放器）
- `src-tauri/src/mse_streamer/` - ✅ 新增（流管理器 + WebSocket 服务器）
- `src-tauri/src/commands/mse.rs` - ✅ 新增（MSE 命令）
- `src/views/Control.vue` - 完全重构（MSE 集成 + 清理标志）
- `src-tauri/resources/mediamtx*` - ❌ 删除（不再需要）
- `src-tauri/src/commands/mediamtx.rs` - ❌ 删除
- `src-tauri/src/mediamtx_manager.rs` - ❌ 删除

**技术亮点**：
- 1-2秒低延迟视频流
- 完整的内存管理（无泄漏）
- 跨平台 WebView 兼容
- 优雅的资源清理机制

### v1.2 (2025-10-27)
**核心更新**：
- ✅ 红绿灯系统适配新模型（命名、分组、Canvas翻转）
- ✅ Toast 系统完全重写（对象池、Vue插件、跨平台兼容）
- ✅ 坐标转换函数封装（vehicleToMapPercent）
- ✅ 平行驾驶界面优化（地图 aspect-ratio）
- ✅ 代码质量提升（删除冗余代码和注释）
- ✅ CardWithBorder 通用组件

**关键文件变更**：
- `src/components/Scene3D/trafficLightManager.js` - 完全重构
- `src/utils/toast.js` - 对象池 + Vue 插件
- `src/utils/coordinateTransform.js` - 新增 vehicleToMapPercent
- `src/views/ParallelDriving.vue` - 地图显示优化
- `src/components/CardWithBorder.vue` - 新增

### v1.1 (历史版本)
**核心功能**：
- 基础 3D 场景搭建
- 车辆实时定位和追踪
- 红绿灯基础功能（旧模型）
- AVP 停车和打车服务
- 施工标记管理

### v1.0 (初始版本)
**基础架构**：
- Tauri + Vue 3 + Three.js 技术栈
- UDP 通信协议
- SQLite 数据库
- 基础 UI 框架

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

### 快速参考

| 问题类型 | 查看章节 |
|---------|---------|
| 坐标转换 | § 核心概念：坐标系统 |
| 红绿灯 | § 快速进入新会话 - Section B |
| Toast | § 快速进入新会话 - Section A |
| 配置项 | § 重要配置项速查 |
| 故障排查 | § 快速故障排查索引 |
| 开发流程 | § 开发工作流程 |
| 性能优化 | § 性能监控与优化 |
| 打包部署 | § 启动和测试 |

---

**最后更新**: 2025-11-02  
**作者**: AI Assistant  
**版本**: v1.5 🎥

**更新内容**: 
- ✅ GStreamer MJPEG 流媒体架构（彻底替代 MSE）
- ✅ 内存泄漏全面修复（12 个关键泄漏点）
- ✅ Linux 摄像头权限配置（USB 摄像头支持）
- ✅ 跨平台稳定性（解决 Ubuntu RTSP 播放问题）
- ✅ 智能帧跳过机制（低延迟 MJPEG 播放）

**快速开始新会话**：
1. **GStreamer MJPEG 架构**：查看 § v1.5 - RTSP 流媒体方案彻底重构
2. **内存泄漏修复**：查看 § v1.5 - 内存泄漏全面修复（12 个泄漏点）
3. **Linux 摄像头权限**：查看 § v1.5 - Linux 摄像头权限配置
4. **文件变更**：查看 § v1.5 - 文件清理与新增
5. **跨平台兼容**：查看 § v1.5 - 跨平台兼容性总结
6. **GStreamer 安装**：
   - Ubuntu: 查看 `LINUX_CAMERA_SETUP.md`
   - macOS: 查看 § v1.5 - 平台安装指南

**重要文档**：
- `LINUX_CAMERA_SETUP.md` - Linux 摄像头完整配置指南
- `CAMERA_TROUBLESHOOTING.md` - 摄像头问题排查总指南
- `fix-camera-permission.sh` - 自动修复 Linux 摄像头权限

**故障排查速查**：
```bash
# 检查 GStreamer 版本
gst-launch-1.0 --version

# 检查 USB 摄像头权限（Linux）
groups $USER | grep video
ls -l /dev/video*

# 测试 RTSP 连接
ffplay -rtsp_transport tcp rtsp://192.168.1.100:554/stream1

# 查看应用日志
# macOS: ~/Library/Logs/com.dz-viz.app/*.log
# Linux: ~/.local/share/com.dz-viz.app/logs/*.log
```

