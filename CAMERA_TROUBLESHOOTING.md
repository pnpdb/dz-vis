# 摄像头故障排查指南

## 📹 摄像头类型

本应用支持两种类型的摄像头：

1. **USB 摄像头**：通过 WebRTC (getUserMedia API) 访问
2. **RTSP 摄像头（网络摄像头）**：通过 GStreamer + MJPEG over WebSocket

## 🐛 常见问题及解决方案

### 1. Ubuntu/Linux: "摄像头权限被拒绝"

**症状：**
- Toast 提示：`摄像头权限被拒绝。Linux系统请确保已将用户添加到video组`
- 无法访问 USB 摄像头

**原因：**
Linux 系统需要用户在 `video` 组中才能访问摄像头设备。

**快速修复：**

```bash
# 方法 1: 使用提供的自动修复脚本（推荐）
chmod +x fix-camera-permission.sh
./fix-camera-permission.sh
sudo reboot  # 重启后生效

# 方法 2: 手动配置
sudo usermod -aG video $USER
sudo reboot  # 必须重启或重新登录
```

**验证：**

```bash
# 重启后，验证是否在 video 组中
groups $USER | grep video

# 检查摄像头设备
ls -l /dev/video*
```

**详细说明：**
查看 [LINUX_CAMERA_SETUP.md](./LINUX_CAMERA_SETUP.md) 获取完整的配置指南和故障排查步骤。

---

### 2. macOS: GStreamer 编译失败

**症状：**
```
Package 'gstreamer-1.0' not found
pkg-config exited with status code 1
```

**解决方案：**

使用 MacPorts 安装 GStreamer：

```bash
# 安装 GStreamer
sudo port install gstreamer1 \
                  gstreamer1-gst-plugins-base \
                  gstreamer1-gst-plugins-good \
                  gstreamer1-gst-plugins-bad

# 配置环境变量（添加到 ~/.zshrc 或 ~/.bash_profile）
export PATH=/opt/local/bin:/opt/local/sbin:$PATH
export PKG_CONFIG_PATH=/opt/local/lib/pkgconfig:$PKG_CONFIG_PATH

# 重新加载配置
source ~/.zshrc  # 或 source ~/.bash_profile

# 验证安装
pkg-config --modversion gstreamer-1.0
```

---

### 3. "摄像头被其他应用占用"

**症状：**
- 错误：`NotReadableError`
- Toast 提示：`摄像头被其他应用占用或系统权限不足`

**排查步骤：**

```bash
# Linux: 查找占用摄像头的进程
sudo fuser /dev/video0

# 查看进程详情
ps aux | grep <PID>

# 关闭占用的应用
sudo kill <PID>

# macOS: 检查哪些应用正在使用摄像头
# 系统会在状态栏显示绿色指示灯
# 常见占用应用：Zoom, Skype, FaceTime, Chrome/Firefox
```

---

### 4. RTSP 摄像头连接失败

**症状：**
- Toast 提示：`GStreamer流连接失败`
- 画面一直显示 "正在连接摄像头"

**排查步骤：**

1. **验证 RTSP URL 格式：**
   ```
   rtsp://username:password@ip:port/stream
   rtsp://192.168.1.100:554/stream1
   ```

2. **测试 RTSP 连接（Linux/macOS）：**
   ```bash
   # 使用 ffplay 测试
   ffplay -rtsp_transport tcp rtsp://192.168.1.100:554/stream1
   
   # 使用 VLC 测试（图形界面）
   vlc rtsp://192.168.1.100:554/stream1
   ```

3. **检查网络连接：**
   ```bash
   # ping 摄像头 IP
   ping 192.168.1.100
   
   # 检查端口是否开放
   telnet 192.168.1.100 554
   # 或
   nc -zv 192.168.1.100 554
   ```

4. **检查防火墙：**
   ```bash
   # Linux (Ubuntu): 检查 ufw 状态
   sudo ufw status
   
   # 如果需要，允许 RTSP 端口
   sudo ufw allow 554/tcp
   
   # macOS: 系统偏好设置 -> 安全性与隐私 -> 防火墙
   ```

5. **查看 GStreamer 日志：**
   - 在应用控制台中查看详细的 GStreamer 错误信息
   - 日志位置：应用数据目录下的日志文件

---

