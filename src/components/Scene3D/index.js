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
import eventBus, { EVENTS } from '@/utils/eventBus.js'

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
            1,
            1000
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

        // 步骤4：创建渲染器 (50%)
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, 50);
        await new Promise(resolve => setTimeout(resolve, 0));
        
        renderer = new WebGLRenderer({
            antialias: true, // 开启抗锯齿，提升视觉质量
            alpha: false, // 禁用透明度以提高性能
            powerPreference: "high-performance",
            stencil: false,
            depth: true,
            logarithmicDepthBuffer: false,
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

            const delta = clock?.getDelta?.() ?? 0;
            scene.traverse((object) => {
                if (object.isMesh && object.material && object.material.uniforms) {
                    const uTime = object.material.uniforms.uTime;
                    if (uTime) {
                        uTime.value += delta;
                    }
                }
            });

            // 更新场景进度 (仅在初始化阶段)
            eventBus.emit(EVENTS.SCENE3D_PROGRESS, Math.min(100, Math.round((currentTime / 1000) * 10)));

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
                        setTimeout(() => {
                            switchToLowPerformance();
                            isPerformanceAdjusting = false;
                        }, 2000);
                    } else if (currentFPS > 55 && !isPerformanceAdjusting) {
                        isPerformanceAdjusting = true;
                        setTimeout(() => {
                            switchToHighPerformance();
                            isPerformanceAdjusting = false;
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
                }
            };
            console.log('🔧 调试工具已挂载到 window.__scene3d__');
            console.log('💡 快速调试命令:');
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

// 设置光照系统（专业级配置 - 降低亮度避免过曝）
const setupLighting = () => {
    // 🌐 半球光（Hemisphere Light）- 模拟天空和地面的环境光
    // 提供更真实的全局照明，替代简单的环境光
    const hemisphereLight = new HemisphereLight(
        0xddeeff,  // 天空颜色（淡蓝色，降低亮度）
        0x332222,  // 地面颜色（深灰棕色）
        0.4        // 强度（从0.6降低到0.4）
    );
    hemisphereLight.name = 'HemisphereLight';
    hemisphereLight.position.set(0, 50, 0);
    lightsGroup.add(hemisphereLight);

    // ☀️ 主平行光（Directional Light）- 模拟太阳光
    // 使用物理光照模式（intensity以坎德拉为单位）
    const directionalLight = new DirectionalLight(0xffffff, 1.2);  // 从2.0降低到1.2
    directionalLight.position.set(10, 20, 10);
    directionalLight.name = 'MainDirectionalLight';
    directionalLight.castShadow = false; // 暂时关闭阴影以提升性能
    lightsGroup.add(directionalLight);

    // 💡 补充平行光（Fill Light）- 提亮阴影区域
    const fillLight = new DirectionalLight(0x87ceeb, 0.5);  // 从1.0降低到0.5
    fillLight.position.set(-10, 10, -10);
    fillLight.name = 'FillLight';
    lightsGroup.add(fillLight);

    // 🔆 背光（Back Light）- 增加轮廓感
    const backLight = new DirectionalLight(0xffffff, 0.3);  // 从0.5降低到0.3
    backLight.position.set(0, 5, -15);
    backLight.name = 'BackLight';
    lightsGroup.add(backLight);

    console.log('💡 光照系统已优化: 半球光 + 三点光照（总强度: 2.4，避免过曝）');
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
    
    // 配置 DRACO 压缩（如果需要）
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    loader.setDRACOLoader(dracoLoader);

    console.info('开始异步模型加载');
    
    // 模型加载进度追踪
    let carsProgress = 0;
    let finalProgress = 0;
    
    // 更新总进度的函数
    const updateTotalProgress = () => {
        // 70% 基础场景 + 15% 小车模型 + 15% 沙盘模型 = 100%
        const totalProgress = 70 + (carsProgress * 0.15) + (finalProgress * 0.15);
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, Math.round(totalProgress));
    };

    // 异步加载小车模型
    const loadCarsModel = async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.info('开始加载小车模型');
                loadModelAsync(loader, '/models/car.glb', 'cars', {
                    scale: 8,
                    position: [0, 0, 0],  // 初始位置，稍后会根据沙盘自动调整
                    priority: 'high'
                }, (progress) => {
                    carsProgress = progress;
                    updateTotalProgress();
                    console.debug(`小车模型加载进度: ${progress}%`);
                }).then(() => {
                    console.info('小车模型加载完成');
                    resolve();
                }).catch((error) => {
                    console.error('小车模型加载失败:', error);
                    resolve(); // 即使失败也继续
                });
            }, 100);
        });
    };

    // 异步加载沙盘模型
    const loadFinalModel = async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.info('开始加载沙盘模型');
                loadModelAsync(loader, '/models/sandbox.glb', 'sandbox', {
                    scale: 6,
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
                        
                        // 🎯 对齐沙盘和小车模型
                        alignSandboxAndCar(sandboxModel, models, scene, '异步加载');
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

    // 并行异步加载两个模型
    try {
        await Promise.all([
            loadCarsModel(),
            loadFinalModel()
        ]);
        
        console.info('所有模型加载完成');
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, 100);
        
    } catch (error) {
        console.error('模型加载过程中出现错误:', error);
        eventBus.emit(EVENTS.SCENE3D_PROGRESS, 100);
    }
};

