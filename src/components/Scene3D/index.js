import {
    DRACOLoader,
    GLTFLoader,
    OrbitControls,
} from 'three/examples/jsm/Addons.js';
import {
    AmbientLight,
    CubeTextureLoader,
    DirectionalLight,
    HemisphereLight,
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
    Clock,
    LOD,
    BufferAttribute,
    LinearFilter,
    LinearMipmapLinearFilter,
    Vector3,
    Raycaster,
    Group,
    AxesHelper,
    Box3,
    GridHelper,
    LineBasicMaterial,
    BufferGeometry,
    Line,
    SphereGeometry,
    MeshBasicMaterial,
    Mesh,
    PlaneGeometry,
    DoubleSide,
    TextureLoader,
    SpriteMaterial,
    Sprite,
    ConeGeometry,
    CanvasTexture,
    CylinderGeometry,
    Quaternion,
    ACESFilmicToneMapping,
    SRGBColorSpace,
} from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import eventBus, { EVENTS } from '@/utils/eventBus.js';
import { updateSandboxBounds } from '@/utils/coordinateTransform.js';
import { 
    initVehicleManager, 
    addVehicle as addVehicleToScene, 
    removeVehicle as removeVehicleFromScene, 
    updateVehiclePosition as updateVehicleInScene,
    clearAllVehicles,
    getAllVehicleIds,
    hasVehicle,
    clearSandboxCache as clearVehicleManagerSandboxCache
} from './vehicleManager.js';
import { 
    initPathRenderer, 
    destroyPathRenderer,
    clearAllPaths
} from './pathRenderer.js';
import {
    initTrafficLightManager,
    updateTrafficLightGroup,
    destroyTrafficLightManager,
    isInitialized as isTrafficLightManagerInitialized
} from './trafficLightManager.js';

let scene, camera, container, renderer, controls, stats, clock;
let models = new Map(); // 模型缓存
let resizeHandler = null;
let isVisible = true;
let performanceMode = 'auto'; // auto, high, low
let frameCount = 0;
let lastFPSCheck = 0;
let currentFPS = 60;
let isPerformanceAdjusting = false; // 防抖标志，避免频繁性能调整

// 性能优化相关
let rafId = null;
let shouldRender = true;
let isPaused = false; // 渲染暂停状态
let lastRenderTime = 0;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS;

// 定时器追踪（防止内存泄漏）
let performanceAdjustTimer = null;
let batchProcessingTimers = [];
let sceneInitTimers = []; // 追踪场景初始化相关的定时器

// 场景组织
let sceneGroup = null;
let lightsGroup = null;
let modelsGroup = null;
let axesHelper = null; // 坐标轴辅助器
let defaultCameraState = null; // 初始视角
let constructionMarker = null; // 施工标记
let isAnimatingView = false; // 视角动画中标志

// 位姿选择相关
let isPoseSelectionMode = false;
let raycaster = new Raycaster();
let mouse = new Vector3();
let isMouseDown = false;
let startPosition = null;
let currentPosition = null;
let directionLine = null;
let positionMarker = null;
let directionArrow = null;
let angleLabel = null;
let groundPlane = null;
let poseSelectionCallback = null;

export const initScene = dom => {
    container = dom;
    clock = new Clock();

    // 发送初始化开始事件
    eventBus.emit(EVENTS.SCENE3D_PROGRESS, 0);

    // 异步初始化场景以避免阻塞主线程
    setTimeout(() => {
        initSceneCore();
    }, 0);
};

const initSceneCore = async () => {
    try {
        // 步骤1：创建基础场景 (10%)
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, 10);
        await new Promise(resolve => setTimeout(resolve, 0));
        
        scene = new Scene();
        
        // 创建场景组织结构
        sceneGroup = new Group();
        sceneGroup.name = 'SceneGroup';
        
        lightsGroup = new Group();
        lightsGroup.name = 'LightsGroup';
        
        modelsGroup = new Group();
        modelsGroup.name = 'ModelsGroup';
        
        scene.add(sceneGroup);
        sceneGroup.add(lightsGroup);
        sceneGroup.add(modelsGroup);
        
        // 添加坐标轴辅助器
        createCoordinateAxes();

        // 步骤2：创建相机 (20%)
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, 20);
        await new Promise(resolve => setTimeout(resolve, 0));
        
        camera = new PerspectiveCamera(
            21,
            container.clientWidth / container.clientHeight,
            0.1,    // near: 从 1 改为 0.1，增加深度缓冲区精度
            1000    // far
        );
        camera.position.set(0, 40, 50);
        camera.lookAt(0, 0, 0);
        // 记录默认视角
        defaultCameraState = {
            position: camera.position.clone(),
            target: new Vector3(0, 0, 0)
        };

        // 步骤3：创建控制器 (30%)
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, 30);
        await new Promise(resolve => setTimeout(resolve, 0));
        
        controls = new OrbitControls(camera, container);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enablePan = false;
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI / 2;
        controls.minDistance = 20;
        controls.maxDistance = 200;
        
        // 🔧 增强触屏支持（Ubuntu 触屏设备）
        // TOUCH.ROTATE=0, TOUCH.DOLLY_PAN=1, TOUCH.DOLLY_ROTATE=2
        controls.touches = {
            ONE: 0,   // 单指旋转 (TOUCH.ROTATE)
            TWO: 1    // 双指缩放+平移 (TOUCH.DOLLY_PAN)
        };
        controls.enableZoom = true;           // 确保缩放功能启用
        controls.zoomSpeed = 1.0;             // 缩放速度
        controls.rotateSpeed = 0.5;           // 旋转速度

        // 步骤4：创建渲染器 (50%)
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, 50);
        await new Promise(resolve => setTimeout(resolve, 0));
        
        renderer = new WebGLRenderer({
            antialias: true, // 开启抗锯齿，提升视觉质量
            alpha: false, // 禁用透明度以提高性能
            powerPreference: "high-performance",
            stencil: false,
            depth: true,
            logarithmicDepthBuffer: true,  // 启用对数深度缓冲，解决 Z-fighting（闪烁）问题
            preserveDrawingBuffer: false,
            failIfMajorPerformanceCaveat: false // 允许软件渲染
        });
        
        // 渲染器性能优化
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // 限制像素比
        renderer.shadowMap.enabled = false;
        renderer.sortObjects = false; // 禁用对象排序以提升性能
        renderer.outputColorSpace = SRGBColorSpace;
        
        // 🎨 色调映射（Tone Mapping）- 模拟烘焙效果
        renderer.toneMapping = ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.8; // 曝光度（降低以避免过曝发白）
        
        // 物理光照
        renderer.useLegacyLights = false; // 使用物理光照模式（Three.js r155+）
        
        console.log('✨ 渲染器优化: 色调映射(ACES)、曝光度0.8、物理光照已启用');
        
        // WebGL状态同步
        const gl = renderer.getContext();
        if (gl) {
            gl.flush();
            gl.finish();
        }
        
        // 设置渲染器尺寸
        renderer.setSize(container.clientWidth, container.clientHeight);
        
        // 设置canvas的层级，确保不会穿透到对话框上
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.zIndex = '0';
        
        // 🔧 关键修复：触屏设备支持 + 防止事件穿透
        // touchAction: 'none' 让 OrbitControls 完全控制触屏手势
        // 由于触屏事件只监听在 canvas 上，不会影响 UI 滚动
        renderer.domElement.style.touchAction = 'none'; 
        renderer.domElement.setAttribute('data-scene3d-canvas', 'true'); // 标记用于事件检查
        
        container.appendChild(renderer.domElement);

        // 步骤5：性能自适应和事件处理 (60%)
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, 60);
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // 性能自适应
        adaptPerformance();

        // 优化的 resize 处理
        resizeHandler = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;

            if (width === 0 || height === 0) return; // 防止无效尺寸

            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };

        // 监听resize事件
        window.addEventListener('resize', resizeHandler);
        resizeHandler();
        
        // 添加鼠标事件监听
        setupMouseEventListeners();

        // 监听来自Map.vue的视角与标记事件
        eventBus.on(EVENTS.SCENE3D_TOPDOWN, handleTopDownView)
        eventBus.on(EVENTS.SCENE3D_DEFAULT, handleDefaultView)
        // 不再监听施工标记事件

        // 性能监控（开发环境）
        if (import.meta.env.DEV) {
            stats = new Stats();
            container.appendChild(stats.dom);
        }

        // 步骤6：启动渲染循环 (70%)
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, 70);
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // 智能渲染循环
        animate = (currentTime = performance.now()) => {
            if (!shouldRender) {
                rafId = requestAnimationFrame(animate);
                return;
            }

            if (!renderer || !scene || !camera) {
                lastRenderTime = currentTime;
                lastFPSCheck = currentTime;
                rafId = requestAnimationFrame(animate);
                return;
            }

            if (currentTime - lastRenderTime < frameInterval) {
                rafId = requestAnimationFrame(animate);
                return;
            }

            frameCount++;
            lastRenderTime = currentTime;

            renderer.render(scene, camera);

            controls.update();

            // ❌ 移除每帧的 scene.traverse() - 性能优化
            // 如果需要更新shader的uTime，应该在创建材质时缓存对象，而不是每帧遍历
            // const delta = clock?.getDelta?.() ?? 0;
            // scene.traverse((object) => { ... });

            // ❌ 移除每帧的进度事件 - 性能优化（只在初始化阶段需要）
            // eventBus.emit(EVENTS.SCENE3D_PROGRESS, ...);

            if (stats) {
                stats.update();
            }

            if (currentTime - lastFPSCheck >= 1000) {
                currentFPS = Math.round((frameCount * 1000) / (currentTime - lastFPSCheck));
                frameCount = 0;
                lastFPSCheck = currentTime;

                eventBus.emit(EVENTS.FPS_UPDATE, {
                    fps: currentFPS,
                });

                if (performanceMode === 'auto') {
                    if (currentFPS < 15 && !isPerformanceAdjusting) {
                        isPerformanceAdjusting = true;
                        // 清除之前的定时器
                        if (performanceAdjustTimer) {
                            clearTimeout(performanceAdjustTimer);
                        }
                        performanceAdjustTimer = setTimeout(() => {
                            switchToLowPerformance();
                            isPerformanceAdjusting = false;
                            performanceAdjustTimer = null;
                        }, 2000);
                    } else if (currentFPS > 55 && !isPerformanceAdjusting) {
                        isPerformanceAdjusting = true;
                        // 清除之前的定时器
                        if (performanceAdjustTimer) {
                            clearTimeout(performanceAdjustTimer);
                        }
                        performanceAdjustTimer = setTimeout(() => {
                            switchToHighPerformance();
                            isPerformanceAdjusting = false;
                            performanceAdjustTimer = null;
                        }, 2000);
                    }
                }
            }

            rafId = requestAnimationFrame(animate);
        };

        rafId = requestAnimationFrame(animate);

        // 步骤7：设置光照 (80%)
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, 80);
        await new Promise(resolve => setTimeout(resolve, 0));
        
        setupLighting();

        // 步骤8：基础场景完成，开始异步加载资源 (70%)
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, 70);
        
        // 异步加载环境贴图（不阻塞）
        loadEnvironment();
        
        // 异步加载模型（不阻塞，带进度反馈）
        loadModelsWithProgress();
        
        // 初始化车辆管理器
        initVehicleManager(modelsGroup, models);
        
        // 注意：路径渲染器需要在沙盘模型加载完成后才能正确初始化
        // 所以在这里先不初始化，等沙盘加载完成后再初始化
        // initPathRenderer(scene, modelsGroup);
        
        // 🔍 暴露调试对象到 window (仅开发环境)
        if (import.meta.env.DEV || true) {  // 暂时在所有环境都启用，便于诊断
            window.__scene3d__ = {
                scene,
                camera,
                renderer,
                controls,
                models,
                modelsGroup,
                // 辅助调试函数
                getSandboxModel: () => models.get('sandbox'),
                getCarsModel: () => models.get('cars'),
                adjustSandboxScale: (scale) => {
                    const sandbox = models.get('sandbox');
                    if (sandbox) {
                        sandbox.scale.setScalar(scale);
                        console.log(`✅ 沙盘缩放已调整为: ${scale}`);
                    } else {
                        console.error('❌ 沙盘模型未找到');
                    }
                },
                adjustSandboxPosition: (x, y, z) => {
                    const sandbox = models.get('sandbox');
                    if (sandbox) {
                        sandbox.position.set(x, y, z);
                        console.log(`✅ 沙盘位置已调整为: (${x}, ${y}, ${z})`);
                    } else {
                        console.error('❌ 沙盘模型未找到');
                    }
                },
                adjustCarPosition: (x, y, z) => {
                    const car = models.get('cars');
                    if (car) {
                        car.position.set(x, y, z);
                        console.log(`✅ 小车位置已调整为: (${x}, ${y}, ${z})`);
                    } else {
                        console.error('❌ 小车模型未找到');
                    }
                },
                logAlignmentInfo: () => {
                    const sandbox = models.get('sandbox');
                    const car = models.get('cars');
                    
                    if (sandbox && car) {
                        const sandboxBox = new Box3().setFromObject(sandbox);
                        const carBox = new Box3().setFromObject(car);
                        
                        console.log('🔍 对齐信息:');
                        console.log('沙盘:');
                        console.log(`  - 位置: Y=${sandbox.position.y.toFixed(3)}`);
                        console.log(`  - 包围盒底部(道路表面): Y=${sandboxBox.min.y.toFixed(3)}`);
                        console.log(`  - 包围盒顶部: Y=${sandboxBox.max.y.toFixed(3)}`);
                        console.log('小车:');
                        console.log(`  - 位置: Y=${car.position.y.toFixed(3)}`);
                        console.log(`  - 包围盒底部: Y=${carBox.min.y.toFixed(3)}`);
                        console.log(`  - 包围盒顶部: Y=${carBox.max.y.toFixed(3)}`);
                        console.log(`  - 小车底部与道路表面的距离: ${(carBox.min.y - sandboxBox.min.y).toFixed(3)} (应该≈0)`);
                    } else {
                        console.error('❌ 模型未找到');
                    }
                },
                logSandboxInfo: () => {
                    const sandbox = models.get('sandbox');
                    if (sandbox) {
                        console.log('🔍 沙盘模型信息:');
                        console.log('  位置:', sandbox.position);
                        console.log('  缩放:', sandbox.scale);
                        console.log('  旋转:', sandbox.rotation);
                        console.log('  可见:', sandbox.visible);
                        const box = new Box3().setFromObject(sandbox);
                        const size = new Vector3();
                        box.getSize(size);
                        console.log('  边界框尺寸:', size);
                        console.log('  边界框范围:', box);
                    } else {
                        console.error('❌ 沙盘模型未找到');
                    }
                },
                analyzeSandboxMeshes: () => {
                    const sandbox = models.get('sandbox');
                    if (!sandbox) {
                        console.error('❌ 沙盘模型未找到');
                        return;
                    }
                    
                    console.log('📊 沙盘模型网格分析:');
                    console.log('=' .repeat(80));
                    
                    const meshes = [];
                    sandbox.traverse((child) => {
                        if (child.isMesh) {
                            const meshBox = new Box3().setFromObject(child);
                            const meshSize = new Vector3();
                            meshBox.getSize(meshSize);
                            
                            meshes.push({
                                name: child.name || '(unnamed)',
                                visible: child.visible,
                                box: meshBox,
                                size: meshSize,
                                vertexCount: child.geometry.attributes.position?.count || 0
                            });
                        }
                    });
                    
                    console.log(`📦 共找到 ${meshes.length} 个网格\n`);
                    
                    // 按X轴尺寸排序
                    meshes.sort((a, b) => b.size.x - a.size.x);
                    
                    meshes.forEach((mesh, idx) => {
                        console.log(`[${idx + 1}] ${mesh.name}`);
                        console.log(`  └─ 尺寸: X=${mesh.size.x.toFixed(3)} Y=${mesh.size.y.toFixed(3)} Z=${mesh.size.z.toFixed(3)}`);
                        console.log(`  └─ 范围: X[${mesh.box.min.x.toFixed(2)} ~ ${mesh.box.max.x.toFixed(2)}] ` +
                                   `Y[${mesh.box.min.y.toFixed(2)} ~ ${mesh.box.max.y.toFixed(2)}] ` +
                                   `Z[${mesh.box.min.z.toFixed(2)} ~ ${mesh.box.max.z.toFixed(2)}]`);
                        console.log(`  └─ 顶点数: ${mesh.vertexCount}, 可见: ${mesh.visible ? '是' : '否'}`);
                        console.log('');
                    });
                    
                    // 计算整体包围盒
                    const totalBox = new Box3().setFromObject(sandbox);
                    const totalSize = new Vector3();
                    totalBox.getSize(totalSize);
                    
                    console.log('=' .repeat(80));
                    console.log('📐 整体包围盒 (所有网格):');
                    console.log(`  └─ 尺寸: X=${totalSize.x.toFixed(3)} Y=${totalSize.y.toFixed(3)} Z=${totalSize.z.toFixed(3)}`);
                    console.log(`  └─ 原始尺寸 (除以缩放${sandbox.scale.x}): X=${(totalSize.x / sandbox.scale.x).toFixed(3)} ` +
                               `Y=${(totalSize.y / sandbox.scale.y).toFixed(3)} Z=${(totalSize.z / sandbox.scale.z).toFixed(3)}`);
                    console.log('=' .repeat(80));
                    
                    console.log('💡 提示: 如果某些网格尺寸异常大，可能是导致包围盒尺寸不准确的原因');
                },
                testGroundHeight: () => {
                    const sandbox = models.get('sandbox');
                    if (!sandbox) {
                        console.error('❌ 沙盘模型未找到');
                        return null;
                    }
                    
                    console.log('🔍 测试地面高度 - 查找 Standardmaterial206');
                    console.log('=' .repeat(80));
                    
                    let foundGroundMesh = null;
                    let allGroundCandidates = [];
                    
                    // 遍历所有网格
                    sandbox.traverse((child) => {
                        if (child.isMesh) {
                            const name = child.name || '(unnamed)';
                            
                            // 检查是否包含 Standardmaterial206
                            if (name.includes('Standardmaterial206')) {
                                const meshBox = new Box3().setFromObject(child);
                                const meshSize = new Vector3();
                                meshBox.getSize(meshSize);
                                const worldPos = child.getWorldPosition(new Vector3());
                                
                                const info = {
                                    name: name,
                                    localPosition: { ...child.position },
                                    worldPosition: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
                                    size: { x: meshSize.x, y: meshSize.y, z: meshSize.z },
                                    bounds: {
                                        min: { x: meshBox.min.x, y: meshBox.min.y, z: meshBox.min.z },
                                        max: { x: meshBox.max.x, y: meshBox.max.y, z: meshBox.max.z }
                                    },
                                    area: meshSize.x * meshSize.z
                                };
                                
                                allGroundCandidates.push(info);
                                
                                if (!foundGroundMesh || info.area > foundGroundMesh.area) {
                                    foundGroundMesh = info;
                                }
                            }
                        }
                    });
                    
                    if (allGroundCandidates.length === 0) {
                        console.log('❌ 未找到包含 "Standardmaterial206" 的网格');
                        console.log('');
                        console.log('🔍 尝试列出所有网格名称:');
                        sandbox.traverse((child) => {
                            if (child.isMesh && child.name) {
                                console.log(`  - ${child.name}`);
                            }
                        });
                    } else {
                        console.log(`✅ 找到 ${allGroundCandidates.length} 个匹配的地面网格\n`);
                        
                        allGroundCandidates.forEach((info, idx) => {
                            console.log(`[${idx + 1}] ${info.name}`);
                            console.log(`  📍 局部坐标: X=${info.localPosition.x.toFixed(4)} Y=${info.localPosition.y.toFixed(4)} Z=${info.localPosition.z.toFixed(4)}`);
                            console.log(`  🌍 世界坐标: X=${info.worldPosition.x.toFixed(4)} Y=${info.worldPosition.y.toFixed(4)} Z=${info.worldPosition.z.toFixed(4)}`);
                            console.log(`  📐 尺寸: X=${info.size.x.toFixed(3)} Y=${info.size.y.toFixed(3)} Z=${info.size.z.toFixed(3)}`);
                            console.log(`  📦 Y范围: ${info.bounds.min.y.toFixed(4)} ~ ${info.bounds.max.y.toFixed(4)}`);
                            console.log(`  📏 面积: ${info.area.toFixed(3)}`);
                            console.log('');
                        });
                        
                        if (foundGroundMesh) {
                            // 计算地面顶部在沙盘局部坐标系中的Y值
                            const worldTopPoint = new Vector3(
                                (foundGroundMesh.bounds.min.x + foundGroundMesh.bounds.max.x) / 2,
                                foundGroundMesh.bounds.max.y,
                                (foundGroundMesh.bounds.min.z + foundGroundMesh.bounds.max.z) / 2
                            );
                            const localTopPoint = sandbox.worldToLocal(worldTopPoint.clone());
                            
                            console.log('=' .repeat(80));
                            console.log('🎯 选定的地面网格 (面积最大):');
                            console.log(`  名称: ${foundGroundMesh.name}`);
                            console.log(`  🌍 世界坐标 - 地面高度(Y max): ${foundGroundMesh.bounds.max.y.toFixed(4)}`);
                            console.log(`  🌍 世界坐标 - 地面底部(Y min): ${foundGroundMesh.bounds.min.y.toFixed(4)}`);
                            console.log(`  📍 沙盘局部坐标 - 地面高度(Y): ${localTopPoint.y.toFixed(4)} ⭐`);
                            console.log('=' .repeat(80));
                            console.log('');
                            console.log('💡 提示: 施工标记、车辆等应使用沙盘局部坐标 (Y ≈ ' + localTopPoint.y.toFixed(2) + ')');
                            console.log('   可以使用 getRoadSurfaceY() 获取缓存的局部坐标');
                            
                            return foundGroundMesh;
                        }
                    }
                    
                    return null;
                },
                getSandboxDimensionsInfo: () => {
                    return getSandboxDimensionsInfo();
                }
            };
            console.log('🔧 调试工具已挂载到 window.__scene3d__');
            console.log('💡 快速调试命令:');
            console.log('  - window.__scene3d__.testGroundHeight() // 🆕 测试地面高度 (查找 Standardmaterial206)');
            console.log('  - window.__scene3d__.getSandboxDimensionsInfo() // 查看沙盘尺寸信息');
            console.log('  - window.__scene3d__.logAlignmentInfo() // 查看沙盘和小车对齐信息');
            console.log('  - window.__scene3d__.analyzeSandboxMeshes() // 分析沙盘网格尺寸（找出尺寸差异原因）');
            console.log('  - window.__scene3d__.adjustCarPosition(0, Y, 0) // 微调小车Y位置');
            console.log('  - window.__scene3d__.adjustSandboxScale(6) // 调整沙盘缩放');
        }
        
        // 基础场景已完成，可以开始交互（即使模型未加载完）
        console.log('基础3D场景初始化完成，界面可交互');
        eventBus.emit(EVENTS.SCENE3D_COMPLETE);
        
    } catch (error) {
        console.error('Scene3D 初始化失败:', error);
        eventBus.emit(EVENTS.SCENE3D_COMPLETE);
    }
};

