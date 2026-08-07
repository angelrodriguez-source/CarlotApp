<script setup lang="ts">
/**
 * HoyView.vue — Dashboard de inicio.
 *
 * Mitad superior: resumen de Carlota con números en grande — edad/peso/altura,
 * sueño del día (incluye el sueño en curso) y leche tomada.
 * Mitad inferior: accesos directos Sueño / Toma / Caca + botón "Más" para el
 * resto (pañal pis/mixto y eventos). Debajo, la línea de tiempo del día.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBebeStore } from '../stores/bebeStore'
import * as servicio from '../services/carlotaService'
import BarraObjetivo from '../components/BarraObjetivo.vue'
import HojaInferior from '../components/HojaInferior.vue'
import { desarrolloSemana } from '../models/semanasDesarrollo'
import {
  aInputLocal,
  claveDia,
  duracionMinutos,
  edadCorta,
  edadDias,
  formatoDuracion,
  formatoPeso,
  hoyLocal,
  minutosSuenoEnDia,
  objetivoLecheMl,
  objetivoSuenoMinutos,
  percentilOMS,
  resumenDia,
  textoEvento,
  textoPanal,
  textoSueno,
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
const route = useRoute()
const router = useRouter()

const cargando = ref(true)
const error = ref('')

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
const ultimoCorteUnas = ref<Evento | null>(null)

// Qué formulario rápido está abierto
const formulario = ref<'toma' | 'fin-toma' | 'mas' | null>(null)

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

async function cargarDia() {
  const bebe = await bebeStore.cargar()
  if (!bebe) return
  const desde = inicioDiaIso()
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
    ultimoCorteUnas.value,
  ] = await Promise.all([
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
    servicio.getUltimoEventoDeTipo(bebe.id, 'unas'),
  ])
}

// El FAB "+" de la nav (y el CTA de Momentos del Historial) llegan con
// ?registrar=...: abrimos la hoja "Más" y limpiamos la query
function atenderQueryRegistrar() {
  if (route.query.registrar) {
    abrirMas()
    router.replace({ query: {} })
  }
}

watch(() => route.query.registrar, atenderQueryRegistrar)

onMounted(async () => {
  temporizador = window.setInterval(() => (ahora.value = new Date()), 60_000)
  atenderQueryRegistrar()
  try {
    await cargarDia()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    cargando.value = false
  }
})

onUnmounted(() => {
  window.clearInterval(temporizador)
  window.clearTimeout(temporizadorDeshacer)
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

/** Ejecuta un alta, recarga el día y ofrece deshacerla durante unos segundos */
async function registrarYOfrecer<T>(
  texto: string,
  accion: () => Promise<T>,
  deshacerDe: (resultado: T) => () => Promise<unknown>,
) {
  error.value = ''
  try {
    const resultado = await accion()
    ofrecerDeshacer(texto, deshacerDe(resultado))
    await cargarDia()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
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

const valorSuenoTexto = computed(() => `😴 ${formatoDuracion(minutosSuenoHoy.value)}`)

const objetivoSuenoTexto = computed(
  () => `objetivo ${objetivoSueno.value.min / 60}-${objetivoSueno.value.max / 60} h`,
)

const valorLecheTexto = computed(
  () =>
    `🍼 ${resumen.value.mlBiberon} ml · ${resumen.value.numTomas} ${
      resumen.value.numTomas === 1 ? 'toma' : 'tomas'
    }`,
)

const objetivoLecheTexto = computed(() =>
  objetivoLeche.value ? `objetivo ${objetivoLeche.value.min}-${objetivoLeche.value.max} ml` : '',
)

// ---- ¿Qué hay de nuevo esta semana? ----
const semanaActual = computed(() => Math.floor(edadDiasHoy.value / 7))
const etapaSemana = computed(() => desarrolloSemana(semanaActual.value))
const mostrarSemana = ref(false)

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

interface ContadorAhora {
  etiqueta: string
  valor: string
  vivo?: boolean // en curso (durmiendo / toma con cronómetro)
}

/** El bloque "Ahora": lo que un padre consulta 20 veces al día, en grande */
const contadoresAhora = computed<ContadorAhora[]>(() => {
  const filas: ContadorAhora[] = []
  if (tomaAbierta.value) {
    filas.push({
      etiqueta: '🍼 Toma en curso',
      valor: formatoDuracion(minutosTomaAbierta.value),
      vivo: true,
    })
  } else if (ultimaToma.value) {
    filas.push({ etiqueta: '🍼 Última toma', valor: haceTexto(ultimaToma.value.inicio) })
  } else {
    filas.push({ etiqueta: '🍼 Tomas', valor: 'sin registros aún' })
  }
  if (suenoAbierto.value) {
    filas.push({
      etiqueta: '😴 Durmiendo',
      valor: `desde ${haceTexto(suenoAbierto.value.inicio)}`,
      vivo: true,
    })
  } else if (ultimoSuenoTerminado.value?.fin) {
    filas.push({
      etiqueta: '😴 Despierta',
      valor: `desde ${haceTexto(ultimoSuenoTerminado.value.fin)}`,
    })
  }
  if (ultimoPanal.value) {
    filas.push({ etiqueta: '🧷 Último pañal', valor: haceTexto(ultimoPanal.value.fecha) })
  }
  return filas
})

// ---- Percentiles OMS para los tiles de peso/altura ----
function percentilTile(tipo: 'peso' | 'altura', dato: { valor: number; fecha: string } | null) {
  const nacimiento = bebeStore.bebe?.fecha_nacimiento
  if (!dato || !nacimiento) return null
  const p = percentilOMS(tipo, dato.valor, edadDias(nacimiento, dato.fecha))
  return p === null ? null : Math.round(p)
}

const percentilPeso = computed(() => percentilTile('peso', ultimoPeso.value))
const percentilAltura = computed(() => percentilTile('altura', ultimaAltura.value))

// ---- Próxima cita (banda bajo el hero si está a menos de 7 días) ----
const proximaCita = computed(() => {
  const ahoraMs = ahora.value.getTime()
  const en7Dias = ahoraMs + 7 * 86_400_000
  return (
    citas.value
      .filter((c) => !c.completada)
      .filter((c) => {
        const fecha = new Date(c.fecha).getTime()
        return fecha >= ahoraMs - 6 * 3600_000 && fecha <= en7Dias
      })
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
  formulario.value = formulario.value === 'toma' ? null : 'toma'
}

function guardarToma() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const inicio = new Date(nuevaToma.value.inicio)
  const minutos = nuevaToma.value.duracionMin
  const fin = !esBiberon.value && minutos ? new Date(inicio.getTime() + minutos * 60_000) : null
  registrarYOfrecer(
    'Toma registrada',
    () =>
      servicio.registrarToma({
        bebe_id: bebe.id,
        inicio: inicio.toISOString(),
        fin: fin ? fin.toISOString() : null,
        tipo: nuevaToma.value.tipo,
        cantidad_ml: esBiberon.value ? nuevaToma.value.cantidadMl : null,
        notas: nuevaToma.value.notas || null,
      }),
    (toma) => () => servicio.eliminarToma(toma.id),
  )
  formulario.value = null
  nuevaToma.value.notas = ''
}

// ---- Cronómetro de toma en vivo ----
const tomaAbiertaEsBiberon = computed(() => tomaAbierta.value?.tipo.startsWith('biberon') ?? false)
const mlFinToma = ref<number | null>(null)

function empezarCronometroToma() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const tipo = nuevaToma.value.tipo
  registrarYOfrecer(
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
  formulario.value = null
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

function terminarToma(ml: number | null) {
  const toma = tomaAbierta.value
  if (!toma) return
  registrarYOfrecer(
    'Toma terminada',
    () => servicio.actualizarToma(toma.id, { fin: new Date().toISOString(), cantidad_ml: ml }),
    () => () => servicio.actualizarToma(toma.id, { fin: null, cantidad_ml: null }),
  )
  formulario.value = null
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
// Pis se registra al toque; caca y mixto piden antes la cantidad (poco/medio/mucho)
const panalPendiente = ref<TipoPanal | null>(null)

function pedirCantidadPanal(tipo: TipoPanal) {
  panalPendiente.value = panalPendiente.value === tipo ? null : tipo
}

function registrarPanal(tipo: TipoPanal, cantidad: CantidadPanal | null = null) {
  const bebe = bebeStore.bebe
  if (!bebe) return
  registrarYOfrecer(
    'Pañal registrado',
    () =>
      servicio.registrarPanal({
        bebe_id: bebe.id,
        fecha: new Date().toISOString(),
        tipo,
        cantidad,
        notas: null,
      }),
    (panal) => () => servicio.eliminarPanal(panal.id),
  )
  panalPendiente.value = null
  if (formulario.value === 'mas') formulario.value = null
}

// ---- Sueño a posteriori ----
const nuevoSueno = ref({ inicio: aInputLocal(new Date()), fin: aInputLocal(new Date()) })

function guardarSueno() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  registrarYOfrecer(
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
  formulario.value = null
}

function abrirMas() {
  const ahoraInput = aInputLocal(new Date())
  nuevoSueno.value = { inicio: ahoraInput, fin: ahoraInput }
  formulario.value = formulario.value === 'mas' ? null : 'mas'
}

// ---- Evento ----
const nuevoEvento = ref({ tipo: 'bano' as TipoEvento, descripcion: '' })

// ---- Momento (evento tipo hito con nombre propio) ----
const nuevoMomento = ref('')

function guardarMomento() {
  const bebe = bebeStore.bebe
  if (!bebe || !nuevoMomento.value.trim()) return
  registrarYOfrecer(
    'Momento guardado ✨',
    () =>
      servicio.registrarEvento({
        bebe_id: bebe.id,
        fecha: new Date().toISOString(),
        tipo: 'hito',
        descripcion: nuevoMomento.value.trim(),
      }),
    (evento) => () => servicio.eliminarEvento(evento.id),
  )
  formulario.value = null
  nuevoMomento.value = ''
}

// ---- Uñas (un toque desde "Más") ----
/** 'hace N días' legible para cosas que se miden en días, no en horas */
function haceDiasTexto(iso: string): string {
  const dias = Math.floor((ahora.value.getTime() - new Date(iso).getTime()) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  return `hace ${dias} días`
}

function registrarCorteUnas() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  registrarYOfrecer(
    'Uñas cortadas ✂️',
    () =>
      servicio.registrarEvento({
        bebe_id: bebe.id,
        fecha: new Date().toISOString(),
        tipo: 'unas',
        descripcion: null,
      }),
    (evento) => () => servicio.eliminarEvento(evento.id),
  )
  formulario.value = null
}

function guardarEvento() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  registrarYOfrecer(
    'Evento registrado',
    () =>
      servicio.registrarEvento({
        bebe_id: bebe.id,
        fecha: new Date().toISOString(),
        tipo: nuevoEvento.value.tipo,
        descripcion: nuevoEvento.value.descripcion || null,
      }),
    (evento) => () => servicio.eliminarEvento(evento.id),
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
    ...tomas.value.map((t) => ({
      id: t.id,
      hora: t.inicio,
      texto: textoToma(t),
      borrar: () => servicio.eliminarToma(t.id),
    })),
    ...suenos.value.map((s) => ({
      id: s.id,
      hora: s.inicio,
      texto: textoSueno(s),
      borrar: () => servicio.eliminarSueno(s.id),
    })),
    ...panales.value.map((p) => ({
      id: p.id,
      hora: p.fecha,
      texto: textoPanal(p),
      borrar: () => servicio.eliminarPanal(p.id),
    })),
    ...eventos.value.map((e) => ({
      id: e.id,
      hora: e.fecha,
      texto: textoEvento(e),
      borrar: () => servicio.eliminarEvento(e.id),
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
      <!-- Hero: el bloque "Ahora" con los datos que más se consultan -->
      <section class="tarjeta tarjeta-hero">
        <h2>👶 {{ bebeStore.bebe.nombre }}</h2>
        <span class="etiqueta-seccion">Ahora</span>
        <div class="ahora">
          <div v-for="contador in contadoresAhora" :key="contador.etiqueta" class="fila-ahora">
            <span class="que">{{ contador.etiqueta }}</span>
            <strong class="cuanto" :class="{ vivo: contador.vivo }">{{ contador.valor }}</strong>
          </div>
        </div>
      </section>

      <!-- Próxima cita a menos de 7 días -->
      <RouterLink
        v-if="proximaCita"
        :to="{ name: 'citas' }"
        class="tarjeta tarjeta-plana banda-cita"
      >
        <span>🗓️ {{ proximaCita.titulo }} · {{ fechaCita(proximaCita.fecha) }}</span>
        <span class="suave">→</span>
      </RouterLink>

      <!-- Hoy: objetivos con su progreso (valor y barra fusionados) -->
      <section class="tarjeta">
        <span class="etiqueta-seccion">Hoy · objetivos</span>
        <BarraObjetivo
          :valor-texto="valorSuenoTexto"
          :objetivo-texto="objetivoSuenoTexto"
          :valor="minutosSuenoHoy"
          :min="objetivoSueno.min"
          :max="objetivoSueno.max"
        />
        <BarraObjetivo
          v-if="objetivoLeche"
          :valor-texto="valorLecheTexto"
          :objetivo-texto="objetivoLecheTexto"
          :valor="resumen.mlBiberon"
          :min="objetivoLeche.min"
          :max="objetivoLeche.max"
        />
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
      </section>

      <!-- Edad / peso / altura (peso y altura enlazan a Evolución) -->
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

      <!-- Registrar -->
      <section class="tarjeta">
        <span class="etiqueta-seccion">📝 Registrar</span>
        <div class="accesos">
          <button
            class="acceso"
            :class="{ activo: suenoAbierto, pulso: suenoAbierto }"
            @click="alternarSueno"
          >
            <span class="icono">😴</span>
            {{ suenoAbierto ? 'Termina sueño' : 'Empieza sueño' }}
          </button>
          <button
            class="acceso"
            :class="{ activo: !!tomaAbierta || formulario === 'toma', pulso: !!tomaAbierta }"
            @click="pulsarAccesoToma"
          >
            <span class="icono">🍼</span>
            {{ tomaAbierta ? `Termina toma (${minutosTomaAbierta} min)` : 'Toma' }}
          </button>
          <button
            class="acceso"
            :class="{ activo: panalPendiente === 'caca' }"
            @click="pedirCantidadPanal('caca')"
          >
            <span class="icono">💩</span>
            Caca
          </button>
          <button class="acceso" :class="{ activo: formulario === 'mas' }" @click="abrirMas">
            <span class="icono">➕</span>
            Más
          </button>
        </div>
      </section>

      <!-- ¿Qué hay de nuevo esta semana? -->
      <section v-if="etapaSemana" class="tarjeta tarjeta-plana">
        <button class="cabecera-semana" @click="mostrarSemana = !mostrarSemana">
          <span>
            🌱 <strong>Semana {{ semanaActual }}</strong> · {{ etapaSemana.titulo }}
          </span>
          <span class="suave">{{ mostrarSemana ? '▲' : '▼' }}</span>
        </button>
        <template v-if="mostrarSemana">
          <ul class="lista-cambios">
            <li v-for="cambio in etapaSemana.cambios" :key="cambio">{{ cambio }}</li>
          </ul>
          <p class="ajuste">😴 {{ etapaSemana.sueno }}</p>
          <p class="ajuste">🍼 {{ etapaSemana.tomas }}</p>
          <button class="boton secundario" @click="abrirMas">✨ Guardar un momento</button>
          <p class="suave nota-semana">
            Orientativo (hitos CDC/AAP/NHS): cada bebé va a su ritmo. Las dudas, al pediatra.
          </p>
        </template>
      </section>

      <!-- Línea de tiempo de hoy (desliza a la izquierda para borrar) -->
      <div class="tarjeta">
        <h3>📋 Registro del día</h3>
        <p v-if="lineaDeTiempo.length === 0" class="suave">Todavía no hay registros hoy.</p>
        <div
          v-for="registro in lineaDeTiempo"
          :key="registro.id"
          class="fila-registro deslizable"
          :class="{ deslizada: filaDeslizada === registro.id }"
          @touchstart.passive="inicioToqueFila"
          @touchend.passive="finToqueFila($event, registro.id)"
        >
          <span class="hora">{{ horaCorta(registro.hora) }}</span>
          <span class="detalle">{{ registro.texto }}</span>
          <button
            class="boton peligro borrar-fila"
            aria-label="Borrar registro"
            @click="ejecutar(registro.borrar)"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Hojas inferiores (formularios) -->
      <HojaInferior
        :abierta="panalPendiente !== null"
        :titulo="`💩 ${panalPendiente === 'mixto' ? 'Pis + caca' : 'Caca'} — ¿cuánta?`"
        @cerrar="panalPendiente = null"
      >
        <div class="cantidades">
          <button
            v-for="(etiqueta, valor) in ETIQUETAS_CANTIDAD_PANAL"
            :key="valor"
            class="acceso"
            @click="registrarPanal(panalPendiente!, valor)"
          >
            {{ etiqueta }}
          </button>
        </div>
      </HojaInferior>

      <HojaInferior
        :abierta="formulario === 'toma'"
        titulo="🍼 Nueva toma"
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
            <input id="toma-inicio" v-model="nuevaToma.inicio" type="datetime-local" required />
          </div>
          <!-- Obligatorio: un biberón guardado sin ml ni fin se confundiría con
               una toma en curso del cronómetro (getTomaAbierta) -->
          <div v-if="esBiberon" class="campo">
            <label for="toma-ml">Cantidad (ml)</label>
            <input
              id="toma-ml"
              v-model.number="nuevaToma.cantidadMl"
              type="number"
              min="1"
              required
            />
          </div>
          <div v-else class="campo">
            <label for="toma-min">Duración (min)</label>
            <input id="toma-min" v-model.number="nuevaToma.duracionMin" type="number" min="1" />
          </div>
          <div class="campo">
            <label for="toma-notas">Notas</label>
            <input id="toma-notas" v-model="nuevaToma.notas" type="text" />
          </div>
          <div class="botones-toma">
            <button class="boton" type="submit">Guardar</button>
            <button class="boton secundario" type="button" @click="empezarCronometroToma">
              ▶ Cronómetro
            </button>
          </div>
        </form>
      </HojaInferior>

      <HojaInferior
        :abierta="formulario === 'fin-toma'"
        titulo="🍼 Toma terminada — ¿cuántos ml?"
        @cerrar="formulario = null"
      >
        <form @submit.prevent="terminarToma(mlFinToma)">
          <div class="campo">
            <label for="fin-toma-ml">Cantidad (ml)</label>
            <input id="fin-toma-ml" v-model.number="mlFinToma" type="number" min="1" />
          </div>
          <button class="boton" type="submit">Guardar</button>
        </form>
      </HojaInferior>

      <HojaInferior
        :abierta="formulario === 'mas'"
        titulo="➕ Más registros"
        @cerrar="formulario = null"
      >
        <form @submit.prevent="guardarMomento">
          <h3>✨ Momento</h3>
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
          <button class="boton" type="submit">Guardar momento</button>
        </form>
        <div class="acciones bloque-mas">
          <span class="suave">Pañal:</span>
          <button class="boton secundario" @click="registrarPanal('pis')">💧 Pis</button>
          <button class="boton secundario" @click="pedirCantidadPanal('mixto')">💧💩 Mixto</button>
        </div>
        <div class="acciones bloque-mas">
          <button class="boton secundario" @click="registrarCorteUnas">✂️ Uñas cortadas</button>
          <span v-if="ultimoCorteUnas" class="suave">
            última vez {{ haceDiasTexto(ultimoCorteUnas.fecha) }}
          </span>
        </div>
        <form class="bloque-mas" @submit.prevent="guardarSueno">
          <h3>😴 Sueño a posteriori</h3>
          <div class="campo">
            <label for="sueno-inicio">Empezó</label>
            <input id="sueno-inicio" v-model="nuevoSueno.inicio" type="datetime-local" required />
          </div>
          <div class="campo">
            <label for="sueno-fin">Terminó</label>
            <input id="sueno-fin" v-model="nuevoSueno.fin" type="datetime-local" required />
          </div>
          <button class="boton" type="submit">Guardar sueño</button>
        </form>
        <form class="bloque-mas" @submit.prevent="guardarEvento">
          <h3>⭐ Nuevo evento</h3>
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
      </HojaInferior>
    </template>

    <!-- Toast de deshacer -->
    <div v-if="deshacer" class="toast-deshacer">
      {{ deshacer.texto }}
      <button class="boton" @click="ejecutarDeshacer">Deshacer</button>
    </div>
  </main>
</template>

<style scoped>
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
  font-size: 0.92rem;
}

.fila-ahora .cuanto {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-primario-oscuro);
  text-align: right;
}

.fila-ahora .cuanto.vivo::after {
  content: ' ●';
  font-size: 0.7rem;
  color: var(--color-ok);
}

/* Banda de próxima cita */
.banda-cita {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  text-decoration: none;
  color: inherit;
  font-size: 0.92rem;
}

.ver-patron {
  display: inline-block;
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

.acceso:hover {
  background: var(--color-borde);
}

.acceso.activo {
  background: var(--color-accion);
  border-color: var(--color-accion);
  color: #fff;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 1rem;
}

/* Selector de cantidad de caca */
.cantidades {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}

.bloque-mas {
  border-top: 1px solid var(--color-borde);
  padding-top: 0.75rem;
  margin-top: 0.75rem;
}

.sin-peso {
  display: inline-block;
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
}

/* Swipe a la izquierda (o hover con ratón) para revelar el borrar */
.fila-registro.deslizable .borrar-fila {
  display: none;
}

.fila-registro.deslizable.deslizada .borrar-fila {
  display: inline-block;
}

@media (hover: hover) {
  .fila-registro.deslizable:hover .borrar-fila {
    display: inline-block;
  }
}

/* ¿Qué hay de nuevo esta semana? */
.cabecera-semana {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  padding: 0;
  font-size: 1rem;
  color: inherit;
  text-align: left;
}

.lista-cambios {
  margin: 0.75rem 0 0.5rem;
  padding-left: 1.25rem;
}

.lista-cambios li {
  margin-bottom: 0.35rem;
}

.ajuste {
  margin: 0.35rem 0;
}

.nota-semana {
  margin: 0.5rem 0 0;
  font-size: 0.78rem;
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
  background: var(--color-texto);
  color: #fff;
  padding: 0.5rem 0.9rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  white-space: nowrap;
  z-index: 10;
}
</style>
