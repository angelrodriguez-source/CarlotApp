<script setup lang="ts">
/**
 * HojaInferior.vue — Hoja deslizante desde abajo (bottom sheet) para
 * formularios: siempre visible, cerca del pulgar, con el fondo atenuado.
 * Se cierra tocando el fondo, el ✕ o Escape. Mientras está abierta se
 * comporta como un diálogo modal de verdad: el foco entra al panel, Tab
 * cicla dentro y el scroll del fondo queda bloqueado. Transición "hoja"
 * en main.css (respeta prefers-reduced-motion).
 */
import { nextTick, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{ abierta: boolean; titulo: string }>()

const emit = defineEmits<{ cerrar: [] }>()

const panel = ref<HTMLElement | null>(null)

const FOCUSABLES = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

watch(
  () => props.abierta,
  async (abierta) => {
    document.body.style.overflow = abierta ? 'hidden' : ''
    if (abierta) {
      await nextTick()
      panel.value?.focus()
    }
  },
)

onUnmounted(() => {
  document.body.style.overflow = ''
})

/** Trampa de foco: Tab desde el último enfocable vuelve al primero (y al revés) */
function atraparTab(evento: KeyboardEvent) {
  const raiz = panel.value
  if (!raiz) return
  const enfocables = [...raiz.querySelectorAll<HTMLElement>(FOCUSABLES)].filter(
    (el) => el.offsetParent !== null,
  )
  if (enfocables.length === 0) return
  const primero = enfocables[0]!
  const ultimo = enfocables[enfocables.length - 1]!
  const activo = document.activeElement
  if (evento.shiftKey && (activo === primero || activo === raiz)) {
    evento.preventDefault()
    ultimo.focus()
  } else if (!evento.shiftKey && activo === ultimo) {
    evento.preventDefault()
    primero.focus()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="hoja">
      <div
        v-if="abierta"
        class="hoja-fondo"
        @click.self="emit('cerrar')"
        @keydown.esc="emit('cerrar')"
        @keydown.tab="atraparTab"
      >
        <div
          ref="panel"
          class="hoja-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="titulo"
          tabindex="-1"
        >
          <span class="asa" aria-hidden="true"></span>
          <div class="hoja-titulo">
            <h3>{{ titulo }}</h3>
            <button class="cerrar" aria-label="Cerrar" @click="emit('cerrar')">✕</button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.hoja-fondo {
  position: fixed;
  inset: 0;
  background: rgb(20 40 36 / 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 20;
}

.hoja-panel {
  width: 100%;
  max-width: 540px;
  max-height: 82vh;
  overflow-y: auto;
  background: var(--color-tarjeta);
  border-radius: var(--radio) var(--radio) 0 0;
  padding: 0.5rem 1rem calc(1rem + env(safe-area-inset-bottom));
}

.hoja-panel:focus {
  outline: none;
}

.asa {
  display: block;
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--color-borde);
  margin: 0.25rem auto 0.6rem;
}

.hoja-titulo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.hoja-titulo h3 {
  margin: 0;
}

.cerrar {
  background: none;
  border: none;
  color: var(--color-texto-suave);
  font-size: 1rem;
  padding: 0.35rem 0.5rem;
  min-width: 40px;
  min-height: 40px;
}
</style>
