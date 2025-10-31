/**
 * MSE (Media Source Extensions) 播放器
 * 用于接收 WebSocket 推送的 fMP4 数据并播放
 * 延迟：1-2秒
 */

/**
 * 检测浏览器支持的视频编解码器（调试工具）
 * 用法：在浏览器控制台运行 window.detectVideoCodecs()
 */
export function detectVideoCodecSupport() {
    if (!window.MediaSource) {
        return {
            mseSupported: false,
            supportedCodecs: [],
            message: '❌ 浏览器不支持 MSE (Media Source Extensions)'
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

    console.log('🎥 ========== 视频编解码器检测 ==========');
    console.log('MSE 支持:', window.MediaSource ? '✅ 是' : '❌ 否');
    console.log('\n支持的编解码器:');
    supportedCodecs.forEach(item => {
        console.log(`  ✅ ${item.name}`);
        console.log(`     ${item.codec}`);
    });
    
    const unsupportedCodecs = allCodecs.filter(item => !item.supported);
    if (unsupportedCodecs.length > 0) {
        console.log('\n不支持的编解码器:');
        unsupportedCodecs.forEach(item => {
            console.log(`  ❌ ${item.name}`);
            console.log(`     ${item.codec}`);
        });
    }
    console.log('=========================================\n');

    return {
        mseSupported: true,
        supportedCodecs,
        allCodecs,
        message: supportedCodecs.length > 0 
            ? `✅ 支持 ${supportedCodecs.length}/${codecsToTest.length} 个编解码器` 
            : '❌ 不支持任何测试的编解码器'
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
    }

    /**
     * 启动播放
     */
    async start() {
        console.log('🎬 启动 MSE 播放器:', { cameraId: this.cameraId, wsUrl: this.wsUrl });

        // 检查 MSE 基础支持
        if (!window.MediaSource) {
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
            console.log('✅ 使用编解码器:', supportedCodec);
            console.log('📋 浏览器支持的所有编解码器:', supportedCodecs);
        } else {
            const errorMsg = '浏览器不支持任何 H.264 编解码器配置';
            console.error('❌', errorMsg);
            console.error('已尝试的编解码器:', codecConfigs);
            console.error('💡 请确保系统已安装 H.264 解码器：');
            console.error('   Ubuntu: sudo apt install gstreamer1.0-plugins-bad gstreamer1.0-libav');
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

        console.log('✅ MediaSource 已就绪');

        // 创建 SourceBuffer（使用检测到的编解码器）
        this.sourceBuffer = this.mediaSource.addSourceBuffer(supportedCodec);

        // SourceBuffer 事件（保存处理器引用以便后续清理）
        this.updateEndHandler = () => {
            this.isAppending = false;
            this.processQueue();
        };
        this.sourceBuffer.addEventListener('updateend', this.updateEndHandler);

        this.errorHandler = (e) => {
            console.error('❌ SourceBuffer 错误:', e);
        };
        this.sourceBuffer.addEventListener('error', this.errorHandler);

        // 连接 WebSocket
        await this.connectWebSocket();

        this.isReady = true;
        console.log('✅ MSE 播放器已启动');
    }

    /**
     * 连接 WebSocket
     */
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            console.log('🔌 连接 WebSocket:', this.wsUrl);
            console.log('🔍 环境信息:', {
                userAgent: navigator.userAgent,
                location: window.location.href,
                protocol: window.location.protocol
            });

            try {
                this.ws = new WebSocket(this.wsUrl);
                this.ws.binaryType = 'arraybuffer';
                console.log('✅ WebSocket 对象已创建, readyState:', this.ws.readyState);
            } catch (e) {
                console.error('❌ 创建 WebSocket 失败:', e);
                reject(e);
                return;
            }

            this.ws.onopen = () => {
                console.log('✅ WebSocket 已连接, readyState:', this.ws.readyState);
                // 清理超时定时器
                if (this.wsConnectTimeout) {
                    clearTimeout(this.wsConnectTimeout);
                    this.wsConnectTimeout = null;
                }
                // 发送订阅消息
                const subscribeMsg = { camera_id: this.cameraId };
                console.log('📤 发送订阅消息:', subscribeMsg);
                this.ws.send(JSON.stringify(subscribeMsg));
            };

            this.ws.onmessage = (event) => {
                if (typeof event.data === 'string') {
                    // JSON 消息（状态消息）
                    const msg = JSON.parse(event.data);
                    if (msg.status === 'ready') {
                        console.log('✅ 流已就绪，开始接收数据');
                        resolve();
                    } else if (msg.error) {
                        console.error('❌ 服务器错误:', msg.error);
                        reject(new Error(msg.error));
                    }
                } else {
                    // 二进制数据（fMP4 片段）
                    this.appendData(event.data);
                }
            };

            this.ws.onerror = (error) => {
                // 如果正在停止，静默处理错误（避免控制台误报）
                if (this.isStopping) {
                    return;
                }
                console.error('❌ WebSocket 错误:', error);
                reject(error);
            };

            this.ws.onclose = (event) => {
                // 清理超时定时器
                if (this.wsConnectTimeout) {
                    clearTimeout(this.wsConnectTimeout);
                    this.wsConnectTimeout = null;
                }
                
                // 如果不是正在停止，才记录断开日志
                if (!this.isStopping) {
                    console.warn('🔌 WebSocket 意外断开, code:', event.code);
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

        // 从队列取出数据
        const chunk = this.queue.shift();
        
        try {
            this.isAppending = true;
            this.sourceBuffer.appendBuffer(chunk);
        } catch (e) {
            console.error('❌ appendBuffer 失败:', e);
            this.isAppending = false;
        }

        // 清理旧 buffer（防止内存溢出）
        this.cleanupBuffer();
    }

    /**
     * 清理旧的 buffer 数据（保留最后 30 秒）
     */
    cleanupBuffer() {
        if (!this.sourceBuffer || this.sourceBuffer.updating) {
            return;
        }

        const currentTime = this.video.currentTime;
        const buffered = this.sourceBuffer.buffered;

        // 如果 buffer 范围超过 30 秒，清理旧数据
        if (buffered.length > 0) {
            const bufferStart = buffered.start(0);
            const bufferEnd = buffered.end(buffered.length - 1);
            const bufferDuration = bufferEnd - bufferStart;

            if (bufferDuration > 30 && currentTime - bufferStart > 15) {
                try {
                    // 移除 15 秒之前的数据
                    const removeEnd = currentTime - 15;
                    if (removeEnd > bufferStart) {
                        this.sourceBuffer.remove(bufferStart, removeEnd);
                        console.debug('🧹 清理旧 buffer:', bufferStart.toFixed(2), '→', removeEnd.toFixed(2));
                    }
                } catch (e) {
                    console.warn('清理 buffer 失败:', e);
                }
            }
        }
    }

    /**
     * 停止播放并清理资源（防止内存泄漏）
     */
    stop() {
        console.debug('🛑 停止 MSE 播放器');

        // 首先标记正在停止（让所有错误处理器静默）
        this.isStopping = true;
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
                console.warn('清理 MediaSource 失败:', e);
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

        // ⚠️ 关键：撤销 Object URL 以释放内存
        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
            this.objectUrl = null;
        }

        console.debug('✅ MSE 播放器已停止，所有资源已清理');
    }
}

