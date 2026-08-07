<script setup lang="ts">
/**
 * App.vue — Layout raíz: cabecera, contenido (router-view) y
 * barra de navegación inferior (solo con sesión iniciada).
 * También gestiona el toast de "versión nueva" de la PWA.
 */
import { onMounted, ref } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { useUserStore } from './stores/userStore'
import { useBebeStore } from './stores/bebeStore'

const userStore = useUserStore()
const bebeStore = useBebeStore()
const router = useRouter()

async function cerrarSesion() {
  await userStore.logout()
  bebeStore.reset()
  router.push({ name: 'login' })
}

// ---- Actualización de la PWA (evento que dispara main.ts) ----
const swEsperando = ref<ServiceWorker | null>(null)

onMounted(() => {
  window.addEventListener('carlotapp-sw-update', (e) => {
    swEsperando.value = (e as CustomEvent<ServiceWorker>).detail
  })
})

function actualizarApp() {
  swEsperando.value?.postMessage('SKIP_WAITING')
  swEsperando.value = null
}
</script>

<template>
  <header v-if="userStore.isLoggedIn" class="cabecera">
    <div>
      <strong>{{ bebeStore.bebe?.nombre ?? 'CarlotApp' }}</strong>
      <span v-if="bebeStore.edad" class="suave"> · {{ bebeStore.edad }}</span>
    </div>
    <button class="boton peligro" @click="cerrarSesion">Salir</button>
  </header>

  <RouterView />

  <nav v-if="userStore.isLoggedIn" class="nav-inferior">
    <RouterLink :to="{ name: 'hoy' }">🍼<span>Hoy</span></RouterLink>
    <RouterLink :to="{ name: 'historial' }">📖<span>Historial</span></RouterLink>
    <RouterLink :to="{ name: 'evolucion' }">📈<span>Evolución</span></RouterLink>
    <RouterLink :to="{ name: 'citas' }">🗓️<span>Citas</span></RouterLink>
  </nav>

  <div v-if="swEsperando" class="toast-sw">
    Hay una versión nueva.
    <button class="boton" @click="actualizarApp">Actualizar</button>
  </div>
</template>

<style scoped>
.cabecera {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 540px;
  margin: 0 auto;
  padding: 0.75rem 1rem 0;
}

.nav-inferior {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: var(--color-tarjeta);
  border-top: 1px solid var(--color-borde);
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-inferior a {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.5rem 0;
  text-decoration: none;
  color: var(--color-texto-suave);
  font-size: 1.2rem;
}

.nav-inferior a span {
  font-size: 0.7rem;
}

.nav-inferior a.router-link-active {
  color: var(--color-primario-oscuro);
  font-weight: 600;
}

.toast-sw {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-texto);
  color: #fff;
  padding: 0.6rem 1rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 10;
}
</style>
