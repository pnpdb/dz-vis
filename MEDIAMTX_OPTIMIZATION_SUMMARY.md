# MediaMTX 视频流优化总结

## ✅ 已修复的问题

### 问题 1: AbortError 播放失败错误

**现象**:
```
❌ 播放失败: AbortError: The operation was aborted.
```

**原因**:
WebRTC 在建立连接时会多次触发 `ontrack` 事件（视频轨道、音频轨道），每次都调用 `video.play()`，导致前一次播放被中断。

**解决方案**:
```javascript
// 添加防抖逻辑
let trackReceived = false;
pc.ontrack = (event) => {
    if (!trackReceived) {
        trackReceived = true;
        videoRef.value.srcObject = event.streams[0];
        
        // 只调用一次 play()
        videoRef.value.play().catch(e => {
            // 忽略 AbortError（正常的中断）
            if (e.name !== 'AbortError') {
                console.error('❌ 播放失败:', e);
            }
        });
    }
};
```

**效果**:
- ✅ 不再显示 AbortError 错误
- ✅ 只在首次收到流时播放
- ✅ 日志更清晰

---

### 问题 2: 等待时间优化

**现象**:
- 之前：等待 4.5 秒，最长 15 秒超时
- 用户反馈：相比 VLC 稍慢

**优化方案**:

#### 1. 提高检测频率
```javascript
// 优化前
const checkInterval = 500; // 每 500ms 检查一次
const maxRetries = 30;      // 最多 15 秒

// 优化后
const checkInterval = 300;  // 每 300ms 检查一次 ⚡
const maxRetries = 40;      // 最多 12 秒 ⚡
```

**预期效果**:
- 更快检测到流就绪（理论上可以提速到 3-4 秒）
- 减少总超时时间（15秒 → 12秒）
- 更频繁的状态检查

#### 2. 更新进度提示
```javascript
// 优化前：每 2 秒提示一次
if ((i + 1) % 4 === 0) { ... }

// 优化后：每 1.5 秒提示一次
if ((i + 1) % 5 === 0) { ... }
```

**效果**:
- ✅ 用户获得更频繁的反馈
- ✅ 体验更流畅

---

## 📊 性能对比

| 指标 | 优化前 | 优化后 | 改进 |
|------|--------|--------|------|
| 检测间隔 | 500ms | 300ms | ⬆️ 40% 更快 |
| 最大超时 | 15秒 | 12秒 | ⬇️ 20% 更快失败 |
| 典型等待时间 | 4.5秒 | ~3-4秒 | ⬆️ 约 20% 提速 |
| AbortError | 每次都显示 | 已隐藏 | ✅ 无错误提示 |

---

## 🧪 测试建议

### 快速 RTSP 源测试
使用响应快的 RTSP 源，预期：
- ✅ 等待时间：2-4 秒
- ✅ 无 AbortError 错误
- ✅ 视频流畅播放

### 慢速 RTSP 源测试
使用网络延迟高的 RTSP 源，预期：
- ✅ 等待时间：5-10 秒
- ✅ 12 秒后显示详细超时错误
- ✅ 进度提示更频繁

---

## 💡 进一步优化建议

### 1. 并行检测（高级）
```javascript
// 同时检测 MediaMTX API 和 WHEP 端点
Promise.race([
    checkMediaMTXAPI(),
    checkWHEPEndpoint()
])
```

### 2. 自适应检测间隔
```javascript
// 前 5 秒：每 200ms 检查一次（快速源）
// 5-10 秒：每 500ms 检查一次（慢速源）
// 10 秒后：每 1 秒检查一次（超慢源）
```

### 3. 预连接优化
```javascript
// 在用户选择摄像头时就预先启动 FFmpeg
// 实际播放时流可能已经就绪
```

### 4. 流缓存
```javascript
// 对于频繁切换的摄像头，保持流活跃
// 避免重复启动/停止 FFmpeg
```

---

## 🎯 关键技术点

### RTSP → MediaMTX → WebRTC 延迟组成

```
RTSP 源连接      : 1-3 秒（网络延迟）
    ↓
FFmpeg 推流      : 0.5-1 秒（编码延迟）
    ↓
MediaMTX 处理    : 0.5-1 秒（转码延迟）
    ↓
WebRTC 建立连接  : 0.5-1 秒（ICE 协商）
    ↓
总延迟           : 2.5-6 秒（典型）
```

### VLC 为什么更快？
- VLC 是**本地播放器**，直接连接 RTSP 源
- 不需要转码（直接解码显示）
- 不需要 WebRTC 协商
- 典型延迟：1-2 秒

### 我们的优势
虽然比 VLC 慢 1-2 秒，但我们提供：
- ✅ **Web 浏览器播放**（无需安装软件）
- ✅ **低延迟 WebRTC**（< 500ms，适合实时应用）
- ✅ **跨平台兼容**（Windows/macOS/Linux）
- ✅ **集成到应用中**（无需切换窗口）

---

## 📝 注意事项

### 1. RTSP 源质量影响
- 快速源（本地网络）：2-4 秒
- 慢速源（公网）：5-10 秒
- 不稳定源：可能超时

### 2. FFmpeg 参数影响
当前配置：
```rust
"-c", "copy"           // 零编码（最快）
"-rtsp_transport", "tcp"  // TCP 稳定但稍慢
```

可选优化（如果需要更快）：
```rust
"-rtsp_transport", "udp"  // UDP 更快但可能丢包
```

### 3. MediaMTX 配置影响
```yaml
readTimeout: 10s      # 读取超时
writeTimeout: 10s     # 写入超时
writeQueueSize: 512   # 写入队列大小
```

---

## ✅ 验收标准

修复成功的标志：
1. ✅ 无 AbortError 错误提示
2. ✅ 快速源等待时间 < 4 秒
3. ✅ 慢速源 12 秒后显示详细错误
4. ✅ 进度提示每 1.5 秒更新
5. ✅ 视频流畅播放

---

**优化完成时间**: 2025-10-30  
**优化内容**: AbortError 修复 + 检测频率提升  
**预期提速**: 20% ~ 30%

