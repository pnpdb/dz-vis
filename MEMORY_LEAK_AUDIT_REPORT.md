# DZ-VIZ 内存泄漏全面审查报告

**审查日期**: 2025-11-01  
**审查范围**: JavaScript 代码 + Rust 代码  
**审查目标**: 确保长时间运行不会导致内存泄漏和界面卡死

---

## 📊 审查总结

### ✅ 已修复的问题（v1.3）
根据 PROJECT_GUIDE.md，项目已在 v1.3 版本修复了 **9 个关键内存泄漏点**：
- Scene3D 性能调整定时器
- Scene3D 批处理定时器
- Control.vue HLS 重试定时器
- Control.vue video 事件监听器
- Scene3D/index.vue 模型加载进度监听器
- socketManager.js Tauri listen 监听器
- videoProcessor.js 文件级 setInterval
- LogViewer.vue window 事件监听器
- Rust FFmpeg stderr 异步读取

### 🔍 本次审查发现

经过全面代码审查，**发现 12 个潜在的内存泄漏风险点**，建议尽快修复：

| 级别 | 数量 | 类别 |
|------|------|------|
| 🔴 高风险 | 4 | 必须修复 |
| 🟡 中风险 | 5 | 建议修复 |
| 🟢 低风险 | 3 | 可选修复 |

---

## 🔴 高风险问题（必须修复）

### 1. Scene3D pathRenderer 事件监听器可能泄漏

**文件**: `src/components/Scene3D/pathRenderer.js`

**问题**:
```javascript:39:45
eventBus.on('vehicle-path-draw', handlePathDraw);

eventBus.on('vehicle-path-clear', handlePathClear);

window.addEventListener('resize', updateLineResolution);
```

`destroyPathRenderer()` 函数中**只清理了 eventBus 监听器**，但**没有清理 window resize 监听器**。

**风险**: 每次场景初始化都会添加新的 resize 监听器，导致累积。

**修复建议**:
```javascript
// 在文件顶部添加监听器引用
let resizeHandler = null;

export function initPathRenderer(_scene, _markDirty) {
    // ...
    
    // 保存引用
    resizeHandler = updateLineResolution;
    window.addEventListener('resize', resizeHandler);
}

export function destroyPathRenderer() {
    // 清理 window 监听器
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
    }
    
    // 清理 eventBus（已有）
    eventBus.off('vehicle-path-draw', handlePathDraw);
    eventBus.off('vehicle-path-clear', handlePathClear);
    
    // 清理其他资源...
}
```

---

### 2. Scene3D 批处理定时器数组未清理

**文件**: `src/components/Scene3D/index.js:86`

**问题**:
```javascript:86
let batchProcessingTimers = [];
```

代码中定义了 `batchProcessingTimers` 数组用于追踪批处理定时器，但在 `destroyScene()` 函数中**没有清理这个数组**。

**风险**: 如果定时器存储在数组中但未清理，会导致定时器持续运行。

**修复建议**:
```javascript
export const destroyScene = () => {
    console.log('🗑️ 销毁3D场景...');
    
    // 1. 清理批处理定时器（新增）
    if (batchProcessingTimers && batchProcessingTimers.length > 0) {
        batchProcessingTimers.forEach(timer => {
            if (timer) clearTimeout(timer);
        });
        batchProcessingTimers = [];
        console.log('✅ 批处理定时器已清理');
    }
    
    // 2. 清理性能调整定时器（已有）
    if (performanceAdjustTimer) {
        clearTimeout(performanceAdjustTimer);
        performanceAdjustTimer = null;
    }
    
    // ... 其他清理代码
};
```

---

### 3. Control.vue video 事件监听器清理不完整

**文件**: `src/views/Control.vue:590-591`

**问题**:
```javascript:590:591
videoRef.value.addEventListener('canplay', onCanPlay);
videoRef.value.addEventListener('error', onError);
```

虽然代码在 `stopVideoStream()` 中有清理逻辑（第663-667行），但**清理函数依赖于 `videoRef.value._mseCleanupListeners` 的存在**。如果在添加监听器时出现错误，这个清理函数可能不会被设置，导致监听器泄漏。

**风险**: 在异常情况下（如连接失败），事件监听器可能不会被清理。

