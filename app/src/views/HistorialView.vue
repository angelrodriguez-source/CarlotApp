<script setup lang="ts">
/**
 * HistorialView.vue — Histórico por días: resumen de cada día
 * (tomas, ml, sueño, pañales) y sus registros desplegables, con
 * edición y borrado de cualquier registro (HojaEdicionRegistro).
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useBebeStore } from '../stores/bebeStore'
import * as servicio from '../services/carlotaService'
import {
  agruparPorDia,
  claveDia,
  fechaDiaCorta,
  filasDeDia,
  formatoDuracion,
  horaCorta,
  mensajeError,
  minutosSuenoEnDia,
  rangoDesde,
  resumenDia,
  sinEmojiInicial,
  ultimosDias,
} from '../models/CarlotaModel'
import { ICONOS_REGISTRO, iconoDiaUrl, iconoHistorialUrl } from '../assets/branding'
import GraficaRitmo from '../components/GraficaRitmo.vue'
import HojaEdicionRegistro from '../components/HojaEdicionRegistro.vue'
import { usarAutorrecarga } from '../components/autorrecarga'
import type { RegistroEditable } from '../types'
import type { Evento, Panal, Sueno, Toma } from '../types'

const bebeStore = useBebeStore()

const dias = ref(7)
const cargando = ref(true)
const error = ref('')

const tomas = ref<Toma[]>([])
const suenos = ref<Sueno[]>([])
const panales = ref<Panal[]>([])
const eventos = ref<Evento[]>([])
// Momentos (eventos tipo hito) de todos los tiempos, no solo del rango visible
const momentos = ref<Evento[]>([])

const diaAbierto = ref<string | null>(null)

// Token de carga: al cambiar el selector de días dos veces rápido, la
// respuesta vieja no debe pisar a la nueva
let versionCarga = 0

async function cargar(silenciosa = false) {
  error.value = ''
  // La autorrecarga no enciende los esqueletos: los datos visibles se
  // quedan hasta que llegan los frescos
  if (!silenciosa) cargando.value = true
  const version = ++versionCarga
  try {
    const bebe = await bebeStore.cargar()
    if (!bebe) return
    const { desdeIso, desdeSuenosIso } = rangoDesde(dias.value)
    const datos = await Promise.all([
      servicio.listarTomas(bebe.id, desdeIso),
      servicio.listarSuenos(bebe.id, desdeSuenosIso),
      servicio.listarPanales(bebe.id, desdeIso),
      servicio.listarEventos(bebe.id, desdeIso),
      servicio.listarMomentos(bebe.id),
    ])
    if (version !== versionCarga) return
    hoy.value = claveDia(new Date().toISOString())
    ;[tomas.value, suenos.value, panales.value, eventos.value, momentos.value] = datos
  } catch (e) {
    if (version === versionCarga) error.value = mensajeError(e)
  } finally {
    if (version === versionCarga) cargando.value = false
  }
}

onMounted(() => cargar())
watch(dias, () => cargar())

// Escrituras (propias o de la otra persona) y vuelta a primer plano.
// recargarAhora se usa tras las propias: cancela el debounce del evento
// de esa misma escritura (una sola tanda de consultas)
const { recargarAhora } = usarAutorrecarga(() => cargar(true))

/** Fila del modelo (filasDeDia) ya con su icono resuelto */
interface FilaHistorial {
  id: string
  hora: string
  texto: string
  img?: string
  editable: RegistroEditable
}

/** Con icono propio el texto pierde su emoji inicial; sin él, se queda */
function textoConIcono(texto: string, img: string | undefined): string {
  return img ? sinEmojiInicial(texto) : texto
}

interface DiaHistorial {
  dia: string
  resumen: ReturnType<typeof resumenDia>
  registros: FilaHistorial[]
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

  // Todos los días del rango (recientes primero), aunque estén a cero:
  // así "Hoy" existe desde por la mañana y el tap del ritmo siempre aterriza
  return [...diasRitmo.value].map((dia) => {
    const tomasDia = tomasPorDia.get(dia) ?? []
    const suenosDia = suenosPorDia.get(dia) ?? []
    const panalesDia = panalesPorDia.get(dia) ?? []

    // Las filas las construye el modelo (filasDeDia, misma fuente que la
    // línea de tiempo de Hoy); aquí solo se resuelve el icono
    const registros = filasDeDia(
      { tomas: tomas.value, suenos: suenos.value, panales: panales.value, eventos: eventos.value },
      dia,
    ).map((f): FilaHistorial => {
      const img = ICONOS_REGISTRO[f.icono]
      return {
        id: f.id,
        hora: f.hora,
        texto: textoConIcono(f.texto, img),
        img,
        editable: f.editable,
      }
    })

    // El sueño del resumen se reparte por día real (los nocturnos que
    // cruzan medianoche aportan su parte a cada día), no por día de inicio
    const resumen = {
      ...resumenDia(tomasDia, suenosDia, panalesDia),
      minutosSueno: minutosSuenoEnDia(suenos.value, dia),
    }
    return { dia, resumen, registros }
  })
})

// Se refresca en cada cargar() para no quedarse obsoleto pasada la medianoche
const hoy = ref(claveDia(new Date().toISOString()))

// Días del rango, sin inventar días previos al nacimiento
const diasRitmo = computed(() => {
  const nacimiento = bebeStore.bebe?.fecha_nacimiento ?? ''
  return ultimosDias(dias.value).filter((dia) => dia >= nacimiento)
})

