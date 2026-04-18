/**
 * 红绿灯管理器
 * 负责控制沙盘中的15个红绿灯，包括灯光切换和倒计时秒数渲染
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
 * - COUNTDOWN_ON_INTENSITY: 倒计时数字的发光强度（默认5）
 * - COUNTDOWN_CANVAS_SIZE: Canvas 尺寸（默认512）
 * - COUNTDOWN_FONT_SIZE: 字体大小（默认320）
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

// 倒计时 Canvas 配置
const COUNTDOWN_CANVAS_SIZE = 512;  // Canvas 尺寸（正方形）
const COUNTDOWN_FONT_SIZE = 320;    // 字体大小
const COUNTDOWN_FONT = `bold ${COUNTDOWN_FONT_SIZE}px Arial, sans-serif`;  // 字体样式
const COUNTDOWN_ON_INTENSITY = 5;  // 倒计时数字亮起时的发光强度

// 红绿灯配置数组（15个红绿灯的完整配置）
// 每个配置包含：红绿灯组名称、红灯名称、黄灯名称、绿灯名称、倒计时秒数区域名称、所属分组
const TRAFFIC_LIGHT_CONFIG = [
    // 第一组（8个红绿灯）
    { group: 'MD_HongLvDeng_007', red: 'MD_HongLvDeng_Hong007', yellow: 'MD_HongLvDeng_Huang007', green: 'MD_HongLvDeng_Lv007', countdown: 'MiaoShu007', groupIndex: 0 },
    { group: 'MD_HongLvDeng_011', red: 'MD_HongLvDeng_Hong011', yellow: 'MD_HongLvDeng_Huang011', green: 'MD_HongLvDeng_Lv011', countdown: 'MiaoShu011', groupIndex: 0 },
    { group: 'MD_HongLvDeng_004', red: 'MD_HongLvDeng_Hong004', yellow: 'MD_HongLvDeng_Huang004', green: 'MD_HongLvDeng_Lv004', countdown: 'MiaoShu004', groupIndex: 0 },
    { group: 'MD_HongLvDeng_008', red: 'MD_HongLvDeng_Hong008', yellow: 'MD_HongLvDeng_Huang008', green: 'MD_HongLvDeng_Lv008', countdown: 'MiaoShu008', groupIndex: 0 },
    { group: 'MD_HongLvDeng_006', red: 'MD_HongLvDeng_Hong006', yellow: 'MD_HongLvDeng_Huang006', green: 'MD_HongLvDeng_Lv006', countdown: 'MiaoShu006', groupIndex: 0 },
    { group: 'MD_HongLvDeng_010', red: 'MD_HongLvDeng_Hong010', yellow: 'MD_HongLvDeng_Huang010', green: 'MD_HongLvDeng_Lv010', countdown: 'MiaoShu010', groupIndex: 0 },
    { group: 'MD_HongLvDeng_013', red: 'MD_HongLvDeng_Hong013', yellow: 'MD_HongLvDeng_Huang013', green: 'MD_HongLvDeng_Lv013', countdown: 'MiaoShu013', groupIndex: 0 },
    { group: 'MD_HongLvDeng_015', red: 'MD_HongLvDeng_Hong015', yellow: 'MD_HongLvDeng_Huang015', green: 'MD_HongLvDeng_Lv015', countdown: 'MiaoShu015', groupIndex: 0 },

    // 第二组（7个红绿灯）
    { group: 'MD_HongLvDeng_001', red: 'MD_HongLvDeng_Hong001', yellow: 'MD_HongLvDeng_Huang001', green: 'MD_HongLvDeng_Lv001', countdown: 'MiaoShu001', groupIndex: 1 },
    { group: 'MD_HongLvDeng_002', red: 'MD_HongLvDeng_Hong002', yellow: 'MD_HongLvDeng_Huang002', green: 'MD_HongLvDeng_Lv002', countdown: 'MiaoShu002', groupIndex: 1 },
    { group: 'MD_HongLvDeng_003', red: 'MD_HongLvDeng_Hong003', yellow: 'MD_HongLvDeng_Huang003', green: 'MD_HongLvDeng_Lv003', countdown: 'MiaoShu003', groupIndex: 1 },
    { group: 'MD_HongLvDeng_005', red: 'MD_HongLvDeng_Hong005', yellow: 'MD_HongLvDeng_Huang005', green: 'MD_HongLvDeng_Lv005', countdown: 'MiaoShu005', groupIndex: 1 },
    { group: 'MD_HongLvDeng_012', red: 'MD_HongLvDeng_Hong012', yellow: 'MD_HongLvDeng_Huang012', green: 'MD_HongLvDeng_Lv012', countdown: 'MiaoShu012', groupIndex: 1 },
    { group: 'MD_HongLvDeng_009', red: 'MD_HongLvDeng_Hong009', yellow: 'MD_HongLvDeng_Huang009', green: 'MD_HongLvDeng_Lv009', countdown: 'MiaoShu009', groupIndex: 1 },
    { group: 'MD_HongLvDeng_014', red: 'MD_HongLvDeng_Hong014', yellow: 'MD_HongLvDeng_Huang014', green: 'MD_HongLvDeng_Lv014', countdown: 'MiaoShu014', groupIndex: 1 },
];

// 红绿灯对象存储
let trafficLights = [];
let sandboxModel = null;
let initialized = false;

// 倒计时 Canvas 和纹理缓存
const countdownCanvases = new Map();  // 存储每个红绿灯的 Canvas
const countdownTextures = new Map();  // 存储每个红绿灯的 CanvasTexture

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
        logger.info('开始初始化红绿灯管理器（15个红绿灯，第一组8个，第二组7个）');
        
        // 遍历配置，查找所有红绿灯
        TRAFFIC_LIGHT_CONFIG.forEach((config, index) => {
            const trafficLight = extractTrafficLightComponents(config, index);
            if (trafficLight) {
                trafficLights.push(trafficLight);
                
                // 为倒计时对象创建 Canvas 纹理
                if (trafficLight.countdown && trafficLight.countdown.material) {
                    const { texture } = createCountdownCanvas(index);
                    // 使用 emissiveMap 让数字发光
                    trafficLight.countdown.material.emissiveMap = texture;
                    trafficLight.countdown.material.color.setHex(0x464646);
                    trafficLight.countdown.material.emissive.setHex(0xffffff);
                    trafficLight.countdown.material.emissiveIntensity = 1;
                    trafficLight.countdown.material.needsUpdate = true;
                    logger.debug(`红绿灯 ${index} (${config.group}) 倒计时纹理已应用`);
                } else {
                    logger.warn(`红绿灯 ${index} (${config.group}) 没有倒计时对象`);
                }
            } else {
                logger.warn(`红绿灯 ${index} (${config.group}) 提取失败`);
            }
        });

        if (trafficLights.length === 0) {
            logger.error('未找到任何红绿灯');
            return false;
            }

        logger.info(`成功初始化 ${trafficLights.length} 个红绿灯`);
        logger.info(`   第一组: 8个红绿灯 (索引0-7)`);
        logger.info(`   第二组: 7个红绿灯 (索引8-14)`);

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
        greenLight: null,
        countdown: null
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
        } else if (name === config.countdown) {
            components.countdown = child;
            logger.debug(`  找到倒计时: ${name}`);
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

    logger.debug(`成功提取红绿灯 ${index} (${config.group}) 的组件，属于第${config.groupIndex + 1}组`);
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
    
    // 倒计时材质克隆（避免多个红绿灯共享同一材质导致颜色/纹理冲突）
    if (components.countdown && components.countdown.material) {
        components.countdown.material = components.countdown.material.clone();
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

    // 熄灭倒计时（降低发光强度）
    if (light.countdown && light.countdown.material) {
        light.countdown.material.emissiveIntensity = LIGHT_OFF_INTENSITY;
    }
}

/**
 * 设置单个红绿灯的状态
 * @param {number} index - 红绿灯索引 (0-14)
 * @param {number} color - 灯光颜色 (1=红, 2=绿, 3=黄)
 * @param {number} countdown - 倒计时秒数
 */
