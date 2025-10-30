use crate::mediamtx_manager::MediaMTXManager;
use log::{error, info};
use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::State;

/// FFmpeg 推流进程管理器
static FFMPEG_PROCESSES: once_cell::sync::Lazy<Arc<Mutex<HashMap<i64, Child>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

/// 启动 RTSP/RTMP 到 MediaMTX 的推流
/// 
/// 使用 FFmpeg 将 RTSP/RTMP 源推流到 MediaMTX 的 RTMP 端口
#[tauri::command]
pub async fn start_mediamtx_stream(camera_id: i64, rtsp_url: String) -> Result<String, String> {
    info!("📡 启动 MediaMTX 推流: camera_id={}, url={}", camera_id, rtsp_url);
    
    // 停止之前的推流（如果存在）
    stop_mediamtx_stream(camera_id).await?;
    
    // 流名称
    let stream_name = format!("camera_{}", camera_id);
    let mediamtx_rtmp_url = format!("rtmp://127.0.0.1:1935/{}", stream_name);
    
    info!("🎬 FFmpeg 推流: {} -> {}", rtsp_url, mediamtx_rtmp_url);
    
    // 根据源类型选择 FFmpeg 参数
    let mut args = vec![
        "-loglevel", "info",             // 输出更多日志以便调试
        "-timeout", "5000000",           // 5秒连接超时 (微秒)
        // 注意：某些 FFmpeg 版本不支持 -stimeout，已移除
    ];
    
    // RTSP 源使用 TCP 传输
    if rtsp_url.starts_with("rtsp://") {
        args.extend_from_slice(&[
            "-rtsp_transport", "tcp",
            "-max_delay", "500000",      // 最大延迟 500ms
        ]);
    }
    
    args.extend_from_slice(&[
        "-i", &rtsp_url,
        "-c", "copy",                    // 直接复制，不重新编码
        "-fflags", "nobuffer",           // 禁用缓冲以降低延迟
        "-flags", "low_delay",           // 低延迟标志
        "-f", "flv",                     // 输出为 FLV 格式（RTMP）
        &mediamtx_rtmp_url
    ]);
    
    // 启动 FFmpeg 推流
    match Command::new("ffmpeg")
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(mut child) => {
            let pid = child.id();
            info!("✅ FFmpeg 推流已启动: PID={}", pid);
            
            // 捕获 stderr 输出以便调试
            if let Some(stderr) = child.stderr.take() {
                use std::io::{BufRead, BufReader};
                let camera_id_clone = camera_id;
                
                tokio::spawn(async move {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            // 记录所有重要信息
                            let line_lower = line.to_lowercase();
                            
                            if line_lower.contains("error") || line_lower.contains("failed") || 
                               line_lower.contains("invalid") || line_lower.contains("timeout") {
                                log::error!("FFmpeg[{}] 错误: {}", camera_id_clone, line);
                            } else if line_lower.contains("opening") || line_lower.contains("connection") {
                                log::info!("FFmpeg[{}] 连接: {}", camera_id_clone, line);
                            } else if line.contains("Input #") || line.contains("Output #") ||
                                      line.contains("Stream #") {
                                log::info!("FFmpeg[{}] 流信息: {}", camera_id_clone, line);
                            } else if line_lower.contains("speed=") {
                                // 每隔几行记录一次进度，避免日志过多
                                // speed= 行表示正在处理
                                // 我们只记录第一次出现
                            }
                        }
                    }
                });
            }
            
            // 保存进程
            let mut processes = FFMPEG_PROCESSES.lock().unwrap();
            processes.insert(camera_id, child);
            
            // 返回 WebRTC WHEP URL
            let whep_url = MediaMTXManager::get_webrtc_url(&stream_name);
            Ok(whep_url)
        }
        Err(e) => {
            error!("❌ 启动 FFmpeg 推流失败: {}", e);
            Err(format!("启动推流失败: {}", e))
        }
    }
}

/// 停止 MediaMTX 推流
#[tauri::command]
pub async fn stop_mediamtx_stream(camera_id: i64) -> Result<(), String> {
    info!("🛑 停止 MediaMTX 推流: camera_id={}", camera_id);
    
    let mut processes = FFMPEG_PROCESSES.lock().unwrap();
    
    if let Some(mut child) = processes.remove(&camera_id) {
        match child.kill() {
            Ok(_) => {
                info!("✅ FFmpeg 推流已停止: camera_id={}", camera_id);
                let _ = child.wait(); // 等待进程退出，忽略错误
            }
            Err(e) => {
                error!("❌ 停止 FFmpeg 推流失败: camera_id={}, error={}", camera_id, e);
                return Err(format!("停止推流失败: {}", e));
            }
        }
    }
    
    Ok(())
}

