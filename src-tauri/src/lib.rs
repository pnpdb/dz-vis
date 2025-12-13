use local_ip_address::local_ip;
use log::{debug, error, info, warn};
use tauri::Manager;
use tauri_plugin_log;

mod commands;
mod config;
mod database;
mod error;
mod protocol_processing;
mod rtsp_converter;
mod rtsp_stream;
mod services;
mod socket;
mod udp_video;
mod video_processing;
mod mse_streamer;
mod gstreamer_streamer;
mod utils;

use commands::protocol_processing::ProtocolProcessorState;
use commands::*;
use commands::protocol_config::*;
use config::{get_app_config, get_port_config};
use database::VehicleDatabase;
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
            "初始化日志级别: {:?}, 初始化缓存大小(bytes): {:?}, 开机启动: {:?}",
            level, max_bytes, auto_start
        );
        (level, max_bytes, auto_start)
    };

    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "0");
        info!("Linux: 设置 WEBKIT_DISABLE_COMPOSITING_MODE=0");
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
            get_menu_visibility_settings,
            update_menu_visibility_settings,
            get_vehicle_server_ports,
            get_media_server_ports,
            send_vehicle_control_command,
            send_data_recording_command,
            send_vehicle_function_setting_command,
            send_vehicle_path_display_command,
            send_vehicle_camera_toggle_command,
            send_sandbox_lighting_control,
            // MSE 流命令
            start_mse_stream,
            stop_mse_stream,
            is_mse_stream_active,
            // GStreamer MJPEG 流命令
            start_gstreamer_stream,
            stop_gstreamer_stream,
            is_gstreamer_stream_active,
            get_mjpeg_websocket_url,
            get_active_gstreamer_streams,
            // 视频处理命令
            process_video_frame,
            quick_validate_jpeg_base64,
            get_vehicle_video_stats,
            get_all_video_stats,
            clear_vehicle_video_stats,
            cleanup_stale_video_stats,
            get_video_processing_summary,
            batch_process_video_frames,
            reset_all_video_stats,
            // 协议处理命令
            parse_protocol,
            validate_protocol,
            batch_process_protocols,
            build_protocol,
            get_protocol_stats,
            reset_protocol_stats,
            configure_batch_processor,
            get_supported_message_types,
            quick_validate_protocol_format,
            // 协议配置命令
            get_message_types_config_command,
            get_receive_message_types,
            get_send_message_types,
            get_protocol_constants,
            // 车辆状态管理命令
            is_vehicle_state_changed,
            batch_check_vehicle_states,
            // 批量操作命令
            batch_send_to_vehicles,
            batch_broadcast_to_vehicles,
            // 路径数据命令
            get_merged_path_data,
            get_loaded_paths_info,
            reload_all_paths
        ])
        .setup(move |app| {
            info!("应用启动: {}", env!("CARGO_PKG_NAME"));

            // 输出端口配置信息
            config::AppConfig::global().ports.log_config();

            // 初始化路径加载器并预加载所有路径文件
            info!("初始化路径加载器...");
            let app_handle = app.handle().clone();
            
            // 在开发模式下，使用项目根目录的 public/routes
            // 在生产模式下，使用资源目录的 routes
            let routes_dir = if cfg!(debug_assertions) {
                // 开发模式：使用项目根目录的 public/routes
                let current_dir = std::env::current_dir().expect("无法获取当前目录");
                info!("当前工作目录: {:?}", current_dir);
                
                // 尝试几个可能的路径
                let possible_paths = vec![
                    current_dir.join("public").join("routes"),              // 如果当前在项目根目录
                    current_dir.parent().unwrap().join("public").join("routes"), // 如果当前在 src-tauri
                ];
                
                let dev_routes = possible_paths.into_iter()
                    .find(|p| p.exists())
                    .unwrap_or_else(|| current_dir.join("public").join("routes"));
                
                info!("🔧 开发模式 - 路径文件目录: {:?}", dev_routes);
                dev_routes
            } else {
                // 生产模式：使用资源目录
                let prod_routes = app_handle
                    .path()
                    .resource_dir()
                    .expect("无法获取资源目录")
                    .join("routes");
                info!("生产模式 - 路径文件目录: {:?}", prod_routes);
                prod_routes
            };
            
            // 检查目录是否存在
            if !routes_dir.exists() {
                error!("路径文件目录不存在: {:?}", routes_dir);
            } else {
                info!("路径文件目录存在: {:?}", routes_dir);
            }
            
            let path_loader = services::path_loader::PathLoader::new(routes_dir);
            
            // 预加载所有路径文件
            match path_loader.preload_all_paths() {
                Ok(count) => {
                    info!("成功预加载 {} 个路径文件", count);
                }
                Err(e) => {
                    error!("路径文件预加载失败: {}", e);
                }
            }
            
            // 将路径加载器注册为全局状态
            app.manage(path_loader);
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
                            info!("开机启动已启用");
                        }
                        Err(e) => {
                            warn!("启用开机启动失败: {}", e);
                        }
                    }
                } else {
                    // 禁用自动启动
                    match autostart_manager.disable() {
                        Ok(_) => {
                            info!("开机启动已禁用");
                        }
                        Err(e) => {
                            warn!("禁用开机启动失败: {}", e);
                        }
                    }
                }

                // 检查并记录当前状态
                match autostart_manager.is_enabled() {
                    Ok(enabled) => {
                        info!(
                            "开机启动状态: {}",
                            if enabled { "已启用" } else { "已禁用" }
                        );
                    }
                    Err(e) => {
                        warn!("无法检查开机启动状态: {}", e);
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
                        info!("数据库初始化成功");
                    }
                    Err(e) => {
                        error!("数据库初始化失败: {}", e);
                    }
                }
            });

            // 初始化协议处理器状态
            app.manage(ProtocolProcessorState::new());
            info!("协议处理器初始化成功");

            // 启动 GStreamer MJPEG 流服务
            info!("初始化 GStreamer MJPEG 流服务...");
            
            // 初始化全局 GStreamer 流管理器（在异步任务中）
            tauri::async_runtime::spawn(async {
                if let Err(e) = gstreamer_streamer::init_global_streamer().await {
                    log::error!("GStreamer 初始化失败: {}", e);
                    log::error!("   请确保已安装 GStreamer:");
                    log::error!("   Ubuntu: sudo apt-get install gstreamer1.0-*");
                    log::error!("   macOS: brew install gstreamer gst-plugins-*");
                } else {
                    log::info!("GStreamer 初始化成功");
                }
            });
            
            // 启动 MJPEG WebSocket 服务器
            let mjpeg_ws_port = 9004; // MJPEG WebSocket 端口
            tauri::async_runtime::spawn(async move {
                if let Err(e) = gstreamer_streamer::websocket::start_websocket_server(mjpeg_ws_port).await {
                    log::error!("MJPEG WebSocket 服务器启动失败: {}", e);
                } else {
                    log::info!("MJPEG WebSocket 服务器已就绪: ws://127.0.0.1:{}", mjpeg_ws_port);
                }
            });
            info!("GStreamer MJPEG 流服务初始化任务已启动");

            // UDP视频服务器自动启动已移至媒体命令模块，可通过API手动启动

            // 在 Linux 上显式设置窗口图标
            #[cfg(target_os = "linux")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    // 从嵌入的资源中加载图标
                    if let Some(icon_rgba) = app.default_window_icon() {
                        if let Err(e) = window.set_icon(icon_rgba.clone()) {
                            warn!("设置窗口图标失败: {}", e);
                        } else {
                            info!("Linux: 窗口图标已设置");
                        }
                    } else {
                        warn!("未找到默认窗口图标");
                    }
                }
            }

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