export function setTrafficLightState(index, color, countdown) {
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

    // 根据颜色点亮对应的灯，并更新倒计时数字
    let countdownColor = '#ffffff';  // 默认白色
    
    switch (color) {
        case TRAFFIC_LIGHT_COLORS.RED:
            if (light.redLight && light.redLight.material) {
                // 亮灯时：底色用中等红色，发光用鲜艳红色，适中强度
                light.redLight.material.color.setHex(0x550000);     // 中等红色底色
                light.redLight.material.emissive.setHex(0xff0000);  // 鲜艳红色发光
                light.redLight.material.emissiveIntensity = LIGHT_ON_INTENSITY;
                light.redLight.material.needsUpdate = true;
            }
            // 倒计时显示红色数字
            if (light.countdown && light.countdown.material) {
                light.countdown.material.emissiveIntensity = COUNTDOWN_ON_INTENSITY;
                light.countdown.material.needsUpdate = true;
            }
            countdownColor = '#ff0000';
            break;

        case TRAFFIC_LIGHT_COLORS.GREEN:
            if (light.greenLight && light.greenLight.material) {
                // 亮灯时：底色用中等绿色，发光用鲜艳绿色，适中强度
                light.greenLight.material.color.setHex(0x005500);   // 中等绿色底色
                light.greenLight.material.emissive.setHex(0x00ff00);  // 鲜艳绿色发光
                light.greenLight.material.emissiveIntensity = LIGHT_ON_INTENSITY;
                light.greenLight.material.needsUpdate = true;
            }
            // 倒计时显示绿色数字
            if (light.countdown && light.countdown.material) {
                light.countdown.material.emissiveIntensity = COUNTDOWN_ON_INTENSITY;
                light.countdown.material.needsUpdate = true;
            }
            countdownColor = '#00ff00';
            break;

        case TRAFFIC_LIGHT_COLORS.YELLOW:
            if (light.yellowLight && light.yellowLight.material) {
                // 亮灯时：底色用中等黄色，发光用鲜艳黄色，适中强度
                light.yellowLight.material.color.setHex(0x555500);   // 中等黄色底色
                light.yellowLight.material.emissive.setHex(0xffff00);  // 鲜艳黄色发光
                light.yellowLight.material.emissiveIntensity = LIGHT_ON_INTENSITY;
                light.yellowLight.material.needsUpdate = true;
            }
            // 倒计时显示黄色数字
            if (light.countdown && light.countdown.material) {
                light.countdown.material.emissiveIntensity = COUNTDOWN_ON_INTENSITY;
                light.countdown.material.needsUpdate = true;
            }
            countdownColor = '#ffff00';
            break;

        default:
            logger.warn(`无效的灯光颜色: ${color}`);
            break;
    }
    
    // 更新倒计时数字
    updateCountdownCanvas(index, countdown, countdownColor);

    logger.debug(`红绿灯 ${index} (${light.config.group}) 设置为: ${getColorName(color)}, 倒计时: ${countdown}秒`);
}

