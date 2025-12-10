/**
 * 沙盘模型尺寸诊断脚本
 * 用途：检查新的 sandbox.glb 模型的原始尺寸，确定合适的缩放比例
 * 
 * 使用方法：
 * 1. 确保已安装 three 依赖：npm install
 * 2. 运行：node scripts/debug_sandbox_model.js
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Box3, Vector3 } from 'three';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 模拟浏览器环境
global.window = global;

console.log('🔍 开始分析 sandbox.glb 模型...\n');

// 模型路径
const modelPath = join(__dirname, '../public/models/sandbox.glb');

// 读取模型文件
const modelData = readFileSync(modelPath);
const arrayBuffer = modelData.buffer.slice(
    modelData.byteOffset,
    modelData.byteOffset + modelData.byteLength
);

// 创建加载器
const loader = new GLTFLoader();

// 配置 DRACO 解码器（如果需要）
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(join(__dirname, '../public/draco/'));
loader.setDRACOLoader(dracoLoader);

// 加载模型
loader.parse(arrayBuffer, '', (gltf) => {
    const model = gltf.scene;
    
    console.log('✅ 模型加载成功\n');
    
    // 1. 原始尺寸（未缩放）
    const originalBox = new Box3().setFromObject(model);
    const originalSize = new Vector3();
    originalBox.getSize(originalSize);
    const originalCenter = originalBox.getCenter(new Vector3());
    
    console.log('📏 原始尺寸（未缩放）:');
    console.log(`  - X 轴: ${originalSize.x.toFixed(3)} 米`);
    console.log(`  - Y 轴: ${originalSize.y.toFixed(3)} 米 (高度)`);
    console.log(`  - Z 轴: ${originalSize.z.toFixed(3)} 米`);
    console.log(`  - 中心点: (${originalCenter.x.toFixed(3)}, ${originalCenter.y.toFixed(3)}, ${originalCenter.z.toFixed(3)})`);
    console.log(`  - 最小点: (${originalBox.min.x.toFixed(3)}, ${originalBox.min.y.toFixed(3)}, ${originalBox.min.z.toFixed(3)})`);
    console.log(`  - 最大点: (${originalBox.max.x.toFixed(3)}, ${originalBox.max.y.toFixed(3)}, ${originalBox.max.z.toFixed(3)})\n`);
    
    // 2. 网格统计
    let meshCount = 0;
    let totalTriangles = 0;
    let materialCount = 0;
    const meshNames = [];
    
    model.traverse((child) => {
        if (child.isMesh) {
            meshCount++;
            if (child.geometry) {
                const positionAttribute = child.geometry.attributes.position;
                if (positionAttribute) {
                    totalTriangles += positionAttribute.count / 3;
                }
            }
            if (child.material) {
                materialCount++;
            }
            if (child.name) {
                meshNames.push(child.name);
            }
        }
    });
    
    console.log('📊 模型统计:');
    console.log(`  - 网格数量: ${meshCount}`);
    console.log(`  - 三角形数量: ${Math.round(totalTriangles).toLocaleString()}`);
    console.log(`  - 材质数量: ${materialCount}\n`);
    
    // 3. 查找草坪/地面网格
    console.log('🌿 查找地面网格:');
    let groundMesh = null;
    let maxGroundArea = 0;
    
    model.traverse((child) => {
        if (child.isMesh && child.name) {
            if (child.name.includes('CaoPing') || 
                child.name.toLowerCase().includes('ground') ||
                child.name.toLowerCase().includes('floor')) {
                const meshBox = new Box3().setFromObject(child);
                const meshSize = new Vector3();
                meshBox.getSize(meshSize);
                const area = meshSize.x * meshSize.z;
                
                console.log(`  - 找到候选: ${child.name}`);
                console.log(`    尺寸: ${meshSize.x.toFixed(3)} × ${meshSize.z.toFixed(3)} (面积: ${area.toFixed(2)})`);
                
                if (area > maxGroundArea) {
                    maxGroundArea = area;
                    groundMesh = child;
                }
            }
        }
    });
    
    if (groundMesh) {
        const groundBox = new Box3().setFromObject(groundMesh);
        const groundSize = new Vector3();
        groundBox.getSize(groundSize);
        console.log(`\n✅ 最可能的地面网格: ${groundMesh.name}`);
        console.log(`  - 尺寸: ${groundSize.x.toFixed(3)} × ${groundSize.z.toFixed(3)} × ${groundSize.y.toFixed(3)} 米\n`);
    } else {
        console.log('  ⚠️ 未找到明显的地面网格\n');
    }
    
    // 4. 缩放比例建议
    console.log('🎯 缩放比例建议:');
    
    // 假设目标沙盘尺寸约为 28-30 米（缩放后）
    // 根据 PROJECT_GUIDE.md，之前的沙盘缩放后是：
    // X: -14.430 ~ 14.430 (约 28.86 米)
    // Z: -8.430 ~ 8.430 (约 16.86 米)
    const targetWidth = 28.86;  // X 方向目标尺寸
    const targetDepth = 16.86;  // Z 方向目标尺寸
    
    const scaleForWidth = targetWidth / originalSize.x;
    const scaleForDepth = targetDepth / originalSize.z;
    const recommendedScale = (scaleForWidth + scaleForDepth) / 2;
    
    console.log(`  - 当前代码使用的缩放: 6`);
    console.log(`  - 基于 X 轴的推荐缩放: ${scaleForWidth.toFixed(2)}`);
    console.log(`  - 基于 Z 轴的推荐缩放: ${scaleForDepth.toFixed(2)}`);
    console.log(`  - 平均推荐缩放: ${recommendedScale.toFixed(2)}`);
    
    // 缩放后的尺寸
    console.log('\n📐 使用不同缩放后的尺寸:');
    const scales = [1, 2, 4, 6, 8, 10, recommendedScale];
    scales.forEach(scale => {
        const scaledX = originalSize.x * scale;
        const scaledZ = originalSize.z * scale;
        const scaledY = originalSize.y * scale;
        console.log(`  - 缩放 ${scale.toFixed(2)}: ${scaledX.toFixed(2)} × ${scaledZ.toFixed(2)} × ${scaledY.toFixed(2)} 米`);
    });
    
    // 5. 相机位置建议
    console.log('\n📷 相机位置建议:');
    const currentScale = 6;
    const scaledSize = originalSize.clone().multiplyScalar(currentScale);
    const maxDimension = Math.max(scaledSize.x, scaledSize.z);
    
    // 相机距离应该是场景最大尺寸的 1.5-2 倍
    const recommendedDistance = maxDimension * 1.8;
    const recommendedHeight = maxDimension * 1.2;
    
    console.log(`  - 当前相机位置: (0, 40, 50)`);
    console.log(`  - 推荐相机位置: (0, ${recommendedHeight.toFixed(0)}, ${recommendedDistance.toFixed(0)})`);
    console.log(`  - 当前 FOV: 21°`);
    console.log(`  - 推荐 FOV: 45-60° (更宽的视角)`);
    
    // 6. 网格名称列表（前20个）
    console.log('\n📝 网格名称列表（前20个）:');
    meshNames.slice(0, 20).forEach((name, index) => {
        console.log(`  ${index + 1}. ${name}`);
    });
    if (meshNames.length > 20) {
        console.log(`  ... 还有 ${meshNames.length - 20} 个网格`);
    }
    
    console.log('\n✅ 分析完成！');
    console.log('\n💡 建议操作:');
    console.log('  1. 在浏览器控制台运行以下命令测试不同缩放:');
    console.log(`     window.__scene3d__.adjustSandboxScale(${recommendedScale.toFixed(2)})`);
    console.log('  2. 如果模型太大/太小，尝试调整缩放比例');
    console.log('  3. 如果模型不在视野中，调整相机位置:');
    console.log(`     camera.position.set(0, ${recommendedHeight.toFixed(0)}, ${recommendedDistance.toFixed(0)})`);
    console.log('  4. 如果需要更宽的视角，增加 FOV (如 45 或 60)');
    
    process.exit(0);
}, (error) => {
    console.error('❌ 模型加载失败:', error);
    process.exit(1);
});

