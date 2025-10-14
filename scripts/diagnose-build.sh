#!/bin/bash

echo "================================"
echo "  打包诊断脚本"
echo "================================"
echo ""

# 检查打包产物
echo "1. 检查打包产物..."
if [ -d "dist" ]; then
    echo "✓ dist 目录存在"
    echo "  文件总数: $(find dist -type f | wc -l)"
    echo ""
    
    echo "2. 检查 index.html..."
    if [ -f "dist/index.html" ]; then
        echo "✓ index.html 存在"
        echo ""
        echo "  内容预览:"
        head -20 dist/index.html | sed 's/^/    /'
        echo ""
    fi
    
    echo "3. 检查 JS 文件..."
    js_count=$(find dist/assets/js -name "*.js" 2>/dev/null | wc -l)
    echo "  JS 文件数量: $js_count"
    if [ $js_count -gt 0 ]; then
        echo "  主要 JS 文件:"
        ls -lh dist/assets/js/*.js 2>/dev/null | awk '{print "    " $9 " (" $5 ")"}'
    fi
    echo ""
    
    echo "4. 检查 CSS 文件..."
    css_count=$(find dist/assets/css -name "*.css" 2>/dev/null | wc -l)
    echo "  CSS 文件数量: $css_count"
    echo ""
    
    echo "5. 检查静态资源..."
    echo "  图片: $(find dist/Image -type f 2>/dev/null | wc -l) 个"
    echo "  模型: $(find dist/model -name "*.glb" 2>/dev/null | wc -l) 个"
    echo ""
else
    echo "✗ dist 目录不存在！请先运行: npm run build"
    exit 1
fi

echo "================================"
echo "  配置检查"
echo "================================"
echo ""

echo "6. Vite 配置..."
if grep -q "base: './'," vite.config.js; then
    echo "✓ base 配置正确 (相对路径)"
else
    echo "✗ base 配置可能有问题"
    echo "  当前配置:"
    grep "base:" vite.config.js | sed 's/^/    /'
fi
echo ""

echo "7. Tauri 配置..."
echo "  CSP 策略:"
grep '"csp":' src-tauri/tauri.conf.json | sed 's/^/    /'
echo ""

echo "8. 前端配置..."
echo "  frontendDist:"
grep '"frontendDist":' src-tauri/tauri.conf.json | sed 's/^/    /'
echo ""

echo "================================"
echo "  打包建议"
echo "================================"
echo ""
echo "如果打包后白屏，请执行以下步骤："
echo ""
echo "1. 重新打包:"
echo "   rm -rf dist src-tauri/target/release/bundle"
echo "   npm run tauri:build"
echo ""
echo "2. 查看Rust日志:"
echo "   tail -f ~/Library/Logs/com.dz.carmanager/*.log"
echo ""
echo "3. 检查开发者工具是否打开"
echo "   应该会自动打开，查看Console标签"
echo ""
echo "4. 常见问题:"
echo "   - CSP 阻止: 查看是否有 'Refused to...' 错误"
echo "   - 路径错误: 查看是否有 404 错误"
echo "   - JS 错误: 查看是否有 JavaScript 报错"
echo ""

