# 车载摄像头 UDP 视频协议

## 协议概览
- **用途**：通过 UDP 推送 JPEG 帧给桌面端，适配车载摄像头实时画面
- **传输模式**：单帧小于 MTU 时直接发送；超过 MTU 自动分片
- **编码格式**：JPEG
- **监听端口**：默认 `0.0.0.0:8080`（可在环境变量 `DZ_VIZ_UDP_VIDEO_PORT` 中调整）

## 数据包布局
```
[包头 23 字节][帧数据 N 字节]
```

### 包头结构（23 字节）
| 偏移 | 长度 | 字段 | 类型 | 说明 |
|------|------|------|------|------|
| 0    | 1    | version         | `u8`  | 协议版本，当前固定为 `1` |
| 1    | 1    | frame_type      | `u8`  | 帧类型：`0x01` 完整帧、`0x02` 分片首帧、`0x03` 分片中间帧、`0x04` 分片尾帧 |
| 2    | 1    | vehicle_id      | `u8`  | 车辆 ID |
| 3    | 4    | frame_id        | `u32` | 帧序号（小端序），用于重组 |
| 7    | 2    | fragment_index  | `u16` | 分片索引，首片为 `0`（小端序）|
| 9    | 2    | total_fragments | `u16` | 总分片数（小端序），完整帧为 `1`|
| 11   | 8    | timestamp       | `u64` | 毫秒时间戳（小端序）|
| 19   | 4    | data_length     | `u32` | 当前分片载荷长度（小端序）|

### 帧类型枚举
| 数值 | 名称 | 说明 |
|------|------|------|
|0x01|Complete| 整帧（不分片）|
|0x02|FragmentFirst| 分片首帧 |
|0x03|FragmentMiddle| 分片中间帧 |
|0x04|FragmentLast| 分片尾帧 |

## 发送端规则
- **完整帧**：当 `JPEG` 长度≤（MTU1400-26）时，使用 `frame_type=0x01`，`fragment_index=0`，`total_fragments=1`
- **分片帧**：当帧大小超限时
  1. 将 JPEG 数据按 (最大负载 = 1400 - 26) 切片
  2. 每片独立发送，`fragment_index` 从 `0` 递增
  3. 首片 `frame_type=0x02`，尾片 `frame_type=0x04`，其余 `0x03`
  4. 所有分片携带相同的 `vehicle_id` 与 `frame_id`
  5. `data_length` 填写当前分片真实载荷字节数

伪代码示例（参见 `test_udp_camera_sender.py`）：
```python
header = struct.pack('<BBBIHHQI', version, frame_type,
                     vehicle_id & 0xFF, frame_id,
                     fragment_index, total_fragments,
                     timestamp_ms, len(fragment_data))
socket.sendto(header + fragment_data, target_addr)
```

## 接收端逻辑（桌面端 Tauri）
- 监听 UDP 并解析包头
- `frame_type=0x01`：直接将 `data` 解码为 JPEG
- 分片帧：按照 `(vehicle_id, frame_id)` 维护缓存
  1. 缓存所有分片，直至 `fragment_index` 收齐
  2. 超过 5 秒未收齐的帧会自动清理
  3. 重组完成后拼接数据，转换为 `base64` 并通过事件 `udp-video-frame` 推送给前端

Rust 关键逻辑：`src-tauri/src/udp_video/server.rs` 中 `handle_packet`、`handle_fragment`、`FrameAssembler`。

## 示例
### 完整帧（示意）
```
01 01 00 00 00 7B 00 00 01 C8 00 00 00 01 00 00 00 00 49 96 02 D2 00 00 04 00 | JPEG 1024B
```
### 分片帧
第一片
```
01 02 00 00 00 7B 00 00 01 C9 00 00 00 03 00 00 00 00 49 96 02 D3 00 00 05 DC | JPEG 1500B
```
中间片
```
01 03 ... (fragment_index=1) ...
```
最后片
```
01 04 ... (fragment_index=2) data_length=512 ...
```

## 其他
- 默认 JPEG 质量建议 70~80，用于平衡带宽和画质
- 可通过 `DZ_VIZ_UDP_VIDEO_PORT` 环境变量调整 UDP 端口
- 主干逻辑详见：`src-tauri/src/udp_video/protocol.rs`、`src-tauri/src/udp_video/server.rs`
