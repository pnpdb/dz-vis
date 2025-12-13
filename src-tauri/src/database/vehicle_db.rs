use sqlx::{Pool, Sqlite, SqlitePool, Row};
use chrono::Utc;
use crate::database::models::*;

/// 车辆连接数据库管理器
#[derive(Clone)]
pub struct VehicleDatabase {
    pool: Pool<Sqlite>,
}

impl VehicleDatabase {
    /// 初始化数据库连接
    pub async fn new() -> Result<Self, sqlx::Error> {
        // 使用更安全的数据目录路径
        let data_dir = if let Some(app_data) = dirs::data_dir() {
            app_data.join("dz-car-manager")
        } else {
            // 回退到用户主目录
            dirs::home_dir()
                .unwrap_or_else(|| std::env::current_dir().unwrap())
                .join(".dz-car-manager")
        };
        
        // 确保目录存在且有正确权限
        if !data_dir.exists() {
            std::fs::create_dir_all(&data_dir).map_err(|e| {
                sqlx::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    format!("创建数据目录失败: {}. 目录: {}", e, data_dir.display())
                ))
            })?;
        }
        
        let db_path = data_dir.join("vehicles.db");
        let database_url = format!("sqlite:{}?mode=rwc", db_path.display());
        
        log::debug!("📁 数据库路径: {}", database_url);
        
        // 创建连接池，优化配置以提升性能和稳定性
        let options = sqlx::sqlite::SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
            .busy_timeout(std::time::Duration::from_secs(30))
            .pragma("cache_size", "10000")  // 10MB缓存
            .pragma("temp_store", "memory"); // 临时表存储在内存中
        
        let pool = SqlitePool::connect_with(options).await?;
        
        let db = Self { pool };
        
        // 初始化表结构
        db.init_tables().await?;
        
        Ok(db)
    }
    
    /// 初始化数据库表结构
    async fn init_tables(&self) -> Result<(), sqlx::Error> {
        // 只有在表不存在时才创建，保留现有数据
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS vehicle_connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id INTEGER NOT NULL UNIQUE,
                ip_address TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                color TEXT,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            "#
        ).execute(&self.pool).await?;
        
        // 创建索引（如果不存在）
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_vehicle_id ON vehicle_connections(vehicle_id)")
            .execute(&self.pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_is_active ON vehicle_connections(is_active)")
            .execute(&self.pool).await?;
        
        // 迁移：添加 color 列（如果不存在）
        // 使用简单的方式：尝试添加列，如果失败则忽略（说明列已存在）
        let _ = sqlx::query("ALTER TABLE vehicle_connections ADD COLUMN color TEXT")
            .execute(&self.pool)
            .await;
        // 忽略错误，因为如果列已存在会报错，但这是正常的

        // 创建交通灯设置表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS traffic_light_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                red_light_duration INTEGER NOT NULL DEFAULT 45,
                green_light_duration INTEGER NOT NULL DEFAULT 60,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            "#
        ).execute(&self.pool).await?;

        // 初始化默认交通灯设置
        self.init_default_traffic_light_settings().await?;

        // 创建单个红绿灯时长表（按编号独立保存）
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS traffic_light_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                light_id INTEGER NOT NULL UNIQUE,
                red_light_duration INTEGER NOT NULL DEFAULT 30,
                green_light_duration INTEGER NOT NULL DEFAULT 30,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            "#
        ).execute(&self.pool).await?;

        // 创建出租车订单表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS taxi_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL UNIQUE,
                start_x REAL NOT NULL,
                start_y REAL NOT NULL,
                end_x REAL NOT NULL,
                end_y REAL NOT NULL,
                assigned_vehicle_id INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            "#
        ).execute(&self.pool).await?;

        // 创建索引（如果不存在）
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_order_id ON taxi_orders(order_id)")
            .execute(&self.pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_assigned_vehicle ON taxi_orders(assigned_vehicle_id)")
            .execute(&self.pool).await?;

        // 创建AVP泊车表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS avp_parking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id INTEGER NOT NULL,
                parking_spot INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            "#
        ).execute(&self.pool).await?;

        // 创建索引（如果不存在）
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_avp_vehicle_id ON avp_parking(vehicle_id)")
            .execute(&self.pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_avp_parking_spot ON avp_parking(parking_spot)")
            .execute(&self.pool).await?;

        // 创建AVP取车表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS avp_pickup (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            "#
        ).execute(&self.pool).await?;

        // 创建索引（如果不存在）
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_avp_pickup_vehicle_id ON avp_pickup(vehicle_id)")
            .execute(&self.pool).await?;

        // 创建车辆在线时长统计表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS vehicle_online_time (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                online_minutes INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                UNIQUE(vehicle_id, date)
            )
            "#
        ).execute(&self.pool).await?;

        // 创建索引（如果不存在）
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_vehicle_online_time_date ON vehicle_online_time(date)")
            .execute(&self.pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_vehicle_online_time_vehicle_id ON vehicle_online_time(vehicle_id)")
            .execute(&self.pool).await?;
        // 添加复合索引以优化按车辆和日期查询的性能
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_vehicle_online_time_composite ON vehicle_online_time(vehicle_id, date)")
            .execute(&self.pool).await?;

        // 创建沙盘服务设置表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS sandbox_service_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_address TEXT NOT NULL,
                traffic_light_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            "#
        ).execute(&self.pool).await?;

        // 迁移：如果存在port列，则删除它
        let cols = sqlx::query("PRAGMA table_info(sandbox_service_settings)")
            .fetch_all(&self.pool)
            .await?
            .iter()
            .map(|row| row.get::<String, _>("name"))
            .collect::<Vec<_>>();

        if cols.iter().any(|n| n == "port") {
            // SQLite不支持直接删除列，需要重建表
            sqlx::query(
                r#"
                CREATE TABLE sandbox_service_settings_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ip_address TEXT NOT NULL,
                    traffic_light_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                "#
            ).execute(&self.pool).await?;

            // 复制数据（不包括port列）
            sqlx::query(
                r#"
                INSERT INTO sandbox_service_settings_new (id, ip_address, traffic_light_count, created_at, updated_at)
                SELECT id, ip_address, 0 as traffic_light_count, created_at, updated_at FROM sandbox_service_settings
                "#
            ).execute(&self.pool).await?;

            // 删除旧表
            sqlx::query("DROP TABLE sandbox_service_settings").execute(&self.pool).await?;

            // 重命名新表
            sqlx::query("ALTER TABLE sandbox_service_settings_new RENAME TO sandbox_service_settings")
                .execute(&self.pool).await?;
        }

        // 如果缺少 traffic_light_count 列则添加
        if !cols.iter().any(|n| n == "traffic_light_count") {
            sqlx::query("ALTER TABLE sandbox_service_settings ADD COLUMN traffic_light_count INTEGER NOT NULL DEFAULT 0")
                .execute(&self.pool)
                .await?;
        }

        // 创建沙盘摄像头设置表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS sandbox_cameras (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                camera_type TEXT NOT NULL CHECK (camera_type IN ('RJ45', 'USB')),
                rtsp_url TEXT,
                device_index INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            "#
        ).execute(&self.pool).await?;

        // 创建索引（如果不存在）
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_sandbox_camera_type ON sandbox_cameras(camera_type)")
            .execute(&self.pool).await?;

        // （已移除应用主题设置表）
        
        // 创建应用基本设置表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                log_level TEXT NOT NULL DEFAULT 'INFO',
                cache_size INTEGER NOT NULL DEFAULT 512,
                auto_start BOOLEAN NOT NULL DEFAULT 0,
                app_title TEXT NOT NULL DEFAULT '渡众智能沙盘云控平台',
                coordinate_offset_x REAL NOT NULL DEFAULT 0.0,
                coordinate_offset_y REAL NOT NULL DEFAULT 0.0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            "#
        ).execute(&self.pool).await?;
        
        // 为现有表添加auto_start字段（如果不存在）
        let _ = sqlx::query("ALTER TABLE app_settings ADD COLUMN auto_start BOOLEAN NOT NULL DEFAULT 0")
            .execute(&self.pool).await; // 忽略错误，字段可能已存在
        
        // 为现有表添加coordinate_offset_x字段（如果不存在）
        let _ = sqlx::query("ALTER TABLE app_settings ADD COLUMN coordinate_offset_x REAL NOT NULL DEFAULT 0.0")
            .execute(&self.pool).await; // 忽略错误，字段可能已存在
        
        // 为现有表添加coordinate_offset_y字段（如果不存在）
        let _ = sqlx::query("ALTER TABLE app_settings ADD COLUMN coordinate_offset_y REAL NOT NULL DEFAULT 0.0")
            .execute(&self.pool).await; // 忽略错误，字段可能已存在
        
        // 为现有表添加app_title字段（如果不存在）
        let _ = sqlx::query("ALTER TABLE app_settings ADD COLUMN app_title TEXT NOT NULL DEFAULT '渡众智能沙盘云控平台'")
            .execute(&self.pool).await; // 忽略错误，字段可能已存在
        
        // 初始化默认应用设置
        let cnt: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM app_settings").fetch_one(&self.pool).await?;
        if cnt == 0 {
            let now = Utc::now().to_rfc3339();
            sqlx::query(
                r#"INSERT INTO app_settings (log_level, cache_size, auto_start, app_title, coordinate_offset_x, coordinate_offset_y, created_at, updated_at) VALUES ('INFO', 512, 0, '渡众智能沙盘云控平台', 0.0, 0.0, ?, ?)"#
            ).bind(&now).bind(&now).execute(&self.pool).await?;
        }

        // 创建菜单可见性设置表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS menu_visibility_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                show_vehicle_info BOOLEAN NOT NULL DEFAULT 1,
                show_auto_drive BOOLEAN NOT NULL DEFAULT 1,
                show_sandbox_control BOOLEAN NOT NULL DEFAULT 1,
                show_settings BOOLEAN NOT NULL DEFAULT 1,
                show_parallel_driving BOOLEAN NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            "#
        ).execute(&self.pool).await?;
        
        // 为现有表添加 show_parallel_driving 列（兼容旧数据库）
        let _ = sqlx::query(
            "ALTER TABLE menu_visibility_settings ADD COLUMN show_parallel_driving BOOLEAN NOT NULL DEFAULT 1"
        ).execute(&self.pool).await;

        // 为现有表添加 show_vehicle_camera 列（兼容旧数据库）
        let _ = sqlx::query(
            "ALTER TABLE menu_visibility_settings ADD COLUMN show_vehicle_camera BOOLEAN NOT NULL DEFAULT 1"
        ).execute(&self.pool).await;

        // 初始化默认菜单可见性设置
        self.init_default_menu_visibility_settings().await?;
        
        log::info!("数据库表结构检查完成");
        Ok(())
    }
    
    
    /// 创建车辆连接
    pub async fn create_vehicle_connection(
        &self, 
        request: CreateVehicleConnectionRequest
    ) -> Result<VehicleConnection, sqlx::Error> {
        let now = Utc::now();
        
        sqlx::query(
            r#"
            INSERT INTO vehicle_connections 
            (vehicle_id, ip_address, name, description, color, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, true, ?, ?)
            "#
        )
        .bind(request.vehicle_id)
        .bind(&request.ip_address)
        .bind(&request.name)
        .bind(&request.description)
        .bind(&request.color)
        .bind(now.to_rfc3339())
        .bind(now.to_rfc3339())
        .execute(&self.pool)
        .await?;

        // 获取插入的记录
        let row = sqlx::query("SELECT * FROM vehicle_connections WHERE vehicle_id = ? ORDER BY id DESC LIMIT 1")
            .bind(request.vehicle_id)
            .fetch_one(&self.pool)
            .await?;
        
        Ok(VehicleConnection {
            id: row.get("id"),
            vehicle_id: row.get("vehicle_id"),
            ip_address: row.get("ip_address"),
            name: row.get("name"),
            description: row.get("description"),
            color: row.get("color"),
            is_active: row.get("is_active"),
            created_at: row.get::<String, _>("created_at").parse().unwrap(),
            updated_at: row.get::<String, _>("updated_at").parse().unwrap(),
        })
    }

    // ============ 应用基本设置 ==========
    pub async fn get_app_settings(&self) -> Result<AppSettings, sqlx::Error> {
        let row = sqlx::query("SELECT * FROM app_settings ORDER BY id DESC LIMIT 1")
            .fetch_one(&self.pool)
            .await?;
        Ok(AppSettings {
            id: row.get("id"),
            log_level: row.get("log_level"),
            cache_size: row.get("cache_size"),
            auto_start: row.get::<Option<i64>, _>("auto_start").unwrap_or(0) != 0,
            app_title: row.get::<Option<String>, _>("app_title").unwrap_or("渡众智能沙盘云控平台".to_string()),
            coordinate_offset_x: row.get::<Option<f64>, _>("coordinate_offset_x").unwrap_or(0.0),
            coordinate_offset_y: row.get::<Option<f64>, _>("coordinate_offset_y").unwrap_or(0.0),
            created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at")).unwrap_or_default().with_timezone(&chrono::Utc),
            updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at")).unwrap_or_default().with_timezone(&chrono::Utc),
        })
    }

    pub async fn update_app_settings(&self, req: UpdateAppSettingsRequest) -> Result<AppSettings, sqlx::Error> {
        // 读取当前设置并合并
        let current = self.get_app_settings().await?;
        let log_level = req
            .log_level
            .unwrap_or(current.log_level)
            .to_uppercase();
        let cache_size = req.cache_size.unwrap_or(current.cache_size);
        let auto_start = req.auto_start.unwrap_or(current.auto_start);
        let app_title = req.app_title.unwrap_or(current.app_title);
        let coordinate_offset_x = req.coordinate_offset_x.unwrap_or(current.coordinate_offset_x);
        let coordinate_offset_y = req.coordinate_offset_y.unwrap_or(current.coordinate_offset_y);
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            UPDATE app_settings 
            SET log_level = ?, cache_size = ?, auto_start = ?, app_title = ?, coordinate_offset_x = ?, coordinate_offset_y = ?, updated_at = ?
            WHERE id = (SELECT id FROM app_settings ORDER BY id DESC LIMIT 1)
            "#
        )
        .bind(&log_level)
        .bind(cache_size)
        .bind(if auto_start { 1 } else { 0 })
        .bind(&app_title)
        .bind(coordinate_offset_x)
        .bind(coordinate_offset_y)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        self.get_app_settings().await
    }
    
    /// 获取所有车辆连接
    pub async fn get_all_vehicle_connections(&self) -> Result<Vec<VehicleConnection>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, vehicle_id, ip_address, name, description, color, is_active, created_at, updated_at 
             FROM vehicle_connections ORDER BY created_at DESC"
        )
            .fetch_all(&self.pool)
            .await?;
        
        let mut connections = Vec::new();
        for row in rows {
            connections.push(VehicleConnection {
                id: row.get("id"),
                vehicle_id: row.get("vehicle_id"),
                ip_address: row.get("ip_address"),
                name: row.get("name"),
                description: row.get("description"),
                color: row.get("color"),
                is_active: row.get("is_active"),
                created_at: row.get::<String, _>("created_at").parse().unwrap(),
                updated_at: row.get::<String, _>("updated_at").parse().unwrap(),
            });
        }
        
        Ok(connections)
    }
    
    /// 根据ID获取车辆连接
    pub async fn get_vehicle_connection_by_id(&self, id: i64) -> Result<Option<VehicleConnection>, sqlx::Error> {
        let row = sqlx::query("SELECT * FROM vehicle_connections WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        
        if let Some(row) = row {
            Ok(Some(VehicleConnection {
                id: row.get("id"),
                vehicle_id: row.get("vehicle_id"),
                ip_address: row.get("ip_address"),
                name: row.get("name"),
                description: row.get("description"),
                color: row.get("color"),
                is_active: row.get("is_active"),
                created_at: row.get::<String, _>("created_at").parse().unwrap(),
                updated_at: row.get::<String, _>("updated_at").parse().unwrap(),
            }))
        } else {
            Ok(None)
        }
    }
    
    /// 更新车辆连接
    pub async fn update_vehicle_connection(
        &self, 
        id: i64, 
        request: UpdateVehicleConnectionRequest
    ) -> Result<Option<VehicleConnection>, sqlx::Error> {
        let now = Utc::now();
        
        // 先获取现有记录
        let existing = match self.get_vehicle_connection_by_id(id).await? {
            Some(conn) => conn,
            None => return Ok(None),
        };
        
        // 准备更新的值，如果请求中没有提供则使用现有值
        let vehicle_id = request.vehicle_id.unwrap_or(existing.vehicle_id);
        let ip_address = request.ip_address.unwrap_or(existing.ip_address);
        let name = request.name.unwrap_or(existing.name);
        let description = request.description.or(existing.description);
        let color = request.color.or(existing.color);
        let is_active = request.is_active.unwrap_or(existing.is_active);
        
        // 执行更新
        sqlx::query(
            r#"
            UPDATE vehicle_connections 
            SET vehicle_id = ?, ip_address = ?, name = ?, description = ?, color = ?, is_active = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(vehicle_id)
        .bind(&ip_address)
        .bind(&name)
        .bind(&description)
        .bind(&color)
        .bind(is_active)
        .bind(now.to_rfc3339())
        .bind(id)
        .execute(&self.pool)
        .await?;
        
        // 返回更新后的记录
        self.get_vehicle_connection_by_id(id).await
    }
    
    /// 删除车辆连接
    pub async fn delete_vehicle_connection(&self, id: i64) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM vehicle_connections WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        
        Ok(result.rows_affected() > 0)
    }
    
    /// 获取活跃的车辆连接
    pub async fn get_active_vehicle_connections(&self) -> Result<Vec<VehicleConnection>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM vehicle_connections WHERE is_active = true ORDER BY name")
            .fetch_all(&self.pool)
            .await?;
        
        let mut connections = Vec::new();
        for row in rows {
            connections.push(VehicleConnection {
                id: row.get("id"),
                vehicle_id: row.get("vehicle_id"),
                ip_address: row.get("ip_address"),
                name: row.get("name"),
                description: row.get("description"),
                color: row.get("color"),
                is_active: row.get("is_active"),
                created_at: row.get::<String, _>("created_at").parse().unwrap(),
                updated_at: row.get::<String, _>("updated_at").parse().unwrap(),
            });
        }
        
        Ok(connections)
    }

    /// 初始化默认交通灯设置（如果不存在）
    async fn init_default_traffic_light_settings(&self) -> Result<(), sqlx::Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM traffic_light_settings")
            .fetch_one(&self.pool)
            .await?;

        if count == 0 {
            let now = Utc::now().to_rfc3339();
            sqlx::query(
                r#"
                INSERT INTO traffic_light_settings (red_light_duration, green_light_duration, created_at, updated_at)
                VALUES (45, 60, ?, ?)
                "#
            )
            .bind(&now)
            .bind(&now)
            .execute(&self.pool)
            .await?;
            
            log::info!("初始化默认交通灯设置: 红灯45秒, 绿灯60秒");
        }
        
        Ok(())
    }

    /// 获取交通灯设置
    pub async fn get_traffic_light_settings(&self) -> Result<TrafficLightSettings, sqlx::Error> {
        let row = sqlx::query("SELECT * FROM traffic_light_settings ORDER BY id LIMIT 1")
            .fetch_one(&self.pool)
            .await?;

        Ok(TrafficLightSettings {
            id: row.get("id"),
            red_light_duration: row.get("red_light_duration"),
            green_light_duration: row.get("green_light_duration"),
            created_at: row.get::<String, _>("created_at").parse().unwrap_or_default(),
            updated_at: row.get::<String, _>("updated_at").parse().unwrap_or_default(),
        })
    }

    /// 更新交通灯设置
    pub async fn update_traffic_light_settings(
        &self,
        request: UpdateTrafficLightSettingsRequest,
    ) -> Result<TrafficLightSettings, sqlx::Error> {
        request.validate().map_err(|e| sqlx::Error::Protocol(e))?;

        let now = Utc::now().to_rfc3339();
        
        // 构建动态更新语句
        let mut update_fields = Vec::new();
        let mut bind_values = Vec::new();
        
        if let Some(red_duration) = request.red_light_duration {
            update_fields.push("red_light_duration = ?");
            bind_values.push(red_duration.to_string());
        }
        
        if let Some(green_duration) = request.green_light_duration {
            update_fields.push("green_light_duration = ?");
            bind_values.push(green_duration.to_string());
        }

        if update_fields.is_empty() {
            return self.get_traffic_light_settings().await;
        }

        update_fields.push("updated_at = ?");
        bind_values.push(now.clone());

        let sql = format!(
            "UPDATE traffic_light_settings SET {} WHERE id = (SELECT id FROM traffic_light_settings ORDER BY id LIMIT 1)",
            update_fields.join(", ")
        );

        let mut query = sqlx::query(&sql);
        for value in &bind_values {
            query = query.bind(value);
        }

        query.execute(&self.pool).await?;
        
        self.get_traffic_light_settings().await
    }

    /// 创建出租车订单
    pub async fn create_taxi_order(&self, request: CreateTaxiOrderRequest) -> Result<TaxiOrder, sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        
        let row = sqlx::query(
            r#"
            INSERT INTO taxi_orders (order_id, start_x, start_y, end_x, end_y, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING id, order_id, start_x, start_y, end_x, end_y, assigned_vehicle_id, created_at, updated_at
            "#
        )
        .bind(&request.order_id)
        .bind(request.start_x)
        .bind(request.start_y)
        .bind(request.end_x)
        .bind(request.end_y)
        .bind(&now)
        .bind(&now)
        .fetch_one(&self.pool)
        .await?;

        Ok(TaxiOrder {
            id: row.get("id"),
            order_id: row.get("order_id"),
            start_x: row.get("start_x"),
            start_y: row.get("start_y"),
            end_x: row.get("end_x"),
            end_y: row.get("end_y"),
            assigned_vehicle_id: row.get("assigned_vehicle_id"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    /// 保存出租车订单（包含分配的车辆ID）
    pub async fn save_taxi_order(&self, order_id: &str, assigned_vehicle_id: i32, start_x: f64, start_y: f64, end_x: f64, end_y: f64) -> Result<TaxiOrder, sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        
        let row = sqlx::query(
            r#"
            INSERT INTO taxi_orders (order_id, start_x, start_y, end_x, end_y, assigned_vehicle_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id, order_id, start_x, start_y, end_x, end_y, assigned_vehicle_id, created_at, updated_at
            "#
        )
        .bind(order_id)
        .bind(start_x)
        .bind(start_y)
        .bind(end_x)
        .bind(end_y)
        .bind(assigned_vehicle_id)
        .bind(&now)
        .bind(&now)
        .fetch_one(&self.pool)
        .await?;

        Ok(TaxiOrder {
            id: row.get("id"),
            order_id: row.get("order_id"),
            start_x: row.get("start_x"),
            start_y: row.get("start_y"),
            end_x: row.get("end_x"),
            end_y: row.get("end_y"),
            assigned_vehicle_id: row.get("assigned_vehicle_id"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    /// 获取所有出租车订单
    pub async fn get_all_taxi_orders(&self) -> Result<Vec<TaxiOrder>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, order_id, start_x, start_y, end_x, end_y, assigned_vehicle_id, created_at, updated_at FROM taxi_orders ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await?;

        let mut orders = Vec::new();
        for row in rows {
            orders.push(TaxiOrder {
                id: row.get("id"),
                order_id: row.get("order_id"),
                start_x: row.get("start_x"),
                start_y: row.get("start_y"),
                end_x: row.get("end_x"),
                end_y: row.get("end_y"),
                assigned_vehicle_id: row.get("assigned_vehicle_id"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }

        Ok(orders)
    }

    /// 创建AVP泊车记录
    pub async fn create_avp_parking(&self, request: CreateAvpParkingRequest) -> Result<AvpParking, sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        
        let row = sqlx::query(
            r#"
            INSERT INTO avp_parking (vehicle_id, parking_spot, created_at)
            VALUES (?, ?, ?)
            RETURNING id, vehicle_id, parking_spot, created_at
            "#
        )
        .bind(request.vehicle_id)
        .bind(request.parking_spot)
        .bind(&now)
        .fetch_one(&self.pool)
        .await?;

        Ok(AvpParking {
            id: row.get("id"),
            vehicle_id: row.get("vehicle_id"),
            parking_spot: row.get("parking_spot"),
            created_at: row.get("created_at"),
        })
    }

    /// 获取所有AVP泊车记录
    pub async fn get_all_avp_parking(&self) -> Result<Vec<AvpParking>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, vehicle_id, parking_spot, created_at FROM avp_parking ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await?;

        let mut parking_records = Vec::new();
        for row in rows {
            parking_records.push(AvpParking {
                id: row.get("id"),
                vehicle_id: row.get("vehicle_id"),
                parking_spot: row.get("parking_spot"),
                created_at: row.get("created_at"),
            });
        }

        Ok(parking_records)
    }

    /// 创建AVP取车记录
    pub async fn create_avp_pickup(&self, request: CreateAvpPickupRequest) -> Result<AvpPickup, sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        
        let row = sqlx::query(
            r#"
            INSERT INTO avp_pickup (vehicle_id, created_at)
            VALUES (?, ?)
            RETURNING id, vehicle_id, created_at
            "#
        )
        .bind(request.vehicle_id)
        .bind(&now)
        .fetch_one(&self.pool)
        .await?;

        Ok(AvpPickup {
            id: row.get("id"),
            vehicle_id: row.get("vehicle_id"),
            created_at: row.get("created_at"),
        })
    }

    /// 获取所有AVP取车记录
    pub async fn get_all_avp_pickup(&self) -> Result<Vec<AvpPickup>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, vehicle_id, created_at FROM avp_pickup ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await?;

        let mut pickup_records = Vec::new();
        for row in rows {
            pickup_records.push(AvpPickup {
                id: row.get("id"),
                vehicle_id: row.get("vehicle_id"),
                created_at: row.get("created_at"),
            });
        }

        Ok(pickup_records)
    }

    /// 更新车辆在线时长
    pub async fn update_vehicle_online_time(&self, vehicle_id: i32, minutes: i32) -> Result<(), sqlx::Error> {
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let now = Utc::now().to_rfc3339();

        // 使用 INSERT OR IGNORE + UPDATE 的方式确保记录存在并更新
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO vehicle_online_time (vehicle_id, date, online_minutes, updated_at)
            VALUES (?, ?, 0, ?)
            "#
        )
        .bind(vehicle_id)
        .bind(&today)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        // 更新在线时长
        sqlx::query(
            r#"
            UPDATE vehicle_online_time 
            SET online_minutes = online_minutes + ?, updated_at = ?
            WHERE vehicle_id = ? AND date = ?
            "#
        )
        .bind(minutes)
        .bind(&now)
        .bind(vehicle_id)
        .bind(&today)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// 获取最近7天的车辆在线时长统计
    pub async fn get_recent_vehicle_online_time(&self, days: i32) -> Result<Vec<VehicleOnlineTime>, sqlx::Error> {
        let start_date = chrono::Utc::now() - chrono::Duration::days(days as i64);
        let start_date_str = start_date.format("%Y-%m-%d").to_string();

        let rows = sqlx::query(
            r#"
            SELECT id, vehicle_id, date, online_minutes, updated_at 
            FROM vehicle_online_time 
            WHERE date >= ? 
            ORDER BY date DESC, vehicle_id
            "#
        )
        .bind(&start_date_str)
        .fetch_all(&self.pool)
        .await?;

        let mut records = Vec::new();
        for row in rows {
            records.push(VehicleOnlineTime {
                id: row.get("id"),
                vehicle_id: row.get("vehicle_id"),
                date: row.get("date"),
                online_minutes: row.get("online_minutes"),
                updated_at: row.get("updated_at"),
            });
        }

        Ok(records)
    }

    /// 获取自动驾驶行为统计
    pub async fn get_driving_behavior_stats(&self) -> Result<serde_json::Value, sqlx::Error> {
        // 统计出租车订单数量
        let taxi_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM taxi_orders")
            .fetch_one(&self.pool)
            .await?;

        // 统计AVP取车数量
        let pickup_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM avp_pickup")
            .fetch_one(&self.pool)
            .await?;

        // 统计AVP泊车数量
        let parking_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM avp_parking")
            .fetch_one(&self.pool)
            .await?;

        let stats = serde_json::json!({
            "taxi_orders": taxi_count,
            "avp_pickup": pickup_count,
            "avp_parking": parking_count
        });

        Ok(stats)
    }

    // ============ 沙盘设置相关方法 ============

    /// 获取沙盘服务设置
    pub async fn get_sandbox_service_settings(&self) -> Result<Option<SandboxServiceSettings>, sqlx::Error> {
        let row = sqlx::query("SELECT * FROM sandbox_service_settings ORDER BY id DESC LIMIT 1")
            .fetch_optional(&self.pool)
            .await?;

        if let Some(row) = row {
            Ok(Some(SandboxServiceSettings {
                id: row.get("id"),
                ip_address: row.get("ip_address"),
                traffic_light_count: row.get("traffic_light_count"),
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at"))
                    .unwrap_or_default()
                    .with_timezone(&chrono::Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at"))
                    .unwrap_or_default()
                    .with_timezone(&chrono::Utc),
            }))
        } else {
            Ok(None)
        }
    }

    /// 创建或更新沙盘服务设置（仅保存一条数据）
    pub async fn create_or_update_sandbox_service_settings(
        &self,
        request: CreateOrUpdateSandboxServiceRequest,
    ) -> Result<SandboxServiceSettings, sqlx::Error> {
        let now = Utc::now();

        // 检查是否已存在记录
        let existing = self.get_sandbox_service_settings().await?;

        if let Some(existing_settings) = existing {
            // 更新现有记录
            sqlx::query(
                r#"
                UPDATE sandbox_service_settings 
                SET ip_address = ?, traffic_light_count = ?, updated_at = ?
                WHERE id = ?
                "#
            )
            .bind(&request.ip_address)
            .bind(request.traffic_light_count)
            .bind(now.to_rfc3339())
            .bind(existing_settings.id)
            .execute(&self.pool)
            .await?;

            // 返回更新后的记录
            let updated = SandboxServiceSettings {
                id: existing_settings.id,
                ip_address: request.ip_address,
                traffic_light_count: request.traffic_light_count,
                created_at: existing_settings.created_at,
                updated_at: now,
            };
            // 确保单灯时长表具有对应数量的记录（默认30/30）
            self.ensure_traffic_light_items(updated.traffic_light_count).await?;
            Ok(updated)
        } else {
            // 创建新记录
            let result = sqlx::query(
                r#"
                INSERT INTO sandbox_service_settings (ip_address, traffic_light_count, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                "#
            )
            .bind(&request.ip_address)
            .bind(request.traffic_light_count)
            .bind(now.to_rfc3339())
            .bind(now.to_rfc3339())
            .execute(&self.pool)
            .await?;

            let created = SandboxServiceSettings {
                id: result.last_insert_rowid(),
                ip_address: request.ip_address,
                traffic_light_count: request.traffic_light_count,
                created_at: now,
                updated_at: now,
            };
            // 初始化对应数量的单灯记录
            self.ensure_traffic_light_items(created.traffic_light_count).await?;
            Ok(created)
        }
    }

    /// 删除沙盘服务设置
    pub async fn delete_sandbox_service_settings(&self) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM sandbox_service_settings")
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    // ============ 每个红绿灯时长（按编号） ============
    async fn ensure_traffic_light_items(&self, count: i32) -> Result<(), sqlx::Error> {
        if count <= 0 { return Ok(()); }
        for i in 1..=count {
            let exists: Option<i64> = sqlx::query_scalar("SELECT id FROM traffic_light_items WHERE light_id = ?")
                .bind(i)
                .fetch_optional(&self.pool)
                .await?;
            if exists.is_none() {
                let now = Utc::now().to_rfc3339();
                sqlx::query(
                    "INSERT INTO traffic_light_items (light_id, red_light_duration, green_light_duration, created_at, updated_at) VALUES (?, 30, 30, ?, ?)"
                )
                .bind(i)
                .bind(&now)
                .bind(&now)
                .execute(&self.pool)
                .await?;
            }
        }
        Ok(())
    }

    pub async fn get_traffic_light_item(&self, light_id: i32) -> Result<TrafficLightItem, sqlx::Error> {
        // 如果不存在该编号记录则创建默认
        self.ensure_traffic_light_items(light_id).await?;
        let row = sqlx::query("SELECT * FROM traffic_light_items WHERE light_id = ?")
            .bind(light_id)
            .fetch_one(&self.pool)
            .await?;
        Ok(TrafficLightItem {
            id: row.get("id"),
            light_id: row.get("light_id"),
            red_light_duration: row.get("red_light_duration"),
            green_light_duration: row.get("green_light_duration"),
            created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at")).unwrap_or_default().with_timezone(&chrono::Utc),
            updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at")).unwrap_or_default().with_timezone(&chrono::Utc),
        })
    }

    pub async fn update_traffic_light_item(&self, light_id: i32, red_seconds: i32, green_seconds: i32) -> Result<TrafficLightItem, sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        let updated = sqlx::query("UPDATE traffic_light_items SET red_light_duration = ?, green_light_duration = ?, updated_at = ? WHERE light_id = ?")
            .bind(red_seconds)
            .bind(green_seconds)
            .bind(&now)
            .bind(light_id)
            .execute(&self.pool)
            .await?;
        if updated.rows_affected() == 0 {
            sqlx::query("INSERT INTO traffic_light_items (light_id, red_light_duration, green_light_duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
                .bind(light_id)
                .bind(red_seconds)
                .bind(green_seconds)
                .bind(&now)
                .bind(&now)
                .execute(&self.pool)
                .await?;
        }
        self.get_traffic_light_item(light_id).await
    }

    /// 获取所有沙盘摄像头
    pub async fn get_all_sandbox_cameras(&self) -> Result<Vec<SandboxCamera>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM sandbox_cameras ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await?;

        let mut cameras = Vec::new();
        for row in rows {
            cameras.push(SandboxCamera {
                id: row.get("id"),
                name: row.get("name"),
                camera_type: row.get("camera_type"),
                rtsp_url: row.get("rtsp_url"),
                device_index: row.get("device_index"),
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at"))
                    .unwrap_or_default()
                    .with_timezone(&chrono::Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at"))
                    .unwrap_or_default()
                    .with_timezone(&chrono::Utc),
            });
        }

        Ok(cameras)
    }

    /// 创建沙盘摄像头
    pub async fn create_sandbox_camera(
        &self,
        request: CreateSandboxCameraRequest,
    ) -> Result<SandboxCamera, sqlx::Error> {
        let now = Utc::now();

        let result = sqlx::query(
            r#"
            INSERT INTO sandbox_cameras (name, camera_type, rtsp_url, device_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&request.name)
        .bind(&request.camera_type)
        .bind(&request.rtsp_url)
        .bind(request.device_index)
        .bind(now.to_rfc3339())
        .bind(now.to_rfc3339())
        .execute(&self.pool)
        .await?;

        Ok(SandboxCamera {
            id: result.last_insert_rowid(),
            name: request.name,
            camera_type: request.camera_type,
            rtsp_url: request.rtsp_url,
            device_index: request.device_index,
            created_at: now,
            updated_at: now,
        })
    }

    /// 更新沙盘摄像头
    pub async fn update_sandbox_camera(
        &self,
        id: i64,
        request: UpdateSandboxCameraRequest,
    ) -> Result<Option<SandboxCamera>, sqlx::Error> {
        let now = Utc::now();

        // 获取现有记录
        let existing_row = sqlx::query("SELECT * FROM sandbox_cameras WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(existing) = existing_row {
            let name = request.name.unwrap_or_else(|| existing.get("name"));
            let camera_type = request.camera_type.unwrap_or_else(|| existing.get("camera_type"));
            let rtsp_url = request.rtsp_url.or_else(|| existing.get("rtsp_url"));
            let device_index = request.device_index.or_else(|| existing.get("device_index"));

            sqlx::query(
                r#"
                UPDATE sandbox_cameras 
                SET name = ?, camera_type = ?, rtsp_url = ?, device_index = ?, updated_at = ?
                WHERE id = ?
                "#
            )
            .bind(&name)
            .bind(&camera_type)
            .bind(&rtsp_url)
            .bind(device_index)
            .bind(now.to_rfc3339())
            .bind(id)
            .execute(&self.pool)
            .await?;

            Ok(Some(SandboxCamera {
                id,
                name,
                camera_type,
                rtsp_url,
                device_index,
                created_at: chrono::DateTime::parse_from_rfc3339(&existing.get::<String, _>("created_at"))
                    .unwrap_or_default()
                    .with_timezone(&chrono::Utc),
                updated_at: now,
            }))
        } else {
            Ok(None)
        }
    }

    /// 删除沙盘摄像头
    pub async fn delete_sandbox_camera(&self, id: i64) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM sandbox_cameras WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    // ===================== 菜单可见性设置 =====================

    /// 获取菜单可见性设置
    pub async fn get_menu_visibility_settings(&self) -> Result<MenuVisibilitySettings, sqlx::Error> {
        let row = sqlx::query("SELECT * FROM menu_visibility_settings ORDER BY id DESC LIMIT 1")
            .fetch_one(&self.pool)
            .await?;
        
        Ok(MenuVisibilitySettings {
            id: row.get("id"),
            show_vehicle_info: row.get("show_vehicle_info"),
            show_auto_drive: row.get("show_auto_drive"),
            show_sandbox_control: row.get("show_sandbox_control"),
            show_settings: row.get("show_settings"),
            show_parallel_driving: row.get("show_parallel_driving"),
            show_vehicle_camera: row.get::<Option<bool>, _>("show_vehicle_camera").unwrap_or(true),
            created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at"))
                .unwrap_or_default()
                .with_timezone(&chrono::Utc),
            updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at"))
                .unwrap_or_default()
                .with_timezone(&chrono::Utc),
        })
    }

    /// 更新菜单可见性设置
    pub async fn update_menu_visibility_settings(&self, req: UpdateMenuVisibilityRequest) -> Result<MenuVisibilitySettings, sqlx::Error> {
        // 读取当前设置并合并
        let current = self.get_menu_visibility_settings().await?;
        
        let show_vehicle_info = req.show_vehicle_info.unwrap_or(current.show_vehicle_info);
        let show_auto_drive = req.show_auto_drive.unwrap_or(current.show_auto_drive);
        let show_sandbox_control = req.show_sandbox_control.unwrap_or(current.show_sandbox_control);
        let show_settings = req.show_settings.unwrap_or(current.show_settings);
        let show_parallel_driving = req.show_parallel_driving.unwrap_or(current.show_parallel_driving);
        let show_vehicle_camera = req.show_vehicle_camera.unwrap_or(current.show_vehicle_camera);
        let now = Utc::now();

        sqlx::query(
            r#"
            UPDATE menu_visibility_settings 
            SET show_vehicle_info = ?, 
                show_auto_drive = ?, 
                show_sandbox_control = ?, 
                show_settings = ?,
                show_parallel_driving = ?,
                show_vehicle_camera = ?,
                updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(show_vehicle_info)
        .bind(show_auto_drive)
        .bind(show_sandbox_control)
        .bind(show_settings)
        .bind(show_parallel_driving)
        .bind(show_vehicle_camera)
        .bind(now.to_rfc3339())
        .bind(current.id)
        .execute(&self.pool)
        .await?;

        Ok(MenuVisibilitySettings {
            id: current.id,
            show_vehicle_info,
            show_auto_drive,
            show_sandbox_control,
            show_settings,
            show_parallel_driving,
            show_vehicle_camera,
            created_at: current.created_at,
            updated_at: now,
        })
    }

    /// 初始化默认菜单可见性设置
    async fn init_default_menu_visibility_settings(&self) -> Result<(), sqlx::Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM menu_visibility_settings")
            .fetch_one(&self.pool)
            .await?;

        if count == 0 {
            let now = Utc::now();
            sqlx::query(
                r#"
                INSERT INTO menu_visibility_settings 
                (show_vehicle_info, show_auto_drive, show_sandbox_control, show_settings, show_parallel_driving, show_vehicle_camera, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(true)  // 默认显示所有菜单和功能
            .bind(true)
            .bind(true)
            .bind(true)
            .bind(true)
            .bind(true)  // 默认显示车载摄像头
            .bind(now.to_rfc3339())
            .bind(now.to_rfc3339())
            .execute(&self.pool)
            .await?;

            log::info!("已初始化默认菜单可见性设置");
        }

        Ok(())
    }
}
