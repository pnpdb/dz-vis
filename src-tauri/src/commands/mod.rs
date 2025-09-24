// 命令模块入口文件
// 按功能分组管理所有 Tauri 命令

pub mod system;
pub mod settings;
pub mod vehicle;
pub mod sandbox;
pub mod media;
pub mod video_processing;
pub mod protocol_processing;

// 导出命令供 lib.rs 使用
pub use system::{
    greet, pick_document, open_folder, open_path, 
    get_system_info, minimize_window, maximize_window, close_window
};

pub use settings::{
    get_app_settings, update_app_settings
};

pub use vehicle::{
    start_socket_server, send_to_vehicle, broadcast_message, broadcast_construction_marker,
    broadcast_all_construction_markers,
    get_connected_vehicles, get_vehicle_connections, create_vehicle_connection,
    update_vehicle_connection, delete_vehicle_connection, get_active_vehicle_connections,
    get_socket_server_status, broadcast_taxi_order, send_taxi_order_to_vehicle, send_avp_parking, send_avp_pickup,
    get_vehicle_online_stats, get_driving_behavior_stats, get_vehicle_server_ports
};

pub use sandbox::{
    send_sandbox_control, send_sandbox_exit_control, is_sandbox_connected, send_sandbox_traffic_light_duration,
    get_traffic_light_item, update_traffic_light_item, get_traffic_light_settings,
    update_traffic_light_settings, get_sandbox_service_settings, 
    create_or_update_sandbox_service_settings, delete_sandbox_service_settings,
    get_all_sandbox_cameras, create_sandbox_camera, update_sandbox_camera, delete_sandbox_camera
};

pub use media::{
    start_video_stream_server, get_camera_stream_url, get_camera_websocket_url,
    start_rtsp_conversion, stop_rtsp_conversion, get_hls_url, start_hls_server,
    start_udp_video_server, stop_udp_video_server, get_udp_video_server_stats,
    get_media_server_ports
};

// 导出视频处理命令
pub use video_processing::{
    process_video_frame, quick_validate_jpeg_base64, get_vehicle_video_stats, 
    get_all_video_stats, clear_vehicle_video_stats, cleanup_stale_video_stats,
    get_video_processing_summary, batch_process_video_frames, reset_all_video_stats,
};

// 协议处理命令
pub use protocol_processing::{
    parse_protocol, validate_protocol, batch_process_protocols, build_protocol,
    get_protocol_stats, reset_protocol_stats, configure_batch_processor,
    get_supported_message_types, quick_validate_protocol_format,
};