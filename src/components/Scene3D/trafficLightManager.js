/**
 * 红绿灯管理器
 * 负责控制沙盘中的8个红绿灯，包括灯光切换和倒计时显示
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
 * 倒计时数字：
 * - 使用 CanvasTexture + emissiveMap 实现，渲染效率高
 * - 黑色描边 + 双层绘制 + lighter 混合模式，增强可读性
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

// 倒计时 Canvas 配置
const COUNTDOWN_CANVAS_SIZE = 512;  // Canvas 尺寸（正方形）
const COUNTDOWN_FONT_SIZE = 320;    // 字体大小
const COUNTDOWN_FONT = `bold ${COUNTDOWN_FONT_SIZE}px Arial, sans-serif`;  // 字体样式

// 灯光强度配置
const LIGHT_ON_INTENSITY = 3;      // 亮灯时的发光强度（适中强度，避免过曝）
const LIGHT_OFF_INTENSITY = 0;     // 熄灯时的发光强度
const COUNTDOWN_ON_INTENSITY = 5;  // 倒计时数字亮起时的发光强度

// 红绿灯分组配置
// 根据用户提供的信息：2组有2个红绿灯，1组有6个红绿灯
const TRAFFIC_LIGHT_GROUPS = {
    // 2组（索引0和2）- Zu1 和 Zu3
    GROUP_2: [0, 2],  // Zu1(无后缀) 和 Zu3(_(2)后缀)
    // 1组（索引1,3,4,5,6,7）- Zu2, Zu4-Zu8
    GROUP_1: [1, 3, 4, 5, 6, 7]  // Zu2(_(1)) 到 Zu8(_(7))
};

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
        // 查找所有8个红绿灯组 (Zu1-Zu8)
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
                logger.debug(`找到红绿灯组 ${i-1}: ${groupName}`);
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
                
                // 为倒计时对象创建 Canvas 纹理
                if (trafficLight.countdown) {
                    const { texture } = createCountdownCanvas(index);
                    
                    // 将纹理应用到倒计时对象的材质
                    if (trafficLight.countdown.material) {
                        logger.info(`🔢 红绿灯 ${index} 倒计时对象:`);
                        logger.info(`   材质类型: ${trafficLight.countdown.material.type}`);
                        logger.info(`   原始 emissiveMap: ${trafficLight.countdown.material.emissiveMap ? '存在' : '不存在'}`);
                        
                        // 使用 emissiveMap 而不是 map，这样数字会发光
                        trafficLight.countdown.material.emissiveMap = texture;
                        // 设置基础颜色为深灰色（暗色系背景）
                        trafficLight.countdown.material.color.setHex(0x464646);
                        // 设置自发光颜色为白色（让纹理上的彩色数字能正确发光显示）
                        trafficLight.countdown.material.emissive.setHex(0xffffff);
                        trafficLight.countdown.material.emissiveIntensity = 1;
                        trafficLight.countdown.material.needsUpdate = true;
                        
                        logger.info(`   ✅ 红绿灯 ${index} 倒计时纹理已应用`);
                        
                        // 记录保存的原始颜色（用于调试）
                        if (trafficLight.redLight?.originalColor) {
                            logger.debug(`   红灯原始底色: rgb(${Math.round(trafficLight.redLight.originalColor.r * 255)}, ${Math.round(trafficLight.redLight.originalColor.g * 255)}, ${Math.round(trafficLight.redLight.originalColor.b * 255)})`);
                        }
                        if (trafficLight.yellowLight?.originalColor) {
                            logger.debug(`   黄灯原始底色: rgb(${Math.round(trafficLight.yellowLight.originalColor.r * 255)}, ${Math.round(trafficLight.yellowLight.originalColor.g * 255)}, ${Math.round(trafficLight.yellowLight.originalColor.b * 255)})`);
                        }
                        if (trafficLight.greenLight?.originalColor) {
                            logger.debug(`   绿灯原始底色: rgb(${Math.round(trafficLight.greenLight.originalColor.r * 255)}, ${Math.round(trafficLight.greenLight.originalColor.g * 255)}, ${Math.round(trafficLight.greenLight.originalColor.b * 255)})`);
                        }
                    } else {
                        logger.warn(`   ❌ 红绿灯 ${index} 倒计时对象没有材质`);
                    }
                } else {
                    logger.warn(`   ❌ 红绿灯 ${index} 没有倒计时对象`);
                }
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
 * @param {number} index - 红绿灯索引 (Zu1=0, Zu2=1, ..., Zu8=7)
 * @returns {Object|null} 红绿灯组件对象
 */
