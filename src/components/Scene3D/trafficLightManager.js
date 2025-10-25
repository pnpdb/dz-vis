/**
 * 红绿灯管理器
 * 负责控制沙盘中的8个红绿灯，包括灯光切换和倒计时显示
 */

import * as THREE from 'three';
import { logger } from '@/utils/logger';

// 红绿灯颜色常量
export const TRAFFIC_LIGHT_COLORS = {
    RED: 1,
    GREEN: 2,
    YELLOW: 3
};

// 红绿灯分组配置
// 根据用户提供的信息：2组有2个红绿灯，1组有6个红绿灯
const TRAFFIC_LIGHT_GROUPS = {
    // 2组（索引0和2）
    GROUP_2: [0, 2],  // Zu1(无编号), Zu3(2)
    // 1组（索引1,3,4,5,6,7）
    GROUP_1: [1, 3, 4, 5, 6, 7]  // Zu2(1), Zu4(3), Zu5(4), Zu6(5), Zu7(6), Zu8(7)
};

// 红绿灯对象存储
let trafficLights = [];
let sandboxModel = null;
let initialized = false;

/**
 * 初始化红绿灯管理器
 * @param {THREE.Object3D} sandbox - 沙盘模型对象
 */
export function initTrafficLightManager(sandbox) {
    if (!sandbox) {
        logger.error('初始化红绿灯管理器失败：沙盘模型未提供');
        return false;
    }

    sandboxModel = sandbox;
    trafficLights = [];

    try {
        // 查找所有8个红绿灯组
        const groups = [];
        
        // 按顺序查找 Zu1 到 Zu8
        for (let i = 1; i <= 8; i++) {
            const groupName = `MD_HongLvDeng_Zu${i}`;
            let group = null;
            
            sandboxModel.traverse((child) => {
                if (child.name === groupName && child.type === 'Object3D') {
                    group = child;
                }
            });
            
            if (group) {
                groups.push(group);
            } else {
                logger.warn(`未找到红绿灯组: ${groupName}`);
            }
        }

        if (groups.length === 0) {
            logger.error('未找到任何红绿灯组');
            return false;
        }

        logger.info(`找到 ${groups.length} 个红绿灯组`);

        // 为每个组提取红、黄、绿灯和倒计时对象
        groups.forEach((group, index) => {
            const trafficLight = extractTrafficLightComponents(group, index);
            if (trafficLight) {
                trafficLights.push(trafficLight);
            }
        });

        logger.info(`成功初始化 ${trafficLights.length} 个红绿灯`);

        // 初始化所有红绿灯为熄灭状态
        trafficLights.forEach((light, index) => {
            turnOffAllLights(index);
        });

        initialized = true;
        return true;

    } catch (error) {
        logger.error('初始化红绿灯管理器失败:', error);
        return false;
    }
}

/**
 * 从红绿灯组中提取各个组件
 * @param {THREE.Object3D} group - 红绿灯组对象
 * @param {number} index - 红绿灯索引
 * @returns {Object|null} 红绿灯组件对象
 */
function extractTrafficLightComponents(group, index) {
    const suffix = index === 0 ? '' : `_(${index})`;
    
    const components = {
        index,
        group,
        redLight: null,
        yellowLight: null,
        greenLight: null,
        countdown: null,
        grayBackground: null
    };

    // 在组内查找各个组件
    group.traverse((child) => {
        if (child.type !== 'Mesh') return;

        const name = child.name;
        
        if (name === `MD_HongLvDeng_Hong${suffix}`) {
            components.redLight = child;
        } else if (name === `MD_HongLvDeng_Huang${suffix}`) {
            components.yellowLight = child;
        } else if (name === `MD_HongLvDeng_Lv${suffix}`) {
            components.greenLight = child;
        } else if (name === `MD_HongLvDeng_WenZi${suffix}`) {
            components.countdown = child;
        } else if (name === `MD_HongLvDeng_Hui${suffix}`) {
            components.grayBackground = child;
        }
    });

    // 验证必要组件
    if (!components.redLight || !components.yellowLight || !components.greenLight) {
        logger.warn(`红绿灯 ${index} 缺少必要组件`);
        return null;
    }

    // 克隆材质，避免共享材质导致的联动问题
    cloneMaterialsForTrafficLight(components);

    logger.debug(`成功提取红绿灯 ${index} 的组件`);
    return components;
}

