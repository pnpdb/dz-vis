/**
 * Sprite 尺寸和位置调试工具
 * 在浏览器控制台运行，动态调整Sprite的大小和位置
 */

(() => {
    console.log('='.repeat(80));
    console.log('📐 Sprite 尺寸调整工具');
    console.log('='.repeat(80));

    // 获取沙盘模型
    const sandboxModel = window.__scene3d__?.models?.get('sandbox');
    if (!sandboxModel) {
        console.error('❌ 沙盘模型未找到');
        return;
    }

    // 查找所有 Sprite 对象
    const sprites = [];
    sandboxModel.traverse((child) => {
        if (child.type === 'Sprite') {
            sprites.push(child);
        }
    });

    if (sprites.length === 0) {
        console.error('❌ 未找到任何 Sprite 对象');
        return;
    }

    console.log(`✅ 找到 ${sprites.length} 个 Sprite 对象`);
    console.log('');

    sprites.forEach((sprite, i) => {
        console.log(`Sprite ${i}:`);
        console.log(`  位置: (${sprite.position.x.toFixed(3)}, ${sprite.position.y.toFixed(3)}, ${sprite.position.z.toFixed(3)})`);
        console.log(`  尺寸: (${sprite.scale.x.toFixed(3)}, ${sprite.scale.y.toFixed(3)}, ${sprite.scale.z.toFixed(3)})`);
        console.log(`  可见: ${sprite.visible}`);
        console.log(`  renderOrder: ${sprite.renderOrder}`);
        
        // 世界坐标
        const worldPos = new THREE.Vector3();
        sprite.getWorldPosition(worldPos);
        console.log(`  世界坐标: (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`);
        console.log('');
        
        // 保存到全局变量
        window[`sprite${i}`] = sprite;
    });

    // 保存第一个Sprite到便捷变量
    if (sprites.length > 0) {
        window.testSprite = sprites[0];
    }

    console.log('='.repeat(80));
    console.log('💡 调整命令:');
    console.log('');
    console.log('// 调整第一个Sprite的大小');
    console.log('testSprite.scale.set(0.08, 0.04, 1);  // 增大');
    console.log('testSprite.scale.set(0.03, 0.015, 1); // 缩小');
    console.log('');
    console.log('// 调整位置（局部坐标）');
    console.log('testSprite.position.z += 0.01;  // 向前');
    console.log('testSprite.position.z -= 0.01;  // 向后');
    console.log('testSprite.position.y += 0.01;  // 向上');
    console.log('testSprite.position.y -= 0.01;  // 向下');
    console.log('');
    console.log('// 批量调整所有Sprite');
    console.log('for (let i = 0; i < ' + sprites.length + '; i++) {');
    console.log('    window[`sprite${i}`].scale.set(0.08, 0.04, 1);');
    console.log('}');
    console.log('');
    console.log('// 隐藏/显示');
    console.log('testSprite.visible = false;  // 隐藏');
    console.log('testSprite.visible = true;   // 显示');
    console.log('');
    console.log('// 检查Canvas内容（确保数字已绘制）');
    console.log('if (window.debugCountdownCanvas) {');
    console.log('    const ctx = window.debugCountdownCanvas.getContext("2d");');
    console.log('    const imageData = ctx.getImageData(0, 0, 512, 512);');
    console.log('    const hasContent = imageData.data.some((v, i) => i % 4 < 3 && v > 200);');
    console.log('    console.log("Canvas有内容:", hasContent);');
    console.log('}');
    console.log('');
    console.log('='.repeat(80));
})();

