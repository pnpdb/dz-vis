//! 消息类型配置导出模块
//! 提供统一的消息类型定义，并可导出为JSON供前端使用

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 消息类型配置（前端使用的完整配置）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageTypesConfig {
    /// 接收消息类型（从客户端接收）
    pub receive_message_types: HashMap<String, u16>,
    /// 发送消息类型（发送给客户端）
    pub send_message_types: HashMap<String, u16>,
    /// 协议常量
    pub protocol_constants: ProtocolConstantsConfig,
    /// 车辆信息协议定义
    pub vehicle_info_protocol: VehicleInfoProtocolConfig,
    /// 车辆控制协议定义
    pub vehicle_control_protocol: VehicleControlProtocolConfig,
    /// 数据记录协议定义
    pub data_recording_protocol: DataRecordingProtocolConfig,
    /// 出租车订单协议定义
    pub taxi_order_protocol: TaxiOrderProtocolConfig,
    /// AVP停车协议定义
    pub avp_parking_protocol: AvpParkingProtocolConfig,
    /// AVP取车协议定义
    pub avp_pickup_protocol: AvpPickupProtocolConfig,
    /// 车辆功能设置协议定义
    pub vehicle_function_setting_protocol: VehicleFunctionSettingProtocolConfig,
    /// 车辆路径显示协议定义
    pub vehicle_path_display_protocol: VehiclePathDisplayProtocolConfig,
    /// 车辆摄像头协议定义
    pub vehicle_camera_protocol: VehicleCameraProtocolConfig,
    /// 施工标记协议定义
    pub construction_marker_protocol: ConstructionMarkerProtocolConfig,
    /// 沙盘灯光控制协议定义
    pub sandbox_lighting_protocol: SandboxLightingProtocolConfig,
    /// 导航状态文本映射
    pub nav_status_texts: HashMap<String, String>,
}

/// 协议常量配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolConstantsConfig {
    pub header: Vec<u8>,
    pub footer: Vec<u8>,
    pub version: u8,
    pub header_size: usize,
    pub version_size: usize,
    pub timestamp_size: usize,
    pub message_type_size: usize,
    pub data_length_size: usize,
    pub crc_size: usize,
    pub footer_size: usize,
    pub min_packet_size: usize,
}

/// 车辆信息协议配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleInfoProtocolConfig {
    pub vehicle_id_offset: usize,
    pub speed_offset: usize,
    pub position_x_offset: usize,
    pub position_y_offset: usize,
    pub orientation_offset: usize,
    pub battery_offset: usize,
    pub gear_offset: usize,
    pub steering_angle_offset: usize,
    pub nav_status_offset: usize,
    pub camera_status_offset: usize,
    pub lidar_status_offset: usize,
    pub gyro_status_offset: usize,
    pub parking_slot_offset: usize,
    pub total_size: usize,
    pub min_speed: f64,
    pub max_speed: f64,
}

/// 车辆控制协议配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleControlProtocolConfig {
    pub vehicle_id_offset: usize,
    pub control_command_offset: usize,
    pub position_x_offset: usize,
    pub position_y_offset: usize,
    pub orientation_offset: usize,
    pub base_size: usize,
    pub position_data_size: usize,
    pub total_size_with_position: usize,
    pub total_size_without_position: usize,
    pub command_start: u8,
    pub command_stop: u8,
    pub command_emergency_brake: u8,
    pub command_init_pose: u8,
    pub command_names: HashMap<String, String>,
}

/// 数据记录协议配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataRecordingProtocolConfig {
    pub vehicle_id_offset: usize,
    pub recording_status_offset: usize,
    pub total_size: usize,
    pub recording_off: u8,
    pub recording_on: u8,
    pub status_names: HashMap<String, String>,
}

/// 出租车订单协议配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxiOrderProtocolConfig {
    pub order_id_offset: usize,
    pub start_x_offset: usize,
    pub start_y_offset: usize,
    pub end_x_offset: usize,
    pub end_y_offset: usize,
    pub total_size: usize,
    pub default_start_x: f64,
    pub default_start_y: f64,
    pub default_end_x: f64,
    pub default_end_y: f64,
}

/// AVP停车协议配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvpParkingProtocolConfig {
    pub vehicle_id_offset: usize,
    pub parking_spot_offset: usize,
    pub total_size: usize,
    pub default_parking_spot: u8,
}

/// AVP取车协议配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvpPickupProtocolConfig {
    pub vehicle_id_offset: usize,
    pub total_size: usize,
}

