// src/router.ts
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import AdminView from './views/AdminView.vue'
import GrowMonitorView from './views/GrowMonitorView.vue'

// Controller Views
import ControllerFormView from './views/admin/ControllerFormView.vue'
// Grow Views
import GrowFormView from './views/admin/GrowFormView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/admin', name: 'admin', component: AdminView },

    // Controller Lifecycle Subroutes
    { path: '/admin/controllers/new', name: 'controller-create', component: ControllerFormView },
    {
      path: '/admin/controllers/edit/:id',
      name: 'controller-edit',
      component: ControllerFormView,
      props: true,
    },

    // Grow Lifecycle Subroutes
    { path: '/admin/grows/new', name: 'grow-create', component: GrowFormView },
    { path: '/admin/grows/edit/:id', name: 'grow-edit', component: GrowFormView, props: true },
    {
      path: '/grow/:id',
      name: 'grow-monitor',
      component: GrowMonitorView,
      props: true, // Pass the :id parameter down into the component as a native prop
    },
  ],
})

export default router
