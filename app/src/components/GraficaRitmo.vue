<script setup lang="ts">
/**
 * GraficaRitmo.vue — Ritmo de 24 h en SVG puro: una fila por día con los
 * tramos de sueño como bloques y las tomas como puntos, para ver el patrón
 * del día emerger semana a semana.
 */
import { computed } from 'vue'
import { minutoDelDia, tramoEnDia, claveDia, type TramoRitmo } from '../models/CarlotaModel'
import type { Sueno, Toma } from '../types'

const props = defineProps<{
  dias: string[] // 'YYYY-MM-DD', el más reciente primero
  suenos: Sueno[]
  tomas: Toma[]
}>()

const ANCHO = 320
const IZQ = 42
const DER = 8
const ALTO_FILA = 14
const HUECO = 7
const ARRIBA = 16
const ABAJO = 14

const anchoUtil = ANCHO - IZQ - DER
const alto = computed(() => ARRIBA + props.dias.length * (ALTO_FILA + HUECO) + ABAJO)

const x = (minuto: number) => IZQ + (minuto / 1440) * anchoUtil
const yFila = (i: number) => ARRIBA + i * (ALTO_FILA + HUECO)

interface Fila {
  dia: string
  y: number
  tramos: TramoRitmo[]
  tomasMin: { minuto: number; hora: string }[]
}

const filas = computed<Fila[]>(() =>
  props.dias.map((dia, i) => ({
    dia,
    y: yFila(i),
    tramos: props.suenos
      .map((s) => tramoEnDia(s.inicio, s.fin, dia))
      .filter((t): t is TramoRitmo => t !== null),
    tomasMin: props.tomas
      .filter((t) => claveDia(t.inicio) === dia)
      .map((t) => ({
        minuto: minutoDelDia(t.inicio),
        hora: new Date(t.inicio).toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
  })),
)

const HORAS_EJE = [0, 6, 12, 18, 24]

function etiquetaDia(dia: string): string {
  const [, mes, d] = dia.split('-')
  return `${d}/${mes}`
}
</script>

<template>
  <div class="tarjeta">
    <h3>🌗 Ritmo de 24 h</h3>
    <div class="leyenda suave">
      <span><i class="muestra sueno" /> Sueño</span>
      <span><i class="muestra toma" /> Toma</span>
    </div>
    <svg :viewBox="`0 0 ${ANCHO} ${alto}`" class="grafica" role="img" aria-label="Ritmo de 24 horas">
      <!-- Eje horario -->
      <g v-for="hora in HORAS_EJE" :key="hora">
        <line :x1="x(hora * 60)" :y1="ARRIBA - 4" :x2="x(hora * 60)" :y2="alto - ABAJO" class="linea-hora" />
        <text :x="x(hora * 60)" :y="alto - 3" text-anchor="middle" class="eje">{{ hora }}h</text>
      </g>

      <g v-for="fila in filas" :key="fila.dia">
        <text :x="IZQ - 6" :y="fila.y + ALTO_FILA - 3" text-anchor="end" class="eje">
          {{ etiquetaDia(fila.dia) }}
        </text>
        <!-- Pista del día -->
        <rect :x="IZQ" :y="fila.y" :width="anchoUtil" :height="ALTO_FILA" rx="3" class="pista" />
        <!-- Tramos de sueño -->
        <rect
          v-for="tramo in fila.tramos"
          :key="tramo.desdeMin"
          :x="x(tramo.desdeMin)"
          :y="fila.y"
          :width="Math.max(1.5, x(tramo.hastaMin) - x(tramo.desdeMin))"
          :height="ALTO_FILA"
          rx="3"
          class="bloque-sueno"
        >
          <title>
            Sueño {{ Math.floor(tramo.desdeMin / 60) }}:{{ String(tramo.desdeMin % 60).padStart(2, '0') }}
            – {{ Math.floor(tramo.hastaMin / 60) }}:{{ String(tramo.hastaMin % 60).padStart(2, '0') }}
          </title>
        </rect>
        <!-- Tomas -->
        <circle
          v-for="toma in fila.tomasMin"
          :key="toma.minuto"
          :cx="x(toma.minuto)"
          :cy="fila.y + ALTO_FILA / 2"
          r="2.6"
          class="punto-toma"
        >
          <title>Toma a las {{ toma.hora }}</title>
        </circle>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.grafica {
  width: 100%;
  height: auto;
}

.leyenda {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.35rem;
}

.muestra {
  display: inline-block;
  width: 12px;
  height: 8px;
  border-radius: 2px;
  vertical-align: baseline;
}

.muestra.sueno {
  background: var(--color-primario);
}

.muestra.toma {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-texto);
}

.eje {
  font-size: 9px;
  fill: var(--color-texto-suave);
}

.linea-hora {
  stroke: var(--color-borde);
  stroke-width: 1;
}

.pista {
  fill: var(--color-fondo);
  stroke: var(--color-borde);
  stroke-width: 0.5;
}

.bloque-sueno {
  fill: var(--color-primario);
}

.punto-toma {
  fill: var(--color-texto);
}
</style>
