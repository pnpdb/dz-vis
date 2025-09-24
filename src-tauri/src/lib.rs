use local_ip_address::local_ip;
use log::{debug, error, info, warn};
use tauri::Manager;
use tauri_plugin_log;

mod commands;
mod config;
mod database;
mod rtsp_converter;
mod rtsp_stream;
mod socket;
mod udp_video;
mod video_processing;

use commands::*;
use database::VehicleDatabase;
use config::{get_app_config, get_port_config};
use std::sync::Arc;

/// 获取网络状态信息
#[tauri::command]
async fn get_network_status() -> Result<serde_json::Value, String> {
    match local_ip() {
        Ok(ip) => {
            let ip_str = ip.to_string();
            let is_private = is_private_ip(&ip_str);
            
            Ok(serde_json::json!({
                "connected": true,
                "ip": ip_str,
                "is_private": is_private,
                "text": if is_private { 
                    format!("局域网已连接 {}", ip_str) 
                } else { 
                    format!("公网已连接 {}", ip_str) 
                },
                "icon": "signal"
            }))
        }
        Err(_) => Ok(serde_json::json!({
                "connected": false,
                "ip": null,
                "is_private": false,
                "text": "未检测到网络",
                "icon": "times-circle"
        })),
    }
}

/// 判断是否为私有IP地址
fn is_private_ip(ip: &str) -> bool {
    if let Ok(addr) = ip.parse::<std::net::Ipv4Addr>() {
        let octets = addr.octets();
        
        // 10.0.0.0 - 10.255.255.255
        if octets[0] == 10 {
            return true;
        }
        
        // 172.16.0.0 - 172.31.255.255
        if octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31 {
            return true;
        }
        
        // 192.168.0.0 - 192.168.255.255
        if octets[0] == 192 && octets[1] == 168 {
            return true;
        }
        
        // 169.254.0.0 - 169.254.255.255 (APIPA)
        if octets[0] == 169 && octets[1] == 254 {
            return true;
        }
    }
    
    false
}

// 交通灯设置命令已移动到 commands/sandbox.rs

// 出租车订单、AVP停车/取车、车辆统计命令已移动到 commands/vehicle.rs

// 沙盘设置和摄像头管理命令已移动到 commands/sandbox.rs

// 视频流、RTSP转换、UDP视频服务器相关命令已移动到 commands/media.rs

