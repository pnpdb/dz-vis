//! 车辆协议构建服务
//!
//! 封装所有车辆相关协议的数据域生成逻辑，供命令层或桥接层复用。

use crate::protocol_processing::builder::ProtocolBuilder;
use crate::protocol_processing::types::{
    VehicleControlCommand,
    TaxiOrderData,
    AvpParkingData,
    AvpPickupData,
    DataRecordingData,
    VehicleFunctionSettingData,
    VehiclePathDisplayData,
    VehicleCameraToggleData,
};

/// 车辆服务：统一处理车辆协议数据构建
#[derive(Debug, Default, Clone, Copy)]
pub struct VehicleService;

impl VehicleService {
    pub fn new() -> Self {
        Self
    }

    /// 构建车辆控制指令数据域
    pub fn build_vehicle_control_payload(&self, command: &VehicleControlCommand) -> Vec<u8> {
        ProtocolBuilder::new().build_vehicle_control(command)
    }

    /// 构建出租车订单数据域（单车）
    pub fn build_taxi_order_payload(&self, order: &TaxiOrderData) -> Vec<u8> {
        ProtocolBuilder::new().build_taxi_order(order)
    }

    /// 构建出租车订单广播数据域（含订单号）
    pub fn build_taxi_order_broadcast_payload(
        &self,
        order_id: &str,
        start_x: f64,
        start_y: f64,
        end_x: f64,
        end_y: f64,
    ) -> Vec<u8> {
        let mut data = Vec::with_capacity(48);

        let mut order_bytes = order_id.as_bytes().to_vec();
        order_bytes.resize(16, 0);
        data.extend_from_slice(&order_bytes);

        data.extend_from_slice(&start_x.to_le_bytes());
        data.extend_from_slice(&start_y.to_le_bytes());
        data.extend_from_slice(&end_x.to_le_bytes());
        data.extend_from_slice(&end_y.to_le_bytes());

        data
    }

    /// 构建AVP泊车数据域
    pub fn build_avp_parking_payload(&self, parking: &AvpParkingData) -> Vec<u8> {
        ProtocolBuilder::new().build_avp_parking(parking)
    }

    /// 构建AVP取车数据域
    pub fn build_avp_pickup_payload(&self, pickup: &AvpPickupData) -> Vec<u8> {
        ProtocolBuilder::new().build_avp_pickup(pickup)
    }

    /// 构建数据记录控制数据域
    pub fn build_data_recording_payload(&self, recording: &DataRecordingData) -> Vec<u8> {
        ProtocolBuilder::new().build_data_recording(recording)
    }

    /// 构建施工标记单点数据域（保持现有字段顺序）
    pub fn build_construction_marker_payload(
        &self,
        marker_id: u8,
        position_x: f64,
        position_y: f64,
        action: u8,
    ) -> Vec<u8> {
        let mut data = Vec::with_capacity(18);
        data.push(marker_id);
        data.extend_from_slice(&position_x.to_le_bytes());
        data.extend_from_slice(&position_y.to_le_bytes());
        data.push(action);
        data
    }

    /// 构建所有施工标记广播数据域（仅坐标列表）
    pub fn build_all_construction_markers_payload(&self, markers: &[(f64, f64)]) -> Vec<u8> {
        let mut data = Vec::with_capacity(markers.len() * 16);
        for (x, y) in markers {
            data.extend_from_slice(&x.to_le_bytes());
            data.extend_from_slice(&y.to_le_bytes());
        }
        data
    }

    /// 构建车辆功能设置数据域
    pub fn build_vehicle_function_setting_payload(
        &self,
        setting: &VehicleFunctionSettingData,
    ) -> Vec<u8> {
        ProtocolBuilder::new().build_vehicle_function_setting(setting)
    }

    /// 构建车辆路径显示控制数据域
    pub fn build_vehicle_path_display_payload(
        &self,
        path_display: &VehiclePathDisplayData,
    ) -> Vec<u8> {
        ProtocolBuilder::new().build_vehicle_path_display(path_display)
    }

    /// 构建车辆摄像头开关数据域
    pub fn build_vehicle_camera_toggle_payload(
        &self,
        toggle: &VehicleCameraToggleData,
    ) -> Vec<u8> {
        ProtocolBuilder::new().build_vehicle_camera_toggle(toggle)
    }
}