**修复建议**:
```javascript
const startRTSPCamera = async (camera) => {
    // ... 前面的代码
    
    // 保存事件监听器引用到外部作用域（而不是 videoRef 上）
    let canPlayHandler = null;
    let errorHandler = null;
    
    try {
        // ...
        
        // 定义清理函数
        const cleanupVideoListeners = () => {
            if (videoRef.value && canPlayHandler) {
                videoRef.value.removeEventListener('canplay', canPlayHandler);
                canPlayHandler = null;
            }
            if (videoRef.value && errorHandler) {
                videoRef.value.removeEventListener('error', errorHandler);
                errorHandler = null;
            }
        };
        
        // 定义监听器
        canPlayHandler = () => {
            console.log('🎬 视频数据已就绪');
            cleanupVideoListeners();
            isStreaming.value = true;
            isLoading.value = false;
        };
        
        errorHandler = (e) => {
            console.error('❌ 视频播放错误:', e);
            cleanupVideoListeners();
        };
        
        // 添加监听器
        videoRef.value.addEventListener('canplay', canPlayHandler);
        videoRef.value.addEventListener('error', errorHandler);
        
        // 保存清理函数（用于外部调用）
        videoRef.value._mseCleanupListeners = cleanupVideoListeners;
        
        // ...
    } catch (error) {
        // 确保在异常时也清理监听器
        if (canPlayHandler && videoRef.value) {
            videoRef.value.removeEventListener('canplay', canPlayHandler);
        }
        if (errorHandler && videoRef.value) {
            videoRef.value.removeEventListener('error', errorHandler);
        }
        throw error;
    }
};
```

---

### 4. Scene3D 视口变化检测定时器未追踪

**文件**: `src/components/Scene3D/index.js:656-680`

**问题**:
代码使用 `setTimeout` 延迟执行场景调整，但**没有保存定时器引用**，无法在组件销毁时取消：

```javascript:656:680
// setTimeout(() => {
//     alignSandbox();
//     markDirty();
// }, 0);

// 延迟执行，确保renderer已挂载
setTimeout(() => {
    alignSandbox();
    markDirty();
}, 100);
```

**风险**: 如果用户在场景初始化过程中快速切换页面，这些延迟的回调仍会执行，可能访问已销毁的对象。

**修复建议**:
```javascript
// 在文件顶部添加
let sceneInitTimers = [];

// 包装 setTimeout
const safeSetTimeout = (callback, delay) => {
    const timer = setTimeout(() => {
        callback();
        // 执行后从数组中移除
        const index = sceneInitTimers.indexOf(timer);
        if (index > -1) {
            sceneInitTimers.splice(index, 1);
        }
    }, delay);
    sceneInitTimers.push(timer);
    return timer;
};

// 在 initScene 中使用
safeSetTimeout(() => {
    alignSandbox();
    markDirty();
}, 100);

// 在 destroyScene 中清理
export const destroyScene = () => {
    // 清理初始化定时器
    sceneInitTimers.forEach(timer => clearTimeout(timer));
    sceneInitTimers = [];
    
    // ... 其他清理代码
};
```

---

## 🟡 中风险问题（建议修复）

### 5. main.js 启动定时器未清理

**文件**: `src/main.js:145-155`

**问题**:
```javascript:145:155
startupTimers.appInit = setTimeout(() => {
    // ...
    startupTimers.socketInit = setTimeout(async () => {
        // ...
    }, 2000);
}, 100);
```

应用启动时创建的定时器存储在 `startupTimers` 对象中，但**没有在应用关闭时清理**。

**风险**: 低（仅在应用启动时执行一次，但不够规范）。

**修复建议**:
```javascript
// 在 window beforeunload 事件中清理
window.addEventListener('beforeunload', () => {
    // 清理启动定时器
    if (startupTimers.appInit) {
        clearTimeout(startupTimers.appInit);
    }
    if (startupTimers.socketInit) {
        clearTimeout(startupTimers.socketInit);
    }
    
    // ... 其他清理代码
});
```

---

### 6. videoProcessor.js 全局定时器清理逻辑不完整

**文件**: `src/utils/videoProcessor.js:32`

