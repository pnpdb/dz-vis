import fs from 'fs';

const file = 'public/routes/52.txt';
const lines = fs.readFileSync(file, 'utf-8').trimEnd().split('\n');

// Segment 2 (file order): line 315→334, XY: (1.194,0.197)→(1.338,0.353), Z: 0.167→0.154
for (let i = 314; i <= 333; i++) {
    const t = (i - 314) / (333 - 314);
    const p = lines[i].split(',');
    p[0] = (1.194 + 0.144 * t).toFixed(4);
    p[1] = (0.197 + 0.156 * t).toFixed(4);
    p[2] = (0.167 - 0.013 * t).toFixed(4);
    lines[i] = p.join(',');
}

// Segment 1 (file order): line 334→418, XY: (1.338,0.353)→(1.757,0.769), Z: 0.154→0.000
for (let i = 333; i <= 417; i++) {
    const t = (i - 333) / (417 - 333);
    const p = lines[i].split(',');
    p[0] = (1.338 + 0.419 * t).toFixed(4);
    p[1] = (0.353 + 0.416 * t).toFixed(4);
    p[2] = (0.154 - 0.154 * t).toFixed(4);
    lines[i] = p.join(',');
}

fs.writeFileSync(file, lines.join('\n') + '\n');
console.log('Done');
