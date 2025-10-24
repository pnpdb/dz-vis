/**
 * 状态管理工具
 * 提供不可变状态更新和历史记录功能
 */

/**
 * 深度冻结对象（确保不可变性）
 * @param {*} obj - 要冻结的对象
 * @returns {*} 冻结后的对象
 */
export function deepFreeze(obj) {
    // 冻结对象本身
    Object.freeze(obj);
    
    // 递归冻结所有属性
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (obj[prop] !== null
            && (typeof obj[prop] === 'object' || typeof obj[prop] === 'function')
            && !Object.isFrozen(obj[prop])) {
            deepFreeze(obj[prop]);
        }
    });
    
    return obj;
}

/**
 * 深度克隆对象（用于不可变更新）
 * @param {*} obj - 要克隆的对象
 * @returns {*} 克隆后的对象
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    if (obj instanceof Map) {
        const cloned = new Map();
        obj.forEach((value, key) => {
            cloned.set(key, deepClone(value));
        });
        return cloned;
    }
    
    if (obj instanceof Set) {
        const cloned = new Set();
        obj.forEach(value => {
            cloned.add(deepClone(value));
        });
        return cloned;
    }
    
    if (obj instanceof Object) {
        const cloned = {};
        Object.keys(obj).forEach(key => {
            cloned[key] = deepClone(obj[key]);
        });
        return cloned;
    }
    
    return obj;
}

/**
 * 不可变更新对象属性
 * @param {Object} obj - 原始对象
 * @param {string|Array} path - 属性路径（支持点号或数组）
 * @param {*} value - 新值
 * @returns {Object} 新对象
 */
export function immutableSet(obj, path, value) {
    const keys = Array.isArray(path) ? path : path.split('.');
    const key = keys[0];
    
    if (keys.length === 1) {
        return {
            ...obj,
            [key]: value
        };
    }
    
    return {
        ...obj,
        [key]: immutableSet(obj[key] || {}, keys.slice(1), value)
    };
}

/**
 * 不可变更新数组
 * @param {Array} arr - 原始数组
 * @param {number} index - 索引
 * @param {*} value - 新值
 * @returns {Array} 新数组
 */
export function immutableArrayUpdate(arr, index, value) {
    return [
        ...arr.slice(0, index),
        value,
        ...arr.slice(index + 1)
    ];
}

/**
 * 创建状态历史管理器
 * @param {number} maxSize - 最大历史记录数
 * @returns {Object} 历史管理器
 */
export function createStateHistory(maxSize = 50) {
    const history = [];
    let currentIndex = -1;
    
    return {
        /**
         * 添加新状态
         */
        push(state) {
            // 如果当前不在最新位置，删除当前位置之后的所有历史
            if (currentIndex < history.length - 1) {
                history.splice(currentIndex + 1);
            }
            
            // 克隆状态以确保不可变性
            const clonedState = deepClone(state);
            history.push(clonedState);
            
            // 限制历史记录大小
            if (history.length > maxSize) {
                history.shift();
            } else {
                currentIndex++;
            }
            
            return clonedState;
        },
        
        /**
         * 撤销（回到上一个状态）
         */
        undo() {
            if (currentIndex > 0) {
                currentIndex--;
                return deepClone(history[currentIndex]);
            }
            return null;
        },
        
        /**
         * 重做（前进到下一个状态）
         */
        redo() {
            if (currentIndex < history.length - 1) {
                currentIndex++;
                return deepClone(history[currentIndex]);
            }
            return null;
        },
        
        /**
         * 获取当前状态
         */
        current() {
            if (currentIndex >= 0 && currentIndex < history.length) {
                return deepClone(history[currentIndex]);
            }
            return null;
        },
        
        /**
         * 检查是否可以撤销
         */
        canUndo() {
            return currentIndex > 0;
        },
        
        /**
         * 检查是否可以重做
         */
        canRedo() {
            return currentIndex < history.length - 1;
        },
        
        /**
         * 清空历史
         */
        clear() {
            history.length = 0;
            currentIndex = -1;
        },
        
        /**
         * 获取历史统计
         */
        getStats() {
            return {
                total: history.length,
                current: currentIndex,
                canUndo: this.canUndo(),
                canRedo: this.canRedo()
            };
        },
        
        /**
         * 获取完整历史（仅用于调试）
         */
        getHistory() {
            return history.map((state, index) => ({
                index,
                state: deepClone(state),
                isCurrent: index === currentIndex
            }));
        }
    };
}

