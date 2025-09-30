/**
 * 车辆连接管理API工具类
 * 封装与Rust后端的车辆连接CRUD操作
 */

import { invoke } from '@tauri-apps/api/core';
import { ElMessage } from 'element-plus';

export class VehicleConnectionAPI {
    /**
     * 获取所有车辆连接
     */
    static async getAllConnections() {
        try {
            const result = await invoke('get_vehicle_connections');
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 获取车辆连接失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 创建车辆连接
     */
    static async createConnection(connectionData) {
        try {
            const result = await invoke('create_vehicle_connection', {
                request: connectionData
            });
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 创建车辆连接失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 更新车辆连接
     */
    static async updateConnection(id, updateData) {
        try {
            const result = await invoke('update_vehicle_connection', {
                id: id,
                request: updateData
            });
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 更新车辆连接失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 删除车辆连接
     */
    static async deleteConnection(id) {
        try {
            const result = await invoke('delete_vehicle_connection', { id });
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 删除车辆连接失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 获取活跃的车辆连接
     */
    static async getActiveConnections() {
        try {
            const result = await invoke('get_active_vehicle_connections');
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 获取活跃车辆连接失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 验证IP地址格式
     */
    static validateIPAddress(ip) {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    }

    /**
     * 验证车辆ID格式
     */
    static validateVehicleID(vehicleId) {
        const vehicleIdRegex = /^[a-zA-Z0-9_-]+$/;
        return vehicleIdRegex.test(vehicleId);
    }

    /**
     * 验证端口号
     */
    static validatePort(port) {
        return Number.isInteger(port) && port > 0 && port <= 65535;
    }

    /**
     * 格式化车辆连接地址
     */
    static formatAddress(connection) {
        return `${connection.ip_address}:${connection.port}`;
    }

    /**
     * 格式化创建时间
     */
    static formatCreatedAt(isoString) {
        try {
            const date = new Date(isoString);
            return date.toLocaleString('zh-CN');
        } catch {
            return '未知时间';
        }
    }
}

/**
 * 交通灯设置管理API工具类
 * 封装与Rust后端的交通灯设置操作
 */
export class TrafficLightAPI {
    /**
     * 获取交通灯设置
     */
    static async getSettings() {
        try {
            const result = await invoke('get_traffic_light_settings');
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 获取交通灯设置失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 更新交通灯设置
     * @param {Object} settings - 交通灯设置 { red_light_duration?: number, green_light_duration?: number }
     */
    static async updateSettings(settings) {
        try {
            const result = await invoke('update_traffic_light_settings', { request: settings });
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 更新交通灯设置失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 获取单个红绿灯的时长
     * @param {number} lightId
     */
    static async getLightItem(lightId) {
        try {
            const result = await invoke('get_traffic_light_item', { lightId });
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 获取红绿灯时长失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 更新单个红绿灯的时长
     */
    static async updateLightItem(lightId, redSeconds, greenSeconds) {
        try {
            const result = await invoke('update_traffic_light_item', { lightId, redSeconds, greenSeconds });
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 更新红绿灯时长失败:', error);
            return { success: false, error: error.toString() };
        }
    }
}

/**
 * 统计数据API工具类
 * 封装与Rust后端的统计数据操作
 */
export class StatisticsAPI {
    /**
     * 获取车辆在线时长统计
     */
    static async getVehicleOnlineStats() {
        try {
            const result = await invoke('get_vehicle_online_stats');
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 获取车辆在线统计失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 获取自动驾驶行为统计
     */
    static async getDrivingBehaviorStats() {
        try {
            const result = await invoke('get_driving_behavior_stats');
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 获取自动驾驶行为统计失败:', error);
            return { success: false, error: error.toString() };
        }
    }
}

/**
 * 沙盘设置管理API工具类
 * 封装与Rust后端的沙盘设置操作
 */
export class SandboxAPI {
    /**
     * 获取沙盘服务设置
     */
    static async getServiceSettings() {
        try {
            const result = await invoke('get_sandbox_service_settings');
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 获取沙盘服务设置失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 创建或更新沙盘服务设置
     */
    static async createOrUpdateServiceSettings(settingsData) {
        try {
            const result = await invoke('create_or_update_sandbox_service_settings', {
                request: settingsData
            });
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 保存沙盘服务设置失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 删除沙盘服务设置
     */
    static async deleteServiceSettings() {
        try {
            const result = await invoke('delete_sandbox_service_settings');
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 删除沙盘服务设置失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 获取所有沙盘摄像头
     */
    static async getAllCameras() {
        try {
            const result = await invoke('get_all_sandbox_cameras');
            console.log('✅ 获取沙盘摄像头列表:', result);
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 获取沙盘摄像头列表失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 创建沙盘摄像头
     */
    static async createCamera(cameraData) {
        try {
            const result = await invoke('create_sandbox_camera', {
                request: cameraData
            });
            console.log('✅ 创建沙盘摄像头成功:', result);
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 创建沙盘摄像头失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 更新沙盘摄像头
     */
    static async updateCamera(id, updateData) {
        try {
            const result = await invoke('update_sandbox_camera', {
                id: id,
                request: updateData
            });
            console.log('✅ 更新沙盘摄像头成功:', result);
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 更新沙盘摄像头失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 删除沙盘摄像头
     */
    static async deleteCamera(id) {
        try {
            const result = await invoke('delete_sandbox_camera', { id });
            console.log('✅ 删除沙盘摄像头成功:', result);
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 删除沙盘摄像头失败:', error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 验证IP地址格式（复用VehicleConnectionAPI的方法）
     */
    static validateIPAddress(ip) {
        return VehicleConnectionAPI.validateIPAddress(ip);
    }


    /**
     * 验证RTSP URL格式
     */
    static validateRTSPUrl(url) {
        const rtspRegex = /^rtsp:\/\/.+/;
        return rtspRegex.test(url);
    }

    /**
     * 格式化创建时间（复用VehicleConnectionAPI的方法）
     */
    static formatCreatedAt(isoString) {
        return VehicleConnectionAPI.formatCreatedAt(isoString);
    }
}

export default VehicleConnectionAPI;
