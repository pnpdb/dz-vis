# 代码优化建议清单

基于全面代码审查，以下是发现的优化机会和建议。

---

## 一、性能优化

### 1. Scene3D 渲染优化 ⭐⭐⭐

**现状**：
- 每帧都在遍历整个场景 (`scene.traverse`) 更新材质 uniforms
- 即使没有动画材质也会被遍历

**优化建议**：
```javascript
// src/components/Scene3D/index.js
// ❌ 当前：每帧遍历所有对象
scene.traverse((object) => {
    if (object.isMesh && object.material && object.material.uniforms) {
        const uTime = object.material.uniforms.uTime;
        if (uTime) {
            uTime.value += delta;
        }
    }
});

// ✅ 优化：维护需要动画的对象列表
let animatedObjects = []; // 初始化时收集

function updateAnimatedObjects(delta) {
    for (let i = 0; i < animatedObjects.length; i++) {
        animatedObjects[i].material.uniforms.uTime.value += delta;
    }
}
```

**预期收益**：减少 30-50% 的帧循环开销

---

### 2. 车辆状态更新节流优化 ⭐⭐⭐

**现状**：
- 虽然已经使用 Rust 进行状态比对，但仍在 JS 中做了一次比对
- 状态更新事件没有完全节流

**优化建议**：
```javascript
// src/utils/socketManager.js
// 完全移除 JS 侧的状态比对，只用 Rust
async updateVehicleInfoFromParsed(carId, parsed, timestamp) {
    const store = this.ensureCarStore();
    if (!store) return;

    // ✅ 直接使用 Rust 的比对结果
    const prevState = store.getVehicleRuntimeState(carId);
    if (prevState) {
        const result = await invoke('is_vehicle_state_changed', {
            prev: prevState,
            next: parsed
        });
        
        if (!result.changed) {
            return; // 跳过更新
        }
    }

    // 更新状态
    store.updateVehicleState(carId, parsed);
    
    // 使用已经创建的节流发射器
    this.throttledEmitters.vehicleInfo.emit(parsed);
}
```

**预期收益**：减少 10-20% 的 CPU 占用

---

### 3. 视频帧处理优化 ⭐⭐

**现状**：
- 视频帧处理队列可能积压
- 没有帧率控制和丢帧策略

**优化建议**：
```javascript
// src/utils/videoStreamManager.js
class VideoStreamManager {
    constructor() {
        this.maxQueueSize = 3; // 限制队列大小
        this.frameQueue = [];
        this.isProcessing = false;
        this.targetFPS = 30; // 目标帧率
        this.lastFrameTime = 0;
    }

    async handleFrame(frame) {
        const now = performance.now();
        const minFrameInterval = 1000 / this.targetFPS;
        
        // 帧率控制
        if (now - this.lastFrameTime < minFrameInterval) {
            return; // 跳过此帧
        }
        
        // 队列满时丢弃旧帧
        if (this.frameQueue.length >= this.maxQueueSize) {
            this.frameQueue.shift(); // 丢弃最老的帧
        }
        
        this.frameQueue.push(frame);
        this.lastFrameTime = now;
        
        if (!this.isProcessing) {
            this.processQueue();
        }
    }
    
    async processQueue() {
        this.isProcessing = true;
        while (this.frameQueue.length > 0) {
            const frame = this.frameQueue.shift();
            await this.processFrame(frame);
        }
        this.isProcessing = false;
    }
}
```

**预期收益**：稳定 30FPS 视频流，减少内存占用

---

## 二、代码组织优化

### 1. 提取组合式函数 (Composables) ⭐⭐⭐

**现状**：
- 多个组件有相似的逻辑（时间显示、FPS监控、网络状态）
- 代码重复

**优化建议**：

#### 创建 `src/composables/useSystemTime.js`
```javascript
import { ref, onMounted, onBeforeUnmount } from 'vue';

export function useSystemTime() {
    const currentTime = ref('');
    let timer = null;

    const updateTime = () => {
        const now = new Date();
        currentTime.value = now.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    onMounted(() => {
        updateTime();
        timer = setInterval(updateTime, 1000);
    });

    onBeforeUnmount(() => {
        if (timer) clearInterval(timer);
    });

    return { currentTime };
}
```

