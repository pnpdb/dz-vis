#!/usr/bin/env python3
"""
Socket客户端测试程序
模拟小车连接Tauri Socket服务器并发送协议数据
"""

import socket
import struct
import time
import threading
import json
from datetime import datetime

# 协议常量
HEADER = b'\xEF\xEF\xEF\xEF'
FOOTER = b'\xFE\xFE\xFE\xFE'
VERSION = 0x10

# 消息类型
MESSAGE_TYPES = {
    'HEARTBEAT': 0x0001,
    'VEHICLE_STATUS': 0x0002,
    'SENSOR_DATA': 0x0003,
    'GPS_LOCATION': 0x0004,
    'ERROR_REPORT': 0x0006,
    'SYSTEM_INFO': 0x0007,
    'BATTERY_STATUS': 0x0008,
    'SPEED_DATA': 0x0009,
    'TEMPERATURE': 0x000A,
}

def crc16_ibm_sdlc(data):
    """计算CRC16-IBM-SDLC校验码"""
    crc = 0xFFFF
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ 0x8408
            else:
                crc >>= 1
    return crc ^ 0xFFFF

def build_message(message_type, data):
    """构建协议消息"""
    # 时间戳 (毫秒)
    timestamp = int(time.time() * 1000)
    
    # 构建消息体 (除了帧头)
    message_body = bytearray()
    message_body.extend(struct.pack('<B', VERSION))  # 版本 (小端序)
    message_body.extend(struct.pack('<Q', timestamp))  # 时间戳 (小端序)
    message_body.extend(struct.pack('<H', message_type))  # 消息类型 (小端序)
    message_body.extend(struct.pack('<I', len(data)))  # 数据长度 (小端序)
    message_body.extend(data)  # 数据域
    
    # 计算CRC (从版本字节开始)
    crc = crc16_ibm_sdlc(message_body)
    
    # 构建完整数据包
    packet = bytearray()
    packet.extend(HEADER)  # 帧头
    packet.extend(message_body)  # 消息体
    packet.extend(struct.pack('<H', crc))  # CRC (小端序)
    packet.extend(FOOTER)  # 帧尾
    
    return bytes(packet)

def create_vehicle_status_data():
    """创建车辆状态数据"""
    data = bytearray()
    data.extend(struct.pack('<f', 25.5))  # 速度 (km/h)
    data.extend(struct.pack('<B', 85))    # 电池电量 (%)
    data.extend(struct.pack('<B', 1))     # 状态 (1=运行)
    data.extend(struct.pack('<B', 0))     # 保留字段
    data.extend(struct.pack('<B', 0))     # 保留字段
    return bytes(data)

def create_sensor_data():
    """创建传感器数据"""
    data = bytearray()
    data.extend(struct.pack('<f', 23.5))  # 温度 (°C)
    data.extend(struct.pack('<f', 65.2))  # 湿度 (%)
    data.extend(struct.pack('<H', 1013))  # 气压 (hPa)
    data.extend(struct.pack('<H', 245))   # 光照强度
    return bytes(data)

def create_gps_data():
    """创建GPS数据"""
    data = bytearray()
    data.extend(struct.pack('<d', 39.9042))   # 纬度
    data.extend(struct.pack('<d', 116.4074))  # 经度
    data.extend(struct.pack('<f', 50.5))      # 高度 (m)
    data.extend(struct.pack('<f', 15.2))      # 速度 (m/s)
    return bytes(data)

def create_error_report():
    """创建错误报告数据"""
    error_info = {
        "error_code": 1001,
        "error_msg": "传感器连接异常",
        "severity": "warning"
    }
    return json.dumps(error_info, ensure_ascii=False).encode('utf-8')

