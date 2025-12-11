# 🌉 高架桥系统 - 快速参考

## 📦 浏览器控制台命令

### 查看配置
```javascript
window.__debugElevation()
```

### 显示/隐藏边界线
```javascript
window.__showElevationLines()   // 显示（注：启动时会自动显示）
window.__hideElevationLines()   // 隐藏
```

**注意**：边界线会在沙盘加载完成后自动绘制，无需手动调用。

### 测试坐标
```javascript
window.__testElevation(x, y)
// 例如：window.__testElevation(3.0, 3.5)
```

### 调整参数
```javascript
// 调整高架桥高度
window.__updateElevation({ BRIDGE_HEIGHT: 0.18 })

// 调整边界
window.__updateElevation({ 
    X1: 0.8,
    X2: 5.2,
    Y1: 2.95,
    Y2: 3.92
})

// 启用/禁用
window.__updateElevation({ enabled: true })
```

---

## 🎨 边界线颜色

- 🔴 **红色**：X1 (左侧边界)
- 🟢 **绿色**：X2 (右侧边界)
- 🔵 **蓝色**：Y1 (坡道起点)
- 🟡 **黄色**：Y2 (高架起点)

---

## 📏 当前参数

| 参数 | 值 | 说明 |
|------|-----|------|
| X1 | 0.790m | 左边界 |
| X2 | 5.205m | 右边界 |
| Y1 | 2.958m | 坡道起点 |
| Y2 | 3.913m | 高架起点 |
| BRIDGE_HEIGHT | 0.15m | 高架高度 |

---

## 🔧 调试流程

1. `__showElevationLines()` - 显示边界
2. 让车辆行驶观察
3. `__testElevation(x, y)` - 测试具体位置
4. `__updateElevation({...})` - 调整参数
5. 重复 2-4 直到满意

---

详细文档：[ELEVATION_SYSTEM_GUIDE.md](./ELEVATION_SYSTEM_GUIDE.md)
