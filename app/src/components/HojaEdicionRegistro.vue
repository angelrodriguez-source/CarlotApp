<script setup lang="ts">
/**
 * HojaEdicionRegistro.vue — Hoja inferior para editar (o borrar) cualquier
 * registro: toma, sueño, pañal o evento. La usan la línea de tiempo de Hoy
 * y los días del Historial. Llama al servicio y emite 'guardado' al acabar;
 * el padre recarga sus datos y cierra pasando registro = null.
 */
import { computed, ref, watch } from 'vue'
import * as servicio from '../services/carlotaService'
import { useBebeStore } from '../stores/bebeStore'
import HojaInferior from './HojaInferior.vue'
import { aInputLocal, duracionMinutos, mensajeError, numeroONull } from '../models/CarlotaModel'
import {
  LIMITES_ENTRADA,
  primerError,
  validarFechaRegistro,
  validarRango,
  validarTramoSueno,
} from '../models/validacion'
import { ICONOS_REGISTRO } from '../assets/branding'
import {
  ETIQUETAS_CANTIDAD_PANAL,
  ETIQUETAS_EJERCICIO,
  ETIQUETAS_EVENTO,
  ETIQUETAS_PANAL,
  ETIQUETAS_TOMA,
  type CantidadPanal,
  type TipoEjercicio,
  type TipoEvento,
  type TipoPanal,
  type TipoToma,
} from '../types'
import type { RegistroEditable } from './registroEditable'

const props = defineProps<{ registro: RegistroEditable | null }>()

const emit = defineEmits<{ cerrar: []; guardado: [] }>()

const bebeStore = useBebeStore()

interface Edicion {
  kind: RegistroEditable['kind']
  id: string
  inicio: string // datetime-local: inicio (toma/sueño) o fecha (pañal/evento)
  fin: string // datetime-local o '' (solo sueño)
  /** Toma con el cronómetro en marcha (fin y ml a null): editarla con
   *  duración/ml vacíos corrige el inicio SIN cerrarla */
  enCurso: boolean
  tipoToma: TipoToma
  duracionMin: number | null
  cantidadMl: number | null
  tipoPanal: TipoPanal
  cantidadPanal: CantidadPanal | ''
  tipoEvento: TipoEvento
  subtipoEjercicio: TipoEjercicio
  duracionEjercicio: number | null
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
    enCurso: false,
    tipoToma: 'biberon_formula',
    duracionMin: null,
    cantidadMl: null,
    tipoPanal: 'pis',
    cantidadPanal: '',
    tipoEvento: 'otro',
    subtipoEjercicio: 'tummy_time',
    duracionEjercicio: null,
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
    base.enCurso = registro.toma.fin === null && registro.toma.cantidad_ml === null
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
    base.subtipoEjercicio = registro.evento.subtipo ?? 'tummy_time'
    base.duracionEjercicio = registro.evento.duracion_min
    base.descripcion = registro.evento.descripcion ?? ''
  }
  return base
}

/**
 * Tope de los selectores de fecha/hora: ahora mismo (editar hacia el
 * futuro solo puede ser un error de tecleo). Función, no computed, para
 * que se reevalúe en cada render.
 */
function topeHora(): string {
  return aInputLocal(new Date())
}

// Con icono propio el título va limpio; sin él conserva su emoji
const TITULOS: Record<RegistroEditable['kind'], { texto: string; icono?: string }> = {
  toma: { texto: 'Editar toma', icono: ICONOS_REGISTRO.toma },
  sueno: { texto: 'Editar sueño', icono: ICONOS_REGISTRO.sueno },
  panal: { texto: 'Editar pañal', icono: ICONOS_REGISTRO.panal },
  evento: { texto: 'Editar evento', icono: ICONOS_REGISTRO.otro },
}

const titulo = computed(() => (edicion.value ? TITULOS[edicion.value.kind].texto : ''))
const iconoTitulo = computed(() => (edicion.value ? TITULOS[edicion.value.kind].icono : undefined))

const esBiberon = computed(() => edicion.value?.tipoToma.startsWith('biberon') ?? false)

async function ejecutar(accion: () => Promise<unknown>) {
  error.value = ''
  try {
    await accion()
    emit('guardado')
  } catch (e) {
    error.value = mensajeError(e)
  }
}

