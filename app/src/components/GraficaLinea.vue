<script setup lang="ts">
/**
 * GraficaLinea.vue — Gráfica de línea en SVG puro (sin librerías)
 *
 * Recibe una serie de puntos (fecha, valor) ya ordenada cronológicamente
 * (ver serieGrafica en CarlotaModel) y la dibuja con eje Y autoajustado.
 */
import { computed } from 'vue'
import type { PuntoGrafica } from '../models/CarlotaModel'

const props = defineProps<{
  titulo: string
  puntos: PuntoGrafica[]
  unidad: string
}>()

const ANCHO = 320
const ALTO = 180
const MARGEN = { arriba: 12, abajo: 24, izquierda: 44, derecha: 12 }

const escala = computed(() => {
  const valores = props.puntos.map((p) => p.valor)
  let min = Math.min(...valores)
  let max = Math.max(...valores)
  if (min === max) {
    // Serie plana: dar algo de aire para que la línea no toque los bordes
    min -= 1
    max += 1
  }
  const holgura = (max - min) * 0.1
  return { min: min - holgura, max: max + holgura }
})

const coords = computed(() => {
  const n = props.puntos.length
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo
  const { min, max } = escala.value
  return props.puntos.map((p, i) => ({
    x: MARGEN.izquierda + (n === 1 ? anchoUtil / 2 : (i / (n - 1)) * anchoUtil),
    y: MARGEN.arriba + altoUtil - ((p.valor - min) / (max - min)) * altoUtil,
    punto: p,
  }))
})

const polilinea = computed(() => coords.value.map((c) => `${c.x},${c.y}`).join(' '))

function fechaCorta(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}
</script>

<template>
  <div class="tarjeta">
    <h3>{{ titulo }}</h3>
    <p v-if="puntos.length === 0" class="suave">Sin datos todavía.</p>
    <svg v-else :viewBox="`0 0 ${ANCHO} ${ALTO}`" class="grafica" role="img" :aria-label="titulo">
      <!-- Eje Y: min y max -->
      <text :x="MARGEN.izquierda - 6" :y="MARGEN.arriba + 4" text-anchor="end" class="eje">
        {{ Math.round(escala.max) }}
      </text>
      <text :x="MARGEN.izquierda - 6" :y="ALTO - MARGEN.abajo" text-anchor="end" class="eje">
        {{ Math.round(escala.min) }}
      </text>
      <line
        :x1="MARGEN.izquierda"
        :y1="MARGEN.arriba"
        :x2="MARGEN.izquierda"
        :y2="ALTO - MARGEN.abajo"
        class="linea-eje"
      />
      <line
        :x1="MARGEN.izquierda"
        :y1="ALTO - MARGEN.abajo"
        :x2="ANCHO - MARGEN.derecha"
        :y2="ALTO - MARGEN.abajo"
        class="linea-eje"
      />

      <polyline :points="polilinea" class="linea-serie" />

      <g v-for="c in coords" :key="c.punto.etiqueta">
        <circle :cx="c.x" :cy="c.y" r="3.5" class="punto">
          <title>{{ c.punto.etiqueta }}: {{ c.punto.valor }} {{ unidad }}</title>
        </circle>
      </g>

      <!-- Fechas de primer y último punto -->
      <text
        v-if="coords.length > 0"
        :x="MARGEN.izquierda"
        :y="ALTO - 6"
        text-anchor="start"
        class="eje"
      >
        {{ fechaCorta(puntos[0]!.etiqueta) }}
      </text>
      <text
        v-if="coords.length > 1"
        :x="ANCHO - MARGEN.derecha"
        :y="ALTO - 6"
        text-anchor="end"
        class="eje"
      >
        {{ fechaCorta(puntos[puntos.length - 1]!.etiqueta) }}
      </text>
    </svg>
    <p v-if="puntos.length > 0" class="suave ultimo">
      Último: {{ puntos[puntos.length - 1]!.valor }} {{ unidad }} ({{
        puntos[puntos.length - 1]!.etiqueta
      }})
    </p>
  </div>
</template>

<style scoped>
.grafica {
  width: 100%;
  height: auto;
}

.eje {
  font-size: 10px;
  fill: var(--color-texto-suave);
}

.linea-eje {
  stroke: var(--color-borde);
  stroke-width: 1;
}

.linea-serie {
  fill: none;
  stroke: var(--color-primario);
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.punto {
  fill: var(--color-primario-oscuro);
}

.ultimo {
  margin: 0.25rem 0 0;
}
</style>
