#!/usr/bin/env python3
"""
测试Socket服务器与数据库集成
验证客户端连接时根据IP地址查询车辆ID的功能
"""

import socket
import struct
import time
import threading
import json

def calculate_crc16(data):
    """计算CRC16校验和"""
    crc = 0xFFFF
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ 0xA001
            else:
                crc >>= 1
    return crc

def create_test_message(message_type, data):
    """创建测试消息"""
    header = 0xAA55
    version = 0x01
    timestamp = int(time.time())
    data_length = len(data)
    
    # 构建消息头（不包含CRC和尾部）
    message_without_crc = struct.pack(
        '<HHIQ',  # 小端格式：header(2), version(2), timestamp(8), message_type(2), data_length(4)
        header, version, timestamp, message_type
    ) + struct.pack('<I', data_length) + data
    
    # 计算CRC
    crc = calculate_crc16(message_without_crc)
    
    # 添加CRC和尾部
    footer = 0x55AA
    full_message = message_without_crc + struct.pack('<HH', crc, footer)
    
    return full_message

def test_vehicle_connection(vehicle_ip, vehicle_name, test_duration=10):
    """测试指定IP的车辆连接"""
    print(f"\n🚗 测试车辆连接: {vehicle_name} ({vehicle_ip})")
    
    try:
        # 绑定到指定IP
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind((vehicle_ip, 0))  # 使用指定IP，端口自动分配
        
        # 连接到Socket服务器
        server_address = ('127.0.0.1', 8080)
        sock.connect(server_address)
        print(f"✅ {vehicle_name} 连接成功，本地地址: {sock.getsockname()}")
        
        # 发送测试消息
        for i in range(3):
            test_data = json.dumps({
                "vehicle_name": vehicle_name,
                "speed": 30 + i * 5,
                "position": {"x": 100 + i, "y": 200 + i},
                "battery": 85 - i * 2,
                "timestamp": time.time()
            }).encode('utf-8')
            
            message = create_test_message(0x1001, test_data)  # 车辆状态消息
            sock.send(message)
            print(f"📤 {vehicle_name} 发送消息 #{i+1}")
            time.sleep(2)
        
        # 保持连接一段时间
        time.sleep(test_duration - 6)  # 减去发送消息的时间
        
    except Exception as e:
        print(f"❌ {vehicle_name} 连接失败: {e}")
    finally:
        try:
            sock.close()
            print(f"🔌 {vehicle_name} 连接已关闭")
        except:
            pass

def main():
    """主测试函数"""
    print("🧪 Socket服务器与数据库集成测试")
    print("=" * 50)
    
    # 模拟不同车辆的IP地址
    test_vehicles = [
        ("192.168.1.100", "1号车"),
        ("192.168.1.101", "2号车"),
        ("192.168.1.102", "3号车"),
        ("192.168.1.200", "未配置车辆"),  # 数据库中不存在的IP
    ]
    
    print("📋 测试车辆列表:")
    for ip, name in test_vehicles:
        print(f"  - {name}: {ip}")
    
    print(f"\n⏰ 开始测试，每个车辆连接10秒...")
    print("💡 请确保Tauri应用已启动并且Socket服务器正在运行")
    print("💡 请在连接设置中添加对应的车辆IP配置")
    
    # 创建线程同时测试多个车辆连接
    threads = []
    for vehicle_ip, vehicle_name in test_vehicles:
        thread = threading.Thread(
            target=test_vehicle_connection,
            args=(vehicle_ip, vehicle_name, 10)
        )
        threads.append(thread)
    
    # 启动所有测试线程
    for thread in threads:
        thread.start()
        time.sleep(1)  # 错开启动时间
    
    # 等待所有测试完成
    for thread in threads:
        thread.join()
    
    print("\n✅ 所有测试完成")
    print("\n📊 预期结果:")
    print("  - 服务器日志应显示根据IP地址查询到的车辆ID")
    print("  - 已配置的车辆应显示正确的ID和名称")
    print("  - 未配置的车辆应使用默认ID（IP最后一段）")
    print("  - 前端应收到包含vehicle_id和vehicle_name的消息")

if __name__ == "__main__":
    main()
