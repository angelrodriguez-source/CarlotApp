<script setup lang="ts">
/**
 * EvolucionView.vue — Medidas (peso/altura/perímetro craneal):
 * alta de una medición, gráficas de evolución y tabla histórica.
 * Además, gráficas del día a día (leche y sueño); los objetivos de
 * Hoy llegan aquí con ?grafica=tomas|sueno y se hace scroll a ellas.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBebeStore } from '../stores/bebeStore'
import * as servicio from '../services/carlotaService'
import {
  bandaOMS,
  edadDias,
  hoyLocal,
  mensajeError,
  minutosSuenoEnDia,
  mlEnDia,
  numeroONull,
  objetivoLecheMl,
  objetivoSuenoMinutos,
  percentilRedondeado,
  rangoDesde,
  recortarSerieAVentana,
  recortarVaciosIniciales,
  serieGrafica,
  ultimosDias,
  valorPercentilOMS,
  type BandaOMS,
  type MedidaOMS,
  type PuntoGrafica,
} from '../models/CarlotaModel'
import { LIMITES_ENTRADA, primerError, validarFechaDia, validarRango } from '../models/validacion'
import {
  ETIQUETAS_ORIGEN_MEDIDA,
  type Medida,
  type OrigenMedida,
  type Sueno,
  type Toma,
} from '../types'
import {
  ICONOS_REGISTRO,
  iconoAlturaUrl,
  iconoEvolucionUrl,
  iconoMedicionesUrl,
  iconoPerimetroUrl,
  iconoPesoUrl,
} from '../assets/branding'
import GraficaLinea from '../components/GraficaLinea.vue'
import GraficaCrecimiento, {
  type CurvaPercentil,
  type PuntoCrecimiento,
} from '../components/GraficaCrecimiento.vue'
import HojaInferior from '../components/HojaInferior.vue'

const bebeStore = useBebeStore()
const route = useRoute()
const router = useRouter()

const cargando = ref(true)
const error = ref('')
const medidas = ref<Medida[]>([])
const mostrarFormulario = ref(false)

// Qué muestran las gráficas: el valor medido o su percentil OMS
const modo = ref<'valor' | 'percentil'>('valor')

const nuevaMedida = ref({
  fecha: hoyLocal(),
  pesoGramos: null as number | null,
  alturaCm: null as number | null,
  perimetroCm: null as number | null,
  origen: 'casa' as OrigenMedida,
  notas: '',
})

async function cargar() {
  const bebe = await bebeStore.cargar()
  if (!bebe) return
  ;[medidas.value] = await Promise.all([servicio.listarMedidas(bebe.id), cargarDiarios()])
}

onMounted(async () => {
  // El enlace "registra el peso" de Hoy llega con ?nueva=1: formulario abierto
  if (route.query.nueva) {
    mostrarFormulario.value = true
    router.replace({ query: {} })
  }
  // Los objetivos de Hoy llegan con ?grafica=tomas|sueno
  const grafica = route.query.grafica
  try {
    await cargar()
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    cargando.value = false
  }
  if (grafica === 'tomas' || grafica === 'sueno') {
    router.replace({ query: {} })
    await nextTick()
    document.getElementById(`grafica-${grafica}`)?.scrollIntoView({ behavior: 'smooth' })
  }
})

/**
 * Rangos aceptables de una medición (models/validacion.ts): fecha dentro
 * de la vida de la bebé y valores plausibles. Devuelve el error o null.
 */
function validarMedida(
  fecha: string,
  peso: number | null,
  altura: number | null,
  perimetro: number | null,
): string | null {
  return primerError(
    validarFechaDia(fecha, bebeStore.bebe?.fecha_nacimiento ?? '', hoyLocal()),
    validarRango(peso, LIMITES_ENTRADA.pesoGramos),
    validarRango(altura, LIMITES_ENTRADA.alturaCm),
    validarRango(perimetro, LIMITES_ENTRADA.perimetroCm),
  )
}

