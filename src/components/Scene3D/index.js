import {
    DRACOLoader,
    GLTFLoader,
    OrbitControls,
} from 'three/examples/jsm/Addons.js';
import {
    AmbientLight,
    CubeTextureLoader,
    DirectionalLight,
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
    Clock,
    LOD,
    BufferAttribute,
    LinearFilter,
    Vector3,
    Raycaster,
    Group,
} from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { performanceMonitor } from '../../utils/performanceMonitor.js';

let scene, camera, container, renderer, controls, stats, clock;
let models = new Map(); // 模型缓存
let resizeHandler = null;
let isVisible = true;
let performanceMode = 'auto'; // auto, high, low
let frameCount = 0;
let lastFPSCheck = 0;
let currentFPS = 60;

// 性能优化相关
let rafId = null;
let shouldRender = true;
let lastRenderTime = 0;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS;

// 场景组织
let sceneGroup = null;
let lightsGroup = null;
let modelsGroup = null;

export const initScene = dom => {
    container = dom;
    clock = new Clock();

    // 发送初始化开始事件
    window.dispatchEvent(new CustomEvent('scene3d-progress', { detail: 0 }));

    // 异步初始化场景以避免阻塞主线程
    setTimeout(() => {
        initSceneCore();
    }, 0);
};

