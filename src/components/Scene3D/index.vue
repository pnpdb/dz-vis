<template>
  <div id="scene3D" class="scene3d-container"></div>
</template>

<script setup>
import { onMounted, onUnmounted } from "vue";
import { destroyScene, initScene } from "./index.js";

let appCloseHandler = null;

onMounted(() => {
  initScene(document.getElementById("scene3D"));
  
  // 监听应用关闭事件
  appCloseHandler = () => {
    destroyScene();
  };
  window.addEventListener('beforeunload', appCloseHandler);
});

onUnmounted(() => {
  destroyScene();
  
  if (appCloseHandler) {
    window.removeEventListener('beforeunload', appCloseHandler);
  }
});
</script>

<style scoped>
#scene3D {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.scene3d-container {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1a1f25 0%, #2c3e50 100%);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}
</style>