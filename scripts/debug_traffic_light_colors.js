/**
 * 红绿灯颜色调试脚本
 * 在浏览器控制台中运行此脚本，检查每个灯的原始底色和当前状态
 * 
 * 使用方法：
 * 1. 启动应用并加载沙盘模型
 * 2. 打开浏览器控制台
 * 3. 复制粘贴此脚本并运行
 */

(() => {
    console.log('='.repeat(80));
    console.log('🚦 红绿灯颜色调试开始');
    console.log('='.repeat(80));

    // 获取沙盘模型
    const sandboxModel = window.__scene3d__?.models?.get('sandbox');
    if (!sandboxModel) {
        console.error('❌ 沙盘模型未找到！请确保模型已加载。');
        return;
    }

    console.log('✅ 沙盘模型已找到');

    // 查找所有灯光对象
    const lights = {
        red: [],
        yellow: [],
        green: []
    };

    sandboxModel.traverse((child) => {
        if (child.name && child.name.includes('HongLvDeng')) {
            if (child.name.includes('Hong') && !child.name.includes('HongLvDeng_')) {
                lights.red.push(child);
            } else if (child.name.includes('Huang')) {
                lights.yellow.push(child);
            } else if (child.name.includes('Lv') && !child.name.includes('HongLvDeng')) {
                lights.green.push(child);
            }
        }
    });

    console.log(`\n找到灯光对象: 红灯 ${lights.red.length} 个, 黄灯 ${lights.yellow.length} 个, 绿灯 ${lights.green.length} 个\n`);

    // 分析红灯
    if (lights.red.length > 0) {
        console.log('🔴 红灯分析：');
        lights.red.forEach((light, i) => {
            if (light.material) {
                const r = Math.round(light.material.color.r * 255);
                const g = Math.round(light.material.color.g * 255);
                const b = Math.round(light.material.color.b * 255);
                
                const er = Math.round(light.material.emissive.r * 255);
                const eg = Math.round(light.material.emissive.g * 255);
                const eb = Math.round(light.material.emissive.b * 255);
                
                console.log(`  [${i}] ${light.name}`);
                console.log(`      当前底色 (color): rgb(${r}, ${g}, ${b})`);
                console.log(`      当前发光 (emissive): rgb(${er}, ${eg}, ${eb})`);
                console.log(`      发光强度 (emissiveIntensity): ${light.material.emissiveIntensity}`);
                
                if (light.originalColor) {
                    const or = Math.round(light.originalColor.r * 255);
                    const og = Math.round(light.originalColor.g * 255);
                    const ob = Math.round(light.originalColor.b * 255);
                    console.log(`      原始底色 (originalColor): rgb(${or}, ${og}, ${ob})`);
                } else {
                    console.log(`      ⚠️  未保存原始底色`);
                }
            }
        });
    }

    // 分析黄灯
    if (lights.yellow.length > 0) {
        console.log('\n🟡 黄灯分析：');
        lights.yellow.forEach((light, i) => {
            if (light.material) {
                const r = Math.round(light.material.color.r * 255);
                const g = Math.round(light.material.color.g * 255);
                const b = Math.round(light.material.color.b * 255);
                
                const er = Math.round(light.material.emissive.r * 255);
                const eg = Math.round(light.material.emissive.g * 255);
                const eb = Math.round(light.material.emissive.b * 255);
                
                console.log(`  [${i}] ${light.name}`);
                console.log(`      当前底色 (color): rgb(${r}, ${g}, ${b})`);
                console.log(`      当前发光 (emissive): rgb(${er}, ${eg}, ${eb})`);
                console.log(`      发光强度 (emissiveIntensity): ${light.material.emissiveIntensity}`);
                
                if (light.originalColor) {
                    const or = Math.round(light.originalColor.r * 255);
                    const og = Math.round(light.originalColor.g * 255);
                    const ob = Math.round(light.originalColor.b * 255);
                    console.log(`      原始底色 (originalColor): rgb(${or}, ${og}, ${ob})`);
                } else {
                    console.log(`      ⚠️  未保存原始底色`);
                }
            }
        });
    }

    // 分析绿灯
    if (lights.green.length > 0) {
        console.log('\n🟢 绿灯分析：');
        lights.green.forEach((light, i) => {
            if (light.material) {
                const r = Math.round(light.material.color.r * 255);
                const g = Math.round(light.material.color.g * 255);
                const b = Math.round(light.material.color.b * 255);
                
                const er = Math.round(light.material.emissive.r * 255);
                const eg = Math.round(light.material.emissive.g * 255);
                const eb = Math.round(light.material.emissive.b * 255);
                
                console.log(`  [${i}] ${light.name}`);
                console.log(`      当前底色 (color): rgb(${r}, ${g}, ${b})`);
                console.log(`      当前发光 (emissive): rgb(${er}, ${eg}, ${eb})`);
                console.log(`      发光强度 (emissiveIntensity): ${light.material.emissiveIntensity}`);
                
                if (light.originalColor) {
                    const or = Math.round(light.originalColor.r * 255);
                    const og = Math.round(light.originalColor.g * 255);
                    const ob = Math.round(light.originalColor.b * 255);
                    console.log(`      原始底色 (originalColor): rgb(${or}, ${og}, ${ob})`);
                } else {
                    console.log(`      ⚠️  未保存原始底色`);
                }
            }
        });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('🚦 红绿灯颜色调试完成');
    console.log('='.repeat(80));
    
    console.log('\n💡 手动测试亮灯效果：');
    console.log('   // 点亮第一个红灯');
    console.log('   const redLight = lights.red[0];');
    console.log('   redLight.material.emissive.setHex(0xff0000);');
    console.log('   redLight.material.emissiveIntensity = 8;');
    console.log('');
    console.log('   // 熄灭第一个红灯');
    console.log('   redLight.material.emissive.setHex(0x000000);');
    console.log('   redLight.material.emissiveIntensity = 0;');
    console.log('\n');
    
    // 存储到全局变量
    window.trafficLights = lights;
})();