/**
 * 克隆红绿灯的材质
 * @param {Object} components - 红绿灯组件对象
 */
function cloneMaterialsForTrafficLight(components) {
    if (components.redLight && components.redLight.material) {
        components.redLight.material = components.redLight.material.clone();
    }
    if (components.yellowLight && components.yellowLight.material) {
        components.yellowLight.material = components.yellowLight.material.clone();
    }
    if (components.greenLight && components.greenLight.material) {
        components.greenLight.material = components.greenLight.material.clone();
    }
    if (components.countdown && components.countdown.material) {
        components.countdown.material = components.countdown.material.clone();
    }
    if (components.grayBackground && components.grayBackground.material) {
        components.grayBackground.material = components.grayBackground.material.clone();
    }
}

/**
 * 熄灭指定红绿灯的所有灯
 * @param {number} index - 红绿灯索引
 */
function turnOffAllLights(index) {
    if (index < 0 || index >= trafficLights.length) return;
    
    const light = trafficLights[index];
    
    if (light.redLight && light.redLight.material) {
        light.redLight.material.emissive.setHex(0x000000);
        light.redLight.material.emissiveIntensity = 0;
    }
    
    if (light.yellowLight && light.yellowLight.material) {
        light.yellowLight.material.emissive.setHex(0x000000);
        light.yellowLight.material.emissiveIntensity = 0;
    }
    
    if (light.greenLight && light.greenLight.material) {
        light.greenLight.material.emissive.setHex(0x000000);
        light.greenLight.material.emissiveIntensity = 0;
    }

    // 倒计时也熄灭
    if (light.countdown && light.countdown.material) {
        light.countdown.material.emissive.setHex(0x000000);
        light.countdown.material.emissiveIntensity = 0;
    }
}

/**
 * 设置单个红绿灯的状态
 * @param {number} index - 红绿灯索引 (0-7)
 * @param {number} color - 灯光颜色 (1=红, 2=绿, 3=黄)
 * @param {number} countdown - 倒计时秒数
 */
export function setTrafficLightState(index, color, countdown) {
    logger.info(`   📍 setTrafficLightState: index=${index}, color=${color}, countdown=${countdown}`);
    
    if (!initialized) {
        logger.warn('红绿灯管理器未初始化');
        return;
    }

    if (index < 0 || index >= trafficLights.length) {
        logger.warn(`无效的红绿灯索引: ${index}, trafficLights.length=${trafficLights.length}`);
        return;
    }

    const light = trafficLights[index];
    logger.info(`      light 对象存在: ${!!light}`);
    logger.info(`      redLight 存在: ${!!light.redLight}`);
    logger.info(`      yellowLight 存在: ${!!light.yellowLight}`);
    logger.info(`      greenLight 存在: ${!!light.greenLight}`);
    
    // 先熄灭所有灯
    turnOffAllLights(index);

    // 根据颜色点亮对应的灯
    switch (color) {
        case TRAFFIC_LIGHT_COLORS.RED:
            logger.info(`      准备点亮红灯...`);
            if (light.redLight && light.redLight.material) {
                light.redLight.material.emissive.setHex(0xff0000);
                light.redLight.material.emissiveIntensity = 2;
                logger.info(`      ✅ 红灯已点亮: emissive=${light.redLight.material.emissive.getHexString()}, intensity=${light.redLight.material.emissiveIntensity}`);
            } else {
                logger.error(`      ❌ 红灯或材质不存在`);
            }
            // 倒计时也显示红色
            if (light.countdown && light.countdown.material) {
                light.countdown.material.emissive.setHex(0xff0000);
                light.countdown.material.emissiveIntensity = 2;
            }
            break;

        case TRAFFIC_LIGHT_COLORS.GREEN:
            logger.info(`      准备点亮绿灯...`);
            if (light.greenLight && light.greenLight.material) {
                light.greenLight.material.emissive.setHex(0x00ff00);
                light.greenLight.material.emissiveIntensity = 2;
                logger.info(`      ✅ 绿灯已点亮: emissive=${light.greenLight.material.emissive.getHexString()}, intensity=${light.greenLight.material.emissiveIntensity}`);
            } else {
                logger.error(`      ❌ 绿灯或材质不存在`);
            }
            // 倒计时显示绿色
            if (light.countdown && light.countdown.material) {
                light.countdown.material.emissive.setHex(0x00ff00);
                light.countdown.material.emissiveIntensity = 2;
            }
            break;

        case TRAFFIC_LIGHT_COLORS.YELLOW:
            logger.info(`      准备点亮黄灯...`);
            if (light.yellowLight && light.yellowLight.material) {
                light.yellowLight.material.emissive.setHex(0xffff00);
                light.yellowLight.material.emissiveIntensity = 2;
                logger.info(`      ✅ 黄灯已点亮: emissive=${light.yellowLight.material.emissive.getHexString()}, intensity=${light.yellowLight.material.emissiveIntensity}`);
            } else {
                logger.error(`      ❌ 黄灯或材质不存在`);
            }
            // 倒计时显示黄色
            if (light.countdown && light.countdown.material) {
                light.countdown.material.emissive.setHex(0xffff00);
                light.countdown.material.emissiveIntensity = 2;
            }
            break;

        default:
            logger.warn(`无效的灯光颜色: ${color}`);
            break;
    }

    logger.debug(`红绿灯 ${index} 设置为: ${getColorName(color)}, 倒计时: ${countdown}秒`);
}

