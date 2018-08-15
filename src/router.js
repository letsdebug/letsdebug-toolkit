import Vue from 'vue'
import Router from 'vue-router'
import Home from './views/Home.vue'
import About from './views/About.vue'
import ClearAuthz from './views/ClearAuthz.vue'
import CertSearch from './views/CertSearch.vue'
import CertRevoke from './views/CertRevoke.vue'

Vue.use(Router)

export default new Router({
  mode: 'history',
  routes: [
    {
      path: '',
      name: 'home',
      component: Home
    },
    {
      path: '/about',
      name: 'about',
      component: About
    },
    {
      path: '/clear-authz',
      name: 'clear-authz',
      component: ClearAuthz
    },
    {
      path: '/cert-search',
      name: 'cert-search',
      component: CertSearch
    },
    {
      path: '/cert-revoke',
      name: 'cert-revoke',
      component: CertRevoke
    }
  ]
})
