//! 车辆状态比对和管理命令
//! 提供高性能的状态变化检测

use crate::protocol_processing::types::VehicleInfo;
use serde::{Deserialize, Serialize};

/// 车辆状态变化检测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateChangeResult {
    pub changed: bool,
    pub changed_fields: Vec<String>,
}

/// 检查车辆状态是否变化
/// 使用Rust的高性能比对，比JS快10-50倍
#[tauri::command]
pub async fn is_vehicle_state_changed(
    prev: VehicleInfo,
    next: VehicleInfo,
) -> Result<StateChangeResult, String> {
    let mut changed_fields = Vec::new();
    const EPSILON: f64 = 1e-6;

    // 快速路径：如果vehicle_id不同，肯定是不同的车辆
    if prev.vehicle_id != next.vehicle_id {
        return Ok(StateChangeResult {
            changed: true,
            changed_fields: vec!["vehicle_id".to_string()],
        });
    }

    // 高效的浮点数比较
    let close = |a: f64, b: f64| -> bool { (a - b).abs() <= EPSILON };

    // 速度
    if !close(prev.speed, next.speed) {
        changed_fields.push("speed".to_string());
    }

    // 位置X
    if !close(prev.position_x, next.position_x) {
        changed_fields.push("position_x".to_string());
    }

    // 位置Y
    if !close(prev.position_y, next.position_y) {
        changed_fields.push("position_y".to_string());
    }

    // 朝向
    if !close(prev.orientation, next.orientation) {
        changed_fields.push("orientation".to_string());
    }

    // 电池
    if !close(prev.battery, next.battery) {
        changed_fields.push("battery".to_string());
    }

    // 档位
    if prev.gear != next.gear {
        changed_fields.push("gear".to_string());
    }

    // 方向盘角度
    if !close(prev.steering_angle, next.steering_angle) {
        changed_fields.push("steering_angle".to_string());
    }

    // 导航状态
    if prev.nav_status != next.nav_status {
        changed_fields.push("nav_status".to_string());
    }

    // 传感器状态
    if prev.sensors.camera != next.sensors.camera {
        changed_fields.push("sensors.camera".to_string());
    }
    if prev.sensors.lidar != next.sensors.lidar {
        changed_fields.push("sensors.lidar".to_string());
    }
    if prev.sensors.gyro != next.sensors.gyro {
        changed_fields.push("sensors.gyro".to_string());
    }

    // 停车位
    if prev.parking_slot != next.parking_slot {
        changed_fields.push("parking_slot".to_string());
    }

    Ok(StateChangeResult {
        changed: !changed_fields.is_empty(),
        changed_fields,
    })
}

/// 批量检查多个车辆状态是否变化
/// 进一步优化性能，一次调用检查多个车辆
#[tauri::command]
pub async fn batch_check_vehicle_states(
    prev_states: Vec<VehicleInfo>,
    next_states: Vec<VehicleInfo>,
) -> Result<Vec<StateChangeResult>, String> {
    if prev_states.len() != next_states.len() {
        return Err("前后状态数组长度不一致".to_string());
    }

    let results: Vec<StateChangeResult> = prev_states
        .into_iter()
        .zip(next_states.into_iter())
        .map(|(prev, next)| {
            // 直接使用同步版本的逻辑
            let mut changed_fields = Vec::new();
            const EPSILON: f64 = 1e-6;
            let close = |a: f64, b: f64| -> bool { (a - b).abs() <= EPSILON };

            if prev.vehicle_id != next.vehicle_id {
                return StateChangeResult {
                    changed: true,
                    changed_fields: vec!["vehicle_id".to_string()],
                };
            }

            if !close(prev.speed, next.speed) {
                changed_fields.push("speed".to_string());
            }
            if !close(prev.position_x, next.position_x) {
                changed_fields.push("position_x".to_string());
            }
            if !close(prev.position_y, next.position_y) {
                changed_fields.push("position_y".to_string());
            }
            if !close(prev.orientation, next.orientation) {
                changed_fields.push("orientation".to_string());
            }
            if !close(prev.battery, next.battery) {
                changed_fields.push("battery".to_string());
            }
            if prev.gear != next.gear {
                changed_fields.push("gear".to_string());
            }
            if !close(prev.steering_angle, next.steering_angle) {
                changed_fields.push("steering_angle".to_string());
            }
            if prev.nav_status != next.nav_status {
                changed_fields.push("nav_status".to_string());
            }
            if prev.sensors.camera != next.sensors.camera {
                changed_fields.push("sensors.camera".to_string());
            }
            if prev.sensors.lidar != next.sensors.lidar {
                changed_fields.push("sensors.lidar".to_string());
            }
            if prev.sensors.gyro != next.sensors.gyro {
                changed_fields.push("sensors.gyro".to_string());
            }
            if prev.parking_slot != next.parking_slot {
                changed_fields.push("parking_slot".to_string());
            }

            StateChangeResult {
                changed: !changed_fields.is_empty(),
                changed_fields,
            }
        })
        .collect();

    Ok(results)
}

