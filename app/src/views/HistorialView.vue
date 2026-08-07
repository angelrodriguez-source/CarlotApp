<script setup lang="ts">
/**
 * HistorialView.vue — Histórico por días: resumen de cada día
 * (tomas, ml, sueño, pañales) y sus registros desplegables.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useBebeStore } from '../stores/bebeStore'
import * as servicio from '../services/carlotaService'
import {
  agruparPorDia,
  claveDia,
  duracionMinutos,
  formatoDuracion,
  resumenDia,
} from '../models/CarlotaModel'
import {
  ETIQUETAS_EVENTO,
  ETIQUETAS_PANAL,
  ETIQUETAS_TOMA,
  type Evento,
  type Panal,
  type Sueno,
  type Toma,
} from '../types'

const bebeStore = useBebeStore()

const dias = ref(7)
const cargando = ref(true)
const error = ref('')

const tomas = ref<Toma[]>([])
const suenos = ref<Sueno[]>([])
const panales = ref<Panal[]>([])
const eventos = ref<Evento[]>([])

const diaAbierto = ref<string | null>(null)

async function cargar() {
  error.value = ''
  cargando.value = true
  try {
    const bebe = await bebeStore.cargar()
    if (!bebe) return
    const desde = new Date()
    desde.setDate(desde.getDate() - dias.value)
    desde.setHours(0, 0, 0, 0)
    const desdeIso = desde.toISOString()
    ;[tomas.value, suenos.value, panales.value, eventos.value] = await Promise.all([
      servicio.listarTomas(bebe.id, desdeIso),
      servicio.listarSuenos(bebe.id, desdeIso),
      servicio.listarPanales(bebe.id, desdeIso),
      servicio.listarEventos(bebe.id, desdeIso),
    ])
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
watch(dias, cargar)

interface DiaHistorial {
  dia: string
  resumen: ReturnType<typeof resumenDia>
  registros: { id: string; hora: string; texto: string }[]
}

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function fechaLegible(dia: string): string {
  return new Date(dia + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

const historial = computed<DiaHistorial[]>(() => {
  const tomasPorDia = agruparPorDia(tomas.value, (t) => t.inicio)
  const suenosPorDia = agruparPorDia(suenos.value, (s) => s.inicio)
  const panalesPorDia = agruparPorDia(panales.value, (p) => p.fecha)
  const eventosPorDia = agruparPorDia(eventos.value, (e) => e.fecha)

  const todosLosDias = new Set<string>([
    ...tomasPorDia.keys(),
    ...suenosPorDia.keys(),
    ...panalesPorDia.keys(),
    ...eventosPorDia.keys(),
  ])

  return [...todosLosDias]
    .sort((a, b) => b.localeCompare(a))
    .map((dia) => {
      const tomasDia = tomasPorDia.get(dia) ?? []
      const suenosDia = suenosPorDia.get(dia) ?? []
      const panalesDia = panalesPorDia.get(dia) ?? []
      const eventosDia = eventosPorDia.get(dia) ?? []

      const registros = [
        ...tomasDia.map((t) => {
          const minutos = duracionMinutos(t.inicio, t.fin)
          const detalle = t.cantidad_ml
            ? `${t.cantidad_ml} ml`
            : minutos !== null
              ? formatoDuracion(minutos)
              : ''
          return {
            id: t.id,
            hora: t.inicio,
            texto: `🍼 ${ETIQUETAS_TOMA[t.tipo]}${detalle ? ` — ${detalle}` : ''}`,
          }
        }),
        ...suenosDia.map((s) => {
          const minutos = duracionMinutos(s.inicio, s.fin)
          return {
            id: s.id,
            hora: s.inicio,
            texto: `😴 Sueño${minutos !== null ? ` — ${formatoDuracion(minutos)}` : ' (en curso)'}`,
          }
        }),
        ...panalesDia.map((p) => ({
          id: p.id,
          hora: p.fecha,
          texto: `🧷 Pañal — ${ETIQUETAS_PANAL[p.tipo]}`,
        })),
        ...eventosDia.map((e) => ({
          id: e.id,
          hora: e.fecha,
          texto: `⭐ ${ETIQUETAS_EVENTO[e.tipo]}${e.descripcion ? ` — ${e.descripcion}` : ''}`,
        })),
      ].sort((a, b) => a.hora.localeCompare(b.hora))

      return { dia, resumen: resumenDia(tomasDia, suenosDia, panalesDia), registros }
    })
})

const hoy = claveDia(new Date().toISOString())
</script>

<template>
  <main class="pantalla">
    <div class="tarjeta cabecera-historial">
      <h2>Historial</h2>
      <select v-model.number="dias" aria-label="Días a mostrar">
        <option :value="7">Últimos 7 días</option>
        <option :value="14">Últimos 14 días</option>
        <option :value="30">Últimos 30 días</option>
      </select>
    </div>

    <p v-if="cargando" class="suave">Cargando…</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="!cargando && historial.length === 0" class="suave">Sin registros en este periodo.</p>

    <div v-for="diaHistorial in historial" :key="diaHistorial.dia" class="tarjeta">
      <button
        class="dia-boton"
        @click="diaAbierto = diaAbierto === diaHistorial.dia ? null : diaHistorial.dia"
      >
        <strong>
          {{ diaHistorial.dia === hoy ? 'Hoy' : fechaLegible(diaHistorial.dia) }}
        </strong>
        <span class="suave">{{ diaAbierto === diaHistorial.dia ? '▲' : '▼' }}</span>
      </button>
      <div>
        <span class="chip">🍼 {{ diaHistorial.resumen.numTomas }}</span>
        <span v-if="diaHistorial.resumen.mlBiberon > 0" class="chip">
          {{ diaHistorial.resumen.mlBiberon }} ml
        </span>
        <span v-if="diaHistorial.resumen.minutosPecho > 0" class="chip">
          {{ formatoDuracion(diaHistorial.resumen.minutosPecho) }} pecho
        </span>
        <span class="chip">😴 {{ formatoDuracion(diaHistorial.resumen.minutosSueno) }}</span>
        <span class="chip">
          🧷 {{ diaHistorial.resumen.numPanales }} ({{ diaHistorial.resumen.numCacas }} 💩)
        </span>
      </div>
      <div v-if="diaAbierto === diaHistorial.dia">
        <div v-for="registro in diaHistorial.registros" :key="registro.id" class="fila-registro">
          <span class="hora">{{ horaCorta(registro.hora) }}</span>
          <span class="detalle">{{ registro.texto }}</span>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.cabecera-historial {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.cabecera-historial select {
  width: auto;
}

.dia-boton {
  width: 100%;
  display: flex;
  justify-content: space-between;
  background: none;
  border: none;
  padding: 0 0 0.5rem;
  font-size: 1rem;
  color: inherit;
}
</style>