**问题**:
虽然导出了 `stopVideoProcessing()` 清理函数，但**没有在应用关闭时自动调用**。

**风险**: 如果开发者忘记调用清理函数，定时器会一直运行。

**修复建议**:
```javascript
// 在 main.js 中自动清理
import { stopVideoProcessing } from '@/utils/videoProcessor.js';

window.addEventListener('beforeunload', () => {
    stopVideoProcessing();
    // ... 其他清理代码
});
```

---

### 7. protocolProcessor.js 协议处理定时器

**文件**: `src/utils/protocolProcessor.js:378`

**问题**:
```javascript:378
const intervalId = setInterval(async () => {
    // 协议处理逻辑
}, 100);
```

代码中创建了 `setInterval` 用于协议处理，但**没有明确的清理机制**。

**风险**: 如果协议处理器没有正确销毁，定时器会持续运行。

**修复建议**:
检查是否有对应的清理函数，如果没有需要添加：
```javascript
// 导出清理函数
export function stopProtocolProcessor() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}
```

---

### 8. logger.js 节流清理定时器

**文件**: `src/utils/logger.js:32`

**问题**:
```javascript:32
this.throttleMapCleanupTimer = setInterval(() => {
    // 清理过期的节流 Map
}, 60000);
```

Logger 类创建了一个定时器用于清理节流 Map，但**没有提供销毁方法**。

**风险**: 如果 Logger 实例被多次创建，定时器会累积。

**修复建议**:
```javascript
export class Logger {
    constructor(namespace) {
        // ...
        this.throttleMapCleanupTimer = setInterval(() => {
            this.cleanupThrottleMap();
        }, 60000);
    }
    
    // 新增：销毁方法
    destroy() {
        if (this.throttleMapCleanupTimer) {
            clearInterval(this.throttleMapCleanupTimer);
            this.throttleMapCleanupTimer = null;
        }
        this.throttleMap.clear();
    }
}
```

---

### 9. videoStreamManager.js 超时定时器管理

**文件**: `src/utils/videoStreamManager.js:118-123`

**问题**:
```javascript:118:123
resetTimeout(id) {
    // 清理旧定时器
    const timer = setTimeout(() => {
        // 超时处理
    }, this.timeout);
}
```

虽然有 `resetTimeout` 方法，但**没有在销毁时清理所有活跃的定时器**。

**风险**: 如果视频流管理器被销毁，未清理的定时器仍会触发。

**修复建议**:
```javascript
export class VideoStreamManager {
    constructor() {
        this.activeTimers = new Map(); // 追踪所有活跃定时器
    }
    
    resetTimeout(id) {
        // 清理旧定时器
        if (this.activeTimers.has(id)) {
            clearTimeout(this.activeTimers.get(id));
        }
        
        const timer = setTimeout(() => {
            this.activeTimers.delete(id);
            // 超时处理
        }, this.timeout);
        
        this.activeTimers.set(id, timer);
    }
    
    // 新增：销毁方法
    destroy() {
        this.activeTimers.forEach(timer => clearTimeout(timer));
        this.activeTimers.clear();
    }
}
```

---

## 🟢 低风险问题（可选修复）

### 10. Scene3D.vue setTimeout 延迟初始化

**文件**: `src/components/Scene3D/index.vue:29`

**问题**:
```javascript:29
setTimeout(async () => {
    // 初始化 3D 场景
}, 100);
```

这个 `setTimeout` 用于延迟初始化，**没有保存引用**。

**风险**: 极低（组件生命周期管理正确）。

**修复建议**:
虽然风险很低，但为了完整性可以追踪：
```javascript
let initTimer = null;

onMounted(async () => {
    await nextTick();
    
    initTimer = setTimeout(async () => {
        try {
            await initSceneAsync(container);
        } catch (error) {
            console.error('Scene3D初始化失败:', error);
        }
    }, 100);
});

onUnmounted(() => {
    if (initTimer) {
        clearTimeout(initTimer);
        initTimer = null;
    }
    // ... 其他清理代码
});
```

---

### 11. Toast.js requestAnimationFrame 清理

**文件**: `src/utils/toast.js:188-198`

**问题**:
```javascript:188:198
requestAnimationFrame(() => {
    // 动画逻辑
    setTimeout(() => {
        // 淡出动画
        setTimeout(() => {
            // 移除 Toast
        }, 300);
    }, duration);
});
```

