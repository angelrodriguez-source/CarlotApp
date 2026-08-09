<script setup lang="ts">
/**
 * HoyView.vue — Dashboard de inicio.
 *
 * Card 1 "La bebé": carita + nombre + edad/peso/altura (la semana de
 * desarrollo vive en el bocadillo de Ñeñeñi, que es voz de experto).
 * Card 2 "Datos de Hoy": objetivos del día, últimos hitos (configurables
 * por usuario) y registro del día (2 últimos, expandible).
 * Card 3 "Accesos directos": las acciones que configure cada usuario;
 * el ＋ de la nav abre la hoja con TODOS los tipos de registro.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBebeStore } from '../stores/bebeStore'
import { useUserStore } from '../stores/userStore'
import { fotoBebeUrl, ICONOS_REGISTRO, iconoDiaUrl, logoUrl } from '../assets/branding'
import * as servicio from '../services/carlotaService'
import BarraObjetivo from '../components/BarraObjetivo.vue'
import HojaInferior from '../components/HojaInferior.vue'
import HojaEdicionRegistro from '../components/HojaEdicionRegistro.vue'
import type { RegistroEditable } from '../components/registroEditable'
import {
  LIMITES_ENTRADA,
  primerError,
  validarFechaRegistro,
  validarRango,
  validarTramoSueno,
} from '../models/validacion'
import {
  aInputLocal,
  claveDia,
  duracionMinutos,
  edadCorta,
  edadDias,
  formatoDuracion,
  formatoPeso,
  horaCorta,
  hoyLocal,
  mensajeError,
  minutosSuenoEnDia,
  numeroONull,
  objetivoLecheMl,
  objetivoSuenoMinutos,
  percentilRedondeado,
  resumenDia,
  sinEmojiInicial,
  textoEvento,
  textoPanal,
  suenosDeDia,
  textoSuenoEnDia,
  textoToma,
  ultimoValor,
} from '../models/CarlotaModel'
import {
  ETIQUETAS_CANTIDAD_PANAL,
  ETIQUETAS_EVENTO,
  ETIQUETAS_TOMA,
  type CantidadPanal,
  type Cita,
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
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const cargando = ref(true)
const error = ref('')

// Avatar de la card "La bebé": la foto real si existe, la carita si no
const avatarFallo = ref(false)
const avatarUrl = computed(() => (avatarFallo.value ? logoUrl : fotoBebeUrl))

const tomas = ref<Toma[]>([])
// Sueños desde ayer a las 00:00: el nocturno que empezó ayer y terminó hoy
// también aporta minutos al "sueño de hoy" (se recorta con tramoEnDia)
const suenosDesdeAyer = ref<Sueno[]>([])
const panales = ref<Panal[]>([])
const eventos = ref<Evento[]>([])
const medidas = ref<Medida[]>([])
const suenoAbierto = ref<Sueno | null>(null)
const tomaAbierta = ref<Toma | null>(null)
const ultimaToma = ref<Toma | null>(null)
const ultimoPanal = ref<Panal | null>(null)
const ultimoSuenoTerminado = ref<Sueno | null>(null)
const citas = ref<Cita[]>([])
// Último evento de cada tipo (baño, vitamina D, medicación, uñas, momento…)
const ultimosEventos = ref<Partial<Record<TipoEvento, Evento | null>>>({})

// Qué hoja está abierta: 'registro' es la del + (todos los tipos)
const formulario = ref<
  'toma' | 'fin-toma' | 'registro' | 'momento' | 'sueno-post' | 'evento' | null
>(null)

// Reloj para que la edad y el sueño en curso se actualicen solos
const ahora = ref(new Date())
let temporizador: number | undefined

/** ISO del inicio del día local de hace `diasAtras` días (0 = hoy) */
function inicioDiaIso(diasAtras = 0): string {
  const dia = new Date()
  dia.setDate(dia.getDate() - diasAtras)
  dia.setHours(0, 0, 0, 0)
  return dia.toISOString()
}

// Token de carga: si mientras respondia el servidor se lanzo otra carga,
// la respuesta vieja se descarta (evita pisar datos recientes)
let versionCarga = 0

async function cargarDia() {
  const bebe = await bebeStore.cargar()
  if (!bebe) return
  const version = ++versionCarga
  // El día y su inicio se capturan ANTES de las peticiones: si la respuesta
  // llega pasada la medianoche, los datos son del día capturado
  const dia = hoyLocal()
  const desde = inicioDiaIso()
  const datos = await Promise.all([
    servicio.listarTomas(bebe.id, desde),
    servicio.listarSuenos(bebe.id, inicioDiaIso(1)),
    servicio.listarPanales(bebe.id, desde),
    servicio.listarEventos(bebe.id, desde),
    servicio.listarMedidas(bebe.id),
    servicio.getSuenoAbierto(bebe.id),
    servicio.getTomaAbierta(bebe.id),
    servicio.getUltimaToma(bebe.id),
    servicio.getUltimoPanal(bebe.id),
    servicio.getUltimoSuenoTerminado(bebe.id),
    servicio.listarCitas(bebe.id),
    servicio.getUltimosEventosPorTipo(bebe.id),
  ])
  if (version !== versionCarga) return
  diaCargado = dia
  filaDeslizada.value = null
  // Cota superior del día: un registro tecleado con fecha futura por error
  // no debe contar en "hoy" (la cota inferior ya la pone la consulta)
  datos[0] = datos[0].filter((t) => claveDia(t.inicio) === dia)
  datos[2] = datos[2].filter((pa) => claveDia(pa.fecha) === dia)
  datos[3] = datos[3].filter((ev) => claveDia(ev.fecha) === dia)
  ;[
    tomas.value,
    suenosDesdeAyer.value,
    panales.value,
    eventos.value,
    medidas.value,
    suenoAbierto.value,
    tomaAbierta.value,
    ultimaToma.value,
    ultimoPanal.value,
    ultimoSuenoTerminado.value,
    citas.value,
    ultimosEventos.value,
  ] = datos
}

// El FAB "+" de la nav (y el CTA de Momentos del Historial) llegan con
// ?registrar=...: abrimos la hoja de registro y limpiamos la query
function atenderQueries() {
  if (route.query.registrar) {
    formulario.value = 'registro'
    router.replace({ query: {} })
  }
  if (route.query.config) {
    mostrarConfig.value = true
    router.replace({ query: {} })
  }
}

watch(() => [route.query.registrar, route.query.config], atenderQueries)

// Dia con el que se cargaron los datos: si el reloj cruza la medianoche
// (o la app vuelve del segundo plano en otro dia), se recarga todo
let diaCargado = hoyLocal()

function recargarSiCambioElDia() {
  if (hoyLocal() !== diaCargado) cargarDia().catch((e) => (error.value = mensajeError(e)))
}

function alVolverVisible() {
  if (document.visibilityState === 'visible') recargarSiCambioElDia()
}

onMounted(async () => {
  temporizador = window.setInterval(() => {
    ahora.value = new Date()
    recargarSiCambioElDia()
  }, 60_000)
  document.addEventListener('visibilitychange', alVolverVisible)
  atenderQueries()
  cargarConfigHitos()
  cargarConfigAccesos()
  try {
    await cargarDia()
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    cargando.value = false
  }
})

onUnmounted(() => {
  window.clearInterval(temporizador)
  window.clearTimeout(temporizadorDeshacer)
  document.removeEventListener('visibilitychange', alVolverVisible)
})

async function ejecutar(accion: () => Promise<unknown>) {
  error.value = ''
  try {
    await accion()
    await cargarDia()
  } catch (e) {
    error.value = mensajeError(e)
  }
}