const initSceneCore = async () => {
    try {
        // 步骤1：创建基础场景 (10%)
        window.dispatchEvent(new CustomEvent('scene3d-progress', { detail: 10 }));
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

        // 步骤2：创建相机 (20%)
        window.dispatchEvent(new CustomEvent('scene3d-progress', { detail: 20 }));
        await new Promise(resolve => setTimeout(resolve, 0));
        
        camera = new PerspectiveCamera(
            21,
            container.clientWidth / container.clientHeight,
            1,
            1000
        );
        camera.position.set(0, 40, 50);
        camera.lookAt(0, 0, 0);

        // 步骤3：创建控制器 (30%)
        window.dispatchEvent(new CustomEvent('scene3d-progress', { detail: 30 }));
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
        window.dispatchEvent(new CustomEvent('scene3d-progress', { detail: 50 }));
        await new Promise(resolve => setTimeout(resolve, 0));
        
        renderer = new WebGLRenderer({
            antialias: false, // 初始关闭抗锯齿
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
        renderer.outputColorSpace = 'srgb';
        
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
        window.dispatchEvent(new CustomEvent('scene3d-progress', { detail: 60 }));
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

        // 性能监控（开发环境）
        if (import.meta.env.DEV) {
            stats = new Stats();
            container.appendChild(stats.dom);

            // 初始化性能监控器
            performanceMonitor.init(container);
        }

        // 步骤6：启动渲染循环 (70%)
        window.dispatchEvent(new CustomEvent('scene3d-progress', { detail: 70 }));
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // 智能渲染循环
        animate = (currentTime) => {
            if (!isVisible || !shouldRender) return;
            
            // 帧率控制
            if (currentTime - lastRenderTime < frameInterval) {
                rafId = requestAnimationFrame(animate);
                return;
            }
            
            lastRenderTime = currentTime;
            frameCount++;
            
            // FPS 监控和自适应
            if (currentTime - lastFPSCheck > 1000) {
                currentFPS = Math.round((frameCount * 1000) / (currentTime - lastFPSCheck));
                frameCount = 0;
                lastFPSCheck = currentTime;
                
                // 自动性能调节
                if (performanceMode === 'auto') {
                    if (currentFPS < 20) {
                        switchToLowPerformance();
                        performanceMonitor.logFPS(currentFPS, 1000/currentFPS);
                    } else if (currentFPS > 50) {
                        switchToHighPerformance();
                    }
                }
            }
            
            // 更新时钟
            const deltaTime = clock.getDelta();
            
            // 控制器更新（降频）
            if (controls.enableDamping) {
                controls.update();
            }
            
            // 模型动画更新（如果有的话）
            updateModelAnimations(deltaTime);
            
            // 渲染
            renderer.render(scene, camera);
            
            if (stats) {
                stats.update();
            }
            
            rafId = requestAnimationFrame(animate);
        };

        rafId = requestAnimationFrame(animate);

        // 步骤7：设置光照 (80%)
        window.dispatchEvent(new CustomEvent('scene3d-progress', { detail: 80 }));
        await new Promise(resolve => setTimeout(resolve, 0));
        
        setupLighting();

        // 步骤8：基础场景完成，开始异步加载资源 (70%)
        window.dispatchEvent(new CustomEvent('scene3d-progress', { detail: 70 }));
        
        // 异步加载环境贴图（不阻塞）
        loadEnvironment();
        
        // 异步加载模型（不阻塞，带进度反馈）
        loadModelsWithProgress();
        
        // 基础场景已完成，可以开始交互（即使模型未加载完）
        console.log('基础3D场景初始化完成，界面可交互');
        window.dispatchEvent(new CustomEvent('scene3d-complete'));
        
    } catch (error) {
        console.error('Scene3D 初始化失败:', error);
        window.dispatchEvent(new CustomEvent('scene3d-complete'));
    }
};

// 设置光照系统
const setupLighting = () => {
    // 环境光
    const ambientLight = new AmbientLight(0xffffff, 1.2);
    ambientLight.name = 'AmbientLight';
    lightsGroup.add(ambientLight);

    // 主方向光
    const directionalLight = new DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 10, 10);
    directionalLight.name = 'MainDirectionalLight';
    directionalLight.castShadow = false; // 暂时关闭阴影以提升性能
    lightsGroup.add(directionalLight);

    // 补充光源（更柔和）
    const fillLight = new DirectionalLight(0x87ceeb, 0.8);
    fillLight.position.set(-5, 5, -5);
    fillLight.name = 'FillLight';
    lightsGroup.add(fillLight);
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

// 环境贴图加载
const loadEnvironment = () => {
    const cubeTextureLoader = new CubeTextureLoader()
        .setPath('/Image/skybox/');
    
    cubeTextureLoader.load(
        ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'],
        (texture) => {
            scene.environment = texture;
        },
        undefined,
        (error) => {
            console.warn('环境贴图加载失败:', error);
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

    console.log('开始异步模型加载...');
    
    // 模型加载进度追踪
    let carsProgress = 0;
    let finalProgress = 0;
    
    // 更新总进度的函数
    const updateTotalProgress = () => {
        // 70% 基础场景 + 15% 小车模型 + 15% 沙盘模型 = 100%
        const totalProgress = 70 + (carsProgress * 0.15) + (finalProgress * 0.15);
        window.dispatchEvent(new CustomEvent('scene3d-progress', { detail: Math.round(totalProgress) }));
    };

    // 异步加载小车模型
    const loadCarsModel = async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('开始加载小车模型...');
                loadModelAsync(loader, '/model/cars.glb', 'cars', {
                    scale: 8,
                    position: [0, 0.5, 0],
                    priority: 'high'
                }, (progress) => {
                    carsProgress = progress;
                    updateTotalProgress();
                    console.log(`小车模型加载进度: ${progress}%`);
                }).then(() => {
                    console.log('小车模型加载完成');
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
                console.log('开始加载沙盘模型...');
                loadModelAsync(loader, '/model/final.glb', 'final', {
                    scale: 0.01,
                    position: [0, 1.4, 0],
                    processMaterial: true,
                    priority: 'low',
                    enableLOD: false
                }, (progress) => {
                    finalProgress = progress;
                    updateTotalProgress();
                    console.log(`沙盘模型加载进度: ${progress}%`);
                }).then(() => {
                    console.log('沙盘模型加载完成');
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
        
        console.log('所有模型加载完成');
        window.dispatchEvent(new CustomEvent('scene3d-progress', { detail: 100 }));
        
    } catch (error) {
        console.error('模型加载过程中出现错误:', error);
        window.dispatchEvent(new CustomEvent('scene3d-progress', { detail: 100 }));
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
        loadModel(loader, '/model/cars.glb', 'cars', {
            scale: 8,
            position: [0, 0.5, 0],
            priority: 'high'
        });
    }, 100);

    // 延迟加载大模型，给界面更多响应时间
    setTimeout(() => {
        loadModel(loader, '/model/final.glb', 'final', {
            scale: 0.01,
            position: [0, 1.4, 0],
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
                console.log(`模型 ${key} 加载进度: ${percentage}%`);
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
                        child.material.dithering = false;
                        
                        // 只优化主纹理，跳过复杂纹理处理
                        if (child.material.map) {
                            child.material.map.generateMipmaps = false;
                            child.material.map.minFilter = LinearFilter;
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
            
            // 材质名称匹配
            const materialNames = [
                '材质.003', 'pasted__材质.003', '材质.002', 
                '材贪', '材质', '材贫', 'pasted__材质'
            ];
            
            if (materialNames.includes(child.material.name)) {
                child.material.color.set('gray');
                child.material.needsUpdate = true;
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

export const destroyScene = () => {
    // 停止动画循环
    shouldRender = false;
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    if (renderer) {
        renderer.setAnimationLoop(null);
    }
    
    // 清理事件监听器
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
    }
    
    if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    
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
    performanceMonitor.destroy();
    
    // 清空容器
    if (container) {
        container.innerHTML = '';
        container = null;
    }
    
    // 重置变量
    scene = camera = clock = null;
    sceneGroup = lightsGroup = modelsGroup = null;
    shouldRender = true;
    lastRenderTime = 0;
};
