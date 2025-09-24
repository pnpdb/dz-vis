/**
 * Error handling utilities for DZ Car Manager
 */

export class TauriError extends Error {
    constructor(message, code = null) {
        super(message);
        this.name = 'TauriError';
        this.code = code;
        this.timestamp = new Date().toISOString();
    }
}

export class ErrorHandler {
    static errorQueue = [];
    static maxQueueSize = 50;

    static async handle(error, context = {}) {
        const errorDetails = {
            id: `err_${Date.now()}`,
            timestamp: new Date().toISOString(),
            message: error.message || 'Unknown error',
            name: error.name || 'Error',
            context,
            severity: this.determineSeverity(error)
        };

        this.addToQueue(errorDetails);
        this.logError(errorDetails);

        if (this.shouldShowToUser(error)) {
            await this.showUserNotification(errorDetails);
        }

        return errorDetails;
    }

    static determineSeverity(error) {
        if (error instanceof TauriError) return 'error';
        if (error.name === 'NetworkError') return 'warning';
        return 'error';
    }

    static shouldShowToUser(error) {
        return error instanceof TauriError || error.name === 'NetworkError';
    }

    static addToQueue(errorDetails) {
        this.errorQueue.unshift(errorDetails);
        if (this.errorQueue.length > this.maxQueueSize) {
            this.errorQueue = this.errorQueue.slice(0, this.maxQueueSize);
        }
    }

    static logError(errorDetails) {
        const logLevel = errorDetails.severity === 'error' ? 'error' : 'warn';
        console[logLevel](`[${errorDetails.id}] ${errorDetails.message}`, errorDetails);
    }

    static async showUserNotification(errorDetails) {
        try {
            const { TauriUtils } = await import('./tauri.js');
            await TauriUtils.showNotification(
                'Error',
                errorDetails.message
            );
        } catch (err) {
            console.error('Failed to show notification:', err);
        }
    }

    static getRecentErrors(limit = 10) {
        return this.errorQueue.slice(0, limit);
    }

    static clearErrors() {
        this.errorQueue = [];
    }
}

export function setupGlobalErrorHandling() {
    // 处理未捕获的Promise rejection
    window.addEventListener('unhandledrejection', (event) => {
        ErrorHandler.handle(event.reason, { 
            type: 'unhandledrejection',
            url: window.location.href,
            userAgent: navigator.userAgent
        });
        // 防止控制台显示未处理的rejection错误
        event.preventDefault();
    });

    // 处理未捕获的JavaScript错误
    window.addEventListener('error', (event) => {
        ErrorHandler.handle(event.error, { 
            type: 'uncaughtError',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            url: window.location.href
        });
    });

    // 处理资源加载错误
    window.addEventListener('error', (event) => {
        if (event.target !== window) {
            ErrorHandler.handle(new Error(`资源加载失败: ${event.target.src || event.target.href}`), {
                type: 'resourceError',
                element: event.target.tagName,
                source: event.target.src || event.target.href
            });
        }
    }, true);
}

export default ErrorHandler;