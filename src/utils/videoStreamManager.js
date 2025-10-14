import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { warn as plWarn, error as plError } from '@tauri-apps/plugin-log';
import { videoProcessor } from '@/utils/videoProcessor.js';
import { debounce } from '@/utils/performance.js';
import eventBus, { EVENTS } from '@/utils/eventBus.js';

class VideoStreamManager {
  constructor() {
    this.subscribers = new Map(); // vehicleId -> Set(callback)
    this.unlisten = null;
    this.frameRateTimers = new Map(); // vehicleId -> timerId
    this.frameCounts = new Map(); // vehicleId -> { count, lastTimestamp }
    this.timeoutTimers = new Map(); // vehicleId -> timerId
    this.udpServerPromise = null;
    this.activeVehicleId = null;
    this.lastFrameTimestamps = new Map();
    this.lastBlobUrls = new Map(); // vehicleId -> blobUrl (用于内存回收)
  }

  async ensureServer() {
    if (!this.udpServerPromise) {
      this.udpServerPromise = invoke('start_udp_video_server', { port: 8080 }).catch((error) => {
        this.udpServerPromise = null;
        throw error;
      });
    }
    await this.udpServerPromise;
  }

  async ensureListener() {
    if (this.unlisten) {
      return;
    }
    await this.ensureServer();
    this.unlisten = await listen('udp-video-frame', (event) => {
      this.handleFrame(event.payload);
    });
  }

  subscribe(vehicleId, callback) {
    const id = Number(vehicleId);
    if (!this.subscribers.has(id)) {
      this.subscribers.set(id, new Set());
    }
    const set = this.subscribers.get(id);
    set.add(callback);
    this.activeVehicleId = id;
    this.ensureListener().catch(async (error) => {
      try {
        await plError(`视频流监听启动失败: ${error}`);
      } catch (_) {}
    });
  }

  unsubscribe(vehicleId, callback) {
    const id = Number(vehicleId);
    const set = this.subscribers.get(id);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.subscribers.delete(id);
        if (this.activeVehicleId === id) {
          this.activeVehicleId = null;
        }
        this.cleanupVehicle(id);
      }
    }
    if (this.subscribers.size === 0 && this.unlisten) {
      this.unlisten();
      this.unlisten = null;
    }
  }

  cleanupVehicle(id) {
    const rateTimer = this.frameRateTimers.get(id);
    if (rateTimer) {
      clearInterval(rateTimer);
      this.frameRateTimers.delete(id);
    }
    const timeoutTimer = this.timeoutTimers.get(id);
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      this.timeoutTimers.delete(id);
    }
    this.frameCounts.delete(id);
    
    // 释放 Blob URL 避免内存泄漏
    const oldBlobUrl = this.lastBlobUrls.get(id);
    if (oldBlobUrl) {
      URL.revokeObjectURL(oldBlobUrl);
      this.lastBlobUrls.delete(id);
    }
  }

  startFrameRate(id) {
    if (this.frameRateTimers.has(id)) {
      return;
    }
    this.frameCounts.set(id, { count: 0, lastTimestamp: Date.now() });
    const timer = setInterval(() => {
      const info = this.frameCounts.get(id);
      if (!info) {
        return;
      }
      const now = Date.now();
      const timeDiff = now - info.lastTimestamp;
      if (timeDiff >= 1000) {
        const fps = Math.round((info.count * 1000) / timeDiff);
        info.count = 0;
        info.lastTimestamp = now;
        eventBus.emit(EVENTS.VIDEO_FPS_UPDATE, { vehicleId: id, fps });
      }
    }, 1000);
    this.frameRateTimers.set(id, timer);
  }

  resetTimeout(id) {
    const existing = this.timeoutTimers.get(id);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      eventBus.emit(EVENTS.VIDEO_STREAM_TIMEOUT, { vehicleId: id });
      const subs = Array.from(this.subscribers.get(id) || []);
      subs.forEach((callback) => {
        try {
          callback({ timeout: true });
        } catch (error) {
          console.error('视频流超时回调错误:', error);
        }
      });
    }, 3000);
    this.timeoutTimers.set(id, timer);
  }

  async handleFrame(frame) {
    const id = Number(frame.vehicle_id);
    if (!this.subscribers.has(id)) {
      if (this.activeVehicleId !== null && this.activeVehicleId !== id) {
        console.debug('[VideoStream] Frame ignored; active vehicle', this.activeVehicleId, 'frame vehicle', id,
          'subscribers known:', Array.from(this.subscribers.keys()));
      }
      return;
    }
    if (!frame.jpeg_data || frame.jpeg_data.length === 0) {
      return;
    }
    try {
      const result = await videoProcessor.processVideoFrame(
        frame.vehicle_id,
        frame.jpeg_data,
        frame.frame_id,
      );
      if (!result.success || !result.frame?.jpeg_base64) {
        try {
          plWarn(`视频帧处理失败: ${result.error || '未知错误'}`).catch(() => {});
        } catch (_) {}
        return;
      }
      const processedBinary = atob(result.frame.jpeg_base64);
      const processedArray = Uint8Array.from(processedBinary, (char) => char.charCodeAt(0));
      const blob = new Blob([processedArray], { type: 'image/jpeg' });
      const blobUrl = URL.createObjectURL(blob);

      // 释放旧的 Blob URL 避免内存泄漏
      const oldBlobUrl = this.lastBlobUrls.get(id);
      if (oldBlobUrl) {
        URL.revokeObjectURL(oldBlobUrl);
      }
      this.lastBlobUrls.set(id, blobUrl);

      const now = Date.now();
      const previousTimestamp = this.lastFrameTimestamps.get(id) || null;
      this.lastFrameTimestamps.set(id, now);
      let arrivalFps;
      if (previousTimestamp && now > previousTimestamp) {
        const interval = now - previousTimestamp;
        if (interval > 0) {
          arrivalFps = Math.min(120, Math.max(0, 1000 / interval));
        }
      }

      const subscribers = Array.from(this.subscribers.get(id) || []);
      subscribers.forEach((callback) => {
        try {
          callback({
            blobUrl,
            frame,
            stats: result.stats,
            fps: arrivalFps,
          });
        } catch (error) {
          console.error('视频帧回调执行错误:', error);
        }
      });

      const info = this.frameCounts.get(id);
      if (info) {
        info.count += 1;
      }
      this.startFrameRate(id);
      this.resetTimeout(id);
    } catch (error) {
      try {
        plError(`视频帧处理异常: ${error.message}`).catch(() => {});
      } catch (_) {}
    }
  }
}

export const videoStreamManager = new VideoStreamManager();
