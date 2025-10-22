# Font Awesome 图标库迁移文档

## 问题背景

在 Ubuntu 系统下，使用 Tauri WebView 时遇到兼容性问题：

- **WEBKIT_DISABLE_COMPOSITING_MODE=0**：Font Awesome SVG 图标无法显示
- **WEBKIT_DISABLE_COMPOSITING_MODE=1**：Three.js 无法使用 WebGL 加速

为了保持 WebGL 加速（设置为 0），需要解决图标不显示的问题。

## 解决方案

从 **Font Awesome SVG 模式** 迁移到 **Web Fonts 模式**（CSS + 字体文件）。

## 迁移内容

### 1. 依赖包变化

**移除的包：**
```json
"@fortawesome/fontawesome-svg-core": "^6.7.2"
"@fortawesome/free-solid-svg-icons": "^6.7.2"
"@fortawesome/vue-fontawesome": "^3.0.8"
```

**新增的包：**
```json
"@fortawesome/fontawesome-free": "^7.x.x"
```

### 2. 文件变化

#### 删除的文件
- `src/icons/index.js` - SVG 模式的图标注册配置

#### 新增的文件
- `src/components/FontAwesomeIcon.vue` - Web Fonts 模式的包装组件

#### 修改的文件
- `src/main.js` - 更新导入方式和组件注册

### 3. 实现原理

创建了一个兼容包装组件 `FontAwesomeIcon.vue`，将原有的 SVG 组件 API 转换为 CSS 类：

**组件逻辑：**
```vue
<template>
    <i :class="iconClass"></i>
</template>

<script setup>
const iconClass = computed(() => {
    return `fas fa-${props.icon}`;  // 转换为 Font Awesome CSS 类
});
</script>
```

**使用方式保持不变：**
```vue
<fa icon="save" />      <!-- 渲染为: <i class="fas fa-save"></i> -->
<fa icon="trash" />     <!-- 渲染为: <i class="fas fa-trash"></i> -->
<fa icon="sync-alt" />  <!-- 渲染为: <i class="fas fa-sync-alt"></i> -->
```

### 4. 优势

✅ **完全兼容**：所有现有代码无需修改，保持 `<fa icon="xxx" />` 语法  
✅ **解决兼容性问题**：Web Fonts 模式在 WebKit compositing 模式下正常工作  
✅ **保持 WebGL 加速**：Three.js 可以正常使用硬件加速  
✅ **按需加载**：通过 CSS 引入所有图标，无需逐个注册  
✅ **更小的包体积**：字体文件比 SVG 组件更轻量  

### 5. 技术细节

#### Web Fonts 模式原理

Font Awesome Web Fonts 通过以下方式工作：

1. **CSS 文件** (`all.css`) 定义图标样式和字体引用
2. **字体文件** (`.woff2`, `.woff`, `.ttf`) 包含图标字形
3. **CSS 类** (如 `fas fa-save`) 通过伪元素 `::before` 显示图标
4. **Unicode 字符** 映射到字体中的图标字形

#### 为什么 Web Fonts 在 compositing 模式下有效

- SVG 模式：动态生成 SVG DOM 元素，可能受 WebKit compositing 影响
- Web Fonts 模式：使用传统字体渲染，不受 compositing 模式影响

## 可用图标

Font Awesome Free 包含 2000+ 个免费图标，所有 Solid 风格的图标都可以直接使用：

- 官网：https://fontawesome.com/icons
- 搜索示例：输入 "save" 查找保存图标
- 使用方式：`<fa icon="save" />`

## 注意事项

⚠️ **图标名称规则**：
- 使用短横线分隔：`sync-alt`, `arrow-up`, `times-circle`
- 不需要 `fa-` 前缀，组件会自动添加
- 仅支持 Solid 风格（`fas`），如需其他风格需修改组件

⚠️ **样式继承**：
- 图标颜色继承父元素的 `color`
- 图标大小继承父元素的 `font-size`
- 可通过父元素或包装元素控制样式

## 迁移日期

2025-10-21

## 相关 Issue

Ubuntu WebKit Compositing Mode 兼容性问题

---

**最后更新**: 2025-10-21  
**版本**: v0.2.0