// ---- Deshacer rápido ----
const deshacer = ref<{ texto: string; accion: () => Promise<unknown> } | null>(null)
let temporizadorDeshacer: number | undefined

function ofrecerDeshacer(texto: string, accion: () => Promise<unknown>) {
  deshacer.value = { texto, accion }
  window.clearTimeout(temporizadorDeshacer)
  temporizadorDeshacer = window.setTimeout(() => (deshacer.value = null), 6000)
}

async function ejecutarDeshacer() {
  const pendiente = deshacer.value
  if (!pendiente) return
  deshacer.value = null
  await ejecutar(pendiente.accion)
}

// Alta en vuelo: una doble pulsación con red lenta no debe crear el
// registro dos veces (p. ej. dos sueños abiertos que duplican los minutos)
const registrando = ref(false)

/**
 * Ejecuta un alta, recarga el día y ofrece deshacerla unos segundos.
 * Devuelve true solo si el alta fue bien: quien llama decide entonces si
 * limpia su formulario (si falla, lo escrito se conserva).
 */
async function registrarYOfrecer<T>(
  texto: string,
  accion: () => Promise<T>,
  deshacerDe: (resultado: T) => () => Promise<unknown>,
): Promise<boolean> {
  if (registrando.value) return false
  registrando.value = true
  error.value = ''
  try {
    let resultado: T
    try {
      resultado = await accion()
    } catch (e) {
      error.value = mensajeError(e)
      return false
    }
    ofrecerDeshacer(texto, deshacerDe(resultado))
    try {
      await cargarDia()
    } catch (e) {
      error.value = mensajeError(e)
    }
    return true
  } finally {
    registrando.value = false
  }
}

// ---- Resumen (mitad superior) ----

/** Los sueños que empezaron hoy (línea de tiempo, contador de sueños) */
const suenos = computed(() =>
  suenosDesdeAyer.value.filter((s) => claveDia(s.inicio) === hoyLocal(ahora.value)),
)

const resumen = computed(() => resumenDia(tomas.value, suenos.value, panales.value))

const ultimoPeso = computed(() =>
  ultimoValor(
    medidas.value,
    (m) => m.fecha,
    (m) => m.peso_gramos,
  ),
)
const ultimaAltura = computed(() =>
  ultimoValor(
    medidas.value,
    (m) => m.fecha,
    (m) => m.altura_cm,
  ),
)

/**
 * Minutos de sueño de hoy: cada sueño aporta solo su parte de hoy,
 * incluyendo el nocturno que empezó ayer y el que sigue en curso.
 */
const minutosSuenoHoy = computed(() => {
  const candidatos =
    suenoAbierto.value && !suenosDesdeAyer.value.some((s) => s.id === suenoAbierto.value!.id)
      ? [...suenosDesdeAyer.value, suenoAbierto.value]
      : suenosDesdeAyer.value
  return minutosSuenoEnDia(candidatos, hoyLocal(ahora.value), ahora.value)
})

function fechaCorta(fechaIso: string): string {
  return new Date(fechaIso + 'T00:00:00').toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  })
}

// ---- Objetivos del día (orientativos, según edad) ----
const edadDiasHoy = computed(() =>
  bebeStore.bebe ? edadDias(bebeStore.bebe.fecha_nacimiento, hoyLocal(ahora.value)) : 0,
)

const objetivoSueno = computed(() => objetivoSuenoMinutos(edadDiasHoy.value))

const objetivoLeche = computed(() =>
  objetivoLecheMl(edadDiasHoy.value, ultimoPeso.value?.valor ?? null),
)

const valorSuenoTexto = computed(() => formatoDuracion(minutosSuenoHoy.value))

const objetivoSuenoTexto = computed(
  () => `objetivo ${objetivoSueno.value.min / 60}-${objetivoSueno.value.max / 60} h`,
)

const valorLecheTexto = computed(
  () =>
    `${resumen.value.mlBiberon} ml · ${resumen.value.numTomas} ${
      resumen.value.numTomas === 1 ? 'toma' : 'tomas'
    }`,
)

const objetivoLecheTexto = computed(() =>
  objetivoLeche.value ? `objetivo ${objetivoLeche.value.min}-${objetivoLeche.value.max} ml` : '',
)

// ---- Contadores "hace X" ----
function haceTexto(iso: string): string {
  const minutos = duracionMinutos(iso, ahora.value.toISOString()) ?? 0
  return minutos < 1 ? 'ahora mismo' : `hace ${formatoDuracion(minutos)}`
}

const minutosTomaAbierta = computed(() =>
  tomaAbierta.value
    ? (duracionMinutos(tomaAbierta.value.inicio, ahora.value.toISOString()) ?? 0)
    : 0,
)

// ---- "Últimos hitos": el último registro de cada tipo ----
// Los que se ven sin desplegar los configura cada usuario (⚙, se guarda
// por usuario en este dispositivo); al expandir salen todos.

interface FilaHito {
  img?: string
  id: string
  etiqueta: string
  valor: string
  vivo?: boolean // en curso (durmiendo / toma con cronómetro)
}

/** Catálogo completo (define también el orden y la lista del configurador) */
const CATALOGO_HITOS = [
  { id: 'toma', etiqueta: 'Última toma', img: ICONOS_REGISTRO.toma },
  { id: 'sueno', etiqueta: 'Sueño', img: ICONOS_REGISTRO.sueno },
  { id: 'panal', etiqueta: 'Último pañal', img: ICONOS_REGISTRO.panal },
  { id: 'bano', etiqueta: 'Último baño', img: ICONOS_REGISTRO.bano },
  { id: 'vitamina_d', etiqueta: 'Vitamina D', img: ICONOS_REGISTRO.vitamina_d },
  { id: 'medicacion', etiqueta: 'Medicación', img: ICONOS_REGISTRO.medicacion },
  { id: 'unas', etiqueta: 'Uñas cortadas', img: ICONOS_REGISTRO.unas },
  { id: 'hito', etiqueta: 'Último momento', img: ICONOS_REGISTRO.hito },
  { id: 'otro', etiqueta: 'Otro', img: ICONOS_REGISTRO.otro },
] as const

const HITOS_VISIBLES_POR_DEFECTO = ['toma', 'sueno', 'panal']

/**
 * Lista de ids persistida en localStorage por usuario (cada padre la suya
 * en este dispositivo). La lista vacía también se respeta al recargar
 * (deseleccionarlo todo es una elección válida): los valores por defecto
 * solo aplican si nunca se guardó nada o la config está corrupta.
 */
function listaPersistida(prefijo: string, porDefecto: readonly string[]) {
  const clave = computed(() => `${prefijo}-${userStore.user?.id ?? 'anon'}`)
  const valor = ref<string[]>([...porDefecto])
  function cargar() {
    try {
      const guardado = JSON.parse(localStorage.getItem(clave.value) ?? 'null')
      if (Array.isArray(guardado)) valor.value = guardado
    } catch {
      // config corrupta: se queda la de por defecto
    }
  }
  watch(valor, (v) => localStorage.setItem(clave.value, JSON.stringify(v)), { deep: true })
  return { valor, cargar }
}

// Config por usuario (guardada en el dispositivo, cada padre la suya)
const { valor: hitosVisiblesConfig, cargar: cargarConfigHitos } = listaPersistida(
  'carlotapp-hitos',
  HITOS_VISIBLES_POR_DEFECTO,
)
const hitosExpandidos = ref(false)

