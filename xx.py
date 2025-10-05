#!/usr/bin/env python3
"""
综合测试客户端
=================

功能：
1. 通过 TCP 连接模拟车辆与 Tauri Socket 服务端的协议交互
2. 解析下发的 0x1009 车载摄像头开关协议
3. 在收到开启指令时启动 UDP 视频推流（复用了原 test_udp_camera_sender.py 的逻辑）
4. 在收到关闭指令时停止 UDP 推流

用法示例：
    python xx.py --vehicle-id 1 \
                 --socket-host 127.0.0.1 --socket-port 8888 \
                 --udp-host 127.0.0.1 --udp-port 8080 \
                 --fps 20 --jpeg-quality 70 --use-fake-camera

如需使用真实摄像头，请安装 OpenCV 并移除 --use-fake-camera 参数。
"""

from __future__ import annotations

import argparse
import socket
import struct
import threading
import time
from datetime import datetime
from typing import Optional

try:
    import cv2  # type: ignore
    CV2_AVAILABLE = True
except ImportError:  # pragma: no cover - OpenCV 可选依赖
    CV2_AVAILABLE = False

import numpy as np

# 协议常量 --------------------------------------------------------------
HEADER = b"\xEF\xEF\xEF\xEF"
FOOTER = b"\xFE\xFE\xFE\xFE"
VERSION = 0x10

RECEIVE_MESSAGE_TYPES = {
    "HEARTBEAT": 0x0001,
    "VEHICLE_INFO": 0x0002,
}

SEND_MESSAGE_TYPES = {
    "VEHICLE_CONTROL": 0x1001,
    "DATA_RECORDING": 0x1002,
    "TAXI_ORDER": 0x1003,
    "AVP_PARKING": 0x1004,
    "AVP_PICKUP": 0x1005,
    "VEHICLE_FUNCTION_SETTING": 0x1006,
    "VEHICLE_PATH_DISPLAY": 0x1007,
    "CONSTRUCTION_MARKER": 0x1008,
    "VEHICLE_CAMERA_TOGGLE": 0x1009,
}

CONTROL_COMMANDS = {
    1: "启动",
    2: "停止",
    3: "紧急制动",
    4: "初始化位姿",
}

# UDP 视频协议常量 ------------------------------------------------------
UDP_PROTOCOL_VERSION = 1
FRAME_TYPE_COMPLETE = 0x01
FRAME_TYPE_FRAGMENT_FIRST = 0x02
FRAME_TYPE_FRAGMENT_MIDDLE = 0x03
FRAME_TYPE_FRAGMENT_LAST = 0x04
UDP_HEADER_SIZE = 23
MAX_UDP_PAYLOAD = 1400


def crc16_ccitt_false(data: bytes) -> int:
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc <<= 1
            crc &= 0xFFFF
    return crc & 0xFFFF


def build_message(message_type: int, data: bytes) -> bytes:
    timestamp = int(time.time() * 1000)
    body = bytearray()
    body.extend(struct.pack("<B", VERSION))
    body.extend(struct.pack("<Q", timestamp))
    body.extend(struct.pack("<H", message_type))
    body.extend(struct.pack("<I", len(data)))
    body.extend(data)

    crc = crc16_ccitt_false(body)

    packet = bytearray()
    packet.extend(HEADER)
    packet.extend(body)
    packet.extend(struct.pack("<H", crc))
    packet.extend(FOOTER)
    return bytes(packet)


def parse_camera_toggle_message(data: bytes) -> Optional[dict]:
    if len(data) < 2:
        print(" 车载摄像头开关数据长度不足")
        return None
    vehicle_id = data[0]
    enabled = data[1]
    return {
        "vehicle_id": vehicle_id,
        "enabled": enabled,
        "enabled_name": "开启" if enabled == 1 else "关闭",
    }


