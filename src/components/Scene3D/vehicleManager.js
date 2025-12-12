/**
 * 车辆模型动态管理模块
 * 负责在场景中动态添加、更新和移除车辆模型
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Box3, Group, Sprite, SpriteMaterial, CanvasTexture, Color, MeshStandardMaterial, Vector3 } from 'three';
import { validateVehicleId, validatePosition, validateOrientation } from '@/utils/validation.js';
import { disposeObject3D } from '@/utils/resourceCleanup.js';
import { modelToVehicleCoordinates, vehicleToModelCoordinates } from '@/utils/coordinateTransform.js';

// 车辆模型存储
const vehicleModels = new Map();  // key: vehicleId, value: model
let carModelTemplate = null;  // 车辆模型模板，用于克隆
let modelsGroup = null;  // 场景模型组
let models = null;  // 场景模型 Map

// 🔒 防止重复添加车辆的锁
const vehicleAddingLocks = new Map();  // key: vehicleId, value: Promise

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
let lastUpdateStartIndex = 0;  // 🎯 时间分片：上次更新的起始索引（轮流更新）

// 🚀 批量更新机制 - 收集多辆车的更新，统一处理并只触发一次markDirty
const pendingUpdates = new Map();  // 待处理的车辆更新
let batchUpdateTimer = null;       // 批量更新定时器
const BATCH_UPDATE_DELAY = 16;     // 批量更新延迟（毫秒）- 约1帧时间
let dirtyMarkScheduled = false;    // 是否已安排markDirty调用

// 插值配置
const INTERPOLATION_CONFIG = {
    enabled: false,          // 🔧 禁用插值 - 对50Hz高频数据，直接更新更流畅
    smoothFactor: 0.5,       // 🔧 提高平滑系数 - 如果启用插值，使用更快的响应速度
    minDistance: 0.001,      // 最小移动距离（米），小于此值不更新
    maxDistance: 0.5,        // 最大插值距离（米），超过此值直接跳转（防止传送效果）
    rotationSmooth: 0.5,     // 🔧 提高旋转插值系数 - 更快的朝向响应
    maxUpdatesPerFrame: 10   // 🔧 增加每帧更新数量 - 支持多车场景（之前是1，导致3辆车需要3帧才更新完）
};

// 🌉 高架桥高度配置
const ELEVATION_CONFIG = {
    enabled: true,           // 是否启用高架桥高度控制
    X1: 0.790,              // 左侧上坡区域边界 (车辆坐标系，米)
    X2: 5.205,              // 右侧下坡区域边界 (车辆坐标系，米)
    Y1: 2.958,              // 坡道开始高度 (车辆坐标系，米)
    Y2: 3.913,              // 高架桥开始高度 (车辆坐标系，米)
    BRIDGE_HEIGHT: 0.22,    // 高架桥高度 (沙盘局部坐标，米) - 需要根据实际测量调整
    
    // 计算坡度（自动计算，不需要手动设置）
    get SLOPE_LENGTH() {
        return this.Y2 - this.Y1;  // 坡道长度
    },
    get SLOPE_ANGLE() {
        // 坡度角（弧度）= arctan(高度差 / 水平距离)
        return Math.atan(this.BRIDGE_HEIGHT / this.SLOPE_LENGTH);
    },
    get SLOPE_ANGLE_DEGREES() {
        // 坡度角（度数）- 用于调试
        return this.SLOPE_ANGLE * 180 / Math.PI;
    }
};

/**
 * 🌉 根据车辆位置和朝向计算高度和倾角（高架桥系统）
 * @param {number} vehicleX - 车辆X坐标 (车辆坐标系，0-6m)
 * @param {number} vehicleY - 车辆Y坐标 (车辆坐标系，0-5m)
 * @param {number} orientation - 车辆朝向角度 (弧度)，用于判断移动方向
 * @returns {Object} { height, pitchAngle, region } - 高度增量(沙盘局部坐标)、倾角(弧度)、区域名称
 */
