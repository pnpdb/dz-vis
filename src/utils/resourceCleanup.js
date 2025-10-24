/**
 * Three.js 资源清理工具
 * 统一的资源释放逻辑，防止内存泄漏
 */

/**
 * 清理材质的所有纹理贴图
 * @param {THREE.Material} material - 材质对象
 */
export function disposeMaterialTextures(material) {
    if (!material) return;
    
    // Three.js 材质可能包含的所有纹理类型
    const textureProperties = [
        'map',              // 颜色贴图
        'lightMap',         // 光照贴图
        'bumpMap',          // 凹凸贴图
        'normalMap',        // 法线贴图
        'specularMap',      // 镜面反射贴图
        'envMap',           // 环境贴图
        'alphaMap',         // 透明度贴图
        'aoMap',            // 环境光遮蔽贴图
        'displacementMap',  // 位移贴图
        'emissiveMap',      // 自发光贴图
        'gradientMap',      // 渐变贴图
        'metalnessMap',     // 金属度贴图
        'roughnessMap',     // 粗糙度贴图
    ];
    
    textureProperties.forEach(prop => {
        if (material[prop] && typeof material[prop].dispose === 'function') {
            material[prop].dispose();
            material[prop] = null;
        }
    });
}

/**
 * 清理单个材质
 * @param {THREE.Material} material - 材质对象
 */
export function disposeMaterial(material) {
    if (!material) return;
    
    // 清理纹理
    disposeMaterialTextures(material);
    
    // 清理材质本身
    if (typeof material.dispose === 'function') {
        material.dispose();
    }
}

/**
 * 清理几何体
 * @param {THREE.BufferGeometry} geometry - 几何体对象
 */
export function disposeGeometry(geometry) {
    if (!geometry) return;
    
    if (typeof geometry.dispose === 'function') {
        geometry.dispose();
    }
}

/**
 * 清理网格对象（包括几何体和材质）
 * @param {THREE.Mesh} mesh - 网格对象
 */
export function disposeMesh(mesh) {
    if (!mesh) return;
    
    // 清理几何体
    if (mesh.geometry) {
        disposeGeometry(mesh.geometry);
        mesh.geometry = null;
    }
    
    // 清理材质（可能是单个或数组）
    if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach(material => disposeMaterial(material));
        mesh.material = null;
    }
}

/**
 * 递归清理 Three.js 对象树
 * @param {THREE.Object3D} object - Three.js 对象
 * @param {Object} options - 清理选项
 * @param {boolean} options.removeFromParent - 是否从父节点移除（默认true）
 * @param {boolean} options.recursive - 是否递归清理子节点（默认true）
 */
export function disposeObject3D(object, options = {}) {
    if (!object) return;
    
    const {
        removeFromParent = true,
        recursive = true
    } = options;
    
    // 递归清理子节点
    if (recursive && object.children) {
        // 从后往前遍历，避免索引问题
        for (let i = object.children.length - 1; i >= 0; i--) {
            disposeObject3D(object.children[i], options);
        }
    }
    
    // 清理网格资源
    if (object.isMesh) {
        disposeMesh(object);
    }
    
    // 清理线条
    if (object.isLine) {
        if (object.geometry) {
            disposeGeometry(object.geometry);
        }
        if (object.material) {
            disposeMaterial(object.material);
        }
    }
    
    // 清理点
    if (object.isPoints) {
        if (object.geometry) {
            disposeGeometry(object.geometry);
        }
        if (object.material) {
            disposeMaterial(object.material);
        }
    }
    
    // 清理精灵
    if (object.isSprite) {
        if (object.material) {
            disposeMaterial(object.material);
        }
    }
    
    // 从父节点移除
    if (removeFromParent && object.parent) {
        object.parent.remove(object);
    }
}

/**
 * 批量清理对象数组
 * @param {Array<THREE.Object3D>} objects - 对象数组
 * @param {Object} options - 清理选项
 * @returns {number} 清理的对象数量
 */
export function disposeObjects(objects, options = {}) {
    if (!Array.isArray(objects)) {
        console.warn('⚠️ disposeObjects: 输入不是数组');
        return 0;
    }
    
    let count = 0;
    objects.forEach(obj => {
        if (obj) {
            disposeObject3D(obj, options);
            count++;
        }
    });
    
    return count;
}

/**
 * 清理 Map 中存储的 Three.js 对象
 * @param {Map} objectMap - 存储对象的 Map
 * @param {Function} filter - 过滤函数，返回 true 的项会被清理
 * @returns {number} 清理的对象数量
 */
export function disposeMapObjects(objectMap, filter = null) {
    if (!(objectMap instanceof Map)) {
        console.warn('⚠️ disposeMapObjects: 输入不是 Map');
        return 0;
    }
    
    let count = 0;
    const keysToDelete = [];
    
    for (const [key, value] of objectMap.entries()) {
        // 如果有过滤器，只清理符合条件的
        if (filter && !filter(key, value)) {
            continue;
        }
        
        disposeObject3D(value);
        keysToDelete.push(key);
        count++;
    }
    
    // 从 Map 中删除
    keysToDelete.forEach(key => objectMap.delete(key));
    
    return count;
}

/**
 * 创建资源清理器（闭包模式，用于跟踪和清理资源）
 * @returns {Object} 资源清理器对象
 */
export function createResourceCleaner() {
    const resources = {
        objects: new Set(),
        geometries: new Set(),
        materials: new Set(),
        textures: new Set()
    };
    
    return {
        /**
         * 注册需要清理的对象
         */
        register(resource, type = 'object') {
            if (!resource) return;
            
            if (type === 'object' && resources.objects) {
                resources.objects.add(resource);
            } else if (type === 'geometry' && resources.geometries) {
                resources.geometries.add(resource);
            } else if (type === 'material' && resources.materials) {
                resources.materials.add(resource);
            } else if (type === 'texture' && resources.textures) {
                resources.textures.add(resource);
            }
        },
        
        /**
         * 清理所有已注册的资源
         */
        disposeAll() {
            let count = 0;
            
            // 清理对象
            resources.objects.forEach(obj => {
                disposeObject3D(obj);
                count++;
            });
            resources.objects.clear();
            
            // 清理几何体
            resources.geometries.forEach(geo => {
                disposeGeometry(geo);
                count++;
            });
            resources.geometries.clear();
            
            // 清理材质
            resources.materials.forEach(mat => {
                disposeMaterial(mat);
                count++;
            });
            resources.materials.clear();
            
            // 清理纹理
            resources.textures.forEach(tex => {
                if (tex && typeof tex.dispose === 'function') {
                    tex.dispose();
                    count++;
                }
            });
            resources.textures.clear();
            
            return count;
        },
        
        /**
         * 获取已注册资源的统计信息
         */
        getStats() {
            return {
                objects: resources.objects.size,
                geometries: resources.geometries.size,
                materials: resources.materials.size,
                textures: resources.textures.size,
                total: resources.objects.size + resources.geometries.size + 
                       resources.materials.size + resources.textures.size
            };
        }
    };
}