### 5. "未找到摄像头设备"

**症状：**
- Toast 提示：`未找到摄像头设备`
- 摄像头列表为空

**排查步骤：**

**Linux:**
```bash
# 检查是否识别到摄像头
ls /dev/video*

# 查看详细信息
v4l2-ctl --list-devices

# 如果没有 v4l2-ctl
sudo apt-get install v4l-utils

# 检查内核日志
dmesg | grep -i video
dmesg | grep -i usb
```

**macOS:**
```bash
# 使用系统信息查看
system_profiler SPCameraDataType

# 或在"关于本机" -> "系统报告" -> "摄像头"
```

**通用检查：**
- 确保摄像头已物理连接
- 尝试拔出并重新插入摄像头
- 尝试更换 USB 端口
- 在虚拟机中，确保 USB 设备已启用直通

---

### 6. 摄像头画面卡顿或延迟高

**可能原因：**
- 网络带宽不足（RTSP）
- 摄像头分辨率过高
- 系统资源不足

**优化建议：**

1. **降低分辨率（代码中配置）：**
   - USB 摄像头：修改 `Control.vue` 中的 `constraints`
   - RTSP 摄像头：调整 GStreamer pipeline 参数

2. **优化网络（RTSP）：**
   - 使用有线连接代替 WiFi
   - 确保网络带宽充足
   - 减少网络拥塞

3. **关闭其他占用资源的应用**

---

## 🔍 调试模式

启用详细日志：

1. **查看浏览器控制台**（开发模式）：
   ```bash
   npm run tauri dev
   ```
   - 打开开发者工具（F12 或 Cmd+Option+I）
   - 查看 Console 标签页

2. **查看 Rust 后端日志**：
   - 日志会输出到终端
   - 查找以 `[GStreamer]` 开头的日志

3. **测试 WebSocket 连接**：
   - 打开浏览器控制台
   - 运行：
     ```javascript
     const ws = new WebSocket('ws://127.0.0.1:9003/mjpeg');
     ws.onopen = () => console.log('✅ WebSocket 连接成功');
     ws.onerror = (e) => console.error('❌ WebSocket 错误:', e);
     ```

---

## 📦 系统要求

### Linux (Ubuntu/Debian)
```bash
# 运行时依赖
sudo apt-get install \
  libgstreamer1.0-0 \
  libgstreamer-plugins-base1.0-0 \
  libgstreamer-plugins-good1.0-0 \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-libav \
  v4l-utils

# 开发依赖（如果需要编译）
sudo apt-get install \
  libgstreamer1.0-dev \
  libgstreamer-plugins-base1.0-dev \
  libgstreamer-plugins-bad1.0-dev
```

### macOS (MacPorts)
```bash
sudo port install \
  gstreamer1 \
  gstreamer1-gst-plugins-base \
  gstreamer1-gst-plugins-good \
  gstreamer1-gst-plugins-bad
```

---

## 📞 获取帮助

如果以上解决方案都无法解决问题，请收集以下信息：

1. **操作系统信息：**
   ```bash
   # Linux
   uname -a
   lsb_release -a
   
   # macOS
   sw_vers
   ```

2. **摄像头信息：**
   ```bash
   # Linux
   v4l2-ctl --list-devices
   ls -l /dev/video*
   
   # macOS
   system_profiler SPCameraDataType
   ```

3. **GStreamer 版本：**
   ```bash
   gst-launch-1.0 --version
   pkg-config --modversion gstreamer-1.0
   ```

4. **应用日志：**
   - 浏览器控制台的完整错误信息
   - Rust 后端的日志输出

5. **复现步骤：**
   - 详细描述操作步骤
   - 是否能稳定复现

---

## ✅ 快速检查清单

在报告问题前，请确认：

- [ ] 操作系统是否满足要求
- [ ] 摄像头是否被系统识别（`ls /dev/video*` 或系统信息）
- [ ] 用户是否在 video 组中（Linux）
- [ ] 是否已安装 GStreamer 及相关插件
- [ ] 摄像头是否被其他应用占用
- [ ] 网络连接是否正常（RTSP 摄像头）
- [ ] 防火墙是否阻止连接
- [ ] 是否查看了浏览器控制台和 Rust 日志
- [ ] 是否尝试了相关的故障排查步骤