# UDP 摄像头推流 --------------------------------------------------------
class CameraStreamer:
    def __init__(
        self,
        vehicle_id: int,
        udp_host: str,
        udp_port: int,
        camera_index: int,
        jpeg_quality: int,
        fps: float,
        use_fake_camera: bool,
    ) -> None:
        self.vehicle_id = vehicle_id
        self.target = (udp_host, udp_port)
        self.camera_index = camera_index
        self.jpeg_quality = max(1, min(100, jpeg_quality))
        self.fps = max(1.0, fps)
        self.use_fake_camera = use_fake_camera or (not CV2_AVAILABLE)

        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.running_event = threading.Event()
        self.thread: Optional[threading.Thread] = None
        self.frame_counter = 0

        self.camera = None
        if not self.use_fake_camera:
            cam = cv2.VideoCapture(self.camera_index)
            if not cam.isOpened():
                raise RuntimeError(f"无法打开摄像头 {self.camera_index}")
            cam.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cam.set(cv2.CAP_PROP_FPS, self.fps)
            self.camera = cam

        source_desc = "虚拟画面" if self.use_fake_camera else f"摄像头 {self.camera_index}"
        print(f"🎬 摄像头推流器已准备: {source_desc} -> udp://{udp_host}:{udp_port}")

    def start(self) -> None:
        if self.thread and self.thread.is_alive():
            return
        self.running_event.set()
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()
        print("🚀 已启动摄像头推流")

    def stop(self) -> None:
        if not self.thread:
            return
        self.running_event.clear()
        self.thread.join(timeout=3)
        self.thread = None
        print("🛑 摄像头推流已停止")

    def shutdown(self) -> None:
        self.stop()
        if self.camera is not None:
            self.camera.release()
        self.socket.close()

    # --- 内部实现 ----------------------------------------------------
    def _loop(self) -> None:
        frame_interval = 1.0 / self.fps
        last_tick = 0.0
        try:
            while self.running_event.is_set():
                now = time.time()
                if now - last_tick < frame_interval:
                    time.sleep(0.005)
                    continue
                frame = self._capture_frame()
                if frame is None:
                    time.sleep(0.05)
                    continue
                ok, jpeg = self._encode_jpeg(frame)
                if not ok:
                    continue
                if self._send_frame(jpeg):
                    self.frame_counter += 1
                    last_tick = now
        except Exception as exc:  # pragma: no cover - 调试输出
            print(f"❌ 推流异常: {exc}")
        finally:
            print(f"📊 推流结束，总帧数: {self.frame_counter}")

    def _capture_frame(self) -> Optional[np.ndarray]:
        if self.use_fake_camera:
            return self._generate_fake_frame()
        assert self.camera is not None
        ret, frame = self.camera.read()
        if not ret:
            print("⚠️ 无法读取摄像头帧")
            return None
        return frame

    def _generate_fake_frame(self) -> np.ndarray:
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        t = time.time()
        shift = int((t * 50) % 255)
        frame[:, :, 0] = shift
        frame[:, :, 1] = (shift + 85) % 255
        frame[:, :, 2] = (shift + 170) % 255
        cx = int(320 + 200 * np.sin(t * 2))
        cy = int(240 + 150 * np.cos(t * 2))
        cv2.circle(frame, (cx, cy), 50, (255, 255, 255), -1)
        cv2.putText(frame, f"Frame: {self.frame_counter}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
        cv2.putText(frame, f"Time: {t:.1f}", (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
        return frame

    def _encode_jpeg(self, frame: np.ndarray) -> tuple[bool, bytes]:
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), self.jpeg_quality]
        ok, buffer = cv2.imencode('.jpg', frame, encode_param)
        if not ok:
            return False, b''
        data = buffer.tobytes()
        if len(data) < 2 or data[:2] != b'\xff\xd8':
            return False, b''
        return True, data

    def _send_frame(self, jpeg_data: bytes) -> bool:
        frame_id = self.frame_counter
        timestamp = int(time.time() * 1000) & 0xFFFFFFFFFFFFFFFF
        max_fragment = MAX_UDP_PAYLOAD - UDP_HEADER_SIZE
        if len(jpeg_data) <= max_fragment:
            return self._send_complete_frame(frame_id, timestamp, jpeg_data)
        return self._send_fragmented_frame(frame_id, timestamp, jpeg_data, max_fragment)

    def _send_complete_frame(self, frame_id: int, timestamp: int, jpeg_data: bytes) -> bool:
        try:
            header = self._build_udp_header(FRAME_TYPE_COMPLETE, frame_id, 0, 1, timestamp, len(jpeg_data))
            self.socket.sendto(header + jpeg_data, self.target)
            return True
        except Exception as exc:
            print(f"❌ UDP发送失败: {exc}")
            return False

    def _send_fragmented_frame(self, frame_id: int, timestamp: int, jpeg_data: bytes, max_fragment: int) -> bool:
        total_size = len(jpeg_data)
        total_fragments = (total_size + max_fragment - 1) // max_fragment
        for index in range(total_fragments):
            fragment = jpeg_data[index * max_fragment : (index + 1) * max_fragment]
            frame_type = (
                FRAME_TYPE_FRAGMENT_FIRST if index == 0 else
                FRAME_TYPE_FRAGMENT_LAST if index == total_fragments - 1 else
                FRAME_TYPE_FRAGMENT_MIDDLE
            )
            header = self._build_udp_header(frame_type, frame_id, index, total_fragments, timestamp, len(fragment))
            try:
                self.socket.sendto(header + fragment, self.target)
            except Exception as exc:
                print(f"❌ UDP分片发送失败: {exc}")
                return False
            time.sleep(0.001)
        return True

    def _build_udp_header(
        self,
        frame_type: int,
        frame_id: int,
        fragment_index: int,
        total_fragments: int,
        timestamp: int,
        data_length: int,
    ) -> bytes:
        return struct.pack(
            "<BBBIHHQI",
            UDP_PROTOCOL_VERSION,
            frame_type,
            self.vehicle_id & 0xFF,
            frame_id,
            fragment_index,
            total_fragments,
            timestamp,
            data_length,
        )


# TCP 测试客户端 -------------------------------------------------------
class TestClient:
    def __init__(
        self,
        vehicle_id: int,
        socket_host: str,
        socket_port: int,
        streamer: CameraStreamer,
    ) -> None:
        self.vehicle_id = vehicle_id
        self.socket_host = socket_host
        self.socket_port = socket_port
        self.streamer = streamer

        self.socket: Optional[socket.socket] = None
        self.running = False

        self._heartbeat_thread: Optional[threading.Thread] = None
        self._data_thread: Optional[threading.Thread] = None
        self._listen_thread: Optional[threading.Thread] = None

    # -- 连接管理 ------------------------------------------------------
    def connect(self) -> bool:
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((self.socket_host, self.socket_port))
            self.running = True
            print(f"✅ 已连接到 Socket 服务器 {self.socket_host}:{self.socket_port}")
            return True
        except Exception as exc:
            print(f"❌ 连接服务器失败: {exc}")
            return False

    def disconnect(self) -> None:
        self.running = False
        if self.socket:
            try:
                self.socket.shutdown(socket.SHUT_RDWR)
            except Exception:
                pass
            self.socket.close()
            self.socket = None
        print("🔌 Socket 连接已断开")

    # -- 发送辅助 ------------------------------------------------------
    def send_message(self, message_type: int, data: bytes) -> bool:
        if not self.socket:
            return False
        try:
            packet = build_message(message_type, data)
            self.socket.sendall(packet)
            return True
        except Exception as exc:
            print(f"❌ 发送消息失败: {exc}")
            return False

    # -- 后台任务 ------------------------------------------------------
    def start_heartbeat(self, interval: int = 10) -> None:
        def loop() -> None:
            while self.running:
                if not self.send_message(RECEIVE_MESSAGE_TYPES["HEARTBEAT"], b""):
                    break
                time.sleep(interval)

        self._heartbeat_thread = threading.Thread(target=loop, daemon=True)
        self._heartbeat_thread.start()
        print(f"💓 心跳线程已启动 (每 {interval}s)")

    def start_data_simulation(self) -> None:
        def loop() -> None:
            while self.running:
                payload = self._create_vehicle_info_data()
                self.send_message(RECEIVE_MESSAGE_TYPES["VEHICLE_INFO"], payload)
                time.sleep(2)

        self._data_thread = threading.Thread(target=loop, daemon=True)
        self._data_thread.start()
        print("📡 车辆信息模拟发送已启动 (每 2s)")

    def listen_for_commands(self) -> None:
        def loop() -> None:
            buffer = bytearray()
            while self.running:
                try:
                    chunk = self.socket.recv(1024) if self.socket else b""
                    if not chunk:
                        print("⚠️ 服务器断开连接")
                        break
                    buffer.extend(chunk)
                    while len(buffer) >= 25:
                        header_pos = buffer.find(HEADER)
                        if header_pos == -1:
                            buffer.clear()
                            break
                        if header_pos > 0:
                            buffer = buffer[header_pos:]
                        if len(buffer) < 19:
                            break
                        data_length = struct.unpack("<I", buffer[15:19])[0]
                        total_length = 25 + data_length
                        if len(buffer) < total_length:
                            break
                        packet = bytes(buffer[:total_length])
                        buffer = buffer[total_length:]
                        message = self._parse_message(packet)
                        if message:
                            self._handle_message(message)
                except Exception as exc:
                    if self.running:
                        print(f"❌ 接收数据错误: {exc}")
                    break

        self._listen_thread = threading.Thread(target=loop, daemon=True)
        self._listen_thread.start()
        print("👂 命令监听线程已启动")

    # -- 数据解析 ------------------------------------------------------
    def _parse_message(self, packet: bytes) -> Optional[dict]:
        try:
            if packet[:4] != HEADER or packet[-4:] != FOOTER:
                return None
            offset = 4
            version = packet[offset]
            offset += 1
            timestamp = struct.unpack("<Q", packet[offset:offset + 8])[0]
            offset += 8
            message_type = struct.unpack("<H", packet[offset:offset + 2])[0]
            offset += 2
            data_length = struct.unpack("<I", packet[offset:offset + 4])[0]
            offset += 4
            data_domain = packet[offset:offset + data_length]
            return {
                "version": version,
                "timestamp": timestamp,
                "message_type": message_type,
                "data_domain": data_domain,
            }
        except Exception as exc:
            print(f"❌ 解析消息失败: {exc}")
            return None

    def _handle_message(self, message: dict) -> None:
        message_type = message["message_type"]
        timestamp = datetime.fromtimestamp(message["timestamp"] / 1000)
        data_domain = message["data_domain"]

        print("\n📥 收到协议消息:")
        print(f"  类型: 0x{message_type:04X}")
        print(f"  时间: {timestamp}")
        print(f"  数据长度: {len(data_domain)} 字节")

        if message_type == SEND_MESSAGE_TYPES["VEHICLE_CAMERA_TOGGLE"]:
            toggle = parse_camera_toggle_message(data_domain)
            if toggle:
                print(f"  车辆摄像头开关 -> 车辆 {toggle['vehicle_id']} : {toggle['enabled_name']} ({toggle['enabled']})")
                if toggle["vehicle_id"] == self.vehicle_id:
                    if toggle["enabled"] == 1:
                        self.streamer.start()
                    else:
                        self.streamer.stop()
        else:
            print("  (其他协议解析逻辑略)")

    # -- 辅助功能 ------------------------------------------------------
    def _create_vehicle_info_data(self) -> bytes:
        import random
        data = bytearray()
        data.extend(struct.pack("<B", self.vehicle_id))
        data.extend(struct.pack("<d", random.uniform(0.0, 1.0)))
        data.extend(struct.pack("<d", random.uniform(0.0, 1080.0)))
        data.extend(struct.pack("<d", random.uniform(0.0, 785.0)))
        data.extend(struct.pack("<d", random.uniform(0.0, 360.0)))
        data.extend(struct.pack("<d", random.uniform(20.0, 100.0)))
        data.extend(struct.pack("<B", random.choice([1, 2, 3, 4])))
        data.extend(struct.pack("<d", random.uniform(-540.0, 540.0)))
        data.extend(struct.pack("<B", random.choice(list(range(1, 15)))))
        data.extend(struct.pack("<B", random.choice([0, 1])))
        data.extend(struct.pack("<B", random.choice([0, 1])))
        data.extend(struct.pack("<B", random.choice([0, 1])))
        data.extend(struct.pack("<B", random.choice([0, 0, 0, 1, 2, 3])))
        return bytes(data)

    # -- 生命周期 ------------------------------------------------------
    def close(self) -> None:
        self.disconnect()
        self.streamer.shutdown()


# ----------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="综合测试客户端")
    parser.add_argument("--vehicle-id", type=int, default=1, help="车辆 ID")
    parser.add_argument("--socket-host", type=str, default="127.0.0.1", help="Tauri Socket 服务主机")
    parser.add_argument("--socket-port", type=int, default=8888, help="Tauri Socket 服务端口")
    parser.add_argument("--udp-host", type=str, default="127.0.0.1", help="UDP 视频目标主机")
    parser.add_argument("--udp-port", type=int, default=8080, help="UDP 视频目标端口")
    parser.add_argument("--camera", type=int, default=0, help="摄像头索引 (使用真实摄像头时有效)")
    parser.add_argument("--fps", type=float, default=15.0, help="推流帧率")
    parser.add_argument("--jpeg-quality", type=int, default=70, help="JPEG 质量 1-100")
    parser.add_argument("--use-fake-camera", action="store_true", help="使用虚拟画面代替真实摄像头")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.jpeg_quality < 1 or args.jpeg_quality > 100:
        raise SystemExit("JPEG 质量需要在 1~100 之间")
    if args.fps <= 0:
        raise SystemExit("FPS 必须大于 0")
    if not CV2_AVAILABLE and not args.use_fake_camera:
        print("⚠️ 未检测到 OpenCV，将自动使用虚拟画面 (如需真实摄像头，请安装 opencv-python 并移除 --use-fake-camera)")
        args.use_fake_camera = True

    streamer = CameraStreamer(
        vehicle_id=args.vehicle_id,
        udp_host=args.udp_host,
        udp_port=args.udp_port,
        camera_index=args.camera,
        jpeg_quality=args.jpeg_quality,
        fps=args.fps,
        use_fake_camera=args.use_fake_camera,
    )

    client = TestClient(
        vehicle_id=args.vehicle_id,
        socket_host=args.socket_host,
        socket_port=args.socket_port,
        streamer=streamer,
    )

    print("=" * 60)
    print(f"🚗 综合测试客户端启动 - 车辆 ID: {args.vehicle_id}")
    print(f"   Socket 服务器: {args.socket_host}:{args.socket_port}")
    print(f"   UDP 推流目标: {args.udp_host}:{args.udp_port}")
    print("=" * 60)

    if not client.connect():
        return

    try:
        client.start_heartbeat(interval=10)
        client.start_data_simulation()
        client.listen_for_commands()
        print("按 Ctrl+C 退出")
        while client.running:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n👋 收到中断信号，准备退出...")
    finally:
        client.close()


if __name__ == "__main__":
    main()
