/**
 * 车辆模型动态管理模块
 * 负责在场景中动态添加、更新和移除车辆模型
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Box3, Group, Sprite, SpriteMaterial, CanvasTexture, Color } from 'three';
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

// 🚀 性能优化：插值系统（平滑车辆移动）
const vehicleInterpolationData = new Map();  // 存储每个车辆的插值数据
let interpolationRAF = null;  // requestAnimationFrame ID
let lastInterpolationTime = 0;  // 上次插值更新时间

// 插值配置
const INTERPOLATION_CONFIG = {
    enabled: true,           // 是否启用插值
    smoothFactor: 0.25,      // 插值平滑系数 (0-1)，越小越平滑但延迟越大
    minDistance: 0.001,      // 最小移动距离（米），小于此值不更新
    maxDistance: 0.5,        // 最大插值距离（米），超过此值直接跳转（防止传送效果）
    rotationSmooth: 0.3      // 旋转插值系数
};

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
                carModelTemplate.scale.set(0.001, 0.001, 0.001);
                
                // 🔧 关键修复：应用旋转后再计算包围盒
                // 因为实际使用时车辆会被旋转 -90°（carMesh.rotation.x = -Math.PI / 2）
                // 所以需要在相同旋转状态下计算包围盒，确保底部对齐准确
                // 注意：carModelTemplate 在第82行已应用了缩放，clone() 会继承
                const tempContainer = new Group();
                const tempMesh = carModelTemplate.clone();
                tempMesh.rotation.x = -Math.PI / 2;  // 应用相同的旋转
                tempContainer.add(tempMesh);
                
                // 预计算车辆模板的包围盒（性能优化）
                cachedCarTemplateBox = new Box3().setFromObject(tempContainer);
                
                console.info('✅ 车辆模型模板加载成功');
                console.info(`   包围盒底部 Y: ${cachedCarTemplateBox.min.y.toFixed(4)}`);
                console.info(`   包围盒顶部 Y: ${cachedCarTemplateBox.max.y.toFixed(4)}`);
                console.info(`   模型高度: ${(cachedCarTemplateBox.max.y - cachedCarTemplateBox.min.y).toFixed(4)}`);
                
                loadingPromise = null; // 加载完成后清除缓存的 Promise
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
 * 创建车辆编号标签（使用 Canvas 渲染文字并生成 Sprite）
 * @param {number} vehicleId - 车辆ID
 * @param {string} color - 车辆颜色（用于标签背景）
 * @returns {Sprite} 车辆编号标签 Sprite
 */