/// 车辆功能设置协议配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleFunctionSettingProtocolConfig {
    pub vehicle_id_offset: usize,
    pub function_id_offset: usize,
    pub enable_status_offset: usize,
    pub total_size: usize,
    pub function_all: u8,
    pub function_sensors: u8,
    pub function_mapping: u8,
    pub function_recording: u8,
    pub function_positioning: u8,
    pub function_autonomous_nav: u8,
    pub function_image_recognition: u8,
    pub function_target_shooting: u8,
    pub status_disable: u8,
    pub status_enable: u8,
}

/// 车辆路径显示协议配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehiclePathDisplayProtocolConfig {
    pub vehicle_id_offset: usize,
    pub display_path_offset: usize,
    pub total_size: usize,
    pub path_disable: u8,
    pub path_enable: u8,
}

/// 车辆摄像头协议配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleCameraProtocolConfig {
    pub vehicle_id_offset: usize,
    pub enable_status_offset: usize,
    pub total_size: usize,
    pub status_off: u8,
    pub status_on: u8,
}

/// 施工标记协议配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstructionMarkerProtocolConfig {
    pub id_offset: usize,
    pub position_x_offset: usize,
    pub position_y_offset: usize,
    pub action_offset: usize,
    pub total_size: usize,
    pub action_cancel: u8,
    pub action_set: u8,
    pub action_names: HashMap<String, String>,
}

/// 沙盘灯光控制协议配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxLightingProtocolConfig {
    pub ambient_offset: usize,
    pub building_offset: usize,
    pub street_offset: usize,
    pub total_size: usize,
    pub status_off: u8,
    pub status_on: u8,
}

