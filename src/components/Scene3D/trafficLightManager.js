/**
 * 红绿灯管理器
 * 负责控制沙盘中的16个红绿灯，包括灯光切换（无倒计时）
 * 
 * 颜色控制策略（平衡亮度和颜色）：
 * - 保存每个灯的原始底色（暗红/暗黄/暗绿）用于熄灭时显示
 * 
 * - **亮灯时**（底色 + 适中发光 = 鲜艳颜色）：
 *   - material.color 设为中等颜色（0x880000红/0x008800绿/0x888800黄）
 *   - material.emissive 设为鲜艳颜色（0xff0000/0x00ff00/0xffff00）
 *   - material.emissiveIntensity = 3（适中强度，避免过曝）
 *   - 效果：底色提供基础，发光增强亮度 = 鲜艳但不过曝 ✨
 * 
 * - **熄灯时**（显示暗淡底色，形成对比）：
 *   - material.color 恢复为原始暗色（深红/深黄/深绿）
 *   - material.emissive 设为黑色（0x000000）
 *   - material.emissiveIntensity = 0（无发光）
 *   - 效果：暗淡的原始底色，与亮灯形成对比 🌑
 * 
 * 可调参数（在本文件顶部配置）：
 * - LIGHT_ON_INTENSITY: 亮灯时的发光强度（默认3，建议范围2-5）
 */

import * as THREE from 'three';
import { logger } from '@/utils/logger';

// 红绿灯颜色常量
export const TRAFFIC_LIGHT_COLORS = {
    RED: 1,
    GREEN: 2,
    YELLOW: 3
};

// 灯光强度配置
const LIGHT_ON_INTENSITY = 3;      // 亮灯时的发光强度（适中强度，避免过曝）
const LIGHT_OFF_INTENSITY = 0;     // 熄灯时的发光强度

// 红绿灯配置数组（16个红绿灯的完整配置）
// 每个配置包含：红绿灯组名称、绿灯名称、黄灯名称、红灯名称、所属分组
const TRAFFIC_LIGHT_CONFIG = [
    // 第一组（8个红绿灯）
    { group: 'MD_HongLvDeng004', green: 'MD_HongLvDeng_Lv006', yellow: 'MD_HongLvDeng_Huang006', red: 'MD_HongLvDeng_Hong006', groupIndex: 0 },
    { group: 'MD_HongLvDeng002', green: 'MD_HongLvDeng_Lv004', yellow: 'MD_HongLvDeng_Huang004', red: 'MD_HongLvDeng_Hong004', groupIndex: 0 },
    { group: 'MD_HongLvDeng005', green: 'MD_HongLvDeng_Lv007', yellow: 'MD_HongLvDeng_Huang007', red: 'MD_HongLvDeng_Hong007', groupIndex: 0 },
    { group: 'MD_HongLvDeng008', green: 'MD_HongLvDeng_Lv010', yellow: 'MD_HongLvDeng_Huang010', red: 'MD_HongLvDeng_Hong010', groupIndex: 0 },
    { group: 'MD_HongLvDeng017', green: 'MD_HongLvDeng_Lv019', yellow: 'MD_HongLvDeng_Huang019', red: 'MD_HongLvDeng_Hong019', groupIndex: 0 },
    { group: 'MD_HongLvDeng010', green: 'MD_HongLvDeng_Lv012', yellow: 'MD_HongLvDeng_Huang011', red: 'MD_HongLvDeng_Hong012', groupIndex: 0 },
    { group: 'MD_HongLvDeng014', green: 'MD_HongLvDeng_Lv016', yellow: 'MD_HongLvDeng_Huang016', red: 'MD_HongLvDeng_Hong016', groupIndex: 0 },
    { group: 'MD_HongLvDeng015', green: 'MD_HongLvDeng_Lv017', yellow: 'MD_HongLvDeng_Huang017', red: 'MD_HongLvDeng_Hong017', groupIndex: 0 },
    
    // 第二组（8个红绿灯）
    { group: 'MD_HongLvDeng003', green: 'MD_HongLvDeng_Lv005', yellow: 'MD_HongLvDeng_Huang005', red: 'MD_HongLvDeng_Hong005', groupIndex: 1 },
    { group: 'MD_HongLvDeng006', green: 'MD_HongLvDeng_Lv008', yellow: 'MD_HongLvDeng_Huang008', red: 'MD_HongLvDeng_Hong008', groupIndex: 1 },
    { group: 'MD_HongLvDeng007', green: 'MD_HongLvDeng_Lv009', yellow: 'MD_HongLvDeng_Huang009', red: 'MD_HongLvDeng_Hong009', groupIndex: 1 },
    { group: 'MD_HongLvDeng009', green: 'MD_HongLvDeng_Lv011', yellow: 'MD_HongLvDeng_Huang011', red: 'MD_HongLvDeng_Hong011', groupIndex: 1 },
    { group: 'MD_HongLvDeng013', green: 'MD_HongLvDeng_Lv015', yellow: 'MD_HongLvDeng_Huang015', red: 'MD_HongLvDeng_Hong015', groupIndex: 1 },
    { group: 'MD_HongLvDeng012', green: 'MD_HongLvDeng_Lv014', yellow: 'MD_HongLvDeng_Huang014', red: 'MD_HongLvDeng_Hong014', groupIndex: 1 },
    { group: 'MD_HongLvDeng011', green: 'MD_HongLvDeng_Lv013', yellow: 'MD_HongLvDeng_Huang013', red: 'MD_HongLvDeng_Hong013', groupIndex: 1 },
    { group: 'MD_HongLvDeng016', green: 'MD_HongLvDeng_Lv018', yellow: 'MD_HongLvDeng_Huang018', red: 'MD_HongLvDeng_Hong018', groupIndex: 1 }
];

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
        logger.info('开始初始化红绿灯管理器（新模型，16个红绿灯，无倒计时）');
        
        // 遍历配置，查找所有红绿灯
        TRAFFIC_LIGHT_CONFIG.forEach((config, index) => {
            const trafficLight = extractTrafficLightComponents(config, index);
            if (trafficLight) {
                trafficLights.push(trafficLight);
                    } else {
                logger.warn(`红绿灯 ${index} (${config.group}) 提取失败`);
                    }
        });

        if (trafficLights.length === 0) {
            logger.error('未找到任何红绿灯');
            return false;
            }

        logger.info(`✅ 成功初始化 ${trafficLights.length} 个红绿灯`);
        logger.info(`   第一组: 8个红绿灯 (索引0-7)`);
        logger.info(`   第二组: 8个红绿灯 (索引8-15)`);

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
 * 从沙盘模型中提取红绿灯组件
 * @param {Object} config - 红绿灯配置
 * @param {number} index - 红绿灯索引
 * @returns {Object|null} 红绿灯组件对象
 */
