import { invoke } from '@tauri-apps/api/core';
import { VEHICLE_CONTROL_PROTOCOL, VEHICLE_CAMERA_PROTOCOL } from '@/constants/messageTypes.js';

const commandMap = {
    [VEHICLE_CONTROL_PROTOCOL.COMMAND_START]: 'Start',
    [VEHICLE_CONTROL_PROTOCOL.COMMAND_STOP]: 'Stop',
    [VEHICLE_CONTROL_PROTOCOL.COMMAND_EMERGENCY_BRAKE]: 'EmergencyBrake',
    [VEHICLE_CONTROL_PROTOCOL.COMMAND_INIT_POSE]: 'InitPose'
};

const sendVehicleControl = async (vehicleId, command, positionData = null) => {
    const commandType = commandMap[command];
    if (!commandType) {
        throw new Error(`不支持的命令类型: ${command}`);
    }

    return invoke('send_vehicle_control_command', { vehicleId, command: commandType, positionData });
};

const sendDataRecording = async (vehicleId, recordingStatus) => {
    return invoke('send_data_recording_command', { vehicleId, recordingStatus });
};

const sendVehicleFunctionSetting = async (vehicleId, functionId, enableStatus) => {
    return invoke('send_vehicle_function_setting_command', { vehicleId, functionId, enableStatus });
};

const sendVehiclePathDisplay = async (vehicleId, displayPath) => {
    return invoke('send_vehicle_path_display_command', { vehicleId, displayPath });
};

const broadcastTaxiOrder = (orderId, startX, startY, endX, endY) => {
    return invoke('broadcast_taxi_order', { orderId, startX, startY, endX, endY });
};

const sendTaxiOrderToVehicle = (orderId, vehicleId, startX, startY, endX, endY) => {
    return invoke('send_taxi_order_to_vehicle', { orderId, vehicleId, startX, startY, endX, endY });
};

const sendAvpParking = (vehicleId, parkingSpot = 1) => invoke('send_avp_parking', { vehicleId, parkingSpot });

const sendAvpPickup = (vehicleId) => invoke('send_avp_pickup', { vehicleId });

const broadcastConstructionMarker = (markerId, positionX, positionY, action) => {
    return invoke('broadcast_construction_marker', { markerId, positionX, positionY, action });
};

const broadcastAllConstructionMarkers = (markers) => {
    return invoke('broadcast_all_construction_markers', { markers });
};

const sendVehicleCameraToggle = (vehicleId, enabled) => {
    const status = enabled ? VEHICLE_CAMERA_PROTOCOL.STATUS_ON : VEHICLE_CAMERA_PROTOCOL.STATUS_OFF;
    return invoke('send_vehicle_camera_toggle_command', { vehicleId, enabled: status });
};

export default {
    sendVehicleControl,
    sendDataRecording,
    sendVehicleFunctionSetting,
    sendVehiclePathDisplay,
    broadcastTaxiOrder,
    sendTaxiOrderToVehicle,
    sendAvpParking,
    sendAvpPickup,
    broadcastConstructionMarker,
    broadcastAllConstructionMarkers,
    sendVehicleCameraToggle,
};

