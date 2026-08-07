<script setup lang="ts">
/**
 * HoyView.vue — Dashboard de inicio.
 *
 * Mitad superior: resumen de Carlota con números en grande — edad/peso/altura,
 * sueño del día (incluye el sueño en curso) y leche tomada.
 * Mitad inferior: accesos directos Sueño / Toma / Caca + botón "Más" para el
 * resto (pañal pis/mixto y eventos). Debajo, la línea de tiempo del día.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useBebeStore } from '../stores/bebeStore'
import * as servicio from '../services/carlotaService'
import {
  duracionMinutos,
  edadCorta,
  formatoDuracion,
  formatoPeso,
  resumenDia,
  ultimoValor,
} from '../models/CarlotaModel'
import {
  ETIQUETAS_EVENTO,
  ETIQUETAS_PANAL,
  ETIQUETAS_TOMA,
  type Evento,
  type Medida,
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
const medidas = ref<Medida[]>([])
const suenoAbierto = ref<Sueno | null>(null)

// Qué formulario rápido está abierto
const formulario = ref<'toma' | 'mas' | null>(null)

// Reloj para que la edad y el sueño en curso se actualicen solos
const ahora = ref(new Date())
let temporizador: number | undefined

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
  ;[
    tomas.value,
    suenos.value,
    panales.value,
    eventos.value,
    medidas.value,
    suenoAbierto.value,
  ] = await Promise.all([
    servicio.listarTomas(bebe.id, desde),
    servicio.listarSuenos(bebe.id, desde),
    servicio.listarPanales(bebe.id, desde),
    servicio.listarEventos(bebe.id, desde),
    servicio.listarMedidas(bebe.id),
    servicio.getSuenoAbierto(bebe.id),
  ])
}

onMounted(async () => {
  temporizador = window.setInterval(() => (ahora.value = new Date()), 60_000)
  try {
    await cargarDia()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    cargando.value = false
  }
})

onUnmounted(() => window.clearInterval(temporizador))

async function ejecutar(accion: () => Promise<unknown>) {
  error.value = ''
  try {
    await accion()
    await cargarDia()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

// ---- Resumen (mitad superior) ----
const resumen = computed(() => resumenDia(tomas.value, suenos.value, panales.value))

const ultimoPeso = computed(() => ultimoValor(medidas.value, (m) => m.fecha, (m) => m.peso_gramos))
const ultimaAltura = computed(() => ultimoValor(medidas.value, (m) => m.fecha, (m) => m.altura_cm))

/** Minutos de sueño de hoy, contando el sueño en curso (solo su parte de hoy) */
const minutosSuenoHoy = computed(() => {
  let minutos = resumen.value.minutosSueno
  if (suenoAbierto.value) {
    const inicioDia = new Date(ahora.value)
    inicioDia.setHours(0, 0, 0, 0)
    const inicio = Math.max(new Date(suenoAbierto.value.inicio).getTime(), inicioDia.getTime())
    minutos += Math.max(0, Math.round((ahora.value.getTime() - inicio) / 60_000))
  }
  return minutos
})