async function guardarMedida() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const peso = numeroONull(nuevaMedida.value.pesoGramos)
  const altura = numeroONull(nuevaMedida.value.alturaCm)
  const perimetro = numeroONull(nuevaMedida.value.perimetroCm)
  if (peso === null && altura === null && perimetro === null) {
    error.value = 'Apunta al menos un valor (peso, altura o perímetro)'
    return
  }
  const problema = validarMedida(nuevaMedida.value.fecha, peso, altura, perimetro)
  if (problema) {
    error.value = problema
    return
  }
  error.value = ''
  try {
    await servicio.registrarMedida({
      bebe_id: bebe.id,
      fecha: nuevaMedida.value.fecha,
      peso_gramos: peso,
      altura_cm: altura,
      perimetro_craneal_cm: perimetro,
      origen: nuevaMedida.value.origen,
      notas: nuevaMedida.value.notas || null,
    })
    mostrarFormulario.value = false
    nuevaMedida.value = {
      fecha: hoyLocal(),
      pesoGramos: null,
      alturaCm: null,
      perimetroCm: null,
      origen: 'casa',
      notas: '',
    }
    await cargar()
  } catch (e) {
    error.value = mensajeError(e)
  }
}

// ---- Edición de una medición existente (hoja inferior) ----

interface EdicionMedida {
  id: string
  fecha: string
  pesoGramos: number | null
  alturaCm: number | null
  perimetroCm: number | null
  origen: OrigenMedida
  notas: string
}

const edicionMedida = ref<EdicionMedida | null>(null)
const errorEdicion = ref('')

function abrirEdicionMedida(medida: Medida) {
  errorEdicion.value = ''
  edicionMedida.value = {
    id: medida.id,
    fecha: medida.fecha,
    pesoGramos: medida.peso_gramos,
    alturaCm: medida.altura_cm,
    perimetroCm: medida.perimetro_craneal_cm,
    origen: medida.origen,
    notas: medida.notas ?? '',
  }
}

async function ejecutarEdicion(accion: () => Promise<unknown>) {
  errorEdicion.value = ''
  try {
    await accion()
    edicionMedida.value = null
    await cargar()
  } catch (e) {
    errorEdicion.value = mensajeError(e)
  }
}

function guardarEdicionMedida() {
  const e = edicionMedida.value
  if (!e) return
  const peso = numeroONull(e.pesoGramos)
  const altura = numeroONull(e.alturaCm)
  const perimetro = numeroONull(e.perimetroCm)
  if (peso === null && altura === null && perimetro === null) {
    errorEdicion.value = 'Apunta al menos un valor (peso, altura o perímetro)'
    return
  }
  const problema = validarMedida(e.fecha, peso, altura, perimetro)
  if (problema) {
    errorEdicion.value = problema
    return
  }
  ejecutarEdicion(() =>
    servicio.actualizarMedida(e.id, {
      fecha: e.fecha,
      peso_gramos: peso,
      altura_cm: altura,
      perimetro_craneal_cm: perimetro,
      origen: e.origen,
      notas: e.notas || null,
    }),
  )
}

function borrarMedidaEnEdicion() {
  const e = edicionMedida.value
  if (!e) return
  if (!window.confirm('¿Borrar esta medición?')) return
  ejecutarEdicion(() => servicio.eliminarMedida(e.id))
}

const seriePerimetro = computed(() =>
  serieGrafica(
    medidas.value,
    (m) => m.fecha,
    (m) => m.perimetro_craneal_cm,
  ),
)

// ---- Percentiles OMS (comparacion con el estandar de ninas) ----

/** Percentil OMS redondeado de un valor medido en cierta fecha, o null */
function percentilDe(tipo: MedidaOMS, valor: number | null, fecha: string): number | null {
  return percentilRedondeado(tipo, valor, bebeStore.bebe?.fecha_nacimiento, fecha)
}

/** " (P52)" para mostrar junto al valor, o cadena vacía */
function etiquetaP(tipo: MedidaOMS, valor: number | null, fecha: string): string {
  const p = percentilDe(tipo, valor, fecha)
  return p === null ? '' : ` (P${p})`
}

/** Franja OMS (P3-P97 y mediana) alineada con una serie de valores */
function bandaDe(tipo: MedidaOMS, serie: PuntoGrafica[]): (BandaOMS | null)[] {
  const nacimiento = bebeStore.bebe?.fecha_nacimiento
  if (!nacimiento) return []
  return serie.map((p) => bandaOMS(tipo, edadDias(nacimiento, p.etiqueta)))
}

