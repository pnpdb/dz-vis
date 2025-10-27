#!/usr/bin/env python3
"""
Socket客户端测试程序 - 2号车
模拟2号小车连接Tauri Socket服务器并发送协议数据
"""

import socket
import struct
import time
import threading
import json
import math
from datetime import datetime

# 协议常量
HEADER = b'\xEF\xEF\xEF\xEF'
FOOTER = b'\xFE\xFE\xFE\xFE'
VERSION = 0x10

# 接收消息类型 (从客户端接收)
RECEIVE_MESSAGE_TYPES = {
    'HEARTBEAT': 0x0001,        # 心跳包
    'VEHICLE_INFO': 0x0002,     # 车辆信息协议（新协议）
    'PATH_FILE_SELECTION': 0x0003,  # 路径文件选择
}

# 发送消息类型 (发送给客户端)
SEND_MESSAGE_TYPES = {
    'VEHICLE_CONTROL': 0x1001,           # 车辆控制指令
    'DATA_RECORDING': 0x1002,            # 数据记录控制
    'TAXI_ORDER': 0x1003,                # 出租车订单
    'AVP_PARKING': 0x1004,               # AVP自主代客泊车
    'AVP_PICKUP': 0x1005,                # AVP取车
    'VEHICLE_FUNCTION_SETTING': 0x1006,  # 车辆功能设置
    'VEHICLE_PATH_DISPLAY': 0x1007,      # 车辆路径显示控制
    'CONSTRUCTION_MARKER': 0x1008,       # 施工标记
}

# 车辆控制指令类型
CONTROL_COMMANDS = {
    1: '启动',
    2: '停止',
    3: '紧急制动',
    4: '初始化位姿'
}

