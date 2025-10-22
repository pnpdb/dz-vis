const listeners = new Map();

export const EVENTS = {
    VEHICLE_INFO_UPDATE: 'vehicle-info-update',
    VEHICLE_CONNECTION_STATUS: 'vehicle-connection-status',
    REQUEST_VEHICLE_STATUS: 'request-vehicle-status',
    ONLINE_VEHICLES_COUNT_CHANGED: 'online-vehicles-count-changed',
    CONSTRUCTION_MARKER_ADDED: 'construction-marker-added',
    CONSTRUCTION_MARKER_REMOVED: 'construction-marker-removed',
    FPS_UPDATE: 'fps-update',
    PARALLEL_DRIVING_MODE_CHANGE: 'parallel-driving-mode-change',
    APP_RESIZE: 'app-resize',
    SCENE3D_TOPDOWN: 'scene3d-topdown',
    SCENE3D_DEFAULT: 'scene3d-default',
    SCENE3D_PROGRESS: 'scene3d-progress',
    SCENE3D_COMPLETE: 'scene3d-complete',
    VIDEO_FPS_UPDATE: 'video-fps-update',
    VIDEO_STREAM_TIMEOUT: 'video-stream-timeout',
    SANDBOX_CONNECTION_STATUS: 'sandbox-connection-status',
    SOCKET_SERVER_STARTED: 'socket-server-started',
    MENU_VISIBILITY_CHANGED: 'menu-visibility-changed'
};

const eventBus = {
    on(event, handler) {
        const bucket = listeners.get(event) || new Set();
        bucket.add(handler);
        listeners.set(event, bucket);
    },
    off(event, handler) {
        const bucket = listeners.get(event);
        if (!bucket) return;
        bucket.delete(handler);
        if (bucket.size === 0) {
            listeners.delete(event);
        }
    },
    emit(event, payload) {
        const bucket = listeners.get(event);
        if (!bucket) return;
        Array.from(bucket).forEach((handler) => {
            try {
                handler(payload);
            } catch (err) {
                console.error('eventBus handler error', err);
            }
        });
    }
};

export default eventBus;

