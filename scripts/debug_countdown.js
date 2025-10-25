/**
 * 倒计时调试脚本
 * 在浏览器控制台中运行此脚本，检查倒计时Canvas和纹理状态
 * 
 * 使用方法：
 * 1. 启动应用并加载沙盘模型
 * 2. 打开浏览器控制台
 * 3. 复制粘贴此脚本并运行
 */

(() => {
    console.log('='.repeat(80));
    console.log('🔢 倒计时调试开始');
    console.log('='.repeat(80));

    // 获取沙盘模型
    const sandboxModel = window.__scene3d__?.models?.get('sandbox');
    if (!sandboxModel) {
        console.error('❌ 沙盘模型未找到！请确保模型已加载。');
        return;
    }

    console.log('✅ 沙盘模型已找到');

    // 查找所有倒计时对象
    const countdownObjects = [];
    sandboxModel.traverse((child) => {
        if (child.name && child.name.includes('WenZi')) {
            countdownObjects.push(child);
        }
    });

    console.log(`\n找到 ${countdownObjects.length} 个倒计时对象\n`);

    countdownObjects.forEach((obj, i) => {
        console.log(`\n────────────────────────────────────────`);
        console.log(`🔢 倒计时对象 ${i}: ${obj.name}`);
        console.log(`────────────────────────────────────────`);
        console.log(`  类型: ${obj.type}`);
        console.log(`  可见: ${obj.visible}`);
        
        if (obj.material) {
            console.log(`  材质:`);
            console.log(`    类型: ${obj.material.type}`);
            console.log(`    有 map 纹理: ${obj.material.map ? '✅ 是' : '❌ 否'}`);
            console.log(`    有 emissiveMap 纹理: ${obj.material.emissiveMap ? '✅ 是' : '❌ 否'}`);
            
            // 优先检查 emissiveMap（用于倒计时数字）
            const textureToCheck = obj.material.emissiveMap || obj.material.map;
            if (textureToCheck) {
                const textureName = obj.material.emissiveMap ? 'emissiveMap' : 'map';
                console.log(`    ${textureName} 纹理类型: ${textureToCheck.constructor.name}`);
                console.log(`    ${textureName} UUID: ${textureToCheck.uuid.slice(0, 8)}...`);
                
                // 如果是 CanvasTexture，尝试获取 Canvas
                if (textureToCheck.image instanceof HTMLCanvasElement) {
                    const canvas = textureToCheck.image;
                    console.log(`    Canvas 尺寸: ${canvas.width}x${canvas.height}`);
                    
                    // 检查 Canvas 内容
                    const ctx = canvas.getContext('2d');
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const hasContent = imageData.data.some(pixel => pixel > 0);
                    console.log(`    Canvas 有内容: ${hasContent ? '✅ 是' : '❌ 否'}`);
                    
                    // 存储到全局变量以便测试
                    window[`countdown_canvas_${i}`] = canvas;
                    window[`countdown_obj_${i}`] = obj;
                } else {
                    console.log(`    纹理图像类型: ${textureToCheck.image?.constructor.name || '未知'}`);
                }
            }
            
            console.log(`    颜色 (color): rgb(${Math.round(obj.material.color.r * 255)}, ${Math.round(obj.material.color.g * 255)}, ${Math.round(obj.material.color.b * 255)})`);
            console.log(`    自发光 (emissive): rgb(${Math.round(obj.material.emissive.r * 255)}, ${Math.round(obj.material.emissive.g * 255)}, ${Math.round(obj.material.emissive.b * 255)})`);
            console.log(`    自发光强度: ${obj.material.emissiveIntensity}`);
            console.log(`    透明度: ${obj.material.opacity}`);
            console.log(`    透明: ${obj.material.transparent}`);
        } else {
            console.log(`  ❌ 没有材质`);
        }
        
        if (obj.geometry) {
            console.log(`  几何体: ${obj.geometry.type}`);
            if (obj.geometry.attributes.uv) {
                console.log(`    ✅ 有 UV 坐标`);
            } else {
                console.log(`    ❌ 没有 UV 坐标（无法显示纹理）`);
            }
        }
    });

    console.log(`\n${'='.repeat(80)}`);
    console.log('🔢 倒计时调试完成');
    console.log('='.repeat(80));
    
    console.log('\n💡 全局变量访问：');
    for (let i = 0; i < countdownObjects.length; i++) {
        console.log(`   - countdown_canvas_${i}  // 第 ${i} 个倒计时的 Canvas`);
        console.log(`   - countdown_obj_${i}     // 第 ${i} 个倒计时对象`);
    }
    
    console.log('\n💡 手动测试倒计时 Canvas：');
    console.log(`   // 在 Canvas 0 上绘制测试文字`);
    console.log(`   const canvas = countdown_canvas_0;`);
    console.log(`   const ctx = canvas.getContext('2d');`);
    console.log(`   ctx.fillStyle = '#000000';`);
    console.log(`   ctx.fillRect(0, 0, canvas.width, canvas.height);`);
    console.log(`   ctx.font = 'bold 320px Arial';`);
    console.log(`   ctx.textAlign = 'center';`);
    console.log(`   ctx.textBaseline = 'middle';`);
    console.log(`   ctx.fillStyle = '#ff0000';`);
    console.log(`   ctx.fillText('99', canvas.width / 2, canvas.height / 2);`);
    console.log(`   countdown_obj_0.material.map.needsUpdate = true;`);
    console.log('\n');
})();

