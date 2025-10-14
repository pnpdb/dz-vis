//! 字节数组处理工具

/// 将字节数组转换为十六进制字符串
/// 格式: "01 23 45 67 89 AB CD EF"
pub fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(" ")
}

/// 将字节数组转换为十六进制字符串（小写，无空格）
/// 格式: "0123456789abcdef"
pub fn bytes_to_hex_compact(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// 将十六进制字符串转换为字节数组
/// 支持格式: "01 23 45" 或 "012345"
pub fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, String> {
    let hex_clean = hex.replace(' ', "");
    
    if hex_clean.len() % 2 != 0 {
        return Err("十六进制字符串长度必须是偶数".to_string());
    }
    
    (0..hex_clean.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&hex_clean[i..i + 2], 16)
                .map_err(|e| format!("无效的十六进制字符: {}", e))
        })
        .collect()
}

/// 字节数组切片辅助函数（安全版本）
pub fn safe_slice(data: &[u8], offset: usize, len: usize) -> Result<&[u8], String> {
    if offset + len > data.len() {
        return Err(format!(
            "切片越界: offset={}, len={}, data.len()={}",
            offset,
            len,
            data.len()
        ));
    }
    Ok(&data[offset..offset + len])
}

/// 从字节数组中读取u8
pub fn read_u8(data: &[u8], offset: usize) -> Result<u8, String> {
    data.get(offset)
        .copied()
        .ok_or_else(|| format!("读取u8失败: offset={} 超出范围", offset))
}

/// 从字节数组中读取u16（小端序）
pub fn read_u16_le(data: &[u8], offset: usize) -> Result<u16, String> {
    let bytes = safe_slice(data, offset, 2)?;
    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
}

/// 从字节数组中读取u32（小端序）
pub fn read_u32_le(data: &[u8], offset: usize) -> Result<u32, String> {
    let bytes = safe_slice(data, offset, 4)?;
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

/// 从字节数组中读取f64（小端序）
pub fn read_f64_le(data: &[u8], offset: usize) -> Result<f64, String> {
    let bytes = safe_slice(data, offset, 8)?;
    let mut arr = [0u8; 8];
    arr.copy_from_slice(bytes);
    Ok(f64::from_le_bytes(arr))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bytes_to_hex() {
        let bytes = vec![0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF];
        assert_eq!(bytes_to_hex(&bytes), "01 23 45 67 89 AB CD EF");
        assert_eq!(bytes_to_hex_compact(&bytes), "0123456789abcdef");
    }

    #[test]
    fn test_hex_to_bytes() {
        assert_eq!(
            hex_to_bytes("01 23 45").unwrap(),
            vec![0x01, 0x23, 0x45]
        );
        assert_eq!(hex_to_bytes("012345").unwrap(), vec![0x01, 0x23, 0x45]);
    }

    #[test]
    fn test_safe_slice() {
        let data = vec![1, 2, 3, 4, 5];
        assert_eq!(safe_slice(&data, 1, 3).unwrap(), &[2, 3, 4]);
        assert!(safe_slice(&data, 3, 5).is_err());
    }
}