// 设置光照系统
const setupLighting = () => {
    // 🌐 半球光 - 模拟天空和地面的环境光
    const hemisphereLight = new HemisphereLight(
        0xddeeff,  // 天空颜色（淡蓝色）
        0x332222,  // 地面颜色（深灰棕色）
        0.9        // 强度
    );
    hemisphereLight.name = 'HemisphereLight';
    hemisphereLight.position.set(0, 50, 0);
    lightsGroup.add(hemisphereLight);

    // ☀️ 主平行光 - 模拟太阳光
    const directionalLight = new DirectionalLight(0xffffff, 5);
    directionalLight.position.set(10, 20, 10);
    directionalLight.name = 'MainDirectionalLight';
    directionalLight.castShadow = false;
    lightsGroup.add(directionalLight);

    // 💡 补充平行光 - 提亮阴影区域
    const fillLight = new DirectionalLight(0x87ceeb, 1.0);
    fillLight.position.set(-10, 10, -10);
    fillLight.name = 'FillLight';
    lightsGroup.add(fillLight);

    // 🔆 背光 - 增加轮廓感
    const backLight = new DirectionalLight(0xffffff, 0.7);
    backLight.position.set(0, 5, -15);
    backLight.name = 'BackLight';
    lightsGroup.add(backLight);

    console.log('💡 光照系统已设置: 半球光 + 三点光照（总强度: 4.8）');
};

// 模型动画更新
const updateModelAnimations = (deltaTime) => {
    // 这里可以添加模型动画逻辑
    // 例如：旋转车辆模型、播放动画等
    
    // 示例：缓慢旋转主模型
    if (models.has('cars')) {
        const carModel = models.get('cars');
        carModel.rotation.y += deltaTime * 0.1; // 缓慢旋转
    }
};

// 🌍 环境贴图加载（Environment Map / Skybox）
const loadEnvironment = () => {
    const cubeTextureLoader = new CubeTextureLoader()
        .setPath('/Image/skybox/');
    
    cubeTextureLoader.load(
        ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'],
        (texture) => {
            // 设置为场景的环境贴图（影响材质的反射和照明）
            scene.environment = texture;
            
            // 可选：设置为场景背景（如果想显示天空盒）
            // scene.background = texture;
            
            // 遍历所有已加载的模型，为材质添加环境反射
            models.forEach((model, name) => {
                model.traverse((child) => {
                    if (child.isMesh && child.material) {
                        const material = child.material;
                        
                        // 为PBR材质设置环境贴图强度
                        if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
                            material.envMap = texture;
                            material.envMapIntensity = 0.8; // 环境反射强度（降低以避免过亮）
                            material.needsUpdate = true;
                        }
                    }
                });
            });
            
            console.log('✅ 环境球（Skybox）加载成功，材质反射已启用');
        },
        undefined,
        (error) => {
            console.warn('❌ 环境贴图加载失败:', error);
        }
    );
};

// 模型加载管理（带进度反馈）
const loadModelsWithProgress = async () => {
    const loader = new GLTFLoader();
    
    // 配置 DRACO 压缩（使用本地解码器，离线可用）
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);

    console.info('开始异步模型加载');
    
    // 模型加载进度追踪
    let carsProgress = 0;
    let finalProgress = 0;
    
    // 更新总进度的函数
    const updateTotalProgress = () => {
        // 70% 基础场景 + 30% 沙盘模型 = 100% (不再加载小车模型)
        const totalProgress = 70 + (finalProgress * 0.30);
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, Math.round(totalProgress));
    };

    // 异步加载小车模型 - 已禁用，改为动态加载
    // const loadCarsModel = async () => {
    //     return new Promise((resolve) => {
    //         setTimeout(() => {
    //             console.info('开始加载小车模型');
    //             loadModelAsync(loader, '/models/car.glb', 'cars', {
    //                 scale: 6,
    //                 position: [0, 0, 0],  // 初始位置，稍后会根据沙盘自动调整
    //                 priority: 'high'
    //             }, (progress) => {
    //                 carsProgress = progress;
    //                 updateTotalProgress();
    //                 console.debug(`小车模型加载进度: ${progress}%`);
    //             }).then(() => {
    //                 console.info('小车模型加载完成');
    //                 resolve();
    //             }).catch((error) => {
    //                 console.error('小车模型加载失败:', error);
    //                 resolve(); // 即使失败也继续
    //             });
    //         }, 100);
    //     });
    // };

    // 异步加载沙盘模型
    const loadFinalModel = async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.info('开始加载沙盘模型');
                loadModelAsync(loader, '/models/sandbox.glb', 'sandbox', {
                    scale: 4.5,  // 缩小沙盘显示（原6，调整为5.5更合适）
                    position: [0, 0, 0],  // 初始位置，稍后会自动调整让底座贴地
                    processMaterial: true,
                    priority: 'low',
                    enableLOD: false
                }, (progress) => {
                    finalProgress = progress;
                    updateTotalProgress();
                    console.debug(`沙盘模型加载进度: ${progress}%`);
                }).then(() => {
                    console.info('沙盘模型加载完成');
                    
                    // 获取加载的沙盘模型并计算尺寸
                    const sandboxModel = models.get('sandbox');
                    if (sandboxModel) {
                        // ⚠️ 重要：立即计算沙盘尺寸并更新坐标转换包围盒
                        console.log('🔍 开始计算沙盘尺寸并更新坐标转换...');
                        calculateSandboxDimensions(sandboxModel);
                        
                        // 初始化路径渲染器（现在沙盘模型已加载）
                        initPathRenderer(scene, sandboxModel);
                        console.log('✅ 路径渲染器已初始化（使用沙盘模型）');
                        
                        // 初始化红绿灯管理器
                        const trafficLightInitSuccess = initTrafficLightManager(sandboxModel);
                        if (trafficLightInitSuccess) {
                            console.log('✅ 红绿灯管理器已初始化');
                        } else {
                            console.warn('⚠️ 红绿灯管理器初始化失败');
                        }
                        
                        // 🔍 添加详细的模型调试信息
                        console.log('🔍 沙盘模型调试信息:');
                        console.log('  - 位置:', sandboxModel.position);
                        console.log('  - 缩放:', sandboxModel.scale);
                        console.log('  - 旋转:', sandboxModel.rotation);
                        console.log('  - 是否可见:', sandboxModel.visible);
                        
                        // 计算模型的实际边界框
                        const box = new Box3().setFromObject(sandboxModel);
                        const size = new Vector3();
                        box.getSize(size);
                        console.log('  - 边界框尺寸:', size);
                        console.log('  - 边界框最小点:', box.min);
                        console.log('  - 边界框最大点:', box.max);
                        
                        // 检查子对象数量
                        let meshCount = 0;
                        sandboxModel.traverse((child) => {
                            if (child.isMesh) meshCount++;
                        });
                        console.log('  - 网格数量:', meshCount);
                        
                        // 🎯 对齐沙盘模型
                        alignSandbox(sandboxModel, scene, '异步加载');
                        
                        // 🔄 清除地面高度缓存（强制重新计算新沙盘的地面高度）
                        clearRoadSurfaceCache();
                        clearVehicleManagerSandboxCache();
                    } else {
                        console.error('❌ 无法从models中获取沙盘模型！');
                    }
                    
                    resolve();
                }).catch((error) => {
                    console.error('沙盘模型加载失败:', error);
                    resolve(); // 即使失败也继续
                });
            }, 500);
        });
    };

    // 加载沙盘模型（小车模型改为动态加载）
    try {
        await loadFinalModel();
        
        console.info('沙盘模型加载完成');
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, 100);
        
    } catch (error) {
        console.error('模型加载过程中出现错误:', error);
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, 100);
    }
};

