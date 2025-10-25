/**
 * 车辆模型动态管理模块
 * 负责在场景中动态添加、更新和移除车辆模型
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Box3 } from 'three';
import { validateVehicleId, validatePosition, validateOrientation } from '@/utils/validation.js';
import { disposeObject3D } from '@/utils/resourceCleanup.js';

// 车辆模型存储
const vehicleModels = new Map();  // key: vehicleId, value: model
let carModelTemplate = null;  // 车辆模型模板，用于克隆
let modelsGroup = null;  // 场景模型组
let models = null;  // 场景模型 Map

// 性能优化：包围盒缓存
let cachedSandboxBox = null;  // 缓存的沙盘包围盒
let cachedCarTemplateBox = null;  // 缓存的车辆模板包围盒

// 性能优化：DRACOLoader 单例复用
let sharedDracoLoader = null;

// 性能优化：Promise 缓存，避免重复加载
let loadingPromise = null;

/**
 * 获取或创建共享的 DRACOLoader 实例（单例模式）
 * @returns {DRACOLoader} DRACOLoader 实例
 */
const getSharedDracoLoader = () => {
    if (!sharedDracoLoader) {
        sharedDracoLoader = new DRACOLoader();
        // 使用本地解码器文件（离线可用）
        sharedDracoLoader.setDecoderPath('/draco/');
        console.info('✅ DRACOLoader 单例已创建（本地解码器）');
    }
    return sharedDracoLoader;
};

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
 * 使用 Promise 缓存避免重复加载（性能优化）
 */
const loadCarModelTemplate = async () => {
    // 如果已经加载完成，直接返回
    if (carModelTemplate) {
        return carModelTemplate;
    }

    // 如果正在加载中，返回同一个 Promise（避免重复加载）
    if (loadingPromise) {
        console.info('⏳ 车辆模型正在加载中，等待现有加载完成...');
        return loadingPromise;
    }

    // 创建新的加载 Promise 并缓存
    loadingPromise = new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        // 使用共享的 DRACOLoader 单例（性能优化）
        loader.setDRACOLoader(getSharedDracoLoader());

        loader.load(
            '/models/car.glb',
            (gltf) => {
                carModelTemplate = gltf.scene;
                // 由于车辆会添加到沙盘内部（沙盘scale=6），
                // 车辆会继承沙盘的缩放，所以这里设置为1即可
                carModelTemplate.scale.set(1, 1, 1);
                
                // 预计算车辆模板的包围盒（性能优化）
                cachedCarTemplateBox = new Box3().setFromObject(carModelTemplate);
                
                loadingPromise = null; // 加载完成后清除缓存的 Promise
                console.info('✅ 车辆模型模板加载成功');
                resolve(carModelTemplate);
            },
            undefined,
            (error) => {
                loadingPromise = null; // 加载失败后清除缓存的 Promise，允许重试
                console.error('❌ 车辆模型模板加载失败:', error);
                reject(error);
            }
        );
    });

    return loadingPromise;
};

/**
 * 添加车辆到场景
 * @param {number} vehicleId - 车辆ID
 * @param {object} position - 位置 {x, z} (模型坐标系)
 * @param {number} orientation - 朝向角度（弧度）
 * @param {string} color - 车辆颜色
 */
