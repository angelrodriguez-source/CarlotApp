import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useUserStore } from './stores/userStore'

const app = createApp(App)

// Pinia DEBE registrarse antes de usar cualquier store
app.use(createPinia())
app.use(router)

// Montar la app PRIMERO para que siempre se muestre algo en pantalla.
// Luego inicializar auth en background.
app.mount('#app')

const userStore = useUserStore()
userStore.init()

// PWA: registrar el service worker solo en producción (en dev molesta
// porque cachea y esconde los cambios del hot reload)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')

      // Avisar a la app cuando hay una versión nueva esperando.
      // App.vue escucha este evento y muestra el toast de actualizar.
      const notifyUpdate = (sw: ServiceWorker) => {
        window.dispatchEvent(new CustomEvent('carlotapp-sw-update', { detail: sw }))
      }

      if (reg.waiting) notifyUpdate(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing
        if (!nuevo) return
        nuevo.addEventListener('statechange', () => {
          // 'installed' con un controller previo = hay versión vieja activa
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
            notifyUpdate(nuevo)
          }
        })
      })

      // Cuando el SW nuevo toma el control (tras aceptar), recargar una vez
      let recargado = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recargado) return
        recargado = true
        window.location.reload()
      })
    } catch {
      /* sin SW la app funciona igual, solo pierde offline */
    }
  })
}
