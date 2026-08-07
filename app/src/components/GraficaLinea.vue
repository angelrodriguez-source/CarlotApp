<script setup lang="ts">
/**
 * GraficaLinea.vue — Gráfica de línea en SVG puro (sin librerías)
 *
 * Recibe una serie de puntos (fecha, valor) ya ordenada cronológicamente
 * (ver serieGrafica en CarlotaModel) y la dibuja con eje Y autoajustado.
 */
import { computed } from 'vue'
import type { BandaOMS, PuntoGrafica } from '../models/CarlotaModel'

const props = defineProps<{
  titulo: string
  puntos: PuntoGrafica[]
  unidad: string
  /**
   * Franja de referencia OMS (P3-P97 + mediana), paralela a `puntos`
   * (banda[i] corresponde a puntos[i]). Si algún punto no tiene banda,
   * la franja no se pinta.
   */
  banda?: (BandaOMS | null)[]
}>()

const bandaValida = computed(() =>
  props.banda &&
  props.banda.length === props.puntos.length &&
  props.puntos.length > 1 &&
  props.banda.every((b) => b !== null)
    ? (props.banda as BandaOMS[])
    : null,
)

const ANCHO = 320
const ALTO = 180
const MARGEN = { arriba: 12, abajo: 24, izquierda: 44, derecha: 12 }

const escala = computed(() => {
  const valores = props.puntos.map((p) => p.valor)
  // La franja OMS también entra en la escala para que quepa entera
  for (const b of bandaValida.value ?? []) {
    valores.push(b.p3, b.p97)
  }
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

/** Y en el SVG para un valor dado (misma escala que los puntos) */
function aY(valor: number): number {
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo
  const { min, max } = escala.value
  return MARGEN.arriba + altoUtil - ((valor - min) / (max - min)) * altoUtil
}

/** Polígono de la franja P3-P97: ida por arriba (p97) y vuelta por abajo (p3) */
const poligonoBanda = computed(() => {
  const banda = bandaValida.value
  if (!banda) return ''
  const ida = coords.value.map((c, i) => `${c.x},${aY(banda[i]!.p97)}`)
  const vuelta = [...coords.value].reverse().map((c, i) => {
    const original = banda[coords.value.length - 1 - i]!
    return `${c.x},${aY(original.p3)}`
  })
  return [...ida, ...vuelta].join(' ')
})

const lineaMediana = computed(() => {
  const banda = bandaValida.value
  if (!banda) return ''
  return coords.value.map((c, i) => `${c.x},${aY(banda[i]!.p50)}`).join(' ')
})

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

      <!-- Franja de referencia OMS (P3-P97) con la mediana punteada -->
      <polygon v-if="poligonoBanda" :points="poligonoBanda" class="banda-oms" />
      <polyline v-if="lineaMediana" :points="lineaMediana" class="mediana-oms" />

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
    <p v-if="poligonoBanda" class="suave leyenda-banda">
      Franja: P3–P97 OMS niñas · punteada: mediana (P50)
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

.banda-oms {
  fill: var(--color-primario);
  opacity: 0.14;
}

.mediana-oms {
  fill: none;
  stroke: var(--color-primario);
  stroke-width: 1;
  stroke-dasharray: 4 4;
  opacity: 0.6;
}

.leyenda-banda {
  margin: 0.15rem 0 0;
  font-size: 0.72rem;
}

.punto {
  fill: var(--color-primario-oscuro);
}

.ultimo {
  margin: 0.25rem 0 0;
}
</style>
