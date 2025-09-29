
/// UDP视频流协议版本
pub const PROTOCOL_VERSION: u8 = 1;

/// 帧类型
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum FrameType {
    /// 完整帧（小于MTU的帧）
    Complete = 0x01,
    /// 分片帧的第一片
    FragmentFirst = 0x02,
    /// 分片帧的中间片
    FragmentMiddle = 0x03,
    /// 分片帧的最后一片
    FragmentLast = 0x04,
}

impl From<u8> for FrameType {
    fn from(value: u8) -> Self {
        match value {
            0x01 => FrameType::Complete,
            0x02 => FrameType::FragmentFirst,
            0x03 => FrameType::FragmentMiddle,
            0x04 => FrameType::FragmentLast,
            _ => FrameType::Complete, // 默认值
        }
    }
}

/// UDP视频包头结构
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct VideoPacketHeader {
    /// 协议版本
    pub version: u8,
    /// 帧类型
    pub frame_type: FrameType,
    /// 车辆ID
    pub vehicle_id: u8,
    /// 帧ID
    pub frame_id: u32,
    /// 分片索引（从0开始）
    pub fragment_index: u16,
    /// 总分片数
    pub total_fragments: u16,
    /// 时间戳（毫秒）
    pub timestamp: u64,
    /// JPEG数据长度
    pub data_length: u32,
}

impl VideoPacketHeader {
    /// 包头长度（字节）
    pub const HEADER_SIZE: usize = 23;

    /// 创建完整帧包头
    #[allow(dead_code)]
    pub fn new_complete_frame(vehicle_id: u8, frame_id: u32, timestamp: u64, data_length: u32) -> Self {
        Self {
            version: PROTOCOL_VERSION,
            frame_type: FrameType::Complete,
            vehicle_id,
            frame_id,
            fragment_index: 0,
            total_fragments: 1,
            timestamp,
            data_length,
        }
    }

    /// 创建分片帧包头
    #[allow(dead_code)]
    pub fn new_fragment_frame(
        vehicle_id: u8,
        frame_id: u32,
        fragment_index: u16,
        total_fragments: u16,
        timestamp: u64,
        data_length: u32,
        is_first: bool,
        is_last: bool,
    ) -> Self {
        let frame_type = if is_first {
            FrameType::FragmentFirst
        } else if is_last {
            FrameType::FragmentLast
        } else {
            FrameType::FragmentMiddle
        };

        Self {
            version: PROTOCOL_VERSION,
            frame_type,
            vehicle_id,
            frame_id,
            fragment_index,
            total_fragments,
            timestamp,
            data_length,
        }
    }

    /// 序列化包头为字节数组
    #[allow(dead_code)]
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(Self::HEADER_SIZE);
        
        bytes.push(self.version);
        bytes.push(self.frame_type as u8);
        bytes.push(self.vehicle_id);
        bytes.extend_from_slice(&self.frame_id.to_le_bytes());
        bytes.extend_from_slice(&self.fragment_index.to_le_bytes());
        bytes.extend_from_slice(&self.total_fragments.to_le_bytes());
        bytes.extend_from_slice(&self.timestamp.to_le_bytes());
        bytes.extend_from_slice(&self.data_length.to_le_bytes());
        
        bytes
    }

    /// 从字节数组反序列化包头
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() < Self::HEADER_SIZE {
            return Err(format!("Invalid header size: expected {}, got {}", Self::HEADER_SIZE, bytes.len()));
        }

        let version = bytes[0];
        if version != PROTOCOL_VERSION {
            return Err(format!("Unsupported protocol version: {}", version));
        }

        let frame_type = FrameType::from(bytes[1]);
        let vehicle_id = bytes[2];
        let frame_id = u32::from_le_bytes([bytes[3], bytes[4], bytes[5], bytes[6]]);
        let fragment_index = u16::from_le_bytes([bytes[7], bytes[8]]);
        let total_fragments = u16::from_le_bytes([bytes[9], bytes[10]]);
        let timestamp = u64::from_le_bytes([
            bytes[11], bytes[12], bytes[13], bytes[14],
            bytes[15], bytes[16], bytes[17], bytes[18],
        ]);
        
        let data_length = u32::from_le_bytes([bytes[19], bytes[20], bytes[21], bytes[22]]);

        Ok(Self {
            version,
            frame_type,
            vehicle_id,
            frame_id,
            fragment_index,
            total_fragments,
            timestamp,
            data_length,
        })
    }
}

