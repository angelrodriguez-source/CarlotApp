<script setup lang="ts">
/**
 * HoyView.vue — Pantalla principal: registro rápido + lo que ha pasado hoy.
 *
 * Acciones de un toque: pañal, empezar/terminar sueño. Formularios cortos:
 * toma y evento. Debajo, la línea de tiempo del día con opción de borrar.
 */
import { computed, onMounted, ref } from 'vue'
import { useBebeStore } from '../stores/bebeStore'
import * as servicio from '../services/carlotaService'
import { formatoDuracion, duracionMinutos, resumenDia } from '../models/CarlotaModel'
import {
  ETIQUETAS_EVENTO,
  ETIQUETAS_PANAL,
  ETIQUETAS_TOMA,
  type Evento,
  type Panal,
  type Sueno,
  type TipoEvento,
  type TipoPanal,
  type TipoToma,
  type Toma,
} from '../types'

const bebeStore = useBebeStore()

const cargando = ref(true)
const error = ref('')

const tomas = ref<Toma[]>([])
const suenos = ref<Sueno[]>([])
const panales = ref<Panal[]>([])
const eventos = ref<Evento[]>([])
const suenoAbierto = ref<Sueno | null>(null)

// Qué formulario rápido está abierto
const formulario = ref<'toma' | 'evento' | null>(null)

/** ISO del inicio del día de HOY en la zona local */
function inicioHoyIso(): string {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return hoy.toISOString()
}

/** Date → valor para <input type="datetime-local"> en hora local */
function aInputLocal(fecha: Date): string {
  const dia = fecha.toLocaleDateString('sv-SE')
  const hora = fecha.toTimeString().slice(0, 5)
  return `${dia}T${hora}`
}

async function cargarDia() {
  const bebe = await bebeStore.cargar()
  if (!bebe) return
  const desde = inicioHoyIso()
  ;[tomas.value, suenos.value, panales.value, eventos.value, suenoAbierto.value] =
    await Promise.all([
      servicio.listarTomas(bebe.id, desde),
      servicio.listarSuenos(bebe.id, desde),
      servicio.listarPanales(bebe.id, desde),
      servicio.listarEventos(bebe.id, desde),
      servicio.getSuenoAbierto(bebe.id),
    ])
}

onMounted(async () => {
  try {
    await cargarDia()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    cargando.value = false
  }
})

async function ejecutar(accion: () => Promise<unknown>) {
  error.value = ''
  try {
    await accion()
    await cargarDia()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

// ---- Toma ----
const nuevaToma = ref({
  tipo: 'pecho_izq' as TipoToma,
  inicio: aInputLocal(new Date()),
  duracionMin: null as number | null,
  cantidadMl: null as number | null,
  notas: '',
})

const esBiberon = computed(() => nuevaToma.value.tipo.startsWith('biberon'))

function abrirFormularioToma() {
  nuevaToma.value.inicio = aInputLocal(new Date())
  formulario.value = formulario.value === 'toma' ? null : 'toma'
}

function guardarToma() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const inicio = new Date(nuevaToma.value.inicio)
  const minutos = nuevaToma.value.duracionMin
  const fin =
    !esBiberon.value && minutos ? new Date(inicio.getTime() + minutos * 60_000) : null
  ejecutar(() =>
    servicio.registrarToma({
      bebe_id: bebe.id,
      inicio: inicio.toISOString(),
      fin: fin ? fin.toISOString() : null,
      tipo: nuevaToma.value.tipo,
      cantidad_ml: esBiberon.value ? nuevaToma.value.cantidadMl : null,
      notas: nuevaToma.value.notas || null,
    }),
  )
  formulario.value = null
  nuevaToma.value.notas = ''
}

// ---- Sueño ----
function alternarSueno() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const ahora = new Date().toISOString()
  if (suenoAbierto.value) {
    const id = suenoAbierto.value.id
    ejecutar(() => servicio.finalizarSueno(id, ahora))
  } else {
    ejecutar(() => servicio.iniciarSueno(bebe.id, ahora))
  }
}