// 应用设置命令已移动到 commands/settings.rs

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 预读取数据库中的应用设置，用于在日志插件初始化之前配置日志级别、最大文件大小和开机启动
    // 注意：此处需要阻塞式获取，因为插件在 Builder 构建时即完成初始化
    let (initial_log_level, initial_max_file_size_bytes, initial_auto_start) = {
        // 默认值：INFO 级别，512MB，不启用开机启动
        let mut level = log::LevelFilter::Info;
        let mut max_bytes: u64 = 512 * 1024 * 1024;
        let mut auto_start = false;

        if let Ok(rt) = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
        {
            let loaded = rt.block_on(async {
                match VehicleDatabase::new().await {
                    Ok(db) => match db.get_app_settings().await {
                        Ok(s) => Some(s),
                        Err(_) => None,
                    },
                    Err(_) => None,
                }
            });

            if let Some(settings) = loaded {
                // 映射日志级别
                let mapped = match settings.log_level.to_uppercase().as_str() {
                    "TRACE" => log::LevelFilter::Trace,
                    "DEBUG" => log::LevelFilter::Debug,
                    "INFO" => log::LevelFilter::Info,
                    "WARN" | "WARNING" => log::LevelFilter::Warn,
                    "ERROR" => log::LevelFilter::Error,
                    _ => log::LevelFilter::Info,
                };
                level = mapped;

                // 缓存大小（界面单位MB）→ 字节
                let cache_mb = settings.cache_size.max(1) as u64;
                max_bytes = cache_mb.saturating_mul(1024 * 1024);

                // 开机启动设置
                auto_start = settings.auto_start;
            }
        }
        debug!(
            "🔄 初始化日志级别: {:?}, 初始化缓存大小(bytes): {:?}, 开机启动: {:?}",
            level, max_bytes, auto_start
        );
        (level, max_bytes, auto_start)
    };

    // 在 Linux 平台禁用 WebKit 复合渲染以修复 SVG/Icon 渲染问题
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        info!("🌐 Linux: 设置 WEBKIT_DISABLE_COMPOSITING_MODE=1");
    }

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
        .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
        .max_file_size(initial_max_file_size_bytes as u128 /* bytes */)
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(10))
        .level(initial_log_level)
        .level_for("sqlx::query", log::LevelFilter::Warn)
        .format(|out, message, record| {
            out.finish(format_args!(
              "[{} {}] {}",
              record.level(),
              record.target(),
              message
            ))
          })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(socket::ConnectionManager::default())
        .manage(Arc::new(parking_lot::RwLock::new(None)) as socket::SandboxConnectionManager)
        .invoke_handler(tauri::generate_handler![
            greet,
            open_folder,
            open_path,
            pick_document,
            get_system_info,
            minimize_window,
            maximize_window,
            close_window,
            start_socket_server,
            send_to_vehicle,
            send_sandbox_control,
            send_sandbox_exit_control,
            is_sandbox_connected,
            broadcast_message,
            broadcast_construction_marker,
            broadcast_all_construction_markers,
            get_connected_vehicles,
            get_vehicle_connections,
            create_vehicle_connection,
            update_vehicle_connection,
            delete_vehicle_connection,
            get_active_vehicle_connections,
            get_network_status,
            get_socket_server_status,
            get_app_config,
            get_port_config,
            get_traffic_light_settings,
            update_traffic_light_settings,
            broadcast_taxi_order,
            send_taxi_order_to_vehicle,
            send_avp_parking,
            send_avp_pickup,
            get_vehicle_online_stats,
            get_driving_behavior_stats,
            get_sandbox_service_settings,
            create_or_update_sandbox_service_settings,
            delete_sandbox_service_settings,
            get_all_sandbox_cameras,
            create_sandbox_camera,
            update_sandbox_camera,
            delete_sandbox_camera,
            start_video_stream_server,
            get_camera_stream_url,
            get_camera_websocket_url,
            start_rtsp_conversion,
            stop_rtsp_conversion,
            get_hls_url,
            start_hls_server,
            start_udp_video_server,
            stop_udp_video_server,
            get_udp_video_server_stats,
            send_sandbox_traffic_light_duration,
            get_traffic_light_item,
            update_traffic_light_item,
            get_app_settings,
            update_app_settings,
            get_vehicle_server_ports,
            get_media_server_ports,
            // 视频处理命令
            process_video_frame,
            quick_validate_jpeg_base64,
            get_vehicle_video_stats,
            get_all_video_stats,
            clear_vehicle_video_stats,
            cleanup_stale_video_stats,
            get_video_processing_summary,
            batch_process_video_frames,
            reset_all_video_stats
        ])
        .setup(move |app| {
            info!("应用启动: {}", env!("CARGO_PKG_NAME"));
            
            // 输出端口配置信息
            config::AppConfig::global().ports.log_config();
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::MacosLauncher;
                use tauri_plugin_autostart::ManagerExt;

                // 初始化自动启动插件
                let _ = app.handle().plugin(tauri_plugin_autostart::init(
                    MacosLauncher::LaunchAgent,
                    Some(vec!["--autostart"]), // 可选的启动参数
                ));

                // 获取自动启动管理器并根据设置启用或禁用
                let autostart_manager = app.autolaunch();

                if initial_auto_start {
                    // 启用自动启动
                    match autostart_manager.enable() {
                        Ok(_) => {
                            info!("✅ 开机启动已启用");
                        }
                        Err(e) => {
                            warn!("⚠️ 启用开机启动失败: {}", e);
                        }
                    }
                } else {
                    // 禁用自动启动
                    match autostart_manager.disable() {
                        Ok(_) => {
                            info!("🔄 开机启动已禁用");
                        }
                        Err(e) => {
                            warn!("⚠️ 禁用开机启动失败: {}", e);
                        }
                    }
                }

                // 检查并记录当前状态
                match autostart_manager.is_enabled() {
                    Ok(enabled) => {
                        info!(
                            "📋 开机启动状态: {}",
                            if enabled { "已启用" } else { "已禁用" }
                        );
                    }
                    Err(e) => {
                        warn!("⚠️ 无法检查开机启动状态: {}", e);
                    }
                }
            }

            // 克隆app handle用于不同任务
            let app_handle_db = app.handle().clone();
            // UDP视频服务器句柄不再需要，已移至媒体模块
            
            // 初始化数据库
            tauri::async_runtime::spawn(async move {
                match VehicleDatabase::new().await {
                    Ok(db) => {
                        app_handle_db.manage(db);
                        info!("✅ 数据库初始化成功");
                    }
                    Err(e) => {
                        error!("❌ 数据库初始化失败: {}", e);
                    }
                }
            });

            // UDP视频服务器自动启动已移至媒体命令模块，可通过API手动启动
            
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
