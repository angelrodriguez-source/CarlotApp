<script setup lang="ts">
/**
 * GraficaCrecimiento.vue — Gráfica de crecimiento con las curvas estándar
 * OMS de fondo (percentiles P10-P90, de 10 en 10) y la serie medida encima.
 * El eje X es la edad en días (ventana que decide el padre), así las curvas
 * y las medidas quedan alineadas en el tiempo real.
 */
import { computed } from 'vue'

export interface PuntoCrecimiento {
  dia: number // edad en días
  valor: number
  etiqueta: string // fecha 'YYYY-MM-DD' (solo la serie medida)
}

export interface CurvaPercentil {
  nombre: string // "P10" ... "P90"
  puntos: { dia: number; valor: number }[]
}

const props = defineProps<{
  titulo: string
  unidad: string
  puntos: PuntoCrecimiento[]
  curvas: CurvaPercentil[]
}>()

const ANCHO = 320
const ALTO = 200
const MARGEN = { arriba: 12, abajo: 24, izquierda: 44, derecha: 30 }

/** Rango de días de la ventana (lo marcan las curvas; las medidas ya vienen dentro) */
const rangoDias = computed(() => {
  const dias = props.curvas.flatMap((c) => c.puntos.map((p) => p.dia))
  if (dias.length === 0) {
    const medidos = props.puntos.map((p) => p.dia)
    if (medidos.length === 0) return { min: 0, max: 1 }
    return { min: Math.min(...medidos), max: Math.max(...medidos, Math.min(...medidos) + 1) }
  }
  return { min: Math.min(...dias), max: Math.max(...dias) }
})

const escala = computed(() => {
  const valores = [
    ...props.curvas.flatMap((c) => c.puntos.map((p) => p.valor)),
    ...props.puntos.map((p) => p.valor),
  ]
  if (valores.length === 0) return { min: 0, max: 1 }
  let min = Math.min(...valores)
  let max = Math.max(...valores)
  if (min === max) {
    min -= 1
    max += 1
  }
  const holgura = (max - min) * 0.06
  return { min: min - holgura, max: max + holgura }
})

function aX(dia: number): number {
  const { min, max } = rangoDias.value
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha
  return MARGEN.izquierda + ((dia - min) / (max - min)) * anchoUtil
}

function aY(valor: number): number {
  const { min, max } = escala.value
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo
  return MARGEN.arriba + altoUtil - ((valor - min) / (max - min)) * altoUtil
}

const curvasDibujadas = computed(() =>
  props.curvas
    .filter((c) => c.puntos.length > 1)
    .map((c) => {
      const ultimo = c.puntos[c.puntos.length - 1]!
      return {
        nombre: c.nombre,
        linea: c.puntos.map((p) => `${aX(p.dia)},${aY(p.valor)}`).join(' '),
        etiquetaX: aX(ultimo.dia) + 3,
        etiquetaY: aY(ultimo.valor) + 2.5,
        mediana: c.nombre === 'P50',
      }
    }),
)

const coordsMedidos = computed(() =>
  props.puntos.map((p) => ({ x: aX(p.dia), y: aY(p.valor), punto: p })),
)

const lineaMedida = computed(() => coordsMedidos.value.map((c) => `${c.x},${c.y}`).join(' '))

function fechaCorta(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

/** Etiquetas del eje X: primera y última medida (si las hay) */
const etiquetasX = computed(() => {
  if (props.puntos.length === 0) return null
  return {
    inicio: fechaCorta(props.puntos[0]!.etiqueta),
    fin: props.puntos.length > 1 ? fechaCorta(props.puntos[props.puntos.length - 1]!.etiqueta) : '',
  }
})
</script>

<template>
  <div class="tarjeta">
    <h3>{{ titulo }}</h3>
    <svg :viewBox="`0 0 ${ANCHO} ${ALTO}`" class="grafica" role="img" :aria-label="titulo">
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

      <!-- Curvas estándar OMS de fondo (P10-P90) -->
      <g v-for="curva in curvasDibujadas" :key="curva.nombre">
        <polyline
          :points="curva.linea"
          class="curva-percentil"
          :class="{ mediana: curva.mediana }"
        />
        <text :x="curva.etiquetaX" :y="curva.etiquetaY" class="etiqueta-percentil">
          {{ curva.nombre }}
        </text>
      </g>

      <!-- Serie medida encima -->
      <polyline v-if="puntos.length > 1" :points="lineaMedida" class="linea-serie" />
      <g v-for="c in coordsMedidos" :key="c.punto.etiqueta">
        <circle :cx="c.x" :cy="c.y" r="3.5" class="punto">
          <title>{{ c.punto.etiqueta }}: {{ c.punto.valor }} {{ unidad }}</title>
        </circle>
      </g>

      <!-- Fechas de primera y última medida -->
      <template v-if="etiquetasX">
        <text :x="MARGEN.izquierda" :y="ALTO - 6" text-anchor="start" class="eje">
          {{ etiquetasX.inicio }}
        </text>
        <text
          v-if="etiquetasX.fin"
          :x="ANCHO - MARGEN.derecha"
          :y="ALTO - 6"
          text-anchor="end"
          class="eje"
        >
          {{ etiquetasX.fin }}
        </text>
      </template>
    </svg>
    <p v-if="puntos.length === 0" class="suave">Sin medidas en esta ventana.</p>
    <p v-else class="suave ultimo">
      Último: {{ puntos[puntos.length - 1]!.valor }} {{ unidad }} ({{
        puntos[puntos.length - 1]!.etiqueta
      }})
    </p>
    <p class="suave leyenda-banda">Fondo: percentiles OMS niñas P10–P90 (de 10 en 10)</p>
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

.curva-percentil {
  fill: none;
  stroke: var(--color-texto-suave);
  stroke-width: 1;
  opacity: 0.35;
}

.curva-percentil.mediana {
  stroke-dasharray: 4 4;
  opacity: 0.55;
}

.etiqueta-percentil {
  font-size: 7px;
  fill: var(--color-texto-suave);
  opacity: 0.8;
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

.leyenda-banda {
  margin: 0.15rem 0 0;
  font-size: 0.72rem;
}
</style>
