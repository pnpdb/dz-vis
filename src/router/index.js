import { createRouter, createWebHistory } from 'vue-router'
import { pauseRendering, resumeRendering } from '@/components/Scene3D/index.js'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Cars',
      meta: { layout: 'main' }
    },
    {
      path: '/auto-drive',
      name: 'AutoDrive',
      meta: { layout: 'main' }
    },
    {
      path: '/control',
      name: 'Control',
      meta: { layout: 'main' }
    },
    {
      path: '/settings',
      name: 'Settings',
      meta: { layout: 'main' }
    },
    {
      path: '/parallel-driving',
      name: 'ParallelDriving',
      meta: { layout: 'parallel' }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'Cars' }
    }
  ],
})

// 路由守卫：智能控制Three.js渲染
router.beforeEach((to, from, next) => {
  try {
    // 从主界面切换到平行驾驶：暂停渲染
    if (from.meta?.layout === 'main' && to.meta?.layout === 'parallel') {
      pauseRendering();
    }
    // 从平行驾驶切换到主界面：恢复渲染
    else if (from.meta?.layout === 'parallel' && to.meta?.layout === 'main') {
      resumeRendering();
    }
  } catch (error) {
    console.error('渲染控制失败:', error);
  }
  
  next();
})

export default router