// 保留原来的loadModels函数作为备用
const loadModels = () => {
    const loader = new GLTFLoader();
    
    // 配置 DRACO 压缩（使用本地解码器，离线可用）
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);

    console.log('开始渐进式模型加载...');

    // 渐进式加载：小车模型改为动态加载（当车辆连接时才加载）
     // setTimeout(() => {
     //     loadModel(loader, '/models/car.glb', 'cars', {
     //         scale: 6,  // 小车模型缩放比例
     //         position: [0, 0, 0],  // 初始位置，稍后会根据沙盘自动调整
     //        priority: 'high'
     //    });
     //}, 100);

    // 延迟加载大模型，给界面更多响应时间
    setTimeout(() => {
        loadModel(loader, '/models/sandbox.glb', 'sandbox', {
            scale: 4.5,  // 与异步加载保持一致（调整为5.5更合适）
            position: [0, 0, 0],  // 初始位置，稍后会自动调整让底座贴地
            processMaterial: true,
            priority: 'low',
            enableLOD: false // 暂时禁用LOD避免顶点缓冲区错误
        });
    }, 2000); // 增加延迟到2秒
};

// 异步模型加载函数（不阻塞主线程）
const loadModelAsync = (loader, url, key, options = {}, progressCallback = null) => {
    return new Promise((resolve, reject) => {
        if (models.has(key)) {
            progressCallback?.(100);
            resolve(models.get(key));
            return;
        }

        console.log(`开始异步加载模型: ${key}`);
        
        loader.load(
            url,
            (gltf) => {
                // 使用setTimeout分片处理，避免阻塞主线程
                setTimeout(() => {
                    processModelAsync(gltf, key, options, resolve, reject);
                }, 0);
            },
            (progress) => {
                const percentage = Math.round((progress.loaded / progress.total) * 100);
                console.debug(`模型 ${key} 加载进度: ${percentage}%`);
                progressCallback?.(percentage);
            },
            (error) => {
                console.error(`模型 ${key} 加载失败:`, error);
                reject(error);
            }
        );
    });
};

// 分片处理模型，避免阻塞主线程
const processModelAsync = async (gltf, key, options, resolve, reject) => {
    try {
        console.log(`开始处理模型: ${key}`);
        let model = gltf.scene;
        
        // 步骤1：应用变换（非阻塞）
        await new Promise(resolveStep => {
            setTimeout(() => {
                if (options.scale) model.scale.setScalar(options.scale);
                if (options.position) model.position.set(...options.position);
                resolveStep();
            }, 0);
        });
        
        // 步骤2：材质优化（非阻塞）
        if (options.processMaterial) {
            await optimizeMaterialsAsync(model);
        }
        
        // 步骤3：几何体优化（分批处理，更小的批次）
        await optimizeGeometryAsyncNonBlocking(model);
        
        // 步骤4：LOD处理（如果启用）
        if (options.enableLOD) {
            await new Promise(resolveStep => {
                setTimeout(() => {
                    model = createLODModel(model, key);
                    resolveStep();
                }, 0);
            });
        }
        
        // 步骤5：添加到场景（非阻塞）
        await new Promise(resolveStep => {
            setTimeout(() => {
                models.set(key, model);
                modelsGroup.add(model);
                console.log(`模型 ${key} 已添加到场景`);
                resolveStep();
            }, 0);
        });
        
        resolve(model);
        
    } catch (error) {
        console.error(`模型 ${key} 处理失败:`, error);
        reject(error);
    }
};

// 完全非阻塞的几何体优化
const optimizeGeometryAsyncNonBlocking = async (model) => {
    return new Promise((resolve) => {
        const meshes = [];
        model.traverse((child) => {
            if (child.geometry) {
                meshes.push(child);
            }
        });
        
        console.log(`开始优化 ${meshes.length} 个网格，使用非阻塞模式`);
        
        // 每批只处理1个网格，并且给更多时间给主线程
        const processBatch = async (startIndex) => {
            const batchSize = 1; // 减少到每次只处理1个
            const endIndex = Math.min(startIndex + batchSize, meshes.length);
            
            for (let i = startIndex; i < endIndex; i++) {
                const child = meshes[i];
                
                // 轻量级优化，跳过耗时操作
                try {
                    // 只做基础计算
                    if (child.geometry.attributes.position) {
                        child.geometry.attributes.position.needsUpdate = false;
                    }
                    
                    // 简化的材质优化
                    if (child.material) {
                        child.material.precision = 'mediump';
                        child.material.dithering = true;  // 启用抖动减少色带
                        
                        // 优化纹理设置以避免闪烁
                        if (child.material.map) {
                            child.material.map.generateMipmaps = true;  // 启用 mipmap 避免闪烁
                            child.material.map.anisotropy = 4;  // 增加各向异性过滤
                            // minFilter 使用 mipmap 过滤器
                            child.material.map.minFilter = LinearMipmapLinearFilter;
                            child.material.map.magFilter = LinearFilter;
                        }
                    }
                } catch (error) {
                    console.warn(`网格优化跳过:`, error);
                }
            }
            
            // 处理下一批，给更多时间给主线程
            if (endIndex < meshes.length) {
                setTimeout(() => {
                    processBatch(endIndex);
                }, 16); // 增加到16ms，确保60fps
            } else {
                console.log('几何体优化完成');
                resolve();
            }
        };
        
        if (meshes.length > 0) {
            processBatch(0);
        } else {
            resolve();
        }
    });
};

// 保留原来的异步几何体优化函数
const optimizeGeometryAsync = async (model) => {
    return new Promise((resolve) => {
        const meshes = [];
        model.traverse((child) => {
            if (child.geometry) {
                meshes.push(child);
            }
        });
        
        // 分批处理网格，每批5个
        const processBatch = async (startIndex) => {
            const batchSize = 5;
            const endIndex = Math.min(startIndex + batchSize, meshes.length);
            
            for (let i = startIndex; i < endIndex; i++) {
                const child = meshes[i];
                
                // 合并顶点
                child.geometry.mergeVertices?.();
                
                // 计算法线
                child.geometry.computeVertexNormals();
                
                // 减少精度以节省内存
                if (child.geometry.attributes.position) {
                    child.geometry.attributes.position.needsUpdate = false;
                }
                
                // 材质和纹理优化
                if (child.material) {
                    child.material.precision = 'mediump';
                    child.material.dithering = false;
                    
                    // 优化纹理设置
                    if (child.material.map) {
                        child.material.map.generateMipmaps = false;
                        child.material.map.minFilter = LinearFilter;
                        child.material.map.magFilter = LinearFilter;
                    }
                    
                    // 处理其他纹理类型
                    ['normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(mapType => {
                        if (child.material[mapType]) {
                            child.material[mapType].generateMipmaps = false;
                            child.material[mapType].minFilter = LinearFilter;
                            child.material[mapType].magFilter = LinearFilter;
                        }
                    });
                }
            }
            
            // 处理下一批
            if (endIndex < meshes.length) {
                const timer = setTimeout(() => {
                    processBatch(endIndex);
                }, 0);
                batchProcessingTimers.push(timer);
            } else {
                resolve();
            }
        };
        
        if (meshes.length > 0) {
            processBatch(0);
        } else {
            resolve();
        }
    });
};

// 通用模型加载函数（保留同步版本）
const loadModel = (loader, url, key, options = {}) => {
    if (models.has(key)) {
        return models.get(key);
    }

    console.log(`开始加载模型: ${key}`);
    
    loader.load(
        url,
        (gltf) => {
            console.log(`模型 ${key} 加载完成`);
            let model = gltf.scene;
            
            // 应用变换
            if (options.scale) model.scale.setScalar(options.scale);
            if (options.position) model.position.set(...options.position);
            
            // 材质优化
            if (options.processMaterial) {
                optimizeMaterials(model);
            }
            
            // 几何体优化
            optimizeGeometry(model);
            
            // LOD 处理（暂时禁用）
            if (options.enableLOD) {
                model = createLODModel(model, key);
            }
            
            // 缓存模型
            models.set(key, model);
            modelsGroup.add(model);
            
            console.log(`模型 ${key} 已添加到场景`);
            
            // 如果是沙盘模型，计算尺寸
            if (key === 'sandbox') {
                // 🔍 添加详细的模型调试信息
                console.log('🔍 沙盘模型调试信息 (同步加载):');
                console.log('  - 位置:', model.position);
                console.log('  - 缩放:', model.scale);
                console.log('  - 旋转:', model.rotation);
                console.log('  - 是否可见:', model.visible);
                
                // 计算模型的实际边界框
                const box = new Box3().setFromObject(model);
                const size = new Vector3();
                box.getSize(size);
                console.log('  - 边界框尺寸:', size);
                console.log('  - 边界框最小点:', box.min);
                console.log('  - 边界框最大点:', box.max);
                
                // 检查子对象数量
                let meshCount = 0;
                model.traverse((child) => {
                    if (child.isMesh) meshCount++;
                });
                console.log('  - 网格数量:', meshCount);
                
                // 🎯 对齐沙盘模型（延迟确保模型完全加载到场景）
                setTimeout(() => {
                    alignSandbox(model, scene, '同步加载');
                }, 100);
            }
        },
        (progress) => {
            const percentage = (progress.loaded / progress.total * 100).toFixed(0);
            console.log(`模型 ${key} 加载进度: ${percentage}%`);
        },
        (error) => {
            console.error(`模型 ${key} 加载失败:`, error);
        }
    );
};

// 异步材质优化
const optimizeMaterialsAsync = async (model) => {
    return new Promise((resolve) => {
        const materialMap = new Map();
        const materialsToProcess = [];
        
        // 收集需要处理的材质
        model.traverse((child) => {
            if (child.material) {
                const uuid = child.material.uuid;
                if (!materialMap.has(uuid)) {
                    materialMap.set(uuid, child.material);
                    materialsToProcess.push(child.material);
                }
            }
        });
        
        console.log(`开始异步优化 ${materialsToProcess.length} 个材质`);
        
        // 分批处理材质
        const processMaterialBatch = (index) => {
            if (index >= materialsToProcess.length) {
                console.log('材质优化完成');
                resolve();
                return;
            }
            
            const material = materialsToProcess[index];
            
            try {
                // 材质名称匹配
                const materialNames = [
                    '材质.003', 'pasted__材质.003', '材质.002', 
                    '材贪', '材质', '材贫', 'pasted__材质'
                ];
                
                if (materialNames.includes(material.name)) {
                    material.color.set('gray');
                    material.needsUpdate = true;
                }
                
                // 🎨 为PBR材质设置物理属性（模拟烘焙效果）
                if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
                    // 环境贴图强度（降低以避免过亮）
                    material.envMapIntensity = 0.8;  // 从1.2降低到0.8
                    
                    // 金属度和粗糙度（根据材质名称调整）
                    if (!material.metalness && !material.roughness) {
                        material.metalness = 0.1;  // 轻微金属感
                        material.roughness = 0.8;  // 较粗糙的表面
                    }
                    
                    material.needsUpdate = true;
                }
            } catch (error) {
                console.warn(`材质优化跳过:`, error);
            }
            
            // 处理下一个材质
            setTimeout(() => {
                processMaterialBatch(index + 1);
            }, 1); // 很短的延迟，但足以让出控制权
        };
        
        if (materialsToProcess.length > 0) {
            processMaterialBatch(0);
        } else {
            resolve();
        }
    });
};

// 保留同步材质优化函数
const optimizeMaterials = (model) => {
    const materialMap = new Map();
    
    model.traverse((child) => {
        if (child.material) {
            const uuid = child.material.uuid;
            if (materialMap.has(uuid)) return;
            
            materialMap.set(uuid, child.material);
            
            const material = child.material;
            
            // 材质名称匹配
            const materialNames = [
                '材质.003', 'pasted__材质.003', '材质.002', 
                '材贪', '材质', '材贫', 'pasted__材质'
            ];
            
            if (materialNames.includes(material.name)) {
                material.color.set('gray');
                material.needsUpdate = true;
            }
            
            // 🎨 为PBR材质设置物理属性（模拟烘焙效果）
            if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
                // 环境贴图强度（降低以避免过亮）
                material.envMapIntensity = 0.8;  // 从1.2降低到0.8
                
                // 金属度和粗糙度（根据材质名称调整）
                if (!material.metalness && !material.roughness) {
                    material.metalness = 0.1;  // 轻微金属感
                    material.roughness = 0.8;  // 较粗糙的表面
                }
                
                material.needsUpdate = true;
            }
        }
    });
};

// 几何体优化
const optimizeGeometry = (model) => {
    model.traverse((child) => {
        if (child.geometry) {
            // 合并顶点
            child.geometry.mergeVertices?.();
            
            // 计算法线
            child.geometry.computeVertexNormals();
            
            // 减少精度以节省内存
            if (child.geometry.attributes.position) {
                child.geometry.attributes.position.needsUpdate = false;
            }
        }
        
        // 材质和纹理优化
        if (child.material) {
            child.material.precision = 'mediump';
            child.material.dithering = true;  // 启用抖动减少色带
            
            // 优化纹理设置以避免闪烁
            if (child.material.map) {
                child.material.map.generateMipmaps = true;  // 启用 mipmap 避免闪烁
                child.material.map.anisotropy = 4;  // 增加各向异性过滤
                child.material.map.minFilter = LinearMipmapLinearFilter;
                child.material.map.magFilter = LinearFilter;
            }
            
            // 处理其他纹理类型
            ['normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(mapType => {
                if (child.material[mapType]) {
                    child.material[mapType].generateMipmaps = false;
                    child.material[mapType].minFilter = LinearFilter;
                    child.material[mapType].magFilter = LinearFilter;
                }
            });
        }
    });
};

// 创建 LOD 模型
const createLODModel = (model, key) => {
    const lod = new LOD();
    
    // 高详细度版本（近距离）
    const highDetail = model.clone();
    lod.addLevel(highDetail, 0);
    
    // 中等详细度版本（中距离）
    const midDetail = model.clone();
    reduceMeshDetail(midDetail, 0.7); // 保留70%的面
    lod.addLevel(midDetail, 50);
    
    // 低详细度版本（远距离）
    const lowDetail = model.clone();
    reduceMeshDetail(lowDetail, 0.3); // 保留30%的面
    lod.addLevel(lowDetail, 150);
    
    return lod;
};