class TestClient:
    def __init__(self, server_host='127.0.0.1', server_port=8888, car_id="test_car_001"):
        self.server_host = server_host
        self.server_port = server_port
        self.car_id = car_id
        self.socket = None
        self.running = False
        
    def connect(self):
        """连接到服务器"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((self.server_host, self.server_port))
            self.running = True
            print(f"✅ 成功连接到服务器 {self.server_host}:{self.server_port}")
            return True
        except Exception as e:
            print(f"❌ 连接失败: {e}")
            return False
    
    def disconnect(self):
        """断开连接"""
        self.running = False
        if self.socket:
            self.socket.close()
            print("🔌 已断开连接")
    
    def send_message(self, message_type, data):
        """发送消息"""
        if not self.socket:
            print("❌ 未连接到服务器")
            return False
            
        try:
            packet = build_message(message_type, data)
            self.socket.send(packet)
            
            type_name = next((k for k, v in MESSAGE_TYPES.items() if v == message_type), f"0x{message_type:04X}")
            print(f"📤 发送消息: {type_name}, 数据长度: {len(data)} 字节")
            return True
        except Exception as e:
            print(f"❌ 发送消息失败: {e}")
            return False
    
    def start_heartbeat(self, interval=5):
        """启动心跳发送"""
        def heartbeat_loop():
            while self.running:
                if not self.send_message(MESSAGE_TYPES['HEARTBEAT'], b''):
                    break
                time.sleep(interval)
        
        thread = threading.Thread(target=heartbeat_loop, daemon=True)
        thread.start()
        print(f"💓 心跳发送已启动 (间隔: {interval}秒)")
    
    def start_data_simulation(self):
        """启动数据模拟发送"""
        def data_simulation_loop():
            counter = 0
            while self.running:
                time.sleep(2)  # 每2秒发送一次数据
                counter += 1
                
                # 循环发送不同类型的数据
                if counter % 4 == 1:
                    # 发送车辆状态
                    data = create_vehicle_status_data()
                    self.send_message(MESSAGE_TYPES['VEHICLE_STATUS'], data)
                    
                elif counter % 4 == 2:
                    # 发送传感器数据
                    data = create_sensor_data()
                    self.send_message(MESSAGE_TYPES['SENSOR_DATA'], data)
                    
                elif counter % 4 == 3:
                    # 发送GPS数据
                    data = create_gps_data()
                    self.send_message(MESSAGE_TYPES['GPS_LOCATION'], data)
                    
                else:
                    # 偶尔发送错误报告
                    if counter % 20 == 0:
                        data = create_error_report()
                        self.send_message(MESSAGE_TYPES['ERROR_REPORT'], data)
        
        thread = threading.Thread(target=data_simulation_loop, daemon=True)
        thread.start()
        print("🎲 数据模拟发送已启动")
    
    def listen_for_commands(self):
        """监听服务器命令"""
        def listen_loop():
            buffer = bytearray()
            while self.running:
                try:
                    data = self.socket.recv(1024)
                    if not data:
                        print("🔌 服务器断开连接")
                        break
                    
                    buffer.extend(data)
                    print(f"📥 收到服务器数据: {len(data)} 字节")
                    
                    # TODO: 这里可以添加对服务器命令的解析
                    # 目前只是简单打印接收到的数据
                    
                except Exception as e:
                    if self.running:
                        print(f"❌ 接收数据错误: {e}")
                    break
        
        thread = threading.Thread(target=listen_loop, daemon=True)
        thread.start()
        print("👂 开始监听服务器命令")

def main():
    print("🚗 Socket客户端测试程序")
    print("=" * 50)
    
    # 创建测试客户端
    client = TestClient()
    
    # 连接到服务器
    if not client.connect():
        return
    
    try:
        # 启动心跳
        client.start_heartbeat(interval=10)
        
        # 启动数据模拟
        client.start_data_simulation()
        
        # 监听服务器命令
        client.listen_for_commands()
        
        print("\n📋 测试客户端已启动，按 Ctrl+C 停止")
        print("正在发送以下类型的数据:")
        print("- 心跳包 (每10秒)")
        print("- 车辆状态 (每8秒)")
        print("- 传感器数据 (每8秒)")
        print("- GPS位置 (每8秒)")
        print("- 错误报告 (每40秒)")
        
        # 保持程序运行
        while client.running:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n🛑 用户中断，正在退出...")
    finally:
        client.disconnect()

if __name__ == "__main__":
    main()
