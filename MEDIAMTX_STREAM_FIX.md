# MediaMTX 流状态检测修复 - 测试指南

## 📋 问题描述

**之前的问题**：
- 选择 RTSP 摄像头后立即报错：`404 Not Found`
- 流检测逻辑只是简单等待 500ms，没有真正验证流是否存在
- FFmpeg 虽然启动，但还没推流到 MediaMTX，导致 WHEP 端点不存在

## ✅ 修复内容

### 1. 启用 MediaMTX API (9997 端口)
- **文件**: `src-tauri/resources/mediamtx.yml`
- **改动**: 启用 API 端点用于流状态查询

### 2. 新增 Rust 命令: `check_mediamtx_stream_ready`
- **文件**: `src-tauri/src/commands/mediamtx.rs`
- **功能**: 通过 MediaMTX API 检查流是否真正就绪
- **检测逻辑**:
  1. 查询 `http://127.0.0.1:9997/v3/paths/get/{stream_name}`
  2. 检查 `ready` 字段
  3. 检查 `source.ready` 字段
  4. 检查是否有 `readers`（订阅者）

### 3. 前端使用真正的流状态检测
- **文件**: `src/views/Control.vue`
- **改动**: 使用 `invoke('check_mediamtx_stream_ready')` 替代简单的延时等待
- **检测频率**: 每 500ms 检查一次，最多 30 次（15 秒）

## 🧪 测试步骤

### 步骤 1: 重启应用

```bash
# 停止当前运行的应用（如果有）
# 重新启动
npm run tauri:dev
```

**预期**:
- 控制台应该看到 MediaMTX 启动日志
- 日志应包含：`📡 WebRTC 端点: http://127.0.0.1:8889`
- 日志应包含：`✅ MediaMTX 服务已就绪`

### 步骤 2: 验证 MediaMTX API

打开浏览器访问：`http://127.0.0.1:9997/v3/paths/list`

**预期**:
- 应该返回 JSON 数据（即使是空的路径列表）
- 状态码应该是 200
- 如果返回 404，说明 API 未启用，需要检查 `mediamtx.yml`

### 步骤 3: 测试 RTSP 摄像头连接

1. 打开"沙盘控制"界面
2. 选择一个 RTSP 摄像头（例如：摄像头 3）
3. 观察控制台日志

**预期日志流程**:
```
🔄 摄像头切换: → 3
🛑 开始停止视频流...
✅ 视频流已完全停止
📡 启动 FFmpeg 推流到 MediaMTX...
   📹 RTSP URL: rtsp://...
   🎯 摄像头 ID: 3
✅ FFmpeg 推流已启动
📡 WHEP URL: http://127.0.0.1:8889/camera_3/whep
🔍 FFmpeg 进程状态: 运行中
⏳ 等待 FFmpeg 连接 RTSP 源并建立流...
🔍 检查流状态 (1/30): ...
🔍 检查流状态 (2/30): ...
✅ MediaMTX 流已就绪 (2.5秒)  ← 关键！应该看到真实的等待时间
🔄 创建 WebRTC PeerConnection (WHEP)...
📤 发送 WHEP Offer 到 MediaMTX...
📥 收到 Answer SDP
✅ MediaMTX WebRTC (WHEP) 连接建立成功
📹 收到 WebRTC 媒体流
✅ srcObject 已设置
```

**不应该看到的错误**:
- ❌ `404 Not Found`
- ❌ `WHEP 请求失败`

### 步骤 4: 测试不同场景

#### 场景 A: 快速的 RTSP 源
- 使用响应快的 RTSP 源
- **预期**: 2-5 秒内流就绪

#### 场景 B: 慢速的 RTSP 源
- 使用网络延迟高的 RTSP 源
- **预期**: 5-10 秒内流就绪，或显示详细的超时错误

#### 场景 C: 无效的 RTSP 源
- 使用无法连接的 RTSP URL
- **预期**: 15 秒后超时，显示详细错误信息：
  ```
  等待流准备超时（15秒）
  FFmpeg 状态: 运行中/已停止
  可能原因:
  1. RTSP 源连接缓慢或无法访问
  2. 网络问题
  3. FFmpeg 配置问题
  请检查 Rust 日志查看详细错误
  ```

### 步骤 5: 验证 Rust 日志

查看 Rust 控制台日志（在终端中）：

**预期日志**:
```
[DEBUG] 🔍 检查 MediaMTX 流状态: camera_3
[DEBUG]    API 响应状态: 404 Not Found
[DEBUG] ❌ 流不存在: camera_3 (404)
[DEBUG] 🔍 检查 MediaMTX 流状态: camera_3
[DEBUG]    API 响应状态: 200 OK
[DEBUG]    API 响应内容: {...}
[INFO]  ✅ 流已就绪: camera_3 (ready=true)
```

## 🐛 常见问题排查

### 问题 1: 依然看到 404 错误

**可能原因**:
1. MediaMTX API 未启动
2. 端口冲突（9997 已被占用）

**排查**:
```bash
# 检查 9997 端口是否监听
lsof -i :9997  # macOS/Linux
netstat -ano | findstr :9997  # Windows

# 查看 MediaMTX 日志
# 应该看到类似: "listener opened on :9997 (API)"
```

### 问题 2: API 请求超时

**可能原因**: MediaMTX 进程崩溃或未启动

**排查**:
```bash
# 检查 MediaMTX 进程
ps aux | grep mediamtx  # macOS/Linux
tasklist | findstr mediamtx  # Windows

# 手动测试 API
curl http://127.0.0.1:9997/v3/paths/list
```

### 问题 3: FFmpeg 进程启动但流不就绪

**可能原因**: RTSP 源连接失败

**排查**:
1. 查看 Rust 日志中的 FFmpeg 错误输出
2. 手动测试 RTSP 源：
   ```bash
   ffmpeg -i rtsp://your-rtsp-url -t 5 test.mp4
   ```

## 📊 性能对比

### 修复前
- ❌ 固定等待 500ms（不管流是否就绪）
- ❌ 流未就绪就尝试连接 → 404 错误
- ❌ 无法区分"流正在建立"和"流建立失败"

### 修复后
- ✅ 真正检测流状态（通过 MediaMTX API）
- ✅ 动态等待，快速源 2-5 秒，慢速源 5-10 秒
- ✅ 准确区分不同的失败原因
- ✅ 详细的日志输出，便于调试

## 🎯 验收标准

✅ **修复成功的标志**:
1. 选择 RTSP 摄像头后不会立即报 404 错误
2. 控制台显示"✅ MediaMTX 流已就绪"且有真实的等待时间（不是固定的 0.5 秒）
3. 视频能正常播放
4. Rust 日志显示 API 检测过程
5. 对于无效的 RTSP 源，15 秒后显示详细的错误信息

---

## 📝 技术细节

### MediaMTX API v3 端点

**查询流状态**:
```
GET http://127.0.0.1:9997/v3/paths/get/{stream_name}
```

**响应结构**:
```json
{
  "name": "camera_3",
  "ready": true,
  "source": {
    "type": "rtmpConn",
    "ready": true
  },
  "readers": [
    {
      "type": "webrtcSession"
    }
  ]
}
```

### 检测逻辑优先级

1. **优先级 1**: 检查 `ready` 字段（最直接）
2. **优先级 2**: 检查 `source.ready` 字段（源就绪）
3. **优先级 3**: 检查 `readers` 数量（有订阅者）

任何一个条件满足即认为流已就绪。

---

**测试完成时间**: _____________  
**测试人**: _____________  
**测试结果**: ✅ 通过 / ❌ 未通过  
**备注**: _____________