/// 获取 WebRTC 播放 URL
/// 
/// 前端调用此命令获取指定流的 WebRTC WHEP 端点
#[tauri::command]
pub fn get_mediamtx_webrtc_url(stream_name: String) -> String {
    info!("📡 获取 WebRTC URL: {}", stream_name);
    MediaMTXManager::get_webrtc_url(&stream_name)
}

/// 检查 MediaMTX 是否正在运行
#[tauri::command]
pub fn is_mediamtx_running(manager: State<MediaMTXManager>) -> bool {
    manager.is_running()
}

/// 检查特定摄像头的 FFmpeg 推流是否在运行
#[tauri::command]
pub fn is_ffmpeg_stream_active(camera_id: i64) -> bool {
    let processes = FFMPEG_PROCESSES.lock().unwrap();
    processes.contains_key(&camera_id)
}

/// 检查 MediaMTX 流是否已就绪
/// 
/// 通过 MediaMTX API 查询流状态，验证流是否真正存在且可播放
/// 
/// # 参数
/// - `stream_name`: 流名称（例如：camera_3）
/// 
/// # 返回
/// - `Ok(true)`: 流已就绪，可以播放
/// - `Ok(false)`: 流不存在或未就绪
/// - `Err(String)`: API 请求失败
#[tauri::command]
pub async fn check_mediamtx_stream_ready(stream_name: String) -> Result<bool, String> {
    // MediaMTX API v3 端点
    let api_url = format!("http://127.0.0.1:9997/v3/paths/get/{}", stream_name);
    
    log::debug!("🔍 检查 MediaMTX 流状态: {}", stream_name);
    
    match reqwest::get(&api_url).await {
        Ok(response) => {
            let status = response.status();
            log::debug!("   API 响应状态: {}", status);
            
            if status.is_success() {
                // 解析 JSON 响应
                match response.json::<serde_json::Value>().await {
                    Ok(json) => {
                        log::debug!("   API 响应内容: {}", json);
                        
                        // 检查路径是否存在且有源
                        // MediaMTX v3 API 返回的结构：
                        // {
                        //   "name": "camera_3",
                        //   "source": { "type": "...", "ready": true },
                        //   "ready": true,
                        //   ...
                        // }
                        
                        // 方案 1: 检查顶级 ready 字段
                        if let Some(ready) = json.get("ready").and_then(|v| v.as_bool()) {
                            if ready {
                                log::info!("✅ 流已就绪: {} (ready=true)", stream_name);
                                return Ok(true);
                            }
                        }
                        
                        // 方案 2: 检查 source.ready 字段
                        if let Some(source) = json.get("source") {
                            if let Some(source_ready) = source.get("ready").and_then(|v| v.as_bool()) {
                                if source_ready {
                                    log::info!("✅ 流已就绪: {} (source.ready=true)", stream_name);
                                    return Ok(true);
                                }
                            }
                        }
                        
                        // 方案 3: 检查是否有 readers（有客户端在订阅）
                        if let Some(readers) = json.get("readers") {
                            if let Some(readers_count) = readers.as_u64() {
                                if readers_count > 0 {
                                    log::info!("✅ 流已就绪: {} (readers={})", stream_name, readers_count);
                                    return Ok(true);
                                }
                            } else if let Some(readers_array) = readers.as_array() {
                                if !readers_array.is_empty() {
                                    log::info!("✅ 流已就绪: {} (readers={})", stream_name, readers_array.len());
                                    return Ok(true);
                                }
                            }
                        }
                        
                        // 流存在但未就绪
                        log::debug!("⏳ 流存在但未就绪: {}", stream_name);
                        Ok(false)
                    }
                    Err(e) => {
                        log::warn!("⚠️ 解析 MediaMTX API 响应失败: {}", e);
                        Ok(false)
                    }
                }
            } else if status.as_u16() == 404 {
                // 流不存在
                log::debug!("❌ 流不存在: {} (404)", stream_name);
                Ok(false)
            } else {
                // 其他错误状态
                log::warn!("⚠️ MediaMTX API 返回错误状态: {}", status);
                Ok(false)
            }
        }
        Err(e) => {
            // 网络错误或 MediaMTX 未启动
            log::error!("❌ 无法连接到 MediaMTX API: {}", e);
            Err(format!("MediaMTX API 连接失败: {}", e))
        }
    }
}