const bandaPerimetro = computed(() => bandaDe('pc', seriePerimetro.value))

// ---- Peso y altura con las curvas estándar de fondo (P10-P90) ----

const DECILES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
const VENTANA_DIAS = 60
// Hoy cae en el día 45 de la ventana: quedan 15 días de curvas por
// delante para ver cómo debería progresar
const DIAS_FUTURO = 15

const edadHoy = computed(() => {
  const nacimiento = bebeStore.bebe?.fecha_nacimiento
  return nacimiento ? edadDias(nacimiento, hoyLocal()) : null
})

/** Ventana de edad de 60 días con el día actual en el 45 */
const ventana = computed(() => {
  if (edadHoy.value === null) return null
  const desde = Math.max(0, edadHoy.value - (VENTANA_DIAS - DIAS_FUTURO))
  return { desde, hasta: desde + VENTANA_DIAS }
})

function curvasDe(tipo: MedidaOMS): CurvaPercentil[] {
  const v = ventana.value
  if (!v) return []
  const dias: number[] = []
  for (let d = v.desde; d <= v.hasta; d++) dias.push(d)
  return DECILES.map((p) => ({
    nombre: `P${p}`,
    puntos: dias
      .map((d) => ({ dia: d, valor: valorPercentilOMS(tipo, p, d) }))
      .filter((punto): punto is { dia: number; valor: number } => punto.valor !== null),
  }))
}

const curvasPeso = computed(() => curvasDe('peso'))
const curvasAltura = computed(() => curvasDe('altura'))

function medidosEnVentana(valorDe: (m: Medida) => number | null): PuntoCrecimiento[] {
  const nacimiento = bebeStore.bebe?.fecha_nacimiento
  const v = ventana.value
  if (!nacimiento || !v) return []
  const todos = medidas.value
    .map((m) => ({ dia: edadDias(nacimiento, m.fecha), valor: valorDe(m), etiqueta: m.fecha }))
    .filter((p): p is PuntoCrecimiento => p.valor !== null)
  // El recorte añade puntos virtuales en los bordes: una medida anterior
  // a la ventana hace que la línea "entre" por la izquierda
  return recortarSerieAVentana(todos, v.desde, v.hasta)
}

const medidosPeso = computed(() => medidosEnVentana((m) => m.peso_gramos))
const medidosAltura = computed(() => medidosEnVentana((m) => m.altura_cm))

const seriePercentilPeso = computed(() =>
  serieGrafica(
    medidas.value,
    (m) => m.fecha,
    (m) => percentilDe('peso', m.peso_gramos, m.fecha),
  ),
)
const seriePercentilAltura = computed(() =>
  serieGrafica(
    medidas.value,
    (m) => m.fecha,
    (m) => percentilDe('altura', m.altura_cm, m.fecha),
  ),
)
const seriePercentilPerimetro = computed(() =>
  serieGrafica(
    medidas.value,
    (m) => m.fecha,
    (m) => percentilDe('pc', m.perimetro_craneal_cm, m.fecha),
  ),
)

const medidasRecientes = computed(() => [...medidas.value].reverse())

// ---- Día a día: leche tomada y sueño por día ----

const diasDiarios = ref(14)
const tomas = ref<Toma[]>([])
const suenos = ref<Sueno[]>([])

// Token de carga: dos cambios rápidos del selector no deben dejar
// la respuesta vieja pisando a la nueva
let versionDiarios = 0

async function cargarDiarios() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const version = ++versionDiarios
  const { desdeIso, desdeSuenosIso } = rangoDesde(diasDiarios.value)
  const datos = await Promise.all([
    servicio.listarTomas(bebe.id, desdeIso),
    servicio.listarSuenos(bebe.id, desdeSuenosIso),
  ])
  if (version !== versionDiarios) return
  ;[tomas.value, suenos.value] = datos
}

watch(diasDiarios, async () => {
  error.value = ''
  try {
    await cargarDiarios()
  } catch (e) {
    error.value = mensajeError(e)
  }
})

/** Días del rango en orden cronológico (ultimosDias los da recientes primero) */
const diasSerie = computed(() => [...ultimosDias(diasDiarios.value)].reverse())

