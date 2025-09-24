// 应用配置模块
use serde::{Deserialize, Serialize};

/// 默认端口配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppPorts {
    /// Socket服务器端口（用于车辆通信）
    pub socket_server: u16,
    /// UDP视频服务器端口
    pub udp_video_server: u16,
    /// 视频流服务器端口
    pub video_stream_server: u16,
    /// HLS服务器端口
    pub hls_server: u16,
}

impl Default for AppPorts {
    fn default() -> Self {
        Self {
            socket_server: 8888,        // Socket服务器默认端口
            udp_video_server: 8080,     // UDP视频服务器默认端口
            video_stream_server: 9001,  // 视频流服务器默认端口
            hls_server: 9002,           // HLS服务器默认端口
        }
    }
}

impl AppPorts {
    /// 创建新的端口配置
    pub fn new() -> Self {
        Self::default()
    }
    
    /// 从环境变量或配置文件加载端口配置
    pub fn from_env() -> Self {
        Self {
            socket_server: std::env::var("DZ_VIZ_SOCKET_PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(8888),
            udp_video_server: std::env::var("DZ_VIZ_UDP_VIDEO_PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(8080),
            video_stream_server: std::env::var("DZ_VIZ_VIDEO_STREAM_PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(9001),
            hls_server: std::env::var("DZ_VIZ_HLS_PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(9002),
        }
    }
    
    /// 获取UDP视频服务器绑定地址
    pub fn udp_video_bind_addr(&self) -> String {
        format!("0.0.0.0:{}", self.udp_video_server)
    }
    
    /// 打印当前端口配置
    pub fn log_config(&self) {
        log::info!("端口配置:");
        log::info!("  Socket服务器: {}", self.socket_server);
        log::info!("  UDP视频服务器: {}", self.udp_video_server);
        log::info!("  视频流服务器: {}", self.video_stream_server);
        log::info!("  HLS服务器: {}", self.hls_server);
    }
}

/// 全局应用配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// 端口配置
    pub ports: AppPorts,
    /// 性能配置
    pub performance: PerformanceConfig,
    /// 网络配置  
    pub network: NetworkConfig,
}

/// 性能配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceConfig {
    /// 目标帧率
    pub target_fps: u32,
    /// 低帧率阈值
    pub low_fps_threshold: u32,
    /// 高帧率阈值
    pub high_fps_threshold: u32,
    /// 最大缓存大小（字节）
    pub max_cache_size: u64,
}

/// 网络配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    /// 连接超时时间（毫秒）
    pub timeout: u32,
    /// 重试次数
    pub retry_count: u32,
    /// 重试延迟（毫秒）
    pub retry_delay: u32,
    /// 心跳间隔（毫秒）
    pub heartbeat_interval: u32,
}

impl Default for PerformanceConfig {
    fn default() -> Self {
        Self {
            target_fps: 60,
            low_fps_threshold: 20,
            high_fps_threshold: 50,
            max_cache_size: 100 * 1024 * 1024, // 100MB
        }
    }
}

impl Default for NetworkConfig {
    fn default() -> Self {
        Self {
            timeout: 10000,
            retry_count: 3,
            retry_delay: 1000,
            heartbeat_interval: 10000,
        }
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            ports: AppPorts::from_env(), // 优先从环境变量加载
            performance: PerformanceConfig::default(),
            network: NetworkConfig::default(),
        }
    }
}

impl AppConfig {
    /// 创建新的应用配置
    pub fn new() -> Self {
        Self::default()
    }
    
    /// 获取全局配置实例
    pub fn global() -> &'static AppConfig {
        static CONFIG: once_cell::sync::Lazy<AppConfig> = 
            once_cell::sync::Lazy::new(|| AppConfig::new());
        &CONFIG
    }
}

// Tauri命令：获取应用配置
#[tauri::command]
pub fn get_app_config() -> AppConfig {
    AppConfig::global().clone()
}

// Tauri命令：获取端口配置
#[tauri::command] 
pub fn get_port_config() -> AppPorts {
    AppConfig::global().ports.clone()
}