/** ¿Hay algún registro en el rango? (para el estado vacío y la gráfica) */
const hayRegistros = computed(() => historial.value.some((d) => d.registros.length > 0))

/** Resumen del día en una sola línea compacta */
function resumenLinea(resumen: ReturnType<typeof resumenDia>): string {
  const partes = [`🍼 ${resumen.numTomas}`]
  if (resumen.mlBiberon > 0) partes.push(`${resumen.mlBiberon} ml`)
  if (resumen.minutosPecho > 0) partes.push(`${formatoDuracion(resumen.minutosPecho)} pecho`)
  partes.push(`😴 ${formatoDuracion(resumen.minutosSueno)}`)
  partes.push(`🧷 ${resumen.numPanales}${resumen.numCacas > 0 ? ` (${resumen.numCacas} 💩)` : ''}`)
  return partes.join(' · ')
}

/** Tocar una fila del ritmo de 24h abre ese día en la lista */
function abrirDia(dia: string) {
  diaAbierto.value = dia
}

// ---- Edición de registros (formulario en HojaEdicionRegistro) ----

const registroEnEdicion = ref<RegistroEditable | null>(null)

function alGuardar() {
  registroEnEdicion.value = null
  void recargarAhora()
}

async function borrarMomento(momento: Evento) {
  if (!window.confirm(`¿Borrar el momento "${momento.descripcion ?? 'hito'}"?`)) return
  error.value = ''
  try {
    await servicio.eliminarEvento(momento.id)
    await recargarAhora()
  } catch (e) {
    error.value = mensajeError(e)
  }
}
</script>

<template>
  <main class="pantalla">
    <div class="tarjeta cabecera-historial">
      <h2 class="titulo-vista"><img :src="iconoHistorialUrl" alt="" /> Historial</h2>
      <select v-model.number="dias" aria-label="Días a mostrar">
        <option :value="7">Últimos 7 días</option>
        <option :value="14">Últimos 14 días</option>
        <option :value="30">Últimos 30 días</option>
      </select>
    </div>

    <template v-if="cargando">
      <div class="esqueleto" style="height: 180px"></div>
      <div class="esqueleto" style="height: 90px"></div>
      <div class="esqueleto" style="height: 90px"></div>
    </template>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="!cargando && !hayRegistros" class="suave">Sin registros en este periodo.</p>

    <GraficaRitmo
      v-if="!cargando && hayRegistros"
      :dias="diasRitmo"
      :suenos="suenos"
      :tomas="tomas"
      @seleccionar-dia="abrirDia"
    />

    <!-- Momentos: los hitos de todos los tiempos, siempre visibles -->
    <div v-if="!cargando" class="tarjeta">
      <h3 class="titulo-momentos">
        <img :src="ICONOS_REGISTRO.momento" alt="" class="icono-linea" /> Momentos
      </h3>
      <p v-if="momentos.length === 0" class="suave">
        Todavía no hay momentos.
        <RouterLink :to="{ name: 'hoy', query: { registrar: '1' } }">
          Apunta el primero ✨ →
        </RouterLink>
      </p>
      <div v-for="momento in momentos" :key="momento.id" class="fila-registro">
        <span class="hora fecha-momento">{{ fechaDiaCorta(momento.fecha) }}</span>
        <span class="detalle">{{ momento.descripcion ?? 'Hito' }}</span>
        <button
          class="boton peligro"
          :aria-label="`Borrar momento: ${momento.descripcion ?? 'hito'}`"
          @click="borrarMomento(momento)"
        >
          ✕
        </button>
      </div>
    </div>

    <div v-for="diaHistorial in historial" :key="diaHistorial.dia" class="tarjeta">
      <button
        class="dia-boton"
        @click="diaAbierto = diaAbierto === diaHistorial.dia ? null : diaHistorial.dia"
      >
        <strong class="titulo-dia">
          <img :src="iconoDiaUrl" alt="" class="icono-linea" />
          {{ diaHistorial.dia === hoy ? 'Hoy' : fechaLegible(diaHistorial.dia) }}
        </strong>
        <span class="suave">{{ diaAbierto === diaHistorial.dia ? '▲' : '▼' }}</span>
      </button>
      <p class="resumen-linea suave">{{ resumenLinea(diaHistorial.resumen) }}</p>
      <button
        v-if="diaAbierto !== diaHistorial.dia && diaHistorial.registros.length > 0"
        class="ver-mas"
        aria-label="Abrir el día"
        @click="diaAbierto = diaHistorial.dia"
      >
        ⋯
      </button>
      <div v-if="diaAbierto === diaHistorial.dia">
        <template v-for="registro in diaHistorial.registros" :key="registro.id">
          <div class="fila-registro">
            <span class="hora">{{ horaCorta(registro.hora) }}</span>
            <span class="detalle">
              <img v-if="registro.img" :src="registro.img" alt="" class="icono-linea" />
              {{ registro.texto }}
            </span>
            <button
              class="boton peligro editar"
              aria-label="Editar registro"
              @click="registroEnEdicion = registro.editable"
            >
              ✎
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Edición en hoja inferior (componente compartido con Hoy) -->
    <HojaEdicionRegistro
      :registro="registroEnEdicion"
      @cerrar="registroEnEdicion = null"
      @guardado="alGuardar"
    />
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

.fecha-momento {
  min-width: 3.6rem;
}
</style>
