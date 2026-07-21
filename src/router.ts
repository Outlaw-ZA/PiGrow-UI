// Src/router.ts
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import AdminView from './views/AdminView.vue'
import GrowMonitorView from './views/grow-monitor/GrowMonitorView.vue'
import NotFoundView from './views/NotFoundView.vue'

// Controller Views
import ControllerFormView from './views/admin/ControllerFormView.vue'
import ScanControllersView from './views/admin/ScanControllersView.vue'
// Grow Views
import GrowFormView from './views/admin/GrowFormView.vue'
// Nutrient Views
import NutrientsView from './views/admin/Nutrients.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { component: HomeView, name: 'home', path: '/' },
    { component: AdminView, name: 'admin', path: '/admin' },

    // Controller Lifecycle Subroutes
    { component: ControllerFormView, name: 'controller-create', path: '/admin/controllers/new' },
    {
      component: ControllerFormView,
      name: 'controller-edit',
      path: '/admin/controllers/edit/:id',
      props: true,
    },
    {
      component: ScanControllersView,
      name: 'controller-scan',
      path: '/admin/controllers/scan',
    },

    // Grow Lifecycle Subroutes
    { component: GrowFormView, name: 'grow-create', path: '/admin/grows/new' },
    { component: GrowFormView, name: 'grow-edit', path: '/admin/grows/edit/:id', props: true },
    {
      component: GrowMonitorView,
      name: 'grow-monitor',
      path: '/grow/:id',
      props: true, // Pass the :id parameter down into the component as a native prop
    },

    // Nutrient Lifecycle Subroutes
    { component: NutrientsView, name: 'nutrients', path: '/admin/nutrients' },

    // Catch-all
    {
      component: NotFoundView,
      name: 'not-found',
      path: '/:pathMatch(.*)*',
    },
  ],
})

export default router