// 简化网格（安全版本）
const reduceMeshDetail = (model, ratio) => {
    model.traverse((child) => {
        if (child.geometry && child.geometry.attributes.position) {
            try {
                // 简单的面数减少：每隔几个顶点取一个
                const originalPositions = child.geometry.attributes.position.array;
                const originalCount = originalPositions.length;
                
                // 确保新的顶点数是3的倍数（三角形）
                const step = Math.max(1, Math.floor(1 / ratio));
                let newCount = 0;
                
                // 计算新的顶点数
                for (let i = 0; i < originalCount; i += 3 * step) {
                    if (i + 2 < originalCount) {
                        newCount += 3;
                    }
                }
                
                if (newCount > 0 && newCount <= originalCount) {
                    const newPositions = new Float32Array(newCount);
                    let writeIndex = 0;
                    
                    // 复制简化后的顶点
                    for (let i = 0; i < originalCount; i += 3 * step) {
                        if (i + 2 < originalCount && writeIndex + 2 < newCount) {
                            newPositions[writeIndex] = originalPositions[i];
                            newPositions[writeIndex + 1] = originalPositions[i + 1];
                            newPositions[writeIndex + 2] = originalPositions[i + 2];
                            writeIndex += 3;
                        }
                    }
                    
                    // 更新几何体
                    child.geometry.setAttribute('position', new BufferAttribute(newPositions, 3));
                    
                    // 同步处理其他属性
                    if (child.geometry.attributes.normal) {
                        child.geometry.deleteAttribute('normal');
                    }
                    if (child.geometry.attributes.uv) {
                        // 简化UV坐标
                        const originalUV = child.geometry.attributes.uv.array;
                        const newUV = new Float32Array(newCount / 3 * 2);
                        let uvWriteIndex = 0;
                        
                        for (let i = 0; i < originalUV.length; i += 2 * step) {
                            if (i + 1 < originalUV.length && uvWriteIndex + 1 < newUV.length) {
                                newUV[uvWriteIndex] = originalUV[i];
                                newUV[uvWriteIndex + 1] = originalUV[i + 1];
                                uvWriteIndex += 2;
                            }
                        }
                        child.geometry.setAttribute('uv', new BufferAttribute(newUV, 2));
                    }
                    
                    // 重新计算法线
                    child.geometry.computeVertexNormals();
                } else {
                    console.warn('LOD 简化失败，保持原始几何体');
                }
            } catch (error) {
                console.warn('LOD 简化出错，保持原始几何体:', error);
            }
        }
    });
};

// 性能自适应函数
const adaptPerformance = () => {
    try {
        const gl = renderer.getContext();
        const gpu = gl.getParameter(gl.RENDERER) || '';
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        
        // 将GPU信息传递给性能监控器
        if (typeof window !== 'undefined' && window.performanceGPUInfo === undefined) {
            window.performanceGPUInfo = gpu;
        }
        
        if (isMobile || (gpu && gpu.includes('Intel'))) {
            performanceMode = 'low';
            switchToLowPerformance();
        }
    } catch (error) {
        console.warn('性能自适应检测失败:', error);
        performanceMode = 'low'; // 默认低性能模式
    }
};

// 切换到高性能模式
const switchToHighPerformance = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    // 可以启用抗锯齿
    // renderer.getContext().enable(renderer.getContext().MULTISAMPLE);
};

// 切换到低性能模式
const switchToLowPerformance = () => {
    renderer.setPixelRatio(1);
    // 降低渲染质量
    models.forEach(model => {
        model.traverse(child => {
            if (child.material) {
                child.material.precision = 'lowp';
            }
        });
    });
};

// 可见性检测
let animate; // 前向声明

const handleVisibilityChange = () => {
    isVisible = !document.hidden;
    if (!isVisible) {
        // 页面不可见时停止渲染
        if (renderer) renderer.setAnimationLoop(null);
    } else {
        // 恢复渲染
        if (renderer && animate) renderer.setAnimationLoop(animate);
    }
};

// 监听页面可见性
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

// 创建坐标轴辅助器
const createCoordinateAxes = () => {
    // 在原点创建大坐标轴 (size = 30，更大更明显) - 默认隐藏
    axesHelper = new AxesHelper(30);
    axesHelper.name = 'MainCoordinateAxes';
    axesHelper.position.set(0, 0, 0);
    axesHelper.visible = false; // 默认隐藏
    scene.add(axesHelper);
    
    // 添加网格辅助器到地面，帮助观察坐标 - 默认隐藏
    const gridHelper = new GridHelper(50, 50, 0x00ffff, 0x404040);
    gridHelper.name = 'GroundGrid';
    gridHelper.position.set(0, 0, 0);
    gridHelper.visible = false; // 默认隐藏
    scene.add(gridHelper);
    
    console.log('🔧 坐标系统已添加到场景 (默认隐藏):');
    console.log('  - 主坐标轴: 原点 (0,0,0)，长度30 [隐藏]');
    console.log('  - 地面网格: 50x50，蓝色线条 [隐藏]');
    console.log('  - 沙盘坐标轴: 将在沙盘加载时自动添加');
    console.log('  - 红色轴: X轴 (左右方向)');
    console.log('  - 绿色轴: Y轴 (上下方向)');
    console.log('  - 蓝色轴: Z轴 (前后方向)');
    console.log('  提示: 通过设置面板可以控制显示/隐藏');
};

/**
 * 对齐沙盘模型（车辆模型现在是动态加载，在 vehicleManager 中对齐）
 * @param {Object} sandboxModel - 沙盘模型
 * @param {THREE.Scene} scene - Three.js场景
 * @param {string} loadMode - 加载模式标识（用于日志）
 */
const alignSandbox = (sandboxModel, scene, loadMode = '') => {
    if (!sandboxModel) {
        console.error('❌ 沙盘模型未找到，无法对齐');
        return;
    }
    
    const logPrefix = loadMode ? `(${loadMode})` : '';
    
    // 对齐沙盘：让沙盘底座贴地（Y=0）
    const sandboxBox = new Box3().setFromObject(sandboxModel);
    const offsetY = -sandboxBox.min.y;
    sandboxModel.position.y = offsetY;
    
    console.log(`📐 沙盘模型自动对齐${logPrefix}:`);
    console.log(`  - 包围盒最低点(调整前): Y=${sandboxBox.min.y.toFixed(3)}`);
    console.log(`  - 偏移量: ${offsetY.toFixed(3)}`);
    console.log(`  - 调整后沙盘位置: Y=${sandboxModel.position.y.toFixed(3)} (底座贴地)`);
    
    // 添加调试坐标轴（检查是否已存在，避免重复添加）
    if (!scene.getObjectByName('SandboxAxes')) {
        const sandboxAxes = new AxesHelper(8);
        sandboxAxes.name = 'SandboxAxes';
        sandboxAxes.position.copy(sandboxModel.position);
        sandboxAxes.visible = false;
        scene.add(sandboxAxes);
    }
    
    if (!scene.getObjectByName('SandboxCenterAxes')) {
        const centerAxes = new AxesHelper(3);
        centerAxes.name = 'SandboxCenterAxes';
        const newBox = new Box3().setFromObject(sandboxModel);
        const center = newBox.getCenter(new Vector3());
        centerAxes.position.copy(center);
        centerAxes.visible = false;
        scene.add(centerAxes);
    }
    
    console.log(`✅ 沙盘位置对齐完成${logPrefix} (车辆模型将在连接时动态添加并对齐)`);
};

// 计算沙盘模型尺寸的工具函数
const calculateSandboxDimensions = (model) => {
    if (!model) {
        console.error('❌ 沙盘模型未找到');
        return null;
    }

    // ⚠️ 关键：强制更新整个模型树的世界矩阵
    // 必须在使用 worldToLocal() 之前调用，否则车辆和标记位置会错误！
    model.updateMatrixWorld(true);
    
    // 获取模型的缩放比例
    const scale = model.scale.x; // 假设xyz缩放比例相同
    
    // 1️⃣ 查找地面网格作为X/Z尺寸的基准
    let groundMesh = null;
    let maxGroundArea = 0;
    
    model.traverse((child) => {
        if (child.isMesh) {
            // 优先查找名为 Standardmaterial206 的地面网格（新模型）
            if (child.name && child.name.includes('Standardmaterial206')) {
                const meshBox = new Box3().setFromObject(child);
                const meshSize = new Vector3();
                meshBox.getSize(meshSize);
                const area = meshSize.x * meshSize.z;
                
                if (area > maxGroundArea) {
                    maxGroundArea = area;
                    groundMesh = child;
                }
            }
            // 备用：查找名为 MD_CaoPing 的草坪网格（旧模型）
            else if (child.name && child.name.includes('CaoPing')) {
                const meshBox = new Box3().setFromObject(child);
                const meshSize = new Vector3();
                meshBox.getSize(meshSize);
                const area = meshSize.x * meshSize.z;
                
                if (area > maxGroundArea) {
                    maxGroundArea = area;
                    groundMesh = child;
                }
            }
        }
    });
    
    // 如果没找到特定名称的地面，就找最大的水平网格（Y高度接近0的网格）
    if (!groundMesh) {
        model.traverse((child) => {
            if (child.isMesh) {
                const meshBox = new Box3().setFromObject(child);
                const meshSize = new Vector3();
                meshBox.getSize(meshSize);
                
                // 找最大的接近水平的网格（高度很小的）
                if (meshSize.y < 0.1 && meshSize.x * meshSize.z > maxGroundArea) {
                    maxGroundArea = meshSize.x * meshSize.z;
                    groundMesh = child;
                }
            }
        });
    }
    
    // 2️⃣ 计算地面尺寸（X和Z基于地面网格）
    let groundSize = new Vector3();
    let groundBox = null;
    let groundName = '(未找到地面)';
    let groundYPosition = 0; // 地面的Y坐标高度
    
    if (groundMesh) {
        groundBox = new Box3().setFromObject(groundMesh);
        groundBox.getSize(groundSize);
        groundName = groundMesh.name || '(unnamed)';
        
        // 获取地面的Y坐标（使用包围盒的最大Y值作为地面高度）
        groundYPosition = groundBox.max.y;
        
        console.log('🌿 地面基准:', groundName, '✅');
        console.log('   📍 地面高度(Y):', groundYPosition.toFixed(4), '单位');
    }
    
    // 3️⃣ 查找底座网格（Standardmaterial202）- 这才是真正的 6m×5m 底座
    let baseMesh = null;
    let baseBoxWorld = null;
    let baseBoxLocal = null;
    
    model.traverse((child) => {
        if (child.isMesh && child.name && child.name.includes('Standardmaterial202')) {
            baseMesh = child;
            
            // 获取世界坐标包围盒
            baseBoxWorld = new Box3().setFromObject(child);
            
            // 计算沙盘局部坐标系中的包围盒
            // 方法：将世界坐标的8个顶点转换为沙盘局部坐标
            const worldCorners = [
                new Vector3(baseBoxWorld.min.x, baseBoxWorld.min.y, baseBoxWorld.min.z),
                new Vector3(baseBoxWorld.max.x, baseBoxWorld.min.y, baseBoxWorld.min.z),
                new Vector3(baseBoxWorld.min.x, baseBoxWorld.max.y, baseBoxWorld.min.z),
                new Vector3(baseBoxWorld.max.x, baseBoxWorld.max.y, baseBoxWorld.min.z),
                new Vector3(baseBoxWorld.min.x, baseBoxWorld.min.y, baseBoxWorld.max.z),
                new Vector3(baseBoxWorld.max.x, baseBoxWorld.min.y, baseBoxWorld.max.z),
                new Vector3(baseBoxWorld.min.x, baseBoxWorld.max.y, baseBoxWorld.max.z),
                new Vector3(baseBoxWorld.max.x, baseBoxWorld.max.y, baseBoxWorld.max.z),
            ];
            
            // 转换为局部坐标
            baseBoxLocal = new Box3();
            worldCorners.forEach(corner => {
                const localCorner = model.worldToLocal(corner.clone());
                baseBoxLocal.expandByPoint(localCorner);
            });
            
            console.log('🎯 底座网格:', child.name);
        }
    });
    
    // 如果没找到 Standardmaterial202，使用整体包围盒
    if (!baseBoxLocal) {
        console.warn('⚠️ 未找到 Standardmaterial202 底座，使用整体包围盒');
        baseBoxWorld = new Box3().setFromObject(model);
        
        // 转换为局部坐标
        const worldCorners = [
            new Vector3(baseBoxWorld.min.x, baseBoxWorld.min.y, baseBoxWorld.min.z),
            new Vector3(baseBoxWorld.max.x, baseBoxWorld.min.y, baseBoxWorld.min.z),
            new Vector3(baseBoxWorld.min.x, baseBoxWorld.max.y, baseBoxWorld.min.z),
            new Vector3(baseBoxWorld.max.x, baseBoxWorld.max.y, baseBoxWorld.min.z),
            new Vector3(baseBoxWorld.min.x, baseBoxWorld.min.y, baseBoxWorld.max.z),
            new Vector3(baseBoxWorld.max.x, baseBoxWorld.min.y, baseBoxWorld.max.z),
            new Vector3(baseBoxWorld.min.x, baseBoxWorld.max.y, baseBoxWorld.max.z),
            new Vector3(baseBoxWorld.max.x, baseBoxWorld.max.y, baseBoxWorld.max.z),
        ];
        
        baseBoxLocal = new Box3();
        worldCorners.forEach(corner => {
            const localCorner = model.worldToLocal(corner.clone());
            baseBoxLocal.expandByPoint(localCorner);
        });
    }
    
    const baseSize = new Vector3();
    baseBoxLocal.getSize(baseSize);
    const center = baseBoxLocal.getCenter(new Vector3());
    
    console.log('📐 底座尺寸(局部坐标):', `${baseSize.x.toFixed(2)} × ${baseSize.z.toFixed(2)} × ${baseSize.y.toFixed(2)}`);
    // ⭐ 重要：使用底座的局部坐标尺寸对应客户端定义的 6m × 5m
    const modelSize = {
        x: baseSize.x,  // 底座宽度（局部坐标）
        y: baseSize.y,  // 底座高度
        z: baseSize.z   // 底座深度（局部坐标）
    };
    
    // 计算原始尺寸（这些已经是局部坐标，但如果沙盘自身有缩放，需要考虑）
    const originalSize = {
        x: modelSize.x,  // 局部坐标已经考虑了沙盘的缩放
        y: modelSize.y,
        z: modelSize.z
    };
    
    // 验证长宽比（应该接近 6:5 = 1.2）
    const aspectRatio = modelSize.x / modelSize.z;
    console.log(`📊 底座长宽比: ${aspectRatio.toFixed(3)} (应该接近 1.2，即 6:5)`);
    
    // ⚠️ 坐标范围（用于坐标转换）- 使用底座的**局部坐标**包围盒
    const bounds = {
        min: {
            x: baseBoxLocal.min.x,
            y: baseBoxLocal.min.y,
            z: baseBoxLocal.min.z
        },
        max: {
            x: baseBoxLocal.max.x,
            y: baseBoxLocal.max.y,
            z: baseBoxLocal.max.z
        }
    };
    
    // ⭐ 逻辑尺寸：客户端定义的固定尺寸（用于坐标转换）
    const LOGICAL_DIMENSIONS = {
        width: 6.0,   // X轴（米）
        depth: 5.0    // Z轴（米）
    };
    
    const dimensions = {
        // ⭐ 逻辑尺寸（用于坐标转换，固定值）
        logical: {
            width: LOGICAL_DIMENSIONS.width,    // 6.0m
            depth: LOGICAL_DIMENSIONS.depth,    // 5.0m
            aspectRatio: LOGICAL_DIMENSIONS.width / LOGICAL_DIMENSIONS.depth  // 1.2
        },
        // 模型实际尺寸（场景中，整个模型包括底座）
        scaled: {
            width: modelSize.x,   // X轴宽度（整体）
            height: modelSize.y,  // Y轴高度（整体）
            depth: modelSize.z,   // Z轴深度（整体）
            aspectRatio: aspectRatio  // 实际长宽比
        },
        // 模型原始尺寸（缩放前，整体）
        original: {
            width: originalSize.x,   // X轴宽度
            height: originalSize.y,  // Y轴高度
            depth: originalSize.z    // Z轴深度
        },
        // 地面网格信息（仅供参考）
        groundMesh: groundMesh ? {
            name: groundName,
            width: groundSize.x,
            depth: groundSize.z,
            yPosition: groundYPosition
        } : null,
        // 中心点位置
        center: {
            x: center.x,
            y: center.y,
            z: center.z
        },
        // 包围盒范围（整体，用于坐标转换）
        bounds: bounds,
        // 地面信息
        ground: {
            name: groundName,
            found: !!groundMesh,
            yPosition: groundYPosition  // 地面的Y坐标高度
        },
        // 缩放比例
        scale: scale
    };
    
    console.log('📏 沙盘尺寸 - 逻辑: 6.0m × 5.0m (用于坐标转换) ✅');
    
    // 🔄 更新坐标转换模块的动态包围盒
    // ⚠️ 使用底座的**局部坐标**包围盒
    // 因为客户端的 6m×5m 对应底座，车辆是沙盘的子对象（使用局部坐标）
    updateSandboxBounds({
        min: { x: dimensions.bounds.min.x, z: dimensions.bounds.min.z },
        max: { x: dimensions.bounds.max.x, z: dimensions.bounds.max.z },
        scale: 1.0  // 已经是局部坐标，不需要缩放
    });
    console.log(`✅ 坐标转换包围盒已更新（使用底座局部坐标 ${baseMesh ? baseMesh.name : '整体包围盒'}）`);
    console.log(`   更新后的包围盒: X[${dimensions.bounds.min.x.toFixed(3)} ~ ${dimensions.bounds.max.x.toFixed(3)}], Z[${dimensions.bounds.min.z.toFixed(3)} ~ ${dimensions.bounds.max.z.toFixed(3)}]`);
    
    if (groundMesh && groundBox) {
        console.log(`💡 Standardmaterial206 范围（仅用于车辆Y高度计算）:`);
        console.log(`  - X: ${groundBox.min.x.toFixed(3)} ~ ${groundBox.max.x.toFixed(3)}`);
        console.log(`  - Z: ${groundBox.min.z.toFixed(3)} ~ ${groundBox.max.z.toFixed(3)}`);
        console.log(`  - Y (路面高度): ${groundYPosition.toFixed(3)}`);
    }
    
    // // 🧪 测试坐标映射（手动验证）
    // console.log('🧪 验证坐标映射（客户端 → 沙盘局部）:');
    // console.log(`   客户端(0, 0) 应该 → 局部(-3.000, 2.500) [左下角]`);
    // console.log(`   客户端(6, 0) 应该 → 局部(3.000, 2.500) [右下角]`);
    // console.log(`   客户端(0, 5) 应该 → 局部(-3.000, -2.500) [左上角]`);
    // console.log(`   客户端(6, 5) 应该 → 局部(3.000, -2.500) [右上角]`);
    
    // // 🔍 分析所有大型网格，找出真正的底座
    // console.log('🔍 分析沙盘中的所有大型网格（按面积排序）:');
    // const meshInfoList = [];
    // model.traverse((child) => {
    //     if (child.isMesh && child.geometry) {
    //         const box = new Box3().setFromObject(child);
    //         const size = box.getSize(new Vector3());
    //         const area = size.x * size.z;
            
    //         // 只记录较大的网格（面积 > 1）
    //         if (area > 1) {
    //             meshInfoList.push({
    //                 name: child.name || '(unnamed)',
    //                 area: area,
    //                 size: { x: size.x, y: size.y, z: size.z },
    //                 bounds: { 
    //                     minX: box.min.x, maxX: box.max.x, 
    //                     minY: box.min.y, maxY: box.max.y,
    //                     minZ: box.min.z, maxZ: box.max.z 
    //                 },
    //                 aspectRatio: size.x / size.z,
    //                 visible: child.visible
    //             });
    //         }
    //     }
    // });
    
    // // 按面积排序（从大到小）
    // meshInfoList.sort((a, b) => b.area - a.area);
    
    // console.log(`找到 ${meshInfoList.length} 个大型网格:`);
    // meshInfoList.forEach((info, index) => {
    //     console.log(`  ${index + 1}. ${info.name}:`);
    //     console.log(`     面积: ${info.area.toFixed(2)}, 长宽比: ${info.aspectRatio.toFixed(3)} ${Math.abs(info.aspectRatio - 1.2) < 0.05 ? '✅ (接近6:5)' : ''}`);
    //     console.log(`     尺寸: ${info.size.x.toFixed(2)} × ${info.size.y.toFixed(2)} × ${info.size.z.toFixed(2)}`);
    //     console.log(`     X范围: [${info.bounds.minX.toFixed(2)}, ${info.bounds.maxX.toFixed(2)}]`);
    //     console.log(`     Z范围: [${info.bounds.minZ.toFixed(2)}, ${info.bounds.maxZ.toFixed(2)}]`);
    //     console.log(`     Y范围: [${info.bounds.minY.toFixed(2)}, ${info.bounds.maxY.toFixed(2)}]`);
    //     console.log(`     可见: ${info.visible ? '是' : '否'}`);
    // });
    
    
    return dimensions;
};


