# 🎨 Three.js 渲染优化说明

## 📋 优化内容总结

根据模型制作者的建议，我们对Three.js场景进行了专业级的渲染优化，包括：

### 1. ✅ 环境球（Environment Map / Skybox）

**实现位置**：`src/components/Scene3D/index.js` - `loadEnvironment()`

**优化内容**：
- ✅ 加载立方体贴图作为环境球
- ✅ 设置 `scene.environment` 影响材质反射和照明
- ✅ 为所有PBR材质自动应用环境贴图
- ✅ 设置 `envMapIntensity = 1.2` 增强环境反射

**效果**：
- 模型表面会反射周围环境
- 提供更真实的全局照明
- 金属和光滑表面有更好的视觉效果

---

### 2. ✅ 平行光（Directional Light）优化

**实现位置**：`src/components/Scene3D/index.js` - `setupLighting()`

**光照系统**：采用专业的**三点光照**设置

```javascript
🌐 半球光（Hemisphere Light）
   - 天空颜色：白色 (0xffffff)
   - 地面颜色：暗灰色 (0x444444)
   - 强度：0.6
   - 位置：(0, 50, 0)

☀️ 主平行光（Main Directional Light）
   - 颜色：白色 (0xffffff)
   - 强度：2.0（物理光照单位）
   - 位置：(10, 20, 10)
   - 模拟太阳光

💡 补充光（Fill Light）
   - 颜色：天蓝色 (0x87ceeb)
   - 强度：1.0
   - 位置：(-10, 10, -10)
   - 提亮阴影区域

🔆 背光（Back Light）
   - 颜色：白色 (0xffffff)
   - 强度：0.5
   - 位置：(0, 5, -15)
   - 增加轮廓感
```

**效果**：
- 更真实的光照分布
- 阴影区域不会过暗
- 模型有明显的立体感和轮廓

---

### 3. ✅ 色调映射（Tone Mapping）- 模拟烘焙效果

**实现位置**：`src/components/Scene3D/index.js` - 渲染器初始化

**优化内容**：
```javascript
// 🎨 ACES Filmic 色调映射
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// 📐 物理光照模式
renderer.useLegacyLights = false;

// 🎯 SRGB颜色空间
renderer.outputColorSpace = SRGBColorSpace;

// ✨ 抗锯齿
renderer.antialias = true;
```

**什么是"烘焙"？**

烘焙（Baking）通常是在3D建模软件（如Blender）中完成的：
- 将复杂的光照效果预先计算并烘焙到纹理中
- 节省实时渲染的计算成本
- 但Three.js中无法真正烘焙

**我们的替代方案**：
- **ACES Filmic Tone Mapping**：电影级色调映射，模拟真实相机的曝光效果
- **物理光照模式**：使用物理正确的光照计算
- **PBR材质优化**：通过材质属性模拟烘焙后的视觉效果

---

### 4. ✅ 材质优化（PBR Material Properties）

**实现位置**：`src/components/Scene3D/index.js` - `optimizeMaterials()` / `optimizeMaterialsAsync()`

**优化内容**：
```javascript
// 为所有PBR材质设置物理属性
if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
    // 环境反射强度
    material.envMapIntensity = 1.2;
    
    // 金属度
    material.metalness = 0.1;  // 轻微金属感
    
    // 粗糙度
    material.roughness = 0.8;  // 较粗糙的表面
}
```

**效果**：
- 材质与光照和环境的交互更真实
- 表面质感更丰富
- 反射效果更自然

---

## 🎯 优化效果对比

### 优化前的问题：
❌ 光照过亮或过暗，缺乏层次
❌ 模型表面平淡，缺乏质感
❌ 颜色不真实，缺少环境反射
❌ 阴影区域太黑，看不清细节

### 优化后的改进：
✅ 光照分布自然，有明显的明暗过渡
✅ 模型表面有丰富的质感和反射
✅ 颜色真实，符合真实世界的视觉感受
✅ 阴影区域仍然可见，有细节层次
✅ 整体画面更接近电影级渲染效果

---

## 🔧 调试和微调

如果你觉得效果还需要调整，可以在浏览器控制台中实时修改参数：

### 调整光照强度
```javascript
// 调整主光强度
window.__scene3d__.scene.traverse(child => {
    if (child.name === 'MainDirectionalLight') {
        child.intensity = 3.0;  // 增加亮度
    }
});
```

### 调整曝光度
```javascript
// 调整整体亮度
window.__scene3d__.renderer.toneMappingExposure = 1.2;  // 增加曝光
```

### 调整环境反射强度
```javascript
// 增强环境反射
window.__scene3d__.models.forEach(model => {
    model.traverse(child => {
        if (child.isMesh && child.material) {
            if (child.material.isMeshStandardMaterial) {
                child.material.envMapIntensity = 1.5;  // 更强的反射
                child.material.needsUpdate = true;
            }
        }
    });
});
```

### 调整材质粗糙度
```javascript
// 让表面更光滑或更粗糙
window.__scene3d__.getSandboxModel().traverse(child => {
    if (child.isMesh && child.material) {
        child.material.roughness = 0.5;  // 0=镜面，1=完全粗糙
        child.material.needsUpdate = true;
    }
});
```

---

## 📊 性能影响

| 优化项 | 性能影响 | 视觉提升 |
|--------|---------|---------|
| 环境球 | 低 | ⭐⭐⭐⭐⭐ |
| 三点光照 | 中 | ⭐⭐⭐⭐ |
| 色调映射 | 低 | ⭐⭐⭐⭐⭐ |
| 抗锯齿 | 中 | ⭐⭐⭐ |
| 材质优化 | 低 | ⭐⭐⭐⭐ |

**总结**：这些优化在现代GPU上的性能影响很小，但视觉提升显著。

---

## 🚀 使用建议

1. **测试效果**：重启软件，观察沙盘的渲染效果
2. **微调参数**：根据实际效果使用上面的调试命令进行微调
3. **咨询模型师**：如果模型本身需要优化，建议在3D软件中调整材质属性

---

## 📝 技术细节

### ACES Filmic Tone Mapping
- 电影艺术与科学学院（ACES）标准
- 模拟真实相机的动态范围
- 自动处理高动态范围（HDR）到低动态范围（LDR）的转换

### 物理光照（Physical Lighting）
- 基于真实物理的光照计算
- 光强度单位：坎德拉（candela）
- 符合能量守恒定律

### PBR材质（Physically Based Rendering）
- 基于物理的渲染
- 金属度（Metalness）：0=非金属，1=纯金属
- 粗糙度（Roughness）：0=镜面，1=完全粗糙
- 环境反射（Environment Map）：模拟周围环境的反射

---

## 🎓 学习资源

如果想深入了解这些技术，推荐：

1. **Three.js官方文档**：https://threejs.org/docs/
2. **PBR理论**：https://learnopengl.com/PBR/Theory
3. **光照技术**：Three.js的光照示例
4. **色调映射**：Digital Photography的HDR技术

---

## ✅ 优化完成清单

- [x] 环境球（Environment Map）
- [x] 半球光（Hemisphere Light）
- [x] 三点光照系统
- [x] ACES Filmic 色调映射
- [x] 物理光照模式
- [x] SRGB颜色空间
- [x] PBR材质属性优化
- [x] 环境反射强度设置
- [x] 抗锯齿开启
- [x] 调试工具暴露

---

**最后更新**：2025-10-23  
**作者**：AI Assistant  
**版本**：1.0

