use std::sync::Arc;
use tauri::State;
use log::{info, error};
use serde::{Serialize, Deserialize};

use crate::services::path_loader::PathLoader;

/// 路径点（带偏移后的坐标）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathPointWithOffset {
    pub x: f64,
    pub y: f64,
}

/// 路径数据响应
#[derive(Debug, Serialize, Deserialize)]
pub struct PathDataResponse {
    pub success: bool,
    pub points: Vec<PathPointWithOffset>,
    pub point_count: usize,
    pub message: Option<String>,
}

/// 获取合并的路径数据（应用偏移量）
/// 
/// # 参数
/// - `path_ids`: 路径文件编号列表
/// - `offset_x`: X轴偏移量（米）
/// - `offset_y`: Y轴偏移量（米）
/// 
/// # 返回
/// 应用偏移量后的路径点列表
#[tauri::command]
pub async fn get_merged_path_data(
    path_ids: Vec<u8>,
    offset_x: f64,
    offset_y: f64,
    path_loader: State<'_, Arc<PathLoader>>,
) -> Result<PathDataResponse, String> {
    info!(
        "获取合并路径数据 - 路径编号: {:?}, 偏移量: ({}, {})",
        path_ids, offset_x, offset_y
    );

    // 从路径加载器获取合并的路径数据
    let points = path_loader.get_merged_paths(&path_ids)?;

    // 应用偏移量
    let points_with_offset: Vec<PathPointWithOffset> = points
        .iter()
        .map(|point| PathPointWithOffset {
            x: point.x + offset_x,
            y: point.y + offset_y,
        })
        .collect();

    let point_count = points_with_offset.len();

    info!(
        "✅ 成功获取合并路径数据 - {} 个点（应用偏移后）",
        point_count
    );

    Ok(PathDataResponse {
        success: true,
        points: points_with_offset,
        point_count,
        message: Some(format!("成功获取 {} 个路径点", point_count)),
    })
}

/// 获取已加载的路径文件信息
#[tauri::command]
pub async fn get_loaded_paths_info(
    path_loader: State<'_, Arc<PathLoader>>,
) -> Result<serde_json::Value, String> {
    let loaded_count = path_loader.get_loaded_count();
    let loaded_ids = path_loader.get_loaded_path_ids();

    info!("查询已加载路径信息 - {} 个路径文件", loaded_count);

    Ok(serde_json::json!({
        "success": true,
        "loaded_count": loaded_count,
        "path_ids": loaded_ids,
    }))
}

/// 重新加载所有路径文件
#[tauri::command]
pub async fn reload_all_paths(
    path_loader: State<'_, Arc<PathLoader>>,
) -> Result<String, String> {
    info!("重新加载所有路径文件...");

    match path_loader.preload_all_paths() {
        Ok(count) => {
            let message = format!("成功重新加载 {} 个路径文件", count);
            info!("✅ {}", message);
            Ok(message)
        }
        Err(e) => {
            error!("❌ 重新加载路径文件失败: {}", e);
            Err(e)
        }
    }
}

