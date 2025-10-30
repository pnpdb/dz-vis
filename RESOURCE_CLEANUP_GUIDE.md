# 资源清理与内存泄漏防护指南

## 📋 概述

本文档说明在 Control.vue 中实现的资源清理机制，确保在切换摄像头时不会发生内存泄漏。

---

## ✅ 已实现的资源清理

### 1. WebRTC PeerConnection 清理 🔌

#### 正常流程清理
**位置**: `stopVideoStream()` 函数

```javascript
// 移除所有事件监听器（防止泄漏）
pc.ontrack = null;
pc.onicecandidate = null;
pc.oniceconnectionstatechange = null;
pc.onconnectionstatechange = null;

// 关闭连接
pc.close();
window.activePeerConnections.delete(cameraId);
```

**清理内容**:
- ✅ 移除所有事件监听器
- ✅ 关闭 PeerConnection
- ✅ 从 Map 中删除引用

#### 错误流程清理
**位置**: `startRTSPCamera()` catch 块

```javascript
try {
    // 如果 PeerConnection 已创建，关闭它
    if (typeof pc !== 'undefined' && pc) {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.oniceconnectionstatechange = null;
        pc.onconnectionstatechange = null;
        pc.close();
    }
} catch (cleanupError) {
    console.warn('⚠️ 清理 PeerConnection 时出错:', cleanupError);
}
```

**清理内容**:
- ✅ 即使连接失败也会清理已创建的 PeerConnection
- ✅ 防止半连接状态导致的泄漏
- ✅ 有异常捕获，不会中断清理流程

---

### 2. MediaStream 和 Tracks 清理 📹

**位置**: `stopVideoStream()` 函数

```javascript
// 停止所有 MediaStream tracks
if (videoRef.value.srcObject) {
    const stream = videoRef.value.srcObject;
    const tracks = stream.getTracks();
    tracks.forEach(track => {
        track.stop();  // 停止轨道（释放摄像头/媒体资源）
        console.debug(`  🔌 已停止 ${track.kind} 轨道`);
    });
    videoRef.value.srcObject = null;  // 移除引用
}
```

**清理内容**:
- ✅ 停止所有 video 和 audio tracks
- ✅ 释放摄像头硬件资源
- ✅ 清除 video 元素的 srcObject 引用

---

### 3. FFmpeg 进程清理 🎬

**位置**: `stopVideoStream()` 函数 和错误处理

```javascript
// 停止 FFmpeg 推流
await invoke('stop_mediamtx_stream', { cameraId });
```

**Rust 端清理** (`commands/mediamtx.rs`):
```rust
pub async fn stop_mediamtx_stream(camera_id: i64) -> Result<(), String> {
    let mut processes = FFMPEG_PROCESSES.lock().unwrap();
    
    if let Some(mut child) = processes.remove(&camera_id) {
        match child.kill() {
            Ok(_) => {
                child.wait(); // 等待进程退出
            }
            Err(e) => {
                return Err(format!("停止推流失败: {}", e));
            }
        }
    }
    Ok(())
}
```

**清理内容**:
- ✅ 停止 FFmpeg 进程（kill）
- ✅ 等待进程退出（wait）
- ✅ 从进程表中删除
- ✅ 即使出错也不会中断其他清理流程

---

### 4. 残留资源清理 🧹

**位置**: `stopVideoStream()` 函数

```javascript
// 清理可能残留的其他 PeerConnection（防止泄漏）
if (window.activePeerConnections && window.activePeerConnections.size > 0) {
    console.debug(`🧹 发现 ${window.activePeerConnections.size} 个残留的 PeerConnection，正在清理...`);
    for (const [id, pc] of window.activePeerConnections.entries()) {
        try {
            pc.ontrack = null;
            pc.onicecandidate = null;
            pc.oniceconnectionstatechange = null;
            pc.onconnectionstatechange = null;
            pc.close();
            console.debug(`  🗑️ 已清理残留的 PeerConnection (ID: ${id})`);
        } catch (error) {
            console.warn(`⚠️ 清理残留 PeerConnection 时出错:`, error);
        }
    }
    window.activePeerConnections.clear();
}
```

**清理内容**:
- ✅ 检查并清理所有残留的 PeerConnection
- ✅ 防止快速切换摄像头时的泄漏
- ✅ 使用 `clear()` 清空整个 Map

---

### 5. 状态重置 🔄

**位置**: `stopVideoStream()` 函数

```javascript
// 重置所有状态
isStreaming.value = false;
isLoading.value = false;
isConnectingWebRTC.value = false;
```

**清理内容**:
- ✅ 重置所有响应式状态
- ✅ 确保 UI 正确更新
- ✅ 在 try-catch-finally 中都有保护

---

## 🔍 资源清理流程图

```
用户切换摄像头
    ↓
watch(cameraId) 触发
    ↓
stopVideoStream() 执行
    ├─→ 1. 暂停 video 元素
    ├─→ 2. 停止所有 MediaStream tracks
    ├─→ 3. 清除 video.srcObject 和 video.src
    ├─→ 4. 关闭当前 PeerConnection
    │     ├─ 移除事件监听器
    │     ├─ 调用 pc.close()
    │     └─ 从 Map 中删除
    ├─→ 5. 停止 FFmpeg 进程 (Rust)
    ├─→ 6. 清理残留的 PeerConnection
    └─→ 7. 重置所有状态
    ↓
等待 100ms 确保清理完成
    ↓
startVideoStream(newCamera) 执行
```

---

## 🛡️ 内存泄漏防护措施

