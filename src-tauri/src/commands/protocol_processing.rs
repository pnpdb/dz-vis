//! 协议处理相关的 Tauri 命令
//! 
//! 为前端提供高性能的协议处理接口

use crate::protocol_processing::{
    BatchProcessor, ProtocolParser, ProtocolValidator, DataConverter,
    ParsedProtocolData, ProtocolParsingResult, BatchProcessingResult, MessageTypes,
    VehicleControlCommand, TaxiOrderData, AvpParkingData, AvpPickupData, 
    DataRecordingData, ConstructionMarkerData
};
use crate::protocol_processing::batch_processor::{BatchTask, TaskPriority};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::State;
use base64::{Engine, engine::general_purpose};

/// 全局协议处理器状态
pub struct ProtocolProcessorState {
    /// 批处理器
    batch_processor: Arc<Mutex<BatchProcessor>>,
    /// 单个解析器（用于快速单次解析）
    parser: Arc<Mutex<ProtocolParser>>,
    /// 验证器
    validator: Arc<Mutex<ProtocolValidator>>,
    /// 数据转换器
    converter: Arc<Mutex<DataConverter>>,
    /// 任务计数器
    task_counter: Arc<Mutex<u64>>,
}

impl ProtocolProcessorState {
    pub fn new() -> Self {
        Self {
            batch_processor: Arc::new(Mutex::new(BatchProcessor::default())),
            parser: Arc::new(Mutex::new(ProtocolParser::new(false))),
            validator: Arc::new(Mutex::new(ProtocolValidator::default())),
            converter: Arc::new(Mutex::new(DataConverter::new())),
            task_counter: Arc::new(Mutex::new(0)),
        }
    }
    
    fn next_task_id(&self) -> u64 {
        let mut counter = self.task_counter.lock().unwrap();
        *counter += 1;
        *counter
    }
}

/// 前端协议解析请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolParseRequest {
    /// 消息类型（16进制字符串，如 "0x0001"）
    pub message_type: String,
    /// 二进制数据（Base64编码）
    pub data: String,
}

/// 前端批处理请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessRequest {
    /// 任务列表
    pub tasks: Vec<FrontendBatchTask>,
    /// 处理模式
    pub mode: String, // "normal", "priority", "adaptive"
    /// 目标延迟（仅adaptive模式，微秒）
    pub target_latency_us: Option<u64>,
}

/// 前端批任务
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendBatchTask {
    /// 消息类型（16进制字符串）
    pub message_type: String,
    /// 二进制数据（Base64编码）
    pub data: String,
    /// 优先级
    pub priority: String, // "low", "normal", "high", "critical"
}

/// 协议构建请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolBuildRequest {
    /// 协议类型
    pub protocol_type: String,
    /// 协议数据（JSON格式）
    pub data: serde_json::Value,
}

/// 解析单个协议
#[tauri::command]
pub async fn parse_protocol(
    request: ProtocolParseRequest,
    state: State<'_, ProtocolProcessorState>,
) -> Result<ProtocolParsingResult, String> {
    // 解析消息类型
    let message_type = parse_message_type(&request.message_type)?;
    
    // 解码Base64数据
    let data = general_purpose::STANDARD.decode(&request.data)
        .map_err(|e| format!("Base64解码失败: {}", e))?;
    
    // 解析协议
    let mut parser = state.parser.lock().unwrap();
    let result = parser.parse_protocol(message_type, &data);
    
    Ok(result)
}

/// 验证协议数据
#[tauri::command]
pub async fn validate_protocol(
    parsed_data: ParsedProtocolData,
    state: State<'_, ProtocolProcessorState>,
) -> Result<bool, String> {
    let mut validator = state.validator.lock().unwrap();
    
    match validator.validate(&parsed_data) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false), // 返回false而不是错误，让前端决定如何处理
    }
}

/// 批量处理协议
#[tauri::command]
pub async fn batch_process_protocols(
    request: BatchProcessRequest,
    state: State<'_, ProtocolProcessorState>,
) -> Result<BatchProcessingResult, String> {
    // 转换前端任务到内部格式
    let mut tasks = Vec::new();
    
    for frontend_task in request.tasks {
        let message_type = parse_message_type(&frontend_task.message_type)?;
        let data = general_purpose::STANDARD.decode(&frontend_task.data)
            .map_err(|e| format!("Base64解码失败: {}", e))?;
        let priority = parse_priority(&frontend_task.priority)?;
        
        tasks.push(BatchTask {
            task_id: state.next_task_id(),
            message_type,
            data,
            priority,
        });
    }
    
    // 根据模式执行批处理
    let mut batch_processor = state.batch_processor.lock().unwrap();
    
    let result = match request.mode.as_str() {
        "priority" => batch_processor.priority_process(tasks),
        "adaptive" => {
            let target_latency = request.target_latency_us.unwrap_or(10000); // 默认10ms
            batch_processor.adaptive_process(tasks, target_latency)
        }
        _ => batch_processor.process_batch(tasks),
    };
    
    Ok(result)
}

