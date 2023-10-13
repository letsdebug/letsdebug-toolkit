import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/About.vue')
    },
    {
      path: '/clear-authz',
      name: 'clear-authz',
      component: () => import('@/views/ClearAuthz.vue')
    },
    {
      path: '/cert-search',
      name: 'cert-search',
      component: () => import('@/views/CertSearch.vue')
    },
    {
      path: '/cert-revoke',
      name: 'cert-revoke',
      component: () => import('@/views/CertRevoke.vue')
    }
  ]
})

export default router