const todasLasFilasHitos = computed<FilaHito[]>(() => {
  const filas: FilaHito[] = []
  // Toma
  if (tomaAbierta.value) {
    filas.push({
      id: 'toma',
      etiqueta: 'Toma en curso',
      img: ICONOS_REGISTRO.toma,
      valor: formatoDuracion(minutosTomaAbierta.value),
      vivo: true,
    })
  } else {
    filas.push({
      id: 'toma',
      etiqueta: 'Última toma',
      img: ICONOS_REGISTRO.toma,
      valor: ultimaToma.value ? haceTexto(ultimaToma.value.inicio) : 'sin registros aún',
    })
  }
  // Sueño
  if (suenoAbierto.value) {
    filas.push({
      id: 'sueno',
      etiqueta: 'Durmiendo',
      img: ICONOS_REGISTRO.sueno,
      valor: `desde ${haceTexto(suenoAbierto.value.inicio)}`,
      vivo: true,
    })
  } else {
    filas.push({
      id: 'sueno',
      etiqueta: 'Despierta',
      img: ICONOS_REGISTRO.sueno,
      valor: ultimoSuenoTerminado.value?.fin
        ? `desde ${haceTexto(ultimoSuenoTerminado.value.fin)}`
        : 'sin registros aún',
    })
  }
  // Pañal
  filas.push({
    id: 'panal',
    etiqueta: 'Último pañal',
    img: ICONOS_REGISTRO.panal,
    valor: ultimoPanal.value ? haceTexto(ultimoPanal.value.fecha) : 'sin registros aún',
  })
  // Eventos por tipo (baño, vitamina D, medicación, uñas, momento, otro)
  for (const entrada of CATALOGO_HITOS) {
    if (entrada.id === 'toma' || entrada.id === 'sueno' || entrada.id === 'panal') continue
    const evento = ultimosEventos.value[entrada.id as TipoEvento]
    filas.push({
      id: entrada.id,
      etiqueta: entrada.etiqueta,
      img: entrada.img,
      valor: evento ? haceDiasTexto(evento.fecha) : 'sin registros aún',
    })
  }
  return filas
})

const filasHitosVisibles = computed(() =>
  hitosExpandidos.value
    ? todasLasFilasHitos.value
    : todasLasFilasHitos.value.filter((f) => hitosVisiblesConfig.value.includes(f.id)),
)

// ---- Registro del día (sección 3 de "Datos de Hoy") ----
// Plegado muestra los 2 últimos; expandido, todo el día
const registroExpandido = ref(false)

// ---- Fecha y hora actuales (cabecera de "Cómo va el día") ----
const fechaHoyCorta = computed(() =>
  ahora.value.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
)

const horaActual = computed(() =>
  ahora.value.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
)

// ---- Percentiles OMS para los tiles de peso/altura ----
function percentilTile(tipo: 'peso' | 'altura', dato: { valor: number; fecha: string } | null) {
  if (!dato) return null
  return percentilRedondeado(tipo, dato.valor, bebeStore.bebe?.fecha_nacimiento, dato.fecha)
}

const percentilPeso = computed(() => percentilTile('peso', ultimoPeso.value))
const percentilAltura = computed(() => percentilTile('altura', ultimaAltura.value))

// ---- Próxima cita del calendario (la más cercana, sin límite de días) ----
const proximaCita = computed(() => {
  const ahoraMs = ahora.value.getTime()
  return (
    citas.value
      .filter((c) => !c.completada)
      // margen de 6 h: una cita de esta mañana sigue siendo "la próxima"
      .filter((c) => new Date(c.fecha).getTime() >= ahoraMs - 6 * 3600_000)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))[0] ?? null
  )
})

function fechaCita(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---- Toma ----
const nuevaToma = ref({
  tipo: 'biberon_formula' as TipoToma,
  inicio: aInputLocal(new Date()),
  duracionMin: null as number | null,
  cantidadMl: null as number | null,
  notas: '',
})

const esBiberon = computed(() => nuevaToma.value.tipo.startsWith('biberon'))

function abrirFormularioToma() {
  nuevaToma.value.inicio = aInputLocal(new Date())
  // Cantidad y duración empiezan vacías: los ml de la toma anterior no
  // deben colarse precargados en la siguiente
  nuevaToma.value.cantidadMl = null
  nuevaToma.value.duracionMin = null
  formulario.value = formulario.value === 'toma' ? null : 'toma'
}

async function guardarToma() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const inicio = new Date(nuevaToma.value.inicio)
  const minutos = nuevaToma.value.duracionMin
  const problema = primerError(
    validarFechaRegistro(inicio, bebe.fecha_nacimiento),
    esBiberon.value
      ? validarRango(numeroONull(nuevaToma.value.cantidadMl), LIMITES_ENTRADA.tomaMl)
      : validarRango(numeroONull(minutos), LIMITES_ENTRADA.tomaPechoMin),
  )
  if (problema) {
    error.value = problema
    return
  }
  // Pecho sin duración: se cierra con fin = inicio para que no quede como
  // "toma en curso" fantasma (solo el cronómetro crea tomas abiertas)
  const fin = esBiberon.value ? null : new Date(inicio.getTime() + (minutos ?? 0) * 60_000)
  const guardada = await registrarYOfrecer(
    'Toma registrada',
    () =>
      servicio.registrarToma({
        bebe_id: bebe.id,
        inicio: inicio.toISOString(),
        fin: fin ? fin.toISOString() : null,
        tipo: nuevaToma.value.tipo,
        cantidad_ml: esBiberon.value ? numeroONull(nuevaToma.value.cantidadMl) : null,
        notas: nuevaToma.value.notas || null,
      }),
    (toma) => () => servicio.eliminarToma(toma.id),
  )
  if (!guardada) return
  formulario.value = null
  nuevaToma.value.notas = ''
}

// ---- Cronómetro de toma en vivo ----
const tomaAbiertaEsBiberon = computed(() => tomaAbierta.value?.tipo.startsWith('biberon') ?? false)
const mlFinToma = ref<number | null>(null)

async function empezarCronometroToma() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const tipo = nuevaToma.value.tipo
  const guardado = await registrarYOfrecer(
    'Cronómetro de toma iniciado',
    () =>
      servicio.registrarToma({
        bebe_id: bebe.id,
        inicio: new Date().toISOString(),
        fin: null,
        tipo,
        cantidad_ml: null,
        notas: null,
      }),
    (toma) => () => servicio.eliminarToma(toma.id),
  )
  if (guardado) formulario.value = null
}

/** El acceso 🍼: abre el formulario, o termina la toma en curso si la hay */
function pulsarAccesoToma() {
  if (!tomaAbierta.value) {
    abrirFormularioToma()
    return
  }
  if (tomaAbiertaEsBiberon.value) {
    // Biberón: preguntar los ml antes de cerrar
    mlFinToma.value = null
    formulario.value = formulario.value === 'fin-toma' ? null : 'fin-toma'
  } else {
    terminarToma(null)
  }
}

async function terminarToma(ml: number | null) {
  const toma = tomaAbierta.value
  if (!toma) return
  const problema = validarRango(ml, LIMITES_ENTRADA.tomaMl)
  if (problema) {
    error.value = problema
    return
  }
  const guardado = await registrarYOfrecer(
    'Toma terminada',
    () => servicio.actualizarToma(toma.id, { fin: new Date().toISOString(), cantidad_ml: ml }),
    () => () => servicio.actualizarToma(toma.id, { fin: null, cantidad_ml: null }),
  )
  if (guardado) formulario.value = null
}