/// 构建协议数据
#[tauri::command]
pub async fn build_protocol(
    request: ProtocolBuildRequest,
) -> Result<String, String> {
    let mut builder = crate::protocol_processing::ProtocolBuilder::new();
    
    let data = match request.protocol_type.as_str() {
        "vehicle_control" => {
            let cmd: VehicleControlCommand = serde_json::from_value(request.data)
                .map_err(|e| format!("解析车辆控制数据失败: {}", e))?;
            builder.build_vehicle_control(&cmd)
        }
        "taxi_order" => {
            let order: TaxiOrderData = serde_json::from_value(request.data)
                .map_err(|e| format!("解析出租车订单数据失败: {}", e))?;
            builder.build_taxi_order(&order)
        }
        "avp_parking" => {
            let parking: AvpParkingData = serde_json::from_value(request.data)
                .map_err(|e| format!("解析AVP泊车数据失败: {}", e))?;
            builder.build_avp_parking(&parking)
        }
        "avp_pickup" => {
            let pickup: AvpPickupData = serde_json::from_value(request.data)
                .map_err(|e| format!("解析AVP取车数据失败: {}", e))?;
            builder.build_avp_pickup(&pickup)
        }
        "data_recording" => {
            let recording: DataRecordingData = serde_json::from_value(request.data)
                .map_err(|e| format!("解析数据记录数据失败: {}", e))?;
            builder.build_data_recording(&recording)
        }
        "construction_marker" => {
            let marker: ConstructionMarkerData = serde_json::from_value(request.data)
                .map_err(|e| format!("解析施工标记数据失败: {}", e))?;
            builder.build_construction_marker(&marker)
        }
        _ => return Err(format!("不支持的协议类型: {}", request.protocol_type)),
    };
    
    // 返回Base64编码的数据
    Ok(general_purpose::STANDARD.encode(&data))
}

/// 获取协议处理统计信息
#[tauri::command]
pub async fn get_protocol_stats(
    state: State<'_, ProtocolProcessorState>,
) -> Result<serde_json::Value, String> {
    let batch_processor = state.batch_processor.lock().unwrap();
    let parser = state.parser.lock().unwrap();
    let validator = state.validator.lock().unwrap();
    let converter = state.converter.lock().unwrap();
    
    let batch_stats = batch_processor.get_stats();
    let parser_stats = parser.get_stats();
    let validator_stats = validator.get_stats();
    let converter_stats = converter.get_stats();
    
    let combined_stats = serde_json::json!({
        "batch_processing": {
            "total_tasks": batch_stats.total_tasks,
            "successful_tasks": batch_stats.successful_tasks,
            "failed_tasks": batch_stats.failed_tasks,
            "average_time_us": batch_stats.average_time_us,
            "throughput": batch_stats.throughput,
            "parallel_efficiency": batch_stats.parallel_efficiency,
        },
        "parsing": {
            "total_time_us": parser_stats.total_time_us,
            "bytes_processed": parser_stats.bytes_processed,
        },
        "validation": {
            "success_count": validator_stats.success_count,
            "failure_count": validator_stats.failure_count,
            "success_rate": validator.get_success_rate(),
            "average_time_us": validator_stats.average_time_us,
        },
        "conversion": {
            "zero_copy_conversions": converter_stats.zero_copy_conversions,
            "memory_copy_conversions": converter_stats.memory_copy_conversions,
            "zero_copy_efficiency": converter.get_zero_copy_efficiency(),
            "saved_bytes": converter_stats.saved_bytes,
        }
    });
    
    Ok(combined_stats)
}

/// 重置协议处理统计
#[tauri::command]
pub async fn reset_protocol_stats(
    state: State<'_, ProtocolProcessorState>,
) -> Result<(), String> {
    let mut batch_processor = state.batch_processor.lock().unwrap();
    let mut parser = state.parser.lock().unwrap();
    let mut validator = state.validator.lock().unwrap();
    let mut converter = state.converter.lock().unwrap();
    
    batch_processor.reset_stats();
    parser.reset_stats();
    validator.reset_stats();
    converter.reset_stats();
    
    // 重置任务计数器
    let mut counter = state.task_counter.lock().unwrap();
    *counter = 0;
    
    Ok(())
}