/**
 * 更新红绿灯组状态（协议接口）
 * @param {number} groupIndex - 组索引 (0=协议第一组, 1=协议第二组)
 * @param {number} color - 灯光颜色 (1=红, 2=绿, 3=黄)
 * @param {number} countdown - 倒计时秒数
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

    // 交换一组和二组（修正协议组号与实际组号的对应关系）
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
        setTrafficLightState(light.index, color, countdown);
    });

    logger.info(`协议第${groupIndex + 1}组 (实际第${actualGroupIndex + 1}组) 的 ${targetLights.length} 个红绿灯已更新为: ${getColorName(color)}, 倒计时: ${countdown}秒`);
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
 * 创建倒计时 Canvas 和纹理
 * @param {number} index - 红绿灯索引
 * @returns {Object} { canvas, texture }
 */
function createCountdownCanvas(index) {
    const canvas = document.createElement('canvas');
    canvas.width = COUNTDOWN_CANVAS_SIZE;
    canvas.height = COUNTDOWN_CANVAS_SIZE;
    
    // 初始化 Canvas 内容（绘制初始数字 "0"）
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    ctx.save();
    // 应用变换：水平+垂直翻转
    ctx.translate(centerX, centerY);
    ctx.scale(-1, -1);
    
    ctx.font = COUNTDOWN_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 绘制高对比度数字 "0"
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 20;
    ctx.strokeText('0', 0, 0);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText('0', 0, 0);
    
    // 再次绘制增加亮度
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('0', 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    
    ctx.restore();
    
    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // 缓存
    countdownCanvases.set(index, canvas);
    countdownTextures.set(index, texture);
    
    logger.debug(`为红绿灯 ${index} 创建倒计时 Canvas`);
    
    return { canvas, texture };
}

/**
 * 更新倒计时 Canvas 内容
 * @param {number} index - 红绿灯索引
 * @param {number} countdown - 倒计时秒数
 * @param {string} color - 文字颜色（十六进制字符串，如 '#ff0000'）
 */
function updateCountdownCanvas(index, countdown, color) {
    const canvas = countdownCanvases.get(index);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // 清空画布（黑色背景）
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const text = countdown.toString();
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    ctx.save();
    // 应用变换：水平+垂直翻转
    ctx.translate(centerX, centerY);
    ctx.scale(-1, -1);
    
    ctx.font = COUNTDOWN_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 1. 绘制黑色描边（增加对比度）
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 20;
    ctx.strokeText(text, 0, 0);
    
    // 2. 绘制主体文字
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    
    // 3. 再次绘制一层更亮的文字（增加发光效果）
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    
    ctx.restore();
    
    // 通知纹理更新
    const texture = countdownTextures.get(index);
    if (texture) {
        texture.needsUpdate = true;
    }
}

/**
 * 销毁红绿灯管理器
 */
export function destroyTrafficLightManager() {
    // 清理纹理和 Canvas
    countdownTextures.forEach((texture) => {
        if (texture) {
            texture.dispose();
        }
    });
    countdownTextures.clear();
    countdownCanvases.clear();
    
    trafficLights = [];
    sandboxModel = null;
    initialized = false;
    logger.info('红绿灯管理器已销毁');
}
