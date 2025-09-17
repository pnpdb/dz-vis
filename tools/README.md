# UDP视频流工具

## udp_camera_sender.py - UDP摄像头发送器

### 功能
使用OpenCV捕获本地摄像头画面，编码为JPEG格式，并通过UDP协议发送到指定服务器。

### 依赖
```bash
pip install opencv-python
```

### 使用方法

#### 基本用法
```bash
python udp_camera_sender.py
```

#### 完整参数
```bash
python udp_camera_sender.py \
    --vehicle-id 123 \
    --host 127.0.0.1 \
    --port 8080 \
    --camera 0 \
    --quality 70 \
    --fps 15 \
    --duration 60
```

### 参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--vehicle-id` | 1 | 车辆ID，用于标识数据来源 |
| `--host` | 127.0.0.1 | UDP服务器地址 |
| `--port` | 8080 | UDP服务器端口 |
| `--camera` | 0 | 摄像头设备索引（0为默认摄像头） |
| `--quality` | 70 | JPEG压缩质量（1-100，越高质量越好但文件越大） |
| `--fps` | 10.0 | 目标发送帧率 |
| `--duration` | 无限 | 运行时长（秒），不指定则持续运行 |

### 使用示例

#### 1. 测试本地连接
```bash
# 启动Rust UDP服务器（端口8080）
python udp_camera_sender.py --port 8080
```

#### 2. 模拟车辆123发送视频
```bash
python udp_camera_sender.py --vehicle-id 123 --quality 80 --fps 15
```

#### 3. 发送到远程服务器
```bash
python udp_camera_sender.py --host 192.168.1.100 --port 8080
```

#### 4. 高质量短时间测试
```bash
python udp_camera_sender.py --quality 90 --fps 20 --duration 30
```

### 操作说明

- **启动后**：会显示摄像头预览窗口
- **停止发送**：按 `Ctrl+C` 或在预览窗口按 `q` 键
- **调试信息**：终端会显示发送的帧信息和统计

### 协议说明

本工具实现了完整的UDP视频流协议：
- 支持完整帧和分片帧传输
- 自动处理大于MTU的帧分片
- 包含车辆ID、帧ID、时间戳等完整协议信息
- 详细协议格式请参考 `docs/frame.md`

### 故障排除

1. **摄像头无法打开**
   - 检查摄像头是否被其他程序占用
   - 尝试不同的摄像头索引（0, 1, 2...）

2. **网络连接问题**
   - 确认UDP服务器已启动
   - 检查防火墙设置
   - 验证IP地址和端口号

3. **帧率过低**
   - 降低JPEG质量
   - 减少目标帧率
   - 检查网络带宽

4. **画质问题**
   - 调整`--quality`参数（70-90推荐）
   - 检查摄像头分辨率设置
