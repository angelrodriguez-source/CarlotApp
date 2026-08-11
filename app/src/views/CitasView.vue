<script setup lang="ts">
/**
 * CitasView.vue — Citas & Recordatorios: citas médicas y trámites
 * (próximas, pasadas y alta) más los recordatorios periódicos
 * ("vitamina D 1 vez al día") con su estado de hoy.
 */
import { computed, onMounted, ref } from 'vue'
import { useBebeStore } from '../stores/bebeStore'
import { useRecordatoriosStore } from '../stores/recordatoriosStore'
import { usarAutorrecarga } from '../components/autorrecarga'
import {
  ICONOS_REGISTRO,
  iconoCitasUrl,
  iconoProximasUrl,
  iconoHechasUrl,
} from '../assets/branding'
import * as servicio from '../services/carlotaService'
import { aInputLocal, fechaHoraCita, mensajeError } from '../models/CarlotaModel'
import {
  AJUSTES_RECORDATORIOS,
  ITEMS_RECORDATORIO,
  etiquetaRecordatorio,
  type EstadoRecordatorio,
} from '../models/recordatorios'
import {
  ETIQUETAS_CITA,
  ETIQUETAS_EJERCICIO,
  type Cita,
  type IntervaloRecordatorio,
  type ItemRecordatorio,
  type Recordatorio,
  type TipoCita,
  type TipoEjercicio,
} from '../types'

const bebeStore = useBebeStore()
const recordatoriosStore = useRecordatoriosStore()

const cargando = ref(true)
const error = ref('')
const citas = ref<Cita[]>([])
const mostrarFormulario = ref(false)
const mostrarPasadas = ref(false)

const nuevaCita = ref({
  titulo: '',
  tipo: 'medica' as TipoCita,
  fecha: aInputLocal(new Date()),
  lugar: '',
  notas: '',
})

// Token anti-pisado: si dos cargas se solapan (autorrecarga + escritura),
// la respuesta vieja no machaca a la nueva
let versionCarga = 0

async function cargar() {
  const version = ++versionCarga
  const bebe = await bebeStore.cargar()
  if (!bebe) return
  const lista = await servicio.listarCitas(bebe.id)
  if (version !== versionCarga) return
  citas.value = lista
  // Datos frescos en pantalla ⇒ fuera el banner de un fallo anterior
  error.value = ''
}

onMounted(async () => {
  try {
    await cargar()
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    cargando.value = false
  }
})

// Escrituras (propias o de la otra persona) y vuelta a primer plano.
// El estado de los recordatorios lo refresca su store por su cuenta.
const { recargarAhora } = usarAutorrecarga(() =>
  cargar().catch((e) => (error.value = mensajeError(e))),
)

/** Abre el alta con la fecha AL DÍA (la PWA puede llevar días viva) */
function alternarFormularioCita() {
  if (!mostrarFormulario.value) nuevaCita.value.fecha = aInputLocal(new Date())
  mostrarFormulario.value = !mostrarFormulario.value
}

/** Marca/desmarca una cita; si la petición falla, repone el checkbox */
async function alternarCita(evento: Event, cita: Cita, completada: boolean) {
  const ok = await ejecutar(() => servicio.marcarCita(cita.id, completada))
  if (!ok && evento.target instanceof HTMLInputElement) {
    evento.target.checked = cita.completada
  }
}

function borrarCita(cita: Cita) {
  if (!window.confirm(`¿Borrar la cita "${cita.titulo}"?`)) return
  ejecutar(() => servicio.eliminarCita(cita.id))
}

/**
 * Ejecuta y recarga; devuelve true solo si la acción principal fue bien.
 * Las acciones de citas recargan la lista (recargarAhora cancela el
 * debounce del evento de esa misma escritura); las de recordatorios
 * refrescan su store al momento.
 */
async function ejecutar(
  accion: () => Promise<unknown>,
  recarga: 'citas' | 'recordatorios' = 'citas',
): Promise<boolean> {
  error.value = ''
  try {
    await accion()
  } catch (e) {
    error.value = mensajeError(e)
    return false
  }
  if (recarga === 'citas') {
    await recargarAhora()
  } else {
    await recordatoriosStore.refrescar().catch((e) => (error.value = mensajeError(e)))
  }
  return true
}

