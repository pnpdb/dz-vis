//! 批量协议处理器
//! 
//! 提供高效的批量协议处理功能，支持并行处理和流式处理

use crate::protocol_processing::types::*;
use crate::protocol_processing::{ProtocolParser, ProtocolValidator, DataConverter};
use std::sync::{Arc, RwLock};
use std::thread;
use std::sync::mpsc;

/// 批量协议处理器
pub struct BatchProcessor {
    /// 协议解析器池
    parser_pool: Vec<ProtocolParser>,
    /// 协议验证器池
    validator_pool: Vec<ProtocolValidator>,
    /// 数据转换器池
    converter_pool: Vec<DataConverter>,
    /// 工作线程数量
    worker_count: usize,
    /// 批处理统计（使用 RwLock 提高读取性能）
    stats: Arc<RwLock<BatchProcessingStats>>,
}

/// 批处理统计信息
#[derive(Debug, Clone)]
pub struct BatchProcessingStats {
    /// 总处理任务数
    pub total_tasks: u64,
    /// 成功处理任务数
    pub successful_tasks: u64,
    /// 失败处理任务数
    pub failed_tasks: u64,
    /// 总处理时间（微秒）
    pub total_time_us: u64,
    /// 平均处理时间（微秒）
    pub average_time_us: f64,
    /// 吞吐量（任务/秒）
    pub throughput: f64,
    /// 并行效率
    pub parallel_efficiency: f64,
}

/// 批处理任务
#[derive(Debug, Clone)]
pub struct BatchTask {
    /// 任务ID
    pub task_id: u64,
    /// 消息类型
    pub message_type: u16,
    /// 原始数据
    pub data: Vec<u8>,
    /// 任务优先级
    pub priority: TaskPriority,
}

/// 任务优先级
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum TaskPriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

/// 批处理结果
#[derive(Debug, Clone)]
pub struct BatchTaskResult {
    /// 任务ID
    pub task_id: u64,
    /// 处理结果
    pub result: Result<ParsedProtocolData, String>,
    /// 处理时间（微秒）
    pub processing_time_us: u64,
}

impl BatchProcessor {
    /// 创建新的批量处理器
    pub fn new(worker_count: usize) -> Self {
        let mut parser_pool = Vec::with_capacity(worker_count);
        let mut validator_pool = Vec::with_capacity(worker_count);
        let mut converter_pool = Vec::with_capacity(worker_count);
        
        for _ in 0..worker_count {
            parser_pool.push(ProtocolParser::new(false));
            validator_pool.push(ProtocolValidator::default());
            converter_pool.push(DataConverter::new());
        }
        
        Self {
            parser_pool,
            validator_pool,
            converter_pool,
            worker_count,
            stats: Arc::new(RwLock::new(BatchProcessingStats {
                total_tasks: 0,
                successful_tasks: 0,
                failed_tasks: 0,
                total_time_us: 0,
                average_time_us: 0.0,
                throughput: 0.0,
                parallel_efficiency: 0.0,
            })),
        }
    }
    
