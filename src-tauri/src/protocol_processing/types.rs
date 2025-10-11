//! 协议处理相关的类型定义

use serde::{Deserialize, Serialize};

/// 车辆信息数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleInfo {
    /// 车辆ID
    pub vehicle_id: u8,
    /// 速度 (0.0-1.0)
    pub speed: f64,
    /// X坐标位置
    pub position_x: f64,
    /// Y坐标位置
    pub position_y: f64,
    /// 朝向角度
    pub orientation: f64,
    /// 电池电量 (0.0-100.0)
    pub battery: f64,
    /// 档位
    pub gear: GearPosition,
    /// 方向盘角度
    pub steering_angle: f64,
    /// 导航状态
    pub nav_status: u8,
    /// 传感器状态
    pub sensors: SensorStatus,
    /// 车位占用状态
    pub parking_slot: u8,
}

/// 档位定义
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum GearPosition {
    Park,
    Reverse,
    Neutral,
    DriveLevel(u8),
}

impl GearPosition {
    pub fn from_u8(value: u8) -> Self {
        match value {
            1 => GearPosition::Park,
            2 => GearPosition::Reverse,
            3 => GearPosition::Neutral,
            4 | 5 | 6 | 7 | 8 | 9 => GearPosition::DriveLevel(value.saturating_sub(3)),
            _ => GearPosition::DriveLevel(0),
        }
    }

    pub fn to_u8(self) -> u8 {
        match self {
            GearPosition::Park => 1,
            GearPosition::Reverse => 2,
            GearPosition::Neutral => 3,
            GearPosition::DriveLevel(level) => level.saturating_add(3),
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            GearPosition::Park => "P",
            GearPosition::Reverse => "R",
            GearPosition::Neutral => "N",
            GearPosition::DriveLevel(1) => "D1",
            GearPosition::DriveLevel(2) => "D2",
            GearPosition::DriveLevel(3) => "D3",
            GearPosition::DriveLevel(4) => "D4",
            GearPosition::DriveLevel(5) => "D5",
            GearPosition::DriveLevel(_) => "D",
        }
    }
}

/// 传感器状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorStatus {
    /// 摄像头状态
    pub camera: bool,
    /// 激光雷达状态
    pub lidar: bool,
    /// 陀螺仪状态
    pub gyro: bool,
}

/// 车辆控制指令
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleControlCommand {
    /// 车辆ID
    pub vehicle_id: u8,
    /// 控制指令类型
    pub command: ControlCommandType,
    /// 位置数据（仅初始化位姿时需要）
    pub position_data: Option<PositionData>,
}

/// 控制指令类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ControlCommandType {
    /// 启动
    Start,
    /// 停止
    Stop,
    /// 紧急制动
    EmergencyBrake,
    /// 初始化位姿
    InitPose,
}

impl ControlCommandType {
    pub fn to_u8(&self) -> u8 {
        match self {
            Self::Start => 1,
            Self::Stop => 2,
            Self::EmergencyBrake => 3,
            Self::InitPose => 4,
        }
    }
    
    pub fn from_u8(value: u8) -> Result<Self, ProtocolError> {
        match value {
            1 => Ok(Self::Start),
            2 => Ok(Self::Stop),
            3 => Ok(Self::EmergencyBrake),
            4 => Ok(Self::InitPose),
            _ => Err(ProtocolError::InvalidCommand(value)),
        }
    }
    
    pub fn name(&self) -> &'static str {
        match self {
            Self::Start => "启动",
            Self::Stop => "停止",
            Self::EmergencyBrake => "紧急制动",
            Self::InitPose => "初始化位姿",
        }
    }
}

/// 位置数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionData {
    /// X坐标
    pub x: f64,
    /// Y坐标
    pub y: f64,
    /// 朝向角度
    pub orientation: f64,
}

/// 协议解析结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolParsingResult {
    /// 是否解析成功
    pub success: bool,
    /// 解析的数据（如果成功）
    pub data: Option<ParsedProtocolData>,
    /// 错误信息（如果失败）
    pub error: Option<String>,
    /// 性能统计
    pub stats: ProtocolProcessingStats,
}

