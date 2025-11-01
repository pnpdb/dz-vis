/**
 * MJPEG Player - 基于 WebSocket 的 MJPEG 流播放器
 * 用于播放 GStreamer 推送的 JPEG 帧
 */

import { logger } from './logger.js';

export class MjpegPlayer {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.ws = null;
        this.cameraId = null;
        this.wsUrl = null;
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.isDestroyed = false;
        
        // 性能监控
        this.frameCount = 0;
        this.lastFrameTime = Date.now();
        this.fps = 0;
        this.fpsUpdateInterval = null;
        
        // 帧跳过控制（提高性能）
        this.isProcessingFrame = false;
        this.droppedFrames = 0;
        this.pendingFrame = null;
        
        // 回调函数
        this.onReady = null;
        this.onError = null;
        this.onFpsUpdate = null;
        
        logger.info('MjpegPlayer', '播放器已创建');
    }
    
    /**
     * 启动播放
     * @param {string} wsUrl - WebSocket URL
     * @param {Object} callbacks - 回调函数 {onReady, onError, onFpsUpdate}
     */
    async start(wsUrl, callbacks = {}) {
        if (this.isDestroyed) {
            throw new Error('播放器已销毁');
        }
        
        this.wsUrl = wsUrl;
        this.onReady = callbacks.onReady;
        this.onError = callbacks.onError;
        this.onFpsUpdate = callbacks.onFpsUpdate;
        
        // 从 URL 提取 camera_id
        const match = wsUrl.match(/\/mjpeg\/(\d+)/);
        if (match) {
            this.cameraId = parseInt(match[1]);
        }
        
        logger.info('MjpegPlayer', `启动播放: ${wsUrl}`);
        
        this.connect();
        this.startFpsMonitoring();
    }
    
    /**
     * 建立 WebSocket 连接
     */
    connect() {
        if (this.isDestroyed) return;
        
        // 防止重复连接
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            logger.warn('MjpegPlayer', 'WebSocket 已在连接中，跳过重复连接');
            return;
        }
        
        try {
            this.ws = new WebSocket(this.wsUrl);
            this.ws.binaryType = 'arraybuffer';
            
            this.ws.onopen = () => {
                logger.info('MjpegPlayer', `WebSocket 已连接: camera_id=${this.cameraId}`);
                this.reconnectAttempts = 0;
            };
            
            this.ws.onmessage = (event) => {
                if (event.data instanceof ArrayBuffer) {
                    // 收到 JPEG 二进制数据
                    // 智能帧跳过：如果正在处理，保存为待处理帧
                    if (this.isProcessingFrame) {
                        this.pendingFrame = event.data;
                        this.droppedFrames++;
                    } else {
                        this.handleJpegFrame(event.data);
                    }
                } else if (typeof event.data === 'string') {
                    // 收到文本消息（通常是就绪或错误消息）
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.ready) {
                            logger.info('MjpegPlayer', `流已就绪: camera_id=${msg.camera_id}`);
                            if (this.onReady) {
                                this.onReady();
                            }
                        } else if (msg.error) {
                            logger.error('MjpegPlayer', `服务器错误: ${msg.error}`);
                            if (this.onError) {
                                this.onError(new Error(msg.error));
                            }
                        }
                    } catch (e) {
                        logger.warn('MjpegPlayer', `无法解析消息: ${event.data}`);
                    }
                }
            };
            
            this.ws.onerror = (error) => {
                logger.error('MjpegPlayer', `WebSocket 错误:`, error);
                if (this.onError) {
                    this.onError(error);
                }
            };
            
            this.ws.onclose = () => {
                logger.warn('MjpegPlayer', 'WebSocket 已断开');
                this.ws = null;
                
                // 尝试重连
                if (!this.isDestroyed && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    logger.info('MjpegPlayer', `${this.reconnectDelay}ms 后尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    
                    this.reconnectTimer = setTimeout(() => {
                        this.connect();
                    }, this.reconnectDelay);
                } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    logger.error('MjpegPlayer', '达到最大重连次数，停止重连');
                    if (this.onError) {
                        this.onError(new Error('连接失败，已达到最大重连次数'));
                    }
                }
            };
            
        } catch (error) {
            logger.error('MjpegPlayer', '创建 WebSocket 失败:', error);
            if (this.onError) {
                this.onError(error);
            }
        }
    }
    
    /**
     * 处理 JPEG 帧（优化版本：使用 createImageBitmap）
     * @param {ArrayBuffer} arrayBuffer - JPEG 二进制数据
     */
    handleJpegFrame(arrayBuffer) {
        // 标记正在处理
        this.isProcessingFrame = true;
        
        try {
            // 将 ArrayBuffer 转换为 Blob
            const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
            
            // 设置新的图像
            if (this.videoElement.tagName === 'IMG') {
                // IMG 模式：使用 Object URL（简单快速）
                const url = URL.createObjectURL(blob);
                
                // 在图像加载后释放 URL
                this.videoElement.onload = () => {
                    // 释放旧的 URL
                    if (this.videoElement._currentObjectUrl && this.videoElement._currentObjectUrl !== url) {
                        URL.revokeObjectURL(this.videoElement._currentObjectUrl);
                    }
                    this.videoElement._currentObjectUrl = url;
                    
                    // 处理完成，检查是否有待处理帧
                    this.isProcessingFrame = false;
                    if (this.pendingFrame) {
                        const nextFrame = this.pendingFrame;
                        this.pendingFrame = null;
                        this.handleJpegFrame(nextFrame);
                    }
                };
                
                this.videoElement.onerror = () => {
                    URL.revokeObjectURL(url);
                    this.isProcessingFrame = false;
                };
                
                // 设置新图像
                this.videoElement.src = url;
                
            } else if (this.videoElement.tagName === 'CANVAS') {
                // Canvas 模式：使用 createImageBitmap（更快的解码）
                createImageBitmap(blob)
                    .then(imageBitmap => {
                        try {
                            const ctx = this.videoElement.getContext('2d');
                            
                            // 只在尺寸变化时调整 canvas
                            if (this.videoElement.width !== imageBitmap.width || 
                                this.videoElement.height !== imageBitmap.height) {
                                this.videoElement.width = imageBitmap.width;
                                this.videoElement.height = imageBitmap.height;
                            }
                            
                            // 使用 imageBitmap 渲染（比 Image 对象快）
                            ctx.drawImage(imageBitmap, 0, 0);
                            
                            // 释放 ImageBitmap
                            imageBitmap.close();
                            
                            // 处理完成
                            this.isProcessingFrame = false;
                            
                            // 检查是否有待处理帧
                            if (this.pendingFrame) {
                                const nextFrame = this.pendingFrame;
                                this.pendingFrame = null;
                                this.handleJpegFrame(nextFrame);
                            }
                        } catch (err) {
                            logger.error('MjpegPlayer', 'Canvas 渲染失败:', err);
                            imageBitmap.close();
                            this.isProcessingFrame = false;
                        }
                    })
                    .catch(err => {
                        logger.error('MjpegPlayer', 'createImageBitmap 失败:', err);
                        this.isProcessingFrame = false;
                    });
            }
            
            // 更新帧计数
            this.frameCount++;
            
        } catch (error) {
            logger.error('MjpegPlayer', '处理 JPEG 帧失败:', error);
        }
    }
    
    /**
     * 启动 FPS 监控
     */
    startFpsMonitoring() {
        if (this.fpsUpdateInterval) {
            clearInterval(this.fpsUpdateInterval);
        }
        
        this.fpsUpdateInterval = setInterval(() => {
            const now = Date.now();
            const elapsed = (now - this.lastFrameTime) / 1000;
            
            if (elapsed > 0) {
                this.fps = Math.round(this.frameCount / elapsed);
                
                if (this.onFpsUpdate) {
                    this.onFpsUpdate(this.fps);
                }
                
                // 输出丢帧统计（仅在有丢帧时）
                if (this.droppedFrames > 0) {
                    logger.debug('MjpegPlayer', `丢帧: ${this.droppedFrames}, FPS: ${this.fps}`);
                }
                
                // 重置计数器
                this.frameCount = 0;
                this.droppedFrames = 0;
                this.lastFrameTime = now;
            }
        }, 1000);
    }
    
    /**
     * 停止播放
     */
    stop() {
        logger.info('MjpegPlayer', '停止播放');
        
        // 关闭 WebSocket
        if (this.ws) {
            // 移除事件监听器防止触发重连
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onerror = null;
            this.ws.onclose = null;
            
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
            this.ws = null;
        }
        
        // 清理重连定时器
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        // 清理 FPS 监控
        if (this.fpsUpdateInterval) {
            clearInterval(this.fpsUpdateInterval);
            this.fpsUpdateInterval = null;
        }
        
        // 释放 Object URL
        if (this.videoElement && this.videoElement._currentObjectUrl) {
            URL.revokeObjectURL(this.videoElement._currentObjectUrl);
            delete this.videoElement._currentObjectUrl;
        }
        
        // 清空图像和相关引用
        if (this.videoElement) {
            if (this.videoElement.tagName === 'IMG') {
                this.videoElement.onload = null;
                this.videoElement.onerror = null;
                this.videoElement.src = '';
            } else if (this.videoElement.tagName === 'CANVAS') {
                const ctx = this.videoElement.getContext('2d');
                ctx.clearRect(0, 0, this.videoElement.width, this.videoElement.height);
            }
        }
        
        // 清理 Canvas 模式的 Image 对象
        if (this._canvasImage) {
            this._canvasImage.onload = null;
            this._canvasImage.onerror = null;
            this._canvasImage.src = '';
            this._canvasImage = null;
        }
        
        // 清理待处理帧
        this.pendingFrame = null;
        this.isProcessingFrame = false;
        
        // 重置计数器
        this.frameCount = 0;
        this.droppedFrames = 0;
        this.reconnectAttempts = 0;
    }
    
    /**
     * 销毁播放器
     */
    destroy() {
        logger.info('MjpegPlayer', '销毁播放器');
        
        this.isDestroyed = true;
        this.stop();
        
        // 清理引用
        this.videoElement = null;
        this.onReady = null;
        this.onError = null;
        this.onFpsUpdate = null;
    }
    
    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            isConnected: this.ws && this.ws.readyState === WebSocket.OPEN,
            fps: this.fps,
            cameraId: this.cameraId,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

export default MjpegPlayer;

