/**
 * 常量统一导出入口
 * 提供便捷的导入方式
 */

// 导入各个模块
import { TIMING } from './timing.js';
import { LIMITS } from './limits.js';
import { DEFAULTS } from './defaults.js';
import { UI } from './ui.js';
import { PERFORMANCE } from './performance.js';
import { PROTOCOL } from './protocol.js';
import { VALIDATION_RANGES } from './validation.js';

// ========== 命名导出（推荐使用） ==========
export { TIMING } from './timing.js';
export { LIMITS } from './limits.js';
export { DEFAULTS } from './defaults.js';
export { UI } from './ui.js';
export { PERFORMANCE } from './performance.js';
export { PROTOCOL } from './protocol.js';
export { VALIDATION_RANGES } from './validation.js';

// ========== 默认导出 ==========
export default {
    TIMING,
    LIMITS,
    DEFAULTS,
    UI,
    PERFORMANCE,
    PROTOCOL,
    VALIDATION_RANGES,
};

// ========== 使用示例 ==========
// 方式1（推荐）：按需导入
// import { TIMING, LIMITS } from '@/constants';
//
// 方式2：全量导入
// import constants from '@/constants';
// const { TIMING, LIMITS } = constants;

