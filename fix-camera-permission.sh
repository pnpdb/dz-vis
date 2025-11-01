#!/bin/bash

echo "🔧 修复 Linux 摄像头权限"
echo "========================"

# 检查是否以普通用户身份运行
if [ "$EUID" -eq 0 ]; then 
  echo "❌ 请以普通用户身份运行此脚本（不要使用 sudo）"
  exit 1
fi

# 检查是否已在 video 组中
if groups $USER | grep -q '\bvideo\b'; then
  echo "✅ 用户 $USER 已经在 video 组中"
else
  echo "📝 将用户 $USER 添加到 video 组..."
  sudo usermod -aG video $USER
  echo "✅ 已添加到 video 组"
  echo "⚠️  需要重新登录或重启系统才能生效"
fi

# 检查摄像头设备
echo ""
echo "📹 检查摄像头设备："
if ls /dev/video* 1> /dev/null 2>&1; then
  ls -l /dev/video*
  echo ""
  echo "✅ 找到摄像头设备"
else
  echo "❌ 未找到摄像头设备"
  echo "   请确保摄像头已连接"
fi

# 创建 udev 规则
echo ""
echo "📝 创建 udev 规则..."
echo 'KERNEL=="video[0-9]*", GROUP="video", MODE="0660"' | sudo tee /etc/udev/rules.d/99-camera.rules > /dev/null
sudo udevadm control --reload-rules
sudo udevadm trigger
echo "✅ udev 规则已创建"

echo ""
echo "🎉 配置完成！"
echo ""
echo "⚠️  重要提示："
echo "   1. 必须重新登录或重启系统使权限生效"
echo "   2. 重启后运行 'groups $USER' 验证 video 组是否生效"
echo "   3. 然后再次尝试使用摄像头"
echo ""
echo "📝 如果问题仍然存在，请查看 LINUX_CAMERA_SETUP.md 获取详细的故障排查指南"

