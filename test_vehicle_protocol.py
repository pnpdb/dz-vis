#!/usr/bin/env python3
"""
快速测试车辆信息协议
"""

import time
import threading
from test_client import TestClient

def test_multiple_vehicles():
    """测试多个车辆同时发送数据"""
    vehicles = []
    
    # 创建3个车辆客户端
    for vehicle_id in [1, 2, 3]:
        client = TestClient(vehicle_id=vehicle_id)
        if client.connect():
            client.running = True
            vehicles.append(client)
            print(f"✅ 车辆{vehicle_id}连接成功")
        else:
            print(f"❌ 车辆{vehicle_id}连接失败")
    
    if not vehicles:
        print("❌ 没有车辆连接成功")
        return
    
    try:
        # 启动所有车辆的数据发送
        for client in vehicles:
            client.start_heartbeat(interval=15)
            client.start_data_simulation()
        
        print(f"\n🚀 {len(vehicles)}个车辆已开始发送数据...")
        print("车辆ID映射: 1=车辆A, 2=车辆B, 3=车辆C")
        print("请在DZ Car Manager界面中查看车辆信息更新")
        print("按 Ctrl+C 停止测试\n")
        
        # 运行30秒
        for i in range(30):
            print(f"⏱️  测试运行中... {i+1}/30秒", end='\r')
            time.sleep(1)
        
        print("\n✅ 测试完成")
        
    except KeyboardInterrupt:
        print("\n🛑 测试被用户中断")
    finally:
        # 断开所有连接
        for client in vehicles:
            client.disconnect()
        print("🔌 所有连接已断开")

if __name__ == "__main__":
    print("🧪 车辆信息协议测试程序")
    print("=" * 50)
    test_multiple_vehicles()