const calculateVehicleElevation = (vehicleX, vehicleY, orientation = null) => {
    if (!ELEVATION_CONFIG.enabled) {
        return { height: 0, pitchAngle: 0, region: 'ground' };
    }
    
    const { X1, X2, Y1, Y2, BRIDGE_HEIGHT, SLOPE_LENGTH, SLOPE_ANGLE } = ELEVATION_CONFIG;
    
    // 区域判断优先级（从上到下）：
    
    // 1️⃣ 高架桥区域（固定高度，Y > Y2）
    if (vehicleY > Y2) {
        return {
            height: BRIDGE_HEIGHT,
            pitchAngle: 0,
            region: 'bridge'
        };
    }
    
    // 2️⃣ 坡道区域（左侧或右侧，Y1 < Y <= Y2）
    const isInSlopeZone = vehicleY > Y1 && vehicleY <= Y2;
    const isLeftZone = vehicleX <= X1;
    const isRightZone = vehicleX >= X2;
    
    if (isInSlopeZone && (isLeftZone || isRightZone)) {
        const progress = (vehicleY - Y1) / SLOPE_LENGTH;  // 0-1，表示从Y1到Y2的进度
        
        // 🔑 关键：根据车辆朝向判断是上坡还是下坡
        let pitchAngle = 0;
        if (typeof orientation === 'number') {
            // 计算朝向在Y轴方向的分量（sin值）
            const dy = Math.sin(orientation);
            
            // dy > 0: Y在增大（朝+Y方向移动）→ 上坡（车头朝上，正倾角）
            // dy < 0: Y在减小（朝-Y方向移动）→ 下坡（车头朝下，负倾角）
            // 阈值0.05：只在接近垂直方向时判断，转弯时保持水平
            if (Math.abs(dy) > 0.05) {
                pitchAngle = dy > 0 ? SLOPE_ANGLE : -SLOPE_ANGLE;
            }
        } else {
            // 如果没有朝向信息，使用区域默认值（向后兼容）
            pitchAngle = isLeftZone ? SLOPE_ANGLE : -SLOPE_ANGLE;
        }
        
        const region = isLeftZone ? 'left_slope' : 'right_slope';
        
        return {
            height: progress * BRIDGE_HEIGHT,
            pitchAngle: pitchAngle,
            region: region
        };
    }
    
    // 3️⃣ 地面区域（默认）
    return {
        height: 0,
        pitchAngle: 0,
        region: 'ground'
    };
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
                carModelTemplate.scale.set(1, 1, 1);
                
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
 * 🎨 为克隆的车辆模型设置材质颜色（避免共享材质）
 * @param {Object3D} clonedModel - 克隆的车辆模型
 * @param {string} bodyColor - 车壳颜色（十六进制，如 '#409EFF'）
 */
const applyVehicleColors = (clonedModel, bodyColor) => {
    // 预定义的固定颜色
    // const WHEEL_COLOR = '#1a1a1a';        // 轮子：深黑色
    // const LIDAR_PANEL_COLOR = '#2a2a2a';  // 激光雷达面板：深灰色
    // const LIDAR_HEAD_COLOR = '#3a3a3a';   // 激光发射头：稍浅的灰色
    const WHEEL_COLOR = '#1a1a1a';        // 轮子：深黑色
    const LIDAR_PANEL_COLOR = '#4f5555';  // 激光雷达面板：深灰色
    const LIDAR_HEAD_COLOR = '#4f5555';   // 激光发射头：稍浅的灰色
    
    // 将十六进制颜色转为 Three.js Color 对象
    const wheelColor = new Color(WHEEL_COLOR);
    const bodyColorObj = new Color(bodyColor);
    const lidarPanelColor = new Color(LIDAR_PANEL_COLOR);
    const lidarHeadColor = new Color(LIDAR_HEAD_COLOR);
    
    // 递归遍历模型树，为每个 Mesh 克隆材质并设置颜色
    clonedModel.traverse((child) => {
        if (child.isMesh && child.material) {
            // 🔑 关键：克隆材质，避免多个车辆共享同一个材质对象
            const originalMaterial = child.material;
            const newMaterial = originalMaterial.clone();
            
            // 根据材质名称或对象名称判断部件类型
            const meshName = child.name.toLowerCase();
            const materialName = originalMaterial.name ? originalMaterial.name.toLowerCase() : '';
            
            // 🎨 根据部件类型设置颜色
            if (materialName.includes('material_0') || 
                materialName.includes('material_1') || 
                materialName.includes('material_2') || 
                materialName.includes('material_3') ||
                meshName.includes('wheel') || 
                meshName.includes('mesh_0') ||
                meshName.includes('mesh_1') ||
                meshName.includes('mesh_2') ||
                meshName.includes('mesh_3')) {
                // 轮子（Material_0 到 Material_3）
                newMaterial.color = wheelColor;
            } 
            else if (materialName.includes('material_4') || 
                     meshName.includes('body') || 
                     meshName.includes('mesh_4')) {
                // 车壳（Material_4）- 使用车辆自定义颜色
                newMaterial.color = bodyColorObj;
            } 
            else if (materialName.includes('material_5') || 
                     meshName.includes('lidar') || 
                     meshName.includes('mesh_5')) {
                // 激光雷达面板（Material_5）
                newMaterial.color = lidarPanelColor;
            } 
            else if (materialName.includes('material_6') || 
                     meshName.includes('mesh_6')) {
                // 激光发射头（Material_6）
                newMaterial.color = lidarHeadColor;
            } 
            else {
                // 未知部件，使用车身颜色
                newMaterial.color = bodyColorObj;
            }
            
            // 应用新材质到 Mesh
            child.material = newMaterial;
            
            // 🚀 性能优化：禁用不必要的材质特性
            newMaterial.needsUpdate = true;
        }
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
    // 🔒 防止重复添加：如果正在添加同一个车辆，等待之前的操作完成
    if (vehicleAddingLocks.has(vehicleId)) {
        console.warn(`⚠️ 车辆 ${vehicleId} 正在添加中，跳过重复调用`);
        return vehicleAddingLocks.get(vehicleId);
    }
    
    // 创建添加Promise并加锁
    const addingPromise = (async () => {
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
        
        // 🔑 关键：设置旋转顺序为 YXZ，确保倾角相对于车辆自身坐标系
        // YXZ 顺序：先绕Y轴旋转（朝向），再绕X轴旋转（倾角）
        vehicleModel.rotation.order = 'YXZ';
        
        // 克隆车辆模型并添加到容器组
        const carMesh = carModelTemplate.clone();
        carMesh.name = `Vehicle_${vehicleId}_Mesh`;
        
        // 🎨 为克隆的模型设置颜色（必须在添加到场景前完成）
        applyVehicleColors(carMesh, color);
        
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
        
        // 查找地面网格并计算道路表面高度（沙盘局部坐标）
        let roadSurfaceY = 0;
        if (!cachedSandboxBox) {
            // 查找地面网格（支持多种命名）
            const groundMeshNames = ['Standardmaterial206', 'MD_CaoPing', 'Ground', 'Plane', 'Floor'];
            let foundGroundMesh = null;
            let maxArea = 0;
            
            sandboxModel.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    const matchesName = groundMeshNames.some(name => child.name.includes(name));
                    if (matchesName) {
                        const box = new Box3().setFromObject(child);
                        const size = box.getSize(new Vector3());
                        const area = size.x * size.z;
                        
                        if (area > maxArea) {
                            maxArea = area;
                            foundGroundMesh = { mesh: child, box };
                        }
                    }
                }
            });
            
            if (foundGroundMesh) {
                // 将地面顶部的世界坐标转换为沙盘局部坐标
                const worldBox = foundGroundMesh.box;
                const worldTopCenter = new Vector3(
                    (worldBox.min.x + worldBox.max.x) / 2,
                    worldBox.max.y,  // 地面顶部（世界坐标）
                    (worldBox.min.z + worldBox.max.z) / 2
                );
                const localTopPoint = sandboxModel.worldToLocal(worldTopCenter.clone());
                roadSurfaceY = localTopPoint.y;  // 局部坐标
                
                // 缓存信息（包含世界坐标和局部坐标）
                cachedSandboxBox = {
                    worldBox: worldBox,
                    localY: roadSurfaceY
                };
                
                console.info(`✅ 车辆管理器：路面高度 (局部坐标Y) = ${roadSurfaceY.toFixed(4)} (基于: ${foundGroundMesh.mesh.name}, 世界Y: ${worldBox.max.y.toFixed(4)})`);
            } else {
                // 如果找不到地面网格，使用整个沙盘的底部（局部坐标）
                console.warn('⚠️ 车辆管理器：未找到地面网格，使用沙盘底部作为地面高度');
                const worldBox = new Box3().setFromObject(sandboxModel);
                const worldBottomCenter = new Vector3(
                    (worldBox.min.x + worldBox.max.x) / 2,
                    worldBox.min.y,
                    (worldBox.min.z + worldBox.max.z) / 2
                );
                const localBottomPoint = sandboxModel.worldToLocal(worldBottomCenter);
                roadSurfaceY = localBottomPoint.y;
                
                cachedSandboxBox = {
                    worldBox: worldBox,
                    localY: roadSurfaceY
                };
            }
        } else {
            // 使用缓存的地面高度（局部坐标）
            roadSurfaceY = cachedSandboxBox.localY;
        }

        // 计算车辆模型的底部偏移（使用缓存的模板包围盒）
        const carBottomOffset = cachedCarTemplateBox ? cachedCarTemplateBox.min.y : new Box3().setFromObject(vehicleModel).min.y;
        
        // 🌉 计算高架桥高度和倾角
        let elevationHeight = 0;
        let pitchAngle = 0;
        let regionName = 'ground';
        
        if (ELEVATION_CONFIG.enabled) {
            // 将沙盘局部坐标转换为车辆坐标系（用于判断区域）
            const vehicleCoords = modelToVehicleCoordinates(position.x ?? 0, position.z ?? 0);
            // 添加车辆时传入朝向，用于判断上下坡方向
            const elevation = calculateVehicleElevation(vehicleCoords.x, vehicleCoords.y, orientation);
            elevationHeight = elevation.height;
            pitchAngle = elevation.pitchAngle;
            regionName = elevation.region;
        }
        
        // 计算车辆最终的Y坐标（局部坐标系）
        const vehicleY = roadSurfaceY - carBottomOffset + elevationHeight;  // 基准高度 + 高架桥增量
        
        // 设置车辆位置（使用沙盘局部坐标系）
        // position 已经是模型局部坐标 (x, z)，直接使用
        vehicleModel.position.set(
            position.x ?? 0,
            vehicleY,
            position.z ?? 0
        );
        
        // 设置车辆倾角（高架桥坡度）
        vehicleModel.rotation.x = pitchAngle;
        
        console.log(`🚗 车辆 ${vehicleId} 位置设置:`);
        console.log(`  - 输入位置: (${position.x?.toFixed(3)}, ${position.z?.toFixed(3)})`);
        console.log(`  - 地面高度 (局部Y): ${roadSurfaceY.toFixed(4)}`);
        console.log(`  - 车底偏移: ${carBottomOffset.toFixed(4)}`);
        console.log(`  - 高架增量: ${elevationHeight.toFixed(4)} (区域: ${regionName})`);
        console.log(`  - 倾角: ${(pitchAngle * 180 / Math.PI).toFixed(2)}°`);
        console.log(`  - 最终位置 (局部): (${vehicleModel.position.x.toFixed(3)}, ${vehicleModel.position.y.toFixed(3)}, ${vehicleModel.position.z.toFixed(3)})`);
        
        // 转换为世界坐标并输出（调试用）
        const worldPos = sandboxModel.localToWorld(vehicleModel.position.clone());
        console.log(`  - 世界坐标: (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`);

        // 设置车辆朝向（从车辆坐标系角度转换为Three.js rotation.y）
        const safeOrientation = typeof orientation === 'number' ? orientation : 0;
        vehicleModel.rotation.y = safeOrientation - Math.PI / 2;

        // 将车辆添加到沙盘模型内部（而不是modelsGroup）
        // 这样车辆就使用沙盘的局部坐标系，和施工标记一致
        sandboxModel.add(vehicleModel);
        modelAdded = true;
        vehicleModels.set(vehicleId, vehicleModel);

        // 🚀 插值初始化：使用车辆的初始位置，避免从(0,0)开始插值
        if (INTERPOLATION_CONFIG.enabled) {
            vehicleInterpolationData.set(vehicleId, {
                targetPosition: { 
                    x: vehicleModel.position.x, 
                    z: vehicleModel.position.z 
                },
                targetOrientation: vehicleModel.rotation.y + Math.PI / 2
            });
        }

        console.info(`✅ 车辆 ${vehicleId} 已添加到场景`);
        console.info(`   沙盘局部坐标: X=${vehicleModel.position.x.toFixed(3)}, Y=${vehicleY.toFixed(3)}, Z=${vehicleModel.position.z.toFixed(3)}`);
        console.info(`   地面高度(局部): ${roadSurfaceY.toFixed(3)}, 车底偏移: ${carBottomOffset.toFixed(3)}`);
        
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
            
            return null;
        }
    })();
    
    // 设置锁
    vehicleAddingLocks.set(vehicleId, addingPromise);
    
    // 执行并清理锁
    try {
        const result = await addingPromise;
        return result;
    } finally {
        vehicleAddingLocks.delete(vehicleId);
    }
};

