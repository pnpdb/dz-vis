/**
 * 倒计时UV坐标检查脚本
 * 在浏览器控制台运行，分析UV映射问题
 */

(() => {
    console.log('='.repeat(80));
    console.log('🔍 倒计时UV坐标检查');
    console.log('='.repeat(80));

    // 获取沙盘模型
    const sandboxModel = window.__scene3d__?.models?.get('sandbox');
    if (!sandboxModel) {
        console.error('❌ 沙盘模型未找到');
        return;
    }

    // 查找所有倒计时对象（新模型使用 MD_HongLvDeng_Hui 作为倒计时区域）
    const countdowns = [];
    sandboxModel.traverse((child) => {
        if (child.name && child.name.includes('MD_HongLvDeng_Hui') && child.geometry) {
            countdowns.push(child);
        }
    });

    if (countdowns.length === 0) {
        console.error('❌ 未找到倒计时对象');
        return;
    }

    console.log(`✅ 找到 ${countdowns.length} 个倒计时对象\n`);

    countdowns.forEach((obj, i) => {
        console.log(`倒计时 ${i}: ${obj.name}`);
        console.log(`  类型: ${obj.type}`);
        console.log(`  几何体类型: ${obj.geometry.type}`);
        
        const geo = obj.geometry;
        
        // 检查是否有UV坐标
        if (!geo.attributes.uv) {
            console.error(`  ❌ 没有UV坐标！这是问题所在！`);
            console.log('');
            return;
        }
        
        console.log(`  ✅ 有UV坐标`);
        
        // 分析UV坐标
        const uvArray = geo.attributes.uv.array;
        const uvCount = uvArray.length / 2;
        console.log(`  UV坐标点数: ${uvCount}`);
        
        // 计算UV坐标的范围
        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;
        
        for (let j = 0; j < uvArray.length; j += 2) {
            const u = uvArray[j];
            const v = uvArray[j + 1];
            minU = Math.min(minU, u);
            maxU = Math.max(maxU, u);
            minV = Math.min(minV, v);
            maxV = Math.max(maxV, v);
        }
        
        console.log(`  UV范围:`);
        console.log(`    U: [${minU.toFixed(4)}, ${maxU.toFixed(4)}] (宽度: ${(maxU - minU).toFixed(4)})`);
        console.log(`    V: [${minV.toFixed(4)}, ${maxV.toFixed(4)}] (高度: ${(maxV - minV).toFixed(4)})`);
        
        // 判断UV是否有问题
        const uWidth = maxU - minU;
        const vHeight = maxV - minV;
        
        console.log(`\n  🔍 UV问题诊断:`);
        
        if (uWidth < 0.1 || vHeight < 0.1) {
            console.error(`  ❌ 严重问题：UV覆盖范围太小！`);
            console.error(`     当前覆盖: ${(uWidth * 100).toFixed(2)}% x ${(vHeight * 100).toFixed(2)}%`);
            console.error(`     这意味着512x512的Canvas只有很小一部分被映射到模型上`);
            console.error(`     数字可能在UV范围之外，所以看不见`);
        } else if (uWidth < 0.3 || vHeight < 0.3) {
            console.warn(`  ⚠️  UV覆盖范围较小`);
            console.warn(`     当前覆盖: ${(uWidth * 100).toFixed(2)}% x ${(vHeight * 100).toFixed(2)}%`);
            console.warn(`     可能导致数字显示不全或模糊`);
        } else {
            console.log(`  ✅ UV覆盖范围正常: ${(uWidth * 100).toFixed(2)}% x ${(vHeight * 100).toFixed(2)}%`);
        }
        
        // 检查UV是否标准化（0-1范围）
        if (minU < 0 || maxU > 1 || minV < 0 || maxV > 1) {
            console.warn(`  ⚠️  UV坐标超出标准范围[0,1]，可能需要纹理重复模式`);
        }
        
        // 检查UV中心点
        const centerU = (minU + maxU) / 2;
        const centerV = (minV + maxV) / 2;
        console.log(`  UV中心点: (${centerU.toFixed(4)}, ${centerV.toFixed(4)})`);
        
        // 显示前10个UV坐标
        console.log(`\n  前10个UV坐标:`);
        for (let j = 0; j < Math.min(10, uvCount); j++) {
            const u = uvArray[j * 2];
            const v = uvArray[j * 2 + 1];
            console.log(`    UV[${j}]: (${u.toFixed(4)}, ${v.toFixed(4)})`);
        }
        
        console.log('');
        
        // 保存到全局变量
        window[`countdown${i}`] = obj;
        window[`countdownGeo${i}`] = geo;
    });

    console.log('='.repeat(80));
    console.log('📋 给建模工程师的说明：');
    console.log('');
    console.log('1. 倒计时对象名称: MD_HongLvDeng_Hui (及其带后缀的实例)');
    console.log('   注意：新模型已将倒计时区域从 MD_HongLvDeng_WenZi 改为 MD_HongLvDeng_Hui');
    console.log('   并且移除了上面的88装饰数字');
    console.log('');
    console.log('2. UV坐标要求:');
    console.log('   - ✅ 理想状态：UV范围覆盖整个纹理空间 [0,0] 到 [1,1]');
    console.log('   - ⚠️  最低要求：UV覆盖至少 50% 的纹理空间');
    console.log('   - ❌ 问题状态：UV覆盖范围 < 10% 时，数字将无法显示');
    console.log('');
    console.log('3. 纹理尺寸: 512x512像素');
    console.log('   - 数字绘制在Canvas中心区域');
    console.log('   - 单个数字约在 (256, 256) 位置，字体大小320px');
    console.log('   - 两个数字会水平居中排列');
    console.log('');
    console.log('4. 如何修复UV（在Blender中）:');
    console.log('   a) 选择倒计时对象 MD_HongLvDeng_Hui');
    console.log('   b) Tab键进入编辑模式');
    console.log('   c) 切换到UV编辑器');
    console.log('   d) A键选择所有UV点');
    console.log('   e) U键 → "Unwrap" 或 "Smart UV Project"');
    console.log('   f) S键缩放UV，使其完全覆盖[0,0]到[1,1]区域');
    console.log('   g) 确保UV不超出[0,1]范围');
    console.log('');
    console.log('='.repeat(80));
})();