/// 获取完整的消息类型配置
pub fn get_message_types_config() -> MessageTypesConfig {
    use super::types::MessageTypes;
    
    let mut receive_types = HashMap::new();
    receive_types.insert("HEARTBEAT".to_string(), MessageTypes::HEARTBEAT);
    receive_types.insert("VEHICLE_INFO".to_string(), MessageTypes::VEHICLE_INFO);
    receive_types.insert("SANDBOX_TRAFFIC_LIGHT_STATUS".to_string(), MessageTypes::SANDBOX_TRAFFIC_LIGHT_STATUS);

    let mut send_types = HashMap::new();
    send_types.insert("VEHICLE_CONTROL".to_string(), 0x1001u16);
    send_types.insert("DATA_RECORDING".to_string(), 0x1002u16);
    send_types.insert("TAXI_ORDER".to_string(), 0x1003u16);
    send_types.insert("AVP_PARKING".to_string(), 0x1004u16);
    send_types.insert("AVP_PICKUP".to_string(), 0x1005u16);
    send_types.insert("VEHICLE_FUNCTION_SETTING".to_string(), 0x1006u16);
    send_types.insert("VEHICLE_PATH_DISPLAY".to_string(), 0x1007u16);
    send_types.insert("CONSTRUCTION_MARKER".to_string(), 0x1008u16);
    send_types.insert("VEHICLE_CAMERA_TOGGLE".to_string(), 0x1009u16);
    send_types.insert("SANDBOX_LIGHTING_CONTROL".to_string(), 0x2003u16);

    let mut nav_status_texts = HashMap::new();
    nav_status_texts.insert("1".to_string(), "正常行驶中（空载模式倒车入库）".to_string());
    nav_status_texts.insert("2".to_string(), "正常行驶中（空载模式不倒车入库）".to_string());
    nav_status_texts.insert("3".to_string(), "接客模式，去起点接客".to_string());
    nav_status_texts.insert("4".to_string(), "接客模式，去终点送客".to_string());
    nav_status_texts.insert("5".to_string(), "去往充电车位".to_string());
    nav_status_texts.insert("6".to_string(), "充电中".to_string());
    nav_status_texts.insert("7".to_string(), "去往定车位路上".to_string());
    nav_status_texts.insert("8".to_string(), "车位停车中".to_string());
    nav_status_texts.insert("9".to_string(), "到达接客起点".to_string());
    nav_status_texts.insert("10".to_string(), "到达接客终点".to_string());
    nav_status_texts.insert("11".to_string(), "正在倒车入库".to_string());
    nav_status_texts.insert("12".to_string(), "正在出库中".to_string());
    nav_status_texts.insert("13".to_string(), "正在倒车入库".to_string());
    nav_status_texts.insert("14".to_string(), "出库完成".to_string());
    nav_status_texts.insert("15".to_string(), "平行驾驶模式".to_string());

    MessageTypesConfig {
        receive_message_types: receive_types,
        send_message_types: send_types,
        
        protocol_constants: ProtocolConstantsConfig {
            header: vec![0xEF, 0xEF, 0xEF, 0xEF],
            footer: vec![0xFE, 0xFE, 0xFE, 0xFE],
            version: 0x10,
            header_size: 4,
            version_size: 1,
            timestamp_size: 8,
            message_type_size: 2,
            data_length_size: 4,
            crc_size: 2,
            footer_size: 4,
            min_packet_size: 25,
        },

        vehicle_info_protocol: VehicleInfoProtocolConfig {
            vehicle_id_offset: 0,
            speed_offset: 1,
            position_x_offset: 9,
            position_y_offset: 17,
            orientation_offset: 25,
            battery_offset: 33,
            gear_offset: 41,
            steering_angle_offset: 42,
            nav_status_offset: 50,
            camera_status_offset: 51,
            lidar_status_offset: 52,
            gyro_status_offset: 53,
            parking_slot_offset: 54,
            total_size: 55,
            min_speed: 0.0,
            max_speed: 1.0,
        },

        vehicle_control_protocol: VehicleControlProtocolConfig {
            vehicle_id_offset: 0,
            control_command_offset: 1,
            position_x_offset: 2,
            position_y_offset: 10,
            orientation_offset: 18,
            base_size: 2,
            position_data_size: 24,
            total_size_with_position: 26,
            total_size_without_position: 2,
            command_start: 1,
            command_stop: 2,
            command_emergency_brake: 3,
            command_init_pose: 4,
            command_names: {
                let mut map = HashMap::new();
                map.insert("1".to_string(), "启动".to_string());
                map.insert("2".to_string(), "停止".to_string());
                map.insert("3".to_string(), "紧急制动".to_string());
                map.insert("4".to_string(), "初始化位姿".to_string());
                map
            },
        },

        data_recording_protocol: DataRecordingProtocolConfig {
            vehicle_id_offset: 0,
            recording_status_offset: 1,
            total_size: 2,
            recording_off: 0,
            recording_on: 1,
            status_names: {
                let mut map = HashMap::new();
                map.insert("0".to_string(), "关闭".to_string());
                map.insert("1".to_string(), "开启".to_string());
                map
            },
        },

        taxi_order_protocol: TaxiOrderProtocolConfig {
            order_id_offset: 0,
            start_x_offset: 16,
            start_y_offset: 24,
            end_x_offset: 32,
            end_y_offset: 40,
            total_size: 48,
            default_start_x: 116.4,
            default_start_y: 39.9,
            default_end_x: 118.5,
            default_end_y: 41.2,
        },

        avp_parking_protocol: AvpParkingProtocolConfig {
            vehicle_id_offset: 0,
            parking_spot_offset: 1,
            total_size: 2,
            default_parking_spot: 1,
        },

        avp_pickup_protocol: AvpPickupProtocolConfig {
            vehicle_id_offset: 0,
            total_size: 1,
        },

        vehicle_function_setting_protocol: VehicleFunctionSettingProtocolConfig {
            vehicle_id_offset: 0,
            function_id_offset: 1,
            enable_status_offset: 2,
            total_size: 3,
            function_all: 0,
            function_sensors: 1,
            function_mapping: 2,
            function_recording: 3,
            function_positioning: 4,
            function_autonomous_nav: 5,
            function_image_recognition: 6,
            function_target_shooting: 7,
            status_disable: 0,
            status_enable: 1,
        },

        vehicle_path_display_protocol: VehiclePathDisplayProtocolConfig {
            vehicle_id_offset: 0,
            display_path_offset: 1,
            total_size: 2,
            path_disable: 0,
            path_enable: 1,
        },

        vehicle_camera_protocol: VehicleCameraProtocolConfig {
            vehicle_id_offset: 0,
            enable_status_offset: 1,
            total_size: 2,
            status_off: 0,
            status_on: 1,
        },

        construction_marker_protocol: ConstructionMarkerProtocolConfig {
            id_offset: 0,
            position_x_offset: 1,
            position_y_offset: 9,
            action_offset: 17,
            total_size: 18,
            action_cancel: 0,
            action_set: 1,
            action_names: {
                let mut map = HashMap::new();
                map.insert("0".to_string(), "取消".to_string());
                map.insert("1".to_string(), "设置".to_string());
                map
            },
        },

        sandbox_lighting_protocol: SandboxLightingProtocolConfig {
            ambient_offset: 0,
            building_offset: 1,
            street_offset: 2,
            total_size: 3,
            status_off: 0,
            status_on: 1,
        },

        nav_status_texts,
    }
}