/// 解析后的协议数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ParsedProtocolData {
    /// 车辆信息
    VehicleInfo(VehicleInfo),
    /// 车辆控制指令
    VehicleControl(VehicleControlCommand),
    /// 出租车订单
    TaxiOrder(TaxiOrderData),
    /// AVP泊车
    AvpParking(AvpParkingData),
    /// AVP取车
    AvpPickup(AvpPickupData),
    /// 数据记录
    DataRecording(DataRecordingData),
    /// 施工标记
    ConstructionMarker(ConstructionMarkerData),
    /// 车辆功能设置
    VehicleFunctionSetting(VehicleFunctionSettingData),
    /// 车辆路径显示
    VehiclePathDisplay(VehiclePathDisplayData),
    /// 车辆摄像头开关
    VehicleCameraToggle(VehicleCameraToggleData),
    /// 沙盘灯光控制
    SandboxLighting(SandboxLightingData),
    /// 沙盘红绿灯状态
    SandboxTrafficLightStatus(SandboxTrafficLightStatusData),
}

/// 出租车订单数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxiOrderData {
    pub vehicle_id: u8,
    pub start_x: f64,
    pub start_y: f64,
    pub end_x: f64,
    pub end_y: f64,
}

/// AVP泊车数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvpParkingData {
    pub vehicle_id: u8,
    pub parking_spot: u8,
}

/// AVP取车数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvpPickupData {
    pub vehicle_id: u8,
}

/// 数据记录数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataRecordingData {
    pub vehicle_id: u8,
    pub action: u8,
}

/// 车辆功能设置数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleFunctionSettingData {
    pub vehicle_id: u8,
    pub function_id: u8,
    pub enable_status: u8,
}

/// 车辆路径显示数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehiclePathDisplayData {
    pub vehicle_id: u8,
    pub display_path: u8,
}

/// 车辆摄像头开关数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleCameraToggleData {
    pub vehicle_id: u8,
    pub enabled: u8,
}

/// 施工标记数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstructionMarkerData {
    pub marker_id: u8,
    pub action: u8,
    pub x: f64,
    pub y: f64,
}

/// 沙盘灯光控制数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxLightingData {
    pub ambient: u8,
    pub building: u8,
    pub street: u8,
}

/// 单个红绿灯状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxTrafficLightState {
    pub index: u8,
    pub color: u8,
    pub remaining: u8,
}

/// 沙盘红绿灯状态集合
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxTrafficLightStatusData {
    pub lights: Vec<SandboxTrafficLightState>,
}

/// 协议处理性能统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolProcessingStats {
    /// 解析时间（微秒）
    pub parsing_time_us: u64,
    /// 验证时间（微秒）
    pub validation_time_us: u64,
    /// 转换时间（微秒）
    pub conversion_time_us: u64,
    /// 总处理时间（微秒）
    pub total_time_us: u64,
    /// 处理的字节数
    pub bytes_processed: usize,
}

/// 批量处理结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessingResult {
    /// 成功处理的数量
    pub success_count: usize,
    /// 失败处理的数量
    pub error_count: usize,
    /// 总处理时间（微秒）
    pub total_time_us: u64,
    /// 平均处理时间（微秒）
    pub average_time_us: f64,
    /// 处理结果列表
    pub results: Vec<ProtocolParsingResult>,
}

pub fn nav_status_text(status: u8) -> &'static str {
    match status {
        1 => "正常行驶中（空载模式倒车入库）",
        2 => "正常行驶中（空载模式不倒车入库）",
        3 => "接客模式，去起点接客",
        4 => "接客模式，去终点送客",
        5 => "去往充电车位",
        6 => "充电中",
        7 => "去往定车位路上",
        8 => "车位停车中",
        9 => "到达接客起点",
        10 => "到达接客终点",
        11 => "正在倒车入库",
        12 => "正在出库中",
        13 => "正在倒车入库",
        14 => "出库完成",
        15 => "平行驾驶模式",
        _ => "未知状态",
    }
}

