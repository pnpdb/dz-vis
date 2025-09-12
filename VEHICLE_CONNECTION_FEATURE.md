# 车辆连接管理功能

## 📋 功能概述

新增的车辆连接管理功能允许用户通过图形界面管理多个车辆的网络连接配置，支持添加、编辑、删除和启用/禁用车辆连接。

## 🚀 功能特性

### ✅ 已实现功能

1. **SQLite数据库支持**
   - 使用Rust的SQLx库提供高性能数据存储
   - 自动创建数据库表结构
   - 支持数据完整性约束和索引优化

2. **车辆连接CRUD操作**
   - ✅ 创建车辆连接配置
   - ✅ 查看所有车辆连接列表
   - ✅ 编辑车辆连接信息
   - ✅ 删除车辆连接配置
   - ✅ 启用/禁用车辆连接状态

3. **数据验证和错误处理**
   - IP地址格式验证
   - 端口号范围检查
   - 车辆ID唯一性约束
   - 友好的错误提示

4. **现代化UI界面**
   - 科技感的深色主题
   - 响应式布局设计
   - 实时状态指示器
   - 流畅的动画效果

## 📱 使用方法

### 1. 访问连接设置

1. 启动DZ Car Manager应用
2. 点击右上角的**设置按钮**（⚙️图标）
3. 使用账号密码登录：
   - 账号：`admin`
   - 密码：`123456`
4. 在设置对话框中选择**"连接设置"**标签

### 2. 添加车辆连接

1. 点击**"新增车辆"**按钮
2. 填写车辆信息：
   - **车辆ID**：唯一标识符（如：car_001）
   - **车辆名称**：显示名称（如：车辆A）
   - **IP地址**：车辆的网络地址（如：192.168.1.100）
   - **端口**：通信端口（默认：8888）
   - **描述**：可选的描述信息
3. 点击**"添加"**按钮保存

### 3. 编辑车辆连接

1. 在车辆连接列表中找到要编辑的车辆
2. 点击**"编辑"**按钮
3. 修改需要更新的信息
4. 点击**"保存"**按钮确认更改

### 4. 管理车辆状态

- **启用/禁用**：使用每个车辆右侧的开关切换状态
- **删除连接**：点击**"删除"**按钮并确认操作

## 🏗️ 技术架构

### 后端 (Rust + Tauri)

```
src-tauri/src/
├── database/
│   ├── mod.rs              # 模块导出
│   ├── models.rs           # 数据模型定义
│   └── vehicle_db.rs       # 数据库操作逻辑
└── lib.rs                  # Tauri命令注册
```

**核心Tauri命令：**
- `get_vehicle_connections` - 获取所有车辆连接
- `create_vehicle_connection` - 创建新的车辆连接
- `update_vehicle_connection` - 更新车辆连接信息
- `delete_vehicle_connection` - 删除车辆连接
- `get_active_vehicle_connections` - 获取活跃的车辆连接

### 前端 (Vue 3 + Element Plus)

```
src/
├── components/
│   ├── Header.vue                    # 设置对话框（添加连接设置Tab）
│   └── VehicleConnectionManager.vue  # 车辆连接管理组件
└── utils/
    └── vehicleAPI.js                 # 前端API工具类
```

### 数据库结构

```sql
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
```

## 📊 默认数据

系统初始化时会自动创建3个示例车辆连接：

| 车辆ID | 名称 | IP地址 | 端口 | 描述 |
|--------|------|--------|------|------|
| car_001 | 车辆A | 192.168.1.101 | 8888 | 自动驾驶测试车 |
| car_002 | 车辆B | 192.168.1.102 | 8888 | AVP测试车 |
| car_003 | 车辆C | 192.168.1.103 | 8888 | 物流配送车 |

## 🗃️ 数据存储位置

数据库文件存储在系统应用数据目录：

- **macOS**: `~/Library/Application Support/dz-car-manager/vehicles.db`
- **Windows**: `%APPDATA%/dz-car-manager/vehicles.db`
- **Linux**: `~/.local/share/dz-car-manager/vehicles.db`

## 🔧 开发说明

### 依赖包

**Rust依赖：**
```toml
sqlx = { version = "0.6", features = ["runtime-tokio-rustls", "sqlite", "macros", "chrono", "uuid"] }
chrono = { version = "0.4", features = ["serde"] }
dirs = "5.0"
```

**前端依赖：**
- Vue 3 Composition API
- Element Plus UI组件库
- Tauri API (@tauri-apps/api)

### API示例

```javascript
import VehicleConnectionAPI from '@/utils/vehicleAPI.js';

// 获取所有车辆连接
const result = await VehicleConnectionAPI.getAllConnections();
if (result.success) {
    console.log('车辆列表:', result.data);
}

// 创建新车辆连接
const newVehicle = await VehicleConnectionAPI.createConnection({
    vehicle_id: 'car_004',
    name: '车辆D',
    ip_address: '192.168.1.104',
    port: 8888,
    description: '新增测试车辆'
});
```

## 🎯 未来扩展

可以考虑的功能扩展：

1. **批量导入/导出**：支持CSV/JSON格式的批量车辆配置
2. **连接测试**：实时检测车辆网络连接状态
3. **历史记录**：记录车辆连接的修改历史
4. **分组管理**：按用途或区域对车辆进行分组
5. **权限控制**：不同用户角色的操作权限管理

## 🐛 故障排除

### 常见问题

1. **数据库初始化失败**
   - 检查应用数据目录的写入权限
   - 确保系统磁盘空间充足

2. **车辆连接添加失败**
   - 验证IP地址格式是否正确
   - 检查车辆ID是否已存在

3. **设置对话框无法打开**
   - 确保已正确登录（admin/123456）
   - 检查浏览器控制台是否有JavaScript错误

### 调试信息

应用启动时会在控制台输出以下信息：
```
✅ 车辆数据库初始化成功
📁 数据库路径: sqlite:/path/to/vehicles.db
✅ 插入默认车辆连接数据完成
```

## 📞 技术支持

如果遇到问题，请检查：
1. Tauri应用是否正常启动
2. 数据库文件是否正确创建
3. 前端控制台是否有错误信息
4. Rust后端日志输出

---

**DZ Car Manager v0.1.0** - 智能车辆管理系统
