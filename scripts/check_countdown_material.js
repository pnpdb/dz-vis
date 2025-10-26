/**
 * 倒计时材质检查脚本
 * 在浏览器控制台运行，检查倒计时材质的颜色和纹理状态
 */

(() => {
    console.log('='.repeat(80));
    console.log('🔍 倒计时材质检查');
    console.log('='.repeat(80));

    // 获取沙盘模型
    const sandboxModel = window.__scene3d__?.models?.get('sandbox');
    if (!sandboxModel) {
        console.error('❌ 沙盘模型未找到');
        return;
    }

    // 查找所有倒计时对象
    const countdowns = [];
    sandboxModel.traverse((child) => {
        if (child.name && child.name.includes('WenZi') && child.material) {
            countdowns.push(child);
        }
    });

    if (countdowns.length === 0) {
        console.error('❌ 未找到倒计时对象');
        return;
    }

    console.log(`✅ 找到 ${countdowns.length} 个倒计时对象\n`);

    countdowns.forEach((obj, i) => {
        const mat = obj.material;
        
        console.log(`倒计时 ${i}: ${obj.name}`);
        console.log(`  可见: ${obj.visible ? '✅ 是' : '❌ 否'}`);
        console.log(`  材质类型: ${mat.type}`);
        
        // 颜色信息
        const colorHex = '#' + mat.color.getHexString();
        const emissiveHex = '#' + mat.emissive.getHexString();
        console.log(`  基础颜色 (color): ${colorHex} - ${colorHex === '#000000' ? '✅ 黑色（正确）' : '❌ 不是黑色'}`);
        console.log(`  发光颜色 (emissive): ${emissiveHex} - ${emissiveHex === '#ffffff' ? '✅ 白色（正确）' : '❌ 不是白色'}`);
        console.log(`  发光强度 (emissiveIntensity): ${mat.emissiveIntensity}`);
        
        // 纹理信息
        console.log(`  map纹理: ${mat.map ? '❌ 存在（应该移除）' : '✅ 无（正确）'}`);
        console.log(`  emissiveMap纹理: ${mat.emissiveMap ? '✅ 存在（正确）' : '❌ 无'}`);
        
        if (mat.emissiveMap) {
            console.log(`    emissiveMap类型: ${mat.emissiveMap.constructor.name}`);
            if (mat.emissiveMap.image) {
                console.log(`    emissiveMap尺寸: ${mat.emissiveMap.image.width} x ${mat.emissiveMap.image.height}`);
            }
        }
        
        console.log('');
        
        // 保存到全局变量
        window[`countdown${i}`] = obj;
        window[`countdownMat${i}`] = mat;
    });

    // 保存第一个到便捷变量
    if (countdowns.length > 0) {
        window.testCountdown = countdowns[0];
        window.testCountdownMat = countdowns[0].material;
    }

    console.log('='.repeat(80));
    console.log('💡 手动调整命令:');
    console.log('');
    console.log('// 调整发光强度');
    console.log('testCountdownMat.emissiveIntensity = 100;  // 更亮');
    console.log('testCountdownMat.emissiveIntensity = 30;   // 更暗');
    console.log('testCountdownMat.needsUpdate = true;');
    console.log('');
    console.log('// 确保"88"完全隐藏');
    console.log('testCountdownMat.color.setHex(0x000000);  // 纯黑底色');
    console.log('testCountdownMat.map = null;               // 移除原始纹理');
    console.log('testCountdownMat.needsUpdate = true;');
    console.log('');
    console.log('// 隐藏倒计时对象（极端方案）');
    console.log('testCountdown.visible = false;');
    console.log('');
    console.log('='.repeat(80));
})();

