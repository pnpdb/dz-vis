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
    'HEARTBEAT': 0x0001,        # 心跳包
    'VEHICLE_INFO': 0x0002,     # 车辆信息协议（新协议）
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

def create_vehicle_info_data(vehicle_id=1):
    """
    创建车辆信息协议数据域 (38字节)
    格式：车辆编号(1) + 车速(8) + 位置X(8) + 位置Y(8) + 电量(8) + 导航状态(1) + 相机状态(1) + 雷达状态(1) + 陀螺仪状态(1) + 北斗状态(1)
    """
    import random
    
    data = bytearray()
    
    # 车辆编号 (1字节, UINT8)
    data.extend(struct.pack('<B', vehicle_id))
    
    # 车速 (8字节, DOUBLE) - 范围 0-1 m/s
    speed = random.uniform(0.0, 1.0)
    data.extend(struct.pack('<d', speed))
    
    # 位置X (8字节, DOUBLE)
    position_x = random.uniform(-100.0, 100.0)
    data.extend(struct.pack('<d', position_x))
    
    # 位置Y (8字节, DOUBLE)  
    position_y = random.uniform(-100.0, 100.0)
    data.extend(struct.pack('<d', position_y))
    
    # 电池电量 (8字节, DOUBLE) - 范围 0-100%
    battery = random.uniform(20.0, 100.0)
    data.extend(struct.pack('<d', battery))
    
    # 导航状态 (1字节, UINT8) - 0:未导航, 1:导航中
    nav_status = random.choice([0, 1])
    data.extend(struct.pack('<B', nav_status))
    
    # 相机状态 (1字节, UINT8) - 0:异常, 1:正常
    camera_status = random.choice([0, 1])
    data.extend(struct.pack('<B', camera_status))
    
    # 激光雷达状态 (1字节, UINT8) - 0:异常, 1:正常
    lidar_status = random.choice([0, 1])
    data.extend(struct.pack('<B', lidar_status))
    
    # 陀螺仪状态 (1字节, UINT8) - 0:异常, 1:正常
    gyro_status = random.choice([0, 1])
    data.extend(struct.pack('<B', gyro_status))
    
    # 北斗状态 (1字节, UINT8) - 0:异常, 1:正常
    beidou_status = random.choice([0, 1])
    data.extend(struct.pack('<B', beidou_status))
    
    print(f"🚗 车辆信息 - ID: {vehicle_id}, 速度: {speed:.3f}m/s, 位置: ({position_x:.2f}, {position_y:.2f}), 电量: {battery:.1f}%, 导航: {'导航中' if nav_status else '未导航'}")
    print(f"📊 传感器状态 - 相机: {'正常' if camera_status else '异常'}, 雷达: {'正常' if lidar_status else '异常'}, 陀螺仪: {'正常' if gyro_status else '异常'}, 北斗: {'正常' if beidou_status else '异常'}")
    
    return bytes(data)

class TestClient:
    def __init__(self, server_host='127.0.0.1', server_port=8888, vehicle_id=1):
        self.server_host = server_host
        self.server_port = server_port
        self.vehicle_id = vehicle_id
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
                
                # 发送车辆信息协议
                data = create_vehicle_info_data(self.vehicle_id)
                self.send_message(MESSAGE_TYPES['VEHICLE_INFO'], data)
        
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
    import sys
    
    # 获取命令行参数 - 车辆ID
    vehicle_id = 1
    if len(sys.argv) > 1:
        try:
            vehicle_id = int(sys.argv[1])
        except ValueError:
            print("❌ 车辆ID必须是数字")
            sys.exit(1)
    
    print(f"🚗 Socket客户端测试程序 - 车辆ID: {vehicle_id}")
    print("=" * 50)
    
    # 创建测试客户端
    client = TestClient(vehicle_id=vehicle_id)
    
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
        
        print(f"\n📋 测试客户端已启动 (车辆ID: {vehicle_id})，按 Ctrl+C 停止")
        print("正在发送以下类型的数据:")
        print("- 心跳包 (每10秒)")
        print("- 车辆信息协议 (每2秒)")
        print("\n📊 车辆信息协议数据域 (38字节):")
        print("- 车辆编号(1) + 车速(8) + 位置X(8) + 位置Y(8) + 电量(8)")
        print("- 导航状态(1) + 相机状态(1) + 雷达状态(1) + 陀螺仪状态(1) + 北斗状态(1)")
        
        # 保持程序运行
        while client.running:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n🛑 用户中断，正在退出...")
    finally:
        client.disconnect()

if __name__ == "__main__":
    main()
