import { createRouter, createWebHistory } from 'vue-router'
import { pauseRendering, resumeRendering } from '@/components/Scene3D/index.js'
import { ElMessage } from 'element-plus'
import { invoke } from '@tauri-apps/api/core'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Cars',
      component: () => import('@/views/MainLayout.vue'),
      meta: { layout: 'main' }
    },
    {
      path: '/auto-drive',
      name: 'AutoDrive',
      component: () => import('@/views/MainLayout.vue'),
      meta: { layout: 'main' }
    },
    {
      path: '/control',
      name: 'Control',
      component: () => import('@/views/MainLayout.vue'),
      meta: { layout: 'main' }
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/MainLayout.vue'),
      meta: { layout: 'main' }
    },
    {
      path: '/parallel-driving',
      name: 'ParallelDriving',
      component: () => import('@/views/ParallelDriving.vue'),
      meta: { layout: 'parallel' }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'Cars' }
    }
  ],
})

// 路由守卫：智能控制Three.js渲染
router.beforeEach(async (to, from, next) => {
  try {
    if (to.name === 'ParallelDriving') {
      const sandboxOk = window.socketManager?.isSandboxConnected?.()
      if (!sandboxOk) {
        ElMessage.error('云服务离线')
        return next(false)
      }

      const vehicleId = Number(to.query.vehicleId || window?.socketManager?.getSelectedVehicleId?.() || 0)
      if (!vehicleId) {
        ElMessage.error('车辆离线')
        return next(false)
      }

      const vehicleOnline = window.socketManager?.isVehicleConnected?.(vehicleId)
      if (!vehicleOnline) {
        ElMessage.error(`车辆${vehicleId}离线`)
        return next(false)
      }

      try {
        await invoke('send_sandbox_control', { vehicleId })
      } catch (error) {
        ElMessage.error(`发送进入平行驾驶指令失败: ${error}`)
        return next(false)
      }

      window.socketManager.setVehicleReady?.(vehicleId, true)
    }
    // 从主界面切换到平行驾驶：暂停渲染
    if (from.meta?.layout === 'main' && to.meta?.layout === 'parallel') {
      // 确保pauseRendering函数存在且可调用
      if (typeof pauseRendering === 'function') {
        pauseRendering()
        console.debug('🛑 切换到平行驾驶，暂停Three.js渲染')
      }
    }
    // 从平行驾驶切换到主界面：恢复渲染
    else if (from.meta?.layout === 'parallel' && to.meta?.layout === 'main') {
      // 确保resumeRendering函数存在且可调用
      if (typeof resumeRendering === 'function') {
        resumeRendering()
        console.debug('▶️ 切换到主界面，恢复Three.js渲染')
      }
    }
  } catch (error) {
    console.error('渲染控制失败:', error)
    // 即使渲染控制失败，也要继续路由导航
  }
  
  next()
})

export default router