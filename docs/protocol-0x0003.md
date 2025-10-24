# 0x0003 路径文件选择协议

## 协议概述

**协议ID**: `0x0003`  
**方向**: 车端 → 服务端  
**用途**: 车辆向服务端发送选择的路径文件编号列表

## 数据格式

### 数据域结构（动态长度）

| 字段名称 | 字节偏移 | 字节长度 | 数据类型 | 说明 |
|---------|---------|---------|---------|------|
| 车辆编号 | 0 | 1 | UINT8 | 发送路径选择的车辆ID |
| 路径文件编号1 | 1 | 1 | UINT8 | 第1个地图txt文件编号 |
| 路径文件编号2 | 2 | 1 | UINT8 | 第2个地图txt文件编号 |
| ... | ... | 1 | UINT8 | 更多地图txt文件编号 |
| 路径文件编号N | N | 1 | UINT8 | 第N个地图txt文件编号 |

**数据域总长度**: `1 + N` 字节  
其中 N 为路径文件数量（可以为 0）

## 示例

### 示例 1：车辆1选择了3个路径文件
```
数据域（十六进制）: 01 03 05 07
解析结果:
  - 车辆ID: 1
  - 路径文件编号: [3, 5, 7]
```

### 示例 2：车辆2选择了1个路径文件
```
数据域（十六进制）: 02 0A
解析结果:
  - 车辆ID: 2
  - 路径文件编号: [10]
```

### 示例 3：车辆3清空路径选择
```
数据域（十六进制）: 03
解析结果:
  - 车辆ID: 3
  - 路径文件编号: []
```

## 代码实现

### Rust 数据结构

```rust
/// 路径文件选择数据（0x0003）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathFileSelectionData {
    /// 车辆ID
    pub vehicle_id: u8,
    /// 路径文件编号列表
    pub path_file_ids: Vec<u8>,
}
```

### 解析逻辑

```rust
fn parse_path_file_selection(&mut self, data: &[u8]) -> Result<ParsedProtocolData, ProtocolError> {
    // 至少需要1个字节（车辆编号）
    if data.is_empty() {
        return Err(ProtocolError::InsufficientData {
            required: 1,
            actual: data.len(),
        });
    }
    
    // 第一个字节是车辆编号
    let vehicle_id = data[0];
    
    // 剩余的字节都是路径文件编号
    let path_file_ids: Vec<u8> = data[1..].to_vec();
    
    let path_selection = PathFileSelectionData {
        vehicle_id,
        path_file_ids,
    };
    
    Ok(ParsedProtocolData::PathFileSelection(path_selection))
}
```

## 注意事项

1. **动态长度**: 数据域长度不固定，取决于路径文件的数量
2. **最小长度**: 1字节（只有车辆编号，无路径文件）
3. **最大长度**: 理论上 256 字节（1个车辆ID + 255个路径文件编号）
4. **路径编号范围**: 0-255（UINT8）

## 修改历史

- **2025-10-24**: 将 0x0003 从"车辆控制反馈协议"修正为"路径文件选择协议"
  - 更新了协议名称
  - 修改了数据结构定义
  - 重写了解析逻辑

