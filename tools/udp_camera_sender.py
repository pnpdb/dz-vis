#!/usr/bin/env python3
"""
UDP视频发送器
使用OpenCV捕获摄像头画面并通过UDP发送JPEG帧
"""

import cv2
import socket
import struct
import time
import argparse
import sys
import numpy as np
from typing import Optional

# 协议常量
PROTOCOL_VERSION = 1
FRAME_TYPE_COMPLETE = 0x01
FRAME_TYPE_FRAGMENT_FIRST = 0x02
FRAME_TYPE_FRAGMENT_MIDDLE = 0x03
FRAME_TYPE_FRAGMENT_LAST = 0x04

# 包头大小
HEADER_SIZE = 26

# 最大UDP负载（考虑网络MTU）
MAX_UDP_PAYLOAD = 1400


class UDPVideoSender:
    def __init__(self, vehicle_id: int, target_host: str, target_port: int, 
                 camera_index: int = 0, jpeg_quality: int = 70):
        """
        初始化UDP视频发送器
        
        Args:
            vehicle_id: 车辆ID
            target_host: 目标主机地址
            target_port: 目标端口
            camera_index: 摄像头索引
            jpeg_quality: JPEG质量(1-100)
        """
        self.vehicle_id = vehicle_id
        self.target_address = (target_host, target_port)
        self.jpeg_quality = jpeg_quality
        self.frame_counter = 0
        
        # 创建UDP套接字
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        
        # 初始化摄像头
        self.camera = cv2.VideoCapture(camera_index)
        if not self.camera.isOpened():
            raise RuntimeError(f"无法打开摄像头 {camera_index}")
        
        # 设置摄像头分辨率
        self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.camera.set(cv2.CAP_PROP_FPS, 30)
        
        print(f"✅ UDP视频发送器初始化成功")
        print(f"   车辆ID: {vehicle_id}")
        print(f"   目标地址: {target_host}:{target_port}")
        print(f"   JPEG质量: {jpeg_quality}")

    def generate_fake_frame(self) -> np.ndarray:
        """生成虚拟摄像头帧（动态变化的测试图像）"""
        import time
        
        # 创建640x480的彩色图像
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        
        # 获取当前时间用于动画效果
        current_time = time.time()
        
        # 背景渐变色（根据时间变化）
        color_shift = int((current_time * 50) % 255)
        frame[:, :, 0] = color_shift  # 蓝色通道
        frame[:, :, 1] = (color_shift + 85) % 255  # 绿色通道
        frame[:, :, 2] = (color_shift + 170) % 255  # 红色通道
        
        # 添加移动的圆形
        center_x = int(320 + 200 * np.sin(current_time * 2))
        center_y = int(240 + 150 * np.cos(current_time * 2))
        cv2.circle(frame, (center_x, center_y), 50, (255, 255, 255), -1)
        
        # 添加帧计数器文本
        text = f"Frame: {self.frame_counter}"
        cv2.putText(frame, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
        
        # 添加时间戳
        time_text = f"Time: {current_time:.1f}"
        cv2.putText(frame, time_text, (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
        
        return frame

    def create_header(self, frame_type: int, frame_id: int, fragment_index: int, 
                     total_fragments: int, timestamp: int, data_length: int) -> bytes:
        """
        创建UDP视频包头
        
        Returns:
            25字节的包头数据
        """
        return struct.pack(
            '>BBIIHHQI',  # 大端序格式
            PROTOCOL_VERSION,      # version (1 byte)
            frame_type,           # frame_type (1 byte)
            self.vehicle_id,      # vehicle_id (4 bytes)
            frame_id,             # frame_id (4 bytes)
            fragment_index,       # fragment_index (2 bytes)
            total_fragments,      # total_fragments (2 bytes)
            timestamp,            # timestamp (8 bytes)
            data_length           # data_length (4 bytes)
        )

    def send_frame(self, jpeg_data: bytes) -> bool:
        """
        发送一帧JPEG数据
        
        Args:
            jpeg_data: JPEG编码的图像数据
            
        Returns:
            发送是否成功
        """
        frame_id = self.frame_counter
        timestamp = int(time.time() * 1000)  # 毫秒时间戳
        
        # 计算每个分片的最大数据大小
        max_fragment_size = MAX_UDP_PAYLOAD - HEADER_SIZE
        
        if len(jpeg_data) <= max_fragment_size:
            # 小帧，直接发送
            return self._send_complete_frame(frame_id, timestamp, jpeg_data)
        else:
            # 大帧，分片发送
            return self._send_fragmented_frame(frame_id, timestamp, jpeg_data, max_fragment_size)

    def _send_complete_frame(self, frame_id: int, timestamp: int, jpeg_data: bytes) -> bool:
        """发送完整帧"""
        try:
            header = self.create_header(
                FRAME_TYPE_COMPLETE, frame_id, 0, 1, timestamp, len(jpeg_data)
            )
            packet = header + jpeg_data
            self.socket.sendto(packet, self.target_address)
            return True
        except Exception as e:
            return False

    def _send_fragmented_frame(self, frame_id: int, timestamp: int, 
                              jpeg_data: bytes, max_fragment_size: int) -> bool:
        """发送分片帧"""
        try:
            # 计算分片
            total_size = len(jpeg_data)
            total_fragments = (total_size + max_fragment_size - 1) // max_fragment_size
            
            
            for i in range(total_fragments):
                start_pos = i * max_fragment_size
                end_pos = min(start_pos + max_fragment_size, total_size)
                fragment_data = jpeg_data[start_pos:end_pos]
                
                # 确定帧类型
                if i == 0:
                    frame_type = FRAME_TYPE_FRAGMENT_FIRST
                elif i == total_fragments - 1:
                    frame_type = FRAME_TYPE_FRAGMENT_LAST
                else:
                    frame_type = FRAME_TYPE_FRAGMENT_MIDDLE
                
                header = self.create_header(
                    frame_type, frame_id, i, total_fragments, timestamp, len(fragment_data)
                )
                packet = header + fragment_data
                self.socket.sendto(packet, self.target_address)
                
                
                # 分片间隔，避免网络拥塞
                if i < total_fragments - 1:
                    time.sleep(0.001)  # 1ms间隔
            
            return True
        except Exception as e:
            return False

    def capture_and_send(self, fps: float = 10.0, duration: Optional[float] = None):
        """
        捕获摄像头画面并发送
        
        Args:
            fps: 目标帧率
            duration: 运行时长（秒），None表示无限运行
        """
        frame_interval = 1.0 / fps
        start_time = time.time()
        last_frame_time = 0
        
        print(f"🎥 开始捕获并发送视频帧 (FPS: {fps})")
        print("按 Ctrl+C 停止发送")
        
        try:
            while True:
                current_time = time.time()
                
                # 检查运行时长
                if duration and (current_time - start_time) >= duration:
                    print(f"⏰ 达到指定运行时长 {duration} 秒，停止发送")
                    break
                
                # 控制帧率
                if current_time - last_frame_time < frame_interval:
                    time.sleep(0.01)  # 短暂休眠
                    continue
                
                # 捕获帧
                ret, frame = self.camera.read()
                if not ret:
                    print("❌ 无法从摄像头读取帧")
                    break
                
                # 编码为JPEG
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), self.jpeg_quality]
                ret, jpeg_buffer = cv2.imencode('.jpg', frame, encode_param)
                if not ret:
                    continue
                
                jpeg_data = jpeg_buffer.tobytes()
                
                # 验证JPEG数据（检查JPEG文件头）
                if len(jpeg_data) < 2 or jpeg_data[0:2] != b'\xff\xd8':
                    continue
                
                # 发送帧
                if self.send_frame(jpeg_data):
                    self.frame_counter += 1
                    last_frame_time = current_time
                    
                    # 每100帧打印一次状态
                    if self.frame_counter % 100 == 0:
                        print(f"📊 已发送 {self.frame_counter} 帧")
                
                # 显示预览（可选）
                if False:  # 关闭预览，专注于UDP发送
                    cv2.imshow('Camera Preview', frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
                        
        except KeyboardInterrupt:
            print("\n👤 用户中断，停止发送")
        except Exception as e:
            print(f"❌ 发送过程中出错: {e}")
        finally:
            self.cleanup()

    def cleanup(self):
        """清理资源"""
        print("🧹 清理资源...")
        if self.camera:
            self.camera.release()
        if self.socket:
            self.socket.close()
        cv2.destroyAllWindows()
        print(f"📊 总共发送了 {self.frame_counter} 帧")


def main():
    parser = argparse.ArgumentParser(description='UDP视频发送器')
    parser.add_argument('--vehicle-id', type=int, default=1, help='车辆ID (默认: 1)')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='目标主机 (默认: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=8080, help='目标端口 (默认: 8080)')
    parser.add_argument('--camera', type=int, default=0, help='摄像头索引 (默认: 0)')
    parser.add_argument('--quality', type=int, default=70, help='JPEG质量 (默认: 70)')
    parser.add_argument('--fps', type=float, default=30.0, help='目标帧率 (默认: 30.0)')
    parser.add_argument('--duration', type=float, help='运行时长（秒）')
    
    args = parser.parse_args()
    
    # 验证参数
    if not (1 <= args.quality <= 100):
        print("❌ JPEG质量必须在1-100之间")
        sys.exit(1)
    
    if args.fps <= 0:
        print("❌ 帧率必须大于0")
        sys.exit(1)
    
    try:
        # 创建发送器
        sender = UDPVideoSender(
            vehicle_id=args.vehicle_id,
            target_host=args.host,
            target_port=args.port,
            camera_index=args.camera,
            jpeg_quality=args.quality
        )
        
        # 开始发送
        sender.capture_and_send(fps=args.fps, duration=args.duration)
        
    except Exception as e:
        print(f"❌ 程序错误: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
