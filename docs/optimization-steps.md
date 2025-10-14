# 渐进式打包优化步骤

## ✅ 步骤 1：Rust 编译优化（已完成）

### 已添加的优化

```toml
[profile.release]
opt-level = 3        # 最大化性能（安全且有效）
lto = "thin"         # 链接时优化（平衡模式）
strip = true         # 移除调试符号
codegen-units = 16   # 默认值（平衡编译速度）
```

### 预期效果
- 二进制大小减少：**15-25%**
- 性能提升：**5-10%**
- 编译时间增加：**约 20-30%**（可接受）

### 验证方法

```bash
# 打包
npm run tauri:build

# 查看二进制大小（macOS）
ls -lh src-tauri/target/release/dz-viz

# 查看打包文件大小
ls -lh src-tauri/target/release/bundle/macos/*.app
```

### 如果需要更激进的优化（可选）

如果步骤1成功且运行正常，可以尝试：

```toml
[profile.release]
opt-level = "z"      # 最小化体积（而非速度）
lto = true           # 完全LTO（编译更慢但效果更好）
codegen-units = 1    # 单一编译单元（最大化优化）
strip = true
panic = "abort"      # 减少 panic 开销
```

**预期额外收益**：
- 体积再减少 10-15%
- 编译时间增加 2-3 倍

---

## 📋 步骤 2：前端打包优化（待实施）

### 2.1 静态资源优化

**安全的优化**（建议先做）：

```javascript
// vite.config.js
build: {
  // 小资源内联为 base64
  assetsInlineLimit: 4096,  // 4KB
  
  // 报告压缩大小
  reportCompressedSize: true,
}
```

### 2.2 代码分割优化

**保持现有的 manualChunks 配置**，已经很好了。

可以添加的增强：

```javascript
rollupOptions: {
  output: {
    // 添加文件命名策略（包含hash）
    chunkFileNames: 'assets/js/[name]-[hash].js',
    entryFileNames: 'assets/js/[name]-[hash].js',
    assetFileNames: 'assets/[ext]/[name]-[hash][extname]',
  }
}
```

### 2.3 Terser 压缩优化

**保守优化**：

```javascript
terserOptions: {
  compress: {
    drop_console: process.env.NODE_ENV === 'production',
    drop_debugger: true,
  }
}
```

**激进优化**（如果上面成功）：

```javascript
terserOptions: {
  compress: {
    drop_console: true,
    drop_debugger: true,
    pure_funcs: ['console.log', 'console.info'],
    booleans: true,
    if_return: true,
  },
  format: {
    comments: false,
  }
}
```

---

## 📋 步骤 3：路由懒加载（待实施）

当前路由已经使用懒加载（`() => import()`），可以添加的优化：

### 添加 webpackChunkName

```javascript
// src/router/index.js
{
  path: '/',
  component: () => import(
    /* webpackChunkName: "main-layout" */ 
    '@/views/MainLayout.vue'
  ),
}
```

**好处**：
- 更清晰的 chunk 命名
- 便于调试和分析
- 更好的缓存策略

---

## 📋 步骤 4：资源预加载（待实施）

### 智能预加载策略

```javascript
// src/utils/resourcePreloader.js
export async function preloadCriticalResources() {
  // 预加载关键图片
  const criticalImages = [
    '/Image/car.svg',
    '/Image/header2.png',
  ];
  
  // 预加载3D模型
  const critical3DModels = [
    '/model/cars.glb',
    '/model/final.glb',
  ];
  
  await Promise.all([
    preloadImages(criticalImages),
    preload3DModels(critical3DModels),
  ]);
}
```

**集成到 main.js**：

```javascript
// 空闲时预加载
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => preloadCriticalResources());
} else {
  setTimeout(() => preloadCriticalResources(), 1000);
}
```

---

## ⚠️ 注意事项

### 每一步都要验证

1. **打包后测试**：
   ```bash
   npm run tauri:build
   # 安装并运行打包后的应用
   ```

2. **检查功能**：
   - 应用能否正常启动 ✓
   - 3D模型能否正常加载 ✓
   - Socket连接是否正常 ✓
   - 所有菜单能否正常切换 ✓

3. **查看控制台**：
   - 无 JavaScript 错误 ✓
   - 无资源加载失败 ✓
   - 无 CSP 错误 ✓

### 如果出现问题

1. **立即回滚**到上一个工作版本
2. **记录具体错误信息**
3. **逐步定位**问题配置

---

## 🎯 推荐实施顺序

### 第一阶段（已完成）
- [x] Rust 编译优化（保守配置）

### 第二阶段（建议下一步）
1. [ ] 前端静态资源优化（assetsInlineLimit）
2. [ ] 验证打包和运行

### 第三阶段
1. [ ] 添加 Terser 压缩优化（保守配置）
2. [ ] 验证打包和运行

### 第四阶段
1. [ ] 路由懒加载命名优化
2. [ ] 验证打包和运行

### 第五阶段
1. [ ] 资源预加载
2. [ ] 验证打包和运行

### 第六阶段（可选）
1. [ ] 如果前面都成功，可以尝试更激进的 Rust 优化
2. [ ] 如果前面都成功，可以尝试更激进的 Terser 优化

---

## 📊 性能对比记录

建议在每个步骤后记录：

| 步骤 | 二进制大小 | 前端dist大小 | 启动时间 | 备注 |
|------|-----------|-------------|----------|------|
| 优化前 | ___ MB | ___ MB | ___ s | 基准 |
| Rust优化后 | ___ MB | ___ MB | ___ s | ±__%  |
| 前端优化后 | ___ MB | ___ MB | ___ s | ±__%  |
| ... | ... | ... | ... | ... |

---

## 🔧 测试脚本

### 快速验证脚本

```bash
#!/bin/bash
echo "开始打包测试..."
echo ""

# 1. 清理
rm -rf dist src-tauri/target/release/bundle

# 2. 打包
npm run tauri:build

# 3. 检查产物
if [ -d "src-tauri/target/release/bundle" ]; then
    echo "✅ 打包成功"
    
    # macOS
    if [ -d "src-tauri/target/release/bundle/macos" ]; then
        APP=$(ls src-tauri/target/release/bundle/macos/*.app 2>/dev/null)
        if [ -n "$APP" ]; then
            SIZE=$(du -sh "$APP" | cut -f1)
            echo "📦 应用大小: $SIZE"
        fi
    fi
    
    echo ""
    echo "请手动测试以下功能："
    echo "- [ ] 应用启动"
    echo "- [ ] 3D模型加载"
    echo "- [ ] Socket连接"
    echo "- [ ] 菜单切换"
    echo "- [ ] 车辆控制"
else
    echo "❌ 打包失败"
    exit 1
fi
```

---

## 💡 优化技巧

### 1. 渐进式优化
- 一次只改一个配置
- 每次都验证
- 记录每次的效果

### 2. 保留回滚点
```bash
# 每次优化前创建git commit
git add .
git commit -m "优化前的工作版本"
```

### 3. 性能分析工具

**Rust 编译分析**：
```bash
cargo build --release --timings
# 查看编译时间分布
```

**前端打包分析**：
```bash
npx vite-bundle-visualizer
# 可视化查看打包结果
```

---

## 📝 当前状态

- ✅ 基础配置正常
- ✅ 开发模式正常
- ✅ 打包后运行正常
- ✅ Rust 编译优化已添加（保守配置）
- ⏳ 等待验证优化效果

**下一步**：打包并验证 Rust 优化效果

