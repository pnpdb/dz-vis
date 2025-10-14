/**
 * 资源预加载工具
 * 提前加载关键资源，提升用户体验
 */

import { logger } from '@/utils/logger';

/**
 * 预加载图片
 * @param {string[]} urls - 图片URL列表
 * @returns {Promise<void>}
 */
export async function preloadImages(urls) {
    const promises = urls.map(url => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                logger.debug('ResourcePreloader', `✅ 图片预加载成功: ${url}`);
                resolve();
            };
            img.onerror = () => {
                logger.warn('ResourcePreloader', `❌ 图片预加载失败: ${url}`);
                reject(new Error(`图片加载失败: ${url}`));
            };
            img.src = url;
        });
    });

    try {
        await Promise.allSettled(promises);
    } catch (error) {
        logger.error('ResourcePreloader', '图片预加载失败:', error);
    }
}

/**
 * 预加载3D模型（GLTF/GLB）
 * @param {string[]} urls - 模型URL列表
 * @returns {Promise<void>}
 */
export async function preload3DModels(urls) {
    const promises = urls.map(async url => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            await response.blob(); // 下载但不解析
            logger.debug('ResourcePreloader', `✅ 3D模型预加载成功: ${url}`);
        } catch (error) {
            logger.warn('ResourcePreloader', `❌ 3D模型预加载失败: ${url}`, error);
        }
    });

    await Promise.allSettled(promises);
}

/**
 * 预加载脚本
 * @param {string[]} urls - 脚本URL列表
 * @returns {Promise<void>}
 */
export async function preloadScripts(urls) {
    const promises = urls.map(url => {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.as = 'script';
            link.href = url;
            link.onload = () => {
                logger.debug('ResourcePreloader', `✅ 脚本预加载成功: ${url}`);
                resolve();
            };
            link.onerror = () => {
                logger.warn('ResourcePreloader', `❌ 脚本预加载失败: ${url}`);
                reject(new Error(`脚本加载失败: ${url}`));
            };
            document.head.appendChild(link);
        });
    });

    await Promise.allSettled(promises);
}

/**
 * 预加载路由组件
 * @param {Array} routes - 路由配置数组
 * @param {number} priority - 优先级（1-3，1最高）
 */
export function preloadRouteComponents(routes, priority = 2) {
    routes.forEach(route => {
        if (route.component && typeof route.component === 'function') {
            // 根据优先级决定预加载时机
            if (priority === 1) {
                // 高优先级：立即预加载
                route.component();
            } else if (priority === 2) {
                // 中优先级：空闲时预加载
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(() => route.component());
                } else {
                    setTimeout(() => route.component(), 0);
                }
            } else {
                // 低优先级：延迟预加载
                setTimeout(() => {
                    if ('requestIdleCallback' in window) {
                        requestIdleCallback(() => route.component());
                    } else {
                        route.component();
                    }
                }, 3000);
            }
        }
    });
}

/**
 * 预加载关键资源（应用启动时调用）
 */
export async function preloadCriticalResources() {
    logger.info('ResourcePreloader', '🚀 开始预加载关键资源...');

    const startTime = performance.now();

    // 1. 预加载关键图片
    const criticalImages = [
        '/Image/car.svg',
        '/Image/header2.png',
    ];

    // 2. 预加载3D模型
    const critical3DModels = [
        '/model/cars.glb',
        '/model/final.glb',
    ];

    try {
        await Promise.all([
            preloadImages(criticalImages),
            preload3DModels(critical3DModels),
        ]);

        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);
        logger.info('ResourcePreloader', `✅ 关键资源预加载完成，耗时: ${duration}ms`);
    } catch (error) {
        logger.error('ResourcePreloader', '关键资源预加载失败:', error);
    }
}

/**
 * 预加载次要资源（空闲时调用）
 */
export async function preloadSecondaryResources() {
    logger.info('ResourcePreloader', '📦 开始预加载次要资源...');

    const secondaryImages = [
        '/Image/start.svg',
        '/Image/end.svg',
        '/Image/construction.svg',
        '/Image/wheel.svg',
    ];

    const skyboxImages = [
        '/Image/skybox/px.png',
        '/Image/skybox/nx.png',
        '/Image/skybox/py.png',
        '/Image/skybox/ny.png',
        '/Image/skybox/pz.png',
        '/Image/skybox/nz.png',
    ];

    try {
        await Promise.all([
            preloadImages(secondaryImages),
            preloadImages(skyboxImages),
        ]);

        logger.info('ResourcePreloader', '✅ 次要资源预加载完成');
    } catch (error) {
        logger.error('ResourcePreloader', '次要资源预加载失败:', error);
    }
}

/**
 * 智能预加载（根据网络状况决定）
 */
export async function smartPreload() {
    // 检查网络连接类型（如果支持）
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    let shouldPreload = true;
    let preloadLevel = 'full'; // 'full', 'minimal', 'none'

    if (connection) {
        const effectiveType = connection.effectiveType;
        const saveData = connection.saveData;

        logger.info('ResourcePreloader', `📡 网络类型: ${effectiveType}, 省流量模式: ${saveData}`);

        if (saveData) {
            // 省流量模式：不预加载
            preloadLevel = 'none';
            shouldPreload = false;
        } else if (effectiveType === 'slow-2g' || effectiveType === '2g') {
            // 慢速网络：仅预加载关键资源
            preloadLevel = 'minimal';
        } else if (effectiveType === '3g') {
            // 3G网络：预加载关键资源
            preloadLevel = 'minimal';
        } else {
            // 4G/WiFi：全量预加载
            preloadLevel = 'full';
        }
    }

    if (!shouldPreload) {
        logger.info('ResourcePreloader', '⏸️ 省流量模式已启用，跳过预加载');
        return;
    }

    // 执行预加载
    await preloadCriticalResources();

    if (preloadLevel === 'full') {
        // 空闲时预加载次要资源
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => preloadSecondaryResources(), { timeout: 5000 });
        } else {
            setTimeout(() => preloadSecondaryResources(), 3000);
        }
    }
}

export default {
    preloadImages,
    preload3DModels,
    preloadScripts,
    preloadRouteComponents,
    preloadCriticalResources,
    preloadSecondaryResources,
    smartPreload,
};

