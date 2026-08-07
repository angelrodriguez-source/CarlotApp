<script setup lang="ts">
/**
 * HistorialView.vue — Histórico por días: resumen de cada día
 * (tomas, ml, sueño, pañales) y sus registros desplegables, con
 * edición y borrado de cualquier registro.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useBebeStore } from '../stores/bebeStore'
import * as servicio from '../services/carlotaService'
import {
  aInputLocal,
  agruparPorDia,
  claveDia,
  duracionMinutos,
  formatoDuracion,
  resumenDia,
  textoEvento,
  textoPanal,
  textoSueno,
  textoToma,
  ultimosDias,
} from '../models/CarlotaModel'
import GraficaRitmo from '../components/GraficaRitmo.vue'
import {
  ETIQUETAS_CANTIDAD_PANAL,
  ETIQUETAS_EVENTO,
  ETIQUETAS_PANAL,
  ETIQUETAS_TOMA,
  type CantidadPanal,
  type Evento,
  type Panal,
  type Sueno,
  type TipoEvento,
  type TipoPanal,
  type TipoToma,
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
    hoy.value = claveDia(new Date().toISOString())
    // "Últimos N días" = hoy + los N-1 anteriores (igual que ultimosDias)
    const desde = new Date()
    desde.setDate(desde.getDate() - (dias.value - 1))
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

type RegistroDia =
  | { kind: 'toma'; id: string; hora: string; texto: string; toma: Toma }
  | { kind: 'sueno'; id: string; hora: string; texto: string; sueno: Sueno }
  | { kind: 'panal'; id: string; hora: string; texto: string; panal: Panal }
  | { kind: 'evento'; id: string; hora: string; texto: string; evento: Evento }

interface DiaHistorial {
  dia: string
  resumen: ReturnType<typeof resumenDia>
  registros: RegistroDia[]
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

      const registros: RegistroDia[] = [
        ...tomasDia.map((t): RegistroDia => ({
          kind: 'toma',
          id: t.id,
          hora: t.inicio,
          texto: textoToma(t),
          toma: t,
        })),
        ...suenosDia.map((s): RegistroDia => ({
          kind: 'sueno',
          id: s.id,
          hora: s.inicio,
          texto: textoSueno(s),
          sueno: s,
        })),
        ...panalesDia.map((p): RegistroDia => ({
          kind: 'panal',
          id: p.id,
          hora: p.fecha,
          texto: textoPanal(p),
          panal: p,
        })),
        ...eventosDia.map((e): RegistroDia => ({
          kind: 'evento',
          id: e.id,
          hora: e.fecha,
          texto: textoEvento(e),
          evento: e,
        })),
      ].sort((a, b) => a.hora.localeCompare(b.hora))

      return { dia, resumen: resumenDia(tomasDia, suenosDia, panalesDia), registros }
    })
})

// Se refresca en cada cargar() para no quedarse obsoleto pasada la medianoche
const hoy = ref(claveDia(new Date().toISOString()))

const diasRitmo = computed(() => ultimosDias(dias.value))

// ---- Edición de registros ----

interface Edicion {
  kind: RegistroDia['kind']
  id: string
  inicio: string // datetime-local: inicio (toma/sueño) o fecha (pañal/evento)
  fin: string // datetime-local o '' (solo sueño)
  tipoToma: TipoToma
  duracionMin: number | null
  cantidadMl: number | null
  tipoPanal: TipoPanal
  cantidadPanal: CantidadPanal | ''
  tipoEvento: TipoEvento
  descripcion: string
  notas: string
}

const edicion = ref<Edicion | null>(null)

function abrirEdicion(registro: RegistroDia) {
  if (edicion.value?.id === registro.id) {
    edicion.value = null
    return
  }
  const base: Edicion = {
    kind: registro.kind,
    id: registro.id,
    inicio: aInputLocal(new Date(registro.hora)),
    fin: '',
    tipoToma: 'biberon_formula',
    duracionMin: null,
    cantidadMl: null,
    tipoPanal: 'pis',
    cantidadPanal: '',
    tipoEvento: 'otro',
    descripcion: '',
    notas: '',
  }
  if (registro.kind === 'toma') {
    base.tipoToma = registro.toma.tipo
    base.duracionMin = duracionMinutos(registro.toma.inicio, registro.toma.fin)
    base.cantidadMl = registro.toma.cantidad_ml
    base.notas = registro.toma.notas ?? ''
  } else if (registro.kind === 'sueno') {
    base.fin = registro.sueno.fin ? aInputLocal(new Date(registro.sueno.fin)) : ''
  } else if (registro.kind === 'panal') {
    base.tipoPanal = registro.panal.tipo
    base.cantidadPanal = registro.panal.cantidad ?? ''
  } else {
    base.tipoEvento = registro.evento.tipo
    base.descripcion = registro.evento.descripcion ?? ''
  }
  edicion.value = base
}

const edicionEsBiberon = computed(() => edicion.value?.tipoToma.startsWith('biberon') ?? false)

async function ejecutar(accion: () => Promise<unknown>) {
  error.value = ''
  try {
    await accion()
    edicion.value = null
    await cargar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function guardarEdicion() {
  const e = edicion.value
  if (!e) return
  const inicioIso = new Date(e.inicio).toISOString()
  if (e.kind === 'toma') {
    const esBiberon = e.tipoToma.startsWith('biberon')
    // duracionMin viene precargada del registro original (abrirEdicion), así
    // que editar un biberón con fin (cronómetro) conserva su duración en vez
    // de borrarla; != null para no convertir una toma de 0 min en "en curso"
    const fin =
      e.duracionMin != null
        ? new Date(new Date(e.inicio).getTime() + e.duracionMin * 60_000).toISOString()
        : null
    ejecutar(() =>
      servicio.actualizarToma(e.id, {
        inicio: inicioIso,
        fin,
        tipo: e.tipoToma,
        cantidad_ml: esBiberon ? e.cantidadMl : null,
        notas: e.notas || null,
      }),
    )
  } else if (e.kind === 'sueno') {
    ejecutar(() =>
      servicio.actualizarSueno(e.id, {
        inicio: inicioIso,
        fin: e.fin ? new Date(e.fin).toISOString() : null,
      }),
    )
  } else if (e.kind === 'panal') {
    ejecutar(() =>
      servicio.actualizarPanal(e.id, {
        fecha: inicioIso,
        tipo: e.tipoPanal,
        cantidad: e.tipoPanal === 'pis' ? null : e.cantidadPanal || null,
      }),
    )
  } else {
    ejecutar(() =>
      servicio.actualizarEvento(e.id, {
        fecha: inicioIso,
        tipo: e.tipoEvento,
        descripcion: e.descripcion || null,
      }),
    )
  }
}

function borrarRegistro() {
  const e = edicion.value
  if (!e) return
  const borradores = {
    toma: servicio.eliminarToma,
    sueno: servicio.eliminarSueno,
    panal: servicio.eliminarPanal,
    evento: servicio.eliminarEvento,
  } as const
  ejecutar(() => borradores[e.kind](e.id))
}
</script>

<template>
  <main class="pantalla">
    <div class="tarjeta cabecera-historial">
      <h2>📖 Historial</h2>
      <select v-model.number="dias" aria-label="Días a mostrar">
        <option :value="7">Últimos 7 días</option>
        <option :value="14">Últimos 14 días</option>
        <option :value="30">Últimos 30 días</option>
      </select>
    </div>

    <p v-if="cargando" class="suave">Cargando…</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="!cargando && historial.length === 0" class="suave">Sin registros en este periodo.</p>

    <GraficaRitmo
      v-if="!cargando && historial.length > 0"
      :dias="diasRitmo"
      :suenos="suenos"
      :tomas="tomas"
    />

    <div v-for="diaHistorial in historial" :key="diaHistorial.dia" class="tarjeta">
      <button
        class="dia-boton"
        @click="diaAbierto = diaAbierto === diaHistorial.dia ? null : diaHistorial.dia"
      >
        <strong>
          📅 {{ diaHistorial.dia === hoy ? 'Hoy' : fechaLegible(diaHistorial.dia) }}
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
        <template v-for="registro in diaHistorial.registros" :key="registro.id">
          <div class="fila-registro">
            <span class="hora">{{ horaCorta(registro.hora) }}</span>
            <span class="detalle">{{ registro.texto }}</span>
            <button
              class="boton peligro editar"
              :aria-label="edicion?.id === registro.id ? 'Cerrar edición' : 'Editar registro'"
              @click="abrirEdicion(registro)"
            >
              {{ edicion?.id === registro.id ? '✕' : '✎' }}
            </button>
          </div>

          <!-- Formulario de edición del registro -->
          <form
            v-if="edicion && edicion.id === registro.id"
            class="edicion"
            @submit.prevent="guardarEdicion"
          >
            <template v-if="edicion.kind === 'toma'">
              <div class="campo">
                <label :for="`ed-tipo-${registro.id}`">Tipo</label>
                <select :id="`ed-tipo-${registro.id}`" v-model="edicion.tipoToma">
                  <option v-for="(etiqueta, valor) in ETIQUETAS_TOMA" :key="valor" :value="valor">
                    {{ etiqueta }}
                  </option>
                </select>
              </div>
              <div class="campo">
                <label :for="`ed-inicio-${registro.id}`">Hora de inicio</label>
                <input
                  :id="`ed-inicio-${registro.id}`"
                  v-model="edicion.inicio"
                  type="datetime-local"
                  required
                />
              </div>
              <div v-if="edicionEsBiberon" class="campo">
                <label :for="`ed-ml-${registro.id}`">Cantidad (ml)</label>
                <input
                  :id="`ed-ml-${registro.id}`"
                  v-model.number="edicion.cantidadMl"
                  type="number"
                  min="1"
                />
              </div>
              <div v-else class="campo">
                <label :for="`ed-min-${registro.id}`">Duración (min)</label>
                <input
                  :id="`ed-min-${registro.id}`"
                  v-model.number="edicion.duracionMin"
                  type="number"
                  min="1"
                />
              </div>
              <div class="campo">
                <label :for="`ed-notas-${registro.id}`">Notas</label>
                <input :id="`ed-notas-${registro.id}`" v-model="edicion.notas" type="text" />
              </div>
            </template>

            <template v-else-if="edicion.kind === 'sueno'">
              <div class="campo">
                <label :for="`ed-inicio-${registro.id}`">Empezó</label>
                <input
                  :id="`ed-inicio-${registro.id}`"
                  v-model="edicion.inicio"
                  type="datetime-local"
                  required
                />
              </div>
              <div class="campo">
                <label :for="`ed-fin-${registro.id}`">Terminó (vacío = en curso)</label>
                <input :id="`ed-fin-${registro.id}`" v-model="edicion.fin" type="datetime-local" />
              </div>
            </template>

            <template v-else-if="edicion.kind === 'panal'">
              <div class="campo">
                <label :for="`ed-tipo-${registro.id}`">Tipo</label>
                <select :id="`ed-tipo-${registro.id}`" v-model="edicion.tipoPanal">
                  <option v-for="(etiqueta, valor) in ETIQUETAS_PANAL" :key="valor" :value="valor">
                    {{ etiqueta }}
                  </option>
                </select>
              </div>
              <div v-if="edicion.tipoPanal !== 'pis'" class="campo">
                <label :for="`ed-cantidad-${registro.id}`">Cantidad</label>
                <select :id="`ed-cantidad-${registro.id}`" v-model="edicion.cantidadPanal">
                  <option value="">Sin especificar</option>
                  <option
                    v-for="(etiqueta, valor) in ETIQUETAS_CANTIDAD_PANAL"
                    :key="valor"
                    :value="valor"
                  >
                    {{ etiqueta }}
                  </option>
                </select>
              </div>
              <div class="campo">
                <label :for="`ed-inicio-${registro.id}`">Hora</label>
                <input
                  :id="`ed-inicio-${registro.id}`"
                  v-model="edicion.inicio"
                  type="datetime-local"
                  required
                />
              </div>
            </template>

            <template v-else>
              <div class="campo">
                <label :for="`ed-tipo-${registro.id}`">Tipo</label>
                <select :id="`ed-tipo-${registro.id}`" v-model="edicion.tipoEvento">
                  <option v-for="(etiqueta, valor) in ETIQUETAS_EVENTO" :key="valor" :value="valor">
                    {{ etiqueta }}
                  </option>
                </select>
              </div>
              <div class="campo">
                <label :for="`ed-desc-${registro.id}`">Descripción</label>
                <input :id="`ed-desc-${registro.id}`" v-model="edicion.descripcion" type="text" />
              </div>
              <div class="campo">
                <label :for="`ed-inicio-${registro.id}`">Hora</label>
                <input
                  :id="`ed-inicio-${registro.id}`"
                  v-model="edicion.inicio"
                  type="datetime-local"
                  required
                />
              </div>
            </template>

            <div class="botones-edicion">
              <button class="boton" type="submit">Guardar</button>
              <button class="boton peligro" type="button" @click="borrarRegistro">Borrar</button>
            </div>
          </form>
        </template>
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

.fila-registro .editar {
  color: var(--color-texto-suave);
}

.edicion {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde);
  border-radius: 10px;
  padding: 0.75rem;
  margin: 0.5rem 0;
}

.botones-edicion {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