// 控制坐标轴显示的函数
export const toggleAxesVisibility = (visible) => {
    const axesToToggle = [
        'MainCoordinateAxes',    // 主坐标轴（原点）
        'SandboxAxes',           // 沙盘坐标轴
        'SandboxCenterAxes'      // 沙盘中心坐标轴
    ];
    
    if (!scene) {
        console.warn('场景尚未初始化');
        return false;
    }
    
    let toggledCount = 0;
    
    scene.traverse((child) => {
        if (axesToToggle.includes(child.name)) {
            child.visible = visible;
            toggledCount++;
        }
    });
    
    return toggledCount > 0;
};

// 控制地面网格显示的函数
export const toggleGridVisibility = (visible) => {
    if (!scene) {
        console.warn('场景尚未初始化');
        return false;
    }
    
    let found = false;
    scene.traverse((child) => {
        if (child.name === 'GroundGrid') {
            child.visible = visible;
            found = true;
        }
    });
    
    return found;
};

// 获取沙盘尺寸信息的函数
export const getSandboxDimensionsInfo = () => {
    const sandboxModel = models.get('sandbox');
    if (!sandboxModel) {
        return null;
    }
    
    return calculateSandboxDimensions(sandboxModel);
};

// ============ 道路表面高度管理 ============
let cachedRoadSurfaceY = null; // 缓存道路表面高度

/**
 * 查找地面网格（支持多种命名方式）
 * @returns {Object|null} 地面网格的信息 {mesh, worldBox, localY}
 */
const findGroundMesh = () => {
    const sandboxModel = models.get('sandbox');
    if (!sandboxModel) {
        return null;
    }
    
    // 支持的地面网格名称列表（按优先级排序）
    const groundMeshNames = [
        'Standardmaterial206',  // 新沙盘模型（带底座）
        'MD_CaoPing',          // 旧沙盘模型（草坪）
        'Ground',              // 通用命名
        'Plane',               // 平面命名
        'Floor'                // 地板命名
    ];
    
    let foundMesh = null;
    let maxArea = 0;
    
    // 遍历沙盘模型，查找地面网格
    sandboxModel.traverse((child) => {
        if (child.isMesh && child.geometry) {
            // 检查名称是否匹配
            const matchesName = groundMeshNames.some(name => 
                child.name.includes(name)
            );
            
            if (matchesName) {
                const box = new Box3().setFromObject(child);
                const size = box.getSize(new Vector3());
                const area = size.x * size.z; // XZ平面面积
                
                // 选择面积最大的作为地面（避免误选小网格）
                if (area > maxArea) {
                    maxArea = area;
                    foundMesh = child;
                }
            }
        }
    });
    
    if (foundMesh) {
        // 计算世界坐标包围盒
        const worldBox = new Box3().setFromObject(foundMesh);
        
        // 将地面顶部的世界坐标转换为沙盘局部坐标
        const worldTopCenter = new Vector3(
            (worldBox.min.x + worldBox.max.x) / 2,
            worldBox.max.y,  // 地面顶部
            (worldBox.min.z + worldBox.max.z) / 2
        );
        
        // 转换为沙盘局部坐标
        const localPosition = sandboxModel.worldToLocal(worldTopCenter.clone());
        
        return { 
            mesh: foundMesh, 
            worldBox: worldBox,
            localY: localPosition.y  // 地面在沙盘局部坐标系中的 Y 值
        };
    }
    
    return null;
};

/**
 * 获取沙盘道路表面的Y坐标（沙盘局部坐标系）
 * @returns {number} 道路表面的Y坐标（局部坐标）
 */
export const getRoadSurfaceY = () => {
    if (cachedRoadSurfaceY !== null) {
        return cachedRoadSurfaceY;
    }
    
    const sandboxModel = models.get('sandbox');
    if (!sandboxModel) {
        return 0;
    }
    
    // 尝试查找地面网格
    const groundMeshInfo = findGroundMesh();
    if (groundMeshInfo) {
        // 使用地面网格在沙盘局部坐标系中的Y坐标
        cachedRoadSurfaceY = groundMeshInfo.localY;
        console.log(`✅ 地面高度已缓存 (沙盘局部坐标): Y = ${cachedRoadSurfaceY.toFixed(4)} (地面网格: ${groundMeshInfo.mesh.name}, 世界坐标: ${groundMeshInfo.worldBox.max.y.toFixed(4)})`);
        return cachedRoadSurfaceY;
    }
    
    // 如果找不到地面网格，使用沙盘底部（局部坐标）
    console.warn('⚠️ 未找到地面网格，使用沙盘底部作为地面高度');
    const worldBox = new Box3().setFromObject(sandboxModel);
    const worldBottomCenter = new Vector3(
        (worldBox.min.x + worldBox.max.x) / 2,
        worldBox.min.y,
        (worldBox.min.z + worldBox.max.z) / 2
    );
    const localPosition = sandboxModel.worldToLocal(worldBottomCenter);
    cachedRoadSurfaceY = localPosition.y;
    return cachedRoadSurfaceY;
};

/**
 * 清除地面高度缓存（当沙盘模型更换时调用）
 */
export const clearRoadSurfaceCache = () => {
    cachedRoadSurfaceY = null;
    console.log('🔄 地面高度缓存已清除');
};

// ============ 标记管理（施工标记、起点、终点） ============
let constructionMarkers = new Map(); // id -> Sprite
let nextConstructionId = 1;
let constructionTexture = null;
let constructionTextureAspect = 1.0; // 默认宽高比，纹理加载后更新（width/height）
let constructionMarkerScale = 0.3; // 全局尺寸缩放（1为基准，0.5为缩小一半）

// 起点和终点标记管理
// 🚕 支持多车辆打车：每个车辆有独立的起点终点图标
// vehicleTaxiMarkers: Map<vehicleId, { startMarker, endMarker }>
let vehicleTaxiMarkers = new Map();

// 临时选择中的起点终点（未打车前的选择）
let tempStartPointMarker = null;
let tempEndPointMarker = null;

// 纹理缓存（全局共享）
let startTexture = null;
let endTexture = null;
let startTextureAspect = 1.0;
let endTextureAspect = 1.0;

const ensureConstructionTexture = () => {
    if (constructionTexture) return constructionTexture;
    try {
        const loader = new TextureLoader();
        constructionTexture = loader.load('/Image/construction.svg', (tex) => {
            try {
                if (tex?.image?.width && tex?.image?.height) {
                    constructionTextureAspect = tex.image.width / tex.image.height;
                    console.log(`🚧 施工标记纹理加载完成 - 尺寸: ${tex.image.width}x${tex.image.height}, 宽高比: ${constructionTextureAspect.toFixed(3)}`);
                }
            } catch (e) {
                console.warn('读取施工标记纹理尺寸失败:', e);
            }
        });
        constructionTexture.generateMipmaps = false;
        constructionTexture.minFilter = LinearFilter;
        constructionTexture.magFilter = LinearFilter;
    } catch (e) {
        console.warn('加载施工标记纹理失败:', e);
    }
    return constructionTexture;
};

// 确保起点纹理加载
const ensureStartTexture = () => {
    if (startTexture) return startTexture;
    try {
        const loader = new TextureLoader();
        startTexture = loader.load('/Image/start.svg', (tex) => {
            try {
                if (tex?.image?.width && tex?.image?.height) {
                    startTextureAspect = tex.image.width / tex.image.height;
                    console.log(`🚀 起点标记纹理加载完成 - 尺寸: ${tex.image.width}x${tex.image.height}, 宽高比: ${startTextureAspect.toFixed(3)}`);
                }
            } catch (e) {
                console.warn('读取起点标记纹理尺寸失败:', e);
            }
        });
        startTexture.generateMipmaps = false;
        startTexture.minFilter = LinearFilter;
        startTexture.magFilter = LinearFilter;
    } catch (e) {
        console.warn('加载起点标记纹理失败:', e);
    }
    return startTexture;
};

// 确保终点纹理加载
const ensureEndTexture = () => {
    if (endTexture) return endTexture;
    try {
        const loader = new TextureLoader();
        endTexture = loader.load('/Image/end.svg', (tex) => {
            try {
                if (tex?.image?.width && tex?.image?.height) {
                    endTextureAspect = tex.image.width / tex.image.height;
                    console.log(`🏁 终点标记纹理加载完成 - 尺寸: ${tex.image.width}x${tex.image.height}, 宽高比: ${endTextureAspect.toFixed(3)}`);
                }
            } catch (e) {
                console.warn('读取终点标记纹理尺寸失败:', e);
            }
        });
        endTexture.generateMipmaps = false;
        endTexture.minFilter = LinearFilter;
        endTexture.magFilter = LinearFilter;
    } catch (e) {
        console.warn('加载终点标记纹理失败:', e);
    }
    return endTexture;
};

/**
 * 在场景中创建一个施工标记，返回 { id, x, z }
 */
