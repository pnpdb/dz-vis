import { invoke } from '@tauri-apps/api/core';
import { SEND_MESSAGE_TYPES, VEHICLE_CONTROL_PROTOCOL } from '@/constants/messageTypes.js';

const commandMap = {
    [VEHICLE_CONTROL_PROTOCOL.COMMAND_START]: 'Start',
    [VEHICLE_CONTROL_PROTOCOL.COMMAND_STOP]: 'Stop',
    [VEHICLE_CONTROL_PROTOCOL.COMMAND_EMERGENCY_BRAKE]: 'EmergencyBrake',
    [VEHICLE_CONTROL_PROTOCOL.COMMAND_INIT_POSE]: 'InitPose'
};

const vehicleBridge = {
    async sendVehicleControl(vehicleId, command, positionData = null) {
        const commandType = commandMap[command];
        if (!commandType) {
            throw new Error(`不支持的命令类型: ${command}`);
        }

        const payload = await invoke('build_vehicle_control_payload', { vehicleId, command: commandType, positionData });

        return invoke('send_to_vehicle', {
            vehicleId,
            messageType: SEND_MESSAGE_TYPES.VEHICLE_CONTROL,
            data: payload
        });
    },

    async sendDataRecording(vehicleId, recordingStatus) {
        const payload = await invoke('build_data_recording_payload', { vehicleId, recordingStatus });

        return invoke('send_to_vehicle', {
            vehicleId,
            messageType: SEND_MESSAGE_TYPES.DATA_RECORDING,
            data: payload
        });
    },

    async sendVehicleFunctionSetting(vehicleId, functionId, enableStatus) {
        const payload = await invoke('build_vehicle_function_setting_payload', {
            vehicleId,
            functionId,
            enableStatus
        });

        return invoke('send_to_vehicle', {
            vehicleId,
            messageType: SEND_MESSAGE_TYPES.VEHICLE_FUNCTION_SETTING,
            data: payload
        });
    },

    async sendVehiclePathDisplay(vehicleId, displayPath) {
        const payload = await invoke('build_vehicle_path_display_payload', {
            vehicleId,
            displayPath
        })

        return invoke('send_to_vehicle', {
            vehicleId,
            messageType: SEND_MESSAGE_TYPES.VEHICLE_PATH_DISPLAY,
            data: payload
        })
    },

    async broadcastTaxiOrder(orderId, startX, startY, endX, endY) {
        return invoke('broadcast_taxi_order', { orderId, startX, startY, endX, endY })
    },

    async sendTaxiOrderToVehicle(orderId, vehicleId, startX, startY, endX, endY) {
        return invoke('send_taxi_order_to_vehicle', { orderId, vehicleId, startX, startY, endX, endY })
    },

    async sendAvpParking(vehicleId) {
        return invoke('send_avp_parking', { vehicleId })
    },

    async sendAvpPickup(vehicleId) {
        return invoke('send_avp_pickup', { vehicleId })
    },

    async broadcastConstructionMarker(markerId, positionX, positionY, action) {
        return invoke('broadcast_construction_marker', {
            markerId,
            positionX,
            positionY,
            action
        })
    },

    async broadcastAllConstructionMarkers(markers) {
        return invoke('broadcast_all_construction_markers', { markers })
    }
};

export const useVehicleBridge = () => vehicleBridge;

export default vehicleBridge;

