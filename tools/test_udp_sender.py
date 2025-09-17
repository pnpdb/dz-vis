#!/usr/bin/env python3
"""
简单的UDP视频测试发送器
发送模拟的JPEG数据包，不依赖摄像头
"""

import socket
import struct
import time
import argparse
import os

# 协议常量
PROTOCOL_VERSION = 1
FRAME_TYPE_COMPLETE = 0x01
HEADER_SIZE = 26

def create_header(vehicle_id, frame_id, timestamp, data_length):
    """创建UDP视频包头"""
    return struct.pack(
        '>BBIIHHQI',  # 大端序格式
        PROTOCOL_VERSION,      # version (1 byte)
        FRAME_TYPE_COMPLETE,   # frame_type (1 byte)
        vehicle_id,            # vehicle_id (4 bytes)
        frame_id,              # frame_id (4 bytes)
        0,                     # fragment_index (2 bytes)
        1,                     # total_fragments (2 bytes)
        timestamp,             # timestamp (8 bytes)
        data_length            # data_length (4 bytes)
    )

def create_test_jpeg():
    """创建一个最小的有效JPEG文件"""
    # 最小的JPEG文件头和尾
    jpeg_header = bytes([
        0xFF, 0xD8,  # SOI (Start of Image)
        0xFF, 0xE0,  # APP0
        0x00, 0x10,  # Length
        0x4A, 0x46, 0x49, 0x46, 0x00,  # "JFIF\0"
        0x01, 0x01,  # Version
        0x01,        # Units
        0x00, 0x48,  # X density
        0x00, 0x48,  # Y density
        0x00, 0x00,  # Thumbnail width/height
    ])
    
    # 简单的图像数据
    jpeg_data = bytes([
        0xFF, 0xC0,  # SOF0 (Start of Frame)
        0x00, 0x11,  # Length
        0x08,        # Precision
        0x00, 0x01,  # Height (1 pixel)
        0x00, 0x01,  # Width (1 pixel)
        0x01,        # Number of components
        0x01, 0x11, 0x00,  # Component data
        
        0xFF, 0xDA,  # SOS (Start of Scan)
        0x00, 0x08,  # Length
        0x01,        # Number of components
        0x01, 0x00,  # Component selector
        0x00, 0x3F, 0x00,  # Scan data
        
        0x00,        # Minimal scan data
        
        0xFF, 0xD9   # EOI (End of Image)
    ])
    
    return jpeg_header + jpeg_data

def main():
    parser = argparse.ArgumentParser(description='UDP视频测试发送器')
    parser.add_argument('--vehicle-id', type=int, default=1, help='车辆ID')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='目标主机')
    parser.add_argument('--port', type=int, default=8080, help='目标端口')
    parser.add_argument('--fps', type=float, default=5.0, help='发送帧率')
    parser.add_argument('--duration', type=float, default=30.0, help='发送时长(秒)')
    
    args = parser.parse_args()
    
    # 创建UDP套接字
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    target_address = (args.host, args.port)
    
    # 创建测试JPEG数据
    test_jpeg = create_test_jpeg()
    
    print(f"📤 开始发送测试UDP视频流")
    print(f"   车辆ID: {args.vehicle_id}")
    print(f"   目标地址: {args.host}:{args.port}")
    print(f"   JPEG大小: {len(test_jpeg)}字节")
    print(f"   FPS: {args.fps}")
    print(f"   持续时间: {args.duration}秒")
    
    frame_interval = 1.0 / args.fps
    start_time = time.time()
    frame_id = 0
    next_frame_time = start_time
    
    try:
        while True:
            current_time = time.time()
            
            # 检查是否到达持续时间
            if current_time - start_time >= args.duration:
                print(f"⏰ 达到持续时间 {args.duration} 秒，停止发送")
                break
            
            # 精确的帧时间控制
            if current_time >= next_frame_time:
                # 创建包头
                timestamp = int(current_time * 1000)  # 毫秒时间戳
                header = create_header(args.vehicle_id, frame_id, timestamp, len(test_jpeg))
                
                # 发送数据包
                packet = header + test_jpeg
                sock.sendto(packet, target_address)
                
                frame_id += 1
                next_frame_time += frame_interval
                
                # 如果落后太多，重置时间
                if next_frame_time < current_time - frame_interval:
                    next_frame_time = current_time + frame_interval
            
            # 短暂休眠避免100%CPU占用
            time.sleep(0.001)
            
    except KeyboardInterrupt:
        print("\n👤 用户中断发送")
    except Exception as e:
        print(f"❌ 发送错误: {e}")
    finally:
        sock.close()
        print(f"📊 总共发送了 {frame_id} 帧")

if __name__ == '__main__':
    main()
