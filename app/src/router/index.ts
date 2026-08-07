import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '../stores/userStore'

// Hash router: OBLIGATORIO en GitHub Pages (no soporta history mode).
// Las URLs quedan como /#/hoy, /#/citas, etc.
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/hoy',
      name: 'hoy',
      component: () => import('../views/HoyView.vue'),
    },
    {
      path: '/historial',
      name: 'historial',
      component: () => import('../views/HistorialView.vue'),
    },
    {
      path: '/evolucion',
      name: 'evolucion',
      component: () => import('../views/EvolucionView.vue'),
    },
    {
      path: '/citas',
      name: 'citas',
      component: () => import('../views/CitasView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const userStore = useUserStore()

  // Esperar a que la sesión inicial esté comprobada. Sin esto, un usuario
  // no autenticado podría ver brevemente una vista protegida.
  await userStore.waitUntilReady()

  if (to.name === 'login' && userStore.isLoggedIn) {
    return { name: 'hoy' }
  }

  if (to.name !== 'login' && !userStore.isLoggedIn) {
    return { name: 'login' }
  }

  return true
})

export default router