    /// 批量处理协议数据
    pub fn process_batch(&mut self, tasks: Vec<BatchTask>) -> BatchProcessingResult {
        let start_time = current_timestamp_us();
        let task_count = tasks.len();
        
        if task_count == 0 {
            return BatchProcessingResult {
                success_count: 0,
                error_count: 0,
                total_time_us: 0,
                average_time_us: 0.0,
                results: vec![],
            };
        }
        
        // 按优先级排序任务
        let mut sorted_tasks = tasks;
        sorted_tasks.sort_by(|a, b| b.priority.cmp(&a.priority));
        
        // 分配任务到工作线程
        let chunk_size = (task_count + self.worker_count - 1) / self.worker_count;
        let task_chunks: Vec<_> = sorted_tasks.chunks(chunk_size).collect();
        
        let (tx, rx) = mpsc::channel();
        let mut handles = Vec::new();
        
        // 启动工作线程
        for (worker_id, chunk) in task_chunks.into_iter().enumerate() {
            let chunk = chunk.to_vec();
            let tx = tx.clone();
            let stats = Arc::clone(&self.stats);
            
            // 为每个线程创建处理器实例
            let mut parser = ProtocolParser::new(false);
            let mut validator = ProtocolValidator::default();
            let mut converter = DataConverter::new();
            
            let handle = thread::spawn(move || {
                let mut results = Vec::new();
                
                for task in chunk {
                    let task_start = current_timestamp_us();
                    
                    // 处理单个任务
                    let result = Self::process_single_task(&mut parser, &mut validator, &mut converter, &task);
                    
                    let processing_time = current_timestamp_us() - task_start;
                    
                    results.push(BatchTaskResult {
                        task_id: task.task_id,
                        result,
                        processing_time_us: processing_time,
                    });
                    
                    // 更新统计信息
                    {
                        let mut stats_guard = stats.write().unwrap();
                        stats_guard.total_tasks += 1;
                        stats_guard.total_time_us += processing_time;
                    }
                }
                
                tx.send((worker_id, results)).unwrap();
            });
            
            handles.push(handle);
        }
        
        drop(tx); // 关闭发送端
        
        // 收集结果
        let mut all_results = Vec::new();
        let mut success_count = 0;
        let mut error_count = 0;
        
        for _ in 0..handles.len() {
            if let Ok((_, results)) = rx.recv() {
                for result in results {
                    match &result.result {
                        Ok(_) => success_count += 1,
                        Err(_) => error_count += 1,
                    }
                    all_results.push(result);
                }
            }
        }
        
        // 等待所有线程完成
        for handle in handles {
            handle.join().unwrap();
        }
        
        let total_time = current_timestamp_us() - start_time;
        let average_time = if task_count > 0 {
            total_time as f64 / task_count as f64
        } else {
            0.0
        };
        
        // 更新批处理统计
        {
            let mut stats_guard = self.stats.write().unwrap();
            stats_guard.successful_tasks += success_count as u64;
            stats_guard.failed_tasks += error_count as u64;
            
            let total_tasks = stats_guard.successful_tasks + stats_guard.failed_tasks;
            if total_tasks > 0 {
                stats_guard.average_time_us = stats_guard.total_time_us as f64 / total_tasks as f64;
                stats_guard.throughput = total_tasks as f64 / (stats_guard.total_time_us as f64 / 1_000_000.0);
                
                // 计算并行效率（理想情况下应该接近工作线程数）
                let sequential_time = stats_guard.average_time_us * total_tasks as f64;
                let parallel_time = stats_guard.total_time_us as f64 / self.worker_count as f64;
                stats_guard.parallel_efficiency = if parallel_time > 0.0 {
                    (sequential_time / parallel_time) / self.worker_count as f64
                } else {
                    0.0
                };
            }
        }
        
        // 转换结果格式
        let protocol_results: Vec<ProtocolParsingResult> = all_results
            .into_iter()
            .map(|task_result| {
                match task_result.result {
                    Ok(data) => ProtocolParsingResult {
                        success: true,
                        data: Some(data),
                        error: None,
                        stats: ProtocolProcessingStats {
                            parsing_time_us: task_result.processing_time_us,
                            validation_time_us: 0,
                            conversion_time_us: 0,
                            total_time_us: task_result.processing_time_us,
                            bytes_processed: 0,
                        },
                    },
                    Err(error) => ProtocolParsingResult {
                        success: false,
                        data: None,
                        error: Some(error),
                        stats: ProtocolProcessingStats {
                            parsing_time_us: task_result.processing_time_us,
                            validation_time_us: 0,
                            conversion_time_us: 0,
                            total_time_us: task_result.processing_time_us,
                            bytes_processed: 0,
                        },
                    },
                }
            })
            .collect();
        
        BatchProcessingResult {
            success_count,
            error_count,
            total_time_us: total_time,
            average_time_us: average_time,
            results: protocol_results,
        }
    }
    
    /// 处理单个任务
    fn process_single_task(
        parser: &mut ProtocolParser,
        validator: &mut ProtocolValidator,
        _converter: &mut DataConverter,
        task: &BatchTask,
    ) -> Result<ParsedProtocolData, String> {
        // 解析协议
        let parse_result = parser.parse_protocol(task.message_type, &task.data);
        
        if !parse_result.success {
            return Err(parse_result.error.unwrap_or_else(|| "解析失败".to_string()));
        }
        
        let parsed_data = parse_result.data.unwrap();
        
        // 验证数据
        if let Err(e) = validator.validate(&parsed_data) {
            return Err(format!("验证失败: {}", e));
        }
        
        Ok(parsed_data)
    }
    
