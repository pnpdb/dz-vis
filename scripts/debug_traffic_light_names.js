/**
 * 红绿灯对象名称调试脚本
 * 在浏览器控制台运行，查看模型中所有红绿灯相关对象的名称
 */

(() => {
    console.log('='.repeat(80));
    console.log('🔍 红绿灯对象名称调试');
    console.log('='.repeat(80));

    // 获取沙盘模型
    const sandboxModel = window.__scene3d__?.models?.get('sandbox');
    if (!sandboxModel) {
        console.error('❌ 沙盘模型未找到');
        return;
    }

    console.log('✅ 沙盘模型已找到\n');

    // 查找所有包含 "HongLvDeng" 的对象
    const trafficLightObjects = [];
    sandboxModel.traverse((child) => {
        if (child.name && child.name.includes('HongLvDeng')) {
            trafficLightObjects.push({
                name: child.name,
                type: child.type,
                parent: child.parent?.name || '(root)',
                children: child.children?.length || 0
            });
        }
    });

    if (trafficLightObjects.length === 0) {
        console.error('❌ 未找到任何包含 "HongLvDeng" 的对象');
        return;
    }

    console.log(`✅ 找到 ${trafficLightObjects.length} 个红绿灯相关对象\n`);

    // 按类型分组显示
    const byType = {};
    trafficLightObjects.forEach(obj => {
        if (!byType[obj.type]) {
            byType[obj.type] = [];
        }
        byType[obj.type].push(obj);
    });

    Object.keys(byType).sort().forEach(type => {
        console.log(`\n📁 ${type} (${byType[type].length}个):`);
        console.log('-'.repeat(80));
        byType[type].forEach((obj, i) => {
            console.log(`${i + 1}. 名称: "${obj.name}"`);
            console.log(`   父对象: "${obj.parent}"`);
            console.log(`   子对象数: ${obj.children}`);
        });
    });

    // 显示所有唯一的对象名称
    console.log('\n' + '='.repeat(80));
    console.log('📋 所有唯一的红绿灯对象名称:');
    console.log('='.repeat(80));
    const uniqueNames = [...new Set(trafficLightObjects.map(obj => obj.name))].sort();
    uniqueNames.forEach((name, i) => {
        console.log(`${i + 1}. "${name}"`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('💡 提示：');
    console.log('1. 寻找主红绿灯对象（通常是 Object3D 或 Group 类型）');
    console.log('2. 寻找红灯、黄灯、绿灯对象（包含 Hong/Huang/Lv）');
    console.log('3. 寻找倒计时区域对象（包含 Hui）');
    console.log('4. 检查对象名称中的括号和数字格式');
    console.log('='.repeat(80));

    // 将结果保存到全局变量
    window.__trafficLightObjects__ = trafficLightObjects;
    console.log('\n✅ 结果已保存到 window.__trafficLightObjects__');
})();

