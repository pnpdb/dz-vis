/**
 * 车辆数据处理组合函数
 * 统一处理车辆数据的获取、转换和格式化逻辑
 */

import { ref, computed } from 'vue';
import { normalizeVehicleData, normalizeVehicleList, findVehicleById } from '@/utils/vehicleTypes.js';

/**
 * 车辆数据处理组合函数
 * @param {Object} options - 配置选项
 * @returns {Object} 车辆数据处理相关的响应式数据和方法
 */
export function useVehicleData(options = {}) {
  const {
    autoLoad = true,
    defaultVehicleId = 1
  } = options;

  // 响应式数据
  const vehicleList = ref([]);
  const selectedVehicleId = ref(defaultVehicleId);
  const loading = ref(false);
  const error = ref(null);

  // 计算属性
  const selectedVehicle = computed(() => {
    return findVehicleById(vehicleList.value, selectedVehicleId.value);
  });

  const activeVehicles = computed(() => {
    return vehicleList.value.filter(vehicle => {
      const normalized = normalizeVehicleData(vehicle);
      return normalized && normalized.isActive;
    });
  });

  const vehicleCount = computed(() => vehicleList.value.length);
  const activeVehicleCount = computed(() => activeVehicles.value.length);

  // 方法
  const setVehicleList = (rawList) => {
    try {
      vehicleList.value = normalizeVehicleList(rawList);
      error.value = null;
    } catch (err) {
      console.error('设置车辆列表失败:', err);
      error.value = err.message;
      vehicleList.value = [];
    }
  };

  const addVehicle = (rawVehicle) => {
    try {
      const normalized = normalizeVehicleData(rawVehicle);
      if (normalized) {
        // 检查是否已存在
        const existingIndex = vehicleList.value.findIndex(v => {
          const existing = normalizeVehicleData(v);
          return existing && existing.vehicleId === normalized.vehicleId;
        });

        if (existingIndex >= 0) {
          // 更新现有车辆
          vehicleList.value[existingIndex] = normalized;
        } else {
          // 添加新车辆
          vehicleList.value.push(normalized);
          vehicleList.value.sort((a, b) => a.vehicleId - b.vehicleId);
        }
      }
    } catch (err) {
      console.error('添加车辆失败:', err);
      error.value = err.message;
    }
  };

  const removeVehicle = (vehicleId) => {
    try {
      const index = vehicleList.value.findIndex(vehicle => {
        const normalized = normalizeVehicleData(vehicle);
        return normalized && normalized.vehicleId === vehicleId;
      });

      if (index >= 0) {
        vehicleList.value.splice(index, 1);
        
        // 如果删除的是当前选中的车辆，重新选择
        if (selectedVehicleId.value === vehicleId) {
          selectedVehicleId.value = vehicleList.value.length > 0 
            ? vehicleList.value[0].vehicleId 
            : defaultVehicleId;
        }
      }
    } catch (err) {
      console.error('删除车辆失败:', err);
      error.value = err.message;
    }
  };

  const updateVehicle = (vehicleId, updateData) => {
    try {
      const index = vehicleList.value.findIndex(vehicle => {
        const normalized = normalizeVehicleData(vehicle);
        return normalized && normalized.vehicleId === vehicleId;
      });

      if (index >= 0) {
        const existing = vehicleList.value[index];
        const updated = normalizeVehicleData({ ...existing, ...updateData });
        if (updated) {
          vehicleList.value[index] = updated;
        }
      }
    } catch (err) {
      console.error('更新车辆失败:', err);
      error.value = err.message;
    }
  };

  const selectVehicle = (vehicleId) => {
    const vehicle = findVehicleById(vehicleList.value, vehicleId);
    if (vehicle) {
      selectedVehicleId.value = vehicle.vehicleId;
      return true;
    }
    return false;
  };

  const clearError = () => {
    error.value = null;
  };

  const reset = () => {
    vehicleList.value = [];
    selectedVehicleId.value = defaultVehicleId;
    loading.value = false;
    error.value = null;
  };

  // 格式化方法
  const formatVehicleForDisplay = (vehicle) => {
    const normalized = normalizeVehicleData(vehicle);
    if (!normalized) return null;

    return {
      id: normalized.vehicleId,
      label: normalized.name,
      value: normalized.vehicleId,
      status: normalized.isActive ? 'online' : 'offline',
      statusText: normalized.isActive ? '在线' : '离线',
      ipAddress: normalized.ipAddress,
      battery: `${normalized.battery}%`,
      speed: normalized.speed.toFixed(2),
      position: `(${normalized.position.x.toFixed(1)}, ${normalized.position.y.toFixed(1)})`,
      lastUpdate: normalized.updatedAt ? new Date(normalized.updatedAt).toLocaleString() : '未知'
    };
  };

  const formatVehicleListForSelect = () => {
    return vehicleList.value.map(vehicle => {
      const normalized = normalizeVehicleData(vehicle);
      return {
        label: normalized.name,
        value: normalized.vehicleId,
        disabled: !normalized.isActive
      };
    });
  };

  return {
    // 响应式数据
    vehicleList,
    selectedVehicleId,
    loading,
    error,

    // 计算属性
    selectedVehicle,
    activeVehicles,
    vehicleCount,
    activeVehicleCount,

    // 方法
    setVehicleList,
    addVehicle,
    removeVehicle,
    updateVehicle,
    selectVehicle,
    clearError,
    reset,

    // 格式化方法
    formatVehicleForDisplay,
    formatVehicleListForSelect
  };
}

/**
 * 车辆状态监听组合函数
 * 统一处理车辆状态变化的事件监听
 */
export function useVehicleStatusListener() {
  const listeners = ref([]);

  const addListener = (eventName, handler) => {
    window.addEventListener(eventName, handler);
    listeners.value.push({ eventName, handler });
  };

  const removeAllListeners = () => {
    listeners.value.forEach(({ eventName, handler }) => {
      window.removeEventListener(eventName, handler);
    });
    listeners.value = [];
  };

  const addVehicleInfoListener = (handler) => {
    addListener('vehicle-info-update', handler);
  };

  const addVehicleConnectionListener = (handler) => {
    addListener('vehicle-connection-status', handler);
  };

  return {
    addListener,
    removeAllListeners,
    addVehicleInfoListener,
    addVehicleConnectionListener
  };
}