async function guardarCita() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const datos = nuevaCita.value
  const guardada = await ejecutar(() =>
    servicio.crearCita({
      bebe_id: bebe.id,
      fecha: new Date(datos.fecha).toISOString(),
      titulo: datos.titulo,
      tipo: datos.tipo,
      lugar: datos.lugar || null,
      notas: datos.notas || null,
    }),
  )
  // Solo limpiar y cerrar si se guardó: si falló, conservar lo escrito
  if (!guardada) return
  mostrarFormulario.value = false
  nuevaCita.value = {
    titulo: '',
    tipo: 'medica',
    fecha: aInputLocal(new Date()),
    lugar: '',
    notas: '',
  }
}

const pendientes = computed(() =>
  citas.value.filter((c) => !c.completada).sort((a, b) => a.fecha.localeCompare(b.fecha)),
)
const pasadas = computed(() =>
  citas.value.filter((c) => c.completada).sort((a, b) => b.fecha.localeCompare(a.fecha)),
)

function icono(tipo: TipoCita): string {
  return tipo === 'medica' ? '🩺' : tipo === 'tramite' ? '📋' : '📌'
}

// ---- Recordatorios ----
const mostrarFormularioRecordatorio = ref(false)

const nuevoRecordatorio = ref({
  item: 'vitamina_d' as ItemRecordatorio,
  subtipo: 'tummy_time' as TipoEjercicio | '',
  intervalo: 'dia' as IntervaloRecordatorio,
  repeticiones: 1,
})

/** Estado (hechas/pendientes) por id; los inactivos no tienen */
const estadoPorId = computed(() => {
  const mapa = new Map<string, EstadoRecordatorio>()
  for (const e of recordatoriosStore.estados) mapa.set(e.recordatorio.id, e)
  return mapa
})

function iconoRecordatorio(r: Recordatorio): string | undefined {
  return ICONOS_REGISTRO[ITEMS_RECORDATORIO.find((i) => i.id === r.item)?.icono ?? 'otro']
}

/** "1 vez al día", "3 veces a la semana" */
function textoPauta(r: Recordatorio): string {
  const veces = r.repeticiones === 1 ? '1 vez' : `${r.repeticiones} veces`
  return `${veces} ${r.intervalo === 'dia' ? 'al día' : 'a la semana'}`
}

/** "Hoy: 1 de 3 · quedan 2" / "Hoy: ✓ cumplido" (o "Esta semana: …") */
function textoEstado(r: Recordatorio): string {
  const e = estadoPorId.value.get(r.id)
  if (!e) return 'En pausa'
  const ambito = r.intervalo === 'dia' ? 'Hoy' : 'Esta semana'
  if (e.cumplido) return `${ambito}: ✓ cumplido`
  const queda = e.pendientes === 1 ? 'queda 1' : `quedan ${e.pendientes}`
  return `${ambito}: ${e.hechas} de ${e.objetivo} · ${queda}`
}

async function guardarRecordatorio() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const datos = nuevoRecordatorio.value
  const guardado = await ejecutar(
    () =>
      servicio.crearRecordatorio({
        bebe_id: bebe.id,
        item: datos.item,
        subtipo: datos.item === 'ejercicio' && datos.subtipo ? datos.subtipo : null,
        intervalo: datos.intervalo,
        repeticiones: datos.repeticiones,
      }),
    'recordatorios',
  )
  if (!guardado) return
  mostrarFormularioRecordatorio.value = false
  nuevoRecordatorio.value = {
    item: 'vitamina_d',
    subtipo: 'tummy_time',
    intervalo: 'dia',
    repeticiones: 1,
  }
}

function alternarRecordatorio(r: Recordatorio) {
  ejecutar(() => servicio.actualizarRecordatorio(r.id, { activo: !r.activo }), 'recordatorios')
}

function borrarRecordatorio(r: Recordatorio) {
  if (!window.confirm(`¿Borrar el recordatorio "${etiquetaRecordatorio(r)}"?`)) return
  ejecutar(() => servicio.eliminarRecordatorio(r.id), 'recordatorios')
}
</script>