export const createConstructionMarkerAt = (x, z, options = {}) => {
    if (!scene) {
        console.warn('场景未初始化，无法创建施工标记');
        return null;
    }

    // 获取沙盘模型
    const sandboxModel = models.get('sandbox');
    if (!sandboxModel) {
        console.warn('沙盘模型未找到，无法创建施工标记');
        return null;
    }

    const tex = ensureConstructionTexture();
    if (!tex) return null;

    const material = new SpriteMaterial({ map: tex, transparent: true });
    const sprite = new Sprite(material);
    // 底部中点对齐所选点
    sprite.center.set(0.5, 0.0);
    // 基于沙盘尺寸的自适应宽度，然后按全局缩放系数缩放，高度按纹理宽高比计算
    let baseWidth = 0.6; // 基准宽度（世界单位）- 缩小到原来的一半
    let widthScale = 1.0;
    try {
        const dims = getSandboxDimensionsInfo();
        if (dims) {
            const base = Math.max(dims.scaled.width, dims.scaled.depth);
            widthScale = Math.max(0.6, Math.min(2.0, base / 120));
        }
    } catch (_) {}
    const width = baseWidth * widthScale * constructionMarkerScale;
    // 高度 = 宽度 / 宽高比，防范除零错误
    const aspectRatio = constructionTextureAspect > 0 ? constructionTextureAspect : 1.0;
    const height = width / aspectRatio;
    sprite.scale.set(width, height, 1);
    
    // 使用沙盘模型的局部坐标系（x, z是沙盘的局部坐标）
    // Y坐标使用道路表面高度，稍微抬高一点避免Z-fighting
    const roadY = getRoadSurfaceY();
    const markerY = roadY + 0.01;
    sprite.position.set(x, markerY, z);
    sprite.name = 'ConstructionMarker';

    // 将标记添加到沙盘模型内部，而不是modelsGroup
    sandboxModel.add(sprite);

    const id = nextConstructionId++;
    constructionMarkers.set(id, sprite);
    
    // 分发施工标记添加事件
    eventBus.emit(EVENTS.CONSTRUCTION_MARKER_ADDED, {
        id,
        position: sprite.position.clone()
    });
    
    console.log(`🚧 施工标记已创建 - 沙盘局部坐标: X=${x.toFixed(3)}, Y=${markerY.toFixed(3)}, Z=${z.toFixed(3)}`);
    console.log(`   地面高度(局部): ${roadY.toFixed(3)}, 标记高度: ${markerY.toFixed(3)}`);
    
    return { id, x, z };
};

export const removeConstructionMarker = (id) => {
    const sprite = constructionMarkers.get(id);
    if (!sprite) return false;
    
    // 标记现在是沙盘模型的子对象
    const sandboxModel = models.get('sandbox');
    if (sandboxModel && sprite.parent === sandboxModel) {
        sandboxModel.remove(sprite);
    } else if (modelsGroup && sprite.parent === modelsGroup) {
        modelsGroup.remove(sprite);
    } else if (scene && sprite.parent === scene) {
        scene.remove(sprite);
    }
    
    if (sprite.material && sprite.material.map) {
        sprite.material.map.dispose();
    }
    if (sprite.material) sprite.material.dispose();
    constructionMarkers.delete(id);
    
    // 分发施工标记删除事件
    eventBus.emit(EVENTS.CONSTRUCTION_MARKER_REMOVED, { id });
    
    return true;
};

export const listConstructionMarkers = () => {
    return Array.from(constructionMarkers.keys());
};

/**
 * 获取所有施工标记的详细信息
 * 返回模型局部坐标，调用者负责根据需要转换为其他坐标系
 * @returns {Array<{id: number, modelX: number, modelZ: number}>}
 */
export const getConstructionMarkersDetails = () => {
    const markers = [];
    constructionMarkers.forEach((sprite, id) => {
        if (sprite && sprite.position) {
            markers.push({
                id: id,
                modelX: sprite.position.x,  // 模型局部坐标
                modelZ: sprite.position.z   // 模型局部坐标
            });
        }
    });
    return markers;
};

// 暂停Three.js渲染
export const pauseRendering = () => {
    console.log('🛑 暂停Three.js渲染');
    isPaused = true;
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    if (renderer) {
        renderer.setAnimationLoop(null);
    }
};

// 恢复Three.js渲染
export const resumeRendering = () => {
    console.log('▶️ 恢复Three.js渲染');
    isPaused = false;
    if (shouldRender && isVisible && animate) {
        rafId = requestAnimationFrame(animate);
    }
};

// 🚀 标记场景需要重新渲染（用于插值系统）
export const markDirty = () => {
    shouldRender = true;
};

// 🚀 暴露markDirty到全局，供vehicleManager的插值系统使用
if (typeof window !== 'undefined') {
    window.__scene3d_markDirty = markDirty;
}

export const getConstructionMarkersCount = () => {
    return constructionMarkers.size;
};

export const clearAllConstructionMarkers = () => {
    const ids = Array.from(constructionMarkers.keys());
    ids.forEach(id => removeConstructionMarker(id));
};

// 尺寸控制接口（对外暴露）
export const setConstructionMarkerScale = (scale) => {
    const s = Number(scale);
    if (!isNaN(s) && isFinite(s)) {
        constructionMarkerScale = Math.max(0.05, Math.min(10, s));
    }
    return constructionMarkerScale;
};

export const getConstructionMarkerScale = () => constructionMarkerScale;


// 鼠标事件监听设置
/**
 * 辅助函数：判断事件是否来自 3D 场景的 canvas
 * 防止 UI 元素点击穿透到 3D 场景（开机启动后的触屏设备问题）
 */
const isEventFromCanvas = (event) => {
    // 检查1：event.target 是否是 canvas 或 container
    if (event.target === renderer?.domElement || event.target === container) {
        return true;
    }
    
    // 检查2：检查 event.target 是否有 data-scene3d-canvas 属性
    if (event.target && event.target.getAttribute && event.target.getAttribute('data-scene3d-canvas') === 'true') {
        return true;
    }
    
    // 检查3：检查 event.target 是否是 canvas 元素
    if (event.target && event.target.tagName && event.target.tagName.toLowerCase() === 'canvas') {
        return true;
    }
    
    // 其他情况（UI 元素），返回 false
    return false;
};

const setupMouseEventListeners = () => {
    if (!container) return;
    
    // 鼠标事件监听在 container 上（兼容性好）
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('contextmenu', (e) => {
        // 只在 canvas 上禁用右键菜单
        if (isEventFromCanvas(e)) {
            e.preventDefault();
        }
    });
    
    // 🔧 触屏事件监听在 renderer.domElement (canvas) 上
    // 避免影响 UI 元素的触屏滚动
    if (renderer && renderer.domElement) {
        renderer.domElement.addEventListener('touchstart', onMouseDown, { passive: false });
        renderer.domElement.addEventListener('touchmove', onMouseMove, { passive: false });
        renderer.domElement.addEventListener('touchend', onMouseUp, { passive: false });
    }
};

// 鼠标按下事件
const onMouseDown = (event) => {
    if (!isPoseSelectionMode && !isPointSelectionMode && !isParkingSlotSelectionMode) return;
    
    // ⚠️ 关键修复：只处理 canvas 的点击，忽略 UI 元素
    // 防止点击按钮时触发 3D 场景交互（开机启动后的事件穿透问题）
    if (!isEventFromCanvas(event)) {
        console.debug('🚫 忽略非 canvas 元素的交互:', event.target?.tagName, event.target?.className);
        return;
    }
    
    // 处理触屏事件（转换为鼠标事件格式）
    const isTouchEvent = event.type.startsWith('touch');
    const clientX = isTouchEvent ? event.touches[0].clientX : event.clientX;
    const clientY = isTouchEvent ? event.touches[0].clientY : event.clientY;
    
    // 触屏事件或鼠标左键
    if (isTouchEvent || event.button === 0) {
        event.preventDefault();
        event.stopPropagation();  // 阻止事件冒泡到父元素
        isMouseDown = true;
        
        // 获取鼠标/触屏在屏幕上的位置 - 更精确的计算
        const rect = container.getBoundingClientRect();
        const mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((clientY - rect.top) / rect.height) * 2 + 1;
        
        // 设置鼠标坐标
        mouse.x = mouseX;
        mouse.y = mouseY;
        
        // 射线检测
        raycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);
        
        // 检测与地面的交点
        const intersects = raycaster.intersectObjects([groundPlane]);
        
        if (intersects.length > 0) {
            startPosition = intersects[0].point.clone();
            // 🔧 使用射线检测到的实际地面高度，不要硬编码为0
            // startPosition.y 已经是正确的地面高度（groundPlane.position.y）
            currentPosition = startPosition.clone();
            
            // 只在位姿选择模式下创建位置标记（点选择模式和车位选择模式不需要）
            if (isPoseSelectionMode) {
                createPositionMarker(startPosition);
            }
            
            // 注意：OrbitControls 已在选择模式启动时禁用，无需重复
        }
    }
};

// 鼠标移动事件
const onMouseMove = (event) => {
    // 点选择模式和车位选择模式下不处理鼠标移动（不需要朝向线）
    if (isPointSelectionMode || isParkingSlotSelectionMode) return;
    
    if (!isPoseSelectionMode || !isMouseDown || !startPosition) return;
    
    // ⚠️ 只处理 canvas 的移动事件
    if (!isEventFromCanvas(event)) {
        return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    // 处理触屏事件（转换为鼠标事件格式）
    const isTouchEvent = event.type.startsWith('touch');
    const clientX = isTouchEvent ? event.touches[0].clientX : event.clientX;
    const clientY = isTouchEvent ? event.touches[0].clientY : event.clientY;
    
    // 获取鼠标/触屏在屏幕上的位置 - 更精确的计算
    const rect = container.getBoundingClientRect();
    const mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((clientY - rect.top) / rect.height) * 2 + 1;
    
    // 射线检测
    raycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);
    const intersects = raycaster.intersectObjects([groundPlane]);
    
    if (intersects.length > 0) {
        currentPosition = intersects[0].point.clone();
        // 🔧 使用射线检测到的实际地面高度
        // currentPosition.y 已经是正确的地面高度
        
        // 更新方向线
        updateDirectionLine(startPosition, currentPosition);
    }
};

// 鼠标释放事件
const onMouseUp = (event) => {
    if ((!isPoseSelectionMode && !isPointSelectionMode && !isParkingSlotSelectionMode) || !isMouseDown) return;
    
    // 处理触屏事件或鼠标左键
    const isTouchEvent = event.type.startsWith('touch');
    if (isTouchEvent || event.button === 0) {
        event.preventDefault();
        isMouseDown = false;
        
        // 重新启用相机控制
        if (controls) controls.enabled = true;
        
        if (isParkingSlotSelectionMode && startPosition) {
            // 车位选择模式：查找最近的空闲车位
            if (parkingSlotSelectionCallback) {
                // 获取沙盘模型，将世界坐标转换为模型局部坐标
                const sandboxModel = models.get('sandbox');
                let localX = startPosition.x;
                let localZ = startPosition.z;
                
                if (sandboxModel) {
                    // 将世界坐标转换为沙盘模型的局部坐标
                    const localPos = sandboxModel.worldToLocal(startPosition.clone());
                    localX = localPos.x;
                    localZ = localPos.z;
                    // console.log(`🔄 坐标转换: 世界坐标 (${startPosition.x.toFixed(3)}, ${startPosition.z.toFixed(3)}) → 局部坐标 (${localX.toFixed(3)}, ${localZ.toFixed(3)})`);
                } else {
                    console.warn('⚠️ 沙盘模型未找到，使用世界坐标');
                }
                
                parkingSlotSelectionCallback({
                    x: localX,
                    z: localZ
                });
            }
        } else if (isPointSelectionMode && startPosition) {
            // 点选择模式：直接返回点击位置，不需要朝向
            if (pointSelectionCallback) {
                // 获取沙盘模型，将世界坐标转换为模型局部坐标
                const sandboxModel = models.get('sandbox');
                let localX = startPosition.x;
                let localZ = startPosition.z;
                
                if (sandboxModel) {
                    // 将世界坐标转换为沙盘模型的局部坐标
                    const localPos = sandboxModel.worldToLocal(startPosition.clone());
                    localX = localPos.x;
                    localZ = localPos.z;
                    console.log(`🔄 点选择坐标转换: 世界坐标 (${startPosition.x.toFixed(3)}, ${startPosition.z.toFixed(3)}) → 局部坐标 (${localX.toFixed(3)}, ${localZ.toFixed(3)})`);
                } else {
                    console.warn('⚠️ 沙盘模型未找到，使用世界坐标');
                }
                
                pointSelectionCallback({
                    x: localX,
                    z: localZ
                });
            }
        } else if (isPoseSelectionMode && startPosition && currentPosition) {
            // 位姿选择模式：计算朝向角度
            // 获取沙盘模型，将世界坐标转换为模型局部坐标
            const sandboxModel = models.get('sandbox');
            let localX = startPosition.x;
            let localZ = startPosition.z;
            
            if (sandboxModel) {
                // 将世界坐标转换为沙盘模型的局部坐标
                const localPos = sandboxModel.worldToLocal(startPosition.clone());
                localX = localPos.x;
                localZ = localPos.z;
                console.log(`🔄 位姿坐标转换: 世界坐标 (${startPosition.x.toFixed(3)}, ${startPosition.z.toFixed(3)}) → 局部坐标 (${localX.toFixed(3)}, ${localZ.toFixed(3)})`);
            } else {
                console.warn('⚠️ 沙盘模型未找到，使用世界坐标');
            }
            
            // 计算朝向角度（弧度）
            // 用户定义的角度系统：X轴正向为0，逆时针为正（0到π），顺时针为负（-π到0）
            const direction = new Vector3().subVectors(currentPosition, startPosition);
            // Z 轴取反，因为模型坐标系中 Z 轴向下是正向
            const angleRad = Math.atan2(-direction.z, direction.x); // 弧度，范围 -π 到 π
            
            console.log(`📐 位姿朝向: ${angleRad.toFixed(3)} rad (${(angleRad * 180 / Math.PI).toFixed(1)}°)`);
            
            // 调用回调函数，传递模型局部坐标和弧度角度
            if (poseSelectionCallback) {
                poseSelectionCallback({
                    x: localX,
                    z: localZ,
                    orientation: angleRad  // 弧度，-π 到 π
                });
            }
        }
    }
};

// 创建位置标记
const createPositionMarker = (position) => {
    // 清除之前的标记
    if (positionMarker) {
        scene.remove(positionMarker);
        if (positionMarker.geometry) positionMarker.geometry.dispose();
        if (positionMarker.material) positionMarker.material.dispose();
    }
    
    // 创建小圆点几何体和材质
    const geometry = new SphereGeometry(0.1, 12, 12); // 小圆点半径0.1 (约5像素大小)
    const material = new MeshBasicMaterial({ color: 0x65d36c }); // 与射线相同颜色
    
    // 创建圆点标记
    positionMarker = new Mesh(geometry, material);
    positionMarker.position.copy(position);
    
    // 使用 groundPlane 的高度（世界坐标），如果 groundPlane 存在的话
    if (groundPlane) {
        positionMarker.position.y = groundPlane.position.y + 0.1; // 地面高度 + 半径偏移
    } else {
        // 后备方案：尝试从沙盘尺寸信息获取地面高度
        const dimensions = getSandboxDimensionsInfo();
        if (dimensions && dimensions.ground.found) {
            positionMarker.position.y = dimensions.ground.yPosition + 0.1;
        } else {
            positionMarker.position.y = 0.1; // 默认值
        }
    }
    
    scene.add(positionMarker);
    console.debug(`📍 位置标记已创建 - 世界坐标: X=${positionMarker.position.x.toFixed(3)}, Y=${positionMarker.position.y.toFixed(3)}, Z=${positionMarker.position.z.toFixed(3)}`);
};

