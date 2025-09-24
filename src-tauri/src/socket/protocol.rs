use bytes::{Buf, BytesMut};
use crc::{Crc, CRC_16_IBM_SDLC};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

// 协议常量
pub const HEADER: [u8; 4] = [0xEF, 0xEF, 0xEF, 0xEF];
pub const FOOTER: [u8; 4] = [0xFE, 0xFE, 0xFE, 0xFE];
pub const VERSION: u8 = 0x10;
pub const MIN_PACKET_SIZE: usize = 25; // 不包含数据域的最小包大小

// CRC16校验
const CRC16: Crc<u16> = Crc::<u16>::new(&CRC_16_IBM_SDLC);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocketMessage {
    pub timestamp: u64,
    pub message_type: u16,
    pub data: Vec<u8>,
}

#[derive(Debug)]
pub enum ProtocolError {
    InvalidHeader,
    InvalidFooter,
    InvalidVersion,
    InvalidLength,
    InvalidCrc,
    IncompleteData,
    BufferTooSmall,
}

impl std::fmt::Display for ProtocolError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            ProtocolError::InvalidHeader => write!(f, "无效的帧头"),
            ProtocolError::InvalidFooter => write!(f, "无效的帧尾"),
            ProtocolError::InvalidVersion => write!(f, "无效的协议版本"),
            ProtocolError::InvalidLength => write!(f, "无效的数据长度"),
            ProtocolError::InvalidCrc => write!(f, "CRC校验失败"),
            ProtocolError::IncompleteData => write!(f, "数据不完整"),
            ProtocolError::BufferTooSmall => write!(f, "缓冲区太小"),
        }
    }
}

impl std::error::Error for ProtocolError {}

pub struct ProtocolParser {
    buffer: BytesMut,
}

impl ProtocolParser {
    pub fn new() -> Self {
        Self {
            buffer: BytesMut::with_capacity(4096),
        }
    }

    /// 添加接收到的数据到缓冲区
    pub fn feed_data(&mut self, data: &[u8]) {
        self.buffer.extend_from_slice(data);
    }

    /// 尝试解析完整的消息
    pub fn try_parse_message(&mut self) -> Result<Option<SocketMessage>, ProtocolError> {
        if self.buffer.len() < MIN_PACKET_SIZE {
            return Ok(None);
        }

        // 查找帧头
        let header_pos = self.find_header()?;
        if header_pos.is_none() {
            // 没找到帧头，清除无效数据
            self.buffer.clear();
            return Ok(None);
        }

        let header_pos = header_pos.unwrap();
        
        // 移除帧头之前的垃圾数据
        if header_pos > 0 {
            self.buffer.advance(header_pos);
        }

        // 检查是否有足够的数据进行解析
        if self.buffer.len() < MIN_PACKET_SIZE {
            return Ok(None);
        }

        // 解析消息
        match self.parse_packet() {
            Ok(message) => Ok(Some(message)),
            Err(ProtocolError::IncompleteData) => Ok(None),
            Err(e) => {
                // 解析错误，移除当前帧头，继续寻找下一个
                self.buffer.advance(4);
                Err(e)
            }
        }
    }

    /// 查找帧头位置
    fn find_header(&self) -> Result<Option<usize>, ProtocolError> {
        for i in 0..=(self.buffer.len().saturating_sub(4)) {
            if &self.buffer[i..i + 4] == HEADER {
                return Ok(Some(i));
            }
        }
        Ok(None)
    }