<template>
  <main class="pantalla">
    <div class="tarjeta cabecera-citas">
      <h2 class="titulo-vista"><img :src="iconoCitasUrl" alt="" /> Citas &amp; Recordatorios</h2>
      <button class="boton" @click="alternarFormularioCita">+ Cita</button>
    </div>

    <template v-if="cargando">
      <div class="esqueleto" style="height: 120px"></div>
      <div class="esqueleto" style="height: 70px"></div>
    </template>
    <p v-if="error" class="error">{{ error }}</p>

    <form v-if="mostrarFormulario" class="tarjeta" @submit.prevent="guardarCita">
      <h3>🗓️ Nueva cita</h3>
      <div class="campo">
        <label for="cita-titulo">Título</label>
        <input
          id="cita-titulo"
          v-model="nuevaCita.titulo"
          type="text"
          required
          placeholder="Revisión 4 meses, vacunas…"
        />
      </div>
      <div class="campo">
        <label for="cita-tipo">Tipo</label>
        <select id="cita-tipo" v-model="nuevaCita.tipo">
          <option v-for="(etiqueta, valor) in ETIQUETAS_CITA" :key="valor" :value="valor">
            {{ etiqueta }}
          </option>
        </select>
      </div>
      <div class="campo">
        <label for="cita-fecha">Fecha y hora</label>
        <input id="cita-fecha" v-model="nuevaCita.fecha" type="datetime-local" required />
      </div>
      <div class="campo">
        <label for="cita-lugar">Lugar</label>
        <input id="cita-lugar" v-model="nuevaCita.lugar" type="text" />
      </div>
      <div class="campo">
        <label for="cita-notas">Notas</label>
        <input id="cita-notas" v-model="nuevaCita.notas" type="text" />
      </div>
      <button class="boton" type="submit">Guardar</button>
    </form>

    <div class="tarjeta">
      <h3 class="titulo-seccion-citas">
        <img :src="iconoProximasUrl" alt="" class="icono-titulo" /> Próximas
      </h3>
      <p v-if="pendientes.length === 0" class="suave">No hay citas pendientes 🎉</p>
      <div v-for="cita in pendientes" :key="cita.id" class="fila-registro">
        <input
          type="checkbox"
          :checked="cita.completada"
          :aria-label="`Marcar hecha: ${cita.titulo}`"
          @change="alternarCita($event, cita, true)"
        />
        <span class="detalle">
          {{ icono(cita.tipo) }} <strong>{{ cita.titulo }}</strong>
          <br />
          <span class="suave">
            {{ fechaHoraCita(cita.fecha) }}
            <template v-if="cita.lugar"> · {{ cita.lugar }}</template>
            <template v-if="cita.notas"> · {{ cita.notas }}</template>
          </span>
        </span>
        <button
          class="boton peligro"
          :aria-label="`Borrar cita: ${cita.titulo}`"
          @click="borrarCita(cita)"
        >
          ✕
        </button>
      </div>
    </div>

    <div class="tarjeta">
      <button class="boton secundario" @click="mostrarPasadas = !mostrarPasadas">
        <img :src="iconoHechasUrl" alt="" class="icono-linea" />
        {{ mostrarPasadas ? 'Ocultar hechas' : `Ver hechas (${pasadas.length})` }}
      </button>
      <template v-if="mostrarPasadas">
        <div v-for="cita in pasadas" :key="cita.id" class="fila-registro hecha">
          <input
            type="checkbox"
            checked
            :aria-label="`Desmarcar: ${cita.titulo}`"
            @change="alternarCita($event, cita, false)"
          />
          <span class="detalle">
            {{ icono(cita.tipo) }} {{ cita.titulo }}
            <span class="suave"> · {{ fechaHoraCita(cita.fecha) }}</span>
          </span>
          <button
            class="boton peligro"
            :aria-label="`Borrar cita: ${cita.titulo}`"
            @click="borrarCita(cita)"
          >
            ✕
          </button>
        </div>
      </template>
    </div>

    <!-- Recordatorios: "esto debería hacerse N veces al día/semana" -->
    <div class="tarjeta">
      <div class="cabecera-recordatorios">
        <h3 class="titulo-seccion-citas">🔔 Recordatorios</h3>
        <button
          class="boton secundario"
          @click="mostrarFormularioRecordatorio = !mostrarFormularioRecordatorio"
        >
          + Recordatorio
        </button>
      </div>

      <form
        v-if="mostrarFormularioRecordatorio"
        class="formulario-recordatorio"
        @submit.prevent="guardarRecordatorio"
      >
        <div class="campo">
          <label for="rec-item">Ítem</label>
          <select id="rec-item" v-model="nuevoRecordatorio.item">
            <option v-for="i in ITEMS_RECORDATORIO" :key="i.id" :value="i.id">
              {{ i.etiqueta }}
            </option>
          </select>
        </div>
        <div v-if="nuevoRecordatorio.item === 'ejercicio'" class="campo">
          <label for="rec-subtipo">Tipo de ejercicio</label>
          <select id="rec-subtipo" v-model="nuevoRecordatorio.subtipo">
            <option v-for="(etiqueta, valor) in ETIQUETAS_EJERCICIO" :key="valor" :value="valor">
              {{ etiqueta }}
            </option>
            <option value="">Cualquiera</option>
          </select>
        </div>
        <div class="campo">
          <label for="rec-intervalo">Intervalo</label>
          <select id="rec-intervalo" v-model="nuevoRecordatorio.intervalo">
            <option value="dia">Al día</option>
            <option value="semana">A la semana</option>
          </select>
        </div>
        <div class="campo">
          <label for="rec-repeticiones">Veces</label>
          <input
            id="rec-repeticiones"
            v-model.number="nuevoRecordatorio.repeticiones"
            type="number"
            :min="AJUSTES_RECORDATORIOS.repeticiones.min"
            :max="AJUSTES_RECORDATORIOS.repeticiones.max"
            required
          />
        </div>
        <button class="boton" type="submit">Guardar</button>
      </form>

      <p v-if="recordatoriosStore.recordatorios.length === 0" class="suave">
        Sin recordatorios. Añade uno: vitamina D 1 vez al día, Tummy Time 3 veces al día…
      </p>
      <div
        v-for="r in recordatoriosStore.recordatorios"
        :key="r.id"
        class="fila-registro"
        :class="{ pausado: !r.activo }"
      >
        <img
          v-if="iconoRecordatorio(r)"
          :src="iconoRecordatorio(r)"
          alt=""
          class="icono-recordatorio"
        />
        <span class="detalle">
          <strong>{{ etiquetaRecordatorio(r) }}</strong> · {{ textoPauta(r) }}
          <br />
          <span class="suave">{{ textoEstado(r) }}</span>
        </span>
        <button
          class="boton secundario"
          :aria-label="`${r.activo ? 'Pausar' : 'Reactivar'}: ${etiquetaRecordatorio(r)}`"
          @click="alternarRecordatorio(r)"
        >
          {{ r.activo ? '⏸' : '▶' }}
        </button>
        <button
          class="boton peligro"
          :aria-label="`Borrar recordatorio: ${etiquetaRecordatorio(r)}`"
          @click="borrarRecordatorio(r)"
        >
          ✕
        </button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.titulo-seccion-citas {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.titulo-seccion-citas .icono-titulo {
  width: 24px;
  height: 24px;
}

.cabecera-citas {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hecha .detalle {
  text-decoration: line-through;
  color: var(--color-texto-suave);
}

/* ---- Recordatorios ---- */
.cabecera-recordatorios {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.cabecera-recordatorios h3 {
  margin: 0;
}

.formulario-recordatorio {
  margin: 0.75rem 0 0.5rem;
  padding: 0.75rem;
  background: var(--color-fondo);
  border-radius: var(--radio-s);
}

.icono-recordatorio {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
}

/* Recordatorio en pausa: se ve, pero apagado */
.pausado .detalle,
.pausado .icono-recordatorio {
  opacity: 0.5;
}
</style>
