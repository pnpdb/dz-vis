// Three.js性能监控工具
export class ThreeJSPerformanceMonitor {
    constructor() {
        this.isEnabled = import.meta.env.DEV; // Vite的开发环境检测
        this.stats = null;
        this.memoryInfo = null;
        this.panel = null;
        this.updateInterval = null;
    }

    init(container) {
        if (!this.isEnabled) return;

        this.createPanel(container);
        this.startMonitoring();
    }

    createPanel(container) {
        // 创建性能监控面板
        this.panel = document.createElement('div');
        this.panel.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #00f0ff;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 1000;
            min-width: 200px;
        `;
        
        this.memoryInfo = document.createElement('div');
        this.memoryInfo.innerHTML = '内存监控初始化中...';
        this.panel.appendChild(this.memoryInfo);
        
        container.appendChild(this.panel);
    }

    startMonitoring() {
        if (!this.isEnabled) return;

        this.updateInterval = setInterval(() => {
            this.updateMemoryInfo();
        }, 2000);
    }

    updateMemoryInfo() {
        if (!this.memoryInfo || !performance.memory) return;

        const memory = performance.memory;
        const used = (memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
        const total = (memory.totalJSHeapSize / 1024 / 1024).toFixed(1);
        const limit = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1);

        // 获取GPU信息（从共享变量获取，避免创建新的WebGL上下文）
        let gpuInfo = '检测中...';
        try {
            if (window.performanceGPUInfo) {
                gpuInfo = window.performanceGPUInfo.substring(0, 30) + '...';
            } else {
                gpuInfo = navigator.hardwareConcurrency ? 
                    `CPU: ${navigator.hardwareConcurrency} cores` : '基本信息';
            }
        } catch (error) {
            gpuInfo = 'GPU信息获取失败';
        }

        this.memoryInfo.innerHTML = `
        <div><strong>📊 性能监控</strong></div>
            <div>内存使用: ${used}MB / ${total}MB</div>
            <div>内存限制: ${limit}MB</div>
            <div>GPU: ${gpuInfo.substring(0, 30)}...</div>
            <div>时间: ${new Date().toLocaleTimeString()}</div>
        `;

        // 内存警告
        const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        if (usagePercent > 80) {
            this.memoryInfo.style.color = '#ff4d4db8';
            console.warn(`内存使用率过高: ${usagePercent.toFixed(1)}%`);
        } else if (usagePercent > 60) {
            this.memoryInfo.style.color = '#ffcc00';
        } else {
            this.memoryInfo.style.color = '#00f0ff';
        }
    }

    // 记录模型加载信息
    logModelLoad(modelName, size, loadTime) {
        if (!this.isEnabled) return;
        
        console.log(`🎯 模型加载: ${modelName}`);
        console.log(`📦 大小: ${(size / 1024 / 1024).toFixed(2)}MB`);
        console.log(`⏱️ 耗时: ${loadTime}ms`);
    }

    // 记录FPS信息
    logFPS(fps, frameTime) {
        if (!this.isEnabled) return;
        
        if (fps < 20) {
            console.warn(`🐌 FPS过低: ${fps}, 帧时间: ${frameTime.toFixed(2)}ms`);
        }
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
            this.panel = null;
        }
        
        this.memoryInfo = null;
    }
}

// 创建单例实例
export const performanceMonitor = new ThreeJSPerformanceMonitor();