#### 创建 `src/composables/useFPS.js`
```javascript
import { ref, onMounted, onBeforeUnmount } from 'vue';
import eventBus, { EVENTS } from '@/utils/eventBus';

export function useFPS() {
    const fps = ref(60);
    const fpsPercentage = computed(() => (fps.value / 60) * 100);

    const handleFPSUpdate = (newFPS) => {
        fps.value = newFPS;
    };

    onMounted(() => {
        eventBus.on(EVENTS.FPS_UPDATE, handleFPSUpdate);
    });

    onBeforeUnmount(() => {
        eventBus.off(EVENTS.FPS_UPDATE, handleFPSUpdate);
    });

    return { fps, fpsPercentage };
}
```

#### 创建 `src/composables/useNetworkStatus.js`
```javascript
import { ref, computed } from 'vue';
import { useCarStore } from '@/stores/car';

export function useNetworkStatus() {
    const carStore = useCarStore();

    const networkStatus = computed(() => {
        const onlineCount = carStore.getOnlineVehicleCount();
        const sandboxConnected = carStore.isSandboxConnected();

        if (!sandboxConnected) {
            return { icon: 'times-circle', text: '沙盘离线' };
        }
        if (onlineCount === 0) {
            return { icon: 'exclamation-circle', text: '无车辆在线' };
        }
        return { icon: 'check-circle', text: `${onlineCount} 辆车在线` };
    });

    return { networkStatus };
}
```

**使用示例**：
```vue
<script setup>
import { useSystemTime } from '@/composables/useSystemTime';
import { useFPS } from '@/composables/useFPS';
import { useNetworkStatus } from '@/composables/useNetworkStatus';

const { currentTime } = useSystemTime();
const { fps, fpsPercentage } = useFPS();
const { networkStatus } = useNetworkStatus();
</script>
```

**预期收益**：
- 减少 200+ 行重复代码
- 提高可测试性
- 更好的代码复用

---

### 2. 统一错误处理 ⭐⭐

**现状**：
- 有两个错误处理系统：`errorHandler.js` 和 `globalErrorHandler.js`
- 功能重叠，容易混淆

**优化建议**：

#### 合并为单一错误处理系统
```javascript
// src/utils/errorHandler.js（合并后）
export class ErrorHandler {
    static errorQueue = [];
    static listeners = new Set();

    // 统一的错误处理入口
    static handle(error, context = {}) {
        const errorInfo = this.format(error, context);
        this.log(errorInfo);
        this.notify(errorInfo);
        this.emit(errorInfo);
        return errorInfo;
    }

    // 格式化错误
    static format(error, context) {
        return {
            id: `err_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: this.getType(error),
            message: error.message || '未知错误',
            stack: error.stack,
            context,
            severity: this.getSeverity(error),
        };
    }

    // 错误类型判断
    static getType(error) {
        if (error.name === 'NetworkError') return 'NETWORK';
        if (error.message?.includes('Tauri')) return 'TAURI';
        if (error.message?.includes('timeout')) return 'TIMEOUT';
        return 'RUNTIME';
    }

    // 严重级别
    static getSeverity(error) {
        const criticalKeywords = ['critical', 'fatal', 'crash'];
        if (criticalKeywords.some(k => error.message?.toLowerCase().includes(k))) {
            return 'CRITICAL';
        }
        if (error.name === 'NetworkError') return 'MEDIUM';
        return 'LOW';
    }

    // 日志记录
    static log(errorInfo) {
        console.error(`[${errorInfo.type}] ${errorInfo.message}`, errorInfo);
        this.errorQueue.unshift(errorInfo);
        if (this.errorQueue.length > 50) {
            this.errorQueue = this.errorQueue.slice(0, 50);
        }
    }

    // 用户通知
    static notify(errorInfo) {
        if (errorInfo.severity === 'CRITICAL') {
            ElMessage.error({
                message: errorInfo.message,
                duration: 0,
                showClose: true,
            });
        } else if (errorInfo.severity === 'MEDIUM') {
            ElMessage.warning(errorInfo.message);
        }
    }

    // 事件发射（用于监听）
    static emit(errorInfo) {
        this.listeners.forEach(listener => {
            try {
                listener(errorInfo);
            } catch (e) {
                console.error('错误监听器失败:', e);
            }
        });
    }

    // 订阅错误事件
    static subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

