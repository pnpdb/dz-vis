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
            console.log('✅ 获取车辆连接列表:', result);
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
            console.log('✅ 创建车辆连接成功:', result);
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
            console.log('✅ 更新车辆连接成功:', result);
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
            console.log('✅ 删除车辆连接成功:', result);
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
            console.log('✅ 获取活跃车辆连接:', result);
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
            console.log('✅ 获取交通灯设置:', result);
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
            console.log('✅ 更新交通灯设置成功:', result);
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ 更新交通灯设置失败:', error);
            return { success: false, error: error.toString() };
        }
    }
}

export default VehicleConnectionAPI;
