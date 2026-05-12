import eventBus from '@/utils/eventBus.js';
import { vehicleToModelCoordinates, getCoordinateOffset } from '@/utils/coordinateTransform.js';
import { getRoadSurfaceY } from '@/components/Scene3D/index.js';

const ROUTE_COLORS = {
    50: '#FF3333',
    51: '#33FF33',
    52: '#3399FF',
};

const ROUTE_VEHICLE_IDS = {
    50: 9050,
    51: 9051,
    52: 9052,
};

const REFRESH_INTERVAL = 2000; // 每2秒刷新一次
let timerId = null;

function parseRouteFile(text) {
    return text
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => line.split(',').map(Number))
        .filter(p => p.length >= 3 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .map(p => ({ x: p[0], y: p[1], z: p[2] || 0 }));
}

async function refreshRoutes() {
    const roadY = getRoadSurfaceY();

    for (const routeNum of [50, 51, 52]) {
        try {
            const resp = await fetch('/routes/' + routeNum + '.txt?t=' + Date.now());
            if (!resp.ok) continue;

            const rawPoints = parseRouteFile(await resp.text());
            const offset = getCoordinateOffset();

            const modelPoints = rawPoints.map(point => {
                const mc = vehicleToModelCoordinates(point.x + offset.x, point.y + offset.y);
                return {
                    x: mc.x,
                    y: roadY + point.z + 0.015,
                    z: mc.z,
                };
            });

            // 先清除旧路径再画新的（pathRenderer内部会dispose旧几何体/材质）
            eventBus.emit('vehicle-path-clear', { vehicleId: ROUTE_VEHICLE_IDS[routeNum] });
            eventBus.emit('vehicle-path-draw', {
                vehicleId: ROUTE_VEHICLE_IDS[routeNum],
                pathPoints: modelPoints,
                color: ROUTE_COLORS[routeNum],
                timestamp: Date.now(),
            });
        } catch (_) {
            // 静默失败，下次重试
        }
    }
}

export async function drawTestRoutes() {
    console.log('[路径测试] 启动实时刷新（每' + (REFRESH_INTERVAL / 1000) + '秒），修改txt后自动更新');
    console.log('[路径测试] 红=50，绿=51，蓝=52');
    console.log('[路径测试] 停止: import("@/utils/routeTestDraw.js").then(m=>m.clearTestRoutes())');

    // 防止重复启动
    if (timerId !== null) {
        clearInterval(timerId);
    }

    // 立即绘制一次
    await refreshRoutes();

    // 定时刷新
    timerId = setInterval(refreshRoutes, REFRESH_INTERVAL);
}

export function clearTestRoutes() {
    if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
    }
    for (const routeNum of [50, 51, 52]) {
        eventBus.emit('vehicle-path-clear', { vehicleId: ROUTE_VEHICLE_IDS[routeNum] });
    }
    console.log('[路径测试] 已停止刷新并清除路径');
}