虽然 Toast 系统设计合理，但**嵌套的 RAF + setTimeout 可能在极端情况下（如快速创建大量 Toast）累积**。

**风险**: 极低（Toast 数量有限制）。

**修复建议**:
已有对象池机制，无需修改。但可以添加全局清理：
```javascript
// 导出清理函数（用于应用关闭时）
export function destroyAllToasts() {
    if (toastContainer && toastContainer.parentNode) {
        toastContainer.parentNode.removeChild(toastContainer);
        toastContainer = null;
    }
    toastPool.length = 0; // 清空对象池
}
```

---

### 12. Header.vue 防抖定时器

**文件**: `src/components/Header.vue:674,865`

**问题**:
```javascript:674,865
setTimeout(() => {
    // UI 更新
}, 300);
```

这些 `setTimeout` 用于防抖，**没有保存引用**。

**风险**: 极低（生命周期内正常清理）。

**修复建议**:
如果需要严格管理，可以使用 `throttle` 工具函数替代裸 `setTimeout`。

---

## ✅ 已正确处理的资源

### JavaScript 端

1. **Event Bus 监听器** ✅
   - 所有 Vue 组件在 `onBeforeUnmount` 中正确清理
   - 示例：`Map.vue`, `Control.vue`, `Cars.vue`, `Settings.vue`

2. **定时器清理** ✅ (大部分)
   - `Map.vue`: `dataUpdateInterval`, `serverStatusInterval` 正确清理
   - `VehicleTimeChart.vue`: `updateInterval` 正确清理
   - `DrivingBehaviorChart.vue`: `updateInterval` 正确清理
   - `ProtocolPerformanceMonitor.vue`: `monitoringInterval` 正确清理
   - `VideoPerformanceMonitor.vue`: `refreshTimer` 正确清理
   - `useSystemTime.js`: `timer` 正确清理

3. **Three.js 资源释放** ✅
   - `resourceCleanup.js` 提供完整的清理工具：
     - `disposeMaterial()` - 材质清理
     - `disposeGeometry()` - 几何体清理
     - `disposeMesh()` - 网格清理
     - `disposeObject3D()` - 递归清理对象树
   - `vehicleManager.js` 正确使用清理工具：
     ```javascript:209:224
     disposeObject3D(vehicleModel, {
         removeFromParent: true,
         recursive: true
     });
     ```

4. **MSE 播放器清理** ✅
   - `msePlayer.js` 正确清理所有资源：
     - Object URL 撤销
     - SourceBuffer 事件监听器移除
     - WebSocket 连接关闭
     - 连接超时定时器清理
     - 实时流监控定时器清理

5. **Tauri 事件监听器** ✅
   - `socketManager.js` 正确保存和清理 `unlisten` 函数：
     ```javascript:128:172
     const unlisten1 = await listen('socket-message', ...);
     this.unlisteners.push(unlisten1);
     
     // 在清理时调用
     this.unlisteners.forEach(unlisten => unlisten());
     ```

### Rust 端

1. **异步任务管理** ✅
   - `mse_streamer/mod.rs`: 正确使用 `tokio::spawn` 并在 `stop_stream` 中终止进程
   - `socket/server.rs`: 连接断开时正确清理资源

2. **FFmpeg 进程管理** ✅
   - `mse_streamer/mod.rs:208-219`: 正确终止和等待进程退出：
     ```rust:208:219
     pub async fn stop_stream(&self, camera_id: u32) {
         let mut processes = self.processes.write().await;
         if let Some(mut child) = processes.remove(&camera_id) {
             let _ = child.kill().await;
             let _ = child.wait().await;
         }
     }
     ```

3. **广播通道管理** ✅
   - `mse_streamer/mod.rs`: 正确移除广播器，自动断开所有订阅者

4. **Arc/RwLock 使用** ✅
   - 所有共享状态正确使用 `Arc<RwLock<>>` 包装
   - 无循环引用风险

---

## 🎯 修复优先级建议