function extractTrafficLightComponents(config, index) {
    const components = {
        index,
        config,
        groupIndex: config.groupIndex,
        redLight: null,
        yellowLight: null,
        greenLight: null
    };

    // 在整个沙盘模型中查找红绿灯的各个灯光组件
    sandboxModel.traverse((child) => {
        if (child.type !== 'Mesh') return;

        const name = child.name;
        
        if (name === config.red) {
            components.redLight = child;
            logger.debug(`  找到红灯: ${name}`);
        } else if (name === config.yellow) {
            components.yellowLight = child;
            logger.debug(`  找到黄灯: ${name}`);
        } else if (name === config.green) {
            components.greenLight = child;
            logger.debug(`  找到绿灯: ${name}`);
        }
    });

    // 验证必要组件
    if (!components.redLight || !components.yellowLight || !components.greenLight) {
        logger.warn(`红绿灯 ${index} (${config.group}) 缺少必要组件:`);
        logger.warn(`  红灯 (${config.red}): ${components.redLight ? '✓' : '✗'}`);
        logger.warn(`  黄灯 (${config.yellow}): ${components.yellowLight ? '✓' : '✗'}`);
        logger.warn(`  绿灯 (${config.green}): ${components.greenLight ? '✓' : '✗'}`);
        return null;
    }

    // 克隆材质，避免共享材质导致的联动问题
    cloneMaterialsForTrafficLight(components);

    logger.debug(`✅ 成功提取红绿灯 ${index} (${config.group}) 的组件，属于第${config.groupIndex + 1}组`);
    return components;
}

/**
 * 克隆红绿灯的材质并保存原始颜色
 * @param {Object} components - 红绿灯组件对象
 */
function cloneMaterialsForTrafficLight(components) {
    // 红灯材质克隆和原始颜色保存
    if (components.redLight && components.redLight.material) {
        // 保存原始底色
        components.redLight.originalColor = components.redLight.material.color.clone();
        // 克隆材质
        components.redLight.material = components.redLight.material.clone();
    }
    
    // 黄灯材质克隆和原始颜色保存
    if (components.yellowLight && components.yellowLight.material) {
        components.yellowLight.originalColor = components.yellowLight.material.color.clone();
        components.yellowLight.material = components.yellowLight.material.clone();
    }
    
    // 绿灯材质克隆和原始颜色保存
    if (components.greenLight && components.greenLight.material) {
        components.greenLight.originalColor = components.greenLight.material.color.clone();
        components.greenLight.material = components.greenLight.material.clone();
    }
}

/**
 * 熄灭指定红绿灯的所有灯
 * @param {number} index - 红绿灯索引
 */
