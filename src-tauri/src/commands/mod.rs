// 命令模块入口文件
// 按功能分组导出所有 Tauri 命令

pub mod system;
pub mod vehicle;
pub mod sandbox;
pub mod media;
pub mod settings;
pub mod utils;

// 重新导出所有命令供 lib.rs 使用
pub use system::*;
pub use vehicle::*;
pub use sandbox::*;
pub use media::*;
pub use settings::*;
pub use utils::*;