const serieLeche = computed<PuntoGrafica[]>(() =>
  recortarVaciosIniciales(
    diasSerie.value.map((d) => ({ etiqueta: d, valor: mlEnDia(tomas.value, d) })),
  ),
)

const serieSueno = computed<PuntoGrafica[]>(() =>
  recortarVaciosIniciales(
    diasSerie.value.map((d) => ({
      etiqueta: d,
      valor: Math.round((minutosSuenoEnDia(suenos.value, d) / 60) * 10) / 10,
    })),
  ),
)

// Franjas de rango recomendado por edad, paralelas a cada serie

/** Último peso conocido en ese día (o el primero que haya, si aún no había medida) */
function pesoEnDia(dia: string): number | null {
  const conPeso = medidas.value.filter((m) => m.peso_gramos)
  if (conPeso.length === 0) return null
  const anteriores = conPeso.filter((m) => m.fecha <= dia)
  const medida = anteriores.length > 0 ? anteriores[anteriores.length - 1]! : conPeso[0]!
  return medida.peso_gramos
}

const franjaSueno = computed(() => {
  const nacimiento = bebeStore.bebe?.fecha_nacimiento
  if (!nacimiento) return []
  return serieSueno.value.map((p) => {
    const objetivo = objetivoSuenoMinutos(edadDias(nacimiento, p.etiqueta))
    return { min: objetivo.min / 60, max: objetivo.max / 60 }
  })
})

const franjaLeche = computed(() => {
  const nacimiento = bebeStore.bebe?.fecha_nacimiento
  if (!nacimiento) return []
  return serieLeche.value.map((p) =>
    objetivoLecheMl(edadDias(nacimiento, p.etiqueta), pesoEnDia(p.etiqueta)),
  )
})
</script>