/// UDP视频数据包
#[derive(Debug, Clone)]
pub struct VideoPacket {
    pub header: VideoPacketHeader,
    pub data: Vec<u8>,
}

impl VideoPacket {
    /// 创建完整的UDP包（包头 + 数据）
    #[allow(dead_code)]
    pub fn to_udp_packet(&self) -> Vec<u8> {
        let mut packet = self.header.to_bytes();
        packet.extend_from_slice(&self.data);
        packet
    }

    /// 从UDP包解析
    pub fn from_udp_packet(packet: &[u8]) -> Result<Self, String> {
        if packet.len() < VideoPacketHeader::HEADER_SIZE {
            return Err("Packet too small".to_string());
        }

        let header = VideoPacketHeader::from_bytes(&packet[..VideoPacketHeader::HEADER_SIZE])?;
        let data = packet[VideoPacketHeader::HEADER_SIZE..].to_vec();

        // 验证数据长度
        if data.len() != header.data_length as usize {
            return Err(format!(
                "Data length mismatch: expected {}, got {}",
                header.data_length,
                data.len()
            ));
        }

        Ok(Self { header, data })
    }
}

/// 帧重组器
#[derive(Debug)]
pub struct FrameAssembler {
    pub fragments: std::collections::HashMap<u16, Vec<u8>>,
    pub expected_fragments: u16,
    pub frame_id: u32,
    pub vehicle_id: u8,
    pub timestamp: u64,
}

impl FrameAssembler {
    pub fn new(header: &VideoPacketHeader) -> Self {
        Self {
            fragments: std::collections::HashMap::new(),
            expected_fragments: header.total_fragments,
            frame_id: header.frame_id,
            vehicle_id: header.vehicle_id,
            timestamp: header.timestamp,
        }
    }

    /// 添加分片
    pub fn add_fragment(&mut self, header: &VideoPacketHeader, data: Vec<u8>) -> bool {
        // 验证帧信息是否匹配
        if header.frame_id != self.frame_id || header.vehicle_id != self.vehicle_id {
            return false;
        }

        self.fragments.insert(header.fragment_index, data);
        
        // 检查是否所有分片都已收到
        self.fragments.len() == self.expected_fragments as usize
    }

    /// 组装完整帧
    pub fn assemble_frame(&self) -> Option<Vec<u8>> {
        if self.fragments.len() != self.expected_fragments as usize {
            return None;
        }

        let mut frame_data = Vec::new();
        for i in 0..self.expected_fragments {
            if let Some(fragment) = self.fragments.get(&i) {
                frame_data.extend_from_slice(fragment);
            } else {
                return None; // 缺少分片
            }
        }

        Some(frame_data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_header_serialization() {
        let header = VideoPacketHeader::new_complete_frame(123, 456, 1234567890, 1024);
        let bytes = header.to_bytes();
        let decoded = VideoPacketHeader::from_bytes(&bytes).unwrap();

        assert_eq!(header.version, decoded.version);
        assert_eq!(header.frame_type as u8, decoded.frame_type as u8);
        assert_eq!(header.vehicle_id, decoded.vehicle_id);
        assert_eq!(header.frame_id, decoded.frame_id);
        assert_eq!(header.timestamp, decoded.timestamp);
        assert_eq!(header.data_length, decoded.data_length);
    }

    #[test]
    fn test_packet_creation() {
        let data = vec![1, 2, 3, 4, 5];
        let header = VideoPacketHeader::new_complete_frame(1, 1, 1000, data.len() as u32);
        let packet = VideoPacket { header, data: data.clone() };
        
        let udp_packet = packet.to_udp_packet();
        let decoded_packet = VideoPacket::from_udp_packet(&udp_packet).unwrap();
        
        assert_eq!(packet.data, decoded_packet.data);
        assert_eq!(packet.header.vehicle_id, decoded_packet.header.vehicle_id);
    }
}