/**
 * 更新红绿灯组状态
 * @param {number} groupIndex - 组索引 (0=2组, 1=1组)
 * @param {number} color - 灯光颜色
 * @param {number} countdown - 倒计时秒数
 */
export function updateTrafficLightGroup(groupIndex, color, countdown) {
    logger.info(`🚦 updateTrafficLightGroup 被调用: groupIndex=${groupIndex}, color=${color}, countdown=${countdown}`);
    logger.info(`   initialized: ${initialized}`);
    logger.info(`   trafficLights.length: ${trafficLights.length}`);
    
    if (!initialized) {
        logger.warn('红绿灯管理器未初始化');
        return;
    }

    // 确定要更新的红绿灯索引列表
    let targetIndices = [];
    
    if (groupIndex === 0) {
        // 2组
        targetIndices = TRAFFIC_LIGHT_GROUPS.GROUP_2;
    } else if (groupIndex === 1) {
        // 1组
        targetIndices = TRAFFIC_LIGHT_GROUPS.GROUP_1;
    } else {
        logger.warn(`无效的组索引: ${groupIndex}`);
        return;
    }

    logger.info(`   targetIndices: [${targetIndices.join(', ')}]`);

    // 更新该组的所有红绿灯
    targetIndices.forEach(index => {
        logger.info(`   正在更新红绿灯索引 ${index}...`);
        setTrafficLightState(index, color, countdown);
    });

    logger.info(`组 ${groupIndex === 0 ? '2' : '1'} 的 ${targetIndices.length} 个红绿灯已更新为: ${getColorName(color)}, 倒计时: ${countdown}秒`);
}

/**
 * 获取颜色名称
 * @param {number} color - 颜色代码
 * @returns {string} 颜色名称
 */
function getColorName(color) {
    switch (color) {
        case TRAFFIC_LIGHT_COLORS.RED: return '红灯';
        case TRAFFIC_LIGHT_COLORS.GREEN: return '绿灯';
        case TRAFFIC_LIGHT_COLORS.YELLOW: return '黄灯';
        default: return '未知';
    }
}

/**
 * 获取红绿灯数量
 * @returns {number} 红绿灯数量
 */
export function getTrafficLightCount() {
    return trafficLights.length;
}

/**
 * 获取是否已初始化
 * @returns {boolean} 是否已初始化
 */
export function isInitialized() {
    return initialized;
}

/**
 * 销毁红绿灯管理器
 */
export function destroyTrafficLightManager() {
    trafficLights = [];
    sandboxModel = null;
    initialized = false;
    logger.info('红绿灯管理器已销毁');
}