    /// 解析数据包
    fn parse_packet(&mut self) -> Result<SocketMessage, ProtocolError> {
        let mut cursor = 0;

        // 验证帧头
        if &self.buffer[cursor..cursor + 4] != HEADER {
            return Err(ProtocolError::InvalidHeader);
        }
        cursor += 4;

        // 验证版本
        if self.buffer[cursor] != VERSION {
            return Err(ProtocolError::InvalidVersion);
        }
        cursor += 1;

        // 解析时间戳 (小端序)
        if self.buffer.len() < cursor + 8 {
            return Err(ProtocolError::IncompleteData);
        }
        let timestamp = u64::from_le_bytes([
            self.buffer[cursor],
            self.buffer[cursor + 1],
            self.buffer[cursor + 2],
            self.buffer[cursor + 3],
            self.buffer[cursor + 4],
            self.buffer[cursor + 5],
            self.buffer[cursor + 6],
            self.buffer[cursor + 7],
        ]);
        cursor += 8;

        // 解析消息类型 (小端序)
        if self.buffer.len() < cursor + 2 {
            return Err(ProtocolError::IncompleteData);
        }
        let message_type = u16::from_le_bytes([
            self.buffer[cursor],
            self.buffer[cursor + 1],
        ]);
        cursor += 2;

        // 解析数据域长度 (小端序)
        if self.buffer.len() < cursor + 4 {
            return Err(ProtocolError::IncompleteData);
        }
        let data_length = u32::from_le_bytes([
            self.buffer[cursor],
            self.buffer[cursor + 1],
            self.buffer[cursor + 2],
            self.buffer[cursor + 3],
        ]) as usize;
        cursor += 4;

        // 检查总包长度
        let total_length = MIN_PACKET_SIZE + data_length;
        if self.buffer.len() < total_length {
            return Err(ProtocolError::IncompleteData);
        }

        // 解析数据域
        let data = if data_length > 0 {
            self.buffer[cursor..cursor + data_length].to_vec()
        } else {
            Vec::new()
        };
        cursor += data_length;

        // 验证CRC (小端序)
        let received_crc = u16::from_le_bytes([
            self.buffer[cursor],
            self.buffer[cursor + 1],
        ]);
        cursor += 2;

        // 计算CRC (从版本字节开始到CRC之前)
        let crc_data = &self.buffer[4..cursor - 2];
        let calculated_crc = CRC16.checksum(crc_data);
        
        if received_crc != calculated_crc {
            return Err(ProtocolError::InvalidCrc);
        }

        // 验证帧尾
        if &self.buffer[cursor..cursor + 4] != FOOTER {
            return Err(ProtocolError::InvalidFooter);
        }
        cursor += 4;

        // 移除已解析的数据
        self.buffer.advance(cursor);

        Ok(SocketMessage {
            timestamp,
            message_type,
            data,
        })
    }
}

/// 构建发送消息
pub fn build_message(message_type: u16, data: &[u8]) -> Vec<u8> {
    let mut packet = Vec::new();
    
    // 帧头
    packet.extend_from_slice(&HEADER);
    
    // 协议版本
    packet.push(VERSION);
    
    // 时间戳 (小端序) - 安全处理系统时间异常
    let timestamp = match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis() as u64,
        Err(_) => {
            // 系统时间异常时使用0作为默认值
            log::warn!("系统时间异常，使用默认时间戳");
            0
        }
    };
    packet.extend_from_slice(&timestamp.to_le_bytes());
    
    // 消息类型 (小端序)
    packet.extend_from_slice(&message_type.to_le_bytes());
    
    // 数据域长度 (小端序)
    packet.extend_from_slice(&(data.len() as u32).to_le_bytes());
    
    // 数据域
    packet.extend_from_slice(data);
    
    // 计算CRC (从版本字节开始)
    let crc_data = &packet[4..];
    let crc = CRC16.checksum(crc_data);
    packet.extend_from_slice(&crc.to_le_bytes());
    
    // 帧尾
    packet.extend_from_slice(&FOOTER);
    
    packet
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_and_parse_message() {
        let test_data = b"Hello, World!";
        let packet = build_message(0x0001, test_data);
        
        let mut parser = ProtocolParser::new();
        parser.feed_data(&packet);
        
        let result = parser.try_parse_message().unwrap();
        assert!(result.is_some());
        
        let message = result.unwrap();
        assert_eq!(message.message_type, 0x0001);
        assert_eq!(message.data, test_data);
    }
}