pub struct ProtocolConstants;

impl ProtocolConstants {
    /// 车辆信息协议偏移量
    pub const VEHICLE_INFO_VEHICLE_ID_OFFSET: usize = 0;
    pub const VEHICLE_INFO_SPEED_OFFSET: usize = 1;
    pub const VEHICLE_INFO_POSITION_X_OFFSET: usize = 9;
    pub const VEHICLE_INFO_POSITION_Y_OFFSET: usize = 17;
    pub const VEHICLE_INFO_ORIENTATION_OFFSET: usize = 25;
    pub const VEHICLE_INFO_BATTERY_OFFSET: usize = 33;
    pub const VEHICLE_INFO_GEAR_OFFSET: usize = 41;
    pub const VEHICLE_INFO_STEERING_ANGLE_OFFSET: usize = 42;
    pub const VEHICLE_INFO_NAV_STATUS_OFFSET: usize = 50;
    pub const VEHICLE_INFO_CAMERA_STATUS_OFFSET: usize = 51;
    pub const VEHICLE_INFO_LIDAR_STATUS_OFFSET: usize = 52;
    pub const VEHICLE_INFO_GYRO_STATUS_OFFSET: usize = 53;
    pub const VEHICLE_INFO_PARKING_SLOT_OFFSET: usize = 54;
    pub const VEHICLE_INFO_TOTAL_SIZE: usize = 55;
    
    /// 车辆控制协议偏移量
    pub const VEHICLE_CONTROL_VEHICLE_ID_OFFSET: usize = 0;
    pub const VEHICLE_CONTROL_COMMAND_OFFSET: usize = 1;
    pub const VEHICLE_CONTROL_POSITION_X_OFFSET: usize = 2;
    pub const VEHICLE_CONTROL_POSITION_Y_OFFSET: usize = 10;
    pub const VEHICLE_CONTROL_ORIENTATION_OFFSET: usize = 18;
    pub const VEHICLE_CONTROL_BASE_SIZE: usize = 2;
    pub const VEHICLE_CONTROL_POSITION_DATA_SIZE: usize = 24;
    pub const VEHICLE_CONTROL_TOTAL_SIZE_WITH_POSITION: usize = 26;
    
    /// 出租车订单协议偏移量
    pub const TAXI_ORDER_VEHICLE_ID_OFFSET: usize = 0;
    pub const TAXI_ORDER_START_X_OFFSET: usize = 1;
    pub const TAXI_ORDER_START_Y_OFFSET: usize = 9;
    pub const TAXI_ORDER_END_X_OFFSET: usize = 17;
    pub const TAXI_ORDER_END_Y_OFFSET: usize = 25;
    pub const TAXI_ORDER_TOTAL_SIZE: usize = 33;
    
    /// AVP泊车协议偏移量
    pub const AVP_PARKING_VEHICLE_ID_OFFSET: usize = 0;
    pub const AVP_PARKING_SPOT_OFFSET: usize = 1;
    pub const AVP_PARKING_TOTAL_SIZE: usize = 2;
    
    /// AVP取车协议偏移量
    pub const AVP_PICKUP_VEHICLE_ID_OFFSET: usize = 0;
    pub const AVP_PICKUP_TOTAL_SIZE: usize = 1;
    
    /// 数据记录协议偏移量
    pub const DATA_RECORDING_VEHICLE_ID_OFFSET: usize = 0;
    pub const DATA_RECORDING_ACTION_OFFSET: usize = 1;
    pub const DATA_RECORDING_TOTAL_SIZE: usize = 2;
    
    /// 施工标记协议偏移量
    pub const CONSTRUCTION_MARKER_ID_OFFSET: usize = 0;
    pub const CONSTRUCTION_MARKER_ACTION_OFFSET: usize = 1;
    pub const CONSTRUCTION_MARKER_X_OFFSET: usize = 2;
    pub const CONSTRUCTION_MARKER_Y_OFFSET: usize = 10;
    pub const CONSTRUCTION_MARKER_TOTAL_SIZE: usize = 18;
    
