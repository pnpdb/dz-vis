# 🚕 出租车打车状态跟踪系统

## 📋 功能概述

实现了完整的自动驾驶出租车打车状态跟踪系统，包括：
- ✅ 点击打车按钮后立即清除UI上的起点终点
- ✅ 跟踪正在执行打车任务的车辆
- ✅ 自动检测车辆到达终点并清理状态

---

## 🔄 完整流程

### **1. 用户打车流程**

```
用户操作：选择起点 → 选择终点 → 点击"呼叫出租车"
         ↓
系统处理：
  1. 检查在线车辆
  2. 查找最近的空闲车辆
  3. 发送0x1003协议给车辆
  4. 立即清除UI上的起点终点（不论成功与否）
  5. 将车辆ID保存到打车状态Map
  6. 显示Toast提示
```

### **2. 车辆导航状态变化**

车辆收到打车订单后，导航状态会依次经历：

| 导航状态 | 含义 | 系统操作 |
|---------|------|---------|
| **3** | 接客模式，去起点接客 | 路径清理 |
| **9** | 到达接客起点 | - |
| **4** | 接客模式，去终点送客 | 路径清理 |
| **10** | 到达接客终点 | ✅ **从打车状态Map中删除该车辆** |

### **3. 自动状态清理**

```javascript
// 实时监听车辆信息协议
socketManager.updateVehicleInfoFromParsed()
    ↓
// 检查导航状态
if (navigation.code === 10 && store.isVehicleInTaxiMode(vehicleId))
    ↓
// 清理打车订单
store.removeActiveTaxiRide(vehicleId)
    ↓
console.log(`🎉 车辆 ${vehicleId} 已到达接客终点，打车任务完成`)
```

---

## 📂 代码实现

### **1. carStore 打车状态管理**

**位置**: `src/stores/car.js`

#### **数据结构**

```javascript
// 打车状态管理：存储正在打车的车辆信息
// Map<vehicleId, { startCoords: {x, z}, endCoords: {x, z}, orderId: string }>
activeTaxiRides: new Map()
```

#### **核心API**

```javascript
// 添加活跃的打车订单
addActiveTaxiRide(vehicleId, startCoords, endCoords, orderId)

// 移除活跃的打车订单
removeActiveTaxiRide(vehicleId)

// 检查车辆是否在打车状态
isVehicleInTaxiMode(vehicleId)

// 获取车辆的打车订单信息
getActiveTaxiRide(vehicleId)

// 清除所有打车订单
clearAllTaxiRides()
```

---

### **2. AutoDrive.vue 打车按钮逻辑**

**位置**: `src/views/AutoDrive.vue`

#### **关键修改**

```javascript
const callTaxi = async () => {
    // 保存起点终点坐标（用于添加到activeTaxiRides）
    const startCoords = carStore.taxi.startCoords;
    const endCoords = carStore.taxi.endCoords;
    
    try {
        // 1-7. 检查、查找、发送订单...
        
        // 8. 打车成功后立即清除UI上的起点终点
        clearTaxiSelection(); // ✅ 清除UI
        
        // 9. 将车辆添加到打车状态列表
        carStore.addActiveTaxiRide(assignedVehicleId, startCoords, endCoords, orderId);
        
        // 10. 显示成功Toast
        Toast.success(`出租车订单已发送给${assignedVehicleId}号车，请等待车辆响应`);
        
    } catch (error) {
        // 11. 发送失败也清除起点终点
        clearTaxiSelection(); // ✅ 清除UI
        
        // 12. 显示失败Toast
        Toast.error(`呼叫出租车失败: ${error.message || error}`);
    }
};
```

**效果**：
- ✅ 不论成功与否，点击按钮后立即清除UI上的起点终点坐标和沙盘图标
- ✅ 打车成功后，保存车辆ID到Map，用于后续状态跟踪
- ✅ Toast提示保留

---

### **3. socketManager.js 导航状态监听**

**位置**: `src/utils/socketManager.js`

#### **关键逻辑**

```javascript
async updateVehicleInfoFromParsed(carId, parsed, timestamp) {
    // ...解析车辆数据...
    
    const navigation = {
        code: parsed.navigation.code,  // 导航状态
        text: parsed.navigation.text
    };
    
    // 🚕 检查打车订单状态：导航状态为10时完成打车任务
    if (navigation.code === 10 && store.isVehicleInTaxiMode(vehicleId)) {
        // 车辆到达接客终点，清理打车订单
        store.removeActiveTaxiRide(vehicleId);
        console.log(`🎉 车辆 ${vehicleId} 已到达接客终点，打车任务完成`);
    }
    
    // 更新状态到store
    store.updateVehicleState(vehicleId, vehicleInfo);
}
```

**监听频率**：
- 车端发送频率：50 Hz
- 前端接收频率：实时处理
- 导航状态检测：每次车辆信息更新时检查

---

## 🧪 测试流程

### **测试场景1：打车成功流程**

1. **打开自动驾驶菜单**
2. **选择起点**（地图上点击）
3. **选择终点**（地图上点击）
4. **点击"呼叫出租车"**
   - ✅ 验证：UI上起点终点立即清除
   - ✅ 验证：沙盘上起点终点图标立即消失
   - ✅ 验证：显示成功Toast
5. **观察车辆导航状态变化**
   - 导航状态变为 3（去起点接客）
   - 导航状态变为 9（到达接客起点）
   - 导航状态变为 4（去终点送客）
   - 导航状态变为 10（到达接客终点）
6. **验证状态10时的清理**
   - ✅ 验证：控制台输出 `🎉 车辆 X 已到达接客终点，打车任务完成`
   - ✅ 验证：该车辆从 `activeTaxiRides` Map 中删除