const createVehicleLabel = (vehicleId, color = '#409EFF') => {
    // 创建 Canvas 用于绘制文字
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // 设置 Canvas 尺寸（高分辨率，提高清晰度）
    canvas.width = 256;
    canvas.height = 128;
    
    // 将车辆颜色调暗作为背景色（使用 Three.js Color 类处理）
    const threeColor = new Color(color);
    threeColor.multiplyScalar(0.4); // 将颜色调暗到原来的 40%（更深）
    const darkerColor = '#' + threeColor.getHexString();
    
    // 绘制背景（带圆角矩形 + 底部尖角，类似对话气泡）
    context.fillStyle = darkerColor;
    context.globalAlpha = 1.0; // 背景完全不透明，显得更深
    const radius = 20;
    const x = 10;
    const y = 10;
    const width = canvas.width - 20;
    const height = canvas.height - 40; // 留出空间给底部尖角
    const tipWidth = 30; // 尖角宽度
    const tipHeight = 25; // 尖角高度
    
    context.beginPath();
    // 顶部左圆角
    context.moveTo(x + radius, y);
    // 顶部边
    context.lineTo(x + width - radius, y);
    // 顶部右圆角
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    // 右侧边
    context.lineTo(x + width, y + height - radius);
    // 底部右圆角
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    // 底部边到尖角右侧
    context.lineTo(x + width / 2 + tipWidth / 2, y + height);
    // 绘制底部尖角（三角形）
    context.lineTo(x + width / 2, y + height + tipHeight); // 尖角顶点
    context.lineTo(x + width / 2 - tipWidth / 2, y + height); // 尖角左侧
    // 底部边到左侧
    context.lineTo(x + radius, y + height);
    // 底部左圆角
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    // 左侧边
    context.lineTo(x, y + radius);
    // 顶部左圆角
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.fill();
    
    // 绘制边框（同样包含尖角）
    context.strokeStyle = '#FFFFFF';
    context.lineWidth = 4;
    context.globalAlpha = 1.0;
    context.beginPath();
    // 重新绘制一遍相同的路径用于描边
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + width / 2 + tipWidth / 2, y + height);
    context.lineTo(x + width / 2, y + height + tipHeight);
    context.lineTo(x + width / 2 - tipWidth / 2, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.stroke();
    
    // 绘制文字（在矩形主体中央，不包括尖角部分）
    context.fillStyle = '#FFFFFF';
    context.font = 'bold 60px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const textY = y + height / 2; // 在矩形主体（不含尖角）的垂直中央
    context.fillText(`${vehicleId}`, canvas.width / 2, textY);
    
    // 创建纹理
    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // 创建 Sprite 材质
    const spriteMaterial = new SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        sizeAttenuation: true // 标签大小随距离变化，有透视效果
    });
    
    // 创建 Sprite
    const sprite = new Sprite(spriteMaterial);
    sprite.name = `VehicleLabel_${vehicleId}`;
    sprite.scale.set(0.15, 0.12, 1); // 调整标签大小，保持合适的显示效果
    
    return sprite;
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

        // 创建容器组（用于分离模型修正旋转和运动朝向旋转）
        vehicleModel = new Group();
        vehicleModel.name = `Vehicle_${vehicleId}_Container`;
        
        // 克隆车辆模型并添加到容器组
        const carMesh = carModelTemplate.clone();
        carMesh.name = `Vehicle_${vehicleId}_Mesh`;
        
        // 在容器组内修正模型朝向（固定旋转，不会受运动朝向影响）
        carMesh.rotation.x = -Math.PI / 2;  // 修正模型方向
        
        vehicleModel.add(carMesh);
        
        // 🏷️ 创建并添加车辆编号标签（显示在车辆头顶）
        const vehicleLabel = createVehicleLabel(vehicleId, color);
        // 将标签放置在车辆上方（相对于车辆容器的局部坐标）
        vehicleLabel.position.set(0, 0.22, 0);  // Y轴向上，调整高度使尖角刚好指向车顶
        vehicleModel.add(vehicleLabel);
        
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
        
        // 🚀 清理插值数据
        vehicleInterpolationData.delete(vehicleId);
        
        // 如果没有车辆了，停止插值循环
        if (vehicleModels.size === 0) {
            stopInterpolationLoop();
        }
        
        // console.info(`✅ 车辆 ${vehicleId} 已从场景移除并释放资源`);
        return true;
    }
    return false;
};

/**
 * 🚀 插值更新循环（使用 requestAnimationFrame 批量更新所有车辆）
 */
