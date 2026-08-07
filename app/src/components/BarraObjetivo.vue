<script setup lang="ts">
/**
 * BarraObjetivo.vue — Barra de progreso hacia un objetivo diario con rango
 * (p. ej. sueño 14-17 h). La escala llega al máximo del rango; una marca
 * señala el mínimo. El relleno pasa a verde al entrar en el rango.
 */
import { computed } from 'vue'

const props = defineProps<{
  etiqueta: string
  valor: number
  min: number
  max: number
  texto: string // "6 h 20 min · objetivo 14-17 h"
}>()

const porcentaje = computed(() => Math.min(100, (props.valor / props.max) * 100))
const marcaMin = computed(() => (props.min / props.max) * 100)
const cumplido = computed(() => props.valor >= props.min)
const excedido = computed(() => props.valor > props.max)
</script>

<template>
  <div class="objetivo">
    <div class="fila-objetivo">
      <span class="nombre">{{ etiqueta }}</span>
      <span class="suave">{{ texto }}{{ excedido ? ' · por encima' : cumplido ? ' ✓' : '' }}</span>
    </div>
    <div
      class="pista"
      role="progressbar"
      :aria-label="etiqueta"
      :aria-valuenow="Math.round(valor)"
      :aria-valuemin="0"
      :aria-valuemax="max"
    >
      <div class="relleno" :class="{ cumplido }" :style="{ width: `${porcentaje}%` }" />
      <div class="marca" :style="{ left: `${marcaMin}%` }" />
    </div>
  </div>
</template>

<style scoped>
.objetivo {
  margin-top: 0.5rem;
}

.fila-objetivo {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.nombre {
  font-weight: 600;
  font-size: 0.9rem;
}

.pista {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: var(--color-fondo);
  border: 1px solid var(--color-borde);
  overflow: hidden;
}

.relleno {
  height: 100%;
  border-radius: 999px;
  background: var(--color-primario);
  transition: width 0.3s;
}

.relleno.cumplido {
  background: var(--color-ok);
}

.marca {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--color-texto-suave);
  opacity: 0.6;
}
</style>
