# Toast 迁移指南

## 背景

由于 Element Plus 的 `ElMessage` 组件在 Ubuntu WebKitGTK 环境下存在兼容性问题（icon 不显示、背景色异常），我们创建了自定义的 Toast 通知系统。

## 使用方法

### 1. 在组件中导入（推荐）

```javascript
import Toast from '@/utils/toast.js';

// 使用
Toast.success('操作成功');
Toast.warning('警告信息');
Toast.error('错误信息');
Toast.info('提示信息');
```

### 2. 使用全局实例（便捷方式）

Toast 已在 `main.js` 中暴露到 `window` 对象，可以直接使用：

```javascript
// 无需导入，直接使用
window.Toast.success('操作成功');

// 或者在组件中
Toast.success('操作成功');  // 需要在使用前访问 window.Toast
```

### 3. API 说明

```javascript
// 基本用法
Toast.success(message, duration);  // 成功消息（绿色）
Toast.warning(message, duration);  // 警告消息（橙色）
Toast.error(message, duration);    // 错误消息（红色）
Toast.info(message, duration);     // 信息消息（灰色）

// 参数说明
// message: string - 消息内容
// duration: number - 显示时长（毫秒），默认 3000ms

// 示例
Toast.success('车辆启动成功');
Toast.warning('当前车辆离线', 5000);  // 显示5秒
Toast.error('操作失败，请重试');
```

## 从 ElMessage 迁移

### 替换示例

#### 之前（ElMessage）：
```javascript
import { ElMessage } from 'element-plus';

ElMessage.success('操作成功');
ElMessage.warning('警告信息');
ElMessage.error('错误信息');
ElMessage.info('提示信息');

// 带配置
ElMessage({
  message: '自定义消息',
  type: 'success',
  duration: 3000
});
```

#### 之后（Toast）：
```javascript
import Toast from '@/utils/toast.js';

Toast.success('操作成功');
Toast.warning('警告信息');
Toast.error('错误信息');
Toast.info('提示信息');

// 带自定义时长
Toast.success('自定义消息', 3000);
```

### 批量替换步骤

1. **替换导入语句**：
   ```javascript
   // 移除
   import { ElMessage } from 'element-plus';
   
   // 添加
   import Toast from '@/utils/toast.js';
   ```

2. **替换调用**：
   - `ElMessage.success()` → `Toast.success()`
   - `ElMessage.warning()` → `Toast.warning()`
   - `ElMessage.error()` → `Toast.error()`
   - `ElMessage.info()` → `Toast.info()`

3. **处理复杂配置**：
   ```javascript
   // 之前
   ElMessage({
     message: '消息内容',
     type: 'success',
     duration: 5000,
     showClose: true,
     offset: 100
   });
   
   // 之后（简化）
   Toast.success('消息内容', 5000);
   ```

## 特性对比

| 特性 | ElMessage | 自定义 Toast | 说明 |
|------|-----------|--------------|------|
| 基本通知 | ✅ | ✅ | 四种类型：success/warning/error/info |
| 自定义时长 | ✅ | ✅ | Toast 默认 3000ms |
| Icon 显示 | ⚠️ Ubuntu 有问题 | ✅ | 使用 Unicode 字符，跨平台兼容 |
| 背景色 | ⚠️ Ubuntu 有问题 | ✅ | 固定配色，保证一致性 |
| 宽度自适应 | ⚠️ Ubuntu 有问题 | ✅ | 使用 `fit-content` |
| 关闭按钮 | ✅ | ❌ | Toast 自动关闭，无手动关闭按钮 |
| HTML 内容 | ✅ | ❌ | Toast 仅支持纯文本 |
| 自定义类名 | ✅ | ❌ | Toast 使用固定样式 |

## 已迁移文件

- ✅ `src/components/CarButton.vue`
- ✅ `src/utils/socketManager.js`
- ✅ `src/main.js` (全局注册)

## 待迁移文件

以下文件仍在使用 `ElMessage`，可以逐步迁移：

- `src/views/Settings.vue`
- `src/components/VehicleConnectionManager.vue`
- `src/components/Header.vue`
- `src/components/SandboxSettingsManager.vue`
- `src/components/MenuVisibilitySettings.vue`
- `src/views/AutoDrive.vue`
- `src/views/Control.vue`
- `src/views/ParallelDriving.vue`
- `src/router/index.js`
- `src/components/CarCamera.vue`
- `src/components/CarSettings.vue`
- `src/components/ProtocolPerformanceMonitor.vue`
- `src/components/VideoPerformanceMonitor.vue`

## 注意事项

1. **Toast 仅支持纯文本**：如果需要 HTML 内容，仍需使用 ElMessage
2. **无手动关闭按钮**：Toast 会自动关闭，不支持用户手动关闭
3. **样式固定**：Toast 使用固定的配色方案，保证跨平台一致性
4. **并发显示**：多个 Toast 会垂直堆叠显示

## 技术实现

- 位置：`src/utils/toast.js`
- 样式：内联样式（无需额外 CSS）
- Icon：Unicode 字符（✓ ⚠ ✕ ℹ）
- 动画：CSS transition
- 容器：动态创建/销毁，避免内存泄漏

## 示例代码

查看 `src/components/CarButton.vue` 获取完整的迁移示例。