// 安装全局错误处理
export function setupGlobalErrorHandler(app) {
    // Vue 错误
    app.config.errorHandler = (err, instance, info) => {
        ErrorHandler.handle(err, { type: 'VUE', component: instance?.$options?.name, info });
    };

    // 未捕获错误
    window.addEventListener('error', (event) => {
        ErrorHandler.handle(event.error, { type: 'WINDOW', filename: event.filename });
        event.preventDefault();
    });

    // Promise 拒绝
    window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
        ErrorHandler.handle(error, { type: 'PROMISE' });
        event.preventDefault();
    });
}
```

**预期收益**：
- 统一错误处理逻辑
- 更容易维护和扩展
- 减少代码重复

---

### 3. 拆分大型组件 ⭐⭐

**现状**：
- `Scene3D/index.js` 超过 1000 行
- `Control.vue` 超过 800 行
- 职责混杂，难以维护

**优化建议**：

#### 拆分 Scene3D
```
src/components/Scene3D/
├── index.js                 # 主入口（精简）
├── core/
│   ├── scene.js            # 场景初始化
│   ├── camera.js           # 相机控制
│   ├── renderer.js         # 渲染器
│   └── lights.js           # 灯光管理
├── models/
│   ├── loader.js           # 模型加载
│   ├── cache.js            # 模型缓存
│   └── manager.js          # 模型管理
├── controls/
│   ├── orbit.js            # 轨道控制
│   ├── pose-selection.js  # 位姿选择
│   └── markers.js          # 标记管理
└── utils/
    ├── performance.js      # 性能监控
    └── animation.js        # 动画循环
```

#### 拆分 Control.vue
```
src/views/Control/
├── index.vue               # 主组件
├── components/
│   ├── SandboxSettings.vue   # 沙盘设置
│   ├── VideoStream.vue       # 视频流
│   ├── TrafficLights.vue     # 红绿灯控制
│   └── DeviceControl.vue     # 设备控制
└── composables/
    ├── useSandboxSettings.js
    ├── useVideoStream.js
    └── useTrafficLights.js
```

**预期收益**：
- 更清晰的代码结构
- 更容易定位问题
- 更好的团队协作

---

## 三、数据管理优化

### 1. 车辆数据缓存策略 ⭐⭐

**现状**：
- 每次都更新整个车辆状态对象
- 没有部分更新机制

**优化建议**：
```javascript
// src/stores/car.js
updateVehicleState(vehicleId, partialState) {
    const vehicle = this.getOrCreateVehicleState(vehicleId);
    
    // ✅ 部分更新（只更新变化的字段）
    Object.assign(vehicle.state, partialState);
    
    // 标记更新时间
    vehicle.lastUpdate = Date.now();
}

// 添加数据过期检查
isStale(vehicleId, maxAge = 5000) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return true;
    return Date.now() - vehicle.lastUpdate > maxAge;
}
```

---

### 2. 事件总线优化 ⭐⭐

**现状**：
- `eventBus` 没有命名空间
- 事件监听器可能泄漏

**优化建议**：
```javascript
// src/utils/eventBus.js
class EventBus {
    constructor() {
        this.events = new Map();
        this.onceFunctions = new WeakMap();
    }

    on(event, handler, options = {}) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        
        const handlers = this.events.get(event);
        
        // 支持优先级
        if (options.priority) {
            handler._priority = options.priority;
        }
        
        handlers.add(handler);
        
        // 返回取消订阅函数
        return () => this.off(event, handler);
    }

    once(event, handler) {
        const wrapper = (...args) => {
            handler(...args);
            this.off(event, wrapper);
        };
        this.onceFunctions.set(wrapper, handler);
        this.on(event, wrapper);
    }

    emit(event, ...args) {
        const handlers = this.events.get(event);
        if (!handlers) return;

        // 按优先级排序
        const sorted = Array.from(handlers).sort((a, b) => 
            (b._priority || 0) - (a._priority || 0)
        );

        for (const handler of sorted) {
            try {
                handler(...args);
            } catch (error) {
                console.error(`事件处理器错误 [${event}]:`, error);
            }
        }
    }

    // 命名空间支持
    namespace(ns) {
        return {
            on: (event, handler, options) => this.on(`${ns}:${event}`, handler, options),
            emit: (event, ...args) => this.emit(`${ns}:${event}`, ...args),
            off: (event, handler) => this.off(`${ns}:${event}`, handler),
        };
    }

    // 清理特定命名空间
    clearNamespace(ns) {
        const prefix = `${ns}:`;
        for (const [event] of this.events) {
            if (event.startsWith(prefix)) {
                this.events.delete(event);
            }
        }
    }
}
```

**使用示例**：
```javascript
// 使用命名空间
const sceneEvents = eventBus.namespace('scene3d');
sceneEvents.on('loaded', handler);
sceneEvents.emit('loaded', data);

