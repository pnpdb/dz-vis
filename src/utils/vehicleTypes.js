/**
 * 车辆类型定义和工具函数
 * 统一车辆ID的类型处理和验证
 */

/**
 * 车辆ID类型定义
 * @typedef {number} VehicleId - 车辆ID，统一使用正整数
 */

/**
 * 安全的车辆ID解析函数
 * 将任意类型的输入转换为有效的车辆ID
 * @param {any} id - 输入的ID值
 * @param {number} defaultValue - 默认值，当解析失败时使用
 * @returns {VehicleId} 有效的车辆ID
 */
export const parseVehicleId = (id, defaultValue = 1) => {
  // 如果已经是有效的正整数，直接返回
  if (typeof id === 'number' && Number.isInteger(id) && id > 0) {
    return id;
  }
  
  // 如果是字符串，尝试转换
  if (typeof id === 'string') {
    const trimmed = id.trim();
    
    // 处理字母ID映射（向后兼容）
    const letterMap = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
    if (letterMap[trimmed.toUpperCase()]) {
      return letterMap[trimmed.toUpperCase()];
    }
    
    // 尝试数字转换
    const parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  
  // 其他情况返回默认值
  return defaultValue;
};

/**
 * 验证车辆ID是否有效
 * @param {any} id - 要验证的ID
 * @returns {boolean} 是否为有效的车辆ID
 */
export const isValidVehicleId = (id) => {
  return typeof id === 'number' && Number.isInteger(id) && id > 0;
};

/**
 * 车辆ID比较函数
 * 支持不同类型的车辆ID比较
 * @param {any} id1 - 第一个ID
 * @param {any} id2 - 第二个ID
 * @returns {boolean} 是否相等
 */
export const compareVehicleId = (id1, id2) => {
  const parsed1 = parseVehicleId(id1);
  const parsed2 = parseVehicleId(id2);
  return parsed1 === parsed2;
};

/**
 * 车辆数据标准化函数
 * 统一车辆对象的字段名和类型
 * @param {Object} vehicleData - 原始车辆数据
 * @returns {Object} 标准化后的车辆数据
 */
export const normalizeVehicleData = (vehicleData) => {
  if (!vehicleData || typeof vehicleData !== 'object') {
    return null;
  }
  
  // 提取车辆ID（支持多种字段名）
  const rawId = vehicleData.vehicleId || vehicleData.carId || vehicleData.id || vehicleData.vehicle_id;
  const vehicleId = parseVehicleId(rawId);
  
  // 返回标准化的车辆数据对象
  return {
    vehicleId, // 统一使用vehicleId字段名
    id: vehicleId, // 向后兼容性，保持id字段
    name: vehicleData.name || `车辆${vehicleId}`,
    ipAddress: vehicleData.ipAddress || vehicleData.ip_address,
    port: vehicleData.port,
    color: vehicleData.color, // 车辆颜色
    isActive: Boolean(vehicleData.isActive || vehicleData.is_active),
    position: vehicleData.position || { x: 0, y: 0 },
    speed: Number(vehicleData.speed) || 0,
    battery: Number(vehicleData.battery || vehicleData.batteryValue) || 0,
    angle: Number(vehicleData.angle || vehicleData.steeringAngle) || 0,
    gear: vehicleData.gear || 1,
    navigation: vehicleData.navigation || vehicleData.isNav || false,
    description: vehicleData.description || '',
    createdAt: vehicleData.createdAt || vehicleData.created_at,
    updatedAt: vehicleData.updatedAt || vehicleData.updated_at
  };
};

/**
 * 车辆列表标准化函数
 * @param {Array} vehicleList - 原始车辆列表
 * @returns {Array} 标准化后的车辆列表
 */
export const normalizeVehicleList = (vehicleList) => {
  if (!Array.isArray(vehicleList)) {
    return [];
  }
  
  return vehicleList
    .map(normalizeVehicleData)
    .filter(Boolean) // 过滤掉无效的数据
    .filter(vehicle => vehicle && typeof vehicle.vehicleId === 'number' && vehicle.vehicleId > 0) // 确保有有效的vehicleId
    .sort((a, b) => a.vehicleId - b.vehicleId); // 按ID排序
};

/**
 * 查找车辆函数
 * @param {Array} vehicleList - 车辆列表
 * @param {any} targetId - 目标车辆ID
 * @returns {Object|null} 找到的车辆对象或null
 */
export const findVehicleById = (vehicleList, targetId) => {
  if (!Array.isArray(vehicleList)) {
    return null;
  }
  
  const normalizedId = parseVehicleId(targetId);
  return vehicleList.find(vehicle => {
    const vehicleData = normalizeVehicleData(vehicle);
    return vehicleData && vehicleData.vehicleId === normalizedId;
  }) || null;
};