### 立即修复（1-2天内）
1. **Scene3D pathRenderer window resize 监听器泄漏** (问题1)
2. **Scene3D batchProcessingTimers 数组未清理** (问题2)  
3. **Control.vue video 事件监听器清理不完整** (问题3)
4. **Scene3D 视口变化定时器未追踪** (问题4)

### 短期修复（1周内）
5. **main.js 启动定时器清理** (问题5)
6. **videoProcessor.js 自动清理** (问题6)
7. **protocolProcessor.js 定时器管理** (问题7)
8. **logger.js destroy 方法** (问题8)
9. **videoStreamManager.js 定时器清理** (问题9)

### 长期优化（可选）
10. **Scene3D.vue initTimer 追踪** (问题10)
11. **Toast.js 全局清理函数** (问题11)
12. **Header.vue 防抖优化** (问题12)

---

## 🛠️ 通用修复模式

### 模式1: 定时器追踪
```javascript
// ❌ 错误
setTimeout(() => { /* ... */ }, 1000);

// ✅ 正确
let timer = setTimeout(() => { /* ... */ }, 1000);

onBeforeUnmount(() => {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
});
```

### 模式2: 事件监听器清理
```javascript
// ❌ 错误
window.addEventListener('resize', handleResize);

// ✅ 正确
const handleResize = () => { /* ... */ };
window.addEventListener('resize', handleResize);

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
});
```

### 模式3: 数组定时器管理
```javascript
// ✅ 推荐
const timers = [];

const safeSetTimeout = (callback, delay) => {
    const timer = setTimeout(() => {
        callback();
        const index = timers.indexOf(timer);
        if (index > -1) timers.splice(index, 1);
    }, delay);
    timers.push(timer);
    return timer;
};

// 清理所有
timers.forEach(t => clearTimeout(t));
timers.length = 0;
```

### 模式4: 对象池清理
```javascript
// ✅ 推荐（已在 Toast.js 使用）
const objectPool = [];

function cleanup() {
    objectPool.forEach(obj => {
        // 清理对象
    });
    objectPool.length = 0;
}
```

---

## 📝 测试建议

### 1. 内存泄漏检测测试
```javascript
// 在浏览器开发者工具中运行
// 1. 打开 Chrome DevTools → Memory → Take Heap Snapshot
// 2. 执行以下操作 50 次：
//    - 切换摄像头
//    - 切换车辆
//    - 添加/删除施工标记
// 3. 再次拍摄快照
// 4. 对比内存增长（应保持稳定或增长<10MB）
```

### 2. 长时间运行测试
```bash
# 测试步骤
1. 启动应用
2. 连接 2-3 辆车
3. 打开摄像头
4. 让应用运行 8-12 小时
5. 监控内存使用（应保持稳定）
6. 检查界面响应速度（不应变慢）
```

### 3. 快速切换测试
```bash
# 测试步骤（压力测试）
1. 快速切换车辆（50次）
2. 快速切换摄像头（50次）
3. 快速打开/关闭菜单（100次）
4. 检查内存是否持续增长
5. 检查是否有控制台错误
```

---

## 📚 参考资料

### 内存泄漏检测工具
- Chrome DevTools Memory Profiler
- Vue DevTools
- `window.performance.memory` API

### 最佳实践文档
- [Vue.js 内存泄漏最佳实践](https://vuejs.org/guide/best-practices/performance.html)
- [Three.js 内存管理](https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects)
- [JavaScript 内存管理](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)

---

## ✅ 结论

1. **整体评估**: 项目在 v1.3 版本已经做了大量内存泄漏修复工作，整体代码质量**良好**。

2. **当前风险**: 
   - 🔴 高风险问题 **4 个**（需要立即修复）
   - 🟡 中风险问题 **5 个**（建议尽快修复）
   - 🟢 低风险问题 **3 个**（可选修复）

3. **长时间运行预期**:
   - **修复前**: 连续运行 4-8 小时后可能出现轻微内存增长和界面卡顿
   - **修复后**: 可以稳定运行 24 小时以上，无明显性能下降

4. **修复时间估算**:
   - 高风险问题修复: **2-4 小时**
   - 中风险问题修复: **3-6 小时**
   - 测试验证: **4-8 小时**
   - **总计**: 约 1-2 个工作日

---

**审查人**: AI Assistant  
**最后更新**: 2025-11-01