// 创建角度标签
const createAngleLabel = (angleRad, position) => {
    // 清除之前的标签
    if (angleLabel) {
        scene.remove(angleLabel);
        if (angleLabel.material && angleLabel.material.map) {
            angleLabel.material.map.dispose();
        }
        if (angleLabel.material) angleLabel.material.dispose();
    }
    
    // 创建canvas绘制文本
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // 使用高分辨率canvas来提高文字清晰度
    const pixelRatio = window.devicePixelRatio || 1;
    const logicalWidth = 160;
    const logicalHeight = 40;
    
    canvas.width = logicalWidth * pixelRatio;
    canvas.height = logicalHeight * pixelRatio;
    canvas.style.width = logicalWidth + 'px';
    canvas.style.height = logicalHeight + 'px';
    
    // 缩放context以匹配设备像素比
    context.scale(pixelRatio, pixelRatio);
    
    // 启用文字抗锯齿和高质量渲染
    context.textRenderingOptimization = 'optimizeQuality';
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    
    // 绘制圆角矩形背景
    const cornerRadius = 8;
    const x = 0;
    const y = 0;
    const width = logicalWidth;
    const height = logicalHeight;
    
    context.beginPath();
    context.moveTo(x + cornerRadius, y);
    context.lineTo(x + width - cornerRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + cornerRadius);
    context.lineTo(x + width, y + height - cornerRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - cornerRadius, y + height);
    context.lineTo(x + cornerRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - cornerRadius);
    context.lineTo(x, y + cornerRadius);
    context.quadraticCurveTo(x, y, x + cornerRadius, y);
    context.closePath();
    
    // 填充半透明黑色背景
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fill();
    
    // 设置文字样式
    context.fillStyle = '#65d36c'; // 绿色文字
    context.font = 'bold 18px Arial';  // 缩小字号
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // 显示角度（弧度，保留2位小数）
    const angleText = `${angleRad.toFixed(2)} rad`;
    context.fillText(angleText, logicalWidth / 2, logicalHeight / 2);
    
    // 创建纹理和材质
    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // 设置纹理过滤器以获得更清晰的文字
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    
    const spriteMaterial = new SpriteMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.1
    });
    
    // 创建精灵对象
    angleLabel = new Sprite(spriteMaterial);
    angleLabel.scale.set(2, 1, 1); // 缩小标签大小
    
    // 将标签放置在射线中点的侧边
    angleLabel.position.set(
        position.x + 0.5, // 稍微向右偏移
        position.y + 1.5, // 抬高显示
        position.z + 0.5  // 稍微向前偏移
    );
    
    scene.add(angleLabel);
};

// 更新方向线
const updateDirectionLine = (start, end) => {
    // 清除之前的线和箭头
    if (directionLine) {
        scene.remove(directionLine);
        directionLine.geometry.dispose();
        directionLine.material.dispose();
    }
    if (directionArrow) {
        scene.remove(directionArrow);
        directionArrow.geometry.dispose();
        directionArrow.material.dispose();
    }
    if (angleLabel) {
        scene.remove(angleLabel);
        if (angleLabel.material && angleLabel.material.map) {
            angleLabel.material.map.dispose();
        }
        if (angleLabel.material) angleLabel.material.dispose();
    }
    
    // 获取地面高度（世界坐标）
    let groundHeight = 0.1; // 默认值
    if (groundPlane) {
        groundHeight = groundPlane.position.y + 0.1; // 使用 groundPlane 的高度
    } else {
        const dimensions = getSandboxDimensionsInfo();
        if (dimensions && dimensions.ground.found) {
            groundHeight = dimensions.ground.yPosition + 0.1;
        }
    }
    
    // 创建粗射线 - 使用圆柱体几何来实现真正的粗线
    const startPos = new Vector3(start.x, groundHeight, start.z);
    const endPos = new Vector3(end.x, groundHeight, end.z);
    const direction = new Vector3().subVectors(endPos, startPos);
    const length = direction.length();
    
    // 创建圆柱体作为粗线（半径0.03，即直径0.06，相当于线宽增加约6倍的视觉效果）
    const lineGeometry = new CylinderGeometry(0.03, 0.03, length, 8);
    const lineMaterial = new MeshBasicMaterial({ color: 0x65d36c });
    directionLine = new Mesh(lineGeometry, lineMaterial);
    
    // 设置圆柱体位置和朝向 - 修复方向计算
    const cylinderMidPoint = new Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
    directionLine.position.copy(cylinderMidPoint);
    
    // 计算旋转让圆柱体指向正确方向
    direction.normalize();
    const quaternion = new Quaternion();
    quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction); // 从Y轴向上到目标方向
    directionLine.setRotationFromQuaternion(quaternion);
    
    scene.add(directionLine);
    
    // 创建箭头 - 尺寸调整为2倍
    const arrowDirection = new Vector3().subVectors(end, start).normalize();
    const arrowGeometry = new ConeGeometry(0.16, 0.4, 8); // 半径和高度都是2倍：0.08->0.16, 0.2->0.4
    const arrowMaterial = new MeshBasicMaterial({ color: 0x65d36c });
    directionArrow = new Mesh(arrowGeometry, arrowMaterial);
    
    // 设置箭头位置和旋转
    directionArrow.position.set(end.x, groundHeight, end.z);
    directionArrow.lookAt(
        end.x + arrowDirection.x,
        groundHeight + arrowDirection.y,
        end.z + arrowDirection.z
    );
    // 将箭头旋转90度，使其指向正确方向
    directionArrow.rotateX(Math.PI / 2);
    
    scene.add(directionArrow);
    
    // 计算角度并显示标签
    // 用户定义的角度系统：X轴正向为0度，逆时针为正（0到π），顺时针为负（-π到0）
    const deltaX = end.x - start.x;
    const deltaZ = end.z - start.z;
    // 使用 atan2 计算角度，但 Z 轴取反（因为模型坐标系中 Z 轴向下是正向）
    let angleRad = Math.atan2(-deltaZ, deltaX); // 弧度，范围 -π 到 π
    
    // 计算射线中点位置用于放置标签
    const midPoint = new Vector3(
        (start.x + end.x) / 2,
        groundHeight,
        (start.z + end.z) / 2
    );
    
    // 创建角度标签（以弧度显示）
    createAngleLabel(angleRad, midPoint);
};

// 创建地面平面用于射线检测
const createGroundPlane = () => {
    const dimensions = getSandboxDimensionsInfo();
    if (!dimensions) return;
    
    // 🔧 清理旧的 groundPlane（如果存在）
    // if (groundPlane) {
    //     scene.remove(groundPlane);
    //     groundPlane.geometry?.dispose();
    //     groundPlane.material?.dispose();
    //     groundPlane = null;
    // }
    
    // ⚠️ 关键修复：bounds 是局部坐标，需要乘以缩放因子得到世界坐标尺寸
    const scale = dimensions.scale || 6;  // 沙盘缩放因子
    const localWidth = dimensions.bounds.max.x - dimensions.bounds.min.x;
    const localDepth = dimensions.bounds.max.z - dimensions.bounds.min.z;
    
    // 世界坐标中的实际尺寸
    const worldWidth = localWidth * scale;
    const worldDepth = localDepth * scale;
    
    // 中心点也需要考虑缩放（或直接从沙盘模型获取世界坐标）
    const sandboxModel = models.get('sandbox');
    let centerX = 0, centerZ = 0;
    if (sandboxModel) {
        const worldPos = new Vector3();
        sandboxModel.getWorldPosition(worldPos);
        centerX = worldPos.x;
        centerZ = worldPos.z;
    }
    
    // 使用实际的地面高度（如果有的话），否则默认为0
    const groundY = dimensions.ground.found ? dimensions.ground.yPosition : 0;
    
    // 创建足够大的平面确保覆盖整个沙盘区域（扩大2倍确保充分覆盖）
    const geometry = new PlaneGeometry(worldWidth * 2, worldDepth * 2);
    const material = new MeshBasicMaterial({ 
        color: 0x000000, 
        transparent: true, 
        opacity: 0,
        side: DoubleSide
    });
    
    groundPlane = new Mesh(geometry, material);
    groundPlane.rotation.x = -Math.PI / 2; // 水平放置
    groundPlane.position.set(centerX, groundY, centerZ); // 使用实际地面高度和中心位置
    groundPlane.visible = false; // 不可见，只用于射线检测
    scene.add(groundPlane);
    
    console.log('🎯 地面检测平面已创建:', {
        世界尺寸: `${worldWidth.toFixed(1)} × ${worldDepth.toFixed(1)}`,
        平面尺寸: `${(worldWidth * 2).toFixed(1)} × ${(worldDepth * 2).toFixed(1)}`,
        中心: `(${centerX.toFixed(1)}, ${groundY.toFixed(2)}, ${centerZ.toFixed(1)})`
    });
};

// 开始位姿选择模式
export const startPoseSelectionMode = (callback) => {
    if (!scene) {
        console.warn('Scene not initialized');
        return false;
    }
    
    isPoseSelectionMode = true;
    poseSelectionCallback = callback;
    
    // 创建地面检测平面
    createGroundPlane();
    
    // 🔧 禁用 OrbitControls，避免与选择模式冲突
    if (controls) {
        controls.enabled = false;
        console.log('🔒 OrbitControls 已禁用（位姿选择模式）');
    }
    
    // 修改鼠标样式
    if (container) {
        container.style.cursor = 'crosshair';
    }
    
    console.log('🎯 位姿选择模式已启动');
    return true;
};

// 简单点选择模式（用于施工标记等不需要朝向的场景）
let isPointSelectionMode = false;
let pointSelectionCallback = null;

// 车位选择模式（用于AVP选择车位）
let isParkingSlotSelectionMode = false;
let parkingSlotSelectionCallback = null;

export const startPointSelectionMode = (callback) => {
    if (!scene) {
        console.warn('Scene not initialized');
        return false;
    }
    
    isPointSelectionMode = true;
    pointSelectionCallback = callback;
    
    // 创建地面检测平面
    createGroundPlane();
    
    // 🔧 禁用 OrbitControls，避免与选择模式冲突
    if (controls) {
        controls.enabled = false;
        console.log('🔒 OrbitControls 已禁用（点选择模式）');
    }
    
    // 修改鼠标样式
    if (container) {
        container.style.cursor = 'crosshair';
    }
    
    console.log('📍 点选择模式已启动');
    return true;
};

export const stopPointSelectionMode = () => {
    isPointSelectionMode = false;
    pointSelectionCallback = null;
    
    // 清除地面平面
    if (groundPlane) {
        scene.remove(groundPlane);
        groundPlane.geometry.dispose();
        groundPlane.material.dispose();
        groundPlane = null;
    }
    
    // 恢复鼠标样式
    if (container) {
        container.style.cursor = 'default';
    }
    
    console.log('📍 点选择模式已停止');
};

// 开始车位选择模式
export const startParkingSlotSelectionMode = (callback) => {
    if (!scene) {
        console.warn('Scene not initialized');
        return false;
    }
    
    isParkingSlotSelectionMode = true;
    parkingSlotSelectionCallback = callback;
    
    // 创建地面检测平面
    createGroundPlane();
    
    // 🔧 禁用 OrbitControls，避免与选择模式冲突
    if (controls) {
        controls.enabled = false;
        console.log('🔒 OrbitControls 已禁用（车位选择模式）');
    }
    
    // 修改鼠标样式为pointer（表示可点击）
    if (container) {
        container.style.cursor = 'pointer';
    }
    
    console.log('🅿️ 车位选择模式已启动');
    return true;
};

// 停止车位选择模式
export const stopParkingSlotSelectionMode = () => {
    isParkingSlotSelectionMode = false;
    parkingSlotSelectionCallback = null;
    
    // 清除地面平面
    if (groundPlane) {
        scene.remove(groundPlane);
        groundPlane.geometry.dispose();
        groundPlane.material.dispose();
        groundPlane = null;
    }
    
    // 恢复鼠标样式
    if (container) {
        container.style.cursor = 'default';
    }
    
    console.log('🅿️ 车位选择模式已停止');
};

// 停止位姿选择模式
export const stopPoseSelectionMode = () => {
    isPoseSelectionMode = false;
    isMouseDown = false;
    startPosition = null;
    currentPosition = null;
    poseSelectionCallback = null;
    
    // 清除视觉元素
    if (positionMarker) {
        scene.remove(positionMarker);
        if (positionMarker.geometry) positionMarker.geometry.dispose();
        if (positionMarker.material) positionMarker.material.dispose();
        positionMarker = null;
    }
    
    if (directionLine) {
        scene.remove(directionLine);
        directionLine.geometry.dispose();
        directionLine.material.dispose();
        directionLine = null;
    }
    
    if (directionArrow) {
        scene.remove(directionArrow);
        directionArrow.geometry.dispose();
        directionArrow.material.dispose();
        directionArrow = null;
    }
    
    if (angleLabel) {
        scene.remove(angleLabel);
        if (angleLabel.material && angleLabel.material.map) {
            angleLabel.material.map.dispose();
        }
        if (angleLabel.material) angleLabel.material.dispose();
        angleLabel = null;
    }
    
    if (groundPlane) {
        scene.remove(groundPlane);
        groundPlane.geometry.dispose();
        groundPlane.material.dispose();
        groundPlane = null;
    }
    
    // 恢复鼠标样式
    if (container) {
        container.style.cursor = 'default';
    }
    
    // 重新启用相机控制
    if (controls) controls.enabled = true;
    
    console.log('🛑 位姿选择模式已停止');
};