def crc16_ccitt_false(data: bytes) -> int:
    """计算 CRC16-CCITT-FALSE 校验码"""
    crc = 0xFFFF
    for byte in data:
        crc ^= (byte << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc <<= 1
            crc &= 0xFFFF
    return crc & 0xFFFF

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
    crc = crc16_ccitt_false(message_body)
    
    # 构建完整数据包
    packet = bytearray()
    packet.extend(HEADER)  # 帧头
    packet.extend(message_body)  # 消息体
    packet.extend(struct.pack('<H', crc))  # CRC (小端序)
    packet.extend(FOOTER)  # 帧尾
    
    return bytes(packet)

def parse_vehicle_control_message(data):
    """解析车辆控制指令"""
    if len(data) < 2:
        print(" 车辆控制数据长度不足")
        return None
    
    try:
        # 解析车辆编号 (1字节)
        vehicle_id = struct.unpack('<B', data[0:1])[0]
        
        # 解析控制指令 (1字节)
        control_command = struct.unpack('<B', data[1:2])[0]
        
        result = {
            'vehicle_id': vehicle_id,
            'control_command': control_command,
            'command_name': CONTROL_COMMANDS.get(control_command, f'未知指令({control_command})')
        }
        
        # 如果是初始化位姿指令(4)，解析位置数据
        if control_command == 4:
            if len(data) < 26:  # 2 + 8 + 8 + 8 = 26字节
                print(" 初始化位姿指令数据长度不足")
                return None
                
            # 解析位置X (DOUBLE, 小端序)
            position_x = struct.unpack('<d', data[2:10])[0]
            
            # 解析位置Y (DOUBLE, 小端序)
            position_y = struct.unpack('<d', data[10:18])[0]
            
            # 解析朝向 (DOUBLE, 小端序)
            orientation = struct.unpack('<d', data[18:26])[0]
            
            result.update({
                'position_x': position_x,
                'position_y': position_y,
                'orientation': orientation
            })
        
        return result
        
    except Exception as e:
        print(f" 解析车辆控制指令失败: {e}")
        return None


def parse_data_recording_message(data):
    """解析数据记录控制指令"""
    if len(data) < 2:
        print(" 数据记录控制数据长度不足")
        return None
    
    try:
        # 解析车辆编号 (1字节)
        vehicle_id = struct.unpack('<B', data[0:1])[0]
        
        # 解析记录状态 (1字节)
        recording_status = struct.unpack('<B', data[1:2])[0]
        
        status_names = {0: '关闭', 1: '开启'}
        status_name = status_names.get(recording_status, f'未知状态({recording_status})')
        
        return {
            'vehicle_id': vehicle_id,
            'recording_status': recording_status,
            'status_name': status_name
        }
        
    except Exception as e:
        print(f" 解析数据记录指令失败: {e}")
        return None


def parse_taxi_order_message(data):
    """解析出租车订单协议（新格式：去掉订单号）"""
    if len(data) < 33:  # 1 + 8 + 8 + 8 + 8 = 33字节
        print(" 出租车订单数据长度不足")
        return None
    
    try:
        # 解析车辆编号 (1字节, UINT8)
        vehicle_id = struct.unpack('<B', data[0:1])[0]
        
        # 解析起点X (8字节, DOUBLE, 小端序)
        start_x = struct.unpack('<d', data[1:9])[0]
        
        # 解析起点Y (8字节, DOUBLE, 小端序)
        start_y = struct.unpack('<d', data[9:17])[0]
        
        # 解析终点X (8字节, DOUBLE, 小端序)
        end_x = struct.unpack('<d', data[17:25])[0]
        
        # 解析终点Y (8字节, DOUBLE, 小端序)
        end_y = struct.unpack('<d', data[25:33])[0]
        
        return {
            'vehicle_id': vehicle_id,
            'start_x': start_x,
            'start_y': start_y,
            'end_x': end_x,
            'end_y': end_y
        }
        
    except Exception as e:
        print(f" 解析出租车订单失败: {e}")
        return None


def parse_avp_parking_message(data):
    """解析AVP自主代客泊车协议"""
    if len(data) < 2:
        print(" AVP泊车数据长度不足")
        return None
    
    try:
        # 解析车辆编号 (1字节, UINT8)
        vehicle_id = data[0]
        
        # 解析停车位编号 (1字节, UINT8)
        parking_spot = data[1]
        
        return {
            'vehicle_id': vehicle_id,
            'parking_spot': parking_spot
        }
        
    except Exception as e:
        print(f" 解析AVP泊车指令失败: {e}")
        return None


def parse_avp_pickup_message(data):
    """解析AVP取车协议"""
    if len(data) < 1:
        print(" AVP取车数据长度不足")
        return None
    
    try:
        # 解析车辆编号 (1字节, UINT8)
        vehicle_id = data[0]
        
        return {
            'vehicle_id': vehicle_id
        }
        
    except Exception as e:
        print(f" 解析AVP取车指令失败: {e}")
        return None


def parse_vehicle_function_setting_message(data):
    """解析车辆功能设置协议"""
    if len(data) < 3:
        print(" 车辆功能设置数据长度不足")
        return None
    
    try:
        # 解析车辆编号 (1字节, UINT8)
        vehicle_id = data[0]
        
        # 解析功能编号 (1字节, UINT8)
        function_id = data[1]
        
        # 解析启用状态 (1字节, UINT8)
        enable_status = data[2]
        
        # 功能编号映射
        function_names = {
            0: '全部(所有程序)',
            1: '传感器',
            2: '建图', 
            3: '录制',
            4: '定位',
            5: '自主导航',
            6: '图像识别',
            7: '打靶功能'
        }
        
        # 启用状态映射
        status_names = {
            0: '关闭',
            1: '启用'
        }
        
        return {
            'vehicle_id': vehicle_id,
            'function_id': function_id,
            'function_name': function_names.get(function_id, f'未知功能({function_id})'),
            'enable_status': enable_status,
            'status_name': status_names.get(enable_status, f'未知状态({enable_status})')
        }
        
    except Exception as e:
        print(f" 解析车辆功能设置指令失败: {e}")
        return None


def parse_vehicle_path_display_message(data):
    """解析车辆路径显示协议"""
    if len(data) < 2:
        print(" 车辆路径显示数据长度不足")
        return None
    
    try:
        # 解析车辆编号 (1字节, UINT8)
        vehicle_id = data[0]
        
        # 解析显示路径状态 (1字节, UINT8)
        display_path = data[1]
        
        # 显示路径状态映射
        display_names = {
            0: '车端不发送路径数据',
            1: '车端开启发送路径数据'
        }
        
        return {
            'vehicle_id': vehicle_id,
            'display_path': display_path,
            'display_name': display_names.get(display_path, f'未知状态({display_path})')
        }
        
    except Exception as e:
        print(f" 解析车辆路径显示指令失败: {e}")
        return None


def parse_construction_marker_message(data):
    """解析施工标记协议 - 新格式：所有施工点坐标"""
    data_length = len(data)
    
    # 检查数据长度是否为16的倍数（每个施工点16字节：8字节X + 8字节Y）
    if data_length % 16 != 0:
        print(f" 施工标记数据长度错误: {data_length} 字节，应为16的倍数")
        return None
    
    marker_count = data_length // 16
    
    try:
        markers = []
        for i in range(marker_count):
            offset = i * 16
            
            # 解析位置X (8字节, DOUBLE)
            position_x = struct.unpack('<d', data[offset:offset+8])[0]
            
            # 解析位置Y (8字节, DOUBLE)
            position_y = struct.unpack('<d', data[offset+8:offset+16])[0]
            
            markers.append({
                'index': i + 1,  # 从1开始编号
                'position_x': position_x,
                'position_y': position_y
            })
        
        return {
            'marker_count': marker_count,
            'markers': markers
        }
        
    except Exception as e:
        print(f" 解析施工标记指令失败: {e}")
        return None


def parse_received_message(data):
    """解析接收到的完整协议消息"""
    if len(data) < 25:  # 最小协议长度
        print(" 接收数据长度不足")
        return None
    
    try:
        # 检查帧头
        if data[:4] != HEADER:
            print(" 帧头不正确")
            return None
        
        # 检查帧尾
        if data[-4:] != FOOTER:
            print(" 帧尾不正确")
            return None
        
        # 解析协议头
        offset = 4  # 跳过帧头
        
        # 版本 (1字节)
        version = struct.unpack('<B', data[offset:offset+1])[0]
        offset += 1
        
        # 时间戳 (8字节)
        timestamp = struct.unpack('<Q', data[offset:offset+8])[0]
        offset += 8
        
        # 消息类型 (2字节)
        message_type = struct.unpack('<H', data[offset:offset+2])[0]
        offset += 2
        
        # 数据长度 (4字节)
        data_length = struct.unpack('<I', data[offset:offset+4])[0]
        offset += 4
        
        # 提取数据域
        data_domain = data[offset:offset+data_length]
        offset += data_length
        
        # CRC校验 (2字节) - 暂时跳过验证
        crc = struct.unpack('<H', data[offset:offset+2])[0]
        
        return {
            'version': version,
            'timestamp': timestamp,
            'message_type': message_type,
            'data_length': data_length,
            'data_domain': data_domain,
            'crc': crc
        }
        
    except Exception as e:
        print(f" 解析协议消息失败: {e}")
        return None

force_parallel_until = 0

# 车辆路径状态管理（每辆车独立维护）
vehicle_paths = {}

class VehiclePath:
    """车辆路径管理类 - 沿沙盘道路绕圈"""
    def __init__(self, vehicle_id):
        self.vehicle_id = vehicle_id
        
        # 沙盘尺寸（米）
        self.SANDBOX_WIDTH = 4.81
        self.SANDBOX_DEPTH = 2.81
        
        # 道路边距（稍微往里一点，因为道路不在最边缘）
        self.MARGIN_X = 0.23  # X轴边距
        self.MARGIN_Y = 0.23  # Y轴边距
        
        # 定义矩形路径的四个角点（顺时针绕行）
        # 左下 -> 右下 -> 右上 -> 左上 -> 左下
        self.path_points = [
            (self.MARGIN_X, self.MARGIN_Y),                                      # 左下角
            (self.SANDBOX_WIDTH - self.MARGIN_X, self.MARGIN_Y),                # 右下角
            (self.SANDBOX_WIDTH - self.MARGIN_X, self.SANDBOX_DEPTH - self.MARGIN_Y),  # 右上角
            (self.MARGIN_X, self.SANDBOX_DEPTH - self.MARGIN_Y),                # 左上角
        ]
        
        # 车辆状态
        self.current_segment = 0  # 当前在哪个路段（0-3）
        self.progress = 0.0  # 当前路段的进度（0.0-1.0）
        self.position_x = self.path_points[0][0]
        self.position_y = self.path_points[0][1]
        self.orientation = 0.0  # 朝向角度（度）
        self.battery = 85.0  # 初始电量
        
        # 移动参数
        self.speed = 0.25  # 固定速度 0.25 m/s (模拟慢速行驶)
        self.step_distance = self.speed * 0.5  # 每0.5秒移动的距离（1秒发送2次）
        
    def update_position(self):
        """更新车辆位置（每次调用前进一步）"""
        # 获取当前路段的起点和终点
        start_point = self.path_points[self.current_segment]
        end_point = self.path_points[(self.current_segment + 1) % len(self.path_points)]
        
        # 计算路段长度
        segment_length = math.sqrt(
            (end_point[0] - start_point[0])**2 + 
            (end_point[1] - start_point[1])**2
        )
        
        # 更新进度
        self.progress += self.step_distance / segment_length
        
        # 如果超过当前路段，切换到下一路段
        if self.progress >= 1.0:
            self.progress = 0.0
            self.current_segment = (self.current_segment + 1) % len(self.path_points)
            start_point = self.path_points[self.current_segment]
            end_point = self.path_points[(self.current_segment + 1) % len(self.path_points)]
        
        # 计算当前位置（线性插值）
        self.position_x = start_point[0] + (end_point[0] - start_point[0]) * self.progress
        self.position_y = start_point[1] + (end_point[1] - start_point[1]) * self.progress
        
        # 计算朝向（根据移动方向）- 使用弧度制
        dx = end_point[0] - start_point[0]
        dy = end_point[1] - start_point[1]
        self.orientation = math.atan2(dy, dx)
        
        # 电量缓慢下降（模拟消耗）
        self.battery = max(20.0, self.battery - 0.0125)
    
    def get_current_state(self):
        """获取当前状态"""
        return {
            'position_x': self.position_x,
            'position_y': self.position_y,
            'orientation': self.orientation,
            'speed': self.speed,
            'battery': self.battery
        }

def get_vehicle_path(vehicle_id):
    """获取或创建车辆路径对象"""
    if vehicle_id not in vehicle_paths:
        vehicle_paths[vehicle_id] = VehiclePath(vehicle_id)
    return vehicle_paths[vehicle_id]

def create_vehicle_info_data(vehicle_id=1):
    """
    创建车辆信息协议数据域 (54字节)
    格式：车辆编号(1) + 车速(8) + 位置X(8) + 位置Y(8) + 朝向(8) + 电量(8) + 档位(1) + 方向盘转角(8) + 导航状态(1) + 相机状态(1) + 雷达状态(1) + 陀螺仪状态(1)
    """
    import random
    
    # 获取车辆路径管理器并更新位置
    path = get_vehicle_path(vehicle_id)
    path.update_position()
    state = path.get_current_state()
    
    data = bytearray()
    
    # 车辆编号 (1字节, UINT8)
    data.extend(struct.pack('<B', vehicle_id))
    
    # 车速 (8字节, DOUBLE) - 使用固定速度
    speed = state['speed']
    data.extend(struct.pack('<d', speed))
    
    # 位置X (8字节, DOUBLE) - 从路径管理器获取
    position_x = state['position_x'] + 0.18
    data.extend(struct.pack('<d', position_x))
    
    # 位置Y (8字节, DOUBLE) - 从路径管理器获取
    position_y = state['position_y'] + 0.18
    data.extend(struct.pack('<d', position_y))
    
    # 朝向 (8字节, DOUBLE) - 从路径管理器获取（自动根据移动方向计算）
    orientation = state['orientation']
    data.extend(struct.pack('<d', orientation))
    
    # 电池电量 (8字节, DOUBLE) - 从路径管理器获取（缓慢下降）
    battery = state['battery']
    data.extend(struct.pack('<d', battery))
    
    # 档位 (1字节, UINT8) - 行驶中固定为D1档（4）
    gear = 4  # D1档
    data.extend(struct.pack('<B', gear))
    
    # 方向盘转角 (8字节, DOUBLE) - 根据当前路段设置转角
    # 直线路段转角为0，转弯路段根据朝向设置小转角
    if path.progress < 0.1 or path.progress > 0.9:
        # 接近转弯点，设置转角
        steering_angle = 15.0 if path.current_segment in [1, 3] else -15.0
    else:
        # 直线行驶
        steering_angle = 0.0
    data.extend(struct.pack('<d', steering_angle))
    
    # 导航状态 (1字节, UINT8) - 新定义 1..15 (注意10为终点)
    now_ms = int(time.time() * 1000)
    if now_ms < force_parallel_until:
        nav_status = 15
    else:
        nav_status = 5  # 5 = 正常导航中
    data.extend(struct.pack('<B', 1))
    
    # 相机状态 (1字节, UINT8) - 0:异常, 1:正常（模拟正常工作）
    camera_status = 1
    data.extend(struct.pack('<B', camera_status))
    
    # 激光雷达状态 (1字节, UINT8) - 0:异常, 1:正常（模拟正常工作）
    lidar_status = 1
    data.extend(struct.pack('<B', lidar_status))
    
    # 陀螺仪状态 (1字节, UINT8) - 0:异常, 1:正常（模拟正常工作）
    gyro_status = 1
    data.extend(struct.pack('<B', gyro_status))

    # 车位占用状态 (1字节, UINT8) - 0:未占用（行驶中不占用车位）
    parking_slot = 0
    data.extend(struct.pack('<B', parking_slot))

    # 格式化打印车辆信息协议
    gear_names = {1: 'P', 2: 'R', 3: 'N', 4: 'D1', 5: 'D2', 6: 'D3', 7: 'D4', 8: 'D5', 9: 'D'}
    nav_status_names = {
        1: '正常行驶(空载不入库)', 2: '正常行驶(空载倒车入库)', 3: '接客模式-去起点',
        4: '接客模式-去终点', 5: '去往充电车位', 6: '充电中', 7: '去往停车位',
        8: '车位停车中', 9: '到达接客起点', 10: '到达接客终点', 11: '倒车入库中',
        12: '出库中', 13: '倒车入库中', 14: '出库完成', 15: '平行驾驶模式'
    }
    
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"🚗 车辆编号: {vehicle_id}")
    print(f"   📍 位置: X={position_x:.3f}m, Y={position_y:.3f}m")
    print(f"   🧭 朝向: {orientation:.3f}rad ({math.degrees(orientation):.1f}°)")
    print(f"   🚀 车速: {speed:.3f}m/s | 🔋 电量: {battery:.1f}%")
    print(f"   ⚙️  档位: {gear_names.get(gear, '未知')} | 🎯 方向盘: {steering_angle:.1f}°")
    print(f"   🗺️  导航: {nav_status_names.get(nav_status, '未知状态')}")
    print(f"   📷 相机: {'正常' if camera_status else '异常'} | 📡 雷达: {'正常' if lidar_status else '异常'} | 🔄 陀螺仪: {'正常' if gyro_status else '异常'}")
    print(f"   🅿️  车位占用: {'未占用' if parking_slot == 0 else f'{parking_slot}号车位'}")
    print(f"   🛣️  路段: {path.current_segment} | 进度: {path.progress:.2%}")
    
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
            print(f" 成功连接到服务器 {self.server_host}:{self.server_port}")
            return True
        except Exception as e:
            print(f" 连接失败: {e}")
            return False
        
    def disconnect(self):
        """断开连接"""
        self.running = False
        if self.socket:
            self.socket.close()
            print(" 已断开连接")
        
    def send_message(self, message_type, data):
        """发送消息"""
        if not self.socket:
            print(" 未连接到服务器")
            return False
            
        try:
            packet = build_message(message_type, data)
            self.socket.send(packet)
            
            # 查找消息类型名称
            type_name = None
            for k, v in RECEIVE_MESSAGE_TYPES.items():
                if v == message_type:
                    type_name = k
                    break
            if not type_name:
                for k, v in SEND_MESSAGE_TYPES.items():
                    if v == message_type:
                        type_name = k
                        break
            if not type_name:
                type_name = f"0x{message_type:04X}"
            print(f" 发送消息: {type_name}, 数据长度: {len(data)} 字节")
            return True
        except Exception as e:
            print(f" 发送消息失败: {e}")
            return False
        
    def start_heartbeat(self, interval=5):
        """启动心跳发送"""
        def heartbeat_loop():
            while self.running:
                if not self.send_message(RECEIVE_MESSAGE_TYPES['HEARTBEAT'], b''):
                    break
                time.sleep(interval)
        
        thread = threading.Thread(target=heartbeat_loop, daemon=True)
        thread.start()
        print(f" 心跳发送已启动 (间隔: {interval}秒)")
        
    def start_data_simulation(self):
        """启动数据模拟发送"""
        def data_simulation_loop():
            counter = 0
            while self.running:
                time.sleep(0.5)  # 每0.5秒发送一次数据（1秒发送2次）
                counter += 1
                
                # 发送车辆信息协议
                data = create_vehicle_info_data(self.vehicle_id)
                self.send_message(RECEIVE_MESSAGE_TYPES['VEHICLE_INFO'], data)
        
        thread = threading.Thread(target=data_simulation_loop, daemon=True)
        thread.start()
        print(" 数据模拟发送已启动")
        
    def send_path_file_selection(self, path_ids):
        """
        发送路径文件选择协议 (0x0003)
        数据域: 车辆编号(1字节) + 路径编号列表(N字节)
        """
        try:
            # 构建数据域
            data = bytearray()
            data.append(self.vehicle_id)  # 车辆编号
            data.extend(path_ids)         # 路径编号列表
            
            # 发送协议
            if self.send_message(RECEIVE_MESSAGE_TYPES['PATH_FILE_SELECTION'], bytes(data)):
                print(f"🛣️ [发送] 路径文件选择 (0x0003):")
                print(f"   车辆ID: {self.vehicle_id}")
                print(f"   路径编号: {path_ids}")
                return True
            else:
                print(f"❌ 发送路径文件选择失败")
                return False
        except Exception as e:
            print(f"❌ 发送路径文件选择异常: {e}")
            return False
    
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
                    print(f" 收到服务器数据: {len(data)} 字节")
                    
                    # 尝试解析完整的协议消息
                    while len(buffer) >= 25:  # 最小协议长度
                        # 查找帧头
                        header_pos = buffer.find(HEADER)
                        if header_pos == -1:
                            # 没有找到帧头，清空缓冲区
                            buffer.clear()
                            break
                        
                        # 移除帧头之前的数据
                        if header_pos > 0:
                            buffer = buffer[header_pos:]
                        
                        # 检查是否有足够的数据来解析数据长度
                        if len(buffer) < 19:  # 帧头(4) + 版本(1) + 时间戳(8) + 消息类型(2) + 数据长度(4) = 19
                            break
                        
                        # 解析数据长度
                        data_length = struct.unpack('<I', buffer[15:19])[0]
                        total_length = 25 + data_length  # 完整协议长度
                        
                        # 检查是否有完整的数据包
                        if len(buffer) < total_length:
                            break
                        
                        # 提取完整数据包
                        packet = bytes(buffer[:total_length])
                        buffer = buffer[total_length:]
                        
                        # 解析协议消息
                        message = parse_received_message(packet)
                        if message:
                            self.handle_received_message(message)
                    
                except Exception as e:
                    if self.running:
                        print(f" 接收数据错误: {e}")
                    break
        
        thread = threading.Thread(target=listen_loop, daemon=True)
        thread.start()
        print(" 开始监听服务器命令")
    
    def handle_received_message(self, message):
        """处理接收到的协议消息"""
        message_type = message['message_type']
        data_domain = message['data_domain']
        timestamp_dt = datetime.fromtimestamp(message['timestamp'] / 1000)
        
        print(f"\n收到协议消息:")
        print(f"   消息类型: 0x{message_type:04X}")
        print(f"   时间戳: {timestamp_dt}")
        print(f"   数据长度: {message['data_length']} 字节")
        
        # 根据消息类型处理
        if message_type == 0x2001:
            # 来自界面端的平行驾驶请求（沙盘离线时的回退路径)
            if len(data_domain) >= 1:
                vid = data_domain[0]
                if vid == self.vehicle_id:
                    print(f"🎮 收到平行驾驶请求 -> 车辆{vid} 将在10秒内维持导航=15")
                    global force_parallel_until
                    force_parallel_until = int(time.time() * 1000) + 10000
        elif message_type == SEND_MESSAGE_TYPES['VEHICLE_CONTROL']:
            # 解析车辆控制指令
            control_info = parse_vehicle_control_message(data_domain)
            if control_info:
                print(f" 车辆控制指令:")
                print(f"   目标车辆: {control_info['vehicle_id']}")
                print(f"   控制指令: {control_info['command_name']} ({control_info['control_command']})")
                
                if control_info['control_command'] == 4:  # 初始化位姿
                    print(f"   位置X: {control_info['position_x']:.3f}")
                    print(f"   位置Y: {control_info['position_y']:.3f}")
                    print(f"   朝向: {control_info['orientation']:.3f}")
                
                # 模拟执行指令
                print(f" 车辆{control_info['vehicle_id']}执行{control_info['command_name']}指令")
                
        elif message_type == SEND_MESSAGE_TYPES['DATA_RECORDING']:
            # 解析数据记录控制指令
            recording_info = parse_data_recording_message(data_domain)
            if recording_info:
                print(f" 数据记录控制指令:")
                print(f"   目标车辆: {recording_info['vehicle_id']}")
                print(f"   记录状态: {recording_info['status_name']} ({recording_info['recording_status']})")
                
                # 模拟执行指令
                print(f" 车辆{recording_info['vehicle_id']}数据记录{recording_info['status_name']}")
                
        elif message_type == SEND_MESSAGE_TYPES['TAXI_ORDER']:
            # 解析出租车订单指令
            taxi_info = parse_taxi_order_message(data_domain)
            if taxi_info:
                print(f"出租车订单:")
                print(f"   目标车辆: {taxi_info['vehicle_id']}")
                print(f"   起点: ({taxi_info['start_x']:.3f}, {taxi_info['start_y']:.3f})")
                print(f"   终点: ({taxi_info['end_x']:.3f}, {taxi_info['end_y']:.3f})")
                
                # 模拟接单处理
                print(f" 车辆{self.vehicle_id}收到出租车订单，目标车辆: {taxi_info['vehicle_id']}")
                
        elif message_type == SEND_MESSAGE_TYPES['AVP_PARKING']:
            # 解析AVP泊车指令
            parking_info = parse_avp_parking_message(data_domain)
            if parking_info:
                print(f" AVP自主代客泊车指令:")
                print(f"   目标车辆: {parking_info['vehicle_id']}")
                print(f"   停车位: {parking_info['parking_spot']}号车位")
                
                # 模拟执行泊车
                if parking_info['vehicle_id'] == self.vehicle_id:
                    print(f" 车辆{self.vehicle_id}开始执行AVP泊车，目标车位: {parking_info['parking_spot']}号")
                else:
                    print(f" 泊车指令目标车辆({parking_info['vehicle_id']})与当前车辆({self.vehicle_id})不匹配")
                    
        elif message_type == SEND_MESSAGE_TYPES['AVP_PICKUP']:
            # 解析AVP取车指令
            pickup_info = parse_avp_pickup_message(data_domain)
            if pickup_info:
                print(f" AVP取车指令:")
                print(f"   目标车辆: {pickup_info['vehicle_id']}")
                
                # 模拟执行取车
                if pickup_info['vehicle_id'] == self.vehicle_id:
                    print(f" 车辆{self.vehicle_id}开始执行AVP取车操作")
                else:
                    print(f" 取车指令目标车辆({pickup_info['vehicle_id']})与当前车辆({self.vehicle_id})不匹配")
                    
        elif message_type == SEND_MESSAGE_TYPES['VEHICLE_FUNCTION_SETTING']:
            # 解析车辆功能设置指令
            function_info = parse_vehicle_function_setting_message(data_domain)
            if function_info:
                print(f"🔧 车辆功能设置指令:")
                print(f"   目标车辆: {function_info['vehicle_id']}")
                print(f"   功能模块: {function_info['function_name']} ({function_info['function_id']})")
                print(f"   设置状态: {function_info['status_name']} ({function_info['enable_status']})")
                
                # 模拟执行功能设置
                if function_info['vehicle_id'] == self.vehicle_id:
                    print(f" 车辆{self.vehicle_id}执行功能设置: {function_info['function_name']} -> {function_info['status_name']}")
                else:
                    print(f" 功能设置指令目标车辆({function_info['vehicle_id']})与当前车辆({self.vehicle_id})不匹配")
                    
        elif message_type == SEND_MESSAGE_TYPES['VEHICLE_PATH_DISPLAY']:
            # 解析车辆路径显示控制指令
            path_info = parse_vehicle_path_display_message(data_domain)
            if path_info:
                print(f"🛣️ 车辆路径显示控制指令:")
                print(f"   目标车辆: {path_info['vehicle_id']}")
                print(f"   显示路径: {path_info['display_name']} ({path_info['display_path']})")
                
                # 模拟执行路径显示控制
                if path_info['vehicle_id'] == self.vehicle_id:
                    if path_info['display_path'] == 1:
                        print(f" 车辆{self.vehicle_id}开始发送路径数据到服务端")
                        # 收到开启路径显示指令后，主动发送路径文件选择（0x0003）
                        self.send_path_file_selection([1, 2, 3, 4, 5, 6, 7, 8])
                    else:
                        print(f" 车辆{self.vehicle_id}停止发送路径数据到服务端")
                else:
                    print(f"路径显示指令目标车辆({path_info['vehicle_id']})与当前车辆({self.vehicle_id})不匹配")
                    
        elif message_type == SEND_MESSAGE_TYPES['CONSTRUCTION_MARKER']:
            # 解析施工标记指令 - 新格式：所有施工点坐标
            marker_info = parse_construction_marker_message(data_domain)
            if marker_info:
                print(f"施工标记指令:")
                print(f"   施工点数量: {marker_info['marker_count']} 个")
                
                if marker_info['marker_count'] == 0:
                    print(f"   所有施工点已清除")
                else:
                    print(f"   当前所有施工点坐标:")
                    for marker in marker_info['markers']:
                        print(f"     施工点{marker['index']}: ({marker['position_x']:.3f}, {marker['position_y']:.3f})")
                
                # 模拟执行施工标记操作
                print(f" 已更新本地施工点列表，共 {marker_info['marker_count']} 个施工点")
        else:
            print(f"   未知消息类型: 0x{message_type:04X}")
            print(f"   数据: {data_domain.hex()}")
        
        print()  # 添加空行便于阅读


def main():
    import sys
    
    # 获取命令行参数 - 车辆ID（默认为2）
    vehicle_id = 2
    if len(sys.argv) > 1:
        try:
            vehicle_id = int(sys.argv[1])
        except ValueError:
            print(" 车辆ID必须是数字")
            sys.exit(1)
    
    print(f" Socket客户端测试程序 - 车辆ID: {vehicle_id}")
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
        
        print(f"\n 测试客户端已启动 (车辆ID: {vehicle_id})，按 Ctrl+C 停止")
        print("正在发送以下类型的数据:")
        print("- 心跳包 (每10秒)")
        print("- 车辆信息协议 (每0.5秒，即1秒2次)")
        print("\n 车辆信息协议数据域 (54字节):")
        print("- 车辆编号(1) + 车速(8) + 位置X(8) + 位置Y(8) + 朝向(8) + 电量(8)")
        print("- 档位(1) + 方向盘转角(8) + 导航状态(1) + 相机状态(1) + 雷达状态(1) + 陀螺仪状态(1)")
        
        # 保持程序运行
        while client.running:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n用户中断，正在退出...")
    finally:
        client.disconnect()


if __name__ == "__main__":
    main()