// ---- Sueño ----
function alternarSueno() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const ahoraIso = new Date().toISOString()
  if (suenoAbierto.value) {
    const id = suenoAbierto.value.id
    registrarYOfrecer(
      'Sueño terminado',
      () => servicio.finalizarSueno(id, ahoraIso),
      () => () => servicio.actualizarSueno(id, { fin: null }),
    )
  } else {
    registrarYOfrecer(
      'Sueño iniciado',
      () => servicio.iniciarSueno(bebe.id, ahoraIso),
      (sueno) => () => servicio.eliminarSueno(sueno.id),
    )
  }
}

// ---- Pañal ----
// Hoja única para pis/caca/mixto: hora editable (precargada con "ahora")
// y, en caca/mixto, la cantidad como botones que guardan directamente
const nuevoPanal = ref<{ tipo: TipoPanal; hora: string } | null>(null)

const TITULOS_PANAL: Record<TipoPanal, { texto: string; icono?: string }> = {
  pis: { texto: 'Pis', icono: ICONOS_REGISTRO.pis },
  caca: { texto: 'Caca', icono: ICONOS_REGISTRO.caca },
  mixto: { texto: 'Pis + caca', icono: ICONOS_REGISTRO.caca },
}

function abrirPanal(tipo: TipoPanal) {
  nuevoPanal.value = { tipo, hora: aInputLocal(new Date()) }
}

async function registrarPanal(cantidad: CantidadPanal | null = null) {
  const bebe = bebeStore.bebe
  const panal = nuevoPanal.value
  if (!bebe || !panal) return
  const problema = validarFechaRegistro(new Date(panal.hora), bebe.fecha_nacimiento)
  if (problema) {
    error.value = problema
    return
  }
  const guardado = await registrarYOfrecer(
    'Pañal registrado',
    () =>
      servicio.registrarPanal({
        bebe_id: bebe.id,
        fecha: new Date(panal.hora).toISOString(),
        tipo: panal.tipo,
        cantidad,
        notas: null,
      }),
    (registro) => () => servicio.eliminarPanal(registro.id),
  )
  if (guardado) nuevoPanal.value = null
}

// ---- Sueño a posteriori ----
const nuevoSueno = ref({ inicio: aInputLocal(new Date()), fin: aInputLocal(new Date()) })

async function guardarSueno() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const inicio = new Date(nuevoSueno.value.inicio)
  const fin = new Date(nuevoSueno.value.fin)
  const problema = primerError(
    validarFechaRegistro(inicio, bebe.fecha_nacimiento),
    validarTramoSueno(inicio, fin),
  )
  if (problema) {
    error.value = problema
    return
  }
  error.value = ''
  const guardado = await registrarYOfrecer(
    'Sueño registrado',
    () =>
      servicio.registrarSueno({
        bebe_id: bebe.id,
        inicio: new Date(nuevoSueno.value.inicio).toISOString(),
        fin: new Date(nuevoSueno.value.fin).toISOString(),
        notas: null,
      }),
    (sueno) => () => servicio.eliminarSueno(sueno.id),
  )
  if (guardado) formulario.value = null
}

function prepararSuenoPosteriori() {
  const ahoraInput = aInputLocal(new Date())
  nuevoSueno.value = { inicio: ahoraInput, fin: ahoraInput }
  formulario.value = 'sueno-post'
}

/**
 * Tope de los selectores de hora: ahora mismo. Registrar el pasado es lo
 * normal; el futuro solo puede ser un error de tecleo (y una toma futura
 * despistaría al Mime Predictor, aunque el modelo también la filtra).
 * Es función (no computed) para que se reevalúe en cada render.
 */
function topeHora(): string {
  return aInputLocal(new Date())
}

/** Suelo de los selectores de hora: el día del nacimiento */
function sueloHora(): string {
  const nacimiento = bebeStore.bebe?.fecha_nacimiento
  return nacimiento ? nacimiento + 'T00:00' : ''
}

// ---- Evento ----
const nuevoEvento = ref({ tipo: 'bano' as TipoEvento, descripcion: '', hora: '' })

// ---- Momento (evento tipo hito con nombre propio) ----
const nuevoMomento = ref('')
const horaMomento = ref('')

function abrirMomento() {
  horaMomento.value = aInputLocal(new Date())
  formulario.value = 'momento'
}

async function guardarMomento() {
  const bebe = bebeStore.bebe
  if (!bebe || !nuevoMomento.value.trim()) return
  const problema = validarFechaRegistro(new Date(horaMomento.value), bebe.fecha_nacimiento)
  if (problema) {
    error.value = problema
    return
  }
  const guardado = await registrarYOfrecer(
    'Momento guardado ✨',
    () =>
      servicio.registrarEvento({
        bebe_id: bebe.id,
        fecha: new Date(horaMomento.value).toISOString(),
        tipo: 'hito',
        descripcion: nuevoMomento.value.trim(),
      }),
    (evento) => () => servicio.eliminarEvento(evento.id),
  )
  if (!guardado) return
  formulario.value = null
  nuevoMomento.value = ''
}

/**
 * 'hace N días' legible para cosas que se miden en días, no en horas.
 * Cuenta días naturales locales (no bloques de 24 h): la vitamina D de
 * ayer a las 22:00 debe salir como 'ayer' a la mañana siguiente, no 'hoy'.
 */
function haceDiasTexto(iso: string): string {
  const dias = edadDias(claveDia(iso), hoyLocal(ahora.value))
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  return `hace ${dias} días`
}

// ---- Eventos de un toque (baño, vitamina D, medicación, uñas) ----
const TEXTOS_EVENTO_RAPIDO: Partial<Record<TipoEvento, string>> = {
  bano: 'Baño registrado 🛁',
  vitamina_d: 'Vitamina D registrada ☀️',
  medicacion: 'Medicación registrada 💊',
  unas: 'Uñas cortadas ✂️',
}

/** Abre la hoja de evento con el tipo ya elegido y la hora en "ahora" */
function abrirEvento(tipo: TipoEvento) {
  nuevoEvento.value = { tipo, descripcion: '', hora: aInputLocal(new Date()) }
  formulario.value = 'evento'
}

// ---- Catálogo de acciones de registro ----
// El + de la nav las despliega todas; la card "Accesos directos" muestra
// solo las que configure cada usuario (⚙, guardada por usuario).

interface AccionRegistro {
  id: string
  icono: string // emoji de reserva (se usa si no hay imagen)
  img?: string // icono propio (public/icono-*.png)
  etiqueta: string
  vivo?: boolean
}

const accionesRegistro = computed<AccionRegistro[]>(() => [
  {
    id: 'sueno',
    icono: '😴',
    img: ICONOS_REGISTRO.sueno,
    etiqueta: suenoAbierto.value ? 'Termina sueño' : 'Empieza sueño',
    vivo: !!suenoAbierto.value,
  },
  {
    id: 'toma',
    icono: '🍼',
    img: ICONOS_REGISTRO.toma,
    etiqueta: tomaAbierta.value ? `Termina toma (${minutosTomaAbierta.value} min)` : 'Toma',
    vivo: !!tomaAbierta.value,
  },
  { id: 'pis', icono: '💧', img: ICONOS_REGISTRO.pis, etiqueta: 'Pis' },
  { id: 'caca', icono: '💩', img: ICONOS_REGISTRO.caca, etiqueta: 'Caca' },
  {
    id: 'sueno_post',
    icono: '🛌',
    img: ICONOS_REGISTRO.sueno_post,
    etiqueta: 'Sueño a posteriori',
  },
  { id: 'momento', icono: '✨', img: ICONOS_REGISTRO.momento, etiqueta: 'Momento' },
  { id: 'bano', icono: '🛁', img: ICONOS_REGISTRO.bano, etiqueta: 'Baño' },
  {
    id: 'vitamina_d',
    icono: '☀️',
    img: ICONOS_REGISTRO.vitamina_d,
    etiqueta: 'Vitamina D',
  },
  {
    id: 'medicacion',
    icono: '💊',
    img: ICONOS_REGISTRO.medicacion,
    etiqueta: 'Medicación',
  },
  { id: 'unas', icono: '✂️', img: ICONOS_REGISTRO.unas, etiqueta: 'Uñas' },
  { id: 'otro', icono: '⭐', img: ICONOS_REGISTRO.otro, etiqueta: 'Otro' },
])

