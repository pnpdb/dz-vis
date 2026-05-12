/**
 * 检查 "桥面" mesh 并提取信息用于路径Z轴补全
 * 步骤1：了解桥面几何体在模型空间的实际位置
 */
import { NodeIO } from '@gltf-transform/core';
import { readFile } from 'fs/promises';
import path from 'path';

const MODEL_PATH = path.resolve('public/models/sandbox-dz-mr.glb');

// 4x4矩阵工具（避免依赖three.js）
function mat4FromTRS(t, r, s) {
    // rotation quaternion to matrix
    const [qx, qy, qz, qw] = r;
    const xx = qx * qx, yy = qy * qy, zz = qz * qz;
    const xy = qx * qy, xz = qx * qz, yz = qy * qz;
    const wx = qw * qx, wy = qw * qy, wz = qw * qz;
    return [
        (1 - 2*(yy+zz))*s[0],  2*(xy+wz)*s[0],        2*(xz-wy)*s[0],        0,
        2*(xy-wz)*s[1],        (1 - 2*(xx+zz))*s[1],  2*(yz+wx)*s[1],        0,
        2*(xz+wy)*s[2],        2*(yz-wx)*s[2],        (1 - 2*(xx+yy))*s[2],  0,
        t[0],                   t[1],                   t[2],                   1,
    ];
}

function mat4Multiply(a, b) {
    const out = new Array(16).fill(0);
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            for (let k = 0; k < 4; k++) {
                out[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
            }
        }
    }
    return out;
}

function transformPoint(m, p) {
    const [x, y, z] = p;
    return [
        m[0]*x + m[4]*y + m[8]*z + m[12],
        m[1]*x + m[5]*y + m[9]*z + m[13],
        m[2]*x + m[6]*y + m[10]*z + m[14],
    ];
}

function getNodeWorldMatrix(node) {
    const t = node.getTranslation();
    const r = node.getRotation();
    const s = node.getScale();
    let local = mat4FromTRS(t, r, s);
    
    // Walk up to root
    let parent = node.getParentNode();
    while (parent) {
        const pt = parent.getTranslation();
        const pr = parent.getRotation();
        const ps = parent.getScale();
        const parentMat = mat4FromTRS(pt, pr, ps);
        local = mat4Multiply(parentMat, local);
        parent = parent.getParentNode();
    }
    return local;
}

async function inspect() {
    const io = new NodeIO();
    const doc = await io.read(MODEL_PATH);
    const root = doc.getRoot();
    
    // 1. 找到"桥面"节点
    let bridgeNode = null;
    for (const node of root.listNodes()) {
        if (node.getName() === '桥面') {
            bridgeNode = node;
            break;
        }
    }
    
    if (!bridgeNode) {
        console.error('未找到"桥面"节点');
        return;
    }
    
    // 2. 获取节点变换
    console.log('=== "桥面" 节点变换 ===');
    console.log('  Translation:', bridgeNode.getTranslation());
    console.log('  Rotation:', bridgeNode.getRotation());
    console.log('  Scale:', bridgeNode.getScale());
    
    // 打印父节点链
    let parent = bridgeNode.getParentNode();
    let depth = 0;
    while (parent) {
        depth++;
        console.log(`  父节点[${depth}] "${parent.getName()}":`);
        console.log(`    Translation: ${parent.getTranslation()}`);
        console.log(`    Rotation: ${parent.getRotation()}`);
        console.log(`    Scale: ${parent.getScale()}`);
        parent = parent.getParentNode();
    }
    
    const worldMatrix = getNodeWorldMatrix(bridgeNode);
    
    // 3. 获取桥面mesh顶点并转换到世界坐标
    const mesh = bridgeNode.getMesh();
    const prim = mesh.listPrimitives()[0];
    const posAccessor = prim.getAttribute('POSITION');
    const arr = posAccessor.getArray();
    const indices = prim.getIndices()?.getArray();
    
    console.log(`\n=== "桥面" 世界坐标范围 ===`);
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    const worldVerts = [];
    for (let i = 0; i < arr.length; i += 3) {
        const wp = transformPoint(worldMatrix, [arr[i], arr[i+1], arr[i+2]]);
        worldVerts.push(wp);
        if (wp[0] < minX) minX = wp[0];
        if (wp[0] > maxX) maxX = wp[0];
        if (wp[1] < minY) minY = wp[1];
        if (wp[1] > maxY) maxY = wp[1];
        if (wp[2] < minZ) minZ = wp[2];
        if (wp[2] > maxZ) maxZ = wp[2];
    }
    
    console.log(`  世界坐标 X: [${minX.toFixed(4)}, ${maxX.toFixed(4)}]`);
    console.log(`  世界坐标 Y(高): [${minY.toFixed(4)}, ${maxY.toFixed(4)}]`);
    console.log(`  世界坐标 Z: [${minZ.toFixed(4)}, ${maxZ.toFixed(4)}]`);
    console.log(`  顶点数: ${worldVerts.length}, 三角形数: ${indices ? indices.length / 3 : 'N/A'}`);
    
    // 4. 读取路径50-52的坐标范围
    console.log('\n=== 路径50-52 车辆坐标范围 ===');
    for (const routeNum of [50, 51, 52]) {
        const content = await readFile(`public/routes/${routeNum}.txt`, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l.trim());
        let rMinX = Infinity, rMaxX = -Infinity;
        let rMinY = Infinity, rMaxY = -Infinity;
        for (const line of lines) {
            const parts = line.split(',').map(Number);
            const [x, y] = parts;
            if (x < rMinX) rMinX = x;
            if (x > rMaxX) rMaxX = x;
            if (y < rMinY) rMinY = y;
            if (y > rMaxY) rMaxY = y;
        }
        console.log(`  路径${routeNum}: X[${rMinX.toFixed(4)}, ${rMaxX.toFixed(4)}], Y[${rMinY.toFixed(4)}, ${rMaxY.toFixed(4)}], 点数: ${lines.length}`);
    }
    
    // 5. 显示坐标转换参数供对比
    // 车辆坐标系: X(0→5.496), Y(0→4.0)
    // 模型世界坐标系: X(-3.0→3.0), Z(2.5→-2.5)
    // 模型缩放: 大约6倍（需要从实际场景获取）
    console.log('\n=== 坐标系参考 ===');
    console.log('  车辆坐标: X(0→5.496m), Y(0→4.0m)');
    console.log('  模型世界: X(-3.0→3.0), Z(2.5→-2.5)');
    console.log('  注意: 世界坐标 = 局部坐标 * 沙盘缩放');
    console.log('  桥面世界坐标需要除以沙盘缩放才能与路径计算出的模型局部坐标比较');
    
    // 找到 P1 节点获取地面 Y 高度参考
    for (const node of root.listNodes()) {
        if (node.getName() === 'P1' || node.getName() === 'P2') {
            const wm = getNodeWorldMatrix(node);
            const origin = transformPoint(wm, [0, 0, 0]);
            console.log(`\n  ${node.getName()} 世界坐标原点: (${origin[0].toFixed(4)}, ${origin[1].toFixed(4)}, ${origin[2].toFixed(4)})`);
        }
    }
}

inspect().catch(console.error);