<template>
  <main class="pantalla">
    <div class="tarjeta cabecera-evolucion">
      <h2 class="titulo-vista"><img :src="iconoEvolucionUrl" alt="" /> Evolución</h2>
      <button class="boton" @click="mostrarFormulario = !mostrarFormulario">+ Medida</button>
    </div>

    <template v-if="cargando">
      <div class="esqueleto" style="height: 200px"></div>
      <div class="esqueleto" style="height: 200px"></div>
    </template>
    <p v-if="error" class="error">{{ error }}</p>

    <form v-if="mostrarFormulario" class="tarjeta" @submit.prevent="guardarMedida">
      <h3>📏 Nueva medida</h3>
      <div class="campo">
        <label for="medida-fecha">Fecha</label>
        <input
          id="medida-fecha"
          v-model="nuevaMedida.fecha"
          type="date"
          :min="bebeStore.bebe?.fecha_nacimiento"
          :max="hoyLocal()"
          required
        />
      </div>
      <div class="campo">
        <label for="medida-peso">Peso (gramos)</label>
        <input
          id="medida-peso"
          v-model.number="nuevaMedida.pesoGramos"
          type="number"
          :min="LIMITES_ENTRADA.pesoGramos.min"
          :max="LIMITES_ENTRADA.pesoGramos.max"
        />
      </div>
      <div class="campo">
        <label for="medida-altura">Altura (cm)</label>
        <input
          id="medida-altura"
          v-model.number="nuevaMedida.alturaCm"
          type="number"
          :min="LIMITES_ENTRADA.alturaCm.min"
          :max="LIMITES_ENTRADA.alturaCm.max"
          step="0.1"
        />
      </div>
      <div class="campo">
        <label for="medida-pc">Perímetro craneal (cm)</label>
        <input
          id="medida-pc"
          v-model.number="nuevaMedida.perimetroCm"
          type="number"
          :min="LIMITES_ENTRADA.perimetroCm.min"
          :max="LIMITES_ENTRADA.perimetroCm.max"
          step="0.1"
        />
      </div>
      <div class="campo">
        <label for="medida-origen">Tipo de medición</label>
        <select id="medida-origen" v-model="nuevaMedida.origen">
          <option v-for="(etiqueta, valor) in ETIQUETAS_ORIGEN_MEDIDA" :key="valor" :value="valor">
            {{ etiqueta }}
          </option>
        </select>
      </div>
      <div class="campo">
        <label for="medida-notas">Notas (ej. "revisión pediatra")</label>
        <input id="medida-notas" v-model="nuevaMedida.notas" type="text" />
      </div>
      <button class="boton" type="submit">Guardar</button>
    </form>

    <!-- Segmento: mismas 3 tarjetas, dos lentes (valor medido / percentil OMS) -->
    <div v-if="!cargando" class="segmento" role="tablist" aria-label="Modo de las gráficas">
      <button
        role="tab"
        :aria-selected="modo === 'valor'"
        :class="{ activo: modo === 'valor' }"
        @click="modo = 'valor'"
      >
        Valor
      </button>
      <button
        role="tab"
        :aria-selected="modo === 'percentil'"
        :class="{ activo: modo === 'percentil' }"
        @click="modo = 'percentil'"
      >
        Percentil OMS
      </button>
    </div>

    <template v-if="modo === 'valor'">
      <GraficaCrecimiento
        titulo="Peso"
        :icono="iconoPesoUrl"
        unidad="g"
        :puntos="medidosPeso"
        :curvas="curvasPeso"
        :dia-hoy="edadHoy ?? undefined"
      />
      <GraficaCrecimiento
        titulo="Altura"
        :icono="iconoAlturaUrl"
        unidad="cm"
        :puntos="medidosAltura"
        :curvas="curvasAltura"
        :dia-hoy="edadHoy ?? undefined"
      />
      <GraficaLinea
        titulo="Perímetro craneal"
        :icono="iconoPerimetroUrl"
        :puntos="seriePerimetro"
        unidad="cm"
        :banda="bandaPerimetro"
      />
    </template>
    <template v-else>
      <GraficaLinea
        titulo="Percentil de peso"
        :icono="iconoPesoUrl"
        :puntos="seriePercentilPeso"
        unidad="P"
      />
      <GraficaLinea
        titulo="Percentil de altura"
        :icono="iconoAlturaUrl"
        :puntos="seriePercentilAltura"
        unidad="P"
      />
      <GraficaLinea
        titulo="Percentil de PC"
        :icono="iconoPerimetroUrl"
        :puntos="seriePercentilPerimetro"
        unidad="P"
      />
    </template>

    <div v-if="!cargando" class="tarjeta">
      <h3 class="titulo-mediciones">
        <img :src="iconoMedicionesUrl" alt="" class="icono-titulo" /> Mediciones
      </h3>
      <p v-if="medidas.length === 0" class="suave">Todavía no hay mediciones.</p>
      <div v-for="medida in medidasRecientes" :key="medida.id" class="fila-registro">
        <span class="hora">{{ medida.fecha }}</span>
        <span class="detalle">
          <template v-if="medida.peso_gramos">
            {{ medida.peso_gramos }} g{{ etiquetaP('peso', medida.peso_gramos, medida.fecha) }}
          </template>
          <template v-if="medida.altura_cm">
            · {{ medida.altura_cm }} cm{{ etiquetaP('altura', medida.altura_cm, medida.fecha) }}
          </template>
          <template v-if="medida.perimetro_craneal_cm">
            · PC {{ medida.perimetro_craneal_cm }} cm{{
              etiquetaP('pc', medida.perimetro_craneal_cm, medida.fecha)
            }}
          </template>
          <template v-if="medida.notas"> · {{ medida.notas }}</template>
          <span class="origen-medida" :title="ETIQUETAS_ORIGEN_MEDIDA[medida.origen]">
            {{ medida.origen === 'oficial' ? '✅' : '🏠' }}
          </span>
        </span>
        <button
          class="boton peligro editar"
          aria-label="Editar medición"
          @click="abrirEdicionMedida(medida)"
        >
          ✎
        </button>
      </div>
    </div>

    <!-- Día a día: leche y sueño (los objetivos de Hoy enlazan aquí) -->
    <div v-if="!cargando" class="cabecera-diarios">
      <span class="etiqueta-seccion">Día a día</span>
      <select v-model.number="diasDiarios" aria-label="Días de las gráficas diarias">
        <option :value="7">Últimos 7 días</option>
        <option :value="14">Últimos 14 días</option>
        <option :value="30">Últimos 30 días</option>
      </select>
    </div>
    <div v-if="!cargando" id="grafica-tomas">
      <GraficaLinea
        titulo="Leche al día"
        :icono="ICONOS_REGISTRO.toma"
        :puntos="serieLeche"
        unidad="ml"
        :recomendado="franjaLeche"
      />
    </div>
    <div v-if="!cargando" id="grafica-sueno">
      <GraficaLinea
        titulo="Sueño al día"
        :icono="ICONOS_REGISTRO.objetivo_sueno"
        :puntos="serieSueno"
        unidad="h"
        :recomendado="franjaSueno"
      />
    </div>

    <!-- Edición de una medición en hoja inferior -->
    <HojaInferior
      :abierta="edicionMedida !== null"
      titulo="📏 Editar medida"
      @cerrar="edicionMedida = null"
    >
      <form v-if="edicionMedida" @submit.prevent="guardarEdicionMedida">
        <div class="campo">
          <label for="ed-medida-fecha">Fecha</label>
          <input
            id="ed-medida-fecha"
            v-model="edicionMedida.fecha"
            type="date"
            :min="bebeStore.bebe?.fecha_nacimiento"
            :max="hoyLocal()"
            required
          />
        </div>
        <div class="campo">
          <label for="ed-medida-peso">Peso (gramos)</label>
          <input
            id="ed-medida-peso"
            v-model.number="edicionMedida.pesoGramos"
            type="number"
            :min="LIMITES_ENTRADA.pesoGramos.min"
            :max="LIMITES_ENTRADA.pesoGramos.max"
          />
        </div>
        <div class="campo">
          <label for="ed-medida-altura">Altura (cm)</label>
          <input
            id="ed-medida-altura"
            v-model.number="edicionMedida.alturaCm"
            type="number"
            :min="LIMITES_ENTRADA.alturaCm.min"
            :max="LIMITES_ENTRADA.alturaCm.max"
            step="0.1"
          />
        </div>
        <div class="campo">
          <label for="ed-medida-pc">Perímetro craneal (cm)</label>
          <input
            id="ed-medida-pc"
            v-model.number="edicionMedida.perimetroCm"
            type="number"
            :min="LIMITES_ENTRADA.perimetroCm.min"
            :max="LIMITES_ENTRADA.perimetroCm.max"
            step="0.1"
          />
        </div>
        <div class="campo">
          <label for="ed-medida-origen">Tipo de medición</label>
          <select id="ed-medida-origen" v-model="edicionMedida.origen">
            <option
              v-for="(etiqueta, valor) in ETIQUETAS_ORIGEN_MEDIDA"
              :key="valor"
              :value="valor"
            >
              {{ etiqueta }}
            </option>
          </select>
        </div>
        <div class="campo">
          <label for="ed-medida-notas">Notas</label>
          <input id="ed-medida-notas" v-model="edicionMedida.notas" type="text" />
        </div>
        <p v-if="errorEdicion" class="error">{{ errorEdicion }}</p>
        <div class="botones-edicion">
          <button class="boton" type="submit">Guardar</button>
          <button class="boton peligro" type="button" @click="borrarMedidaEnEdicion">Borrar</button>
        </div>
      </form>
    </HojaInferior>
  </main>
</template>

<style scoped>
.titulo-mediciones {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.titulo-mediciones .icono-titulo {
  width: 24px;
  height: 24px;
}

.cabecera-evolucion {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Segmento Valor | Percentil */
.segmento {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  background: var(--color-primario-suave);
  border-radius: 999px;
  padding: 4px;
  margin-bottom: 0.75rem;
}

.segmento button {
  border: none;
  border-radius: 999px;
  padding: 0.45rem 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  background: transparent;
  color: var(--color-texto);
  transition: background 0.15s;
}

.segmento button.activo {
  background: var(--color-tarjeta);
  color: var(--color-primario-oscuro);
  box-shadow: var(--sombra);
}

.fila-registro .editar {
  color: var(--color-texto-suave);
}

.cabecera-diarios {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin: 0.5rem 0;
}

.cabecera-diarios .etiqueta-seccion {
  margin-bottom: 0;
}

.cabecera-diarios select {
  width: auto;
}
</style>
