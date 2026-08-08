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
import HojaInferior from './components/HojaInferior.vue'
import NeneniPanel from './components/NeneniPanel.vue'
import {
  iconoCitasUrl,
  iconoEvolucionUrl,
  iconoHistorialUrl,
  iconoInicioUrl,
  logoUrl,
  neneniUrl,
} from './assets/branding'

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

// ---- Ñeñeñi (el bocadillo del Mime Predictor) ----
const neneniAbierto = ref(false)

// ---- Acerca de ----
const mostrarAcercaDe = ref(false)

function abrirAcercaDe() {
  menuAbierto.value = false
  mostrarAcercaDe.value = true
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
    <div class="cabecera-interior">
      <RouterLink :to="{ name: 'hoy' }" class="marca" aria-label="Ir al inicio">
        <img :src="logoUrl" alt="" class="logo-cabecera" />
        <strong>CarlotApp</strong>
      </RouterLink>
      <button
        class="boton-nenei"
        aria-label="Preguntar a Ñeñeñi"
        :aria-expanded="neneniAbierto"
        @click="neneniAbierto = !neneniAbierto"
      >
        <img :src="neneniUrl" alt="" />
      </button>
      <button
        class="bolita"
        aria-label="Menú de usuario"
        :aria-expanded="menuAbierto"
        @click="menuAbierto = !menuAbierto"
      >
        {{ inicialUsuario }}
      </button>
    </div>
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
      <button role="menuitem" @click="abrirAcercaDe">💚 Acerca de</button>
      <button role="menuitem" class="salir" @click="cerrarSesion">🚪 Salir</button>
    </div>
  </div>

  <!-- Ñeñeñi: predicciones y ¿por qué llora? -->
  <NeneniPanel
    v-if="userStore.isLoggedIn"
    :abierta="neneniAbierto"
    @cerrar="neneniAbierto = false"
  />

  <RouterView />

  <nav v-if="userStore.isLoggedIn" class="nav-inferior">
    <RouterLink :to="{ name: 'hoy' }">
      <img :src="iconoInicioUrl" alt="" class="icono-nav" />
      <span>Inicio</span>
    </RouterLink>
    <RouterLink :to="{ name: 'historial' }">
      <img :src="iconoHistorialUrl" alt="" class="icono-nav" />
      <span>Historial</span>
    </RouterLink>
    <button class="fab" aria-label="Registrar" @click="abrirRegistro">＋</button>
    <RouterLink :to="{ name: 'evolucion' }">
      <img :src="iconoEvolucionUrl" alt="" class="icono-nav" />
      <span>Evolución</span>
    </RouterLink>
    <RouterLink :to="{ name: 'citas' }">
      <img :src="iconoCitasUrl" alt="" class="icono-nav" />
      <span>Citas</span>
    </RouterLink>
  </nav>

  <!-- Acerca de -->
  <HojaInferior :abierta="mostrarAcercaDe" titulo="" @cerrar="mostrarAcercaDe = false">
    <div class="acerca-de">
      <img :src="logoUrl" alt="" class="acerca-logo" />
      <p class="acerca-marca">CarlotApp<sup>®</sup></p>
      <p class="acerca-lema">Tomas, sueño, medidas y momentos de Carlota</p>
      <div class="acerca-sello">
        <span class="acerca-r">®</span>
        <p>
          <strong>CarlotApp</strong> es una marca registrada perteneciente a
          <strong>Mimes Care Corporation</strong>
        </p>
      </div>
      <p class="acerca-nota suave">Hecha con 💚 para Carlota Rodríguez Villarino</p>
    </div>
  </HojaInferior>

  <div v-if="swEsperando" class="toast-sw" role="status">
    Hay una versión nueva.
    <button class="boton" @click="actualizarApp">Actualizar</button>
  </div>
</template>

<style scoped>
/* Cabecera pegajosa: CarlotApp y el usuario siempre a la vista */
.cabecera {
  position: sticky;
  top: 0;
  z-index: 12;
  background: color-mix(in srgb, var(--color-fondo) 88%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding-top: env(safe-area-inset-top);
}

/* Tres columnas: marca | Ñeñeñi centrado | usuario */
.cabecera-interior {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  max-width: 540px;
  margin: 0 auto;
  padding: 0.6rem 1rem;
}

.marca {
  display: flex;
  align-items: center;
  justify-self: start;
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

/* Ñeñeñi centrado en la barra, entre la marca y el usuario */
.boton-nenei {
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--color-primario-suave);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  flex-shrink: 0;
  transition: filter 0.15s;
}

.boton-nenei img {
  width: 100%;
  height: 100%;
}

.boton-nenei:hover {
  filter: brightness(1.08);
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
  justify-self: end;
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

.nav-inferior .icono-nav {
  width: 21px;
  height: 21px;
}

/* Fuera de Inicio el icono se apaga, como el resto de pestañas inactivas */
.nav-inferior a:not(.router-link-active) .icono-nav {
  opacity: 0.55;
  filter: grayscale(35%);
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

/* ---- Acerca de ---- */
.acerca-de {
  text-align: center;
  padding: 0.5rem 0.5rem 1rem;
}

.acerca-logo {
  width: 84px;
  height: 84px;
  border-radius: 22%;
  box-shadow: var(--sombra);
}

.acerca-marca {
  margin: 0.75rem 0 0.15rem;
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-primario-oscuro);
}

.acerca-marca sup {
  font-size: 0.8rem;
  font-weight: 600;
  margin-left: 2px;
}

.acerca-lema {
  margin: 0 0 1.1rem;
  color: var(--color-texto-suave);
  font-size: 0.9rem;
}

.acerca-sello {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-align: left;
  background: var(--color-primario-suave);
  border-radius: var(--radio-s);
  padding: 0.75rem 0.9rem;
  margin: 0 auto;
  max-width: 340px;
}

.acerca-sello .acerca-r {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-primario);
  border-radius: 50%;
  color: var(--color-primario-oscuro);
  font-weight: 700;
}

.acerca-sello p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.acerca-nota {
  margin: 1rem 0 0;
  font-size: 0.8rem;
}

.toast-sw {
  position: fixed;
  bottom: calc(80px + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-toast-fondo);
  color: var(--color-toast-texto);
  padding: 0.6rem 1rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 10;
}
</style>
