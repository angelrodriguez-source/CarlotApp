<script setup lang="ts">
/**
 * BarraObjetivo.vue — Fila de objetivo diario: valor del día en negrita a
 * la izquierda, objetivo a la derecha y barra de progreso debajo. La
 * escala llega al máximo del rango; una marca señala el mínimo. El relleno
 * pasa a verde al entrar en el rango.
 */
import { computed } from 'vue'

const props = defineProps<{
  valorTexto: string // "😴 6 h 20 min"
  objetivoTexto: string // "objetivo 14-17 h"
  valor: number
  min: number
  max: number
}>()

const porcentaje = computed(() => Math.min(100, (props.valor / props.max) * 100))
const marcaMin = computed(() => (props.min / props.max) * 100)
const cumplido = computed(() => props.valor >= props.min)
const excedido = computed(() => props.valor > props.max)
</script>

<template>
  <div class="objetivo">
    <div class="fila-objetivo">
      <strong class="valor-dia">{{ valorTexto }}</strong>
      <span class="suave">
        {{ objetivoTexto }}{{ excedido ? ' · por encima' : cumplido ? ' ✓' : '' }}
      </span>
    </div>
    <div
      class="pista"
      role="progressbar"
      :aria-label="valorTexto"
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
  margin-top: 0.6rem;
}

.objetivo:first-of-type {
  margin-top: 0;
}

.fila-objetivo {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}

.valor-dia {
  font-size: 1.05rem;
  font-weight: 700;
}

.fila-objetivo .suave {
  font-size: 0.8rem;
  text-align: right;
}

.pista {
  position: relative;
  height: 9px;
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

@media (prefers-reduced-motion: reduce) {
  .relleno {
    transition: none;
  }
}
</style>
