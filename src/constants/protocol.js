/**
 * 协议相关常量
 * 包含通信协议的帧标识、大小限制等
 */

export const PROTOCOL = {
    // ========== 帧标识 ==========
    HEADER: [0xEF, 0xEF, 0xEF, 0xEF],
    FOOTER: [0xFE, 0xFE, 0xFE, 0xFE],
    VERSION: 0x10,
    
    // ========== 大小限制 ==========
    MIN_PACKET_SIZE: 25,               // 最小数据包大小（字节）
    MAX_PACKET_SIZE: 65535,            // 最大数据包大小（字节）
};

export default PROTOCOL;

