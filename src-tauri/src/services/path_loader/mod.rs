use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use log::{info, warn, error};
use serde::{Serialize, Deserialize};

/// 路径点坐标（车辆坐标系）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathPoint {
    pub x: f64,  // X坐标（米）
    pub y: f64,  // Y坐标（米）
}

/// 路径数据（单个路径文件的所有点）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathData {
    pub path_id: u8,           // 路径文件编号
    pub points: Vec<PathPoint>, // 路径点列表
}

/// 全局路径加载器（单例）
pub struct PathLoader {
    /// 路径数据缓存: path_id -> PathData
    paths: RwLock<HashMap<u8, PathData>>,
    /// 路径文件目录
    routes_dir: PathBuf,
}

impl PathLoader {
    /// 创建新的路径加载器
    pub fn new(routes_dir: PathBuf) -> Arc<Self> {
        Arc::new(Self {
            paths: RwLock::new(HashMap::new()),
            routes_dir,
        })
    }

    /// 预加载所有路径文件到内存
    pub fn preload_all_paths(&self) -> Result<usize, String> {
        info!("🚀 开始预加载路径文件...");

        if !self.routes_dir.exists() {
            error!("路径目录不存在: {:?}", self.routes_dir);
            return Err(format!("路径目录不存在: {:?}", self.routes_dir));
        }

        let entries = fs::read_dir(&self.routes_dir)
            .map_err(|e| format!("读取路径目录失败: {}", e))?;

        let mut loaded_count = 0;
        let mut paths_map = HashMap::new();

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => {
                    warn!("跳过无效的目录项: {}", e);
                    continue;
                }
            };

            let path = entry.path();
            
            // 只处理 .txt 文件
            if !path.is_file() || path.extension().and_then(|s| s.to_str()) != Some("txt") {
                continue;
            }

            // 从文件名提取路径编号
            let file_name = match path.file_stem().and_then(|s| s.to_str()) {
                Some(name) => name,
                None => {
                    warn!("跳过无效的文件名: {:?}", path);
                    continue;
                }
            };

            let path_id: u8 = match file_name.parse() {
                Ok(id) => id,
                Err(_) => {
                    warn!("跳过无法解析的路径编号: {}", file_name);
                    continue;
                }
            };