function turnOffAllLights(index) {
    if (index < 0 || index >= trafficLights.length) return;
    
    const light = trafficLights[index];
    
    // 熄灭红灯（只控制发光，保持原始底色）
    if (light.redLight && light.redLight.material) {
        light.redLight.material.color.setHex(0x770000);  // 很暗的红色
        light.redLight.material.emissive.setHex(0x000000);
        light.redLight.material.emissiveIntensity = LIGHT_OFF_INTENSITY;
        light.redLight.material.needsUpdate = true;
    }
    
    // 熄灭黄灯
    if (light.yellowLight && light.yellowLight.material) {
        light.yellowLight.material.color.setHex(0x777700);  // 很暗的黄色
        light.yellowLight.material.emissive.setHex(0x000000);
        light.yellowLight.material.emissiveIntensity = LIGHT_OFF_INTENSITY;
        light.yellowLight.material.needsUpdate = true;
    }
    
    // 熄灭绿灯
    if (light.greenLight && light.greenLight.material) {
        light.greenLight.material.color.setHex(0x007700);  // 很暗的绿色
        light.greenLight.material.emissive.setHex(0x000000);
        light.greenLight.material.emissiveIntensity = LIGHT_OFF_INTENSITY;
        light.greenLight.material.needsUpdate = true;
    }
}

/**
 * 设置单个红绿灯的状态
 * @param {number} index - 红绿灯索引 (0-15)
 * @param {number} color - 灯光颜色 (1=红, 2=绿, 3=黄)
 */
export function setTrafficLightState(index, color) {
    if (!initialized) {
        logger.warn('红绿灯管理器未初始化');
        return;
    }

    if (index < 0 || index >= trafficLights.length) {
        logger.warn(`无效的红绿灯索引: ${index}`);
        return;
    }

    const light = trafficLights[index];
    
    // 先熄灭所有灯
    turnOffAllLights(index);

    // 根据颜色点亮对应的灯
    switch (color) {
        case TRAFFIC_LIGHT_COLORS.RED:
            if (light.redLight && light.redLight.material) {
                // 亮灯时：底色用中等红色，发光用鲜艳红色，适中强度
                light.redLight.material.color.setHex(0x550000);     // 中等红色底色
                light.redLight.material.emissive.setHex(0xff0000);  // 鲜艳红色发光
                light.redLight.material.emissiveIntensity = LIGHT_ON_INTENSITY;
                light.redLight.material.needsUpdate = true;
            }
            break;

        case TRAFFIC_LIGHT_COLORS.GREEN:
            if (light.greenLight && light.greenLight.material) {
                // 亮灯时：底色用中等绿色，发光用鲜艳绿色，适中强度
                light.greenLight.material.color.setHex(0x005500);   // 中等绿色底色
                light.greenLight.material.emissive.setHex(0x00ff00);  // 鲜艳绿色发光
                light.greenLight.material.emissiveIntensity = LIGHT_ON_INTENSITY;
                light.greenLight.material.needsUpdate = true;
            }
            break;

        case TRAFFIC_LIGHT_COLORS.YELLOW:
            if (light.yellowLight && light.yellowLight.material) {
                // 亮灯时：底色用中等黄色，发光用鲜艳黄色，适中强度
                light.yellowLight.material.color.setHex(0x555500);   // 中等黄色底色
                light.yellowLight.material.emissive.setHex(0xffff00);  // 鲜艳黄色发光
                light.yellowLight.material.emissiveIntensity = LIGHT_ON_INTENSITY;
                light.yellowLight.material.needsUpdate = true;
            }
            break;

        default:
            logger.warn(`无效的灯光颜色: ${color}`);
            break;
    }
    
    logger.debug(`红绿灯 ${index} (${light.config.group}) 设置为: ${getColorName(color)}`);
}

/**
 * 更新红绿灯组状态（协议接口）
 * @param {number} groupIndex - 组索引 (0=协议第一组, 1=协议第二组)
 * @param {number} color - 灯光颜色 (1=红, 2=绿, 3=黄)
 * @param {number} countdown - 倒计时秒数（保留参数兼容性，但不使用）
 */
export function updateTrafficLightGroup(groupIndex, color, countdown) {
    if (!initialized) {
        logger.warn('红绿灯管理器未初始化');
        return;
    }

    if (groupIndex !== 0 && groupIndex !== 1) {
        logger.warn(`无效的组索引: ${groupIndex}`);
        return;
    }

    // 🔄 交换一组和二组（修正协议组号与实际组号的对应关系）
    // 协议第一组(0) → 实际第二组(1)
    // 协议第二组(1) → 实际第一组(0)
    const actualGroupIndex = groupIndex === 0 ? 1 : 0;

    // 找出该组的所有红绿灯
    const targetLights = trafficLights.filter(light => light.groupIndex === actualGroupIndex);

    if (targetLights.length === 0) {
        logger.warn(`第${groupIndex + 1}组没有找到红绿灯`);
        return;
    }

    // 更新该组的所有红绿灯
    targetLights.forEach(light => {
        setTrafficLightState(light.index, color);
    });

    logger.info(`✅ 协议第${groupIndex + 1}组 (实际第${actualGroupIndex + 1}组) 的 ${targetLights.length} 个红绿灯已更新为: ${getColorName(color)}`);
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
