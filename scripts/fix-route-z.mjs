/**
 * 路径Z轴补全脚本
 * 对路径50-52的每个点，射线检测"桥面"mesh，补上正确的Z高度
 * 
 * 用法: node scripts/fix-route-z.mjs [--dry-run]
 */
import { NodeIO } from '@gltf-transform/core';
import { readFile, writeFile, copyFile } from 'fs/promises';
import path from 'path';

const MODEL_PATH = path.resolve('public/models/sandbox-dz-mr.glb');
const ROUTES_DIR = path.resolve('public/routes');
const ROUTE_FILES = [50, 51, 52];

// 车辆坐标系参数
const LOGICAL_WIDTH = 5.496;
const LOGICAL_DEPTH = 4.0;
const WORLD_MIN_X = -3.0;
const WORLD_MAX_Z = 2.5;
const WORLD_WIDTH = 6.0;
const WORLD_DEPTH = 5.0;

// 地面Y高度（P1参考值，沙盘局部坐标）
const GROUND_Y = 0.009;
// 低于此高度视为地面（避免微小浮点误差）
const MIN_BRIDGE_HEIGHT = 0.015;

const DRY_RUN = process.argv.includes('--dry-run');

// ============ 矩阵工具 ============

function mat4FromTRS(t, r, s) {
    const [qx, qy, qz, qw] = r;
    const xx = qx*qx, yy = qy*qy, zz = qz*qz;
    const xy = qx*qy, xz = qx*qz, yz = qy*qz;
    const wx = qw*qx, wy = qw*qy, wz = qw*qz;
    return [
        (1-2*(yy+zz))*s[0], 2*(xy+wz)*s[0],       2*(xz-wy)*s[0],       0,
        2*(xy-wz)*s[1],      (1-2*(xx+zz))*s[1],   2*(yz+wx)*s[1],       0,
        2*(xz+wy)*s[2],      2*(yz-wx)*s[2],       (1-2*(xx+yy))*s[2],   0,
        t[0],                 t[1],                  t[2],                  1,
    ];
}

function mat4Multiply(a, b) {
    const out = new Array(16).fill(0);
    for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++)
            for (let k = 0; k < 4; k++)
                out[j*4+i] += a[k*4+i] * b[j*4+k];
    return out;
}

function transformPoint(m, [x, y, z]) {
    return [
        m[0]*x + m[4]*y + m[8]*z  + m[12],
        m[1]*x + m[5]*y + m[9]*z  + m[13],
        m[2]*x + m[6]*y + m[10]*z + m[14],
    ];
}

function getNodeWorldMatrix(node) {
    let local = mat4FromTRS(node.getTranslation(), node.getRotation(), node.getScale());
    let parent = node.getParentNode();
    while (parent) {
        const pm = mat4FromTRS(parent.getTranslation(), parent.getRotation(), parent.getScale());
        local = mat4Multiply(pm, local);
        parent = parent.getParentNode();
    }
    return local;
}

// ============ 射线-三角形相交 (Möller–Trumbore) ============

const EPSILON = 1e-8;

function rayTriangleIntersect(rayOrigin, rayDir, v0, v1, v2) {
    const edge1 = [v1[0]-v0[0], v1[1]-v0[1], v1[2]-v0[2]];
    const edge2 = [v2[0]-v0[0], v2[1]-v0[1], v2[2]-v0[2]];
    
    const h = cross(rayDir, edge2);
    const a = dot(edge1, h);
    if (a > -EPSILON && a < EPSILON) return null;
    
    const f = 1.0 / a;
    const s = [rayOrigin[0]-v0[0], rayOrigin[1]-v0[1], rayOrigin[2]-v0[2]];
    const u = f * dot(s, h);
    if (u < 0.0 || u > 1.0) return null;
    
    const q = cross(s, edge1);
    const v = f * dot(rayDir, q);
    if (v < 0.0 || u + v > 1.0) return null;
    
    const t = f * dot(edge2, q);
    if (t > EPSILON) {
        return {
            t,
            point: [
                rayOrigin[0] + rayDir[0] * t,
                rayOrigin[1] + rayDir[1] * t,
                rayOrigin[2] + rayDir[2] * t
            ]
        };
    }
    return null;
}

function cross(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}

