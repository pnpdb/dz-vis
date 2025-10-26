/**
 * 倒计时纹理调试脚本
 * 检查倒计时材质的纹理应用和显示情况
 */

(() => {
    console.log('='.repeat(80));
    console.log('🔍 倒计时纹理调试');
    console.log('='.repeat(80));

    // 获取沙盘模型
    const sandboxModel = window.__scene3d__?.models?.get('sandbox');
    if (!sandboxModel) {
        console.error('❌ 沙盘模型未找到');
        return;
    }

    console.log('✅ 沙盘模型已找到');

    // 查找第一个倒计时对象
    let countdownObj = null;
    sandboxModel.traverse((child) => {
        if (!countdownObj && child.name && child.name.includes('WenZi')) {
            countdownObj = child;
        }
    });

    if (!countdownObj) {
        console.error('❌ 未找到倒计时对象');
        return;
    }

    console.log('\n📊 倒计时对象信息:');
    console.log('  名称:', countdownObj.name);
    console.log('  类型:', countdownObj.type);
    console.log('  可见:', countdownObj.visible);

    if (!countdownObj.material) {
        console.error('❌ 倒计时对象没有材质');
        return;
    }

    const mat = countdownObj.material;
    console.log('\n🎨 材质信息:');
    console.log('  类型:', mat.type);
    console.log('  颜色:', mat.color);
    console.log('  发光颜色:', mat.emissive);
    console.log('  发光强度:', mat.emissiveIntensity);
    console.log('  透明度:', mat.opacity);
    console.log('  启用透明:', mat.transparent);

    console.log('\n🖼️ 纹理信息:');
    console.log('  map:', mat.map ? '✅ 存在' : '❌ 无');
    console.log('  emissiveMap:', mat.emissiveMap ? '✅ 存在' : '❌ 无');
    
    if (mat.map) {
        console.log('\n  map详情:');
        console.log('    类型:', mat.map.constructor.name);
        console.log('    尺寸:', mat.map.image?.width, 'x', mat.map.image?.height);
        console.log('    needsUpdate:', mat.map.needsUpdate);
    }
    
    if (mat.emissiveMap) {
        console.log('\n  emissiveMap详情:');
        console.log('    类型:', mat.emissiveMap.constructor.name);
        console.log('    尺寸:', mat.emissiveMap.image?.width, 'x', mat.emissiveMap.image?.height);
        console.log('    needsUpdate:', mat.emissiveMap.needsUpdate);
        console.log('    与map相同:', mat.map === mat.emissiveMap ? '✅ 是' : '❌ 否');
    }

    console.log('\n🔧 几何体信息:');
    if (countdownObj.geometry) {
        console.log('  类型:', countdownObj.geometry.type);
        console.log('  顶点数:', countdownObj.geometry.attributes.position?.count || 'N/A');
        console.log('  有UV:', countdownObj.geometry.attributes.uv ? '✅ 是' : '❌ 否');
        
        if (countdownObj.geometry.attributes.uv) {
            const uvArray = countdownObj.geometry.attributes.uv.array;
            console.log('  UV坐标数量:', uvArray.length / 2);
            console.log('  UV坐标范围:');
            let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
            for (let i = 0; i < uvArray.length; i += 2) {
                minU = Math.min(minU, uvArray[i]);
                maxU = Math.max(maxU, uvArray[i]);
                minV = Math.min(minV, uvArray[i + 1]);
                maxV = Math.max(maxV, uvArray[i + 1]);
            }
            console.log(`    U: [${minU.toFixed(3)}, ${maxU.toFixed(3)}]`);
            console.log(`    V: [${minV.toFixed(3)}, ${maxV.toFixed(3)}]`);
        }
    }

    // 保存到全局变量
    window.debugCountdown = countdownObj;
    window.debugCountdownMat = mat;

    console.log('\n💡 测试建议:');
    console.log('  1. 检查Canvas内容:');
    console.log('     window.debugCountdownCanvas');
    console.log('  2. 检查3D对象:');
    console.log('     window.debugCountdown');
    console.log('  3. 手动更新发光强度:');
    console.log('     debugCountdownMat.emissiveIntensity = 100;');
    console.log('  4. 手动更新颜色:');
    console.log('     debugCountdownMat.emissive.setHex(0xff0000);');
    console.log('  5. 强制更新纹理:');
    console.log('     debugCountdownMat.map.needsUpdate = true;');
    console.log('     debugCountdownMat.emissiveMap.needsUpdate = true;');
    console.log('     debugCountdownMat.needsUpdate = true;');

    console.log('\n' + '='.repeat(80));
})();