export const destroyScene = () => {
    // 停止位姿选择模式
    stopPoseSelectionMode();
    
    // 停止动画循环
    shouldRender = false;
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    if (renderer) {
        renderer.setAnimationLoop(null);
    }
    
    // 清理性能调整定时器
    if (performanceAdjustTimer) {
        clearTimeout(performanceAdjustTimer);
        performanceAdjustTimer = null;
    }
    
    // 清理所有批处理定时器（问题2修复：添加安全检查）
    if (batchProcessingTimers && batchProcessingTimers.length > 0) {
        batchProcessingTimers.forEach(timer => {
            if (timer) clearTimeout(timer);
        });
        console.log('✅ 批处理定时器已清理');
    }
    batchProcessingTimers = [];
    
    // 清理场景初始化定时器（问题4修复：新增）
    if (sceneInitTimers && sceneInitTimers.length > 0) {
        sceneInitTimers.forEach(timer => {
            if (timer) clearTimeout(timer);
        });
        console.log('✅ 场景初始化定时器已清理');
    }
    sceneInitTimers = [];
    
    // ============ 清理所有事件监听器 ============
    
    // 1. 清理window事件
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
    }
    
    // 2. 清理document事件
    if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    
    // 3. 清理自定义事件（eventBus）
    // 防御性清理：即使函数未定义也尝试移除
    try {
        eventBus.off(EVENTS.SCENE3D_TOPDOWN, handleTopDownView);
        eventBus.off(EVENTS.SCENE3D_DEFAULT, handleDefaultView);
    } catch (error) {
        console.warn('清理自定义事件失败:', error);
    }
    
    // 4. 清理容器鼠标和触屏事件
    if (container) {
        try {
            container.removeEventListener('mousedown', onMouseDown);
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('mouseup', onMouseUp);
        } catch (error) {
            console.warn('清理鼠标事件失败:', error);
        }
    }
    
    // 清理 canvas 触屏事件
    if (renderer && renderer.domElement) {
        try {
            renderer.domElement.removeEventListener('touchstart', onMouseDown);
            renderer.domElement.removeEventListener('touchmove', onMouseMove);
            renderer.domElement.removeEventListener('touchend', onMouseUp);
        } catch (error) {
            console.warn('清理触屏事件失败:', error);
        }
    }
    
    // ============================================
    
    // 清理模型和材质
    models.forEach((model) => {
        if (modelsGroup) modelsGroup.remove(model);
        model.traverse((child) => {
            // 清理几何体
            if (child.geometry) {
                child.geometry.dispose();
            }
            
            // 清理材质和纹理
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                    // 清理所有纹理
                    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'].forEach(mapType => {
                        if (material[mapType]) {
                            material[mapType].dispose();
                        }
                    });
                    material.dispose();
                });
            }
        });
    });
    models.clear();

    // 清理施工标记
    if (constructionMarkers) {
        for (const [id, sprite] of constructionMarkers.entries()) {
            if (modelsGroup && sprite?.parent === modelsGroup) modelsGroup.remove(sprite);
            if (sprite?.material?.map) sprite.material.map.dispose();
            if (sprite?.material) sprite.material.dispose();
        }
        constructionMarkers.clear();
        nextConstructionId = 1;
        constructionTexture = null;
    }
    
    // 清理起点和终点标记
    removeStartPointMarker();
    removeEndPointMarker();
    startTexture = null;
    endTexture = null;
    
    // 清理场景
    if (scene) {
        scene.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        scene.clear();
    }
    
    // 释放控制器
    if (controls) {
        controls.dispose();
        controls = null;
    }
    
    // 释放渲染器
    if (renderer) {
        // 强制清理WebGL资源
        const gl = renderer.getContext();
        if (gl) {
            gl.flush();
            gl.finish();
            
            // 清理所有WebGL缓冲区和纹理
            const ext = gl.getExtension('WEBGL_lose_context');
            if (ext) {
                ext.loseContext();
            }
        }
        
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        renderer = null;
    }
    
    // 清理性能监控
    if (stats && stats.dom.parentNode) {
        stats.dom.remove();
        stats = null;
    }
    
    // 清理性能监控器
    
    
    // 清空容器
    if (container) {
        container.innerHTML = '';
        container = null;
    }
    
    // 重置变量
    scene = camera = clock = null;
    sceneGroup = lightsGroup = modelsGroup = null;
    axesHelper = null;
    shouldRender = true;
    lastRenderTime = 0;
};

// 切换鸟瞰视角（从上往下看，保持X向右、Z向下）
const handleTopDownView = () => animateCameraTo({ position: new Vector3(0, 120, 0.0001), target: new Vector3(0, 0, 0) });

// 恢复默认视角
const handleDefaultView = () => {
    if (!defaultCameraState) return;
    animateCameraTo({ position: defaultCameraState.position.clone(), target: defaultCameraState.target.clone() });
};

// 施工标记开关（在场景中右下角附近放置一个显眼标记）
// 平滑动画切换视角（缓动）
const animateCameraTo = ({ position, target }, duration = 600) => {
    if (!camera || !controls || isAnimatingView) return;
    isAnimatingView = true;
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const toPos = position.clone();
    const toTarget = target.clone();
    const start = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const k = ease(t);
        camera.position.lerpVectors(startPos, toPos, k);
        controls.target.lerpVectors(startTarget, toTarget, k);
        camera.lookAt(controls.target);
        controls.update();
        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            isAnimatingView = false;
        }
    };
    requestAnimationFrame(step);
};

// ============ 起点和终点标记管理 ============

/**
 * 创建临时起点标记（选择中，未打车）
 */
export const createStartPointMarker = (x, z) => {
    if (!scene) {
        console.warn('场景未初始化，无法创建起点标记');
        return null;
    }

    // 获取沙盘模型
    const sandboxModel = models.get('sandbox');
    if (!sandboxModel) {
        console.warn('沙盘模型未找到，无法创建起点标记');
        return null;
    }

    // 移除现有的临时起点标记
    removeStartPointMarker();

    const tex = ensureStartTexture();
    if (!tex) return null;

    const material = new SpriteMaterial({ map: tex, transparent: true });
    const sprite = new Sprite(material);
    // 底部中点对齐所选点
    sprite.center.set(0.5, 0.0);
    
    // 计算标记尺寸 - 保持原始宽高比  
    let baseWidth = 1.0; // 起点标记基础大小
    let widthScale = 1.0;
    try {
        const dims = getSandboxDimensionsInfo();
        if (dims) {
            const base = Math.max(dims.scaled.width, dims.scaled.depth);
            widthScale = Math.max(0.6, Math.min(2.0, base / 120));
        }
    } catch (_) {}
    
    const width = baseWidth * widthScale * constructionMarkerScale;
    // 高度 = 宽度 / 宽高比，保持原始宽高比不缩放
    const aspectRatio = startTextureAspect > 0 ? startTextureAspect : 1.0;
    const height = width / aspectRatio;
    sprite.scale.set(width, height, 1);
    
    // 使用沙盘模型的局部坐标系（x, z是沙盘的局部坐标）
    // Y坐标使用道路表面高度，稍微抬高一点避免Z-fighting
    const roadY = getRoadSurfaceY();
    sprite.position.set(x, roadY + 0.01, z);
    sprite.name = 'TempStartPointMarker';

    // 将标记添加到沙盘模型内部
    sandboxModel.add(sprite);
    tempStartPointMarker = sprite;
    
    console.debug(`🚀 临时起点标记已创建: (${x.toFixed(3)}, ${roadY.toFixed(3)}, ${z.toFixed(3)})`);
    
    return { x, z };
};

/**
 * 为指定车辆创建起点终点标记（打车成功后）
 * @param {number} vehicleId - 车辆ID
 * @param {Object} startCoords - 起点坐标 {x, z}
 * @param {Object} endCoords - 终点坐标 {x, z}
 */
export const createTaxiMarkersForVehicle = (vehicleId, startCoords, endCoords) => {
    if (!scene) {
        console.warn('场景未初始化，无法创建打车标记');
        return false;
    }

    const sandboxModel = models.get('sandbox');
    if (!sandboxModel) {
        console.warn('沙盘模型未找到，无法创建打车标记');
        return false;
    }

    // 如果该车辆已有标记，先移除
    removeTaxiMarkersForVehicle(vehicleId);

    const roadY = getRoadSurfaceY();
    
    // 创建起点标记
    const startTex = ensureStartTexture();
    if (startTex) {
        const startMaterial = new SpriteMaterial({ map: startTex, transparent: true });
        const startSprite = new Sprite(startMaterial);
        startSprite.center.set(0.5, 0.0);
        
        let baseWidth = 1.0;
        let widthScale = 1.0;
        try {
            const dims = getSandboxDimensionsInfo();
            if (dims) {
                const base = Math.max(dims.scaled.width, dims.scaled.depth);
                widthScale = Math.max(0.6, Math.min(2.0, base / 120));
            }
        } catch (_) {}
        
        const width = baseWidth * widthScale * constructionMarkerScale;
        const aspectRatio = startTextureAspect > 0 ? startTextureAspect : 1.0;
        const height = width / aspectRatio;
        startSprite.scale.set(width, height, 1);
        startSprite.position.set(startCoords.x, roadY + 0.01, startCoords.z);
        startSprite.name = `VehicleTaxiStartMarker_${vehicleId}`;
        sandboxModel.add(startSprite);
        
        // 创建终点标记
        const endTex = ensureEndTexture();
        if (endTex) {
            const endMaterial = new SpriteMaterial({ map: endTex, transparent: true });
            const endSprite = new Sprite(endMaterial);
            endSprite.center.set(0.5, 0.0);
            
            const endAspectRatio = endTextureAspect > 0 ? endTextureAspect : 1.0;
            const endHeight = width / endAspectRatio;
            endSprite.scale.set(width, endHeight, 1);
            endSprite.position.set(endCoords.x, roadY + 0.01, endCoords.z);
            endSprite.name = `VehicleTaxiEndMarker_${vehicleId}`;
            sandboxModel.add(endSprite);
            
            // 保存到 Map
            vehicleTaxiMarkers.set(vehicleId, {
                startMarker: startSprite,
                endMarker: endSprite
            });
            
            console.log(`🚕 车辆 ${vehicleId} 打车标记已创建: 起点(${startCoords.x.toFixed(3)}, ${startCoords.z.toFixed(3)}), 终点(${endCoords.x.toFixed(3)}, ${endCoords.z.toFixed(3)})`);
            return true;
        }
    }
    
    return false;
};

/**
 * 创建临时终点标记（选择中，未打车）
 */
export const createEndPointMarker = (x, z) => {
    if (!scene) {
        console.warn('场景未初始化，无法创建终点标记');
        return null;
    }

    // 获取沙盘模型
    const sandboxModel = models.get('sandbox');
    if (!sandboxModel) {
        console.warn('沙盘模型未找到，无法创建终点标记');
        return null;
    }

    // 移除现有的临时终点标记
    removeEndPointMarker();

    const tex = ensureEndTexture();
    if (!tex) return null;

    const material = new SpriteMaterial({ map: tex, transparent: true });
    const sprite = new Sprite(material);
    // 底部中点对齐所选点
    sprite.center.set(0.5, 0.0);
    
    // 计算标记尺寸 - 保持原始宽高比
    let baseWidth = 1.0; // 终点标记基础大小
    let widthScale = 1.0;
    try {
        const dims = getSandboxDimensionsInfo();
        if (dims) {
            const base = Math.max(dims.scaled.width, dims.scaled.depth);
            widthScale = Math.max(0.6, Math.min(2.0, base / 120));
        }
    } catch (_) {}
    
    const width = baseWidth * widthScale * constructionMarkerScale;
    // 高度 = 宽度 / 宽高比，保持原始宽高比不缩放
    const aspectRatio = endTextureAspect > 0 ? endTextureAspect : 1.0;
    const height = width / aspectRatio;
    sprite.scale.set(width, height, 1);
    
    // 使用沙盘模型的局部坐标系（x, z是沙盘的局部坐标）
    // Y坐标使用道路表面高度，稍微抬高一点避免Z-fighting
    const roadY = getRoadSurfaceY();
    sprite.position.set(x, roadY + 0.01, z);
    sprite.name = 'TempEndPointMarker';

    // 将标记添加到沙盘模型内部
    sandboxModel.add(sprite);
    tempEndPointMarker = sprite;
    
    console.debug(`🏁 临时终点标记已创建: (${x.toFixed(3)}, ${roadY.toFixed(3)}, ${z.toFixed(3)})`);
    
    return { x, z };
};

/**
 * 移除临时起点标记（选择中的）
 */
export const removeStartPointMarker = () => {
    if (!tempStartPointMarker) return false;
    
    // 标记是沙盘模型的子对象
    const sandboxModel = models.get('sandbox');
    if (sandboxModel && tempStartPointMarker.parent === sandboxModel) {
        sandboxModel.remove(tempStartPointMarker);
    } else if (modelsGroup && tempStartPointMarker.parent === modelsGroup) {
        modelsGroup.remove(tempStartPointMarker);
    } else if (scene && tempStartPointMarker.parent === scene) {
        scene.remove(tempStartPointMarker);
    }
    
    if (tempStartPointMarker.material && tempStartPointMarker.material.map) {
        tempStartPointMarker.material.map.dispose();
    }
    if (tempStartPointMarker.material) tempStartPointMarker.material.dispose();
    
    tempStartPointMarker = null;
    console.debug('🚀 临时起点标记已移除');
    return true;
};

/**
 * 移除临时终点标记（选择中的）
 */
export const removeEndPointMarker = () => {
    if (!tempEndPointMarker) return false;
    
    // 标记是沙盘模型的子对象
    const sandboxModel = models.get('sandbox');
    if (sandboxModel && tempEndPointMarker.parent === sandboxModel) {
        sandboxModel.remove(tempEndPointMarker);
    } else if (modelsGroup && tempEndPointMarker.parent === modelsGroup) {
        modelsGroup.remove(tempEndPointMarker);
    } else if (scene && tempEndPointMarker.parent === scene) {
        scene.remove(tempEndPointMarker);
    }
    
    if (tempEndPointMarker.material && tempEndPointMarker.material.map) {
        tempEndPointMarker.material.map.dispose();
    }
    if (tempEndPointMarker.material) tempEndPointMarker.material.dispose();
    
    tempEndPointMarker = null;
    console.debug('🏁 临时终点标记已移除');
    return true;
};

/**
 * 移除指定车辆的打车标记
 * @param {number} vehicleId - 车辆ID
 */
export const removeTaxiMarkersForVehicle = (vehicleId) => {
    if (!vehicleTaxiMarkers.has(vehicleId)) {
        return false;
    }
    
    const markers = vehicleTaxiMarkers.get(vehicleId);
    const sandboxModel = models.get('sandbox');
    
    // 移除起点标记
    if (markers.startMarker) {
        if (sandboxModel && markers.startMarker.parent === sandboxModel) {
            sandboxModel.remove(markers.startMarker);
        }
        if (markers.startMarker.material && markers.startMarker.material.map) {
            markers.startMarker.material.map.dispose();
        }
        if (markers.startMarker.material) markers.startMarker.material.dispose();
    }
    
    // 移除终点标记
    if (markers.endMarker) {
        if (sandboxModel && markers.endMarker.parent === sandboxModel) {
            sandboxModel.remove(markers.endMarker);
        }
        if (markers.endMarker.material && markers.endMarker.material.map) {
            markers.endMarker.material.map.dispose();
        }
        if (markers.endMarker.material) markers.endMarker.material.dispose();
    }
    
    // 从 Map 中删除
    vehicleTaxiMarkers.delete(vehicleId);
    console.log(`🚕 车辆 ${vehicleId} 的打车标记已移除`);
    return true;
};

/**
 * 移除所有车辆的打车标记（清理用）
 */
export const removeAllTaxiMarkers = () => {
    const count = vehicleTaxiMarkers.size;
    vehicleTaxiMarkers.forEach((markers, vehicleId) => {
        removeTaxiMarkersForVehicle(vehicleId);
    });
    console.log(`🚕 已移除所有 ${count} 个车辆的打车标记`);
};

/**
 * 获取起点标记位置
 */
export const getStartPointPosition = () => {
    if (!startPointMarker) return null;
    return {
        x: startPointMarker.position.x,
        z: startPointMarker.position.z
    };
};

/**
 * 获取终点标记位置
 */
export const getEndPointPosition = () => {
    if (!endPointMarker) return null;
    return {
        x: endPointMarker.position.x,
        z: endPointMarker.position.z
    };
};

/**
 * 清除所有起点和终点标记
 */
export const clearTaxiPoints = () => {
    removeStartPointMarker();
    removeEndPointMarker();
    console.log('🚕 所有出租车路径标记已清除');
};

// ========================================
// 🚗 导出车辆管理函数
// ========================================
export { 
    addVehicleToScene as addVehicle, 
    removeVehicleFromScene as removeVehicle, 
    updateVehicleInScene as updateVehiclePosition,
    clearAllVehicles,
    getAllVehicleIds,
    hasVehicle,
    updateTrafficLightGroup,
    isTrafficLightManagerInitialized
};
