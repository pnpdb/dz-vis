#!/usr/bin/env python3
"""
沙盘客户端测试程序
连接到界面端(Tauri Socket服务器)，发送红绿灯状态并接收沙盘相关协议。

发送协议:
- 0x3001: 红绿灯状态（2个灯，每秒发送一次）
  - 1号灯：红10秒 -> 黄10秒 -> 绿5秒（循环）
  - 2号灯：绿10秒 -> 黄5秒 -> 红10秒（循环）

接收协议:
- 0x2001: 自动/平行驾驶模式
- 0x2002: 红绿灯时长设置
- 0x2003: 沙盘灯光控制

使用方式:
  python3 sandbox_client.py [host] [port]
默认 host=192.168.1.12, port=8888
"""

import socket
import struct
import sys
import time
import random
import threading
from datetime import datetime

HEADER = b'\xEF\xEF\xEF\xEF'
FOOTER = b'\xFE\xFE\xFE\xFE'

LIGHT_COLORS = [1, 2, 3]  # 1:红, 2:绿, 3:黄

def build_traffic_light_packet(lights: list) -> bytes:
    """
    构建红绿灯数据包
    :param lights: [(color, remaining), ...] 灯的状态列表
    协议格式：每组2字节 (1字节颜色 + 1字节倒计时)，2组共4字节
    """
    payload = bytearray()
    for color, remaining in lights:
        payload.append(color)      # 1字节：颜色 (1=红, 2=绿, 3=黄)
        payload.append(remaining)  # 1字节：剩余秒数 (0-255)

    timestamp = int(time.time() * 1000)
    message_type = 0x3001

    packet = bytearray()
    packet.extend(HEADER)
    packet.append(0x10)
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

def parse_packet(packet: bytes):
    if len(packet) < 25:
        return None
    if packet[:4] != HEADER or packet[-4:] != FOOTER:
        return None
    offset = 4
    version = packet[offset]
    offset += 1
    timestamp = struct.unpack_from('<Q', packet, offset)[0]
    offset += 8
    message_type = struct.unpack_from('<H', packet, offset)[0]
    offset += 2
    data_len = struct.unpack_from('<I', packet, offset)[0]
    offset += 4
    data = packet[offset:offset+data_len]
    # skip crc
    return {
        'version': version,
        'timestamp': timestamp,
        'message_type': message_type,
        'data': data,
    }

def send_traffic_light_loop(sock, _unused=None):
    """
    发送红绿灯状态，每秒一次
    1号灯：红10秒 -> 黄10秒 -> 绿5秒
    2号灯：绿10秒 -> 黄5秒 -> 红10秒
    """
    # 1号灯状态机：[(颜色, 持续时间)]
    light1_cycle = [
        (1, 10),  # 红10秒
        (3, 10),  # 黄10秒
        (2, 5),   # 绿5秒
    ]
    
    # 2号灯状态机：[(颜色, 持续时间)]
    light2_cycle = [
        (2, 10),  # 绿10秒
        (3, 5),   # 黄5秒
        (1, 10),  # 红10秒
    ]
    
    # 初始化状态
    light1_state_idx = 0  # 当前处于哪个状态
    light1_remaining = light1_cycle[0][1]  # 当前状态剩余秒数
    
    light2_state_idx = 0
    light2_remaining = light2_cycle[0][1]
    
    print(f"🚦 开始发送红绿灯状态（每秒一次）")
    print(f"   1号灯：红10秒 -> 黄10秒 -> 绿5秒")
    print(f"   2号灯：绿10秒 -> 黄5秒 -> 红10秒")
    
    while True:
        # 获取当前状态
        light1_color = light1_cycle[light1_state_idx][0]
        light2_color = light2_cycle[light2_state_idx][0]
        
        # 构建灯状态列表
        lights = [
            (light1_color, light1_remaining),
            (light2_color, light2_remaining),
        ]
        
        # 发送数据包
        packet = build_traffic_light_packet(lights)
        try:
            sock.sendall(packet)
            color_names = {1: '红', 2: '绿', 3: '黄'}
            print(f"📤 1号灯:{color_names[light1_color]}({light1_remaining}s), 2号灯:{color_names[light2_color]}({light2_remaining}s)")
        except Exception as e:
            print(f"❌ 发送 0x3001 失败: {e}")
            break
        
        # 等待1秒
        time.sleep(1)
        
        # 更新剩余时间
        light1_remaining -= 1
        light2_remaining -= 1
        
        # 1号灯状态切换
        if light1_remaining <= 0:
            light1_state_idx = (light1_state_idx + 1) % len(light1_cycle)
            light1_remaining = light1_cycle[light1_state_idx][1]
        
        # 2号灯状态切换
        if light2_remaining <= 0:
            light2_state_idx = (light2_state_idx + 1) % len(light2_cycle)
            light2_remaining = light2_cycle[light2_state_idx][1]


