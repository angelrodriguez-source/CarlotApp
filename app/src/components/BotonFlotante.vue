<script setup lang="ts">
/**
 * BotonFlotante.vue — El ＋ de registrar, fuera de la barra: un botón
 * flotante que se puede ARRASTRAR y soltar donde venga mejor (zurdo,
 * diestro, con la niña en un brazo…). La posición se guarda en el
 * dispositivo. Un toque casi sin movimiento = pulsación normal.
 */
import { onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits<{ pulsar: [] }>()

const CLAVE_POS = 'carlotapp-fab-pos'
const TAMANO = 56
const MARGEN = 8
// Por debajo de esta distancia (px) el gesto cuenta como toque, no arrastre
const UMBRAL_TAP = 8
// Hueco inferior reservado: que no acabe tapando la nav
const HUECO_NAV = 76

const x = ref(0)
const y = ref(0)
const arrastrando = ref(false)

function posicionPorDefecto() {
  x.value = window.innerWidth - TAMANO - 16
  y.value = window.innerHeight - TAMANO - HUECO_NAV - 16
}

/** Siempre dentro de la pantalla (también tras girar o redimensionar) */
function acotar() {
  x.value = Math.min(Math.max(x.value, MARGEN), window.innerWidth - TAMANO - MARGEN)
  y.value = Math.min(Math.max(y.value, MARGEN), window.innerHeight - TAMANO - HUECO_NAV)
}

function alRedimensionar() {
  acotar()
}

onMounted(() => {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE_POS) ?? 'null')
    if (guardada && typeof guardada.x === 'number' && typeof guardada.y === 'number') {
      x.value = guardada.x
      y.value = guardada.y
    } else {
      posicionPorDefecto()
    }
  } catch {
    posicionPorDefecto()
  }
  acotar()
  window.addEventListener('resize', alRedimensionar)
})

onUnmounted(() => window.removeEventListener('resize', alRedimensionar))

let inicioX = 0
let inicioY = 0
let origenX = 0
let origenY = 0
let movido = false

function alAgarrar(evento: PointerEvent) {
  ;(evento.currentTarget as HTMLElement).setPointerCapture(evento.pointerId)
  inicioX = evento.clientX
  inicioY = evento.clientY
  origenX = x.value
  origenY = y.value
  movido = false
  arrastrando.value = true
}

function alMover(evento: PointerEvent) {
  if (!arrastrando.value) return
  const dx = evento.clientX - inicioX
  const dy = evento.clientY - inicioY
  if (Math.abs(dx) > UMBRAL_TAP || Math.abs(dy) > UMBRAL_TAP) movido = true
  x.value = origenX + dx
  y.value = origenY + dy
  acotar()
}

function alSoltar() {
  if (!arrastrando.value) return
  arrastrando.value = false
  if (movido) {
    localStorage.setItem(CLAVE_POS, JSON.stringify({ x: x.value, y: y.value }))
  }
}

/** click llega tras soltar (y con teclado): si hubo arrastre, no es pulsación */
function alClick() {
  if (movido) return
  emit('pulsar')
}
</script>

<template>
  <button
    class="fab-flotante"
    :class="{ arrastrando }"
    :style="{ left: x + 'px', top: y + 'px' }"
    aria-label="Registrar"
    title="Registrar (mantén y arrastra para moverlo)"
    @pointerdown="alAgarrar"
    @pointermove="alMover"
    @pointerup="alSoltar"
    @pointercancel="alSoltar"
    @click="alClick"
  >
    ＋
  </button>
</template>

<style scoped>
.fab-flotante {
  position: fixed;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  background: var(--color-accion);
  color: #fff;
  font-size: 1.7rem;
  line-height: 1;
  box-shadow: var(--sombra);
  z-index: 13;
  /* El navegador no debe hacer scroll mientras se arrastra el botón */
  touch-action: none;
  user-select: none;
  transition: filter 0.15s;
}

.fab-flotante:hover {
  filter: brightness(1.15);
}

.fab-flotante.arrastrando {
  transition: none;
  filter: brightness(1.15);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.3);
}
</style>
