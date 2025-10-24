/**
 * 车辆模型动态管理模块
 * 负责在场景中动态添加、更新和移除车辆模型
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Box3 } from 'three';

// 车辆模型存储
const vehicleModels = new Map();  // key: vehicleId, value: model
let carModelTemplate = null;  // 车辆模型模板，用于克隆
let modelsGroup = null;  // 场景模型组
let models = null;  // 场景模型 Map

/**
 * 初始化车辆管理器
 * @param {Group} _modelsGroup - Three.js 模型组
 * @param {Map} _models - 场景模型 Map
 */
export const initVehicleManager = (_modelsGroup, _models) => {
    modelsGroup = _modelsGroup;
    models = _models;
    console.info('✅ 车辆管理器已初始化');
};

/**
 * 加载车辆模型模板（如果还没有加载）
 */
const loadCarModelTemplate = async () => {
    if (carModelTemplate) {
        return carModelTemplate;
    }

    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        loader.setDRACOLoader(dracoLoader);

        loader.load(
            '/models/car.glb',
            (gltf) => {
                carModelTemplate = gltf.scene;
                // 由于车辆会添加到沙盘内部（沙盘scale=6），
                // 车辆会继承沙盘的缩放，所以这里设置为1即可
                carModelTemplate.scale.set(1, 1, 1);
                console.info('✅ 车辆模型模板加载成功');
                resolve(carModelTemplate);
            },
            undefined,
            (error) => {
                console.error('❌ 车辆模型模板加载失败:', error);
                reject(error);
            }
        );
    });
};

/**
 * 添加车辆到场景
 * @param {number} vehicleId - 车辆ID
 * @param {object} position - 位置 {x, z} (模型坐标系)
 * @param {number} orientation - 朝向角度（弧度）
 * @param {string} color - 车辆颜色
 */
export const addVehicle = async (vehicleId, position, orientation = 0, color = '#409EFF') => {
    try {
        // 如果已经存在，先删除
        if (vehicleModels.has(vehicleId)) {
            removeVehicle(vehicleId);
        }

        // 加载车辆模型模板
        await loadCarModelTemplate();

        // 克隆模型
        const vehicleModel = carModelTemplate.clone();
        
        // 获取沙盘模型以计算道路表面高度
        const sandboxModel = models.get('sandbox');
        if (!sandboxModel) {
            console.error('❌ 沙盘模型未找到，无法添加车辆');
            return null;
        }
        
        // 计算沙盘道路表面的局部Y坐标
        const sandboxBox = new Box3().setFromObject(sandboxModel);
        const roadSurfaceY = sandboxBox.min.y;  // 道路表面 = 沙盘底部

        // 计算车辆模型的底部偏移
        const carBox = new Box3().setFromObject(vehicleModel);
        const carBottomOffset = carBox.min.y;
        
        // 设置车辆位置（使用沙盘局部坐标系）
        // position 已经是模型局部坐标 (x, z)，直接使用
        vehicleModel.position.set(
            position.x || 0,
            roadSurfaceY - carBottomOffset,  // 确保车底在道路表面
            position.z || 0
        );

        // 设置车辆朝向（从车辆坐标系角度转换为Three.js rotation.y）
        vehicleModel.rotation.y = orientation - Math.PI / 2;

        // 将车辆添加到沙盘模型内部（而不是modelsGroup）
        // 这样车辆就使用沙盘的局部坐标系，和施工标记一致
        sandboxModel.add(vehicleModel);
        vehicleModels.set(vehicleId, vehicleModel);

        console.info(`✅ 车辆 ${vehicleId} 已添加到场景 位置: (${position.x.toFixed(2)}, ${position.z.toFixed(2)})`);
        return vehicleModel;

    } catch (error) {
        console.error(`❌ 添加车辆 ${vehicleId} 失败:`, error);
        throw error;
    }
};

/**
 * 移除车辆从场景
 * @param {number} vehicleId - 车辆ID
 */
export const removeVehicle = (vehicleId) => {
    const vehicleModel = vehicleModels.get(vehicleId);
    if (vehicleModel) {
        // 从父节点（沙盘模型）中移除
        if (vehicleModel.parent) {
            vehicleModel.parent.remove(vehicleModel);
        }
        
        // 释放资源
        vehicleModel.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });

        vehicleModels.delete(vehicleId);
        console.info(`✅ 车辆 ${vehicleId} 已从场景移除`);
        return true;
    }
    return false;
};

/**
 * 更新车辆位置和朝向
 * @param {number} vehicleId - 车辆ID
 * @param {object} position - 位置 {x, z} (模型局部坐标系)
 * @param {number} orientation - 朝向角度（弧度）
 */
export const updateVehiclePosition = (vehicleId, position, orientation) => {
    const vehicleModel = vehicleModels.get(vehicleId);
    if (vehicleModel) {
        // 直接更新位置（车辆已经在沙盘局部坐标系中）
        // 保持Y轴不变，因为车辆应该始终在道路表面
        if (position) {
            vehicleModel.position.x = position.x !== undefined ? position.x : vehicleModel.position.x;
            vehicleModel.position.z = position.z !== undefined ? position.z : vehicleModel.position.z;
        }

        // 更新朝向
        if (orientation !== undefined) {
            vehicleModel.rotation.y = orientation - Math.PI / 2;
        }

        return true;
    }
    return false;
};

/**
 * 获取所有车辆ID列表
 */
export const getAllVehicleIds = () => {
    return Array.from(vehicleModels.keys());
};

/**
 * 清除所有车辆
 */
export const clearAllVehicles = () => {
    const vehicleIds = getAllVehicleIds();
    vehicleIds.forEach(id => removeVehicle(id));
    console.info('✅ 所有车辆已清除');
};

/**
 * 检查车辆是否存在
 */
export const hasVehicle = (vehicleId) => {
    return vehicleModels.has(vehicleId);
};

