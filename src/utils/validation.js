/**
 * 数据验证工具
 * 与Rust端保持一致的命名和功能
 */

/**
 * 验证IP地址格式
 * @param {string} ip - IP地址字符串
 * @returns {boolean} 是否有效
 */
export function isValidIp(ip) {
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipPattern);
    
    if (!match) return false;
    
    return match.slice(1).every(num => {
        const n = parseInt(num, 10);
        return n >= 0 && n <= 255;
    });
}

/**
 * 验证是否为私有IP地址
 * @param {string} ip - IP地址字符串
 * @returns {boolean} 是否为私有IP
 */
export function isPrivateIp(ip) {
    if (!isValidIp(ip)) return false;
    
    const parts = ip.split('.').map(p => parseInt(p, 10));
    const [a, b] = parts;
    
    // 10.0.0.0/8
    if (a === 10) return true;
    
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    
    // 169.254.0.0/16 (APIPA)
    if (a === 169 && b === 254) return true;
    
    return false;
}

/**
 * 验证端口号范围
 * @param {number} port - 端口号
 * @returns {boolean} 是否有效
 */
export function isValidPort(port) {
    return Number.isInteger(port) && port > 0 && port <= 65535;
}

/**
 * 验证数字是否在范围内
 * @param {number} value - 值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {boolean} 是否在范围内
 */
export function isInRange(value, min, max) {
    return value >= min && value <= max;
}

/**
 * 验证车辆ID范围
 * @param {number} id - 车辆ID
 * @returns {boolean} 是否有效
 */
export function isValidVehicleId(id) {
    return Number.isInteger(id) && isInRange(id, 1, 255);
}

/**
 * 验证速度范围（m/s）
 * @param {number} speed - 速度
 * @returns {boolean} 是否有效
 */
export function isValidSpeed(speed) {
    return typeof speed === 'number' && isInRange(speed, 0, 10);
}

/**
 * 验证电池电量范围
 * @param {number} battery - 电池电量（百分比）
 * @returns {boolean} 是否有效
 */
export function isValidBattery(battery) {
    return typeof battery === 'number' && isInRange(battery, 0, 100);
}

/**
 * 验证方向盘角度范围（度）
 * @param {number} angle - 方向盘角度
 * @returns {boolean} 是否有效
 */
export function isValidSteeringAngle(angle) {
    return typeof angle === 'number' && isInRange(angle, -180, 180);
}

/**
 * 验证字符串是否为空或仅包含空白字符
 * @param {string} s - 字符串
 * @returns {boolean} 是否为空白
 */
export function isBlank(s) {
    return !s || s.trim().length === 0;
}

/**
 * 验证字符串长度范围
 * @param {string} s - 字符串
 * @param {number} min - 最小长度
 * @param {number} max - 最大长度
 * @returns {boolean} 是否在范围内
 */
export function isValidLength(s, min, max) {
    const len = s ? s.length : 0;
    return len >= min && len <= max;
}

export default {
    isValidIp,
    isPrivateIp,
    isValidPort,
    isInRange,
    isValidVehicleId,
    isValidSpeed,
    isValidBattery,
    isValidSteeringAngle,
    isBlank,
    isValidLength,
};

