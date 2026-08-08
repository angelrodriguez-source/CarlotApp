<script setup lang="ts">
/**
 * HojaEdicionRegistro.vue — Hoja inferior para editar (o borrar) cualquier
 * registro: toma, sueño, pañal o evento. La usan la línea de tiempo de Hoy
 * y los días del Historial. Llama al servicio y emite 'guardado' al acabar;
 * el padre recarga sus datos y cierra pasando registro = null.
 */
import { computed, ref, watch } from 'vue'
import * as servicio from '../services/carlotaService'
import HojaInferior from './HojaInferior.vue'
import { aInputLocal, duracionMinutos } from '../models/CarlotaModel'
import {
  ETIQUETAS_CANTIDAD_PANAL,
  ETIQUETAS_EVENTO,
  ETIQUETAS_PANAL,
  ETIQUETAS_TOMA,
  type CantidadPanal,
  type TipoEvento,
  type TipoPanal,
  type TipoToma,
} from '../types'
import type { RegistroEditable } from './registroEditable'

const props = defineProps<{ registro: RegistroEditable | null }>()

const emit = defineEmits<{ cerrar: []; guardado: [] }>()

interface Edicion {
  kind: RegistroEditable['kind']
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
const error = ref('')

watch(
  () => props.registro,
  (registro) => {
    error.value = ''
    edicion.value = registro ? construir(registro) : null
  },
)

function construir(registro: RegistroEditable): Edicion {
  const base: Edicion = {
    kind: registro.kind,
    id: '',
    inicio: '',
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
    base.id = registro.toma.id
    base.inicio = aInputLocal(new Date(registro.toma.inicio))
    base.tipoToma = registro.toma.tipo
    base.duracionMin = duracionMinutos(registro.toma.inicio, registro.toma.fin)
    base.cantidadMl = registro.toma.cantidad_ml
    base.notas = registro.toma.notas ?? ''
  } else if (registro.kind === 'sueno') {
    base.id = registro.sueno.id
    base.inicio = aInputLocal(new Date(registro.sueno.inicio))
    base.fin = registro.sueno.fin ? aInputLocal(new Date(registro.sueno.fin)) : ''
  } else if (registro.kind === 'panal') {
    base.id = registro.panal.id
    base.inicio = aInputLocal(new Date(registro.panal.fecha))
    base.tipoPanal = registro.panal.tipo
    base.cantidadPanal = registro.panal.cantidad ?? ''
  } else {
    base.id = registro.evento.id
    base.inicio = aInputLocal(new Date(registro.evento.fecha))
    base.tipoEvento = registro.evento.tipo
    base.descripcion = registro.evento.descripcion ?? ''
  }
  return base
}

const TITULOS: Record<RegistroEditable['kind'], string> = {
  toma: '🍼 Editar toma',
  sueno: '😴 Editar sueño',
  panal: '🧷 Editar pañal',
  evento: '⭐ Editar evento',
}

const titulo = computed(() => (edicion.value ? TITULOS[edicion.value.kind] : ''))

const esBiberon = computed(() => edicion.value?.tipoToma.startsWith('biberon') ?? false)

async function ejecutar(accion: () => Promise<unknown>) {
  error.value = ''
  try {
    await accion()
    emit('guardado')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function guardar() {
  const e = edicion.value
  if (!e) return
  const inicioIso = new Date(e.inicio).toISOString()
  if (e.kind === 'toma') {
    // duracionMin viene precargada del registro original, así que editar un
    // biberón con fin (cronómetro) conserva su duración; != null para no
    // convertir una toma de 0 min en "en curso"
    const fin =
      e.duracionMin != null
        ? new Date(new Date(e.inicio).getTime() + e.duracionMin * 60_000).toISOString()
        : null
    ejecutar(() =>
      servicio.actualizarToma(e.id, {
        inicio: inicioIso,
        fin,
        tipo: e.tipoToma,
        cantidad_ml: e.tipoToma.startsWith('biberon') ? e.cantidadMl : null,
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

function borrar() {
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
  <HojaInferior :abierta="edicion !== null" :titulo="titulo" @cerrar="emit('cerrar')">
    <form v-if="edicion" @submit.prevent="guardar">
      <template v-if="edicion.kind === 'toma'">
        <div class="campo">
          <label for="ed-tipo-toma">Tipo</label>
          <select id="ed-tipo-toma" v-model="edicion.tipoToma">
            <option v-for="(etiqueta, valor) in ETIQUETAS_TOMA" :key="valor" :value="valor">
              {{ etiqueta }}
            </option>
          </select>
        </div>
        <div class="campo">
          <label for="ed-inicio">Hora de inicio</label>
          <input id="ed-inicio" v-model="edicion.inicio" type="datetime-local" required />
        </div>
        <div v-if="esBiberon" class="campo">
          <label for="ed-ml">Cantidad (ml)</label>
          <input id="ed-ml" v-model.number="edicion.cantidadMl" type="number" min="1" />
        </div>
        <div v-else class="campo">
          <label for="ed-min">Duración (min)</label>
          <input id="ed-min" v-model.number="edicion.duracionMin" type="number" min="1" />
        </div>
        <div class="campo">
          <label for="ed-notas">Notas</label>
          <input id="ed-notas" v-model="edicion.notas" type="text" />
        </div>
      </template>

      <template v-else-if="edicion.kind === 'sueno'">
        <div class="campo">
          <label for="ed-inicio">Empezó</label>
          <input id="ed-inicio" v-model="edicion.inicio" type="datetime-local" required />
        </div>
        <div class="campo">
          <label for="ed-fin">Terminó (vacío = en curso)</label>
          <input id="ed-fin" v-model="edicion.fin" type="datetime-local" />
        </div>
      </template>

      <template v-else-if="edicion.kind === 'panal'">
        <div class="campo">
          <label for="ed-tipo-panal">Tipo</label>
          <select id="ed-tipo-panal" v-model="edicion.tipoPanal">
            <option v-for="(etiqueta, valor) in ETIQUETAS_PANAL" :key="valor" :value="valor">
              {{ etiqueta }}
            </option>
          </select>
        </div>
        <div v-if="edicion.tipoPanal !== 'pis'" class="campo">
          <label for="ed-cantidad">Cantidad</label>
          <select id="ed-cantidad" v-model="edicion.cantidadPanal">
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
          <label for="ed-inicio">Hora</label>
          <input id="ed-inicio" v-model="edicion.inicio" type="datetime-local" required />
        </div>
      </template>

      <template v-else>
        <div class="campo">
          <label for="ed-tipo-evento">Tipo</label>
          <select id="ed-tipo-evento" v-model="edicion.tipoEvento">
            <option v-for="(etiqueta, valor) in ETIQUETAS_EVENTO" :key="valor" :value="valor">
              {{ etiqueta }}
            </option>
          </select>
        </div>
        <div class="campo">
          <label for="ed-desc">Descripción</label>
          <input id="ed-desc" v-model="edicion.descripcion" type="text" />
        </div>
        <div class="campo">
          <label for="ed-inicio">Hora</label>
          <input id="ed-inicio" v-model="edicion.inicio" type="datetime-local" required />
        </div>
      </template>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="botones-edicion">
        <button class="boton" type="submit">Guardar</button>
        <button class="boton peligro" type="button" @click="borrar">Borrar</button>
      </div>
    </form>
  </HojaInferior>
</template>

<style scoped>
.botones-edicion {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