def main():
    host = sys.argv[1] if len(sys.argv) > 1 else '192.168.1.69'
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8888

    print(f"🧪 沙盘客户端连接 {host}:{port}")
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((host, port))

    sender_thread = threading.Thread(target=send_traffic_light_loop, args=(s, None), daemon=True)
    sender_thread.start()

    try:
        buf = bytearray()
        while True:
            chunk = s.recv(4096)
            if not chunk:
                print('🔌 服务器断开连接')
                break
            buf.extend(chunk)

            # 尝试从缓冲中解析完整报文
            while True:
                head = buf.find(HEADER)
                if head < 0:
                    buf.clear()
                    break
                if head > 0:
                    del buf[:head]
                if len(buf) < 19:
                    break
                data_len = struct.unpack_from('<I', buf, 15)[0]
                total_len = 25 + data_len
                if len(buf) < total_len:
                    break
                packet = bytes(buf[:total_len])
                del buf[:total_len]

                msg = parse_packet(packet)
                if not msg:
                    continue
                ts = datetime.fromtimestamp(msg['timestamp']/1000)
                mt = msg['message_type']
                data = msg['data']
                if mt == 0x2001 and len(data) >= 2:
                    vehicle_id = data[0]
                    action = data[1]
                    action_text = "进入平行驾驶" if action == 1 else "退出平行驾驶"
                    print(f"📨 {ts} 收到 0x2001 指令: 车辆{vehicle_id}, 动作: {action_text} ({action})")
                elif mt == 0x2002 and len(data) >= 5:
                    light_id = data[0]
                    red_seconds = struct.unpack_from('<H', data, 1)[0]
                    green_seconds = struct.unpack_from('<H', data, 3)[0]
                    print(f"🚦 {ts} 收到 0x2002 指令: 红绿灯#{light_id}, 红灯{red_seconds}s, 绿灯{green_seconds}s")
                elif mt == 0x3001:
                    count = len(data) // 2
                    print(f"🚥 {ts} 收到 0x3001 指令: 共 {count} 个红绿灯")
                    for i in range(count):
                        color = data[i * 2]
                        remaining = data[i * 2 + 1]
                        color_text = {1: '红', 2: '绿', 3: '黄'}.get(color, f'未知({color})')
                        print(f"   - 灯{i+1}: {color_text}, 剩余 {remaining} 秒")
                elif mt == 0x2003 and len(data) >= 3:
                    ambient, building, street = data[:3]
                    def mk_text(flag, name):
                        status = "开启" if flag else "关闭"
                        return f"{name}:{status}"
                    print(f"💡 {ts} 收到 0x2003 指令: {mk_text(ambient, '环境灯')}, {mk_text(building, '建筑灯')}, {mk_text(street, '路灯')}")
                else:
                    print(f"ℹ️ {ts} 收到消息: 0x{mt:04X}, 数据长度: {len(data)}")
    finally:
        s.close()

if __name__ == '__main__':
    main()