// ---- Pañal (un toque) ----
function registrarPanal(tipo: TipoPanal) {
  const bebe = bebeStore.bebe
  if (!bebe) return
  ejecutar(() =>
    servicio.registrarPanal({
      bebe_id: bebe.id,
      fecha: new Date().toISOString(),
      tipo,
      notas: null,
    }),
  )
}

// ---- Evento ----
const nuevoEvento = ref({ tipo: 'bano' as TipoEvento, descripcion: '' })

function guardarEvento() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  ejecutar(() =>
    servicio.registrarEvento({
      bebe_id: bebe.id,
      fecha: new Date().toISOString(),
      tipo: nuevoEvento.value.tipo,
      descripcion: nuevoEvento.value.descripcion || null,
    }),
  )
  formulario.value = null
  nuevoEvento.value.descripcion = ''
}

// ---- Línea de tiempo del día ----
interface Registro {
  id: string
  hora: string // ISO
  texto: string
  borrar: () => Promise<void>
}

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

const lineaDeTiempo = computed<Registro[]>(() => {
  const registros: Registro[] = []
  for (const t of tomas.value) {
    const minutos = duracionMinutos(t.inicio, t.fin)
    const detalle = t.cantidad_ml
      ? `${t.cantidad_ml} ml`
      : minutos !== null
        ? formatoDuracion(minutos)
        : ''
    registros.push({
      id: t.id,
      hora: t.inicio,
      texto: `🍼 ${ETIQUETAS_TOMA[t.tipo]}${detalle ? ` — ${detalle}` : ''}${t.notas ? ` · ${t.notas}` : ''}`,
      borrar: () => servicio.eliminarToma(t.id),
    })
  }
  for (const s of suenos.value) {
    const minutos = duracionMinutos(s.inicio, s.fin)
    registros.push({
      id: s.id,
      hora: s.inicio,
      texto: `😴 Sueño${minutos !== null ? ` — ${formatoDuracion(minutos)}` : ' (en curso)'}`,
      borrar: () => servicio.eliminarSueno(s.id),
    })
  }
  for (const p of panales.value) {
    registros.push({
      id: p.id,
      hora: p.fecha,
      texto: `🧷 Pañal — ${ETIQUETAS_PANAL[p.tipo]}`,
      borrar: () => servicio.eliminarPanal(p.id),
    })
  }
  for (const e of eventos.value) {
    registros.push({
      id: e.id,
      hora: e.fecha,
      texto: `⭐ ${ETIQUETAS_EVENTO[e.tipo]}${e.descripcion ? ` — ${e.descripcion}` : ''}`,
      borrar: () => servicio.eliminarEvento(e.id),
    })
  }
  return registros.sort((a, b) => b.hora.localeCompare(a.hora))
})

const resumen = computed(() => resumenDia(tomas.value, suenos.value, panales.value))
</script>

