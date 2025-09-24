//! JPEG格式验证器
//! 
//! 提供高效的JPEG文件头验证和基本格式检查

use crate::video_processing::types::{VideoProcessingError, current_timestamp_us};

/// JPEG格式验证器
pub struct JpegValidator;

impl JpegValidator {
    /// JPEG文件头标识符
    const JPEG_SOI: [u8; 2] = [0xFF, 0xD8]; // Start of Image
    const JPEG_EOI: [u8; 2] = [0xFF, 0xD9]; // End of Image
    
    /// 常见的JPEG标记
    const JPEG_APP0: [u8; 2] = [0xFF, 0xE0]; // JFIF
    const JPEG_APP1: [u8; 2] = [0xFF, 0xE1]; // EXIF
    const JPEG_DQT: [u8; 2] = [0xFF, 0xDB];  // Define Quantization Table
    const JPEG_SOF0: [u8; 2] = [0xFF, 0xC0]; // Start of Frame (Baseline DCT)
    
    /// 验证数据是否为有效的JPEG格式
    /// 
    /// # Arguments
    /// * `data` - 待验证的二进制数据
    /// 
    /// # Returns
    /// * `Ok(validation_time_us)` - 验证成功，返回验证耗时（微秒）
    /// * `Err(VideoProcessingError)` - 验证失败
    pub fn validate_jpeg(data: &[u8]) -> Result<u64, VideoProcessingError> {
        let start_time = current_timestamp_us();
        
        // 基本长度检查
        if data.is_empty() {
            return Err(VideoProcessingError::EmptyData);
        }
        
        if data.len() < 4 {
            return Err(VideoProcessingError::InvalidJpegFormat(
                "数据长度不足，无法包含JPEG头".to_string()
            ));
        }
        
        // 检查JPEG文件头（SOI - Start of Image）
        if &data[0..2] != &Self::JPEG_SOI {
            return Err(VideoProcessingError::InvalidJpegFormat(
                format!("无效的JPEG文件头: {:02X} {:02X}，期望: FF D8", data[0], data[1])
            ));
        }
        
        // 快速检查：寻找JPEG结束标记（EOI）
        let has_eoi = Self::find_eoi_marker(data);
        if !has_eoi {
            // 对于流式传输，可能没有EOI标记，这是可接受的
            log::debug!("JPEG数据中未找到EOI标记，可能是流式数据");
        }
        
        // 验证JPEG结构的基本完整性
        Self::validate_jpeg_structure(data)?;
        
        let validation_time = current_timestamp_us() - start_time;
        Ok(validation_time)
    }
    
    /// 快速验证JPEG头（仅检查SOI标记）
    /// 
    /// 用于高频率调用的场景，性能优先
    pub fn quick_validate_jpeg_header(data: &[u8]) -> bool {
        data.len() >= 2 && &data[0..2] == &Self::JPEG_SOI
    }
    
    /// 查找JPEG结束标记
    fn find_eoi_marker(data: &[u8]) -> bool {
        if data.len() < 2 {
            return false;
        }
        
        // 从后往前查找，EOI通常在文件末尾
        for i in (1..data.len()).rev() {
            if data[i-1] == 0xFF && data[i] == 0xD9 {
                return true;
            }
        }
        false
    }
    
    /// 验证JPEG结构的基本完整性
    fn validate_jpeg_structure(data: &[u8]) -> Result<(), VideoProcessingError> {
        if data.len() < 4 {
            return Ok(()); // 太短的数据跳过结构验证
        }
        
        let mut pos = 2; // 跳过SOI标记
        let mut found_valid_marker = false;
        
        // 查找前几个标记以验证基本结构
        while pos + 1 < data.len() && pos < 100 { // 只检查前100字节
            if data[pos] == 0xFF {
                let marker = data[pos + 1];
                
                // 检查是否为有效的JPEG标记
                match marker {
                    0xE0..=0xEF => { // APPn segments
                        found_valid_marker = true;
                        // 读取段长度并跳过
                        if pos + 3 < data.len() {
                            let length = u16::from_be_bytes([data[pos + 2], data[pos + 3]]);
                            pos += length as usize + 2;
                        } else {
                            break;
                        }
                    },
                    0xDB => { // DQT - Define Quantization Table
                        found_valid_marker = true;
                        break;
                    },
                    0xC0..=0xCF => { // SOF - Start of Frame
                        found_valid_marker = true;
                        break;
                    },
                    0xD8 => { // SOI - 不应该在这里出现
                        return Err(VideoProcessingError::InvalidJpegFormat(
                            "发现重复的SOI标记".to_string()
                        ));
                    },
                    _ => {
                        pos += 1; // 继续查找
                    }
                }
            } else {
                pos += 1;
            }
        }
        
        if !found_valid_marker {
            log::debug!("未在JPEG数据前100字节中找到有效标记，但仍接受该数据");
        }
        
        Ok(())
    }
    
    /// 提取JPEG基本信息（如果可能）
    pub fn extract_jpeg_info(data: &[u8]) -> Option<JpegInfo> {
        if !Self::quick_validate_jpeg_header(data) {
            return None;
        }
        
        let mut info = JpegInfo {
            width: 0,
            height: 0,
            has_eoi: Self::find_eoi_marker(data),
            estimated_quality: 0,
        };
        
        // 尝试查找SOF标记以获取图像尺寸
        let mut pos = 2; // 跳过SOI
        while pos + 8 < data.len() && pos < 1000 { // 限制搜索范围
            if data[pos] == 0xFF && (data[pos + 1] & 0xF0) == 0xC0 {
                // 找到SOF标记
                if pos + 7 < data.len() {
                    info.height = u16::from_be_bytes([data[pos + 5], data[pos + 6]]);
                    info.width = u16::from_be_bytes([data[pos + 7], data[pos + 8]]);
                    break;
                }
            }
            pos += 1;
        }
        
        Some(info)
    }
}

/// JPEG文件基本信息
#[derive(Debug, Clone)]
pub struct JpegInfo {
    pub width: u16,
    pub height: u16,
    pub has_eoi: bool,
    pub estimated_quality: u8,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_valid_jpeg_header() {
        let valid_jpeg = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]; // 简单的JPEG头
        assert!(JpegValidator::quick_validate_jpeg_header(&valid_jpeg));
        assert!(JpegValidator::validate_jpeg(&valid_jpeg).is_ok());
    }
    
    #[test]
    fn test_invalid_jpeg_header() {
        let invalid_data = vec![0x00, 0x00, 0xFF, 0xD8]; // 错误的开头
        assert!(!JpegValidator::quick_validate_jpeg_header(&invalid_data));
        assert!(JpegValidator::validate_jpeg(&invalid_data).is_err());
    }
    
    #[test]
    fn test_empty_data() {
        let empty_data = vec![];
        assert!(!JpegValidator::quick_validate_jpeg_header(&empty_data));
        assert!(JpegValidator::validate_jpeg(&empty_data).is_err());
    }
    
    #[test]
    fn test_short_data() {
        let short_data = vec![0xFF];
        assert!(!JpegValidator::quick_validate_jpeg_header(&short_data));
        assert!(JpegValidator::validate_jpeg(&short_data).is_err());
    }
}
