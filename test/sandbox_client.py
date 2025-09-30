#!/usr/bin/env python3
"""
沙盘客户端测试程序
连接到界面端(Tauri Socket服务器)，接收沙盘相关协议并打印信息。

支持:
- 0x2001: 自动/平行驾驶模式
- 0x2002: 红绿灯时长设置

使用方式:
  python3 sandbox_client.py [host] [port]
默认 host=192.168.1.12, port=8888
"""

import socket
import struct
import sys
import time
from datetime import datetime

HEADER = b'\xEF\xEF\xEF\xEF'
FOOTER = b'\xFE\xFE\xFE\xFE'

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

def main():
    host = sys.argv[1] if len(sys.argv) > 1 else '192.168.1.12'
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8888

    print(f"🧪 沙盘客户端连接 {host}:{port}")
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((host, port))

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
                else:
                    print(f"ℹ️ {ts} 收到消息: 0x{mt:04X}, 数据长度: {len(data)}")
    finally:
        s.close()

if __name__ == '__main__':
    main()