function extractTrafficLightComponents(group, index) {
    // 新模型使用下划线+括号格式：_(1), _(2), ..., _(7)
    // Zu1 (索引0) 无后缀，Zu2-Zu8 (索引1-7) 使用 _(N) 后缀
    const suffix = index === 0 ? '' : `_(${index})`;
    
    const components = {
        index,
        group,
        redLight: null,
        yellowLight: null,
        greenLight: null,
        countdown: null
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
        } else if (name === `MD_HongLvDeng_Hui${suffix}`) {
            components.countdown = child;
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
    
    // 倒计时材质克隆
    if (components.countdown && components.countdown.material) {
        components.countdown.material = components.countdown.material.clone();
    }
    
    // 灰色背景材质克隆
    if (components.grayBackground && components.grayBackground.material) {
        components.grayBackground.material = components.grayBackground.material.clone();
    }
}

/**
 * 创建倒计时 Canvas 和纹理
 * @param {number} index - 红绿灯索引
 * @returns {Object} { canvas, texture }
 */
function createCountdownCanvas(index) {
    // 创建 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = COUNTDOWN_CANVAS_SIZE;
    canvas.height = COUNTDOWN_CANVAS_SIZE;
    
    // 初始化 Canvas 内容（绘制初始数字 "0"）
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';  // 黑色背景
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // 保存原始状态
    ctx.save();
    
    // 应用变换：只做垂直翻转（上下翻转）
    ctx.translate(centerX, centerY);
    ctx.scale(1, -1);  // 只垂直翻转，不水平翻转
    
    ctx.font = COUNTDOWN_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 绘制高对比度数字 "0"（坐标现在相对于变换后的原点）
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
    
    // 恢复状态
    ctx.restore();
    
    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // 缓存
    countdownCanvases.set(index, canvas);
    countdownTextures.set(index, texture);
    
    logger.debug(`为红绿灯 ${index} 创建倒计时 Canvas，初始内容: "0"`);
    
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
    if (!canvas) {
        logger.warn(`红绿灯 ${index} 的 Canvas 不存在`);
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // 清空画布（黑色背景）
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const text = countdown.toString();
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // 保存原始状态
    ctx.save();
    
    // 应用变换：只做垂直翻转（上下翻转）
    ctx.translate(centerX, centerY);
    ctx.scale(1, -1);  // 只垂直翻转，不水平翻转
    
    // 设置字体
    ctx.font = COUNTDOWN_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 1. 绘制黑色描边（增加对比度）
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 20;
    ctx.strokeText(text, 0, 0);
    
    // 2. 绘制主体文字（更亮的颜色）
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    
    // 3. 再次绘制一层更亮的文字（增加发光效果）
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    
    // 恢复默认混合模式
    ctx.globalCompositeOperation = 'source-over';
    
    // 恢复状态
    ctx.restore();
    
    // 通知纹理更新
    const texture = countdownTextures.get(index);
    if (texture) {
        texture.needsUpdate = true;
    }
    
    logger.debug(`🔢 更新红绿灯 ${index} 倒计时: ${text}, 颜色: ${color}`);
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
        // 恢复原始底色
        // if (light.redLight.originalColor) {
        //     light.redLight.material.color.copy(light.redLight.originalColor);
        // }
        light.redLight.material.color.setHex(0x770000);  // 很暗的红色
        // 关闭发光
        light.redLight.material.emissive.setHex(0x000000);
        light.redLight.material.emissiveIntensity = LIGHT_OFF_INTENSITY;
        light.redLight.material.needsUpdate = true;
    }
    
    // 熄灭黄灯
    if (light.yellowLight && light.yellowLight.material) {
        // // 恢复原始底色
        // if (light.yellowLight.originalColor) {
        //     light.yellowLight.material.color.copy(light.yellowLight.originalColor);
        // }
        light.yellowLight.material.color.setHex(0x007700);  // 很暗的黄色
        // 关闭发光
        light.yellowLight.material.emissive.setHex(0x000000);
        light.yellowLight.material.emissiveIntensity = LIGHT_OFF_INTENSITY;
        light.yellowLight.material.needsUpdate = true;
    }
    
    // 熄灭绿灯
    if (light.greenLight && light.greenLight.material) {
        // // 恢复原始底色
        // if (light.greenLight.originalColor) {
        //     light.greenLight.material.color.copy(light.greenLight.originalColor);
        // }
        light.greenLight.material.color.setHex(0x777700);  // 很暗的绿色
        // 关闭发光
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
 * @param {number} index - 红绿灯索引 (0-7)
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
                light.greenLight.material.color.setHex(0x550000);   // 中等绿色底色
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
                light.yellowLight.material.color.setHex(0x550000);   // 中等黄色底色
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

    logger.debug(`红绿灯 ${index} 设置为: ${getColorName(color)}, 倒计时: ${countdown}秒`);
}

/**
 * 更新红绿灯组状态
 * @param {number} groupIndex - 组索引 (0=2组, 1=1组)
 * @param {number} color - 灯光颜色
 * @param {number} countdown - 倒计时秒数
 */
export function updateTrafficLightGroup(groupIndex, color, countdown) {
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

    // 更新该组的所有红绿灯
    targetIndices.forEach(index => {
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

