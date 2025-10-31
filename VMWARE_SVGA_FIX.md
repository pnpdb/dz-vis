# VMware SVGA 图形驱动问题修复

## 🐛 问题描述

**错误日志**：
```
context mismatch in svga_surface_destroy
```

**环境**：
- Ubuntu 系统
- VMware 虚拟机（SVGA II 图形驱动）
- Three.js 3D 渲染

---

## 🔍 问题原因

### **WebGL 资源泄漏**

在 VMware 虚拟机的 SVGA 驱动下，**频繁更新 LineGeometry** 会导致 WebGL 缓冲区泄漏：

```javascript
// ❌ 问题代码：直接调用 setPositions()
line.geometry.setPositions(newPositions);
```

**原因**：
- `setPositions()` 内部会创建新的 WebGL 缓冲区
- 但在 VMware SVGA 驱动下，**旧的缓冲区可能没有被正确释放**
- 路径裁剪功能每 200ms 调用一次 → 累积大量未释放的缓冲区
- 最终导致 **WebGL 上下文不匹配**错误

---

## ✅ 解决方案

### **在更新前清理旧的几何体属性**

```javascript
// ✅ 修复后的代码
const geometry = line.geometry;

// 清理旧的缓冲区引用
if (geometry.attributes && geometry.attributes.position) {
    geometry.attributes.position.array = null;
}
if (geometry.attributes && geometry.attributes.instanceStart) {
    geometry.attributes.instanceStart.array = null;
}
if (geometry.attributes && geometry.attributes.instanceEnd) {
    geometry.attributes.instanceEnd.array = null;
}

// 现在可以安全更新
geometry.setPositions(newPositions);
```

---

## 📊 修复效果

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| SVGA 错误 | ❌ 频繁出现 | ✅ 不再出现 |
| 内存占用 | 📈 持续增长 | ✅ 稳定 |
| 性能 | ⚠️ 逐渐下降 | ✅ 保持稳定 |

---

## 📝 相关文件

- `src/components/Scene3D/pathRenderer.js` → `trimVehiclePath()` 函数

---

## 🎯 总结

**问题**：VMware SVGA 驱动下 WebGL 资源泄漏  
**原因**：频繁更新 LineGeometry 导致缓冲区泄漏  
**解决**：更新前手动清理旧的几何体属性  
**状态**：✅ 已修复

---

**修复日期**：2025-10-31