const interpolationUpdateLoop = (currentTime) => {
    if (!INTERPOLATION_CONFIG.enabled) {
        interpolationRAF = null;
        return;
    }

    // 计算帧间隔时间（毫秒）
    const deltaTime = lastInterpolationTime ? currentTime - lastInterpolationTime : 16;
    lastInterpolationTime = currentTime;

    let needsRender = false;

    // 批量更新所有车辆（性能优化：一次遍历处理所有车辆）
    vehicleInterpolationData.forEach((interpData, vehicleId) => {
        const vehicleModel = vehicleModels.get(vehicleId);
        if (!vehicleModel || !interpData.targetPosition) {
            return;
        }

        // 计算当前位置到目标位置的距离
        const dx = interpData.targetPosition.x - vehicleModel.position.x;
        const dz = interpData.targetPosition.z - vehicleModel.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // 如果距离太小，直接设置到目标位置
        if (distance < INTERPOLATION_CONFIG.minDistance) {
            vehicleModel.position.x = interpData.targetPosition.x;
            vehicleModel.position.z = interpData.targetPosition.z;
        }
        // 如果距离太大，直接跳转（防止传送效果）
        else if (distance > INTERPOLATION_CONFIG.maxDistance) {
            vehicleModel.position.x = interpData.targetPosition.x;
            vehicleModel.position.z = interpData.targetPosition.z;
            needsRender = true;
        }
        // 使用插值平滑移动
        else {
            // 使用线性插值（lerp）
            vehicleModel.position.x += dx * INTERPOLATION_CONFIG.smoothFactor;
            vehicleModel.position.z += dz * INTERPOLATION_CONFIG.smoothFactor;
            needsRender = true;
        }

        // 朝向插值（处理角度环绕问题）
        if (typeof interpData.targetOrientation === 'number') {
            const targetRot = interpData.targetOrientation - Math.PI / 2;
            const currentRot = vehicleModel.rotation.y;
            
            // 处理角度环绕（-PI 到 PI）
            let rotDiff = targetRot - currentRot;
            if (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            if (rotDiff < -Math.PI) rotDiff += Math.PI * 2;

            // 如果角度差很小，直接设置
            if (Math.abs(rotDiff) < 0.01) {
                vehicleModel.rotation.y = targetRot;
            } else {
                vehicleModel.rotation.y += rotDiff * INTERPOLATION_CONFIG.rotationSmooth;
                needsRender = true;
            }
        }
    });

    // 如果有更新，标记场景需要重新渲染
    if (needsRender) {
        // 通知Scene3D标记为dirty（需要重新渲染）
        if (typeof window !== 'undefined' && window.__scene3d_markDirty) {
            window.__scene3d_markDirty();
        }
    }

    // 继续下一帧
    interpolationRAF = requestAnimationFrame(interpolationUpdateLoop);
};

/**
 * 启动插值更新循环
 */
const startInterpolationLoop = () => {
    if (!interpolationRAF && INTERPOLATION_CONFIG.enabled) {
        lastInterpolationTime = 0;
        interpolationRAF = requestAnimationFrame(interpolationUpdateLoop);
        console.info('🚀 车辆插值系统已启动');
    }
};

/**
 * 停止插值更新循环
 */
const stopInterpolationLoop = () => {
    if (interpolationRAF) {
        cancelAnimationFrame(interpolationRAF);
        interpolationRAF = null;
        console.info('⏸️ 车辆插值系统已停止');
    }
};

/**
 * 更新车辆位置和朝向（使用插值优化）
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
    if (!vehicleModel) {
        return false;
    }

    // 如果启用插值，更新目标位置
    if (INTERPOLATION_CONFIG.enabled) {
        // 获取或创建插值数据
        let interpData = vehicleInterpolationData.get(vehicleId);
        if (!interpData) {
            interpData = {
                targetPosition: { x: 0, z: 0 },
                targetOrientation: 0
            };
            vehicleInterpolationData.set(vehicleId, interpData);
        }

        // 更新目标位置
        if (position && typeof position === 'object') {
            if (typeof position.x === 'number') {
                interpData.targetPosition.x = position.x;
            }
            if (typeof position.z === 'number') {
                interpData.targetPosition.z = position.z;
            }
        }

        // 更新目标朝向
        if (typeof orientation === 'number') {
            interpData.targetOrientation = orientation;
        }

        // 确保插值循环正在运行
        startInterpolationLoop();
    } 
    // 如果未启用插值，直接更新位置（旧行为）
    else {
        if (position && typeof position === 'object') {
            if (typeof position.x === 'number') {
                vehicleModel.position.x = position.x;
            }
            if (typeof position.z === 'number') {
                vehicleModel.position.z = position.z;
            }
        }

        if (typeof orientation === 'number') {
            vehicleModel.rotation.y = orientation - Math.PI / 2;
        }
    }

    return true;
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
    
    // 🚀 清理所有插值数据
    vehicleInterpolationData.clear();
    stopInterpolationLoop();
    
    console.info(`✅ 已清除所有车辆 (${count}辆)`);
};

/**
 * 检查车辆是否存在
 */
export const hasVehicle = (vehicleId) => {
    return vehicleModels.has(vehicleId);
};

/**
 * 🚀 获取插值配置
 */
export const getInterpolationConfig = () => {
    return { ...INTERPOLATION_CONFIG };
};

/**
 * 🚀 更新插值配置
 * @param {object} config - 配置对象
 */
export const updateInterpolationConfig = (config) => {
    if (typeof config.enabled === 'boolean') {
        INTERPOLATION_CONFIG.enabled = config.enabled;
        if (!config.enabled) {
            stopInterpolationLoop();
        }
    }
    if (typeof config.smoothFactor === 'number' && config.smoothFactor >= 0 && config.smoothFactor <= 1) {
        INTERPOLATION_CONFIG.smoothFactor = config.smoothFactor;
    }
    if (typeof config.minDistance === 'number' && config.minDistance >= 0) {
        INTERPOLATION_CONFIG.minDistance = config.minDistance;
    }
    if (typeof config.maxDistance === 'number' && config.maxDistance >= 0) {
        INTERPOLATION_CONFIG.maxDistance = config.maxDistance;
    }
    if (typeof config.rotationSmooth === 'number' && config.rotationSmooth >= 0 && config.rotationSmooth <= 1) {
        INTERPOLATION_CONFIG.rotationSmooth = config.rotationSmooth;
    }
    console.info('🚀 插值配置已更新:', INTERPOLATION_CONFIG);
};