function ejecutarAccion(id: string) {
  formulario.value = null
  switch (id) {
    case 'sueno':
      alternarSueno()
      break
    case 'toma':
      pulsarAccesoToma()
      break
    case 'pis':
    case 'caca':
      abrirPanal(id)
      break
    case 'sueno_post':
      prepararSuenoPosteriori()
      break
    case 'momento':
      abrirMomento()
      break
    case 'bano':
    case 'vitamina_d':
    case 'medicacion':
    case 'unas':
    case 'otro':
      abrirEvento(id)
      break
  }
}

// Accesos directos configurados (por usuario, en este dispositivo)
const ACCESOS_POR_DEFECTO = ['sueno', 'toma', 'caca', 'pis']
const { valor: accesosConfig, cargar: cargarConfigAccesos } = listaPersistida(
  'carlotapp-accesos',
  ACCESOS_POR_DEFECTO,
)
const mostrarConfig = ref(false)

const accesosVisibles = computed(() =>
  accionesRegistro.value.filter((a) => accesosConfig.value.includes(a.id)),
)

async function guardarEvento() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const problema = validarFechaRegistro(new Date(nuevoEvento.value.hora), bebe.fecha_nacimiento)
  if (problema) {
    error.value = problema
    return
  }
  const guardado = await registrarYOfrecer(
    TEXTOS_EVENTO_RAPIDO[nuevoEvento.value.tipo] ?? 'Evento registrado',
    () =>
      servicio.registrarEvento({
        bebe_id: bebe.id,
        fecha: new Date(nuevoEvento.value.hora).toISOString(),
        tipo: nuevoEvento.value.tipo,
        descripcion: nuevoEvento.value.descripcion || null,
      }),
    (evento) => () => servicio.eliminarEvento(evento.id),
  )
  if (!guardado) return
  formulario.value = null
  nuevoEvento.value.descripcion = ''
}

/** Recrea un registro borrado (deshacer): mismos campos, id nuevo */
function recrear(registro: RegistroEditable): Promise<unknown> {
  const bebe = bebeStore.bebe
  if (!bebe) return Promise.resolve()
  if (registro.kind === 'toma') {
    const t = registro.toma
    return servicio.registrarToma({
      bebe_id: bebe.id,
      inicio: t.inicio,
      fin: t.fin,
      tipo: t.tipo,
      cantidad_ml: t.cantidad_ml,
      notas: t.notas,
    })
  }
  if (registro.kind === 'sueno') {
    const su = registro.sueno
    return servicio.registrarSueno({
      bebe_id: bebe.id,
      inicio: su.inicio,
      fin: su.fin,
      notas: su.notas,
    })
  }
  if (registro.kind === 'panal') {
    const pa = registro.panal
    return servicio.registrarPanal({
      bebe_id: bebe.id,
      fecha: pa.fecha,
      tipo: pa.tipo,
      cantidad: pa.cantidad,
      notas: pa.notas,
    })
  }
  const ev = registro.evento
  return servicio.registrarEvento({
    bebe_id: bebe.id,
    fecha: ev.fecha,
    tipo: ev.tipo,
    descripcion: ev.descripcion,
  })
}

/** Borra una fila del día y ofrece deshacerlo (recreándola) unos segundos */
async function borrarFila(registro: Registro) {
  error.value = ''
  try {
    await registro.borrar()
    await cargarDia()
    ofrecerDeshacer('Registro borrado', () => recrear(registro.editable))
  } catch (e) {
    error.value = mensajeError(e)
  }
}

// ---- Línea de tiempo del día ----
interface Registro {
  id: string
  hora: string // ISO
  texto: string
  img?: string
  borrar: () => Promise<void>
  editable: RegistroEditable
}

/** Con icono propio el texto pierde su emoji inicial; sin él, se queda */
function textoConIcono(texto: string, img: string | undefined): string {
  return img ? sinEmojiInicial(texto) : texto
}

// El lápiz ✎ de una fila abre su edición (misma hoja que en el Historial)
const registroEnEdicion = ref<RegistroEditable | null>(null)

function alGuardarEdicion() {
  registroEnEdicion.value = null
  cargarDia().catch((e) => (error.value = mensajeError(e)))
}

// Swipe hacia la izquierda para revelar el borrar (en escritorio, con hover)
const filaDeslizada = ref<string | null>(null)
let toqueInicioX = 0

function inicioToqueFila(evento: TouchEvent) {
  toqueInicioX = evento.touches[0]?.clientX ?? 0
}

function finToqueFila(evento: TouchEvent, id: string) {
  const dx = (evento.changedTouches[0]?.clientX ?? 0) - toqueInicioX
  if (dx < -40) filaDeslizada.value = id
  else if (dx > 40 && filaDeslizada.value === id) filaDeslizada.value = null
}

const lineaDeTiempo = computed<Registro[]>(() => {
  const registros: Registro[] = [
    ...tomas.value.map((t): Registro => ({
      id: t.id,
      hora: t.inicio,
      texto: textoConIcono(textoToma(t), ICONOS_REGISTRO.toma),
      img: ICONOS_REGISTRO.toma,
      borrar: () => servicio.eliminarToma(t.id),
      editable: { kind: 'toma', toma: t },
    })),
    // Sueños VISIBLES hoy: también el nocturno que empezó ayer (fila
    // "prestada" con aviso y su parte de hoy — el registro no se mueve)
    ...suenosDeDia(
      suenoAbierto.value && !suenosDesdeAyer.value.some((s) => s.id === suenoAbierto.value!.id)
        ? [...suenosDesdeAyer.value, suenoAbierto.value]
        : suenosDesdeAyer.value,
      hoyLocal(ahora.value),
      ahora.value,
    ).map((v): Registro => ({
      id: v.sueno.id,
      hora: v.horaOrden,
      texto: textoConIcono(textoSuenoEnDia(v), ICONOS_REGISTRO.sueno),
      img: ICONOS_REGISTRO.sueno,
      borrar: () => servicio.eliminarSueno(v.sueno.id),
      editable: { kind: 'sueno', sueno: v.sueno },
    })),
    ...panales.value.map((p): Registro => ({
      id: p.id,
      hora: p.fecha,
      texto: textoConIcono(textoPanal(p), ICONOS_REGISTRO[p.tipo === 'pis' ? 'pis' : 'caca']),
      img: ICONOS_REGISTRO[p.tipo === 'pis' ? 'pis' : 'caca'],
      borrar: () => servicio.eliminarPanal(p.id),
      editable: { kind: 'panal', panal: p },
    })),
    ...eventos.value.map((e): Registro => ({
      id: e.id,
      hora: e.fecha,
      texto: textoConIcono(textoEvento(e), ICONOS_REGISTRO[e.tipo]),
      img: ICONOS_REGISTRO[e.tipo],
      borrar: () => servicio.eliminarEvento(e.id),
      editable: { kind: 'evento', evento: e },
    })),
  ]
  return registros.sort((a, b) => b.hora.localeCompare(a.hora))
})
</script>