<template>
  <main class="pantalla">
    <p v-if="cargando" class="suave">Cargando…</p>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="!cargando && bebeStore.cargado && !bebeStore.bebe">
      <div class="tarjeta">
        <h2>Cuenta sin acceso</h2>
        <p>
          Este usuario no está en la lista blanca (<code>usuarios_autorizados</code>).
          Comprueba que has entrado con el Google correcto, o añade el email con una
          migración nueva.
        </p>
      </div>
    </template>

    <template v-if="bebeStore.bebe">
      <!-- Resumen de hoy -->
      <div class="tarjeta">
        <h2>Hoy</h2>
        <span class="chip">🍼 {{ resumen.numTomas }} tomas</span>
        <span v-if="resumen.mlBiberon > 0" class="chip">{{ resumen.mlBiberon }} ml biberón</span>
        <span v-if="resumen.minutosPecho > 0" class="chip">
          {{ formatoDuracion(resumen.minutosPecho) }} pecho
        </span>
        <span class="chip">😴 {{ formatoDuracion(resumen.minutosSueno) }}</span>
        <span class="chip">🧷 {{ resumen.numPanales }} ({{ resumen.numCacas }} 💩)</span>
      </div>

      <!-- Acciones rápidas -->
      <div class="tarjeta acciones">
        <button class="boton" @click="abrirFormularioToma">+ Toma</button>
        <button class="boton" :class="{ secundario: !suenoAbierto }" @click="alternarSueno">
          {{ suenoAbierto ? '😴 Fin del sueño' : '😴 Empieza sueño' }}
        </button>
        <button
          class="boton secundario"
          @click="formulario = formulario === 'evento' ? null : 'evento'"
        >
          + Evento
        </button>
      </div>

      <div class="tarjeta acciones">
        <span class="suave">Pañal:</span>
        <button class="boton secundario" @click="registrarPanal('pis')">💧 Pis</button>
        <button class="boton secundario" @click="registrarPanal('caca')">💩 Caca</button>
        <button class="boton secundario" @click="registrarPanal('mixto')">💧💩 Mixto</button>
      </div>

      <!-- Formulario: toma -->
      <form v-if="formulario === 'toma'" class="tarjeta" @submit.prevent="guardarToma">
        <h3>Nueva toma</h3>
        <div class="campo">
          <label for="toma-tipo">Tipo</label>
          <select id="toma-tipo" v-model="nuevaToma.tipo">
            <option v-for="(etiqueta, valor) in ETIQUETAS_TOMA" :key="valor" :value="valor">
              {{ etiqueta }}
            </option>
          </select>
        </div>
        <div class="campo">
          <label for="toma-inicio">Hora de inicio</label>
          <input id="toma-inicio" v-model="nuevaToma.inicio" type="datetime-local" required />
        </div>
        <div v-if="esBiberon" class="campo">
          <label for="toma-ml">Cantidad (ml)</label>
          <input id="toma-ml" v-model.number="nuevaToma.cantidadMl" type="number" min="1" />
        </div>
        <div v-else class="campo">
          <label for="toma-min">Duración (min)</label>
          <input id="toma-min" v-model.number="nuevaToma.duracionMin" type="number" min="1" />
        </div>
        <div class="campo">
          <label for="toma-notas">Notas</label>
          <input id="toma-notas" v-model="nuevaToma.notas" type="text" />
        </div>
        <button class="boton" type="submit">Guardar</button>
      </form>

      <!-- Formulario: evento -->
      <form v-if="formulario === 'evento'" class="tarjeta" @submit.prevent="guardarEvento">
        <h3>Nuevo evento</h3>
        <div class="campo">
          <label for="evento-tipo">Tipo</label>
          <select id="evento-tipo" v-model="nuevoEvento.tipo">
            <option v-for="(etiqueta, valor) in ETIQUETAS_EVENTO" :key="valor" :value="valor">
              {{ etiqueta }}
            </option>
          </select>
        </div>
        <div class="campo">
          <label for="evento-desc">Descripción</label>
          <input id="evento-desc" v-model="nuevoEvento.descripcion" type="text" />
        </div>
        <button class="boton" type="submit">Guardar</button>
      </form>

      <!-- Línea de tiempo de hoy -->
      <div class="tarjeta">
        <h3>Registro del día</h3>
        <p v-if="lineaDeTiempo.length === 0" class="suave">Todavía no hay registros hoy.</p>
        <div v-for="registro in lineaDeTiempo" :key="registro.id" class="fila-registro">
          <span class="hora">{{ horaCorta(registro.hora) }}</span>
          <span class="detalle">{{ registro.texto }}</span>
          <button class="boton peligro" @click="ejecutar(registro.borrar)">✕</button>
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
</style>
