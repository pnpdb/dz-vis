#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================"
echo "  打包验证脚本"
echo "================================"
echo ""

# 检查 dist 目录
echo "1. 检查前端打包产物..."
if [ -d "dist" ]; then
    echo -e "${GREEN}✓${NC} dist 目录存在"
    
    if [ -f "dist/index.html" ]; then
        echo -e "${GREEN}✓${NC} index.html 存在"
    else
        echo -e "${RED}✗${NC} index.html 不存在"
        exit 1
    fi
    
    if [ -d "dist/assets" ]; then
        echo -e "${GREEN}✓${NC} assets 目录存在"
        echo "   文件数量: $(find dist/assets -type f | wc -l)"
    else
        echo -e "${YELLOW}!${NC} assets 目录不存在（可能正常）"
    fi
else
    echo -e "${RED}✗${NC} dist 目录不存在"
    echo "请先运行: npm run build"
    exit 1
fi

echo ""

# 检查 Rust 编译产物
echo "2. 检查 Rust 编译产物..."
if [ -f "src-tauri/target/release/dz-viz" ] || [ -f "src-tauri/target/release/dz-viz.exe" ]; then
    echo -e "${GREEN}✓${NC} Rust 二进制存在"
else
    echo -e "${YELLOW}!${NC} Rust 二进制不存在（开发模式正常）"
fi

echo ""

# 检查打包配置
echo "3. 检查关键配置..."

# 检查 vite.config.js 中的 base
if grep -q "base: './'," vite.config.js; then
    echo -e "${GREEN}✓${NC} vite.config.js base 配置正确"
else
    if grep -q "base:" vite.config.js; then
        echo -e "${YELLOW}!${NC} vite.config.js base 配置存在但可能不正确"
    else
        echo -e "${RED}✗${NC} vite.config.js 缺少 base 配置"
    fi
fi

# 检查 CSP 配置
if grep -q "ipc:" src-tauri/tauri.conf.json && grep -q "blob:" src-tauri/tauri.conf.json; then
    echo -e "${GREEN}✓${NC} CSP 配置包含必要协议"
else
    echo -e "${RED}✗${NC} CSP 配置可能缺少必要协议"
fi

echo ""

# 检查依赖
echo "4. 检查依赖..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules 存在"
else
    echo -e "${RED}✗${NC} node_modules 不存在"
    echo "请运行: npm install"
    exit 1
fi

echo ""

# 打包建议
echo "================================"
echo "  打包建议"
echo "================================"
echo ""
echo "开发模式运行:"
echo "  npm run tauri:dev"
echo ""
echo "生产环境打包:"
echo "  npm run tauri:build"
echo ""
echo "清理缓存重新打包:"
echo "  rm -rf dist node_modules/.vite src-tauri/target/release"
echo "  npm run build"
echo "  npm run tauri:build"
echo ""

# 显示当前配置摘要
echo "================================"
echo "  当前配置摘要"
echo "================================"
echo ""
echo "Vite base: $(grep -o "base: '[^']*'" vite.config.js || echo '未配置')"
echo "Tauri版本: $(grep '"version"' src-tauri/tauri.conf.json | head -1)"
echo "产品名称: $(grep '"productName"' src-tauri/tauri.conf.json)"
echo ""

echo -e "${GREEN}验证完成！${NC}"