    /// 流式批处理（用于实时数据流）
    pub fn stream_process(&mut self, task_stream: mpsc::Receiver<BatchTask>) -> mpsc::Receiver<BatchTaskResult> {
        let (tx, rx) = mpsc::channel();
        let stats = Arc::clone(&self.stats);
        
        // 创建处理器池
        let mut processors = Vec::new();
        for _ in 0..self.worker_count {
            processors.push((
                ProtocolParser::new(false),
                ProtocolValidator::default(),
                DataConverter::new(),
            ));
        }
        
        thread::spawn(move || {
            let mut processor_index = 0;
            
            while let Ok(task) = task_stream.recv() {
                let current_index = processor_index;
                let processors_len = processors.len();
                processor_index = (current_index + 1) % processors_len;
                
                let (parser, validator, converter) = &mut processors[current_index];
                
                let task_start = current_timestamp_us();
                let result = Self::process_single_task(parser, validator, converter, &task);
                let processing_time = current_timestamp_us() - task_start;
                
                // 更新统计
                {
                    let mut stats_guard = stats.write().unwrap();
                    stats_guard.total_tasks += 1;
                    stats_guard.total_time_us += processing_time;
                    
                    match &result {
                        Ok(_) => stats_guard.successful_tasks += 1,
                        Err(_) => stats_guard.failed_tasks += 1,
                    }
                }
                
                let task_result = BatchTaskResult {
                    task_id: task.task_id,
                    result,
                    processing_time_us: processing_time,
                };
                
                if tx.send(task_result).is_err() {
                    break; // 接收端已关闭
                }
            }
        });
        
        rx
    }
    
    /// 优先级队列处理
    pub fn priority_process(&mut self, tasks: Vec<BatchTask>) -> BatchProcessingResult {
        // 按优先级分组
        let mut priority_groups: std::collections::BTreeMap<TaskPriority, Vec<BatchTask>> = std::collections::BTreeMap::new();
        
        for task in tasks {
            priority_groups.entry(task.priority).or_insert_with(Vec::new).push(task);
        }
        
        let mut all_results = Vec::new();
        let mut total_success = 0;
        let mut total_error = 0;
        let start_time = current_timestamp_us();
        
        // 按优先级从高到低处理
        for (priority, group_tasks) in priority_groups.into_iter().rev() {
            log::debug!("处理优先级 {:?} 的 {} 个任务", priority, group_tasks.len());
            
            let group_result = self.process_batch(group_tasks);
            total_success += group_result.success_count;
            total_error += group_result.error_count;
            all_results.extend(group_result.results);
        }
        
        let total_time = current_timestamp_us() - start_time;
        let task_count = total_success + total_error;
        let average_time = if task_count > 0 {
            total_time as f64 / task_count as f64
        } else {
            0.0
        };
        
        BatchProcessingResult {
            success_count: total_success,
            error_count: total_error,
            total_time_us: total_time,
            average_time_us: average_time,
            results: all_results,
        }
    }
    
    /// 自适应批处理（根据系统负载调整批大小）
    pub fn adaptive_process(&mut self, tasks: Vec<BatchTask>, target_latency_us: u64) -> BatchProcessingResult {
        let start_time = current_timestamp_us();
        
        // 根据目标延迟计算最佳批大小
        let estimated_time_per_task = self.get_average_processing_time();
        let optimal_batch_size = if estimated_time_per_task > 0.0 {
            std::cmp::max(1, (target_latency_us as f64 / estimated_time_per_task) as usize)
        } else {
            tasks.len().min(100) // 默认批大小
        };
        
        log::debug!("自适应批处理: 目标延迟{}μs, 估计每任务{}μs, 最佳批大小{}", 
                   target_latency_us, estimated_time_per_task, optimal_batch_size);
        
        let mut all_results = Vec::new();
        let mut total_success = 0;
        let mut total_error = 0;
        
        // 分批处理
        for chunk in tasks.chunks(optimal_batch_size) {
            let chunk_result = self.process_batch(chunk.to_vec());
            total_success += chunk_result.success_count;
            total_error += chunk_result.error_count;
            all_results.extend(chunk_result.results);
            
            // 检查是否超过目标延迟
            let elapsed = current_timestamp_us() - start_time;
            if elapsed > target_latency_us {
                log::warn!("自适应批处理超过目标延迟: {}μs > {}μs", elapsed, target_latency_us);
                break;
            }
        }
        
        let total_time = current_timestamp_us() - start_time;
        let task_count = total_success + total_error;
        let average_time = if task_count > 0 {
            total_time as f64 / task_count as f64
        } else {
            0.0
        };
        
        BatchProcessingResult {
            success_count: total_success,
            error_count: total_error,
            total_time_us: total_time,
            average_time_us: average_time,
            results: all_results,
        }
    }
    
