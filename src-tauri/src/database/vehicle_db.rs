use sqlx::{Pool, Sqlite, SqlitePool, Row};
use chrono::Utc;
use crate::database::models::*;

/// 车辆连接数据库管理器
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
        
        println!("📁 数据库路径: {}", database_url);
        
        // 创建连接池
        let pool = SqlitePool::connect(&database_url).await?;
        
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
        
        println!("✅ 数据库表结构检查完成");
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
            (vehicle_id, ip_address, name, description, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, true, ?, ?)
            "#
        )
        .bind(request.vehicle_id)
        .bind(&request.ip_address)
        .bind(&request.name)
        .bind(&request.description)
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
            is_active: row.get("is_active"),
            created_at: row.get::<String, _>("created_at").parse().unwrap(),
            updated_at: row.get::<String, _>("updated_at").parse().unwrap(),
        })
    }
    
    /// 获取所有车辆连接
    pub async fn get_all_vehicle_connections(&self) -> Result<Vec<VehicleConnection>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM vehicle_connections ORDER BY created_at DESC")
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
        let is_active = request.is_active.unwrap_or(existing.is_active);
        
        // 执行更新
        sqlx::query(
            r#"
            UPDATE vehicle_connections 
            SET vehicle_id = ?, ip_address = ?, name = ?, description = ?, is_active = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(vehicle_id)
        .bind(&ip_address)
        .bind(&name)
        .bind(&description)
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
            
            println!("✅ 初始化默认交通灯设置: 红灯45秒, 绿灯60秒");
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
}