<template>
  <main class="pantalla">
    <template v-if="cargando">
      <div class="esqueleto" style="height: 170px"></div>
      <div class="esqueleto" style="height: 110px"></div>
      <div class="esqueleto" style="height: 160px"></div>
    </template>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="!cargando && bebeStore.cargado && !bebeStore.bebe">
      <div class="tarjeta">
        <h2>🔒 Cuenta sin acceso</h2>
        <p>
          Este usuario no está en la lista blanca (<code>usuarios_autorizados</code>). Comprueba que
          has entrado con el Google correcto, o añade el email con una migración nueva.
        </p>
      </div>
    </template>

    <template v-if="bebeStore.bebe">
      <!-- Card 1 · La bebé: carita + nombre completo + edad/peso/altura -->
      <section class="tarjeta tarjeta-hero">
        <div class="cabecera-bebe">
          <img :src="avatarUrl" alt="" class="avatar-bebe" @error="avatarFallo = true" />
          <h2>{{ bebeStore.bebe.nombre }}</h2>
        </div>
        <div class="stats tres">
          <div class="stat">
            <span class="etiqueta">Edad</span>
            <span class="valor">{{ edadCorta(bebeStore.bebe.fecha_nacimiento, ahora) }}</span>
          </div>
          <RouterLink :to="{ name: 'evolucion' }" class="stat enlazado">
            <span class="chev">›</span>
            <span class="etiqueta">Peso</span>
            <span class="valor">{{ ultimoPeso ? formatoPeso(ultimoPeso.valor) : '—' }}</span>
            <span class="sub">
              {{
                ultimoPeso
                  ? `${percentilPeso !== null ? `P${percentilPeso} · ` : ''}${fechaCorta(ultimoPeso.fecha)}`
                  : 'sin datos'
              }}
            </span>
          </RouterLink>
          <RouterLink :to="{ name: 'evolucion' }" class="stat enlazado">
            <span class="chev">›</span>
            <span class="etiqueta">Altura</span>
            <span class="valor">{{ ultimaAltura ? `${ultimaAltura.valor} cm` : '—' }}</span>
            <span class="sub">
              {{
                ultimaAltura
                  ? `${percentilAltura !== null ? `P${percentilAltura} · ` : ''}${fechaCorta(ultimaAltura.fecha)}`
                  : 'sin datos'
              }}
            </span>
          </RouterLink>
        </div>

        <!-- Próxima cita del calendario → Citas -->
        <RouterLink v-if="proximaCita" :to="{ name: 'citas' }" class="cita-bebe">
          <span>🗓️ {{ proximaCita.titulo }} · {{ fechaCita(proximaCita.fecha) }}</span>
          <span class="suave">→</span>
        </RouterLink>

        <!-- "Qué esperar esta semana" vive ahora en el bocadillo de Ñeñeñi
             (voz de experto, no dato registrado) -->
      </section>

      <!-- Card 2 · Datos de Hoy: objetivos del día + últimos hitos -->
      <section class="tarjeta">
        <div class="cabecera-datos-hoy">
          <span class="fecha-hoy suave">{{ fechaHoyCorta }}</span>
          <h3><img :src="iconoDiaUrl" alt="" class="icono-titulo" /> Cómo va el día</h3>
          <span class="hora-actual suave">{{ horaActual }}</span>
        </div>

        <div class="seccion-hoy">
          <button
            class="cabecera-toggle"
            :aria-expanded="hitosExpandidos"
            @click="hitosExpandidos = !hitosExpandidos"
          >
            <span class="etiqueta-seccion">Últimos hitos</span>
            <span class="suave">{{ hitosExpandidos ? '▲' : '▼' }}</span>
          </button>
          <div class="ahora">
            <div v-for="fila in filasHitosVisibles" :key="fila.id" class="fila-ahora">
              <span class="que">
                <img v-if="fila.img" :src="fila.img" alt="" class="icono-linea" />
                {{ fila.etiqueta }}
              </span>
              <strong class="cuanto" :class="{ vivo: fila.vivo }">{{ fila.valor }}</strong>
            </div>
          </div>
          <button
            v-if="!hitosExpandidos && filasHitosVisibles.length < todasLasFilasHitos.length"
            class="ver-mas"
            aria-label="Ver todos los hitos"
            @click="hitosExpandidos = true"
          >
            ⋯
          </button>
        </div>

        <div class="seccion-hoy">
          <span class="etiqueta-seccion">Objetivos del día</span>
          <RouterLink
            class="enlace-objetivo"
            :to="{ name: 'evolucion', query: { grafica: 'sueno' } }"
            aria-label="Ver la evolución del sueño por día"
          >
            <BarraObjetivo
              :valor-texto="valorSuenoTexto"
              :objetivo-texto="objetivoSuenoTexto"
              :icono="ICONOS_REGISTRO.objetivo_sueno"
              :valor="minutosSuenoHoy"
              :min="objetivoSueno.min"
              :max="objetivoSueno.max"
            />
          </RouterLink>
          <RouterLink
            v-if="objetivoLeche"
            class="enlace-objetivo"
            :to="{ name: 'evolucion', query: { grafica: 'tomas' } }"
            aria-label="Ver la evolución de las tomas por día"
          >
            <BarraObjetivo
              :valor-texto="valorLecheTexto"
              :objetivo-texto="objetivoLecheTexto"
              :icono="ICONOS_REGISTRO.toma"
              :valor="resumen.mlBiberon"
              :min="objetivoLeche.min"
              :max="objetivoLeche.max"
            />
          </RouterLink>
          <RouterLink
            v-else
            :to="{ name: 'evolucion', query: { nueva: '1' } }"
            class="suave sin-peso"
          >
            Registra el peso para calcular el objetivo de leche →
          </RouterLink>
          <RouterLink :to="{ name: 'historial' }" class="ver-patron suave">
            ver el patrón de 24 h →
          </RouterLink>
        </div>

        <div class="seccion-hoy">
          <button
            class="cabecera-toggle"
            :aria-expanded="registroExpandido"
            :disabled="lineaDeTiempo.length <= 2"
            @click="registroExpandido = !registroExpandido"
          >
            <span class="etiqueta-seccion">📋 Registro del día</span>
            <span v-if="lineaDeTiempo.length > 2" class="suave">
              {{ registroExpandido ? '▲' : `▼ (${lineaDeTiempo.length})` }}
            </span>
          </button>
          <p v-if="lineaDeTiempo.length === 0" class="suave">Todavía no hay registros hoy.</p>
          <div
            v-for="registro in registroExpandido ? lineaDeTiempo : lineaDeTiempo.slice(0, 2)"
            :key="registro.id"
            class="fila-registro deslizable"
            :class="{ deslizada: filaDeslizada === registro.id }"
            @touchstart.passive="inicioToqueFila"
            @touchend.passive="finToqueFila($event, registro.id)"
          >
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
            <button
              class="boton peligro borrar-fila"
              aria-label="Borrar registro"
              @click="borrarFila(registro)"
            >
              ✕
            </button>
          </div>
          <button
            v-if="!registroExpandido && lineaDeTiempo.length > 2"
            class="ver-mas"
            aria-label="Ver todo el día"
            @click="registroExpandido = true"
          >
            ⋯
          </button>
        </div>
      </section>

      <!-- Accesos directos (configurables desde el menú de usuario; el + de la nav lo tiene todo) -->
      <section class="tarjeta">
        <h3 class="titulo-accesos">⚡ Accesos directos</h3>
        <p v-if="accesosVisibles.length === 0" class="suave">
          Elige tus accesos con ⚙ — y recuerda que el ＋ de abajo lo tiene todo.
        </p>
        <div class="accesos">
          <button
            v-for="accion in accesosVisibles"
            :key="accion.id"
            class="acceso"
            :class="{ activo: accion.vivo, pulso: accion.vivo }"
            :disabled="registrando"
            @click="ejecutarAccion(accion.id)"
          >
            <img v-if="accion.img" :src="accion.img" alt="" class="icono icono-img" />
            <span v-else class="icono">{{ accion.icono }}</span>
            {{ accion.etiqueta }}
          </button>
        </div>
      </section>

      <!-- Hojas inferiores (formularios) -->
      <HojaInferior
        :abierta="nuevoPanal !== null"
        :titulo="nuevoPanal ? TITULOS_PANAL[nuevoPanal.tipo].texto : ''"
        :icono="nuevoPanal ? TITULOS_PANAL[nuevoPanal.tipo].icono : undefined"
        @cerrar="nuevoPanal = null"
      >
        <template v-if="nuevoPanal">
          <div class="campo">
            <label for="panal-hora">Hora (por si no es ahora mismo)</label>
            <input
              id="panal-hora"
              v-model="nuevoPanal.hora"
              type="datetime-local"
              :min="sueloHora()"
              :max="topeHora()"
              required
            />
          </div>
          <template v-if="nuevoPanal.tipo !== 'pis'">
            <span class="etiqueta-seccion">¿Cuánta?</span>
            <div class="cantidades">
              <button
                v-for="(etiqueta, valor) in ETIQUETAS_CANTIDAD_PANAL"
                :key="valor"
                class="acceso"
                :disabled="registrando"
                @click="registrarPanal(valor)"
              >
                {{ etiqueta }}
              </button>
            </div>
          </template>
          <button v-else class="boton" :disabled="registrando" @click="registrarPanal()">
            Guardar
          </button>
        </template>
      </HojaInferior>

      <HojaInferior
        :abierta="formulario === 'toma'"
        titulo="Nueva toma"
        :icono="ICONOS_REGISTRO.toma"
        @cerrar="formulario = null"
      >
        <form @submit.prevent="guardarToma">
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
            <input
              id="toma-inicio"
              v-model="nuevaToma.inicio"
              type="datetime-local"
              :min="sueloHora()"
              :max="topeHora()"
              required
            />
          </div>
          <!-- Obligatorio: un biberón guardado sin ml ni fin se confundiría con
               una toma en curso del cronómetro (getTomaAbierta) -->
          <div v-if="esBiberon" class="campo">
            <label for="toma-ml">Cantidad (ml)</label>
            <input
              id="toma-ml"
              v-model.number="nuevaToma.cantidadMl"
              type="number"
              :min="LIMITES_ENTRADA.tomaMl.min"
              :max="LIMITES_ENTRADA.tomaMl.max"
              required
            />
          </div>
          <div v-else class="campo">
            <label for="toma-min">Duración (min)</label>
            <input
              id="toma-min"
              v-model.number="nuevaToma.duracionMin"
              type="number"
              :min="LIMITES_ENTRADA.tomaPechoMin.min"
              :max="LIMITES_ENTRADA.tomaPechoMin.max"
              required
            />
          </div>
          <div class="campo">
            <label for="toma-notas">Notas</label>
            <input id="toma-notas" v-model="nuevaToma.notas" type="text" />
          </div>
          <div class="botones-toma">
            <button class="boton" type="submit" :disabled="registrando">Guardar</button>
            <button class="boton secundario" type="button" @click="empezarCronometroToma">
              ▶ Cronómetro
            </button>
          </div>
        </form>
      </HojaInferior>

      <HojaInferior
        :abierta="formulario === 'fin-toma'"
        titulo="Toma terminada — ¿cuántos ml?"
        :icono="ICONOS_REGISTRO.toma"
        @cerrar="formulario = null"
      >
        <form @submit.prevent="terminarToma(numeroONull(mlFinToma))">
          <div class="campo">
            <label for="fin-toma-ml">Cantidad (ml)</label>
            <input
              id="fin-toma-ml"
              v-model.number="mlFinToma"
              type="number"
              :min="LIMITES_ENTRADA.tomaMl.min"
              :max="LIMITES_ENTRADA.tomaMl.max"
            />
          </div>
          <button class="boton" type="submit" :disabled="registrando">Guardar</button>
        </form>
      </HojaInferior>

      <!-- Hoja del ＋: todos los tipos de registro -->
      <HojaInferior
        :abierta="formulario === 'registro'"
        titulo="📝 Registrar"
        @cerrar="formulario = null"
      >
        <div class="accesos rejilla-registro">
          <button
            v-for="accion in accionesRegistro"
            :key="accion.id"
            class="acceso"
            :class="{ activo: accion.vivo, pulso: accion.vivo }"
            :disabled="registrando"
            @click="ejecutarAccion(accion.id)"
          >
            <img v-if="accion.img" :src="accion.img" alt="" class="icono icono-img" />
            <span v-else class="icono">{{ accion.icono }}</span>
            {{ accion.etiqueta }}
          </button>
        </div>
      </HojaInferior>

      <!-- Momento -->
      <HojaInferior
        :abierta="formulario === 'momento'"
        titulo="Momento"
        :icono="ICONOS_REGISTRO.momento"
        @cerrar="formulario = null"
      >
        <form @submit.prevent="guardarMomento">
          <div class="campo">
            <label for="momento-desc">¿Qué ha hecho?</label>
            <input
              id="momento-desc"
              v-model="nuevoMomento"
              type="text"
              placeholder="Dijo «ajo» por primera vez 🥰"
              required
            />
          </div>
          <div class="campo">
            <label for="momento-hora">Hora (por si no es ahora mismo)</label>
            <input
              id="momento-hora"
              v-model="horaMomento"
              type="datetime-local"
              :min="sueloHora()"
              :max="topeHora()"
              required
            />
          </div>
          <button class="boton" type="submit" :disabled="registrando">Guardar momento</button>
        </form>
      </HojaInferior>

      <!-- Sueño a posteriori -->
      <HojaInferior
        :abierta="formulario === 'sueno-post'"
        titulo="Sueño a posteriori"
        :icono="ICONOS_REGISTRO.sueno_post"
        @cerrar="formulario = null"
      >
        <form @submit.prevent="guardarSueno">
          <div class="campo">
            <label for="sueno-inicio">Empezó</label>
            <input
              id="sueno-inicio"
              v-model="nuevoSueno.inicio"
              type="datetime-local"
              :min="sueloHora()"
              :max="topeHora()"
              required
            />
          </div>
          <div class="campo">
            <label for="sueno-fin">Terminó</label>
            <input
              id="sueno-fin"
              v-model="nuevoSueno.fin"
              type="datetime-local"
              :min="sueloHora()"
              :max="topeHora()"
              required
            />
          </div>
          <button class="boton" type="submit" :disabled="registrando">Guardar sueño</button>
        </form>
      </HojaInferior>

      <!-- Otro evento -->
      <HojaInferior
        :abierta="formulario === 'evento'"
        :titulo="
          ICONOS_REGISTRO[nuevoEvento.tipo]
            ? ETIQUETAS_EVENTO[nuevoEvento.tipo]
            : `⭐ ${ETIQUETAS_EVENTO[nuevoEvento.tipo]}`
        "
        :icono="ICONOS_REGISTRO[nuevoEvento.tipo]"
        @cerrar="formulario = null"
      >
        <form @submit.prevent="guardarEvento">
          <div class="campo">
            <label for="evento-desc">Descripción</label>
            <input id="evento-desc" v-model="nuevoEvento.descripcion" type="text" />
          </div>
          <div class="campo">
            <label for="evento-hora">Hora (por si no es ahora mismo)</label>
            <input
              id="evento-hora"
              v-model="nuevoEvento.hora"
              type="datetime-local"
              :min="sueloHora()"
              :max="topeHora()"
              required
            />
          </div>
          <button class="boton" type="submit" :disabled="registrando">Guardar</button>
        </form>
      </HojaInferior>

      <!-- Configuración por usuario: hitos visibles + accesos directos -->
      <HojaInferior
        :abierta="mostrarConfig"
        titulo="⚙ Configuración"
        @cerrar="mostrarConfig = false"
      >
        <p class="suave">
          Se guarda para tu usuario en este dispositivo — cada uno puede tener la suya.
        </p>
        <span class="etiqueta-seccion">Últimos hitos visibles sin desplegar</span>
        <label v-for="entrada in CATALOGO_HITOS" :key="entrada.id" class="opcion-hito">
          <input v-model="hitosVisiblesConfig" type="checkbox" :value="entrada.id" />
          <span class="opcion-texto">
            <img v-if="entrada.img" :src="entrada.img" alt="" class="icono-opcion" />
            {{ entrada.etiqueta }}
          </span>
        </label>
        <span class="etiqueta-seccion seccion-config">Accesos directos de la card</span>
        <label v-for="accion in accionesRegistro" :key="accion.id" class="opcion-hito">
          <input v-model="accesosConfig" type="checkbox" :value="accion.id" />
          <span class="opcion-texto">
            <img v-if="accion.img" :src="accion.img" alt="" class="icono-opcion" />
            <template v-else>{{ accion.icono }}</template>
            {{ accion.etiqueta }}
          </span>
        </label>
        <button class="boton" @click="mostrarConfig = false">Listo</button>
      </HojaInferior>

      <!-- Edición de un registro del día (misma hoja que en el Historial) -->
      <HojaEdicionRegistro
        :registro="registroEnEdicion"
        @cerrar="registroEnEdicion = null"
        @guardado="alGuardarEdicion"
      />
    </template>

    <!-- Toast de deshacer -->
    <div v-if="deshacer" class="toast-deshacer" role="status">
      {{ deshacer.texto }}
      <button class="boton" @click="ejecutarDeshacer">Deshacer</button>
    </div>
  </main>