function fechaCorta(fechaIso: string): string {
  return new Date(fechaIso + 'T00:00:00').toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  })
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
  const ahoraIso = new Date().toISOString()
  if (suenoAbierto.value) {
    const id = suenoAbierto.value.id
    ejecutar(() => servicio.finalizarSueno(id, ahoraIso))
  } else {
    ejecutar(() => servicio.iniciarSueno(bebe.id, ahoraIso))
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
  if (formulario.value === 'mas') formulario.value = null
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
      <!-- Mitad superior: resumen con números en grande -->
      <section class="tarjeta">
        <h2>{{ bebeStore.bebe.nombre }}</h2>

        <div class="stats tres">
          <div class="stat">
            <span class="etiqueta">Edad</span>
            <span class="valor">{{ edadCorta(bebeStore.bebe.fecha_nacimiento, ahora) }}</span>
          </div>
          <div class="stat">
            <span class="etiqueta">Peso</span>
            <span class="valor">{{ ultimoPeso ? formatoPeso(ultimoPeso.valor) : '—' }}</span>
            <span class="sub">{{ ultimoPeso ? fechaCorta(ultimoPeso.fecha) : 'sin datos' }}</span>
          </div>
          <div class="stat">
            <span class="etiqueta">Altura</span>
            <span class="valor">{{ ultimaAltura ? `${ultimaAltura.valor} cm` : '—' }}</span>
            <span class="sub">{{ ultimaAltura ? fechaCorta(ultimaAltura.fecha) : 'sin datos' }}</span>
          </div>
        </div>

        <div class="stats dos">
          <div class="stat">
            <span class="etiqueta">😴 Sueño hoy</span>
            <span class="valor">{{ formatoDuracion(minutosSuenoHoy) }}</span>
            <span class="sub">
              {{
                suenoAbierto
                  ? 'durmiendo ahora'
                  : `${suenos.length} ${suenos.length === 1 ? 'sueño' : 'sueños'}`
              }}
            </span>
          </div>
          <div class="stat">
            <span class="etiqueta">🍼 Leche hoy</span>
            <span class="valor">{{ resumen.mlBiberon }} ml</span>
            <span class="sub">
              {{ resumen.numTomas }} {{ resumen.numTomas === 1 ? 'toma' : 'tomas'
              }}{{ resumen.minutosPecho > 0 ? ` · ${formatoDuracion(resumen.minutosPecho)} pecho` : '' }}
            </span>
          </div>
        </div>
      </section>

      <!-- Mitad inferior: registrar -->
      <section class="tarjeta">
        <h3>Registrar</h3>
        <div class="accesos">
          <button class="acceso" :class="{ activo: suenoAbierto }" @click="alternarSueno">
            <span class="icono">😴</span>
            {{ suenoAbierto ? 'Termina sueño' : 'Empieza sueño' }}
          </button>
          <button
            class="acceso"
            :class="{ activo: formulario === 'toma' }"
            @click="abrirFormularioToma"
          >
            <span class="icono">🍼</span>
            Toma
          </button>
          <button class="acceso" @click="registrarPanal('caca')">
            <span class="icono">💩</span>
            Caca
          </button>
          <button
            class="acceso"
            :class="{ activo: formulario === 'mas' }"
            @click="formulario = formulario === 'mas' ? null : 'mas'"
          >
            <span class="icono">➕</span>
            Más
          </button>
        </div>
      </section>

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

      <!-- Panel "Más": pañal pis/mixto + evento -->
      <div v-if="formulario === 'mas'" class="tarjeta">
        <div class="acciones">
          <span class="suave">Pañal:</span>
          <button class="boton secundario" @click="registrarPanal('pis')">💧 Pis</button>
          <button class="boton secundario" @click="registrarPanal('mixto')">💧💩 Mixto</button>
        </div>
        <form @submit.prevent="guardarEvento">
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
      </div>

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
/* Tiles del resumen */
.stats {
  display: grid;
  gap: 0.5rem;
}

.stats.tres {
  grid-template-columns: repeat(3, 1fr);
}

.stats.dos {
  grid-template-columns: repeat(2, 1fr);
  margin-top: 0.5rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  background: var(--color-fondo);
  border: 1px solid var(--color-borde);
  border-radius: 12px;
  padding: 0.6rem 0.4rem;
  text-align: center;
}

.stat .etiqueta {
  font-size: 0.75rem;
  color: var(--color-texto-suave);
}

.stat .valor {
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1.15;
  color: var(--color-primario-oscuro);
}

.stat .sub {
  font-size: 0.72rem;
  color: var(--color-texto-suave);
}

/* Accesos directos de registro */
.accesos {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem;
}

.acceso {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.85rem 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  background: var(--color-fondo);
  color: var(--color-texto);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio);
  transition:
    background 0.15s,
    color 0.15s;
}

.acceso .icono {
  font-size: 1.7rem;
  line-height: 1;
}

.acceso:hover {
  background: var(--color-borde);
}

.acceso.activo {
  background: var(--color-primario);
  border-color: var(--color-primario);
  color: #fff;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 1rem;
}
</style>
