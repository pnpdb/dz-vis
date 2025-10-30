use crate::mse_streamer::get_mse_streamer;

/// 启动 MSE 流（RTSP → fMP4）
#[tauri::command]
pub async fn start_mse_stream(camera_id: u32, rtsp_url: String) -> Result<(), String> {
    log::info!("📡 启动 MSE 流: camera_id={}, rtsp_url={}", camera_id, rtsp_url);
    
    let streamer = get_mse_streamer();
    streamer
        .start_stream(camera_id, rtsp_url)
        .await
        .map_err(|e| format!("启动 MSE 流失败: {}", e))
}

/// 停止 MSE 流
#[tauri::command]
pub async fn stop_mse_stream(camera_id: u32) -> Result<(), String> {
    log::info!("🛑 停止 MSE 流: camera_id={}", camera_id);
    
    let streamer = get_mse_streamer();
    streamer.stop_stream(camera_id).await;
    Ok(())
}

/// 检查流是否活跃
#[tauri::command]
pub async fn is_mse_stream_active(camera_id: u32) -> Result<bool, String> {
    let streamer = get_mse_streamer();
    Ok(streamer.is_stream_active(camera_id).await)
}