export const addVehicle = async (vehicleId, position, orientation = 0, color = '#409EFF') => {
    // 记录原始状态（用于错误回滚）
    const existingModel = vehicleModels.get(vehicleId);
    let modelAdded = false;
    let vehicleModel = null;
    
    try {
        // 参数验证（使用统一验证工具，消除代码重复）
        const idValidation = validateVehicleId(vehicleId);
        if (!idValidation.valid) {
            console.error(`❌ ${idValidation.error}`);
            return null;
        }
        
        const posValidation = validatePosition(position, 'model');
        if (!posValidation.valid) {
            console.error(`❌ 车辆 ${vehicleId} ${posValidation.error}`);
            return null;
        }
        
        const oriValidation = validateOrientation(orientation);
        if (!oriValidation.valid) {
            console.error(`❌ 车辆 ${vehicleId} ${oriValidation.error}`);
            return null;
        }
        
        // 如果已经存在，先删除
        if (existingModel) {
            removeVehicle(vehicleId);
        }

        // 加载车辆模型模板
        await loadCarModelTemplate();

        // 克隆模型
        vehicleModel = carModelTemplate.clone();
        
        // 获取沙盘模型以计算道路表面高度
        const sandboxModel = models.get('sandbox');
        if (!sandboxModel) {
            console.error('❌ 沙盘模型未找到，无法添加车辆');
            return null;
        }
        
        // 计算沙盘道路表面的局部Y坐标（使用缓存优化性能）
        if (!cachedSandboxBox) {
            cachedSandboxBox = new Box3().setFromObject(sandboxModel);
        }
        const roadSurfaceY = cachedSandboxBox.min.y;  // 道路表面 = 沙盘底部

        // 计算车辆模型的底部偏移（使用缓存的模板包围盒）
        const carBottomOffset = cachedCarTemplateBox ? cachedCarTemplateBox.min.y : new Box3().setFromObject(vehicleModel).min.y;
        
        // 设置车辆位置（使用沙盘局部坐标系）
        // position 已经是模型局部坐标 (x, z)，直接使用
        vehicleModel.position.set(
            position.x ?? 0,
            roadSurfaceY - carBottomOffset,  // 确保车底在道路表面
            position.z ?? 0
        );

        // 设置车辆朝向（从车辆坐标系角度转换为Three.js rotation.y）
        const safeOrientation = typeof orientation === 'number' ? orientation : 0;
        vehicleModel.rotation.y = safeOrientation - Math.PI / 2;

        // 将车辆添加到沙盘模型内部（而不是modelsGroup）
        // 这样车辆就使用沙盘的局部坐标系，和施工标记一致
        sandboxModel.add(vehicleModel);
        modelAdded = true;
        vehicleModels.set(vehicleId, vehicleModel);

        // console.info(`✅ 车辆 ${vehicleId} 已添加到场景 位置: (${position.x?.toFixed(2) ?? 'N/A'}, ${position.z?.toFixed(2) ?? 'N/A'})`);
        return vehicleModel;

    } catch (error) {
        console.error(`❌ 添加车辆 ${vehicleId} 失败:`, error);
        
        // 错误回滚：清理已添加的模型（使用统一清理工具）
        if (modelAdded && vehicleModel) {
            try {
                disposeObject3D(vehicleModel, { removeFromParent: true });
                vehicleModels.delete(vehicleId);
            } catch (rollbackError) {
                console.error(`❌ 回滚清理失败:`, rollbackError);
            }
        }
        
        // 如果之前存在模型但被删除了，尝试恢复（可选，取决于业务需求）
        // 这里选择不恢复，因为删除可能是有意的
        
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
        // 使用统一的资源清理工具（消除代码重复）
        disposeObject3D(vehicleModel, {
            removeFromParent: true,
            recursive: true
        });

        vehicleModels.delete(vehicleId);
        // console.info(`✅ 车辆 ${vehicleId} 已从场景移除并释放资源`);
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
    // 参数验证（使用统一验证工具）
    const idValidation = validateVehicleId(vehicleId);
    if (!idValidation.valid) {
        console.warn(`⚠️ updateVehiclePosition: ${idValidation.error}`);
        return false;
    }
    
    const vehicleModel = vehicleModels.get(vehicleId);
    if (vehicleModel) {
        // 直接更新位置（车辆已经在沙盘局部坐标系中）
        // 保持Y轴不变，因为车辆应该始终在道路表面
        if (position && typeof position === 'object') {
            if (typeof position.x === 'number') {
                vehicleModel.position.x = position.x;
            }
            if (typeof position.z === 'number') {
                vehicleModel.position.z = position.z;
            }
        }

        // 更新朝向
        if (typeof orientation === 'number') {
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
    const count = vehicleModels.size;
    
    // 使用统一的资源清理工具批量清理
    vehicleModels.forEach((model) => {
        disposeObject3D(model, { removeFromParent: true, recursive: true });
    });
    
    vehicleModels.clear();
    console.info(`✅ 已清除所有车辆 (${count}辆)`);
};

/**
 * 检查车辆是否存在
 */
export const hasVehicle = (vehicleId) => {
    return vehicleModels.has(vehicleId);
};