// 清理
onBeforeUnmount(() => {
    eventBus.clearNamespace('scene3d');
});
```

---

## 四、类型安全优化

### 1. 添加 JSDoc 类型注释 ⭐⭐

**现状**：
- 缺少类型注释
- IDE 智能提示不完整

**优化建议**：
```javascript
/**
 * 车辆状态信息
 * @typedef {Object} VehicleState
 * @property {number} vehicle_id - 车辆ID
 * @property {number} speed - 速度 (m/s)
 * @property {{x: number, y: number}} position - 位置坐标
 * @property {number} orientation - 朝向角度 (度)
 * @property {number} battery - 电池电量 (%)
 * @property {{value: number, label: string}} gear - 档位
 * @property {number} steeringAngle - 方向盘角度
 */

/**
 * 更新车辆状态
 * @param {number} vehicleId - 车辆ID
 * @param {VehicleState} state - 车辆状态
 * @returns {void}
 */
updateVehicleState(vehicleId, state) {
    // ...
}
```

---

## 五、性能监控优化

### 1. 添加性能指标收集 ⭐⭐

**优化建议**：
```javascript
// src/utils/performanceMonitor.js
class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.enabled = import.meta.env.DEV;
    }

    // 测量函数执行时间
    measure(name, fn) {
        if (!this.enabled) return fn();

        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;

        this.record(name, duration);

        if (duration > 16.67) { // 超过一帧时间
            console.warn(`⚠️ 性能警告: ${name} 耗时 ${duration.toFixed(2)}ms`);
        }

        return result;
    }

    // 测量异步函数
    async measureAsync(name, fn) {
        if (!this.enabled) return await fn();

        const start = performance.now();
        const result = await fn();
        const duration = performance.now() - start;

        this.record(name, duration);
        return result;
    }

    record(name, duration) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, {
                count: 0,
                total: 0,
                min: Infinity,
                max: -Infinity,
                avg: 0,
            });
        }

        const metric = this.metrics.get(name);
        metric.count++;
        metric.total += duration;
        metric.min = Math.min(metric.min, duration);
        metric.max = Math.max(metric.max, duration);
        metric.avg = metric.total / metric.count;
    }

    getReport() {
        const report = {};
        for (const [name, metric] of this.metrics) {
            report[name] = {
                calls: metric.count,
                avgMs: metric.avg.toFixed(2),
                minMs: metric.min.toFixed(2),
                maxMs: metric.max.toFixed(2),
                totalMs: metric.total.toFixed(2),
            };
        }
        return report;
    }

    printReport() {
        console.table(this.getReport());
    }
}

export const perfMonitor = new PerformanceMonitor();

// 使用
import { perfMonitor } from '@/utils/performanceMonitor';

// 同步函数
const result = perfMonitor.measure('updateVehicleState', () => {
    // 执行逻辑
});

// 异步函数
const data = await perfMonitor.measureAsync('loadVehicleData', async () => {
    return await invoke('get_vehicle_data');
});

// 查看报告
perfMonitor.printReport();
```

---

## 六、优先级总结

### 立即实施（⭐⭐⭐高优先级）
1. Scene3D 渲染优化 - **显著性能提升**
2. 提取组合式函数 - **代码质量提升**
3. 车辆状态更新优化 - **CPU占用降低**

### 近期实施（⭐⭐中优先级）
4. 视频帧处理优化
5. 统一错误处理
6. 拆分大型组件
7. 车辆数据缓存策略
8. 事件总线优化
9. 性能监控

### 长期优化（⭐低优先级）
10. JSDoc 类型注释

---

## 实施计划

### 第一周
- [ ] Scene3D 渲染优化
- [ ] 提取 3 个核心组合式函数（时间、FPS、网络状态）

### 第二周
- [ ] 车辆状态更新优化
- [ ] 统一错误处理系统

### 第三周
- [ ] 视频帧处理优化
- [ ] 拆分 Scene3D 模块

### 第四周
- [ ] 拆分 Control组件
- [ ] 添加性能监控

---

## 预期总体收益

- **性能提升**：30-50% CPU占用降低，60FPS稳定性提升
- **代码质量**：减少 500+ 行重复代码，提高可维护性
- **开发效率**：更清晰的代码结构，更容易定位问题
- **用户体验**：更流畅的界面，更快的响应速度