</template>

<style scoped>
/* Card 1 · La bebé */
.cabecera-bebe {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.25rem;
}

.cabecera-bebe h2 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
}

.avatar-bebe {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--color-primario);
  background: var(--color-tarjeta);
  flex-shrink: 0;
}

.tarjeta-hero .stats {
  margin-bottom: 0;
}

/* Card 2 · Datos de Hoy */
.cabecera-datos-hoy {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: baseline;
  margin-bottom: 0.5rem;
}

.cabecera-datos-hoy h3 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.icono-titulo {
  width: 34px;
  height: 34px;
}

.cabecera-datos-hoy .hora-actual {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.cabecera-datos-hoy .fecha-hoy {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}

.titulo-accesos {
  text-align: center;
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0 0 1.25rem;
}

.hora-actual {
  font-variant-numeric: tabular-nums;
  font-size: 1rem;
}

.seccion-hoy {
  margin-top: 1.1rem;
}

/* Aire entre el título de la sección y su contenido */
.seccion-hoy > .etiqueta-seccion {
  margin-bottom: 0.6rem;
}

.seccion-hoy + .seccion-hoy {
  border-top: 1px solid var(--color-borde);
  padding-top: 1.1rem;
}

/* Cabecera de sección desplegable: toda la fila es el botón */
.cabecera-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  padding: 0;
  margin-bottom: 0.6rem;
  text-align: left;
  color: inherit;
}

