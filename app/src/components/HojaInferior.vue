<script setup lang="ts">
/**
 * HojaInferior.vue — Hoja deslizante desde abajo (bottom sheet) para
 * formularios: siempre visible, cerca del pulgar, con el fondo atenuado.
 * Se cierra tocando el fondo o el ✕. Transición "hoja" en main.css
 * (respeta prefers-reduced-motion).
 */
defineProps<{ abierta: boolean; titulo: string }>()

const emit = defineEmits<{ cerrar: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="hoja">
      <div v-if="abierta" class="hoja-fondo" @click.self="emit('cerrar')">
        <div class="hoja-panel" role="dialog" aria-modal="true" :aria-label="titulo">
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
