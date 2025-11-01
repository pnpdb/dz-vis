# Linux 摄像头权限配置指南

在 Ubuntu/Linux 系统上使用 USB 摄像头时，需要正确配置系统权限。

## 🎯 问题症状

- Toast 提示：`摄像头权限被拒绝。Linux系统请确保已将用户添加到video组`
- 控制台错误：`NotAllowedError` 或 `NotReadableError`

## ✅ 解决方案

### 方案 1：将用户添加到 video 组（推荐）

这是永久性解决方案，允许当前用户访问所有视频设备。

```bash
# 1. 将当前用户添加到 video 组
sudo usermod -aG video $USER

# 2. 验证是否添加成功（重新登录后执行）
groups $USER | grep video

# 3. 重新登录或重启系统使更改生效
# 选项 A: 重新登录（推荐）
# 选项 B: 重启系统
sudo reboot

# 4. 验证摄像头设备权限
ls -l /dev/video* 
# 应该看到类似: crw-rw----+ 1 root video 81, 0 Nov  1 10:00 /dev/video0
```

### 方案 2：临时更改设备权限（测试用）

⚠️ 这只是临时方案，系统重启后会失效。

```bash
# 查找所有视频设备
ls -l /dev/video*

# 为所有用户临时授予读写权限
sudo chmod 666 /dev/video*

# 验证权限
ls -l /dev/video*
# 应该看到: crw-rw-rw- 1 root video 81, 0 Nov  1 10:00 /dev/video0
```

### 方案 3：创建 udev 规则（开发环境）

创建持久的设备权限规则。

```bash
# 1. 创建 udev 规则文件
sudo nano /etc/udev/rules.d/99-camera.rules

# 2. 添加以下内容：
# 允许 video 组访问所有视频设备
KERNEL=="video[0-9]*", GROUP="video", MODE="0660"

# 保存并退出（Ctrl+O, Enter, Ctrl+X）

# 3. 重新加载 udev 规则
sudo udevadm control --reload-rules
sudo udevadm trigger

# 4. 拔出并重新插入摄像头，或重启系统
```

## 🔍 故障排查

### 1. 检查摄像头是否被系统识别

```bash
# 查看所有视频设备
ls -l /dev/video*

# 查看设备详细信息
v4l2-ctl --list-devices

# 如果没有 v4l2-ctl，安装它：
sudo apt-get install v4l-utils
```

### 2. 检查当前用户的组

```bash
# 查看当前用户所属的所有组
groups

# 或者查看特定用户
groups $USER

# 应该在输出中看到 "video"
```

### 3. 测试摄像头是否可用

```bash
# 使用 ffplay 测试（需要安装 ffmpeg）
ffplay /dev/video0

# 或使用 cheese（图形界面摄像头应用）
sudo apt-get install cheese
cheese
```

### 4. 检查是否有其他应用占用摄像头

```bash
# 查找正在使用摄像头的进程
sudo fuser /dev/video0

# 如果有进程占用，可以查看详情
ps aux | grep <PID>

# 如果需要，可以终止占用的进程
sudo kill <PID>
```

### 5. 检查 AppArmor 配置（Ubuntu）

如果使用了 AppArmor，可能需要额外配置：

```bash
# 检查 AppArmor 状态
sudo aa-status

# 如果需要，可以临时禁用 AppArmor 测试
sudo systemctl stop apparmor
```

## 🚀 快速修复脚本

保存以下脚本为 `fix-camera-permission.sh`：

```bash
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
```

使用方法：

```bash
# 添加执行权限
chmod +x fix-camera-permission.sh

# 运行脚本
./fix-camera-permission.sh

# 重新登录或重启系统
sudo reboot
```

## 📝 开发模式建议

如果你经常需要在 Linux 上开发和测试摄像头功能，建议：

1. ✅ **永久添加用户到 video 组**（方案 1）
2. ✅ **创建 udev 规则**（方案 3）
3. ✅ **确保没有其他应用占用摄像头**
4. ✅ **使用 `v4l2-ctl` 和 `ffplay` 进行测试**

## 🐛 常见问题

### Q: 已经添加到 video 组，为什么还是不能访问？
**A:** 需要完全重新登录（注销并重新登录）或重启系统。简单地打开新终端是不够的。

### Q: 在虚拟机中使用摄像头需要特殊配置吗？
**A:** 是的，需要在虚拟机设置中启用 USB 摄像头直通，并确保虚拟机软件有权限访问宿主机的摄像头。

### Q: 为什么 `NotReadableError` 说摄像头被占用？
**A:** 这可能是因为：
- 另一个应用正在使用摄像头
- 权限不足（尝试方案 1）
- 摄像头驱动问题（检查 `dmesg | grep video`）

### Q: 在 Docker 容器中如何使用摄像头？
**A:** 需要使用 `--device` 参数映射设备：
```bash
docker run --device=/dev/video0 ...
```

## 🔗 相关链接

- [Video4Linux Wiki](https://www.kernel.org/doc/html/latest/admin-guide/media/v4l-drivers/)
- [Ubuntu 用户组管理](https://help.ubuntu.com/community/FilePermissions)
- [udev 规则编写指南](https://www.freedesktop.org/software/systemd/man/udev.html)

## ✅ 验证清单

在报告问题前，请确认：

- [ ] 已将用户添加到 video 组
- [ ] 已重新登录或重启系统
- [ ] `groups $USER` 显示包含 "video"
- [ ] `ls -l /dev/video*` 显示设备存在
- [ ] 使用 `ffplay /dev/video0` 可以看到画面
- [ ] 没有其他应用占用摄像头
- [ ] AppArmor/SELinux 没有阻止访问

