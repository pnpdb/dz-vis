<template>
  <div class="card-with-border" :class="customClass" :style="customStyle">
    <div class="card-bg"></div>
    <div class="card-border"></div>
    <div class="card-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  /**
   * 自定义类名
   */
  customClass: {
    type: String,
    default: ''
  },
  /**
   * 自定义样式
   */
  customStyle: {
    type: Object,
    default: () => ({})
  }
});
</script>

<style scoped>
.card-with-border {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgb(0, 15, 30);
  border-radius: 8px;
  z-index: 1;
}

.card-border {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 8px;
  background: 
    linear-gradient(rgba(0, 240, 255, 0.3), rgba(0, 240, 255, 0.3)) top left / 100% 2px no-repeat,
    linear-gradient(rgba(0, 240, 255, 0.3), rgba(0, 240, 255, 0.3)) top right / 2px 100% no-repeat,
    linear-gradient(rgba(0, 240, 255, 0.3), rgba(0, 240, 255, 0.3)) bottom left / 100% 2px no-repeat,
    linear-gradient(rgba(0, 240, 255, 0.3), rgba(0, 240, 255, 0.3)) top left / 2px 100% no-repeat;
  z-index: 2;
  pointer-events: none;
}

.card-content {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  height: 100%;
}
</style>

