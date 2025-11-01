use crate::gstreamer_streamer::{get_global_streamer, init_global_streamer};

/// 启动 GStreamer MJPEG 流
#[tauri::command]
pub async fn start_gstreamer_stream(camera_id: u32, rtsp_url: String) -> Result<(), String> {
    log::info!(
        "收到启动 GStreamer 流请求: camera_id={}, rtsp_url={}",
        camera_id,
        rtsp_url
    );

    // 确保全局流管理器已初始化
    if let Err(e) = init_global_streamer().await {
        let error_msg = format!("初始化 GStreamer 失败: {}", e);
        log::error!("{}", error_msg);
        return Err(error_msg);
    }

    // 获取流管理器并启动流
    let streamer_arc = get_global_streamer()
        .await
        .map_err(|e| format!("获取流管理器失败: {}", e))?;

    let streamer_guard = streamer_arc.read().await;
    let streamer = streamer_guard
        .as_ref()
        .ok_or_else(|| "流管理器未初始化".to_string())?;

    streamer
        .start_stream(camera_id, rtsp_url)
        .await
        .map_err(|e| format!("启动流失败: {}", e))?;

    log::info!("GStreamer 流启动成功: camera_id={}", camera_id);
    Ok(())
}

/// 停止 GStreamer 流
#[tauri::command]
pub async fn stop_gstreamer_stream(camera_id: u32) -> Result<(), String> {
    log::info!("收到停止 GStreamer 流请求: camera_id={}", camera_id);

    let streamer_arc = get_global_streamer()
        .await
        .map_err(|e| format!("获取流管理器失败: {}", e))?;

    let streamer_guard = streamer_arc.read().await;
    if let Some(streamer) = streamer_guard.as_ref() {
        streamer.stop_stream(camera_id).await;
        log::info!("GStreamer 流已停止: camera_id={}", camera_id);
    }

    Ok(())
}

/// 检查 GStreamer 流是否活跃
#[tauri::command]
pub async fn is_gstreamer_stream_active(camera_id: u32) -> Result<bool, String> {
    let streamer_arc = get_global_streamer()
        .await
        .map_err(|e| format!("获取流管理器失败: {}", e))?;

    let streamer_guard = streamer_arc.read().await;
    if let Some(streamer) = streamer_guard.as_ref() {
        Ok(streamer.is_stream_active(camera_id).await)
    } else {
        Ok(false)
    }
}

/// 获取 MJPEG WebSocket URL
#[tauri::command]
pub fn get_mjpeg_websocket_url(camera_id: u32) -> String {
    format!("ws://127.0.0.1:9004/mjpeg/{}", camera_id)
}

/// 获取活跃的 GStreamer 流列表
#[tauri::command]
pub async fn get_active_gstreamer_streams() -> Result<Vec<u32>, String> {
    let streamer_arc = get_global_streamer()
        .await
        .map_err(|e| format!("获取流管理器失败: {}", e))?;

    let streamer_guard = streamer_arc.read().await;
    if let Some(streamer) = streamer_guard.as_ref() {
        Ok(streamer.get_active_streams().await)
    } else {
        Ok(Vec::new())
    }
}

