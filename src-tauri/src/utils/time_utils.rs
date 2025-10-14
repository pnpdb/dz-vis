//! 时间处理工具

use chrono::{DateTime, Local, Utc};
use std::time::{SystemTime, UNIX_EPOCH};

/// 获取当前时间戳（微秒）
pub fn current_timestamp_us() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("系统时间异常")
        .as_micros() as u64
}

/// 获取当前时间戳（毫秒）
pub fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("系统时间异常")
        .as_millis() as u64
}

/// 获取当前时间戳（秒）
pub fn current_timestamp_s() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("系统时间异常")
        .as_secs()
}

/// 将时间戳（微秒）转换为DateTime
pub fn timestamp_us_to_datetime(timestamp_us: u64) -> DateTime<Local> {
    let secs = (timestamp_us / 1_000_000) as i64;
    let nanos = ((timestamp_us % 1_000_000) * 1000) as u32;
    
    DateTime::<Utc>::from_timestamp(secs, nanos)
        .expect("时间戳转换失败")
        .with_timezone(&Local)
}

/// 格式化时间戳为字符串（微秒）
pub fn format_timestamp_us(timestamp_us: u64) -> String {
    let dt = timestamp_us_to_datetime(timestamp_us);
    dt.format("%Y-%m-%d %H:%M:%S%.6f").to_string()
}

/// 格式化时间戳为字符串（毫秒）
pub fn format_timestamp_ms(timestamp_ms: u64) -> String {
    let timestamp_us = timestamp_ms * 1000;
    format_timestamp_us(timestamp_us)
}

/// 格式化时间戳为ISO 8601字符串
pub fn format_timestamp_iso(timestamp_us: u64) -> String {
    let dt = timestamp_us_to_datetime(timestamp_us);
    dt.to_rfc3339()
}

/// 计算两个时间戳之间的差值（毫秒）
pub fn timestamp_diff_ms(start_us: u64, end_us: u64) -> i64 {
    ((end_us as i64 - start_us as i64) / 1000) as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_current_timestamp() {
        let ts_us = current_timestamp_us();
        let ts_ms = current_timestamp_ms();
        let ts_s = current_timestamp_s();
        
        assert!(ts_us > 0);
        assert!(ts_ms > 0);
        assert!(ts_s > 0);
        assert!(ts_us / 1000 >= ts_ms - 1); // 允许1ms误差
    }

    #[test]
    fn test_timestamp_diff() {
        let start = 1000000000000; // 某个时间戳
        let end = 1000001000000;   // 1秒后
        assert_eq!(timestamp_diff_ms(start, end), 1000);
    }
}