/**
 * 创建状态快照管理器（用于保存/恢复特定时刻的状态）
 * @returns {Object} 快照管理器
 */
export function createStateSnapshots() {
    const snapshots = new Map();
    
    return {
        /**
         * 保存快照
         */
        save(key, state) {
            snapshots.set(key, {
                state: deepClone(state),
                timestamp: Date.now()
            });
        },
        
        /**
         * 恢复快照
         */
        restore(key) {
            const snapshot = snapshots.get(key);
            if (snapshot) {
                return deepClone(snapshot.state);
            }
            return null;
        },
        
        /**
         * 删除快照
         */
        delete(key) {
            return snapshots.delete(key);
        },
        
        /**
         * 检查快照是否存在
         */
        has(key) {
            return snapshots.has(key);
        },
        
        /**
         * 获取所有快照键
         */
        keys() {
            return Array.from(snapshots.keys());
        },
        
        /**
         * 清空所有快照
         */
        clear() {
            snapshots.clear();
        },
        
        /**
         * 获取快照统计
         */
        getStats() {
            return {
                total: snapshots.size,
                keys: this.keys()
            };
        }
    };
}

/**
 * 比较两个状态的差异
 * @param {*} oldState - 旧状态
 * @param {*} newState - 新状态
 * @param {string} path - 当前路径
 * @returns {Array} 差异列表
 */
export function diffStates(oldState, newState, path = '') {
    const differences = [];
    
    // 处理null和undefined
    if (oldState === newState) {
        return differences;
    }
    
    if (oldState === null || oldState === undefined) {
        differences.push({ path, type: 'added', value: newState });
        return differences;
    }
    
    if (newState === null || newState === undefined) {
        differences.push({ path, type: 'removed', value: oldState });
        return differences;
    }
    
    // 处理不同类型
    if (typeof oldState !== typeof newState) {
        differences.push({
            path,
            type: 'changed',
            oldValue: oldState,
            newValue: newState
        });
        return differences;
    }
    
    // 处理对象
    if (typeof oldState === 'object' && !Array.isArray(oldState)) {
        const allKeys = new Set([
            ...Object.keys(oldState),
            ...Object.keys(newState)
        ]);
        
        allKeys.forEach(key => {
            const newPath = path ? `${path}.${key}` : key;
            differences.push(...diffStates(oldState[key], newState[key], newPath));
        });
        
        return differences;
    }
    
    // 处理数组
    if (Array.isArray(oldState)) {
        const maxLength = Math.max(oldState.length, newState.length);
        for (let i = 0; i < maxLength; i++) {
            const newPath = `${path}[${i}]`;
            differences.push(...diffStates(oldState[i], newState[i], newPath));
        }
        return differences;
    }
    
    // 处理基本类型
    if (oldState !== newState) {
        differences.push({
            path,
            type: 'changed',
            oldValue: oldState,
            newValue: newState
        });
    }
    
    return differences;
}

/**
 * 合并多个状态更新
 * @param {Object} baseState - 基础状态
 * @param {...Object} updates - 更新对象
 * @returns {Object} 合并后的新状态
 */
export function mergeStates(baseState, ...updates) {
    let result = deepClone(baseState);
    
    updates.forEach(update => {
        result = { ...result, ...update };
    });
    
    return result;
}