.cabecera-toggle .etiqueta-seccion {
  margin-bottom: 0;
}

.cabecera-toggle:disabled {
  cursor: default;
}

.opcion-hito {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--color-borde);
}

.opcion-hito input {
  width: auto;
}

.opcion-hito:last-of-type {
  border-bottom: none;
  margin-bottom: 0.75rem;
}

.seccion-config {
  margin-top: 1rem;
}

/* Bloque "Ahora" del hero */
.ahora {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.fila-ahora {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}

.fila-ahora .que {
  font-size: 0.85rem;
}

.fila-ahora .cuanto {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-primario-oscuro);
  text-align: right;
}

.fila-ahora .cuanto.vivo::after {
  content: ' ●';
  font-size: 0.7rem;
  color: var(--color-ok);
}

/* Próxima cita dentro de la card de la bebé */
.cita-bebe {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid var(--color-borde);
  margin-top: 0.75rem;
  padding-top: 0.6rem;
  text-decoration: none;
  color: inherit;
  font-size: 0.92rem;
}

.ver-patron {
  display: block;
  text-align: center;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  text-decoration: none;
}

/* Tiles del resumen */
.stats {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.stats.tres {
  grid-template-columns: repeat(3, 1fr);
}

.stat {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  background: var(--color-tarjeta);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-s);
  padding: 0.6rem 0.4rem;
  text-align: center;
}

.stat.enlazado {
  text-decoration: none;
  color: inherit;
  box-shadow: var(--sombra);
}

.stat .chev {
  position: absolute;
  top: 0.3rem;
  right: 0.5rem;
  color: var(--color-texto-suave);
  font-size: 0.85rem;
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

.acceso .icono-img {
  width: 30px;
  height: 30px;
}

.opcion-texto {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.icono-opcion {
  width: 18px;
  height: 18px;
}

.acceso:hover {
  background: var(--color-borde);
}

.acceso.activo {
  background: var(--color-accion);
  border-color: var(--color-accion);
  color: #fff;
}

/* Selector de cantidad de caca */
.cantidades {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}

/* La hoja del ＋: rejilla con todos los tipos de registro */
.rejilla-registro {
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.rejilla-registro .acceso {
  font-size: 0.8rem;
  padding: 0.6rem 0.3rem;
}

.sin-peso {
  display: inline-block;
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
}

/* Los objetivos enlazan a sus gráficas de día a día en Evolución */
.enlace-objetivo {
  display: block;
  color: inherit;
  text-decoration: none;
}

.enlace-objetivo + .enlace-objetivo {
  margin-top: 0.6rem;
}

/* Lápiz de edición, igual que en el Historial */
.fila-registro .editar {
  color: var(--color-texto-suave);
}

/* Swipe a la izquierda (o hover con ratón) para revelar el borrar */
.fila-registro.deslizable .borrar-fila {
  display: none;
}

.fila-registro.deslizable.deslizada .borrar-fila,
.fila-registro.deslizable:focus-within .borrar-fila {
  display: inline-flex;
}

@media (hover: hover) {
  .fila-registro.deslizable:hover .borrar-fila {
    display: inline-flex;
  }
}

.botones-toma {
  display: flex;
  gap: 0.5rem;
}

.toast-deshacer {
  position: fixed;
  bottom: calc(72px + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-toast-fondo);
  color: var(--color-toast-texto);
  padding: 0.5rem 0.9rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  white-space: nowrap;
  z-index: 10;
}
</style>
