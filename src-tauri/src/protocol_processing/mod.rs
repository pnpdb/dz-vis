//! 协议处理模块
//! 
//! 提供高性能的二进制协议解析功能，包括：
//! - 车辆信息协议解析
//! - 控制指令协议构建
//! - 零拷贝数据转换
//! - 批量协议处理
//! - 协议验证和校验

pub mod types;
pub mod parser;
pub mod builder;
pub mod validator;
pub mod converter;
pub mod batch_processor;
pub mod message_types_config;

pub use types::*;
pub use parser::ProtocolParser;
pub use builder::ProtocolBuilder;
pub use validator::ProtocolValidator;
pub use converter::DataConverter;
pub use batch_processor::BatchProcessor;