/// 调整批处理器工作线程数量
#[tauri::command]
pub async fn configure_batch_processor(
    worker_count: usize,
    state: State<'_, ProtocolProcessorState>,
) -> Result<(), String> {
    if worker_count == 0 || worker_count > 32 {
        return Err("工作线程数量必须在1-32之间".to_string());
    }
    
    let mut batch_processor = state.batch_processor.lock().unwrap();
    batch_processor.resize_worker_pool(worker_count);
    
    Ok(())
}

/// 获取支持的消息类型
#[tauri::command]
pub async fn get_supported_message_types() -> Result<Vec<serde_json::Value>, String> {
    let types = vec![
        serde_json::json!({
            "type": "0x0001",
            "name": "车辆信息",
            "description": "包含车辆位置、速度、电量等信息"
        }),
        serde_json::json!({
            "type": "0x0002",
            "name": "车辆控制",
            "description": "车辆启动、停止、初始化位姿等控制指令"
        }),
        serde_json::json!({
            "type": "0x0003",
            "name": "出租车订单",
            "description": "出租车起点终点订单信息"
        }),
        serde_json::json!({
            "type": "0x0004",
            "name": "AVP泊车",
            "description": "自动代客泊车指令"
        }),
        serde_json::json!({
            "type": "0x0005",
            "name": "AVP取车",
            "description": "自动代客取车指令"
        }),
        serde_json::json!({
            "type": "0x0006",
            "name": "数据记录",
            "description": "数据记录控制指令"
        }),
        serde_json::json!({
            "type": "0x0007",
            "name": "施工标记",
            "description": "施工区域标记指令"
        }),
    ];
    
    Ok(types)
}

/// 快速验证协议格式
#[tauri::command]
pub async fn quick_validate_protocol_format(
    message_type: String,
    data: String,
) -> Result<serde_json::Value, String> {
    // 解析消息类型
    let msg_type = parse_message_type(&message_type)?;
    
    // 解码Base64数据
    let decoded_data = general_purpose::STANDARD.decode(&data)
        .map_err(|e| format!("Base64解码失败: {}", e))?;
    
    // 快速格式验证
    let validation_result = match msg_type {
        MessageTypes::VEHICLE_INFO => {
            validate_vehicle_info_format(&decoded_data)
        }
        MessageTypes::VEHICLE_CONTROL => {
            validate_vehicle_control_format(&decoded_data)
        }
        MessageTypes::TAXI_ORDER => {
            validate_taxi_order_format(&decoded_data)
        }
        MessageTypes::AVP_PARKING => {
            validate_avp_parking_format(&decoded_data)
        }
        MessageTypes::AVP_PICKUP => {
            validate_avp_pickup_format(&decoded_data)
        }
        MessageTypes::DATA_RECORDING => {
            validate_data_recording_format(&decoded_data)
        }
        MessageTypes::CONSTRUCTION_MARKER => {
            validate_construction_marker_format(&decoded_data)
        }
        _ => {
            serde_json::json!({
                "valid": false,
                "error": "不支持的消息类型",
                "expected_size": 0,
                "actual_size": decoded_data.len()
            })
        }
    };
    
    Ok(validation_result)
}

// 辅助函数

/// 解析消息类型字符串
fn parse_message_type(message_type: &str) -> Result<u16, String> {
    let type_str = message_type.trim_start_matches("0x").trim_start_matches("0X");
    u16::from_str_radix(type_str, 16)
        .map_err(|e| format!("无效的消息类型格式: {}", e))
}

/// 解析优先级字符串
fn parse_priority(priority: &str) -> Result<TaskPriority, String> {
    match priority.to_lowercase().as_str() {
        "low" => Ok(TaskPriority::Low),
        "normal" => Ok(TaskPriority::Normal),
        "high" => Ok(TaskPriority::High),
        "critical" => Ok(TaskPriority::Critical),
        _ => Err(format!("无效的优先级: {}", priority)),
    }
}

// 格式验证函数