### **测试场景2：打车失败流程**

1. **打开自动驾驶菜单**
2. **选择起点和终点**
3. **断开所有车辆连接**
4. **点击"呼叫出租车"**
   - ✅ 验证：显示"当前没有可用车辆"
   - ✅ 验证：UI上起点终点立即清除
   - ✅ 验证：沙盘上起点终点图标立即消失

### **测试场景3：多车辆同时打车**

1. **车辆A和车辆B都在线**
2. **为车辆A打车** → 成功
3. **立即为车辆B打车** → 成功
4. **验证**：
   - ✅ `activeTaxiRides` Map 中有两个车辆ID
   - ✅ 车辆A导航状态变为10时，只删除车辆A
   - ✅ 车辆B导航状态变为10时，只删除车辆B

---

## 📊 数据流图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户操作                                  │
│  选择起点 → 选择终点 → 点击"呼叫出租车"                          │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                   AutoDrive.vue: callTaxi()                     │
│  1. 查找最近空闲车辆                                             │
│  2. 发送0x1003协议                                               │
│  3. clearTaxiSelection() // 清除UI起点终点                       │
│  4. carStore.addActiveTaxiRide() // 保存到Map                   │
│  5. Toast提示                                                   │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    车辆执行打车任务                               │
│  导航状态: 3 → 9 → 4 → 10                                        │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│           socketManager.js: updateVehicleInfoFromParsed()       │
│  实时监听车辆信息协议（50 Hz）                                    │
│  ↓                                                              │
│  if (navigation.code === 10 && isVehicleInTaxiMode(vehicleId)) │
│      ↓                                                          │
│  carStore.removeActiveTaxiRide(vehicleId) // 从Map删除          │
│  console.log("🎉 打车任务完成")                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 调试工具

### **1. 查看当前打车状态**

在浏览器控制台执行：

```javascript
// 获取carStore
const carStore = window.__vue_app__?.config?.globalProperties?.$pinia?.state?.value?.car;

// 查看所有活跃的打车订单
console.log('活跃打车订单:', carStore?.activeTaxiRides);

// 检查特定车辆是否在打车状态
carStore?.isVehicleInTaxiMode(1); // 检查车辆1

// 获取特定车辆的打车订单信息
carStore?.getActiveTaxiRide(1); // 获取车辆1的订单
```

### **2. 监听导航状态变化**

在 `socketManager.js` 中添加临时日志：

```javascript
if (import.meta.env.DEV) {
    console.log(`车辆 ${vehicleId} 导航状态: ${navigation.code} (${navigation.text})`);
}
```

---

## ⚠️ 注意事项

### **1. 起点终点图标管理**

- ✅ 当前实现：点击打车按钮后立即清除全局的起点终点图标
- ⚠️ 如需为每个车辆单独显示起点终点图标，需要扩展 `Scene3D/index.js`，创建按车辆分组的图标Map

### **2. 内存管理**

- ✅ 导航状态10时自动清理Map
- ✅ 提供 `clearAllTaxiRides()` 用于手动清理
- ⚠️ 如果车辆异常掉线，订单可能残留在Map中（可添加超时清理机制）

### **3. 并发打车**

- ✅ 支持多个车辆同时执行打车任务
- ✅ 每个车辆的订单独立跟踪
- ⚠️ 同一车辆不支持多个打车订单（后续订单会覆盖前一个）

---

## 🚀 后续优化建议

### **1. 打车订单超时机制**

```javascript
// 在carStore中添加
addActiveTaxiRide(vehicleId, startCoords, endCoords, orderId) {
    this.activeTaxiRides.set(vehicleId, {
        startCoords,
        endCoords,
        orderId,
        timestamp: Date.now(),
        timeout: 10 * 60 * 1000 // 10分钟超时
    });
    
    // 设置超时清理
    setTimeout(() => {
        if (this.isVehicleInTaxiMode(vehicleId)) {
            console.warn(`⚠️ 车辆 ${vehicleId} 打车订单超时，自动清理`);
            this.removeActiveTaxiRide(vehicleId);
        }
    }, 10 * 60 * 1000);
}
```

### **2. 打车进度显示**

在UI上显示当前打车车辆的导航状态：

```javascript
// 在AutoDrive.vue中添加
const activeTaxiRides = computed(() => {
    return Array.from(carStore.activeTaxiRides.entries()).map(([vehicleId, ride]) => {
        const vehicle = carStore.vehicles.get(vehicleId);
        return {
            vehicleId,
            orderId: ride.orderId,
            navStatus: vehicle?.state?.navigation?.text || '未知'
        };
    });
});
```

### **3. 历史订单记录**

```javascript
// 在carStore中添加
completedTaxiRides: [] // 存储已完成的订单历史
```

---

## 📝 版本历史

### **v1.0 (2025-10-31)**
- ✅ 实现打车状态跟踪系统
- ✅ 支持导航状态10自动清理
- ✅ 点击打车按钮立即清除UI起点终点

---

## 🤝 相关文件

| 文件 | 说明 |
|------|------|
| `src/stores/car.js` | 打车状态管理Map和API |
| `src/views/AutoDrive.vue` | 打车按钮逻辑和UI清理 |
| `src/utils/socketManager.js` | 车辆信息协议监听和导航状态检测 |
| `src/components/Scene3D/index.js` | 起点终点图标管理 |
| `src/constants/messageTypes.js` | 导航状态定义 |

---

## 📞 联系方式

如有问题或建议，请查看：
- **项目指南**: `PROJECT_GUIDE.md`
- **性能优化**: `PERFORMANCE_OPTIMIZATION_SUMMARY.md`