/**
 * 移除车辆从场景
 * @param {number} vehicleId - 车辆ID
 */
export const removeVehicle = (vehicleId) => {
    // 🔒 清理添加锁（如果正在添加中）
    vehicleAddingLocks.delete(vehicleId);
    
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
        
        // 🧹 清理待处理的更新队列（防止内存泄漏）
        pendingUpdates.delete(vehicleId);
        
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
 * 🚀 插值更新循环（时间分片：每帧只更新部分车辆，防止多车卡顿）
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

    // 🎯 时间分片优化：将所有车辆ID转为数组，实现轮流更新
    const vehicleIds = Array.from(vehicleInterpolationData.keys());
    const totalVehicles = vehicleIds.length;

    if (totalVehicles === 0) {
        interpolationRAF = requestAnimationFrame(interpolationUpdateLoop);
        return;
    }

    // 确定本帧要更新的车辆范围
    const maxUpdates = INTERPOLATION_CONFIG.maxUpdatesPerFrame;
    const startIdx = lastUpdateStartIndex % totalVehicles;
    const endIdx = Math.min(startIdx + maxUpdates, totalVehicles);
    
    // 更新本帧分配的车辆
    for (let i = startIdx; i < endIdx; i++) {
        const vehicleId = vehicleIds[i];
        const interpData = vehicleInterpolationData.get(vehicleId);
        const vehicleModel = vehicleModels.get(vehicleId);
        
        if (!vehicleModel || !interpData?.targetPosition) {
            // 🧹 清理孤立的插值数据（有插值数据但没有模型）
            if (!vehicleModel && interpData) {
                vehicleInterpolationData.delete(vehicleId);
            }
            continue;
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
    }

    // 🎯 更新下一帧的起始索引（轮流更新）
    lastUpdateStartIndex = endIdx % totalVehicles;
    
    // 如果本轮已经更新完所有车辆，重置索引
    if (endIdx >= totalVehicles) {
        lastUpdateStartIndex = 0;
    }

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
 * 🚀 批量处理待更新的车辆
 */
const processBatchUpdates = () => {
    if (pendingUpdates.size === 0) {
        batchUpdateTimer = null;
        return;
    }

    // 批量处理所有待更新的车辆
    for (const [vehicleId, updateData] of pendingUpdates.entries()) {
        const vehicleModel = vehicleModels.get(vehicleId);
        if (!vehicleModel) {
            continue;
        }

        const { position, orientation } = updateData;

        // 如果启用插值，更新目标位置
        if (INTERPOLATION_CONFIG.enabled) {
            let interpData = vehicleInterpolationData.get(vehicleId);
            if (!interpData) {
                interpData = {
                    targetPosition: { 
                        x: vehicleModel.position.x, 
                        z: vehicleModel.position.z 
                    },
                    targetOrientation: vehicleModel.rotation.y + Math.PI / 2
                };
                vehicleInterpolationData.set(vehicleId, interpData);
            }

            if (position && typeof position === 'object') {
                if (typeof position.x === 'number') {
                    interpData.targetPosition.x = position.x;
                }
                if (typeof position.z === 'number') {
                    interpData.targetPosition.z = position.z;
                }
            }

            if (typeof orientation === 'number') {
                interpData.targetOrientation = orientation;
            }
        } 
        // 如果未启用插值，直接更新位置
        else {
            if (position && typeof position === 'object') {
                if (typeof position.x === 'number') {
                    vehicleModel.position.x = position.x;
                }
                if (typeof position.z === 'number') {
                    vehicleModel.position.z = position.z;
                }
                
                // 🌉 应用高架桥高度和倾角
                if (ELEVATION_CONFIG.enabled && typeof position.x === 'number' && typeof position.z === 'number') {
                    // ⚠️ 检查缓存是否已初始化（在第一辆车添加时会初始化）
                    if (!cachedSandboxBox || !cachedCarTemplateBox) {
                        // 缓存未初始化时只更新倾角，不更新Y坐标
                        const vehicleCoords = modelToVehicleCoordinates(position.x, position.z);
                        // 传入朝向用于判断上下坡方向
                        const elevation = calculateVehicleElevation(vehicleCoords.x, vehicleCoords.y, orientation);
                        vehicleModel.rotation.x = elevation.pitchAngle;
                    } else {
                        // 将沙盘局部坐标转换为车辆坐标系（用于判断区域）
                        const vehicleCoords = modelToVehicleCoordinates(position.x, position.z);
                        
                        // 计算该位置的高度和倾角（传入朝向用于判断上下坡方向）
                        const elevation = calculateVehicleElevation(vehicleCoords.x, vehicleCoords.y, orientation);
                        
                        // 获取地面基准高度（缓存已验证存在）
                        const roadSurfaceY = cachedSandboxBox.localY;
                        const carBottomOffset = cachedCarTemplateBox.min.y;
                        
                        // 应用高度：基准高度 + 高架桥增量
                        vehicleModel.position.y = (roadSurfaceY - carBottomOffset) + elevation.height;
                        
                        // 应用倾角（绕X轴旋转，pitch角度）
                        vehicleModel.rotation.x = elevation.pitchAngle;
                    }
                }
            }

            if (typeof orientation === 'number') {
                vehicleModel.rotation.y = orientation - Math.PI / 2;
            }
        }
    }

    // 清空待更新队列
    pendingUpdates.clear();
    batchUpdateTimer = null;

    // 启动插值循环（如果启用）
    if (INTERPOLATION_CONFIG.enabled) {
        startInterpolationLoop();
    }

    // 🎯 批量更新完成后，统一触发一次markDirty（防抖）
    scheduleMarkDirty();
};

/**
 * 🎯 安排markDirty调用（防抖）- 避免频繁触发渲染
 */
const scheduleMarkDirty = () => {
    if (dirtyMarkScheduled) {
        return; // 已经安排了，跳过
    }

    dirtyMarkScheduled = true;
    
    // 使用 requestAnimationFrame 确保在下一帧渲染前标记
    requestAnimationFrame(() => {
        if (typeof window !== 'undefined' && window.__scene3d_markDirty) {
            window.__scene3d_markDirty();
        }
        dirtyMarkScheduled = false;
    });
};

/**
 * 更新车辆位置和朝向（批量更新优化）
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

    // 🚀 将更新添加到待处理队列
    pendingUpdates.set(vehicleId, { position, orientation });

    // 🚀 安排批量处理（防抖）
    if (batchUpdateTimer) {
        clearTimeout(batchUpdateTimer);
    }
    batchUpdateTimer = setTimeout(processBatchUpdates, BATCH_UPDATE_DELAY);

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
    
    // 🎯 重置时间分片索引
    lastUpdateStartIndex = 0;
    
    // 🔒 清理所有添加锁
    vehicleAddingLocks.clear();
    
    // 🧹 清理批量更新定时器（防止内存泄漏）
    if (batchUpdateTimer) {
        clearTimeout(batchUpdateTimer);
        batchUpdateTimer = null;
    }
    
    // 🧹 清理待处理的更新队列
    pendingUpdates.clear();
    
    console.info(`✅ 已清除所有车辆 (${count}辆)`);
};

/**
 * 检查车辆是否存在
 */
export const hasVehicle = (vehicleId) => {
    return vehicleModels.has(vehicleId);
};

/**
 * 🔍 调试工具：列出所有车辆状态
 */
export const debugListAllVehicles = () => {
    console.log('🔍 当前场景中的所有车辆:');
    console.log('═'.repeat(80));
    
    console.log(`📊 总数: ${vehicleModels.size} 个车辆模型, ${vehicleInterpolationData.size} 个插值数据, ${vehicleAddingLocks.size} 个添加锁`);
    
    if (vehicleModels.size > 0) {
        console.log('\n🚗 车辆模型列表:');
        vehicleModels.forEach((model, id) => {
            const interpData = vehicleInterpolationData.get(id);
            const isAdding = vehicleAddingLocks.has(id);
            console.log(`  [${id}] ${model.name}:`);
            console.log(`    位置: (${model.position.x.toFixed(2)}, ${model.position.y.toFixed(2)}, ${model.position.z.toFixed(2)})`);
            console.log(`    朝向: ${((model.rotation.y + Math.PI/2) * 180 / Math.PI).toFixed(1)}°`);
            console.log(`    子对象: ${model.children.length} 个`);
            console.log(`    父对象: ${model.parent?.name || 'none'}`);
            console.log(`    插值数据: ${interpData ? '✓' : '✗'}`);
            console.log(`    正在添加: ${isAdding ? '⚠️ 是' : '否'}`);
            if (interpData) {
                console.log(`      目标位置: (${interpData.targetPosition.x.toFixed(2)}, ${interpData.targetPosition.z.toFixed(2)})`);
            }
        });
    }
    
    // 检查是否有孤立的插值数据
    const orphanedInterpData = [];
    vehicleInterpolationData.forEach((data, id) => {
        if (!vehicleModels.has(id)) {
            orphanedInterpData.push(id);
        }
    });
    
    if (orphanedInterpData.length > 0) {
        console.log(`⚠️ 发现 ${orphanedInterpData.length} 个孤立的插值数据:`, orphanedInterpData);
    }
    
    // 检查是否有孤立的添加锁
    if (vehicleAddingLocks.size > 0) {
        console.log(`🔒 当前有 ${vehicleAddingLocks.size} 个添加锁:`, Array.from(vehicleAddingLocks.keys()));
    }
    
    console.log('═'.repeat(80));
    
    return {
        modelCount: vehicleModels.size,
        interpDataCount: vehicleInterpolationData.size,
        lockCount: vehicleAddingLocks.size,
        orphanedCount: orphanedInterpData.length
    };
};

/**
 * 🔍 调试工具：查看高架桥配置
 */
export const debugElevationConfig = () => {
    console.log('🌉 高架桥配置:');
    console.log('═'.repeat(80));
    console.log(`启用状态: ${ELEVATION_CONFIG.enabled ? '✅ 已启用' : '❌ 已禁用'}`);
    console.log(`\n📏 边界坐标 (车辆坐标系):`);
    console.log(`  X1 (左侧边界): ${ELEVATION_CONFIG.X1}m`);
    console.log(`  X2 (右侧边界): ${ELEVATION_CONFIG.X2}m`);
    console.log(`  Y1 (坡道起点): ${ELEVATION_CONFIG.Y1}m`);
    console.log(`  Y2 (高架起点): ${ELEVATION_CONFIG.Y2}m`);
    console.log(`\n📐 高度和坡度:`);
    console.log(`  高架桥高度: ${ELEVATION_CONFIG.BRIDGE_HEIGHT}m (沙盘局部坐标)`);
    console.log(`  坡道长度: ${ELEVATION_CONFIG.SLOPE_LENGTH.toFixed(3)}m`);
    console.log(`  坡度角: ${ELEVATION_CONFIG.SLOPE_ANGLE_DEGREES.toFixed(2)}°`);
    console.log(`  坡度角 (弧度): ${ELEVATION_CONFIG.SLOPE_ANGLE.toFixed(4)}`);
    console.log('═'.repeat(80));
    
    return { ...ELEVATION_CONFIG };
};

/**
 * 🔧 调试工具：更新高架桥配置
 */
export const updateElevationConfig = (config) => {
    if (typeof config.enabled === 'boolean') {
        ELEVATION_CONFIG.enabled = config.enabled;
    }
    if (typeof config.X1 === 'number') {
        ELEVATION_CONFIG.X1 = config.X1;
    }
    if (typeof config.X2 === 'number') {
        ELEVATION_CONFIG.X2 = config.X2;
    }
    if (typeof config.Y1 === 'number') {
        ELEVATION_CONFIG.Y1 = config.Y1;
    }
    if (typeof config.Y2 === 'number') {
        ELEVATION_CONFIG.Y2 = config.Y2;
    }
    if (typeof config.BRIDGE_HEIGHT === 'number') {
        ELEVATION_CONFIG.BRIDGE_HEIGHT = config.BRIDGE_HEIGHT;
    }
    
    console.log('✅ 高架桥配置已更新');
    debugElevationConfig();
    
    return ELEVATION_CONFIG;
};

/**
 * 🧪 调试工具：测试指定坐标的高度和倾角
 * @param {number} vehicleX - 车辆X坐标
 * @param {number} vehicleY - 车辆Y坐标
 * @param {number} orientation - 车辆朝向（弧度，可选）
 */
export const testElevationAt = (vehicleX, vehicleY, orientation = null) => {
    const elevation = calculateVehicleElevation(vehicleX, vehicleY, orientation);
    
    console.log(`🧪 坐标 (${vehicleX.toFixed(3)}, ${vehicleY.toFixed(3)}) 的高度测试:`);
    if (orientation !== null) {
        console.log(`  朝向: ${(orientation * 180 / Math.PI).toFixed(1)}° (${orientation.toFixed(3)} rad)`);
        console.log(`  Y方向分量: ${Math.sin(orientation).toFixed(3)} (${Math.sin(orientation) > 0 ? '朝+Y(上坡)' : '朝-Y(下坡)'})`);
    }
    console.log(`  区域: ${elevation.region}`);
    console.log(`  高度增量: ${elevation.height.toFixed(4)}m`);
    console.log(`  倾角: ${(elevation.pitchAngle * 180 / Math.PI).toFixed(2)}° (${elevation.pitchAngle.toFixed(4)} rad)`);
    console.log(`  ${elevation.pitchAngle > 0 ? '↗️ 上坡(车头朝上)' : elevation.pitchAngle < 0 ? '↘️ 下坡(车头朝下)' : '→ 平地'}`);
    
    return elevation;
};

// 全局暴露调试函数和数据（用于分析模型结构）
if (typeof window !== 'undefined') {
    window.__debugVehicles = debugListAllVehicles;
    window.__vehicleModels = vehicleModels; // 暴露供分析脚本使用
    
    // 🌉 高架桥调试工具
    window.__debugElevation = debugElevationConfig;
    window.__updateElevation = updateElevationConfig;
    window.__testElevation = testElevationAt;
}

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

/**
 * 🔄 清除沙盘缓存（当沙盘模型更换时调用）
 */
export const clearSandboxCache = () => {
    cachedSandboxBox = null;
    cachedCarTemplateBox = null;
    console.log('🔄 车辆管理器：沙盘缓存已清除');
};

