/**
 * 字节数组处理工具
 * 与Rust端保持一致的命名和功能
 */

/**
 * 将字节数组转换为十六进制字符串
 * @param {Uint8Array|Array} bytes - 字节数组
 * @param {boolean} compact - 是否紧凑格式（无空格）
 * @returns {string} 十六进制字符串
 */
export function bytesToHex(bytes, compact = false) {
    if (!bytes || bytes.length === 0) return '';
    
    const hexArray = Array.from(bytes, (b) => 
        b.toString(16).padStart(2, '0').toUpperCase()
    );
    
    return compact ? hexArray.join('') : hexArray.join(' ');
}

/**
 * 将十六进制字符串转换为字节数组
 * @param {string} hex - 十六进制字符串（支持 "01 23 45" 或 "012345"）
 * @returns {Uint8Array} 字节数组
 */
export function hexToBytes(hex) {
    const hexClean = hex.replace(/\s/g, '');
    
    if (hexClean.length % 2 !== 0) {
        throw new Error('十六进制字符串长度必须是偶数');
    }
    
    const bytes = new Uint8Array(hexClean.length / 2);
    for (let i = 0; i < hexClean.length; i += 2) {
        bytes[i / 2] = parseInt(hexClean.substr(i, 2), 16);
    }
    
    return bytes;
}

/**
 * 安全的字节数组切片
 * @param {Uint8Array|Array} data - 源数据
 * @param {number} offset - 起始偏移
 * @param {number} length - 长度
 * @returns {Uint8Array} 切片结果
 */
export function safeSlice(data, offset, length) {
    if (offset + length > data.length) {
        throw new Error(
            `切片越界: offset=${offset}, length=${length}, data.length=${data.length}`
        );
    }
    return data.slice(offset, offset + length);
}

/**
 * 从字节数组读取u8
 * @param {Uint8Array|Array} data - 源数据
 * @param {number} offset - 偏移量
 * @returns {number} u8值
 */
export function readU8(data, offset) {
    if (offset >= data.length) {
        throw new Error(`读取u8失败: offset=${offset} 超出范围`);
    }
    return data[offset];
}

/**
 * 从字节数组读取u16（小端序）
 * @param {Uint8Array|Array} data - 源数据
 * @param {number} offset - 偏移量
 * @returns {number} u16值
 */
export function readU16LE(data, offset) {
    const bytes = safeSlice(data, offset, 2);
    return bytes[0] | (bytes[1] << 8);
}

/**
 * 从字节数组读取u32（小端序）
 * @param {Uint8Array|Array} data - 源数据
 * @param {number} offset - 偏移量
 * @returns {number} u32值
 */
export function readU32LE(data, offset) {
    const bytes = safeSlice(data, offset, 4);
    return (
        bytes[0] |
        (bytes[1] << 8) |
        (bytes[2] << 16) |
        (bytes[3] << 24)
    ) >>> 0; // 无符号右移
}

/**
 * 从字节数组读取f64（小端序）
 * @param {Uint8Array|Array} data - 源数据
 * @param {number} offset - 偏移量
 * @returns {number} f64值
 */
export function readF64LE(data, offset) {
    const bytes = safeSlice(data, offset, 8);
    const buffer = new ArrayBuffer(8);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < 8; i++) {
        view[i] = bytes[i];
    }
    return new DataView(buffer).getFloat64(0, true); // true表示小端序
}

export default {
    bytesToHex,
    hexToBytes,
    safeSlice,
    readU8,
    readU16LE,
    readU32LE,
    readF64LE,
};

