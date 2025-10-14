# 故障排查指南

## 打包后白屏问题

### 问题描述
打包后的应用启动时只显示背景色，没有任何内容。

### 常见原因和解决方案

#### 1. 资源路径问题 ✅ 已修复

**原因**：Tauri应用需要使用相对路径而不是绝对路径。

**解决方案**：
在 `vite.config.js` 中添加：
```javascript
export default defineConfig(async () => ({
  base: './',  // ← 关键配置
  // ...
}));
```

#### 2. CSP (内容安全策略) 问题

**症状**：浏览器控制台出现 CSP 相关错误。

**检查方法**：
打开应用后，使用开发者工具查看控制台：
- macOS: `Cmd + Option + I`
- Windows/Linux: `Ctrl + Shift + I`

**解决方案**：
检查 `src-tauri/tauri.conf.json` 中的 CSP 配置：
```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; connect-src 'self' ipc: blob: tauri:; ..."
    }
  }
}
```

确保包含必要的协议：
- `ipc:` - Tauri IPC 通信
- `blob:` - Blob URLs (Three.js 纹理)
- `tauri:` - Tauri 资源协议
- `asset:` - 静态资源

#### 3. 静态资源未打包

**原因**：`public` 目录中的资源未正确复制。

**检查方法**：
```bash
# 检查打包后的资源
ls -la src-tauri/target/release/bundle/macos/*.app/Contents/Resources/
```

**解决方案**：
确保 `vite.config.js` 中：
```javascript
{
  build: {
    copyPublicDir: true,  // ← 确保为true
  }
}
```

#### 4. JavaScript 错误

**检查方法**：
查看控制台是否有 JavaScript 错误。

**常见错误**：
- `Cannot find module` - 模块路径错误
- `Unexpected token` - 语法错误
- `is not a function` - API 调用错误

**解决方案**：
1. 检查所有导入路径
2. 确保所有依赖已安装：`npm install`
3. 清理缓存重新打包：`npm run clean && npm run tauri:build`

#### 5. 环境变量问题

**原因**：生产环境缺少必要的环境变量。

**检查**：
```javascript
// src/main.js
console.log('Environment:', import.meta.env.MODE);
console.log('Base URL:', import.meta.env.BASE_URL);
```

**解决方案**：
确保 `.env.production` 文件存在并配置正确。

---

## 开发模式问题

### 问题：开发模式编译慢

#### 原因
Cargo.toml 中的开发环境优化配置被注释掉了。

#### 建议配置

**快速编译（推荐开发时使用）**：
```toml
[profile.dev]
opt-level = 0  # 无优化，编译最快
```

**平衡模式（开发时性能更好）**：
```toml
[profile.dev]
opt-level = 1  # 基本优化

[profile.dev.package."*"]
opt-level = 2  # 依赖库优化
```

根据需要选择其中一种，取消注释即可。

---

## 调试技巧

### 1. 启用开发者工具

在生产环境启用开发者工具调试：

`src-tauri/src/lib.rs`:
```rust
#[cfg(debug_assertions)]
fn main() {
    dz_viz_lib::run().expect("error while running tauri application");
}

#[cfg(not(debug_assertions))]
fn main() {
    dz_viz_lib::run().expect("error while running tauri application");
}
```

临时启用（仅用于调试）：
```rust
// 在 setup 函数中
#[cfg(debug_assertions)]
{
    window.open_devtools();
}

// 生产环境临时启用（调试完记得删除）
window.open_devtools();
```

### 2. 查看 Tauri 日志

**开发模式**：
控制台会直接显示 Rust 日志。

**生产模式**：
- macOS: `~/Library/Logs/com.dz.carmanager/`
- Windows: `%APPDATA%\com.dz.carmanager\logs\`
- Linux: `~/.local/share/com.dz.carmanager/logs/`

### 3. 清理缓存

```bash
# 清理前端缓存
rm -rf node_modules/.vite
rm -rf dist

# 清理 Rust 缓存
cd src-tauri
cargo clean

# 重新安装依赖
cd ..
npm install