    /// 数据验证范围
    pub const MIN_SPEED: f64 = 0.0;
    pub const MAX_SPEED: f64 = 1.0;
    pub const MIN_BATTERY: f64 = 0.0;
    pub const MAX_BATTERY: f64 = 100.0;
    pub const MIN_STEERING_ANGLE: f64 = -540.0;
    pub const MAX_STEERING_ANGLE: f64 = 540.0;
}

/// 协议错误类型
#[derive(Debug, thiserror::Error)]
pub enum ProtocolError {
    #[error("数据长度不足: 需要 {required} 字节，实际 {actual} 字节")]
    InsufficientData { required: usize, actual: usize },
    
    #[error("无效的消息类型: 0x{message_type:04X}")]
    InvalidMessageType { message_type: u16 },
    
    #[error("无效的控制指令: {0}")]
    InvalidCommand(u8),
    
    #[error("数据验证失败: {field} = {value}，范围: {min} - {max}")]
    ValidationError {
        field: String,
        value: f64,
        min: f64,
        max: f64,
    },

    #[error("数据长度无效: {length}")]
    InvalidPayloadLength { length: usize },

    #[error("零拷贝转换失败: {0}")]
    ZeroCopyError(String),
    
    #[error("批量处理失败: {0}")]
    BatchProcessingError(String),
    
    #[error("内存对齐错误: 地址 {address:p}，要求对齐 {alignment}")]
    AlignmentError { address: *const u8, alignment: usize },
}

/// 消息类型映射
pub struct MessageTypes;

impl MessageTypes {
    pub const HEARTBEAT: u16 = 0x0001;
    pub const VEHICLE_INFO: u16 = 0x0002;
    pub const VEHICLE_CONTROL: u16 = 0x0003;
    pub const TAXI_ORDER: u16 = 0x0004;
    pub const AVP_PARKING: u16 = 0x0005;
    pub const AVP_PICKUP: u16 = 0x0006;
    pub const DATA_RECORDING: u16 = 0x0007;
    pub const CONSTRUCTION_MARKER: u16 = 0x0008;
    pub const VEHICLE_CAMERA_TOGGLE: u16 = 0x1009;
    pub const SANDBOX_LIGHTING_CONTROL: u16 = 0x2003;
    pub const SANDBOX_TRAFFIC_LIGHT_STATUS: u16 = 0x3001;
    
    /// 获取消息类型名称
    pub fn get_name(message_type: u16) -> &'static str {
        match message_type {
            Self::HEARTBEAT => "心跳",
            Self::VEHICLE_INFO => "车辆信息",
            Self::VEHICLE_CONTROL => "车辆控制",
            Self::TAXI_ORDER => "出租车订单",
            Self::AVP_PARKING => "AVP泊车",
            Self::AVP_PICKUP => "AVP取车",
            Self::DATA_RECORDING => "数据记录",
            Self::CONSTRUCTION_MARKER => "施工标记",
            Self::VEHICLE_CAMERA_TOGGLE => "车辆摄像头开关",
            Self::SANDBOX_LIGHTING_CONTROL => "沙盘灯光控制",
            Self::SANDBOX_TRAFFIC_LIGHT_STATUS => "沙盘红绿灯状态",
            _ => "未知类型",
        }
    }
    
    /// 验证消息类型是否有效
    pub fn is_valid(message_type: u16) -> bool {
        matches!(
            message_type,
            Self::HEARTBEAT
                | Self::VEHICLE_INFO
                | Self::VEHICLE_CONTROL
                | Self::TAXI_ORDER
                | Self::AVP_PARKING
                | Self::AVP_PICKUP
                | Self::DATA_RECORDING
                | Self::CONSTRUCTION_MARKER
                | Self::VEHICLE_CAMERA_TOGGLE
                | Self::SANDBOX_LIGHTING_CONTROL
                | Self::SANDBOX_TRAFFIC_LIGHT_STATUS
        )
    }
}

/// 获取当前时间戳（微秒）
pub fn current_timestamp_us() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_micros() as u64)
        .unwrap_or(0)
}