    /// 获取平均处理时间
    fn get_average_processing_time(&self) -> f64 {
        let stats_guard = self.stats.read().unwrap();
        stats_guard.average_time_us
    }
    
    /// 获取批处理统计
    pub fn get_stats(&self) -> BatchProcessingStats {
        self.stats.read().unwrap().clone()
    }
    
    /// 重置统计
    pub fn reset_stats(&mut self) {
        let mut stats_guard = self.stats.write().unwrap();
        *stats_guard = BatchProcessingStats {
            total_tasks: 0,
            successful_tasks: 0,
            failed_tasks: 0,
            total_time_us: 0,
            average_time_us: 0.0,
            throughput: 0.0,
            parallel_efficiency: 0.0,
        };
    }
    
    /// 获取工作线程数量
    pub fn get_worker_count(&self) -> usize {
        self.worker_count
    }
    
    /// 调整工作线程数量
    pub fn resize_worker_pool(&mut self, new_size: usize) {
        self.worker_count = new_size;
        
        // 重新创建处理器池
        self.parser_pool.clear();
        self.validator_pool.clear();
        self.converter_pool.clear();
        
        for _ in 0..new_size {
            self.parser_pool.push(ProtocolParser::new(false));
            self.validator_pool.push(ProtocolValidator::default());
            self.converter_pool.push(DataConverter::new());
        }
        
        log::info!("调整批处理器工作线程数量为: {}", new_size);
    }
}

impl Default for BatchProcessor {
    fn default() -> Self {
        let worker_count = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4);
        Self::new(worker_count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_batch_processing() {
        let mut processor = BatchProcessor::new(2);
        
        let tasks = vec![
            BatchTask {
                task_id: 1,
                message_type: MessageTypes::VEHICLE_CONTROL,
                data: vec![1, 1], // vehicle_id=1, command=start
                priority: TaskPriority::Normal,
            },
            BatchTask {
                task_id: 2,
                message_type: MessageTypes::AVP_PARKING,
                data: vec![1, 5], // vehicle_id=1, parking_spot=5
                priority: TaskPriority::High,
            },
        ];
        
        let result = processor.process_batch(tasks);
        assert_eq!(result.success_count + result.error_count, 2);
    }
    
    #[test]
    fn test_priority_processing() {
        let mut processor = BatchProcessor::new(2);
        
        let tasks = vec![
            BatchTask {
                task_id: 1,
                message_type: MessageTypes::VEHICLE_CONTROL,
                data: vec![1, 1],
                priority: TaskPriority::Low,
            },
            BatchTask {
                task_id: 2,
                message_type: MessageTypes::VEHICLE_CONTROL,
                data: vec![2, 2],
                priority: TaskPriority::Critical,
            },
        ];
        
        let result = processor.priority_process(tasks);
        assert!(result.success_count > 0 || result.error_count > 0);
    }
    
    #[test]
    fn test_adaptive_processing() {
        let mut processor = BatchProcessor::new(2);
        
        let tasks = vec![
            BatchTask {
                task_id: 1,
                message_type: MessageTypes::VEHICLE_CONTROL,
                data: vec![1, 1],
                priority: TaskPriority::Normal,
            },
        ];
        
        let result = processor.adaptive_process(tasks, 10000); // 10ms目标延迟
        assert!(result.total_time_us <= 20000); // 应该在合理时间内完成
    }
}
