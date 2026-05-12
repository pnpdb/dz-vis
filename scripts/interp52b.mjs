import fs from 'fs';

const file = 'public/routes/52.txt';
const lines = fs.readFileSync(file, 'utf-8').trimEnd().split('\n');

// 用户标注的点，先加偏移
const raw = [
    [0.201, 0.794, 0.346],
    [0.204, 0.608, 0.343],
    [0.270, 0.413, 0.333],
    [0.446, 0.242, 0.301],
    [0.694, 0.194, 0.257],
    [1.059, 0.181, 0.192],
    [1.282, 0.187, 0.151],
    [1.340, 0.360, 0.151],
    [1.509, 0.584, 0.077],
    [1.633, 0.729, 0.015],
];

const points = raw.map(([x, y, z]) => ({ x: x + 0.38, y: y + 0.29, z }));

// 解析所有行
const parsed = lines.map(l => {
    const p = l.split(',');
    return { x: parseFloat(p[0]), y: parseFloat(p[1]) };
});

// 找每个标注点最近的行号
const matchedLines = points.map((pt, i) => {
    let bestIdx = -1, bestDist = Infinity;
    for (let j = 0; j < parsed.length; j++) {
        const d = Math.hypot(parsed[j].x - pt.x, parsed[j].y - pt.y);
        if (d < bestDist) { bestDist = d; bestIdx = j; }
    }
    console.log(`点${i}: (${pt.x.toFixed(3)},${pt.y.toFixed(3)}) z=${pt.z} => line ${bestIdx + 1} (${parsed[bestIdx].x},${parsed[bestIdx].y}) dist=${bestDist.toFixed(4)}`);
    return { idx: bestIdx, z: pt.z };
});

// 第一个匹配行之前全部设为0.346
const firstIdx = matchedLines[0].idx;
for (let i = 0; i < firstIdx; i++) {
    const p = lines[i].split(',');
    p[2] = '0.3460';
    lines[i] = p.join(',');
}

// 设置每个匹配点的Z，并在相邻匹配点之间线性插值
for (let k = 0; k < matchedLines.length; k++) {
    const p = lines[matchedLines[k].idx].split(',');
    p[2] = matchedLines[k].z.toFixed(4);
    lines[matchedLines[k].idx] = p.join(',');
}

for (let k = 0; k < matchedLines.length - 1; k++) {
    const startIdx = matchedLines[k].idx;
    const endIdx = matchedLines[k + 1].idx;
    const zStart = matchedLines[k].z;
    const zEnd = matchedLines[k + 1].z;
    const count = endIdx - startIdx;
    if (count <= 0) continue;
    for (let i = startIdx + 1; i < endIdx; i++) {
        const t = (i - startIdx) / count;
        const z = zStart + (zEnd - zStart) * t;
        const p = lines[i].split(',');
        p[2] = z.toFixed(4);
        lines[i] = p.join(',');
    }
}

// 最后一个匹配行之后全部设为0
const lastIdx = matchedLines[matchedLines.length - 1].idx;
for (let i = lastIdx + 1; i < lines.length; i++) {
    const p = lines[i].split(',');
    p[2] = '0.0000';
    lines[i] = p.join(',');
}

fs.writeFileSync(file, lines.join('\n') + '\n');
console.log('\nDone. Samples:');
for (const m of matchedLines) {
    const p = lines[m.idx].split(',');
    console.log(`  line ${m.idx + 1}: x=${p[0]} y=${p[1]} z=${p[2]}`);
}
