<script setup lang="ts">
/**
 * HojaInferior.vue — Hoja deslizante desde abajo (bottom sheet) para
 * formularios: siempre visible, cerca del pulgar, con el fondo atenuado.
 * Se cierra tocando el fondo, el ✕ o Escape. Mientras está abierta se
 * comporta como un diálogo modal de verdad: el foco entra al panel, Tab
 * cicla dentro y el scroll del fondo queda bloqueado. Transición "hoja"
 * en main.css (respeta prefers-reduced-motion).
 */
import { ref } from 'vue'
import { atraparTab, usarModal } from './modal'

const props = defineProps<{ abierta: boolean; titulo: string; icono?: string }>()

const emit = defineEmits<{ cerrar: [] }>()

const panel = ref<HTMLElement | null>(null)

// Ciclo de vida modal compartido (scroll-lock, foco, immediate): modal.ts
usarModal(() => props.abierta, panel)
</script>

<template>
  <Teleport to="body">
    <Transition name="hoja">
      <div
        v-if="abierta"
        class="hoja-fondo"
        @click.self="emit('cerrar')"
        @keydown.esc="emit('cerrar')"
        @keydown.tab="atraparTab(panel, $event)"
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
            <h3>
              <img v-if="icono" :src="icono" alt="" class="icono-titulo" />
              {{ titulo }}
            </h3>
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
  background: var(--color-scrim);
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
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.icono-titulo {
  width: 24px;
  height: 24px;
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