function dot(a, b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

// ============ 坐标转换 ============

function vehicleToWorld(vx, vy) {
    const worldX = WORLD_MIN_X + (vx / LOGICAL_WIDTH) * WORLD_WIDTH;
    const worldZ = WORLD_MAX_Z - (vy / LOGICAL_DEPTH) * WORLD_DEPTH;
    return { x: worldX, z: worldZ };
}

// ============ 主逻辑 ============

async function main() {
    console.log('=== 路径Z轴补全工具 ===\n');
    if (DRY_RUN) console.log('*** DRY RUN 模式，不写入文件 ***\n');
    
    // 1. 加载GLB，提取"桥面"三角形
    console.log('加载GLB模型...');
    const io = new NodeIO();
    const doc = await io.read(MODEL_PATH);
    const root = doc.getRoot();
    
    let bridgeNode = null;
    for (const node of root.listNodes()) {
        if (node.getName() === '桥面') { bridgeNode = node; break; }
    }
    if (!bridgeNode) { console.error('未找到"桥面"节点'); return; }
    
    const worldMatrix = getNodeWorldMatrix(bridgeNode);
    const mesh = bridgeNode.getMesh();
    const prim = mesh.listPrimitives()[0];
    const posArr = prim.getAttribute('POSITION').getArray();
    const idxArr = prim.getIndices()?.getArray();
    
    // 转换顶点到世界坐标
    const verts = [];
    for (let i = 0; i < posArr.length; i += 3) {
        verts.push(transformPoint(worldMatrix, [posArr[i], posArr[i+1], posArr[i+2]]));
    }
    
    // 构建三角形列表
    const triangles = [];
    if (idxArr) {
        for (let i = 0; i < idxArr.length; i += 3) {
            triangles.push([verts[idxArr[i]], verts[idxArr[i+1]], verts[idxArr[i+2]]]);
        }
    }
    console.log(`桥面三角形数: ${triangles.length}`);
    
    // 2. 构建简单的空间索引（按XZ网格分桶加速）
    const GRID_SIZE = 0.2; // 200mm网格
    const grid = new Map();
    for (let ti = 0; ti < triangles.length; ti++) {
        const [v0, v1, v2] = triangles[ti];
        const minGX = Math.floor(Math.min(v0[0], v1[0], v2[0]) / GRID_SIZE);
        const maxGX = Math.floor(Math.max(v0[0], v1[0], v2[0]) / GRID_SIZE);
        const minGZ = Math.floor(Math.min(v0[2], v1[2], v2[2]) / GRID_SIZE);
        const maxGZ = Math.floor(Math.max(v0[2], v1[2], v2[2]) / GRID_SIZE);
        for (let gx = minGX; gx <= maxGX; gx++) {
            for (let gz = minGZ; gz <= maxGZ; gz++) {
                const key = `${gx},${gz}`;
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key).push(ti);
            }
        }
    }
    console.log(`空间索引网格数: ${grid.size}`);
    
    // 射线向下: origin=(x, 10, z), dir=(0, -1, 0)
    const RAY_DIR = [0, -1, 0];
    
    function castRay(wx, wz) {
        const rayOrigin = [wx, 10.0, wz];
        const gx = Math.floor(wx / GRID_SIZE);
        const gz = Math.floor(wz / GRID_SIZE);
        const key = `${gx},${gz}`;
        const candidates = grid.get(key);
        if (!candidates) return null;
        
        let closest = null;
        for (const ti of candidates) {
            const [v0, v1, v2] = triangles[ti];
            const hit = rayTriangleIntersect(rayOrigin, RAY_DIR, v0, v1, v2);
            if (hit && (!closest || hit.t < closest.t)) {
                closest = hit;
            }
        }
        return closest;
    }
    
    // 3. 处理路径文件
    let totalModified = 0;
    
    for (const routeNum of ROUTE_FILES) {
        const filePath = path.join(ROUTES_DIR, `${routeNum}.txt`);
        const content = await readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n');
        
        let modified = 0;
        const newLines = [];
        
        for (let li = 0; li < lines.length; li++) {
            const line = lines[li].trim();
            if (!line) { newLines.push(line); continue; }
            
            const parts = line.split(',');
            const vx = parseFloat(parts[0]);
            const vy = parseFloat(parts[1]);
            // parts[2] = z (当前为0)
            
            // 转换到世界坐标
            const { x: wx, z: wz } = vehicleToWorld(vx, vy);
            
            // 射线检测
            const hit = castRay(wx, wz);
            let newZ = 0;
            
            if (hit) {
                const bridgeY = hit.point[1];
                const heightAboveGround = bridgeY - GROUND_Y;
                if (heightAboveGround > MIN_BRIDGE_HEIGHT) {
                    newZ = parseFloat(heightAboveGround.toFixed(4));
                }
            }
            
            if (newZ > 0) {
                parts[2] = newZ.toFixed(4);
                modified++;
            }
            
            newLines.push(parts.join(','));
        }
        
        console.log(`\n路径${routeNum}: ${lines.length}点, ${modified}点需要补Z`);
        
        if (modified > 0) {
            // 输出一些样本
            const samples = [];
            for (let li = 0; li < lines.length; li++) {
                const oldZ = parseFloat(lines[li].trim().split(',')[2]);
                const newZ = parseFloat(newLines[li].split(',')[2]);
                if (newZ > 0 && samples.length < 5) {
                    samples.push({ line: li, z: newZ });
                }
            }
            console.log(`  样本: ${samples.map(s => `行${s.line}→Z=${s.z}`).join(', ')}`);
            
            // 找Z最大值
            let maxZ = 0, maxZLine = 0;
            for (let li = 0; li < newLines.length; li++) {
                const z = parseFloat(newLines[li].split(',')[2]);
                if (z > maxZ) { maxZ = z; maxZLine = li; }
            }
            if (maxZ > 0) console.log(`  最高点: 行${maxZLine}, Z=${maxZ.toFixed(4)}m`);
        }
        
        if (!DRY_RUN && modified > 0) {
            // 备份原文件
            await copyFile(filePath, filePath + '.bak');
            await writeFile(filePath, newLines.join('\n') + '\n');
            console.log(`  ✅ 已写入 (原文件备份为 ${routeNum}.txt.bak)`);
        }
        
        totalModified += modified;
    }
    
    console.log(`\n=== 完成: 共${totalModified}个点补充了Z值 ===`);
}

main().catch(console.error);
