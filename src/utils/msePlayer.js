/**
 * MSE (Media Source Extensions) 播放器
 * 用于接收 WebSocket 推送的 fMP4 数据并播放
 * 延迟：1-2秒
 */

import { info, warn, error, debug } from '@tauri-apps/plugin-log';

/**
 * 检测浏览器支持的视频编解码器（调试工具）
 * 用法：在浏览器控制台运行 window.detectVideoCodecs()
 */
export function detectVideoCodecSupport() {
    if (!window.MediaSource) {
        return {
            mseSupported: false,
            supportedCodecs: [],
            message: '浏览器不支持 MSE (Media Source Extensions)'
        };
    }

    const codecsToTest = [
        { name: 'H.264 High Profile + AAC', codec: 'video/mp4; codecs="avc1.64001f,mp4a.40.2"' },
        { name: 'H.264 High Profile', codec: 'video/mp4; codecs="avc1.64001f"' },
        { name: 'H.264 Main Profile + AAC', codec: 'video/mp4; codecs="avc1.4d001f,mp4a.40.2"' },
        { name: 'H.264 Main Profile', codec: 'video/mp4; codecs="avc1.4d001f"' },
        { name: 'H.264 Baseline + AAC', codec: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"' },
        { name: 'H.264 Baseline', codec: 'video/mp4; codecs="avc1.42E01E"' },
        { name: 'MP4 (基础)', codec: 'video/mp4' },
        { name: 'WebM VP8', codec: 'video/webm; codecs="vp8"' },
        { name: 'WebM VP9', codec: 'video/webm; codecs="vp9"' }
    ];

    const allCodecs = codecsToTest.map(item => ({
        name: item.name,
        codec: item.codec,
        supported: MediaSource.isTypeSupported(item.codec)
    }));

    const supportedCodecs = allCodecs.filter(item => item.supported);

    // 同时输出到控制台和日志文件（诊断工具需要控制台可见）
    const logBoth = (msg) => {
        console.log(msg);
        info(msg);
    };

    logBoth('========== 视频编解码器检测 ==========');
    logBoth(`MSE 支持: ${window.MediaSource ? '是' : '否'}`);
    logBoth('支持的编解码器:');
    supportedCodecs.forEach(item => {
        logBoth(`  ${item.name}`);
        logBoth(`   ${item.codec}`);
    });
    
    const unsupportedCodecs = allCodecs.filter(item => !item.supported);
    if (unsupportedCodecs.length > 0) {
        logBoth('不支持的编解码器:');
        unsupportedCodecs.forEach(item => {
            logBoth(`  ${item.name}`);
            logBoth(`  ${item.codec}`);
        });
    }
    logBoth('=========================================');

    return {
        mseSupported: true,
        supportedCodecs,
        allCodecs,
        message: supportedCodecs.length > 0 
            ? `支持 ${supportedCodecs.length}/${codecsToTest.length} 个编解码器` 
            : '不支持任何测试的编解码器'
    };
}

// 暴露到全局供调试使用
if (typeof window !== 'undefined') {
    window.detectVideoCodecs = detectVideoCodecSupport;
}

export class MsePlayer {
    constructor(videoElement, wsUrl, cameraId) {
        this.video = videoElement;
        this.wsUrl = wsUrl;
        this.cameraId = cameraId;
        this.ws = null;
        this.mediaSource = null;
        this.sourceBuffer = null;
        this.queue = []; // 数据队列
        this.isAppending = false;
        this.isReady = false;
        this.isStopping = false; // 标记正在停止（避免 WebSocket 关闭时的错误输出）
        this.objectUrl = null; // 存储 Object URL 以便后续撤销
        this.wsConnectTimeout = null; // WebSocket 连接超时定时器
        this.updateEndHandler = null; // SourceBuffer updateend 处理器
        this.errorHandler = null; // SourceBuffer error 处理器
        this.hasStartedPlaying = false; // 标记是否已开始播放
        this.liveStreamMonitor = null; // 实时流监控定时器
    }

    /**
     * 启动播放
     */
    async start() {
        info(`启动 MSE 播放器 - 摄像头: ${this.cameraId}, URL: ${this.wsUrl}`);

        // 检查 MSE 基础支持
        if (!window.MediaSource) {
            error('浏览器不支持 MSE (Media Source Extensions)');
            throw new Error('浏览器不支持 MSE (Media Source Extensions)');
        }

        // 尝试多个 H.264 编解码器配置（从高到低）
        const codecConfigs = [
            'video/mp4; codecs="avc1.64001f,mp4a.40.2"', // H.264 High Profile + AAC
            'video/mp4; codecs="avc1.64001f"',           // H.264 High Profile (仅视频)
            'video/mp4; codecs="avc1.4d001f,mp4a.40.2"', // H.264 Main Profile + AAC
            'video/mp4; codecs="avc1.4d001f"',           // H.264 Main Profile (仅视频)
            'video/mp4; codecs="avc1.42E01E,mp4a.40.2"', // H.264 Baseline + AAC
            'video/mp4; codecs="avc1.42E01E"',           // H.264 Baseline (仅视频)
            'video/mp4'                                   // 最基础的 MP4（无编解码器指定）
        ];

        let supportedCodec = null;
        const supportedCodecs = [];
        
        for (const codec of codecConfigs) {
            const isSupported = MediaSource.isTypeSupported(codec);
            if (isSupported) {
                supportedCodecs.push(codec);
                if (!supportedCodec) {
                    supportedCodec = codec;
                }
            }
        }
        
        if (supportedCodec) {
            info(`使用编解码器: ${supportedCodec}`);
            debug(`浏览器支持的所有编解码器: ${supportedCodecs.join(', ')}`);
        } else {
            const errorMsg = '浏览器不支持任何 H.264 编解码器配置';
            error(`${errorMsg}`);
            error(`已尝试的编解码器: ${codecConfigs.join(', ')}`);
            error('请确保系统已安装 H.264 解码器：Ubuntu: sudo apt install gstreamer1.0-plugins-bad gstreamer1.0-libav');
            throw new Error(errorMsg);
        }

        // 创建 MediaSource
        this.mediaSource = new MediaSource();
        this.objectUrl = URL.createObjectURL(this.mediaSource);
        this.video.src = this.objectUrl;

        // 等待 MediaSource 就绪
        await new Promise((resolve, reject) => {
            this.mediaSource.addEventListener('sourceopen', resolve, { once: true });
            this.mediaSource.addEventListener('error', reject, { once: true });
            // 增加超时时间（打包版本中 FFmpeg 查找可能需要更长时间）
            const timeout = setTimeout(() => reject(new Error('MediaSource 超时（15秒）')), 15000);
            // 成功后清理超时
            this.mediaSource.addEventListener('sourceopen', () => clearTimeout(timeout), { once: true });
        });

        info('MediaSource 已就绪');

        // 创建 SourceBuffer（使用检测到的编解码器）
        this.sourceBuffer = this.mediaSource.addSourceBuffer(supportedCodec);

        // SourceBuffer 事件（保存处理器引用以便后续清理）
        this.updateEndHandler = () => {
            this.isAppending = false;
            this.processQueue();
            
            // 🎬 第一次接收到数据后，自动播放视频
            if (!this.hasStartedPlaying && this.video.buffered.length > 0) {
                this.hasStartedPlaying = true;
                info('开始播放视频');
                
                // 启动实时流监控（每秒检查一次）
                this.startLiveStreamMonitor();
                
                this.video.play().catch(err => {
                    warn(`自动播放失败（可能需要用户交互）: ${err.message || err}`);
                    // 尝试通过用户交互触发播放
                    this.setupUserInteractionPlay();
                });
            }
        };
        this.sourceBuffer.addEventListener('updateend', this.updateEndHandler);

        this.errorHandler = (e) => {
            error(`SourceBuffer 错误: ${e}`);
        };
        this.sourceBuffer.addEventListener('error', this.errorHandler);

        // 连接 WebSocket
        await this.connectWebSocket();

        this.isReady = true;
        info('MSE 播放器已启动');
    }

    /**
     * 连接 WebSocket
     */
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            info(`连接 WebSocket: ${this.wsUrl}`);
            debug(`环境信息: UA=${navigator.userAgent}, Location=${window.location.href}`);

            try {
                this.ws = new WebSocket(this.wsUrl);
                this.ws.binaryType = 'arraybuffer';
                debug(`WebSocket 对象已创建, readyState: ${this.ws.readyState}`);
            } catch (e) {
                error(`创建 WebSocket 失败: ${e.message || e}`);
                reject(e);
                return;
            }

            this.ws.onopen = () => {
                info(`WebSocket 已连接, readyState: ${this.ws.readyState}`);
                // 清理超时定时器
                if (this.wsConnectTimeout) {
                    clearTimeout(this.wsConnectTimeout);
                    this.wsConnectTimeout = null;
                }
                // 发送订阅消息
                const subscribeMsg = { camera_id: this.cameraId };
                info(`发送订阅消息: camera_id=${this.cameraId}`);
                this.ws.send(JSON.stringify(subscribeMsg));
            };

            this.ws.onmessage = (event) => {
                if (typeof event.data === 'string') {
                    // JSON 消息（状态消息）
                    const msg = JSON.parse(event.data);
                    if (msg.status === 'ready') {
                        info('流已就绪，开始接收数据');
                        resolve();
                    } else if (msg.error) {
                        error(`服务器错误: ${msg.error}`);
                        reject(new Error(msg.error));
                    }
                } else {
                    // 二进制数据（fMP4 片段）
                    this.appendData(event.data);
                }
            };

            this.ws.onerror = (errorEvent) => {
                // 如果正在停止，静默处理错误（避免控制台误报）
                if (this.isStopping) {
                    return;
                }
                error(`WebSocket 错误: ${errorEvent.type}`);
                reject(errorEvent);
            };

            this.ws.onclose = (event) => {
                // 清理超时定时器
                if (this.wsConnectTimeout) {
                    clearTimeout(this.wsConnectTimeout);
                    this.wsConnectTimeout = null;
                }
                
                // 如果不是正在停止，才记录断开日志
                if (!this.isStopping) {
                    warn(`🔌 WebSocket 意外断开, code: ${event.code}`);
                }
            };

            // 超时（保存定时器引用）
            this.wsConnectTimeout = setTimeout(() => {
                this.wsConnectTimeout = null;
                reject(new Error('WebSocket 连接超时'));
            }, 10000);
        });
    }

    /**
     * 追加数据到 SourceBuffer
     */
    appendData(arrayBuffer) {
        if (!this.isReady || !this.sourceBuffer) {
            return;
        }

        // 添加到队列
        this.queue.push(arrayBuffer);
        this.processQueue();
    }

    /**
     * 处理数据队列
     */
    processQueue() {
        // 如果正在追加或队列为空，直接返回
        if (this.isAppending || this.queue.length === 0) {
            return;
        }

        // 如果 SourceBuffer 正在更新，等待
        if (this.sourceBuffer.updating) {
            return;
        }

        // 🔍 队列过长检测（可能数据积压）
        if (this.queue.length > 100) {
            warn(`数据队列积压: ${this.queue.length} 个片段，清理旧数据`);
            // 只保留最新的 50 个片段
            this.queue = this.queue.slice(-50);
        }

        // 从队列取出数据
        const chunk = this.queue.shift();
        
        try {
            this.isAppending = true;
            this.sourceBuffer.appendBuffer(chunk);
        } catch (e) {
            error(`appendBuffer 失败: ${e.message || e}`);
            this.isAppending = false;
            
            // 🔧 如果是 QuotaExceededError，尝试清理更多缓冲区
            if (e.name === 'QuotaExceededError') {
                warn('缓冲区已满，尝试清理更多数据');
                this.aggressiveCleanupBuffer();
            }
        }

        // 清理旧 buffer（防止内存溢出）
        this.cleanupBuffer();
    }

    /**
     * 清理旧的 buffer 数据（实时流模式：保留最后 5-10 秒）
     */
    cleanupBuffer() {
        if (!this.sourceBuffer || this.sourceBuffer.updating) {
            return;
        }

        const currentTime = this.video.currentTime;
        const buffered = this.sourceBuffer.buffered;

        // 实时流模式：更激进的清理策略
        if (buffered.length > 0) {
            const bufferStart = buffered.start(0);
            const bufferEnd = buffered.end(buffered.length - 1);
            const bufferDuration = bufferEnd - bufferStart;

            // 如果 buffer 范围超过 10 秒，清理旧数据（实时流不需要太多历史）
            if (bufferDuration > 10 && currentTime - bufferStart > 5) {
                try {
                    // 只保留最近 5 秒的数据
                    const removeEnd = currentTime - 5;
                    if (removeEnd > bufferStart) {
                        this.sourceBuffer.remove(bufferStart, removeEnd);
                        debug(`清理旧 buffer: ${bufferStart.toFixed(2)} → ${removeEnd.toFixed(2)}`);
                    }
                } catch (e) {
                    warn(`清理 buffer 失败: ${e.message || e}`);
                }
            }
        }
    }

    /**
     * 激进的缓冲区清理（用于紧急情况）
     */
    aggressiveCleanupBuffer() {
        if (!this.sourceBuffer || this.sourceBuffer.updating) {
            return;
        }

        const currentTime = this.video.currentTime;
        const buffered = this.sourceBuffer.buffered;

        if (buffered.length > 0) {
            const bufferStart = buffered.start(0);
            const bufferEnd = buffered.end(buffered.length - 1);

            try {
                // 只保留当前播放位置前后 5 秒
                const keepStart = Math.max(bufferStart, currentTime - 5);
                const keepEnd = Math.min(bufferEnd, currentTime + 5);

                // 移除前面的数据
                if (keepStart > bufferStart) {
                    this.sourceBuffer.remove(bufferStart, keepStart);
                    warn(`🧹 激进清理前部: ${bufferStart.toFixed(2)} → ${keepStart.toFixed(2)}`);
                }
            } catch (e) {
                error(`激进清理失败: ${e.message || e}`);
            }
        }
    }

    /**
     * 启动实时流监控（检测卡顿并自动跳到最新帧）
     */
    startLiveStreamMonitor() {
        // 清理旧的监控定时器
        if (this.liveStreamMonitor) {
            clearInterval(this.liveStreamMonitor);
        }

        this.liveStreamMonitor = setInterval(() => {
            if (this.video.paused || !this.video.buffered || this.video.buffered.length === 0) {
                return;
            }

            const currentTime = this.video.currentTime;
            const buffered = this.video.buffered;
            const bufferEnd = buffered.end(buffered.length - 1);
            const latency = bufferEnd - currentTime;

            // 🔍 如果延迟超过 2 秒，跳到最新帧（实时流模式）
            if (latency > 2.0) {
                warn(`实时流延迟过大: ${latency.toFixed(2)}s，跳到最新帧`);
                this.video.currentTime = bufferEnd - 0.1; // 跳到最新位置（留0.1s缓冲）
            }

            // 🔍 如果视频卡住不动（currentTime 长时间不变）
            if (this.lastCurrentTime !== undefined && 
                Math.abs(currentTime - this.lastCurrentTime) < 0.01 && 
                !this.video.paused &&
                latency > 0.5) {
                warn(`视频卡顿检测，当前时间: ${currentTime.toFixed(2)}s，缓冲区末端: ${bufferEnd.toFixed(2)}s`);
                
                // 尝试跳过卡住的帧
                this.video.currentTime = Math.min(currentTime + 0.1, bufferEnd - 0.1);
                
                // 如果还是卡住，强制重新播放
                if (this.video.paused) {
                    this.video.play().catch(err => {
                        error(`重新播放失败: ${err.message || err}`);
                    });
                }
            }

            this.lastCurrentTime = currentTime;

            // 定期输出调试信息
            if (Math.random() < 0.1) { // 10% 概率输出（避免刷屏）
                debug(`视频状态: 当前=${currentTime.toFixed(2)}s, 缓冲=${bufferEnd.toFixed(2)}s, 延迟=${latency.toFixed(2)}s, 暂停=${this.video.paused}`);
            }
        }, 1000); // 每秒检查一次

        info('实时流监控已启动');
    }

    /**
     * 设置用户交互播放（当自动播放被浏览器阻止时）
     */
    setupUserInteractionPlay() {
        const playOnClick = () => {
            this.video.play().then(() => {
                info('用户交互后播放成功');
                document.removeEventListener('click', playOnClick);
                document.removeEventListener('touchstart', playOnClick);
            }).catch(err => {
                error(`用户交互后播放仍然失败: ${err.message || err}`);
            });
        };

        document.addEventListener('click', playOnClick, { once: true });
        document.addEventListener('touchstart', playOnClick, { once: true });
        info('等待用户交互以开始播放...');
    }

    /**
     * 停止播放并清理资源（防止内存泄漏）
     */
    stop() {
        debug('停止 MSE 播放器');

        // 清理实时流监控
        if (this.liveStreamMonitor) {
            clearInterval(this.liveStreamMonitor);
            this.liveStreamMonitor = null;
        }

        // 首先标记正在停止（让所有错误处理器静默）
        this.isStopping = true;
        this.hasStartedPlaying = false;
        this.isReady = false;

        // 清理 WebSocket 连接超时定时器
        if (this.wsConnectTimeout) {
            clearTimeout(this.wsConnectTimeout);
            this.wsConnectTimeout = null;
        }

        // 关闭 WebSocket（静默模式）
        if (this.ws) {
            try {
                // 只在连接中或已连接时关闭
                if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close(1000, 'Client stopped'); // 正常关闭码
                }
            } catch (e) {
                // 忽略关闭错误
            } finally {
                // 最后清理事件监听器和引用
                if (this.ws) {
                    this.ws.onopen = null;
                    this.ws.onmessage = null;
                    this.ws.onerror = null;
                    this.ws.onclose = null;
                    this.ws = null;
                }
            }
        }

        // 清理 SourceBuffer 事件监听器
        if (this.sourceBuffer) {
            if (this.updateEndHandler) {
                this.sourceBuffer.removeEventListener('updateend', this.updateEndHandler);
                this.updateEndHandler = null;
            }
            if (this.errorHandler) {
                this.sourceBuffer.removeEventListener('error', this.errorHandler);
                this.errorHandler = null;
            }
        }

        // 清空队列
        this.queue = [];

        // 清理 MediaSource
        if (this.mediaSource && this.mediaSource.readyState === 'open') {
            try {
                if (this.sourceBuffer) {
                    this.mediaSource.removeSourceBuffer(this.sourceBuffer);
                }
                this.mediaSource.endOfStream();
            } catch (e) {
                warn(`清理 MediaSource 失败: ${e.message || e}`);
            }
        }

        this.sourceBuffer = null;
        this.mediaSource = null;

        // 停止视频并清理（静默模式）
        if (this.video) {
            try {
                this.video.pause();
                // 先移除 src 属性，再设为空字符串，减少事件触发
                this.video.removeAttribute('src');
                this.video.load(); // 重置 video 元素状态
            } catch (e) {
                // 忽略清理错误
            }
        }

        // 关键：撤销 Object URL 以释放内存
        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
            this.objectUrl = null;
        }

        debug('MSE 播放器已停止，所有资源已清理');
    }
}