            // 读取并解析路径文件
            match self.load_path_file(&path, path_id) {
                Ok(path_data) => {
                    info!(
                        "✅ 加载路径文件 {} - {} 个点",
                        path_id,
                        path_data.points.len()
                    );
                    paths_map.insert(path_id, path_data);
                    loaded_count += 1;
                }
                Err(e) => {
                    warn!("加载路径文件 {} 失败: {}", path_id, e);
                }
            }
        }

        // 更新缓存
        {
            let mut paths = self.paths.write().unwrap();
            *paths = paths_map;
        }

        info!("✅ 路径文件预加载完成: {} 个文件", loaded_count);
        Ok(loaded_count)
    }

    /// 加载单个路径文件
    fn load_path_file(&self, path: &PathBuf, path_id: u8) -> Result<PathData, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("读取文件失败: {}", e))?;

        let mut points = Vec::new();

        for (line_num, line) in content.lines().enumerate() {
            let line = line.trim();
            
            // 跳过空行
            if line.is_empty() {
                continue;
            }

            // 按逗号分隔
            let parts: Vec<&str> = line.split(',').collect();

            // 至少需要前两个字段（X和Y坐标）
            if parts.len() < 2 {
                warn!(
                    "路径文件 {} 第 {} 行数据不足: {}",
                    path_id,
                    line_num + 1,
                    line
                );
                continue;
            }

            // 解析X和Y坐标
            let x: f64 = match parts[0].trim().parse() {
                Ok(v) => v,
                Err(_) => {
                    warn!(
                        "路径文件 {} 第 {} 行X坐标解析失败: {}",
                        path_id,
                        line_num + 1,
                        parts[0]
                    );
                    continue;
                }
            };

            let y: f64 = match parts[1].trim().parse() {
                Ok(v) => v,
                Err(_) => {
                    warn!(
                        "路径文件 {} 第 {} 行Y坐标解析失败: {}",
                        path_id,
                        line_num + 1,
                        parts[1]
                    );
                    continue;
                }
            };

            points.push(PathPoint { x, y });
        }

        Ok(PathData { path_id, points })
    }

    /// 获取指定路径的数据
    pub fn get_path(&self, path_id: u8) -> Option<PathData> {
        let paths = self.paths.read().unwrap();
        paths.get(&path_id).cloned()
    }

    /// 获取多个路径的数据（按顺序合并）
    pub fn get_merged_paths(&self, path_ids: &[u8]) -> Result<Vec<PathPoint>, String> {
        let paths = self.paths.read().unwrap();
        let mut merged_points = Vec::new();

        for &path_id in path_ids {
            match paths.get(&path_id) {
                Some(path_data) => {
                    merged_points.extend_from_slice(&path_data.points);
                }
                None => {
                    warn!("路径文件 {} 不存在", path_id);
                    // 继续处理其他路径，不中断
                }
            }
        }

        if merged_points.is_empty() {
            return Err("所有路径文件都不存在或为空".to_string());
        }

        Ok(merged_points)
    }

    /// 获取已加载的路径数量
    pub fn get_loaded_count(&self) -> usize {
        let paths = self.paths.read().unwrap();
        paths.len()
    }

    /// 获取所有已加载的路径ID
    pub fn get_loaded_path_ids(&self) -> Vec<u8> {
        let paths = self.paths.read().unwrap();
        let mut ids: Vec<u8> = paths.keys().copied().collect();
        ids.sort();
        ids
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use tempfile::TempDir;

    #[test]
    fn test_load_path_file() {
        // 创建临时目录
        let temp_dir = TempDir::new().unwrap();
        let routes_dir = temp_dir.path().to_path_buf();

        // 创建测试路径文件
        let test_file = routes_dir.join("1.txt");
        fs::write(
            &test_file,
            "2.3111,0.4029,0.0000\n2.3044,0.4029,0.0000\n2.2976,0.4029,0.0000\n",
        )
        .unwrap();

        let loader = PathLoader::new(routes_dir);
        let result = loader.load_path_file(&test_file, 1);

        assert!(result.is_ok());
        let path_data = result.unwrap();
        assert_eq!(path_data.path_id, 1);
        assert_eq!(path_data.points.len(), 3);
        assert!((path_data.points[0].x - 2.3111).abs() < 0.0001);
        assert!((path_data.points[0].y - 0.4029).abs() < 0.0001);
    }

    #[test]
    fn test_preload_all_paths() {
        // 创建临时目录
        let temp_dir = TempDir::new().unwrap();
        let routes_dir = temp_dir.path().to_path_buf();

        // 创建多个测试路径文件
        fs::write(routes_dir.join("1.txt"), "1.0,2.0\n3.0,4.0\n").unwrap();
        fs::write(routes_dir.join("2.txt"), "5.0,6.0\n7.0,8.0\n").unwrap();
        fs::write(routes_dir.join("3.txt"), "9.0,10.0\n").unwrap();

        let loader = PathLoader::new(routes_dir);
        let result = loader.preload_all_paths();

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 3);
        assert_eq!(loader.get_loaded_count(), 3);

        // 验证可以获取路径数据
        let path1 = loader.get_path(1);
        assert!(path1.is_some());
        assert_eq!(path1.unwrap().points.len(), 2);
    }

    #[test]
    fn test_get_merged_paths() {
        let temp_dir = TempDir::new().unwrap();
        let routes_dir = temp_dir.path().to_path_buf();

        fs::write(routes_dir.join("1.txt"), "1.0,2.0\n").unwrap();
        fs::write(routes_dir.join("2.txt"), "3.0,4.0\n").unwrap();
        fs::write(routes_dir.join("3.txt"), "5.0,6.0\n").unwrap();

        let loader = PathLoader::new(routes_dir);
        loader.preload_all_paths().unwrap();

        let merged = loader.get_merged_paths(&[1, 2, 3]);
        assert!(merged.is_ok());
        
        let points = merged.unwrap();
        assert_eq!(points.len(), 3);
        assert!((points[0].x - 1.0).abs() < 0.0001);
        assert!((points[1].x - 3.0).abs() < 0.0001);
        assert!((points[2].x - 5.0).abs() < 0.0001);
    }
}

