/**
 * Mesh平面尺寸和位置调试工具
 * 在浏览器控制台运行，动态调整平面的大小和位置
 */

(() => {
    console.log('='.repeat(80));
    console.log('📐 Mesh平面尺寸调整工具');
    console.log('='.repeat(80));

    // 获取沙盘模型
    const sandboxModel = window.__scene3d__?.models?.get('sandbox');
    if (!sandboxModel) {
        console.error('❌ 沙盘模型未找到');
        return;
    }

    // 查找所有 Mesh 平面对象
    const planes = [];
    sandboxModel.traverse((child) => {
        if (child.type === 'Mesh' && 
            child.geometry && 
            child.geometry.type === 'PlaneGeometry' &&
            child.material && 
            child.material.map) {
            planes.push(child);
        }
    });

    if (planes.length === 0) {
        console.error('❌ 未找到任何倒计时Mesh平面对象');
        return;
    }

    console.log(`✅ 找到 ${planes.length} 个倒计时Mesh平面\n`);

    planes.forEach((plane, i) => {
        console.log(`平面 ${i}:`);
        console.log(`  尺寸: ${plane.geometry.parameters.width.toFixed(3)} x ${plane.geometry.parameters.height.toFixed(3)}`);
        console.log(`  位置: (${plane.position.x.toFixed(3)}, ${plane.position.y.toFixed(3)}, ${plane.position.z.toFixed(3)})`);
        console.log(`  旋转: (${plane.rotation.x.toFixed(3)}, ${plane.rotation.y.toFixed(3)}, ${plane.rotation.z.toFixed(3)})`);
        console.log(`  可见: ${plane.visible}`);
        
        // 世界坐标
        const worldPos = new THREE.Vector3();
        plane.getWorldPosition(worldPos);
        console.log(`  世界坐标: (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`);
        console.log('');
        
        // 保存到全局变量
        window[`plane${i}`] = plane;
    });

    // 保存第一个平面到便捷变量
    if (planes.length > 0) {
        window.testPlane = planes[0];
        window.allPlanes = planes;
    }

    console.log('='.repeat(80));
    console.log('💡 调整命令:');
    console.log('');
    console.log('// 调整第一个平面的尺寸');
    console.log('testPlane.geometry.dispose();  // 先释放旧几何体');
    console.log('testPlane.geometry = new THREE.PlaneGeometry(0.15, 0.075);  // 增大');
    console.log('testPlane.geometry = new THREE.PlaneGeometry(0.10, 0.05);   // 缩小');
    console.log('');
    console.log('// 调整位置');
    console.log('testPlane.position.z += 0.01;  // 向前');
    console.log('testPlane.position.z -= 0.01;  // 向后');
    console.log('testPlane.position.y += 0.01;  // 向上');
    console.log('testPlane.position.y -= 0.01;  // 向下');
    console.log('');
    console.log('// 批量调整所有平面');
    console.log('allPlanes.forEach(p => {');
    console.log('    p.geometry.dispose();');
    console.log('    p.geometry = new THREE.PlaneGeometry(0.15, 0.075);');
    console.log('});');
    console.log('');
    console.log('// 批量调整位置');
    console.log('allPlanes.forEach(p => {');
    console.log('    p.position.y = 0.02;  // 向上偏移');
    console.log('});');
    console.log('');
    console.log('// 隐藏/显示');
    console.log('testPlane.visible = false;  // 隐藏');
    console.log('testPlane.visible = true;   // 显示');
    console.log('');
    console.log('='.repeat(80));
})();

