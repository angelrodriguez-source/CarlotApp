<script setup lang="ts">
/**
 * GraficaRitmo.vue — Ritmo de 24 h en SVG puro: una fila por día con los
 * tramos de sueño como bloques y las tomas como puntos, para ver el patrón
 * del día emerger semana a semana.
 */
import { computed } from 'vue'
import {
  claveDia,
  fechaCortaDia,
  minutosEnDia,
  tramoEnDia,
  type TramoRitmo,
} from '../models/CarlotaModel'
import type { Sueno, Toma } from '../types'

const props = defineProps<{
  dias: string[] // 'YYYY-MM-DD', el más reciente primero
  suenos: Sueno[]
  tomas: Toma[]
}>()

// Tocar una fila avisa a la vista (que abre ese día en la lista)
const emit = defineEmits<{ seleccionarDia: [dia: string] }>()

const ANCHO = 320
const IZQ = 42
const DER = 8
const ALTO_FILA = 14
const HUECO = 7
const ARRIBA = 16
const ABAJO = 14

const anchoUtil = ANCHO - IZQ - DER
const alto = computed(() => ARRIBA + props.dias.length * (ALTO_FILA + HUECO) + ABAJO)

// Cada fila se escala con la duración real de su día (23/25 h en los
// cambios de hora): así un día completo llega justo al borde derecho
const x = (minuto: number, minutosDia = 1440) => IZQ + (minuto / minutosDia) * anchoUtil
const yFila = (i: number) => ARRIBA + i * (ALTO_FILA + HUECO)

interface Fila {
  dia: string
  y: number
  minutosDia: number
  tramos: TramoRitmo[]
  tomasMin: { minuto: number; hora: string }[]
}

const filas = computed<Fila[]>(() =>
  props.dias.map((dia, i) => {
    // Minutos TRANSCURRIDOS desde la medianoche local (misma base que
    // tramoEnDia): en los días de cambio de hora, hora de reloj y minutos
    // transcurridos difieren y mezclarlos desalineaba tomas y sueños
    const inicioDia = new Date(dia + 'T00:00:00').getTime()
    return {
      dia,
      y: yFila(i),
      minutosDia: minutosEnDia(dia),
      tramos: props.suenos
        .map((s) => tramoEnDia(s.inicio, s.fin, dia))
        .filter((t): t is TramoRitmo => t !== null),
      tomasMin: props.tomas
        .filter((t) => claveDia(t.inicio) === dia)
        .map((t) => ({
          minuto: Math.round((new Date(t.inicio).getTime() - inicioDia) / 60_000),
          hora: new Date(t.inicio).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        })),
    }
  }),
)

// Eje global a escala 1440: en los 2 días de cambio de hora del año las
// líneas horarias se desvían ~4% respecto a esas filas (el contenido de
// cada fila sí es exacto porque escala con su duración real)
const HORAS_EJE = [0, 6, 12, 18, 24]
</script>

<template>
  <div class="tarjeta">
    <h3>🌗 Ritmo de 24 h</h3>
    <div class="leyenda suave">
      <span><i class="muestra sueno" /> Sueño</span>
      <span><i class="muestra toma" /> Toma</span>
    </div>
    <svg
      :viewBox="`0 0 ${ANCHO} ${alto}`"
      class="grafica"
      role="img"
      aria-label="Ritmo de 24 horas"
    >
      <!-- Eje horario -->
      <g v-for="hora in HORAS_EJE" :key="hora">
        <line
          :x1="x(hora * 60)"
          :y1="ARRIBA - 4"
          :x2="x(hora * 60)"
          :y2="alto - ABAJO"
          class="linea-hora"
        />
        <text :x="x(hora * 60)" :y="alto - 3" text-anchor="middle" class="eje">{{ hora }}h</text>
      </g>

      <g
        v-for="fila in filas"
        :key="fila.dia"
        class="fila-ritmo"
        role="button"
        tabindex="0"
        :aria-label="`Abrir el día ${fila.dia}`"
        @click="emit('seleccionarDia', fila.dia)"
        @keydown.enter.prevent="emit('seleccionarDia', fila.dia)"
        @keydown.space.prevent="emit('seleccionarDia', fila.dia)"
      >
        <text :x="IZQ - 6" :y="fila.y + ALTO_FILA - 3" text-anchor="end" class="eje">
          {{ fechaCortaDia(fila.dia) }}
        </text>
        <!-- Pista del día -->
        <rect :x="IZQ" :y="fila.y" :width="anchoUtil" :height="ALTO_FILA" rx="3" class="pista" />
        <!-- Tramos de sueño -->
        <rect
          v-for="(tramo, i) in fila.tramos"
          :key="i"
          :x="x(tramo.desdeMin, fila.minutosDia)"
          :y="fila.y"
          :width="
            Math.max(1.5, x(tramo.hastaMin, fila.minutosDia) - x(tramo.desdeMin, fila.minutosDia))
          "
          :height="ALTO_FILA"
          rx="3"
          class="bloque-sueno"
        >
          <title>
            Sueño {{ Math.floor(tramo.desdeMin / 60) }}:{{
              String(tramo.desdeMin % 60).padStart(2, '0')
            }}
            – {{ Math.floor(tramo.hastaMin / 60) }}:{{
              String(tramo.hastaMin % 60).padStart(2, '0')
            }}
          </title>
        </rect>
        <!-- Tomas -->
        <circle
          v-for="(toma, i) in fila.tomasMin"
          :key="i"
          :cx="x(toma.minuto, fila.minutosDia)"
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

.fila-ritmo {
  cursor: pointer;
}

.fila-ritmo:focus-visible {
  outline: 2px solid var(--color-primario);
  outline-offset: 1px;
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