# 重新打包
npm run tauri:build
```

### 4. 分步调试

**步骤1：确认前端打包成功**
```bash
npm run build
ls -la dist/
```

应该看到：
- `index.html`
- `assets/` 目录
- 其他静态资源

**步骤2：确认 Rust 编译成功**
```bash
cd src-tauri
cargo build --release
```

应该无错误输出。

**步骤3：完整打包**
```bash
npm run tauri:build
```

### 5. 检查打包产物

**macOS**:
```bash
# 检查 app 结构
tree src-tauri/target/release/bundle/macos/*.app

# 检查资源是否存在
ls -la src-tauri/target/release/bundle/macos/*.app/Contents/Resources/
```

**Windows**:
```powershell
# 检查 exe 是否生成
ls src-tauri/target/release/bundle/msi/
```

---

## 性能问题

### 问题：应用启动慢

#### 原因分析
1. Rust 二进制体积大
2. 首屏加载资源多
3. 数据库初始化慢

#### 解决方案

**1. 优化二进制大小**
```toml
[profile.release]
opt-level = "z"  # 最小化体积
strip = true     # 移除符号
lto = true       # 链接时优化
```

**2. 延迟加载非关键资源**
```javascript
// 使用 requestIdleCallback
requestIdleCallback(() => {
    // 加载次要资源
});
```

**3. 数据库优化**
```rust
// 使用连接池
sqlx::sqlite::SqlitePoolOptions::new()
    .max_connections(5)
    .connect(db_url)
```

### 问题：内存占用高

#### 检查方法
```javascript
// 监控内存使用
console.log(performance.memory);
```

#### 优化建议
1. 及时清理未使用的 Three.js 对象
2. 使用对象池复用对象
3. 限制日志缓冲区大小

---

## 网络问题

### 问题：Socket 连接失败

#### 检查清单
- [ ] 端口是否被占用：`lsof -i :8888`
- [ ] 防火墙是否阻止：检查系统设置
- [ ] IP 地址是否正确：检查网络配置

#### 调试命令
```bash
# 测试端口连通性
nc -zv 192.168.1.12 8888

# 查看监听端口
netstat -an | grep 8888
```

---

## 常见错误代码

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `Failed to load module` | 模块路径错误 | 检查 import 路径 |
| `Cannot read property of undefined` | 对象未初始化 | 添加空值检查 |
| `Network request failed` | 网络连接问题 | 检查 Socket 服务 |
| `Permission denied` | 权限不足 | 检查文件/端口权限 |
| `EADDRINUSE` | 端口被占用 | 更换端口或关闭占用进程 |

---

## 获取帮助

### 收集调试信息

运行诊断脚本：
```bash
# 创建诊断报告
cat > debug-info.sh << 'EOF'
#!/bin/bash
echo "=== System Info ==="
uname -a
echo ""
echo "=== Node Version ==="
node -v
echo ""
echo "=== NPM Version ==="
npm -v
echo ""
echo "=== Cargo Version ==="
cargo -V
echo ""
echo "=== Tauri CLI ==="
npm run tauri -- --version
echo ""
echo "=== Build Info ==="
cat src-tauri/tauri.conf.json | grep version
EOF

chmod +x debug-info.sh
./debug-info.sh > debug-report.txt
```

### 报告问题时提供
1. 错误信息（完整的控制台输出）
2. 系统信息（OS、版本）
3. 复现步骤
4. 预期行为 vs 实际行为
5. 相关配置文件

---

## 快速修复检查清单

打包后白屏问题：
- [ ] `vite.config.js` 中 `base: './'`
- [ ] `tauri.conf.json` 中 CSP 包含 `ipc: blob: tauri:`
- [ ] `copyPublicDir: true`
- [ ] `npm run build` 成功
- [ ] `dist/` 目录有内容
- [ ] 控制台无 JavaScript 错误
- [ ] 开发者工具查看网络请求

开发模式慢：
- [ ] Cargo.toml 开发配置已启用
- [ ] 依赖已完全安装
- [ ] 清理过缓存

性能问题：
- [ ] Release 模式已优化
- [ ] 资源预加载已启用
- [ ] 懒加载已配置
- [ ] 代码分割已优化

