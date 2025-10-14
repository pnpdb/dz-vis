//! 数据验证工具

use std::net::Ipv4Addr;

/// 验证IP地址格式
pub fn is_valid_ip(ip: &str) -> bool {
    ip.parse::<Ipv4Addr>().is_ok()
}

/// 验证是否为私有IP地址
pub fn is_private_ip(ip: &str) -> bool {
    match ip.parse::<Ipv4Addr>() {
        Ok(addr) => {
            let octets = addr.octets();
            // 10.0.0.0/8
            octets[0] == 10
                // 172.16.0.0/12
                || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
                // 192.168.0.0/16
                || (octets[0] == 192 && octets[1] == 168)
                // 169.254.0.0/16 (APIPA)
                || (octets[0] == 169 && octets[1] == 254)
        }
        Err(_) => false,
    }
}

/// 验证端口号范围
pub fn is_valid_port(port: u16) -> bool {
    port > 0 // port <= 65535 总是为真（u16最大值就是65535）
}

/// 验证数字是否在范围内
pub fn is_in_range<T: PartialOrd>(value: T, min: T, max: T) -> bool {
    value >= min && value <= max
}

/// 验证车辆ID范围
pub fn is_valid_vehicle_id(id: u8) -> bool {
    is_in_range(id, 1, 255)
}

/// 验证速度范围（m/s）
pub fn is_valid_speed(speed: f64) -> bool {
    is_in_range(speed, 0.0, 10.0) // 假设最大速度10m/s
}

/// 验证电池电量范围
pub fn is_valid_battery(battery: f64) -> bool {
    is_in_range(battery, 0.0, 100.0)
}

/// 验证方向盘角度范围（度）
pub fn is_valid_steering_angle(angle: f64) -> bool {
    is_in_range(angle, -180.0, 180.0)
}

/// 验证字符串是否为空或仅包含空白字符
pub fn is_blank(s: &str) -> bool {
    s.trim().is_empty()
}

/// 验证字符串长度范围
pub fn is_valid_length(s: &str, min: usize, max: usize) -> bool {
    let len = s.len();
    len >= min && len <= max
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ip_validation() {
        assert!(is_valid_ip("192.168.1.1"));
        assert!(is_valid_ip("10.0.0.1"));
        assert!(!is_valid_ip("256.1.1.1"));
        assert!(!is_valid_ip("invalid"));
    }

    #[test]
    fn test_private_ip() {
        assert!(is_private_ip("192.168.1.1"));
        assert!(is_private_ip("10.0.0.1"));
        assert!(is_private_ip("172.16.0.1"));
        assert!(!is_private_ip("8.8.8.8"));
    }

    #[test]
    fn test_range_validation() {
        assert!(is_in_range(5, 1, 10));
        assert!(!is_in_range(15, 1, 10));
        assert!(is_valid_battery(50.0));
        assert!(!is_valid_battery(150.0));
    }

    #[test]
    fn test_string_validation() {
        assert!(is_blank(""));
        assert!(is_blank("   "));
        assert!(!is_blank("hello"));
        assert!(is_valid_length("test", 1, 10));
        assert!(!is_valid_length("test", 5, 10));
    }
}