// 保留原来的loadModels函数作为备用
const loadModels = () => {
    const loader = new GLTFLoader();
    
    // 配置 DRACO 压缩（如果需要）
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    loader.setDRACOLoader(dracoLoader);

    console.log('开始渐进式模型加载...');

    // 渐进式加载：先加载小模型，再加载大模型
     // 小模型加载不会阻塞界面交互
     setTimeout(() => {
         loadModel(loader, '/models/car.glb', 'cars', {
             scale: 8,
             position: [0, 0, 0],  // 初始位置，稍后会根据沙盘自动调整
            priority: 'high'
        });
    }, 100);

     // 延迟加载大模型，给界面更多响应时间
     setTimeout(() => {
         loadModel(loader, '/models/sandbox.glb', 'sandbox', {
             scale: 6,  // 与异步加载保持一致
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
                setTimeout(() => {
                    processBatch(endIndex);
                }, 0);
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
                
                // 🎯 对齐沙盘和小车模型（延迟确保模型完全加载到场景）
                setTimeout(() => {
                    alignSandboxAndCar(model, models, scene, '同步加载');
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
    
    // 为小车模型位置创建小坐标轴 - 默认隐藏
    const carAxes = new AxesHelper(8);
    carAxes.name = 'CarAxes';
    carAxes.position.set(0, 0.5, 0); // 小车模型位置
    carAxes.visible = false; // 默认隐藏
    scene.add(carAxes);
    
    console.log('🔧 坐标系统已添加到场景 (默认隐藏):');
    console.log('  - 主坐标轴: 原点 (0,0,0)，长度30 [隐藏]');
    console.log('  - 地面网格: 50x50，蓝色线条 [隐藏]');
    console.log('  - 小车坐标轴: 位置 (0,0.5,0)，长度8 [隐藏]');
    console.log('  - 红色轴: X轴 (左右方向)');
    console.log('  - 绿色轴: Y轴 (上下方向)');
    console.log('  - 蓝色轴: Z轴 (前后方向)');
    console.log('  提示: 通过设置面板可以控制显示/隐藏');
};

/**
 * 对齐沙盘和小车模型
 * @param {Object} sandboxModel - 沙盘模型
 * @param {Map} modelsMap - 所有模型的Map
 * @param {THREE.Scene} scene - Three.js场景
 * @param {string} loadMode - 加载模式标识（用于日志）
 */
const alignSandboxAndCar = (sandboxModel, modelsMap, scene, loadMode = '') => {
    if (!sandboxModel) {
        console.error('❌ 沙盘模型未找到，无法对齐');
        return;
    }
    
    const logPrefix = loadMode ? `(${loadMode})` : '';
    
    // 1️⃣ 对齐沙盘：让沙盘底座贴地（Y=0）
    const sandboxBox = new Box3().setFromObject(sandboxModel);
    const offsetY = -sandboxBox.min.y;
    sandboxModel.position.y = offsetY;
    
    console.log(`📐 沙盘模型自动对齐${logPrefix}:`);
    console.log(`  - 包围盒最低点(调整前): Y=${sandboxBox.min.y.toFixed(3)}`);
    console.log(`  - 偏移量: ${offsetY.toFixed(3)}`);
    console.log(`  - 调整后沙盘位置: Y=${sandboxModel.position.y.toFixed(3)} (底座贴地)`);
    
    // 2️⃣ 对齐小车：让小车底部贴在道路表面（沙盘底部）
    const carModel = modelsMap.get('cars');
    if (carModel) {
        console.log(`🚗 开始调整小车位置${logPrefix}...`);
        
        // 重新计算沙盘的包围盒（位置已经调整过了）
        const newSandboxBox = new Box3().setFromObject(sandboxModel);
        const roadSurfaceY = newSandboxBox.min.y;  // 道路表面 = 沙盘底部
        
        // 计算小车的包围盒
        const carBox = new Box3().setFromObject(carModel);
        const carBottomY = carBox.min.y;
        
        // 计算需要移动的距离
        const moveDistance = roadSurfaceY - carBottomY;
        carModel.position.y += moveDistance;
        
        // 验证对齐结果
        const verifyCarBox = new Box3().setFromObject(carModel);
        const alignError = verifyCarBox.min.y - roadSurfaceY;
        
        console.log(`  - 道路表面(沙盘底部): Y=${roadSurfaceY.toFixed(3)}`);
        console.log(`  - 小车调整前底部: Y=${carBottomY.toFixed(3)}`);
        console.log(`  - 移动距离: ${moveDistance.toFixed(3)}`);
        console.log(`  - 小车调整后position.y: ${carModel.position.y.toFixed(3)}`);
        console.log(`  - 验证：对齐误差 ${alignError.toFixed(6)} (应该≈0)`);
        
        if (Math.abs(alignError) > 0.001) {
            console.warn(`⚠️ 对齐误差较大: ${alignError.toFixed(6)}`);
        }
    } else {
        console.warn(`⚠️ 小车模型未找到，无法调整位置${logPrefix}`);
    }
    
    // 3️⃣ 添加调试坐标轴（检查是否已存在，避免重复添加）
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
    
    console.log(`✅ 沙盘和小车位置对齐完成${logPrefix}`);
};

// 计算沙盘模型尺寸的工具函数
const calculateSandboxDimensions = (model) => {
    if (!model) {
        console.error('❌ 沙盘模型未找到');
        return null;
    }
    
    // 获取模型的缩放比例
    const scale = model.scale.x; // 假设xyz缩放比例相同
    
    // 1️⃣ 查找地面网格（草坪）作为X/Z尺寸的基准
    let groundMesh = null;
    let maxGroundArea = 0;
    
    model.traverse((child) => {
        if (child.isMesh) {
            // 查找名为 MD_CaoPing 的草坪网格
            if (child.name && child.name.includes('CaoPing')) {
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
    
    // 如果没找到草坪，就找最大的水平网格（Y高度接近0的网格）
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
    
    if (groundMesh) {
        groundBox = new Box3().setFromObject(groundMesh);
        groundBox.getSize(groundSize);
        groundName = groundMesh.name || '(unnamed)';
    }
    
    // 3️⃣ 计算整体包围盒（用于Y高度）
    const totalBox = new Box3().setFromObject(model);
    const totalSize = new Vector3();
    totalBox.getSize(totalSize);
    const center = totalBox.getCenter(new Vector3());
    
    // 4️⃣ 组合尺寸：X/Z来自地面，Y来自整体包围盒
    const combinedSize = {
        x: groundMesh ? groundSize.x : totalSize.x,  // 地面宽度
        y: totalSize.y,                               // 整体高度
        z: groundMesh ? groundSize.z : totalSize.z   // 地面深度
    };
    
    // 计算原始尺寸（去除缩放影响）
    const originalSize = {
        x: combinedSize.x / scale,
        y: combinedSize.y / scale,
        z: combinedSize.z / scale
    };
    
    // 5️⃣ 组合坐标范围：X/Z来自地面，Y来自整体包围盒（用于坐标转换）
    const bounds = {
        min: {
            x: groundBox ? groundBox.min.x : totalBox.min.x,  // 地面X最小值
            y: totalBox.min.y,                                 // 整体Y最小值
            z: groundBox ? groundBox.min.z : totalBox.min.z   // 地面Z最小值
        },
        max: {
            x: groundBox ? groundBox.max.x : totalBox.max.x,  // 地面X最大值
            y: totalBox.max.y,                                 // 整体Y最大值
            z: groundBox ? groundBox.max.z : totalBox.max.z   // 地面Z最大值
        }
    };
    
    const dimensions = {
        // 当前场景中的实际尺寸（基于地面）
        scaled: {
            width: combinedSize.x,   // X轴宽度（地面）
            height: combinedSize.y,  // Y轴高度（整体）
            depth: combinedSize.z    // Z轴深度（地面）
        },
        // 模型原始尺寸（基于地面）
        original: {
            width: originalSize.x,   // X轴宽度（地面）
            height: originalSize.y,  // Y轴高度（整体）
            depth: originalSize.z    // Z轴深度（地面）
        },
        // 中心点位置
        center: {
            x: center.x,
            y: center.y,
            z: center.z
        },
        // 包围盒范围（X/Z基于地面，用于坐标转换）
        bounds: bounds,
        // 地面信息
        ground: {
            name: groundName,
            found: !!groundMesh
        },
        // 缩放比例
        scale: scale
    };
    
    console.log('📏 沙盘模型尺寸计算结果:');
    console.log('='.repeat(50));
    console.log('🎯 坐标轴对应:');
    console.log('  - X轴(红色): 沙盘宽度 (左右方向)');
    console.log('  - Y轴(绿色): 沙盘高度 (上下方向)');  
    console.log('  - Z轴(蓝色): 沙盘深度 (前后方向)');
    console.log('');
    console.log(`🌿 地面基准: ${groundName} ${groundMesh ? '✅' : '❌未找到'}`);
    console.log('');
    console.log('📐 场景中实际尺寸 (已应用缩放):');
    console.log(`  - 宽度(X轴): ${dimensions.scaled.width.toFixed(3)} 单位 ${groundMesh ? '(基于地面)' : '(整体)'}`);
    console.log(`  - 高度(Y轴): ${dimensions.scaled.height.toFixed(3)} 单位 (整体)`);
    console.log(`  - 深度(Z轴): ${dimensions.scaled.depth.toFixed(3)} 单位 ${groundMesh ? '(基于地面)' : '(整体)'}`);
    console.log('');
    console.log('📏 模型原始尺寸 (缩放前):');
    console.log(`  - 宽度(X轴): ${dimensions.original.width.toFixed(3)} 单位`);
    console.log(`  - 高度(Y轴): ${dimensions.original.height.toFixed(3)} 单位`);
    console.log(`  - 深度(Z轴): ${dimensions.original.depth.toFixed(3)} 单位`);
    console.log('');
    console.log('🎯 模型中心点:');
    console.log(`  - X: ${dimensions.center.x.toFixed(3)}`);
    console.log(`  - Y: ${dimensions.center.y.toFixed(3)}`);
    console.log(`  - Z: ${dimensions.center.z.toFixed(3)}`);
    console.log('');
    console.log(`📦 坐标范围 ${groundMesh ? '(基于地面，用于坐标转换)' : '(整体)'}:`);
    console.log(`  - X范围: ${dimensions.bounds.min.x.toFixed(3)} 到 ${dimensions.bounds.max.x.toFixed(3)}`);
    console.log(`  - Y范围: ${dimensions.bounds.min.y.toFixed(3)} 到 ${dimensions.bounds.max.y.toFixed(3)}`);
    console.log(`  - Z范围: ${dimensions.bounds.min.z.toFixed(3)} 到 ${dimensions.bounds.max.z.toFixed(3)}`);
    console.log('');
    console.log(`🔄 缩放比例: ${scale} (${(scale * 100).toFixed(1)}%)`);
    console.log('='.repeat(50));
    
    return dimensions;
};


// 控制坐标轴显示的函数
export const toggleAxesVisibility = (visible) => {
    const axesToToggle = [
        'MainCoordinateAxes',
        'CarAxes', 
        'SandboxAxes',
        'SandboxCenterAxes'
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

// ============ 标记管理（施工标记、起点、终点） ============
let constructionMarkers = new Map(); // id -> Sprite
let nextConstructionId = 1;
let constructionTexture = null;
let constructionTextureAspect = 1.0; // 默认宽高比，纹理加载后更新（width/height）
let constructionMarkerScale = 0.3; // 全局尺寸缩放（1为基准，0.5为缩小一半）

// 起点和终点标记管理
let startPointMarker = null;
let endPointMarker = null;
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

    const tex = ensureConstructionTexture();
    if (!tex) return null;

    const material = new SpriteMaterial({ map: tex, transparent: true });
    const sprite = new Sprite(material);
    // 底部中点对齐所选点
    sprite.center.set(0.5, 0.0);
    // 基于沙盘尺寸的自适应宽度，然后按全局缩放系数缩放，高度按纹理宽高比计算
    let baseWidth = 1.2; // 基准宽度（世界单位）
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
    sprite.position.set(x, 0.05, z);
    sprite.name = 'ConstructionMarker';

    modelsGroup.add(sprite);

    const id = nextConstructionId++;
    constructionMarkers.set(id, sprite);
    
    // 分发施工标记添加事件
    eventBus.emit(EVENTS.CONSTRUCTION_MARKER_ADDED, {
        id,
        position: sprite.position.clone()
    });
    
    return { id, x, z };
};

export const removeConstructionMarker = (id) => {
    const sprite = constructionMarkers.get(id);
    if (!sprite) return false;
    if (modelsGroup && sprite.parent === modelsGroup) {
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

export const getConstructionMarkersDetails = () => {
    const markers = [];
    constructionMarkers.forEach((sprite, id) => {
        if (sprite && sprite.position) {
            markers.push({
                id: id,
                x: sprite.position.x,
                z: sprite.position.z
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
const setupMouseEventListeners = () => {
    if (!container) return;
    
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('contextmenu', (e) => e.preventDefault());
};

// 鼠标按下事件
const onMouseDown = (event) => {
    if (!isPoseSelectionMode && !isPointSelectionMode) return;
    
    if (event.button === 0) { // 左键
        event.preventDefault();
        isMouseDown = true;
        
        // 获取鼠标在屏幕上的位置 - 更精确的计算
        const rect = container.getBoundingClientRect();
        const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // 设置鼠标坐标
        mouse.x = mouseX;
        mouse.y = mouseY;
        
        // 射线检测
        raycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);
        
        // 检测与地面的交点
        const intersects = raycaster.intersectObjects([groundPlane]);
        
        if (intersects.length > 0) {
            startPosition = intersects[0].point.clone();
            // 确保startPosition在地面上
            startPosition.y = 0;
            currentPosition = startPosition.clone();
            
            // 只在位姿选择模式下创建位置标记（点选择模式不需要）
            if (isPoseSelectionMode) {
                createPositionMarker(startPosition);
            }
            
            // 禁用相机控制
            if (controls) controls.enabled = false;
        }
    }
};

// 鼠标移动事件
const onMouseMove = (event) => {
    // 点选择模式下不处理鼠标移动（不需要朝向线）
    if (isPointSelectionMode) return;
    
    if (!isPoseSelectionMode || !isMouseDown || !startPosition) return;
    
    event.preventDefault();
    
    // 获取鼠标在屏幕上的位置 - 更精确的计算
    const rect = container.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // 射线检测
    raycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);
    const intersects = raycaster.intersectObjects([groundPlane]);
    
    if (intersects.length > 0) {
        currentPosition = intersects[0].point.clone();
        // 确保currentPosition在地面上
        currentPosition.y = 0;
        
        // 更新方向线
        updateDirectionLine(startPosition, currentPosition);
    }
};

// 鼠标释放事件
const onMouseUp = (event) => {
    if ((!isPoseSelectionMode && !isPointSelectionMode) || !isMouseDown) return;
    
    if (event.button === 0) { // 左键
        event.preventDefault();
        isMouseDown = false;
        
        // 重新启用相机控制
        if (controls) controls.enabled = true;
        
        if (isPointSelectionMode && startPosition) {
            // 点选择模式：直接返回点击位置，不需要朝向
            if (pointSelectionCallback) {
                pointSelectionCallback({
                    x: startPosition.x,
                    z: startPosition.z
                });
            }
        } else if (isPoseSelectionMode && startPosition && currentPosition) {
            // 位姿选择模式：计算朝向角度
            const direction = new Vector3().subVectors(currentPosition, startPosition);
            // 使用 -atan2(z, x) 来实现逆时针增加，X轴正方向为0度
            let angle = -Math.atan2(direction.z, direction.x) * 180 / Math.PI;
            // 确保角度在 0-360 范围内
            if (angle < 0) angle += 360;
            
            // 调用回调函数
            if (poseSelectionCallback) {
                poseSelectionCallback({
                    x: startPosition.x,
                    z: startPosition.z,
                    orientation: angle
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
    positionMarker.position.y = 0.1; // 调整高度与新的半径匹配
    scene.add(positionMarker);
};

// 创建角度标签
const createAngleLabel = (angle, position) => {
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
    
    // 绘制角度文本
    const angleText = `${angle.toFixed(1)}°`;
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
    
    // 创建粗射线 - 使用圆柱体几何来实现真正的粗线
    const startPos = new Vector3(start.x, 0.1, start.z);
    const endPos = new Vector3(end.x, 0.1, end.z);
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
    directionArrow.position.set(end.x, 0.1, end.z);
    directionArrow.lookAt(
        end.x + arrowDirection.x,
        0.1 + arrowDirection.y,
        end.z + arrowDirection.z
    );
    // 将箭头旋转90度，使其指向正确方向
    directionArrow.rotateX(Math.PI / 2);
    
    scene.add(directionArrow);
    
    // 计算角度并显示标签
    const deltaX = end.x - start.x;
    const deltaZ = end.z - start.z;
    let angle = Math.atan2(deltaZ, deltaX) * (180 / Math.PI); // 转换为度数
    
    // 确保角度在0-360范围内，逆时针从X轴开始
    if (angle < 0) {
        angle += 360;
    }
    
    // 计算射线中点位置用于放置标签
    const midPoint = new Vector3(
        (start.x + end.x) / 2,
        0.1,
        (start.z + end.z) / 2
    );
    
    // 创建角度标签
    createAngleLabel(angle, midPoint);
};

// 创建地面平面用于射线检测
const createGroundPlane = () => {
    const dimensions = getSandboxDimensionsInfo();
    if (!dimensions) return;
    
    const width = dimensions.bounds.max.x - dimensions.bounds.min.x;
    const depth = dimensions.bounds.max.z - dimensions.bounds.min.z;
    const centerX = (dimensions.bounds.max.x + dimensions.bounds.min.x) / 2;
    const centerZ = (dimensions.bounds.max.z + dimensions.bounds.min.z) / 2;
    
    // 创建足够大的平面确保覆盖整个沙盘区域
    const geometry = new PlaneGeometry(width * 1.5, depth * 1.5);
    const material = new MeshBasicMaterial({ 
        color: 0x000000, 
        transparent: true, 
        opacity: 0,
        side: DoubleSide
    });
    
    groundPlane = new Mesh(geometry, material);
    groundPlane.rotation.x = -Math.PI / 2; // 水平放置
    groundPlane.position.set(centerX, 0, centerZ); // 设置到沙盘中心位置
    groundPlane.visible = false; // 不可见，只用于射线检测
    scene.add(groundPlane);
    
    console.log('🎯 地面检测平面已创建:', {
        center: { x: centerX, z: centerZ },
        size: { width: width * 1.5, depth: depth * 1.5 }
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

export const startPointSelectionMode = (callback) => {
    if (!scene) {
        console.warn('Scene not initialized');
        return false;
    }
    
    isPointSelectionMode = true;
    pointSelectionCallback = callback;
    
    // 创建地面检测平面
    createGroundPlane();
    
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
    
    // 4. 清理容器鼠标事件
    if (container) {
        try {
            container.removeEventListener('mousedown', onMouseDown);
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('mouseup', onMouseUp);
        } catch (error) {
            console.warn('清理鼠标事件失败:', error);
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
 * 创建起点标记
 */
export const createStartPointMarker = (x, z) => {
    if (!scene) {
        console.warn('场景未初始化，无法创建起点标记');
        return null;
    }

    // 移除现有的起点标记
    removeStartPointMarker();

    const tex = ensureStartTexture();
    if (!tex) return null;

    const material = new SpriteMaterial({ map: tex, transparent: true });
    const sprite = new Sprite(material);
    // 底部中点对齐所选点
    sprite.center.set(0.5, 0.0);
    
    // 计算标记尺寸 - 保持原始宽高比  
    let baseWidth = 2; // 起点标记2倍大小
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
    sprite.position.set(x, 0.05, z);
    sprite.name = 'StartPointMarker';

    modelsGroup.add(sprite);
    startPointMarker = sprite;
    
    console.log(`🚀 起点标记已创建: (${x.toFixed(3)}, ${z.toFixed(3)})`);
    
    return { x, z };
};

/**
 * 创建终点标记
 */
export const createEndPointMarker = (x, z) => {
    if (!scene) {
        console.warn('场景未初始化，无法创建终点标记');
        return null;
    }

    // 移除现有的终点标记
    removeEndPointMarker();

    const tex = ensureEndTexture();
    if (!tex) return null;

    const material = new SpriteMaterial({ map: tex, transparent: true });
    const sprite = new Sprite(material);
    // 底部中点对齐所选点
    sprite.center.set(0.5, 0.0);
    
    // 计算标记尺寸 - 保持原始宽高比
    let baseWidth = 2; // 终点标记2倍大小
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
    sprite.position.set(x, 0.05, z);
    sprite.name = 'EndPointMarker';

    modelsGroup.add(sprite);
    endPointMarker = sprite;
    
    console.log(`🏁 终点标记已创建: (${x.toFixed(3)}, ${z.toFixed(3)})`);
    
    return { x, z };
};

/**
 * 移除起点标记
 */
export const removeStartPointMarker = () => {
    if (!startPointMarker) return false;
    
    if (modelsGroup && startPointMarker.parent === modelsGroup) {
        modelsGroup.remove(startPointMarker);
    } else if (scene && startPointMarker.parent === scene) {
        scene.remove(startPointMarker);
    }
    
    if (startPointMarker.material && startPointMarker.material.map) {
        startPointMarker.material.map.dispose();
    }
    if (startPointMarker.material) startPointMarker.material.dispose();
    
    startPointMarker = null;
    console.log('🚀 起点标记已移除');
    return true;
};

/**
 * 移除终点标记
 */
export const removeEndPointMarker = () => {
    if (!endPointMarker) return false;
    
    if (modelsGroup && endPointMarker.parent === modelsGroup) {
        modelsGroup.remove(endPointMarker);
    } else if (scene && endPointMarker.parent === scene) {
        scene.remove(endPointMarker);
    }
    
    if (endPointMarker.material && endPointMarker.material.map) {
        endPointMarker.material.map.dispose();
    }
    if (endPointMarker.material) endPointMarker.material.dispose();
    
    endPointMarker = null;
    console.log('🏁 终点标记已移除');
    return true;
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
