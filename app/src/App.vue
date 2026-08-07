<script setup lang="ts">
/**
 * App.vue — Layout raíz: cabecera, contenido (router-view) y
 * barra de navegación inferior (solo con sesión iniciada).
 * También gestiona el toast de "versión nueva" de la PWA.
 */
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { useUserStore } from './stores/userStore'
import { useBebeStore } from './stores/bebeStore'
import { logoUrl } from './assets/branding'

const userStore = useUserStore()
const bebeStore = useBebeStore()
const router = useRouter()

async function cerrarSesion() {
  menuAbierto.value = false
  await userStore.logout()
  bebeStore.reset()
  router.push({ name: 'login' })
}

// ---- Menú de usuario (bolita de la cabecera) ----
const menuAbierto = ref(false)

const inicialUsuario = computed(() => userStore.nombre.trim().charAt(0).toUpperCase() || '👶')

/** Abre la hoja de Configuración de Hoy (funciona desde cualquier pantalla) */
function irConfiguracion() {
  menuAbierto.value = false
  router.push({ name: 'hoy', query: { config: String(Date.now()) } })
}

// ---- Modo noche ----
// 'auto' = oscuro de 22:00 a 08:00; se puede forzar con el botón de la cabecera
type ModoTema = 'auto' | 'claro' | 'oscuro'
const CLAVE_TEMA = 'carlotapp-tema'

const modoTema = ref<ModoTema>(
  (['auto', 'claro', 'oscuro'] as const).find((m) => m === localStorage.getItem(CLAVE_TEMA)) ??
    'auto',
)
const horaActual = ref(new Date().getHours())
let temporizadorTema: number | undefined

const esNoche = computed(() =>
  modoTema.value === 'auto'
    ? horaActual.value >= 22 || horaActual.value < 8
    : modoTema.value === 'oscuro',
)

watchEffect(() => document.documentElement.classList.toggle('noche', esNoche.value))

function alternarTema() {
  const siguiente: Record<ModoTema, ModoTema> = { auto: 'oscuro', oscuro: 'claro', claro: 'auto' }
  modoTema.value = siguiente[modoTema.value]
  localStorage.setItem(CLAVE_TEMA, modoTema.value)
}

const iconoTema = computed(() =>
  modoTema.value === 'auto' ? '🌓' : modoTema.value === 'oscuro' ? '🌙' : '☀️',
)

// ---- Actualización de la PWA (evento que dispara main.ts) ----
const swEsperando = ref<ServiceWorker | null>(null)

onMounted(() => {
  window.addEventListener('carlotapp-sw-update', (e) => {
    swEsperando.value = (e as CustomEvent<ServiceWorker>).detail
  })
  temporizadorTema = window.setInterval(() => (horaActual.value = new Date().getHours()), 60_000)
})

onUnmounted(() => window.clearInterval(temporizadorTema))

function actualizarApp() {
  swEsperando.value?.postMessage('SKIP_WAITING')
  swEsperando.value = null
}

/**
 * FAB "+": registrar desde cualquier pantalla. Lleva a Hoy y le pide
 * (via query, que HoyView observa y limpia) que abra la hoja de registro.
 */
function abrirRegistro() {
  router.push({ name: 'hoy', query: { registrar: String(Date.now()) } })
}
</script>

<template>
  <header v-if="userStore.isLoggedIn" class="cabecera">
    <RouterLink :to="{ name: 'hoy' }" class="marca" aria-label="Ir al inicio">
      <img :src="logoUrl" alt="" class="logo-cabecera" />
      <strong>CarlotApp</strong>
    </RouterLink>
    <button
      class="bolita"
      aria-label="Menú de usuario"
      :aria-expanded="menuAbierto"
      @click="menuAbierto = !menuAbierto"
    >
      {{ inicialUsuario }}
    </button>
  </header>

  <!-- Menú de usuario -->
  <div v-if="menuAbierto" class="menu-fondo" @click.self="menuAbierto = false">
    <div class="menu-usuario" role="menu">
      <p class="quien">
        <strong>{{ userStore.nombre }}</strong>
        <span v-if="userStore.user?.email" class="suave">{{ userStore.user.email }}</span>
      </p>
      <button role="menuitem" @click="irConfiguracion">⚙ Configuración</button>
      <button role="menuitem" @click="alternarTema">{{ iconoTema }} Tema: {{ modoTema }}</button>
      <button role="menuitem" class="salir" @click="cerrarSesion">🚪 Salir</button>
    </div>
  </div>

  <RouterView />

  <nav v-if="userStore.isLoggedIn" class="nav-inferior">
    <RouterLink :to="{ name: 'hoy' }">🍼<span>Hoy</span></RouterLink>
    <RouterLink :to="{ name: 'historial' }">📖<span>Historial</span></RouterLink>
    <button class="fab" aria-label="Registrar" @click="abrirRegistro">＋</button>
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

.marca {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: inherit;
  font-size: 1.05rem;
}

.logo-cabecera {
  width: 28px;
  height: 28px;
  border-radius: 8px;
}

/* Bolita del menú de usuario */
.bolita {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: var(--color-accion);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
  flex-shrink: 0;
}

.menu-fondo {
  position: fixed;
  inset: 0;
  z-index: 15;
}

.menu-usuario {
  position: absolute;
  top: 3.4rem;
  right: max(1rem, calc((100vw - 540px) / 2 + 1rem));
  min-width: 220px;
  background: var(--color-tarjeta);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-s);
  box-shadow: var(--sombra);
  padding: 0.35rem;
}

.menu-usuario .quien {
  margin: 0.25rem 0.6rem 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-borde);
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.menu-usuario .quien .suave {
  font-size: 0.78rem;
}

.menu-usuario button {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-radius: 8px;
  padding: 0.55rem 0.6rem;
  font-size: 0.95rem;
  color: var(--color-texto);
}

.menu-usuario button:hover {
  background: var(--color-fondo);
}

.menu-usuario .salir {
  color: var(--color-peligro);
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

.fab {
  flex: 0 0 auto;
  width: 52px;
  height: 52px;
  margin: -1.35rem 0.5rem 0;
  border: none;
  border-radius: 50%;
  background: var(--color-accion);
  color: #fff;
  font-size: 1.6rem;
  line-height: 1;
  box-shadow: var(--sombra);
  transition: filter 0.15s;
}

.fab:hover {
  filter: brightness(1.15);
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
