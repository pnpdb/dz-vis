# Ubuntu WebRTC 支持配置指南

## 问题描述

在 Ubuntu 22.04 及以下版本中，Tauri 应用使用的 WebKitGTK 默认版本可能不支持 WebRTC API，导致 RTSP 摄像头无法通过 MediaMTX WebRTC 播放。

错误信息：
```
Can't find variable: RTCPeerConnection
```

## 解决方案

### 方案 1：升级 WebKitGTK 并重新编译（推荐）

Ubuntu 22.04 及更高版本可以升级到支持 WebRTC 的 WebKitGTK 4.1：

#### 步骤 1：安装 WebKitGTK 4.1

```bash
# 更新软件包列表
sudo apt update

# 安装支持 WebRTC 的 WebKitGTK 4.1（运行时和开发包）
sudo apt install libwebkit2gtk-4.1-0 libwebkit2gtk-4.1-dev

# 安装其他必要的开发依赖
sudo apt install libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# 验证版本（需要 >= 2.38）
apt list --installed | grep webkit2gtk
```

#### 步骤 2：确保构建脚本配置正确 ⚠️ **关键步骤**

在 `src-tauri/build.rs` 中，应该包含 Linux 特定的链接配置：

```rust
fn main() {
    // Linux 特定：强制使用 WebKitGTK 4.1（支持 WebRTC）
    #[cfg(target_os = "linux")]
    {
        // 强制链接到 webkit2gtk-4.1 库
        println!("cargo:rustc-link-lib=webkit2gtk-4.1");
    }
    
    tauri_build::build()
}
```

这告诉 Rust 编译器在 Linux 上链接到 WebKitGTK 4.1 库而不是默认的 4.0。

#### 步骤 3：重新编译应用 ⚠️ **关键步骤**

即使你已经安装了 WebKitGTK 4.1，如果应用是在安装之前编译的，或者没有正确的 feature flags，它仍然会使用旧版本。**必须清理并重新编译**：

```bash
# 进入项目目录
cd ~/Workspace/dz-viz

# 清理旧的编译产物（关键！）
cd src-tauri
cargo clean

# 返回项目根目录
cd ..

# 重新编译并运行（开发模式）
npm run tauri dev

# 或编译生产版本
npm run tauri build
```

#### 验证编译成功

编译时应该看到：
```
   Compiling webkit2gtk-sys v2.0.1
   Compiling webkit2gtk v2.0.1
```

如果看到 `webkit2gtk-4.0-sys`，说明仍在使用旧版本，请确保已安装 `libwebkit2gtk-4.1-dev`。

### 方案 2：从 PPA 安装最新版本

如果官方仓库版本过旧，可以使用 PPA：

```bash
# 添加 WebKitGTK PPA（Ubuntu 22.04）
sudo add-apt-repository ppa:webkit-team/ppa
sudo apt update
sudo apt install libwebkit2gtk-4.1-0
```

### 方案 3：使用浏览器访问

如果无法升级 WebKitGTK，可以使用现代浏览器访问应用的开发服务器：

```bash
# 启动开发服务器
npm run dev

# 在 Chrome/Firefox 中访问
# http://localhost:1420
```

现代浏览器（Chrome 87+、Firefox 88+、Edge 88+）都完全支持 WebRTC。

## 验证 WebRTC 支持

在应用中打开开发者工具（F12），在控制台输入：

```javascript
console.log(typeof RTCPeerConnection !== 'undefined' ? 'WebRTC 支持 ✅' : 'WebRTC 不支持 ❌');
```

## 系统要求总结

| 平台 | WebView 引擎 | WebRTC 支持 | 最低版本 |
|------|-------------|------------|----------|
| **Windows** | WebView2 (Edge) | ✅ 原生支持 | Windows 10 1809+ |
| **macOS** | WKWebView (Safari) | ✅ 原生支持 | macOS 11+ |
| **Ubuntu 22.04** | WebKitGTK 4.0 | ❌ 需升级 | - |
| **Ubuntu 22.04** | WebKitGTK 4.1 | ✅ 支持 | >= 2.38 |
| **Ubuntu 24.04** | WebKitGTK 4.1 | ✅ 原生支持 | >= 2.44 |

## 替代方案

如果确实无法启用 WebRTC 支持，可以考虑：

1. **使用 USB 摄像头**：直接连接本地摄像头，不需要 WebRTC
2. **使用 HLS 流**：MediaMTX 也支持 HLS（但延迟较高，约 3-10 秒）
3. **远程访问**：在另一台支持 WebRTC 的设备上打开浏览器访问

## 技术说明

### 为什么安装了 WebKitGTK 4.1 还需要重新编译？

Rust/Tauri 应用在**编译时**会静态链接到系统库：

```
编译时环境                          运行时行为
------------------------            -------------------------
仅安装 WebKitGTK 4.0    →          应用使用 4.0 API (无 WebRTC)
安装 WebKitGTK 4.1      →          应用使用 4.1 API (支持 WebRTC)
先编译，后安装 4.1      →          应用仍使用 4.0 (需重新编译)
```

**关键点**：
- 应用在编译时决定使用哪个版本的 WebKitGTK
- 后续安装新版本库不会自动影响已编译的二进制文件
- 必须清理编译缓存后重新编译才能使用新版本

### 为什么需要 WebRTC？

本应用使用 **MediaMTX** 作为 RTSP/RTMP 到 WebRTC 的转换器：

```
RTSP 源 → FFmpeg → MediaMTX (RTMP) → WebRTC (WHEP) → 浏览器
```

WebRTC 提供：
- ✅ 低延迟（< 1 秒）
- ✅ 自适应码率
- ✅ 现代浏览器原生支持

### WebKitGTK 版本对比

| WebKitGTK 版本 | WebRTC 支持 | Ubuntu 默认版本 |
|---------------|------------|----------------|
| 4.0.x (< 2.38) | ❌ | Ubuntu 22.04 及以下 |
| 4.1.x (>= 2.38) | ✅ | Ubuntu 24.04 |

## 故障排查

### 检查当前 WebKitGTK 版本

```bash
pkg-config --modversion webkit2gtk-4.1
```

### 检查是否安装了 GStreamer WebRTC 插件

```bash
gst-inspect-1.0 | grep webrtc
```

如果没有安装，可以尝试：

```bash
sudo apt install gstreamer1.0-plugins-good gstreamer1.0-plugins-bad
```

## 联系支持

如果按照以上步骤仍无法解决问题，请提供以下信息：

```bash
# 系统信息
lsb_release -a

# WebKitGTK 版本
apt list --installed | grep webkit

# GStreamer 版本
gst-inspect-1.0 --version

# 错误日志
# 在应用中按 F12 打开开发者工具，复制控制台错误
```

