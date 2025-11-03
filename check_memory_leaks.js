#!/usr/bin/env node

/**
 * 内存泄漏检查脚本
 * 检查所有可能导致内存泄漏的模式
 */

const fs = require('fs');
const path = require('path');

const issues = [];
const warnings = [];

// 需要检查的文件列表
const filesToCheck = [
    // JavaScript 文件
    'src/stores/car.js',
    'src/utils/socketManager.js',
    'src/utils/pathManager.js',
    'src/utils/videoStreamManager.js',
    'src/components/Scene3D/index.js',
    'src/components/Scene3D/pathRenderer.js',
    'src/components/Scene3D/vehicleManager.js',
    
    // Vue 组件
    'src/views/Map.vue',
    'src/views/Cars.vue',
    'src/views/Settings.vue',
    'src/views/ParallelDriving.vue',
    'src/components/CarInfo.vue',
    'src/components/CarCamera.vue',
    'src/components/Sensor.vue',
];

// 检查模式
const patterns = {
    setInterval: {
        register: /setInterval\s*\(/g,
        cleanup: /clearInterval\s*\(/g,
        name: 'setInterval/clearInterval'
    },
    setTimeout: {
        register: /setTimeout\s*\(/g,
        cleanup: /clearTimeout\s*\(/g,
        name: 'setTimeout/clearTimeout'
    },
    eventBusOn: {
        register: /eventBus\.on\(/g,
        cleanup: /eventBus\.off\(/g,
        name: 'eventBus.on/off'
    },
    addEventListener: {
        register: /addEventListener\s*\(/g,
        cleanup: /removeEventListener\s*\(/g,
        name: 'addEventListener/removeEventListener'
    },
    requestAnimationFrame: {
        register: /requestAnimationFrame\s*\(/g,
        cleanup: /cancelAnimationFrame\s*\(/g,
        name: 'requestAnimationFrame/cancelAnimationFrame'
    }
};

console.log('🔍 开始检查内存泄漏风险...\n');

filesToCheck.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    
    if (!fs.existsSync(fullPath)) {
        warnings.push(`⚠️  文件不存在: ${filePath}`);
        return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    Object.entries(patterns).forEach(([key, pattern]) => {
        const registerMatches = content.match(pattern.register) || [];
        const cleanupMatches = content.match(pattern.cleanup) || [];
        
        if (registerMatches.length > 0) {
            console.log(`📄 ${filePath}:`);
            console.log(`   ${pattern.name}: ${registerMatches.length} 注册, ${cleanupMatches.length} 清理`);
            
            if (cleanupMatches.length === 0) {
                issues.push({
                    file: filePath,
                    type: pattern.name,
                    register: registerMatches.length,
                    cleanup: 0,
                    severity: 'high'
                });
            } else if (registerMatches.length > cleanupMatches.length * 2) {
                warnings.push({
                    file: filePath,
                    type: pattern.name,
                    register: registerMatches.length,
                    cleanup: cleanupMatches.length,
                    severity: 'medium'
                });
            }
        }
    });
});

console.log('\n' + '='.repeat(80));

if (issues.length > 0) {
    console.log('\n❌ 发现高风险内存泄漏问题:\n');
    issues.forEach(issue => {
        console.log(`   🔴 ${issue.file}`);
        console.log(`      类型: ${issue.type}`);
        console.log(`      注册: ${issue.register} 次`);
        console.log(`      清理: ${issue.cleanup} 次`);
        console.log('');
    });
}

if (warnings.length > 0) {
    console.log('\n⚠️  潜在风险:\n');
    warnings.forEach(warning => {
        if (typeof warning === 'string') {
            console.log(`   ${warning}`);
        } else {
            console.log(`   🟡 ${warning.file}`);
            console.log(`      类型: ${warning.type}`);
            console.log(`      注册: ${warning.register} 次`);
            console.log(`      清理: ${warning.cleanup} 次`);
            console.log('');
        }
    });
}

if (issues.length === 0 && warnings.length === 0) {
    console.log('\n✅ 未发现明显的内存泄漏风险！\n');
} else {
    console.log('\n建议: 确保所有注册的监听器/定时器在组件销毁时都被正确清理。\n');
}

console.log('='.repeat(80) + '\n');

