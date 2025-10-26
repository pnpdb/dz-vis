/**
 * 倒计时更新测试脚本
 * 在浏览器控制台运行，手动测试倒计时Canvas的绘制和更新
 */

(() => {
    console.log('='.repeat(80));
    console.log('🔢 倒计时Canvas更新测试');
    console.log('='.repeat(80));

    // 测试Canvas绘制
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 512;
    testCanvas.height = 512;
    const ctx = testCanvas.getContext('2d');

    // 清空
    ctx.clearRect(0, 0, 512, 512);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 512, 512);

    const centerX = 256;
    const centerY = 256;
    const leftX = centerX - 100;
    const rightX = centerX + 100;

    // 测试绘制数字（使用新的参数）
    ctx.font = 'bold 180px Arial';  // 新的字体大小
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 个位数：在右半边显示
    rightX = centerX + 60;

    // 绘制"3"在右边
    // 1. 黑色描边
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.strokeText('3', rightX, centerY);
    
    // 2. 白色填充
    ctx.fillStyle = '#ffffff';
    ctx.fillText('3', rightX, centerY);
    
    // 3. 再绘制一次增强
    ctx.fillText('3', rightX, centerY);

    console.log('✅ 测试Canvas已创建');
    console.log('Canvas尺寸:', testCanvas.width, 'x', testCanvas.height);
    
    // 检查Canvas是否有内容
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const hasWhitePixels = imageData.data.some((val, idx) => idx % 4 < 3 && val > 200);
    console.log('Canvas有白色像素:', hasWhitePixels ? '✅ 是' : '❌ 否');

    // 保存到全局变量
    window.testCanvas = testCanvas;
    window.testCtx = ctx;

    // 显示Canvas（添加到页面右上角）
    testCanvas.style.position = 'fixed';
    testCanvas.style.top = '10px';
    testCanvas.style.right = '10px';
    testCanvas.style.width = '200px';
    testCanvas.style.height = '200px';
    testCanvas.style.border = '2px solid red';
    testCanvas.style.zIndex = '9999';
    testCanvas.style.background = 'black';
    document.body.appendChild(testCanvas);

    console.log('\n✅ 测试Canvas已添加到页面右上角（红色边框）');
    console.log('如果能看到数字"3"，说明Canvas绘制正常');
    console.log('\n💡 手动更新测试Canvas（新参数）:');
    console.log('// 清空');
    console.log('testCtx.clearRect(0, 0, 512, 512);');
    console.log('testCtx.fillStyle = "#000000";');
    console.log('testCtx.fillRect(0, 0, 512, 512);');
    console.log('// 设置字体');
    console.log('testCtx.font = "bold 180px Arial";');
    console.log('testCtx.textAlign = "center";');
    console.log('testCtx.textBaseline = "middle";');
    console.log('// 绘制数字"9"');
    console.log('testCtx.strokeStyle = "#000000";');
    console.log('testCtx.lineWidth = 8;');
    console.log('testCtx.strokeText("9", 316, 256);');
    console.log('testCtx.fillStyle = "#ffffff";');
    console.log('testCtx.fillText("9", 316, 256);');
    console.log('testCtx.fillText("9", 316, 256);');
    
    console.log('\n' + '='.repeat(80));
})();