### 1. 双重清理保护

```javascript
// 正常流程：在 stopVideoStream() 中清理
stopVideoStream() → 清理当前摄像头资源

// 额外保护：清理所有残留资源
清理 window.activePeerConnections 中的所有 PeerConnection
```

### 2. 错误流程保护

```javascript
try {
    // 创建和连接 WebRTC
} catch (error) {
    // ✅ 即使出错也会清理资源
    if (pc) { pc.close(); }
    await invoke('stop_mediamtx_stream');
} finally {
    // ✅ 确保标志被重置
    isConnectingWebRTC.value = false;
}
```

### 3. 组件卸载保护

```javascript
onBeforeUnmount(() => {
    stopVideoStream();  // 组件销毁时清理所有资源
});
```

---

## 🧪 测试场景

### 测试 1: 正常切换摄像头

**步骤**:
1. 选择摄像头 A
2. 等待视频播放
3. 切换到摄像头 B

**预期**:
- ✅ 摄像头 A 的 PeerConnection 被关闭
- ✅ 摄像头 A 的 FFmpeg 进程被终止
- ✅ video 元素的 tracks 被停止
- ✅ 摄像头 B 正常播放

**验证命令**:
```bash
# 检查 FFmpeg 进程数量（应该只有 1 个）
ps aux | grep ffmpeg | grep -v grep | wc -l

# 检查端口占用
lsof -i :8889  # MediaMTX WebRTC
```

---

### 测试 2: 快速连续切换摄像头

**步骤**:
1. 快速切换：A → B → C → D
2. 不等待视频加载完成

**预期**:
- ✅ 所有旧的 PeerConnection 都被关闭
- ✅ 所有旧的 FFmpeg 进程都被终止
- ✅ 只有最后一个摄像头的资源存在
- ✅ `window.activePeerConnections.size === 1`

---

### 测试 3: 连接失败时的清理

**步骤**:
1. 选择一个无效的 RTSP URL
2. 等待连接超时

**预期**:
- ✅ PeerConnection 被清理（即使连接失败）
- ✅ FFmpeg 进程被停止
- ✅ 没有资源泄漏

---

### 测试 4: 长时间运行测试

**步骤**:
1. 循环切换摄像头 50 次
2. 监控内存使用

**预期**:
- ✅ 内存使用稳定，没有持续增长
- ✅ FFmpeg 进程数量始终 ≤ 1
- ✅ PeerConnection 数量始终 ≤ 1

**监控工具**:
```javascript
// 在浏览器控制台执行
setInterval(() => {
    console.log('PeerConnections:', window.activePeerConnections?.size || 0);
    console.log('Memory:', performance.memory?.usedJSHeapSize);
}, 5000);
```

---

## 📊 资源占用基准

| 资源类型 | 正常状态 | 警告阈值 | 说明 |
|---------|---------|---------|------|
| PeerConnection | 0-1 个 | > 2 个 | 可能有泄漏 |
| FFmpeg 进程 | 0-1 个 | > 2 个 | 可能有泄漏 |
| MediaStream tracks | 0-2 个 | > 4 个 | video + audio |
| JS Heap | < 100MB | > 500MB | 长时间运行后 |

---

## 🔧 调试工具

### 1. 检查活跃的 PeerConnection

```javascript
// 在浏览器控制台
console.log('活跃的 PeerConnection:', window.activePeerConnections);
console.log('数量:', window.activePeerConnections?.size);
```

### 2. 检查 FFmpeg 进程

```bash
# macOS/Linux
ps aux | grep ffmpeg

# 检查端口
lsof -i :1935   # RTMP 推流端口
```

### 3. 检查内存使用

```javascript
// 在浏览器控制台
console.log('内存使用:', {
    usedJS: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
    totalJS: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB'
});
```

---

## ⚠️ 常见问题

### 问题 1: 切换摄像头后旧的流还在播放

**原因**: video 元素的 tracks 没有停止

**解决**: 确保调用了 `track.stop()`
```javascript
const tracks = videoRef.value.srcObject.getTracks();
tracks.forEach(track => track.stop());
```

---

### 问题 2: FFmpeg 进程残留

**原因**: Rust 端没有正确 kill 进程

**检查**: 
```bash
ps aux | grep ffmpeg
```

**解决**: 手动停止
```bash
pkill ffmpeg
```

---

### 问题 3: PeerConnection 泄漏

**症状**: `window.activePeerConnections.size` 持续增长

**排查**:
```javascript
// 查看所有 PeerConnection
for (const [id, pc] of window.activePeerConnections.entries()) {
    console.log(`ID: ${id}, State: ${pc.connectionState}`);
}
```

**解决**: 调用 `stopVideoStream()` 清理

---

## ✅ 验收标准

资源清理正确的标志：

1. ✅ 切换摄像头后，旧的 PeerConnection 被关闭
2. ✅ FFmpeg 进程数量 ≤ 1
3. ✅ `window.activePeerConnections.size ≤ 1`
4. ✅ 内存使用稳定，不持续增长
5. ✅ 视频流切换流畅，无卡顿
6. ✅ 错误情况下也能正确清理资源

---

## 📝 维护建议

1. **定期检查**: 每次修改 WebRTC 相关代码后，测试资源清理
2. **监控内存**: 在开发环境开启内存监控
3. **日志完整**: 保留所有清理日志，便于排查问题
4. **异常捕获**: 所有清理代码都要有 try-catch 保护

---

**文档版本**: 1.0  
**最后更新**: 2025-10-30  
**维护者**: AI Assistant

