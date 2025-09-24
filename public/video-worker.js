// 视频帧处理Web Worker
// 在独立线程中处理Base64编码/解码，避免阻塞主线程

self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'encode':
            try {
                // 将Uint8Array编码为Base64
                const base64 = btoa(String.fromCharCode.apply(null, data));
                self.postMessage({
                    type: 'encoded',
                    success: true,
                    data: base64
                });
            } catch (error) {
                self.postMessage({
                    type: 'encoded',
                    success: false,
                    error: error.message
                });
            }
            break;
            
        case 'decode':
            try {
                // 将Base64解码为Uint8Array
                const binaryString = atob(data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                self.postMessage({
                    type: 'decoded',
                    success: true,
                    data: bytes
                });
            } catch (error) {
                self.postMessage({
                    type: 'decoded',
                    success: false,
                    error: error.message
                });
            }
            break;
            
        case 'createBlobUrl':
            try {
                // 创建Blob URL
                const blob = new Blob([data], { type: 'image/jpeg' });
                const url = URL.createObjectURL(blob);
                self.postMessage({
                    type: 'blobCreated',
                    success: true,
                    data: url
                });
            } catch (error) {
                self.postMessage({
                    type: 'blobCreated',
                    success: false,
                    error: error.message
                });
            }
            break;
            
        default:
            self.postMessage({
                type: 'error',
                success: false,
                error: 'Unknown message type: ' + type
            });
    }
};

// 错误处理
self.onerror = function(error) {
    self.postMessage({
        type: 'error',
        success: false,
        error: error.message
    });
};
