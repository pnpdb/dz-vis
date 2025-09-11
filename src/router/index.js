import { createRouter, createWebHistory } from 'vue-router'
import Cars from '../views/Cars.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Cars',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      // component: () => import('../views/Cars.vue'),
      component: Cars,
    },
    {
      path: '/auto-drive',
      name: 'AutoDrive',
      component: () => import('../views/AutoDrive.vue'),
    },
    {
      path: '/control',
      name: 'Control',
      component: () => import('../views/Control.vue'),
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('../views/Settings.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: {
        name: 'Cars'
      }
      
    }
  ],
})

export default router