#!/usr/bin/env python3
"""
快速测试红绿灯协议
发送几个测试包，验证协议是否正确
"""

import socket
import struct
import time

HEADER = b'\xEF\xEF\xEF\xEF'
FOOTER = b'\xFE\xFE\xFE\xFE'

def build_traffic_light_packet(light1_color, light1_remaining, light2_color, light2_remaining):
    """
    构建红绿灯数据包
    协议格式：4字节
      Byte 0: 组1颜色 (1=红, 2=绿, 3=黄)
      Byte 1: 组1剩余秒数 (0-255)
      Byte 2: 组2颜色 (1=红, 2=绿, 3=黄)
      Byte 3: 组2剩余秒数 (0-255)
    """
    payload = bytearray()
    payload.append(light1_color)
    payload.append(light1_remaining)
    payload.append(light2_color)
    payload.append(light2_remaining)

    timestamp = int(time.time() * 1000)
    message_type = 0x3001

    packet = bytearray()
    packet.extend(HEADER)
    packet.append(0x10)  # 版本
    packet.extend(timestamp.to_bytes(8, 'little'))
    packet.extend(message_type.to_bytes(2, 'little'))
    packet.extend(len(payload).to_bytes(4, 'little'))
    packet.extend(payload)

    # CRC16计算
    crc_data = packet[4:]
    crc = 0xFFFF
    for byte in crc_data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    packet.extend(crc.to_bytes(2, 'little'))
    packet.extend(FOOTER)
    
    return bytes(packet)

def main():
    host = '192.168.1.12'
    port = 8888
    
    print(f"🚦 连接到 {host}:{port}")
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((host, port))
    
    try:
        # 测试1: 1号灯红10秒，2号灯绿10秒
        print("\n📤 测试1: 1号灯=红(10s), 2号灯=绿(10s)")
        packet = build_traffic_light_packet(1, 10, 2, 10)
        s.sendall(packet)
        print(f"   发送成功，数据长度: {len(packet)} 字节")
        time.sleep(2)
        
        # 测试2: 1号灯黄5秒，2号灯黄5秒
        print("\n📤 测试2: 1号灯=黄(5s), 2号灯=黄(5s)")
        packet = build_traffic_light_packet(3, 5, 3, 5)
        s.sendall(packet)
        print(f"   发送成功，数据长度: {len(packet)} 字节")
        time.sleep(2)
        
        # 测试3: 1号灯绿15秒，2号灯红15秒
        print("\n📤 测试3: 1号灯=绿(15s), 2号灯=红(15s)")
        packet = build_traffic_light_packet(2, 15, 1, 15)
        s.sendall(packet)
        print(f"   发送成功，数据长度: {len(packet)} 字节")
        
        print("\n✅ 测试完成！请检查沙盘中的红绿灯是否变化")
        print("   - 1组（6个红绿灯）应该显示绿灯")
        print("   - 2组（2个红绿灯）应该显示红灯")
        
    finally:
        s.close()

if __name__ == '__main__':
    main()