fn validate_vehicle_info_format(data: &[u8]) -> serde_json::Value {
    use crate::protocol_processing::types::ProtocolConstants;
    
    let expected_size = ProtocolConstants::VEHICLE_INFO_TOTAL_SIZE;
    let actual_size = data.len();
    
    serde_json::json!({
        "valid": actual_size >= expected_size,
        "message_type_name": "车辆信息",
        "expected_size": expected_size,
        "actual_size": actual_size,
        "error": if actual_size < expected_size {
            Some(format!("数据长度不足，需要{}字节，实际{}字节", expected_size, actual_size))
        } else {
            None
        }
    })
}

fn validate_vehicle_control_format(data: &[u8]) -> serde_json::Value {
    use crate::protocol_processing::types::ProtocolConstants;
    
    let min_size = ProtocolConstants::VEHICLE_CONTROL_BASE_SIZE;
    let max_size = ProtocolConstants::VEHICLE_CONTROL_TOTAL_SIZE_WITH_POSITION;
    let actual_size = data.len();
    
    let valid = actual_size >= min_size;
    let has_position_data = actual_size >= max_size;
    
    serde_json::json!({
        "valid": valid,
        "message_type_name": "车辆控制",
        "min_size": min_size,
        "max_size": max_size,
        "actual_size": actual_size,
        "has_position_data": has_position_data,
        "error": if !valid {
            Some(format!("数据长度不足，至少需要{}字节，实际{}字节", min_size, actual_size))
        } else {
            None
        }
    })
}

fn validate_taxi_order_format(data: &[u8]) -> serde_json::Value {
    use crate::protocol_processing::types::ProtocolConstants;
    
    let expected_size = ProtocolConstants::TAXI_ORDER_TOTAL_SIZE;
    let actual_size = data.len();
    
    serde_json::json!({
        "valid": actual_size >= expected_size,
        "message_type_name": "出租车订单",
        "expected_size": expected_size,
        "actual_size": actual_size,
        "error": if actual_size < expected_size {
            Some(format!("数据长度不足，需要{}字节，实际{}字节", expected_size, actual_size))
        } else {
            None
        }
    })
}

fn validate_avp_parking_format(data: &[u8]) -> serde_json::Value {
    use crate::protocol_processing::types::ProtocolConstants;
    
    let expected_size = ProtocolConstants::AVP_PARKING_TOTAL_SIZE;
    let actual_size = data.len();
    
    serde_json::json!({
        "valid": actual_size >= expected_size,
        "message_type_name": "AVP泊车",
        "expected_size": expected_size,
        "actual_size": actual_size,
        "error": if actual_size < expected_size {
            Some(format!("数据长度不足，需要{}字节，实际{}字节", expected_size, actual_size))
        } else {
            None
        }
    })
}

fn validate_avp_pickup_format(data: &[u8]) -> serde_json::Value {
    use crate::protocol_processing::types::ProtocolConstants;
    
    let expected_size = ProtocolConstants::AVP_PICKUP_TOTAL_SIZE;
    let actual_size = data.len();
    
    serde_json::json!({
        "valid": actual_size >= expected_size,
        "message_type_name": "AVP取车",
        "expected_size": expected_size,
        "actual_size": actual_size,
        "error": if actual_size < expected_size {
            Some(format!("数据长度不足，需要{}字节，实际{}字节", expected_size, actual_size))
        } else {
            None
        }
    })
}

fn validate_data_recording_format(data: &[u8]) -> serde_json::Value {
    use crate::protocol_processing::types::ProtocolConstants;
    
    let expected_size = ProtocolConstants::DATA_RECORDING_TOTAL_SIZE;
    let actual_size = data.len();
    
    serde_json::json!({
        "valid": actual_size >= expected_size,
        "message_type_name": "数据记录",
        "expected_size": expected_size,
        "actual_size": actual_size,
        "error": if actual_size < expected_size {
            Some(format!("数据长度不足，需要{}字节，实际{}字节", expected_size, actual_size))
        } else {
            None
        }
    })
}

fn validate_construction_marker_format(data: &[u8]) -> serde_json::Value {
    use crate::protocol_processing::types::ProtocolConstants;
    
    let expected_size = ProtocolConstants::CONSTRUCTION_MARKER_TOTAL_SIZE;
    let actual_size = data.len();
    
    serde_json::json!({
        "valid": actual_size >= expected_size,
        "message_type_name": "施工标记",
        "expected_size": expected_size,
        "actual_size": actual_size,
        "error": if actual_size < expected_size {
            Some(format!("数据长度不足，需要{}字节，实际{}字节", expected_size, actual_size))
        } else {
            None
        }
    })
}
