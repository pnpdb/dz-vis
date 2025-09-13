# 车辆选择功能更新说明

## 📋 更新内容

已成功更新主界面的车辆选择功能，现在从SQLite数据库中读取真实的车辆信息。

## 🚀 主要改动

### 1. **CarList.vue 组件更新**
- 从硬编码的车辆列表改为从数据库动态加载
- 添加了 `VehicleConnectionAPI` 集成
- 实现了数据格式转换和错误处理
- 添加了友好的时间显示格式

### 2. **CarSettings.vue 组件更新**
- 车辆设置页面的下拉框现在使用数据库数据
- 显示车辆名称和连接信息 (IP:端口)
- 保持与原有功能的兼容性

### 3. **Car Store 重构**
- 添加了 `loadVehicleConnections()` 方法
- 支持从数据库加载车辆列表
- 添加了 `availableCarList` getter 作为备用方案
- 保持向后兼容性

### 4. **应用初始化**
- 在 `main.js` 中添加了车辆数据的初始化加载
- 确保应用启动时自动加载数据库中的车辆信息

### 5. **车辆匹配逻辑优化**
- 更新了 `CarInfo.vue` 和 `Sensor.vue` 中的车辆匹配逻辑
- 支持数据库中的 `vehicle_id` 匹配
- 保持对原有字母ID (A, B, C) 的向后兼容

## 🎯 功能特性

### ✅ 动态车辆列表
- 主界面左上角的车辆选择下拉框现在显示数据库中的真实车辆
- 格式：`{车辆名称} - {描述/车辆ID}`
- 自动显示连接状态和更新时间

### ✅ 车辆设置集成
- 功能设置区域的车辆选择也使用数据库数据
- 显示格式：`{车辆名称} ({IP地址}:{端口})`
- 支持活跃/非活跃状态显示

### ✅ 智能匹配
- 车辆信息协议数据会根据选中的车辆ID正确匹配
- 支持数据库 `vehicle_id` 和传统字母ID的混合使用
- 自动处理数据类型转换

### ✅ 错误处理
- 如果数据库连接失败，自动使用默认车辆列表
- 友好的错误提示和日志记录
- 保证应用正常运行

## 📊 数据流程

```
SQLite数据库 (vehicle_connections表)
    ↓ (VehicleConnectionAPI.getAllConnections)
Car Store (loadVehicleConnections)
    ↓ (数据格式转换)
UI组件 (CarList, CarSettings)
    ↓ (车辆选择事件)
车辆信息显示 (CarInfo, Sensor)
```

## 🧪 测试步骤

1. **启动应用**
   ```bash
   npm run tauri:dev
   ```

2. **检查车辆列表**
   - 查看主界面左上角的"当前车辆"下拉框
   - 应该显示数据库中的车辆信息
   - 选择不同车辆，观察UI是否响应

3. **检查车辆设置**
   - 点击右上角设置按钮
   - 进入设置对话框
   - 查看"车辆设置"标签页的下拉框
   - 应该显示相同的车辆列表

4. **测试车辆信息协议**
   ```bash
   # 使用数据库中的车辆ID测试
   python test_client.py 1  # 车辆ID=1
   ```
   - 选择对应的车辆，查看车辆信息是否正确更新

## 🔧 数据库要求

确保SQLite数据库中有以下结构的数据：

```sql
-- vehicle_connections 表
CREATE TABLE vehicle_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id TEXT NOT NULL UNIQUE,
    ip_address TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 8888,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 示例数据
INSERT INTO vehicle_connections (vehicle_id, name, ip_address, port, description, is_active, created_at, updated_at)
VALUES ('car_001', '车辆A', '192.168.1.101', 8888, '自动驾驶测试车', true, datetime('now'), datetime('now'));
```

## 🐛 故障排除

### 问题：下拉框显示空白或默认数据
**解决方案：**
1. 检查数据库连接是否正常
2. 确认 `vehicle_connections` 表中有数据
3. 查看浏览器控制台的错误信息

### 问题：车辆信息协议数据不匹配
**解决方案：**
1. 确保测试客户端发送的 `vehicle_id` 与数据库中的一致
2. 检查车辆选择是否正确
3. 查看控制台日志确认数据接收情况

### 问题：应用启动时车辆列表为空
**解决方案：**
1. 等待数据加载完成（约1-2秒）
2. 检查网络连接和数据库状态
3. 查看应用初始化日志

## 📝 注意事项

1. **向后兼容**：保持对原有字母ID (A, B, C) 的支持
2. **性能优化**：车辆列表在应用启动时加载一次
3. **错误恢复**：数据库连接失败时使用默认列表
4. **用户体验**：提供loading状态和友好的错误提示

---

更新完成！✨ 现在您的车辆选择功能已经与SQLite数据库完全集成。