function guardar() {
  const e = edicion.value
  if (!e) return
  // Rangos aceptables (models/validacion.ts): fecha dentro de la vida de
  // la bebé y sin futuro — la edición valida lo mismo que el alta
  const nacimiento = bebeStore.bebe?.fecha_nacimiento ?? ''
  const problemaFecha = nacimiento ? validarFechaRegistro(new Date(e.inicio), nacimiento) : null
  if (problemaFecha) {
    error.value = problemaFecha
    return
  }
  const inicioIso = new Date(e.inicio).toISOString()
  if (e.kind === 'toma') {
    const esBiberonToma = e.tipoToma.startsWith('biberon')
    const cantidadMl = numeroONull(e.cantidadMl)
    const duracionMin = numeroONull(e.duracionMin)
    // Toma con el cronómetro en marcha y campos vacíos: corregir
    // inicio/tipo/notas SIN cerrarla (sigue en curso)
    const sigueEnCurso = e.enCurso && cantidadMl === null && duracionMin === null
    if (!sigueEnCurso && !esBiberonToma && duracionMin === null) {
      error.value = 'Indica la duración de la toma de pecho'
      return
    }
    if (!sigueEnCurso && esBiberonToma && cantidadMl === null && duracionMin === null) {
      // Sin ml ni duración quedaría como "toma en curso" fantasma
      error.value = 'Indica la cantidad del biberón'
      return
    }
    const problema = primerError(
      validarRango(cantidadMl, LIMITES_ENTRADA.tomaMl),
      validarRango(duracionMin, LIMITES_ENTRADA.tomaPechoMin),
    )
    if (problema) {
      error.value = problema
      return
    }
    // duracionMin viene precargada del registro original, así que editar un
    // biberón con fin (cronómetro) conserva su duración; la comprobación de
    // null evita convertir una toma cerrada en "en curso"
    const fin =
      duracionMin !== null
        ? new Date(new Date(e.inicio).getTime() + duracionMin * 60_000).toISOString()
        : null
    ejecutar(() =>
      servicio.actualizarToma(e.id, {
        inicio: inicioIso,
        fin,
        tipo: e.tipoToma,
        cantidad_ml: esBiberonToma ? cantidadMl : null,
        notas: e.notas || null,
      }),
    )
  } else if (e.kind === 'sueno') {
    const problema = e.fin ? validarTramoSueno(new Date(e.inicio), new Date(e.fin)) : null
    if (problema) {
      error.value = problema
      return
    }
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
    const esEjercicio = e.tipoEvento === 'ejercicio'
    if (esEjercicio) {
      const problema = validarRango(numeroONull(e.duracionEjercicio), LIMITES_ENTRADA.ejercicioMin)
      if (problema) {
        error.value = problema
        return
      }
    }
    ejecutar(() =>
      servicio.actualizarEvento(e.id, {
        fecha: inicioIso,
        tipo: e.tipoEvento,
        descripcion: e.descripcion || null,
        subtipo: esEjercicio ? e.subtipoEjercicio : null,
        duracion_min: esEjercicio ? numeroONull(e.duracionEjercicio) : null,
      }),
    )
  }
}

function borrar() {
  const e = edicion.value
  if (!e) return
  if (!window.confirm('¿Borrar este registro?')) return
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
  <HojaInferior
    :abierta="edicion !== null"
    :titulo="titulo"
    :icono="iconoTitulo"
    @cerrar="emit('cerrar')"
  >
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
          <input
            id="ed-inicio"
            v-model="edicion.inicio"
            type="datetime-local"
            :max="topeHora()"
            required
          />
        </div>
        <div v-if="esBiberon" class="campo">
          <label for="ed-ml">
            Cantidad (ml){{ edicion.enCurso ? ' — vacío = sigue en curso' : '' }}
          </label>
          <input
            id="ed-ml"
            v-model.number="edicion.cantidadMl"
            type="number"
            :min="LIMITES_ENTRADA.tomaMl.min"
            :max="LIMITES_ENTRADA.tomaMl.max"
            :required="!edicion.enCurso"
          />
        </div>
        <div v-else class="campo">
          <label for="ed-min">
            Duración (min){{ edicion.enCurso ? ' — vacío = sigue en curso' : '' }}
          </label>
          <input
            id="ed-min"
            v-model.number="edicion.duracionMin"
            type="number"
            :min="LIMITES_ENTRADA.tomaPechoMin.min"
            :max="LIMITES_ENTRADA.tomaPechoMin.max"
            :required="!edicion.enCurso"
          />
        </div>
        <div class="campo">
          <label for="ed-notas">Notas</label>
          <input id="ed-notas" v-model="edicion.notas" type="text" />
        </div>
      </template>

      <template v-else-if="edicion.kind === 'sueno'">
        <div class="campo">
          <label for="ed-inicio">Empezó</label>
          <input
            id="ed-inicio"
            v-model="edicion.inicio"
            type="datetime-local"
            :max="topeHora()"
            required
          />
        </div>
        <div class="campo">
          <label for="ed-fin">Terminó (vacío = en curso)</label>
          <input id="ed-fin" v-model="edicion.fin" type="datetime-local" :max="topeHora()" />
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
          <input
            id="ed-inicio"
            v-model="edicion.inicio"
            type="datetime-local"
            :max="topeHora()"
            required
          />
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
        <template v-if="edicion.tipoEvento === 'ejercicio'">
          <div class="campo">
            <label for="ed-subtipo-ejercicio">Ejercicio</label>
            <select id="ed-subtipo-ejercicio" v-model="edicion.subtipoEjercicio">
              <option v-for="(etiqueta, valor) in ETIQUETAS_EJERCICIO" :key="valor" :value="valor">
                {{ etiqueta }}
              </option>
            </select>
          </div>
          <div class="campo">
            <label for="ed-ejercicio-min">Tiempo (min)</label>
            <input
              id="ed-ejercicio-min"
              v-model.number="edicion.duracionEjercicio"
              type="number"
              :min="LIMITES_ENTRADA.ejercicioMin.min"
              :max="LIMITES_ENTRADA.ejercicioMin.max"
              required
            />
          </div>
        </template>
        <div v-else class="campo">
          <label for="ed-desc">Descripción</label>
          <input id="ed-desc" v-model="edicion.descripcion" type="text" />
        </div>
        <div class="campo">
          <label for="ed-inicio">Hora</label>
          <input
            id="ed-inicio"
            v-model="edicion.inicio"
            type="datetime-local"
            :max="topeHora()"
            required
          />
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
