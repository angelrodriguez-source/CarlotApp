/**
 * MimePredictor.ts — El algoritmo del Mime Predictor (lógica pura).
 *
 * Predice la próxima toma, la próxima siesta y la probabilidad de
 * incomodidad combinando DOS capas:
 *
 *  1. Línea base poblacional por edad (prediccionBase.ts, precargada de
 *     fuentes públicas: ventanas de vigilia, intervalos de toma, pañales).
 *  2. El patrón OBSERVADO de la bebé: medianas y dispersión de sus
 *     intervalos reales en los últimos días, separando día y noche.
 *
 * La mezcla es un "shrinkage" bayesiano sencillo: con pocas observaciones
 * manda la línea base; según se acumulan datos, manda el patrón personal
 *   peso_personal = n / (n + k)
 * donde k es un parámetro calibrado por backtesting (ver el spec: con
 * bebés simulados de parámetros conocidos, se predice cada evento usando
 * solo los anteriores y se mide el error absoluto medio).
 *
 * Todo es puro (sin red, sin DOM): recibe los registros y el instante
 * "ahora", y devuelve predicciones serializables. La persistencia (tabla
 * `predicciones`) va aparte, en el servicio.
 */
import type { Panal, Sueno, Toma } from '../types'
import { etapaPrediccion, type RangoMin } from './prediccionBase'

export interface DatosPredictor {
  tomas: Toma[]
  suenos: Sueno[]
  panales: Panal[]
}

/**
 * Parámetros del algoritmo, calibrados con el backtesting de
 * MimePredictor.spec.ts: barrido de k∈{1..8} × histórico∈{5,7,10,14} días
 * contra 7 bebés simulados (regular, desviado corto/largo, irregular,
 * arranque en frío de 1 y 4 días, patrón cambiante y racha de 2 días
 * anómalos). Resultado: histórico=7d equilibra adaptarse a cambios de
 * patrón (gana la memoria corta) con resistir días raros (la mediana de
 * ≥7d los absorbe; con 5d el MAE empeora ~5 min), y k=3 confía en el
 * patrón personal en cuanto hay unas pocas muestras sin sobreajustar
 * con 2-3 intervalos ruidosos.
 */
export const AJUSTES = {
  /** Solo se aprende de los últimos N días (el patrón cambia con la edad) */
  historicoDias: 7,
  /** Shrinkage de tomas: peso personal = n/(n+k) */
  kToma: 3,
  /** Shrinkage de ventanas de vigilia */
  kSueno: 3,
  /** Shrinkage de pañales */
  kPanal: 3,
  /** Noche: de las 21:00 a las 07:00 (los intervalos se alargan) */
  horaNocheDesde: 21,
  horaNocheHasta: 7,
  /** Intervalos fuera de estos límites se descartan al aprender (outliers) */
  minIntervaloTomaMin: 45,
  maxIntervaloTomaDiaMin: 8 * 60,
  maxIntervaloTomaNocheMin: 14 * 60,
  minVentanaVigiliaMin: 15,
  maxVentanaVigiliaMin: 6 * 60,
  minIntervaloPanalMin: 20,
  maxIntervaloPanalMin: 8 * 60,
  /** Temperatura del softmax de "¿por qué llora?" (menor = más tajante) */
  temperaturaLlanto: 0.6,
  /**
   * Capa "actual": los últimos intervalos de HOY (mismo tramo horario)
   * corrigen al histórico — un brote de crecimiento o un día de siestas
   * cortas se nota en la predicción sin esperar a que mueva la mediana
   * de 7 días. Su peso también es shrinkage: wR = nR/(nR+kReciente).
   * Calibrado por backtest (barrido kR×maxR sobre 5 escenarios): con la
   * capa apagada, un brote de crecimiento da MAE ~33 min y con ella ~13;
   * el bebé estable solo paga ~2-3 min. maxR=5 (mediana robusta del día)
   * y kR=1 (una sola muestra nunca pesa más del 50%).
   */
  maxRecientes: 5,
  kReciente: 1,
  ventanaRecienteHoras: 10,
  /**
   * Capa de CANTIDAD: una toma más corta que su mediana personal adelanta
   * la siguiente (y una copiosa la retrasa). El intervalo proyectado se
   * multiplica por 1 + sensibilidad·(ml/mlTipico − 1), con el cociente
   * acotado para que un dato raro no dispare la predicción. Solo aplica
   * con ml conocidos (pecho o cronómetro abierto → factor 1).
   * Calibrado por barrido sens∈{0..1} sobre 4 bebés simulados con acople
   * real gap·(ml/120)^α: con 0.35, el acople fuerte (α=0.9) baja de MAE
   * 32→23 y el medio (α=0.6) de 27→19, mientras un bebé SIN acople solo
   * paga +1.4 min (el seguro barato); con sens≥0.5 el no-acoplado paga
   * ya +3.6 y el débil empeora respecto a apagado.
   */
  sensibilidadCantidad: 0.35,
  minFactorCantidad: 0.5,
  maxFactorCantidad: 1.4,
  /** Mínimo de tomas con ml en el histórico para fiarse de la mediana */
  minTomasConMl: 3,
  /**
   * REMATE: tomas separadas por menos de minIntervaloTomaMin se
   * consolidan en una misma COMIDA. Si la última comida quedó por debajo
   * de umbralTomaCorta·mlTipico, lo esperable no es la cadencia normal
   * adelantada sino un REMATE cercano para completarla: mediana de los
   * huecos intra-comida propios (shrinkage kRemate) con prior de 40 min
   * — las guías sitúan el "completar la toma" dentro de ~45 min y el
   * reofrecer un biberón sin terminar dentro de 1-2 h (Baby Care Advice,
   * CDC). El tamaño previsto del remate es lo que faltó para su ración.
   */
  umbralTomaCorta: 0.65,
  kRemate: 2,
  gapRematePriorMin: 40,
  bandaRematePriorMin: 20,
  mlMinimoRemate: 30,
  /**
   * El modo remate SOLO se activa si la bebé lo ha demostrado: al menos
   * estos remates observados en el histórico. Un bebé que tras una toma
   * corta simplemente adelanta su cadencia (sin rematar) no debe recibir
   * una predicción de remate a los 40 min (lo detectó el backtest: al
   * bebé proporcional sin remates le costaba +12 min de MAE).
   */
  minRematesObservados: 2,
  /**
   * Caducidad del modo remate: pasados estos minutos desde la toma corta
   * (o gap+banda personales si son mayores), la predicción vuelve a la
   * cadencia normal con factorCantidad — un "remate pendiente" de hace
   * horas ya no es un remate (lo detectó la introspección: la predicción
   * quedaba congelada en "el remate ya toca" indefinidamente). 75 min
   * cubre el reofrecer dentro de ~1 h de las guías con algo de margen.
   */
  caducidadRemateMin: 75,
  /**
   * Un despertar de menos de estos minutos entre dos tramos de sueño es
   * un MINI-DESPERTAR: ambos tramos se consolidan en un mismo bloque y el
   * hueco no cuenta como ventana de vigilia (contaminaría la mediana).
   */
  miniDespertarMin: 25,
  /**
   * SIESTA CORTA: una siesta por debajo de su duración típica restaura
   * menos y la SIGUIENTE ventana se acorta — las guías (Taking Cara
   * Babies, BabySleepSite) recortan ~45 min la ventana tras una siesta
   * de <45 min (≈ un ciclo de sueño infantil). factorSiesta =
   * 1 + sensibilidad·(duración/típica − 1), acotado. Calibrado por
   * barrido sens∈{0..0.7} con bebés acoplados (vigilia·(dur/50)^β): con
   * 0.4 el acople fuerte baja de MAE 23→17.5 y el medio de 17→13,
   * pagando +3 min un bebé sin acople — y aquí la literatura es unánime
   * en que el acople existe, así que se acepta más sensibilidad que en
   * las tomas.
   */
  sensibilidadSiesta: 0.4,
  minFactorSiesta: 0.55,
  maxFactorSiesta: 1.25,
  /** Mínimo de siestas medidas para fiarse de la duración típica */
  minSiestasMedidas: 3,
  /**
   * SUEÑO NOCTURNO: si la próxima siesta proyectada cae a menos de este
   * margen de su hora de acostarse, lo previsto ya no es una siesta sino
   * el sueño largo, anclado a la hora de acostarse PERSONAL (mediana de
   * inicios del sueño nocturno, shrinkage kAcostar hacia la base por
   * edad — el acostarse es circadiano, no una ventana más).
   */
  /**
   * Margen calibrado por barrido {30..90} contra el error de TODOS los
   * inicios de sueño vespertinos (17-23h): 45-60 son el óptimo (~12 min
   * de MAE) y desde 75 las siestas tardías se marcan mal como noche
   * (MAE 17-26). 60 cubre además las noches que se adelantan.
   */
  margenAcostarMin: 60,
  kAcostar: 3,
  /** Un bloque de 3 h+ que empieza a partir de las 17:00 es "nocturno" */
  minSuenoNocturnoMin: 3 * 60,
  horaAcostarDesde: 17,
} as const

export interface Prediccion {
  /** Instante previsto (ISO). Puede estar en el pasado: "ya toca". */
  prevista: string
  /** Franja de confianza alrededor de la prevista */
  franja: { desde: string; hasta: string }
  /** Minutos desde `ahora` hasta la prevista (negativo = ya toca) */
  minutosRestantes: number
  /** Cuánto pesó el patrón observado frente a la línea base (0-1) */
  pesoPersonal: number
  /** Cuánto pesó el comportamiento de HOY frente al histórico (0-1) */
  pesoReciente: number
  /** Nº de intervalos personales usados (histórico) */
  muestras: number
  /**
   * Solo en próxima toma: cuánto moduló la CANTIDAD de la última comida
   * al intervalo (1 = neutra; <1 = comió poco, la siguiente se adelanta)
   */
  factorCantidad?: number
  /**
   * Solo en próxima toma: true si lo esperado es un REMATE — la última
   * comida quedó corta y vendrá otra toma cercana para completarla
   */
  esRemate?: boolean
  /** Solo en próxima toma: ml estimados de la siguiente (remate o ración típica) */
  mlPrevisto?: number
  /**
   * Solo en próxima siesta: cuánto moduló la duración de la ÚLTIMA
   * siesta a la ventana (<1 = siesta corta, le tocará dormir antes)
   */
  factorSiesta?: number
  /**
   * Solo en próxima siesta: true si lo previsto ya no es una siesta sino
   * el SUEÑO NOCTURNO (anclado a su hora de acostarse)
   */
  esSuenoNocturno?: boolean
}

export interface Incomodidad {
  /** 0-1: presión de "toca cambio de pañal / molestia" */
  probabilidad: number
  minutosDesdeUltimoPanal: number | null
}

export interface Predicciones {
  calculadoEn: string
  edadDias: number
  /** null si no hay ninguna toma registrada */
  proximaToma: Prediccion | null
  /** null si está durmiendo ahora mismo o no hay sueños registrados */
  proximaSiesta: Prediccion | null
  durmiendo: boolean
  incomodidad: Incomodidad
}

export interface PorQueLlora {
  sueno: number
  hambre: number
  incomodidad: number
  /** Una línea de explicación por hipótesis, la más probable primero */
  explicaciones: string[]
}

// ---- Estadística básica ----

function mediana(valores: number[]): number {
  const orden = [...valores].sort((a, b) => a - b)
  const mitad = Math.floor(orden.length / 2)
  return orden.length % 2 ? orden[mitad]! : (orden[mitad - 1]! + orden[mitad]!) / 2
}

/** Rango intercuartílico (para la franja de confianza personal) */
function iqr(valores: number[]): number {
  const orden = [...valores].sort((a, b) => a - b)
  const cuartil = (p: number) => {
    const pos = (orden.length - 1) * p
    const base = Math.floor(pos)
    const resto = pos - base
    return orden[base]! + (orden[Math.min(base + 1, orden.length - 1)]! - orden[base]!) * resto
  }
  return cuartil(0.75) - cuartil(0.25)
}

function esDeNoche(fecha: Date): boolean {
  const hora = fecha.getHours()
  return hora >= AJUSTES.horaNocheDesde || hora < AJUSTES.horaNocheHasta
}

/** Mezcla shrinkage: personal pesa n/(n+k), la base el resto */
function mezclar(
  personal: number | null,
  base: number,
  n: number,
  k: number,
): { valor: number; peso: number } {
  if (personal === null || n === 0) return { valor: base, peso: 0 }
  const peso = n / (n + k)
  return { valor: peso * personal + (1 - peso) * base, peso }
}

// ---- Aprendizaje del patrón personal ----

interface PatronIntervalo {
  medianaMin: number | null
  iqrMin: number | null
  n: number
}

function patronDe(intervalos: number[]): PatronIntervalo {
  if (intervalos.length === 0) return { medianaMin: null, iqrMin: null, n: 0 }
  return { medianaMin: mediana(intervalos), iqrMin: iqr(intervalos), n: intervalos.length }
}

/**
 * Mediana de los últimos `maxRecientes` intervalos dentro de la ventana
 * actual. Los intervalos que ARRANCAN en la otra franja (p. ej. el hueco
 * del amanecer entre la toma nocturna y la primera de la mañana) se
 * excluyen: no representan la cadencia del día y con pocas muestras
 * sesgarían la capa (lo detectó el backtest del brote de crecimiento).
 */
function patronReciente(
  conFin: { finMs: number; intervalo: number; cruzaFranja: boolean }[],
  ahora: Date,
): PatronIntervalo {
  const desde = ahora.getTime() - AJUSTES.ventanaRecienteHoras * 3600_000
  const recientes = conFin
    .filter((x) => x.finMs >= desde && !x.cruzaFranja)
    .slice(-AJUSTES.maxRecientes)
    .map((x) => x.intervalo)
  return patronDe(recientes)
}

/**
 * Intervalos entre inicios de toma consecutivos, separados en día/noche,
 * con la sub-capa "reciente" (los últimos de hoy) por franja.
 */
export function intervalosToma(
  tomas: Toma[],
  ahora: Date,
): {
  dia: PatronIntervalo
  noche: PatronIntervalo
  recienteDia: PatronIntervalo
  recienteNoche: PatronIntervalo
} {
  const desde = ahora.getTime() - AJUSTES.historicoDias * 86_400_000
  const inicios = tomas
    .map((t) => new Date(t.inicio).getTime())
    .filter((t) => t >= desde && t <= ahora.getTime())
    .sort((a, b) => a - b)
  const dia: { finMs: number; intervalo: number; cruzaFranja: boolean }[] = []
  const noche: { finMs: number; intervalo: number; cruzaFranja: boolean }[] = []
  for (let i = 1; i < inicios.length; i++) {
    const intervalo = (inicios[i]! - inicios[i - 1]!) / 60_000
    // El intervalo se clasifica por la franja en la que TERMINA (la toma
    // que estamos "prediciendo" en ese punto del pasado)
    const enNoche = esDeNoche(new Date(inicios[i]!))
    const cruzaFranja = esDeNoche(new Date(inicios[i - 1]!)) !== enNoche
    const tope = enNoche ? AJUSTES.maxIntervaloTomaNocheMin : AJUSTES.maxIntervaloTomaDiaMin
    if (intervalo < AJUSTES.minIntervaloTomaMin || intervalo > tope) continue
    ;(enNoche ? noche : dia).push({ finMs: inicios[i]!, intervalo, cruzaFranja })
  }
  // Los intervalos que cruzan franja (el hueco del amanecer, el salto
  // tarde→noche) tampoco representan la cadencia del HISTORICO de su
  // franja: inflaban la mediana de día y deflactaban la de noche
  return {
    dia: patronDe(dia.filter((x) => !x.cruzaFranja).map((x) => x.intervalo)),
    noche: patronDe(noche.filter((x) => !x.cruzaFranja).map((x) => x.intervalo)),
    recienteDia: patronReciente(dia, ahora),
    recienteNoche: patronReciente(noche, ahora),
  }
}

/**
 * Bloques de sueño CONSOLIDADOS del histórico: tramos separados por un
 * mini-despertar (< miniDespertarMin) se funden en uno. Base compartida
 * de las ventanas de vigilia, la siesta típica y la hora de acostarse.
 */
function bloquesSueno(suenos: Sueno[], ahora: Date): { inicio: number; fin: number }[] {
  const desde = ahora.getTime() - AJUSTES.historicoDias * 86_400_000
  const tramos = suenos
    .filter((s) => s.fin !== null)
    .map((s) => ({ inicio: new Date(s.inicio).getTime(), fin: new Date(s.fin!).getTime() }))
    .filter((s) => s.fin >= desde && s.fin <= ahora.getTime())
    .sort((a, b) => a.inicio - b.inicio)
  const bloques: { inicio: number; fin: number }[] = []
  for (const tramo of tramos) {
    const ultimo = bloques[bloques.length - 1]
    if (ultimo && (tramo.inicio - ultimo.fin) / 60_000 < AJUSTES.miniDespertarMin) {
      ultimo.fin = Math.max(ultimo.fin, tramo.fin)
    } else {
      bloques.push({ ...tramo })
    }
  }
  return bloques
}

/** ¿El bloque es una SIESTA diurna? (empieza de día y no dura como una noche) */
function esSiestaDiurna(bloque: { inicio: number; fin: number }): boolean {
  return (
    !esDeNoche(new Date(bloque.inicio)) &&
    (bloque.fin - bloque.inicio) / 60_000 < AJUSTES.minSuenoNocturnoMin
  )
}

/** Duración típica de sus siestas (mediana de bloques diurnos), o null */
function duracionSiestaTipica(bloques: { inicio: number; fin: number }[]): number | null {
  const duraciones = bloques.filter(esSiestaDiurna).map((b) => (b.fin - b.inicio) / 60_000)
  if (duraciones.length < AJUSTES.minSiestasMedidas) return null
  return mediana(duraciones)
}

/**
 * Hora de acostarse PERSONAL: mediana (y dispersión) del minuto del día
 * en que empiezan sus sueños nocturnos (bloques de 3 h+ iniciados a
 * partir de las 17:00).
 */
function horaAcostarPersonal(bloques: { inicio: number; fin: number }[]): PatronIntervalo {
  const minutos = bloques
    .filter((b) => {
      const inicio = new Date(b.inicio)
      return (
        inicio.getHours() >= AJUSTES.horaAcostarDesde &&
        (b.fin - b.inicio) / 60_000 >= AJUSTES.minSuenoNocturnoMin
      )
    })
    .map((b) => {
      const inicio = new Date(b.inicio)
      return inicio.getHours() * 60 + inicio.getMinutes()
    })
  return patronDe(minutos)
}

/**
 * Factor de la última siesta: <1 si fue más corta que su típica (menos
 * restauradora → la siguiente ventana se acorta), >1 si fue más larga.
 */
function factorSiestaDe(
  bloques: { inicio: number; fin: number }[],
  ultimoFinMs: number,
): { factor: number; aplicado: boolean } {
  const ultimoBloque = bloques.filter((b) => b.fin <= ultimoFinMs).pop()
  const tipica = duracionSiestaTipica(bloques)
  if (!ultimoBloque || tipica === null || !esSiestaDiurna(ultimoBloque)) {
    return { factor: 1, aplicado: false }
  }
  const duracion = (ultimoBloque.fin - ultimoBloque.inicio) / 60_000
  const cociente = Math.min(
    AJUSTES.maxFactorSiesta,
    Math.max(AJUSTES.minFactorSiesta, duracion / tipica),
  )
  return { factor: 1 + AJUSTES.sensibilidadSiesta * (cociente - 1), aplicado: true }
}

/**
 * Ventanas de vigilia reales (fin de un sueño → inicio del siguiente).
 * Los tramos separados por un MINI-DESPERTAR (< miniDespertarMin) se
 * consolidan antes en un mismo bloque: despertarse 10-20 min y volver a
 * dormirse no es una ventana de vigilia y rompería la mediana.
 */
export function ventanasVigilia(
  suenos: Sueno[],
  ahora: Date,
): { historico: PatronIntervalo; reciente: PatronIntervalo } {
  const bloques = bloquesSueno(suenos, ahora)
  const ventanas: { finMs: number; intervalo: number; cruzaFranja: boolean }[] = []
  for (let i = 1; i < bloques.length; i++) {
    const ventana = (bloques[i]!.inicio - bloques[i - 1]!.fin) / 60_000
    // Solo ventanas diurnas: un despertar nocturno con vuelta a dormir
    // no es una "ventana de vigilia" comparable
    if (esDeNoche(new Date(bloques[i - 1]!.fin))) continue
    if (ventana < AJUSTES.minVentanaVigiliaMin || ventana > AJUSTES.maxVentanaVigiliaMin) continue
    ventanas.push({ finMs: bloques[i]!.inicio, intervalo: ventana, cruzaFranja: false })
  }
  return {
    historico: patronDe(ventanas.map((x) => x.intervalo)),
    reciente: patronReciente(ventanas, ahora),
  }
}

/** Intervalos entre cambios de pañal (solo día, el ritmo nocturno es otro) */
export function intervalosPanal(panales: Panal[], ahora: Date): PatronIntervalo {
  const desde = ahora.getTime() - AJUSTES.historicoDias * 86_400_000
  const fechas = panales
    .map((p) => new Date(p.fecha).getTime())
    .filter((f) => f >= desde && f <= ahora.getTime())
    .sort((a, b) => a - b)
  const intervalos: number[] = []
  for (let i = 1; i < fechas.length; i++) {
    if (esDeNoche(new Date(fechas[i]!))) continue
    const intervalo = (fechas[i]! - fechas[i - 1]!) / 60_000
    if (intervalo < AJUSTES.minIntervaloPanalMin || intervalo > AJUSTES.maxIntervaloPanalMin)
      continue
    intervalos.push(intervalo)
  }
  return patronDe(intervalos)
}

// ---- Predicción ----

function construirPrediccion(
  anclaMs: number,
  esperadoMin: number,
  bandaMin: number,
  peso: number,
  pesoReciente: number,
  muestras: number,
  ahora: Date,
): Prediccion {
  const previstaMs = anclaMs + esperadoMin * 60_000
  const desdeMs = previstaMs - bandaMin * 60_000
  const hastaMs = previstaMs + bandaMin * 60_000
  return {
    prevista: new Date(previstaMs).toISOString(),
    franja: { desde: new Date(desdeMs).toISOString(), hasta: new Date(hastaMs).toISOString() },
    minutosRestantes: Math.round((previstaMs - ahora.getTime()) / 60_000),
    pesoPersonal: Math.round(peso * 100) / 100,
    pesoReciente: Math.round(pesoReciente * 100) / 100,
    muestras,
  }
}

/**
 * Mezcla en tres capas: histórico↔base con shrinkage (como siempre) y,
 * encima, el comportamiento RECIENTE (los últimos intervalos de hoy)
 * con su propio shrinkage wR = nR/(nR+kReciente).
 */
function mezclarTresCapas(
  reciente: PatronIntervalo,
  historico: PatronIntervalo,
  baseCentro: number,
  k: number,
): { valor: number; pesoPersonal: number; pesoReciente: number } {
  const historicoBase = mezclar(historico.medianaMin, baseCentro, historico.n, k)
  if (reciente.medianaMin === null || reciente.n === 0) {
    return { valor: historicoBase.valor, pesoPersonal: historicoBase.peso, pesoReciente: 0 }
  }
  const wR = reciente.n / (reciente.n + AJUSTES.kReciente)
  return {
    valor: wR * reciente.medianaMin + (1 - wR) * historicoBase.valor,
    pesoPersonal: historicoBase.peso,
    pesoReciente: wR,
  }
}

/**
 * Última toma que NO esté en el futuro. Con la hora editable en los
 * registros rápidos, una toma guardada por error con hora futura no debe
 * anclar la predicción (el aprendizaje ya filtraba; el ancla también).
 */
function ultimaTomaAntesDe(tomas: Toma[], ahora: Date): Toma | undefined {
  return tomas
    .filter((t) => new Date(t.inicio).getTime() <= ahora.getTime())
    .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())[0]
}

/**
 * COMIDAS consolidadas: tomas separadas por menos de minIntervaloTomaMin
 * forman una misma comida (toma corta + su remate = una ración). mlTotal
 * suma los ml conocidos (null si ninguna toma de la comida los tiene).
 */
interface Comida {
  /** Inicio de la última toma de la comida (ancla de proyección) */
  inicioUltimaMs: number
  mlTotal: number | null
  tomas: number
}

function comidasDe(tomas: Toma[], ahora: Date): Comida[] {
  const desde = ahora.getTime() - AJUSTES.historicoDias * 86_400_000
  const orden = tomas
    .map((t) => ({ inicioMs: new Date(t.inicio).getTime(), ml: t.cantidad_ml }))
    .filter((t) => t.inicioMs >= desde && t.inicioMs <= ahora.getTime())
    .sort((a, b) => a.inicioMs - b.inicioMs)
  const comidas: Comida[] = []
  for (const toma of orden) {
    const ultima = comidas[comidas.length - 1]
    if (ultima && (toma.inicioMs - ultima.inicioUltimaMs) / 60_000 < AJUSTES.minIntervaloTomaMin) {
      ultima.inicioUltimaMs = toma.inicioMs
      ultima.tomas += 1
      if (toma.ml !== null) ultima.mlTotal = (ultima.mlTotal ?? 0) + toma.ml
    } else {
      comidas.push({ inicioUltimaMs: toma.inicioMs, mlTotal: toma.ml, tomas: 1 })
    }
  }
  return comidas
}

/** Ración típica: mediana de ml por COMIDA completa, o null con pocas */
function mlTipicoComidas(comidas: Comida[]): number | null {
  const mls = comidas.filter((c) => c.mlTotal !== null).map((c) => c.mlTotal!)
  if (mls.length < AJUSTES.minTomasConMl) return null
  return mediana(mls)
}

/**
 * Patrón de REMATE observado: huecos entre tomas consecutivas de una
 * misma comida (10 min a minIntervaloTomaMin). Con historial propio, el
 * remate se predice con SU cadencia; sin él, con el prior de AJUSTES.
 */
function patronRemate(tomas: Toma[], ahora: Date): PatronIntervalo {
  const desde = ahora.getTime() - AJUSTES.historicoDias * 86_400_000
  const inicios = tomas
    .map((t) => new Date(t.inicio).getTime())
    .filter((t) => t >= desde && t <= ahora.getTime())
    .sort((a, b) => a - b)
  const gaps: number[] = []
  for (let i = 1; i < inicios.length; i++) {
    const gap = (inicios[i]! - inicios[i - 1]!) / 60_000
    if (gap >= 10 && gap < AJUSTES.minIntervaloTomaMin) gaps.push(gap)
  }
  return patronDe(gaps)
}

/**
 * Factor de cantidad de la última COMIDA: <1 si comió menos de lo
 * habitual (la siguiente se adelanta), >1 si comió de más. 1 sin ml o
 * sin mediana fiable.
 */
function factorCantidadDe(mlComida: number | null, tipico: number | null): number {
  if (mlComida === null || tipico === null || tipico <= 0) return 1
  const cociente = Math.min(
    AJUSTES.maxFactorCantidad,
    Math.max(AJUSTES.minFactorCantidad, mlComida / tipico),
  )
  return 1 + AJUSTES.sensibilidadCantidad * (cociente - 1)
}

/** ¿Hay un sueño en curso? (fin null, empezado en las últimas 24 h) */
function suenoEnCurso(suenos: Sueno[], ahora: Date): Sueno | null {
  const hace24h = ahora.getTime() - 24 * 3600_000
  return (
    suenos.find(
      (s) =>
        s.fin === null &&
        new Date(s.inicio).getTime() >= hace24h &&
        new Date(s.inicio).getTime() <= ahora.getTime(),
    ) ?? null
  )
}

function centro(rango: RangoMin): number {
  return (rango.min + rango.max) / 2
}

function semiancho(rango: RangoMin): number {
  return (rango.max - rango.min) / 2
}

/**
 * Predicción completa: próxima toma, próxima siesta e incomodidad.
 * `ahora` se inyecta para poder testear y backtestear.
 */
export function predecir(datos: DatosPredictor, edadDias: number, ahora: Date): Predicciones {
  const etapa = etapaPrediccion(edadDias)
  const nocheAhora = esDeNoche(ahora)

  // --- Próxima toma ---
  let proximaToma: Prediccion | null = null
  const ultimaToma = ultimaTomaAntesDe(datos.tomas, ahora)
  if (ultimaToma) {
    const comidas = comidasDe(datos.tomas, ahora)
    const ultimaComida = comidas[comidas.length - 1]
    const tipico = mlTipicoComidas(comidas)
    const remate = patronRemate(datos.tomas, ahora)
    // Gap y banda del remate, calculados ANTES del if: también deciden
    // su caducidad
    const gapRemate = mezclar(
      remate.medianaMin,
      AJUSTES.gapRematePriorMin,
      remate.n,
      AJUSTES.kRemate,
    )
    const bandaRemate = mezclar(
      remate.iqrMin,
      AJUSTES.bandaRematePriorMin,
      remate.n,
      AJUSTES.kRemate,
    ).valor

    if (
      ultimaComida !== undefined &&
      ultimaComida.mlTotal !== null &&
      tipico !== null &&
      ultimaComida.mlTotal < AJUSTES.umbralTomaCorta * tipico &&
      // Según COMPORTAMIENTO: solo si la bebé ha demostrado que remata
      remate.n >= AJUSTES.minRematesObservados &&
      // CADUCIDAD: el remate es una toma CERCANA. Pasada su ventana
      // (gap + banda personales, con el mínimo de AJUSTES), lo esperable
      // ya no es un remate anclado horas atrás sino la cadencia normal
      // adelantada por factorCantidad
      ahora.getTime() <=
        new Date(ultimaToma.inicio).getTime() +
          Math.max(gapRemate.valor + bandaRemate, AJUSTES.caducidadRemateMin) * 60_000
    ) {
      // Modo REMATE: la comida quedó corta → lo esperable no es la
      // cadencia normal adelantada, sino otra toma CERCANA que la
      // complete; después la cadencia se retoma desde el remate
      const resto = tipico - ultimaComida.mlTotal
      proximaToma = {
        ...construirPrediccion(
          new Date(ultimaToma.inicio).getTime(),
          gapRemate.valor,
          bandaRemate,
          gapRemate.peso,
          0,
          remate.n,
          ahora,
        ),
        esRemate: true,
        mlPrevisto: Math.round(Math.max(AJUSTES.mlMinimoRemate, Math.min(tipico, resto)) / 5) * 5,
      }
    } else {
      const patrones = intervalosToma(datos.tomas, ahora)
      const patron = nocheAhora ? patrones.noche : patrones.dia
      const reciente = nocheAhora ? patrones.recienteNoche : patrones.recienteDia
      const baseRango = nocheAhora ? etapa.intervaloTomaNoche : etapa.intervaloToma
      const { valor, pesoPersonal, pesoReciente } = mezclarTresCapas(
        reciente,
        patron,
        centro(baseRango),
        AJUSTES.kToma,
      )
      // Semiancho personal = 1.0·IQR ≈ ±1.35σ en una normal (cobertura
      // ~80% teórica). Recalibrado por backtest al excluir cruzaFranja
      // del histórico: el IQR dejó de estar inflado por los huecos del
      // amanecer y con 0.75 la cobertura real caía al ~50%
      const banda = mezclar(
        patron.iqrMin === null ? null : patron.iqrMin,
        semiancho(baseRango),
        patron.n,
        AJUSTES.kToma,
      ).valor
      // La cantidad de la última COMIDA modula el intervalo: comió algo
      // menos → pedirá antes; comió de más → aguantará algo más
      const factorCantidad = factorCantidadDe(ultimaComida?.mlTotal ?? null, tipico)
      proximaToma = {
        ...construirPrediccion(
          new Date(ultimaToma.inicio).getTime(),
          valor * factorCantidad,
          banda,
          pesoPersonal,
          pesoReciente,
          patron.n,
          ahora,
        ),
        factorCantidad: Math.round(factorCantidad * 100) / 100,
        esRemate: false,
        mlPrevisto: tipico === null ? undefined : Math.round(tipico / 5) * 5,
      }
    }
  }

  // --- Próxima siesta ---
  const durmiendo = suenoEnCurso(datos.suenos, ahora) !== null
  let proximaSiesta: Prediccion | null = null
  const ultimoFin = datos.suenos
    .filter((s) => s.fin !== null)
    .map((s) => new Date(s.fin!).getTime())
    .filter((f) => f <= ahora.getTime())
    .sort((a, b) => b - a)[0]
  if (!durmiendo && ultimoFin !== undefined) {
    const patrones = ventanasVigilia(datos.suenos, ahora)
    const { valor, pesoPersonal, pesoReciente } = mezclarTresCapas(
      patrones.reciente,
      patrones.historico,
      centro(etapa.ventanaVigilia),
      AJUSTES.kSueno,
    )
    // Aquí sigue 0.75·IQR: las ventanas de vigilia nunca incluyeron
    // intervalos que cruzan franja (el IQR no estaba inflado), así que la
    // recalibración de la banda de tomas no aplica
    const banda = mezclar(
      patrones.historico.iqrMin === null ? null : patrones.historico.iqrMin * 0.75,
      semiancho(etapa.ventanaVigilia),
      patrones.historico.n,
      AJUSTES.kSueno,
    ).valor
    // SIESTA CORTA: si la última siesta restauró menos, la ventana se acorta
    const bloques = bloquesSueno(datos.suenos, ahora)
    const { factor: factorSiesta, aplicado } = factorSiestaDe(bloques, ultimoFin)
    const previstaMs = ultimoFin + valor * factorSiesta * 60_000

    // SUEÑO NOCTURNO: de día, si la proyección cae pegada a su hora de
    // acostarse, lo previsto ya es el sueño largo (ancla circadiana)
    let nocturno = false
    if (!nocheAhora) {
      const acostar = horaAcostarPersonal(bloques)
      const acostarMezcla = mezclar(
        acostar.medianaMin,
        centro(etapa.horaAcostar),
        acostar.n,
        AJUSTES.kAcostar,
      )
      // Con la API de calendario, no sumando ms a la medianoche: la
      // mezcla son minutos DE RELOJ (1230 = "las 20:30") y en los días
      // de cambio de hora (23/25 h) la suma directa desplazaría el
      // ancla nocturna una hora
      const acostarHoy = new Date(ahora)
      acostarHoy.setHours(
        Math.floor(acostarMezcla.valor / 60),
        Math.round(acostarMezcla.valor % 60),
        0,
        0,
      )
      const acostarHoyMs = acostarHoy.getTime()
      // En zona de acostarse por proyección O por hora actual: la última
      // ventana del día es la más larga (una siesta proyectada "pendiente"
      // al caer la tarde suele ser, en realidad, el sueño nocturno)
      if (
        Math.max(previstaMs, ahora.getTime()) >=
        acostarHoyMs - AJUSTES.margenAcostarMin * 60_000
      ) {
        nocturno = true
        const bandaAcostar = mezclar(
          acostar.iqrMin === null ? null : acostar.iqrMin * 0.75,
          semiancho(etapa.horaAcostar),
          acostar.n,
          AJUSTES.kAcostar,
        ).valor
        proximaSiesta = {
          ...construirPrediccion(
            ultimoFin,
            (acostarHoyMs - ultimoFin) / 60_000,
            bandaAcostar,
            acostarMezcla.peso,
            0,
            acostar.n,
            ahora,
          ),
          esSuenoNocturno: true,
        }
      }
    }
    if (!nocturno) {
      proximaSiesta = {
        ...construirPrediccion(
          ultimoFin,
          valor * factorSiesta,
          banda,
          pesoPersonal,
          pesoReciente,
          patrones.historico.n,
          ahora,
        ),
        esSuenoNocturno: false,
        ...(aplicado ? { factorSiesta: Math.round(factorSiesta * 100) / 100 } : {}),
      }
    }
  }

  // --- Incomodidad (presión de pañal/molestia) ---
  const ultimoPanal = datos.panales
    .filter((p) => new Date(p.fecha).getTime() <= ahora.getTime())
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0]
  let incomodidad: Incomodidad = { probabilidad: 0.1, minutosDesdeUltimoPanal: null }
  if (ultimoPanal) {
    const minutos = Math.round((ahora.getTime() - new Date(ultimoPanal.fecha).getTime()) / 60_000)
    const patron = intervalosPanal(datos.panales, ahora)
    // Intervalo esperado: minutos de día (07-21h ≈ 840) entre los cambios típicos
    const baseIntervalo = 840 / Math.max(1, etapa.panalesDia - 1)
    const { valor: esperado } = mezclar(patron.medianaMin, baseIntervalo, patron.n, AJUSTES.kPanal)
    // Curva suave: 0.1 hasta el 60% del intervalo, sube hasta 0.9 al 180%
    const razon = minutos / esperado
    const probabilidad = Math.min(0.9, Math.max(0.1, 0.1 + ((razon - 0.6) / 1.2) * 0.8))
    incomodidad = {
      probabilidad: Math.round(probabilidad * 100) / 100,
      minutosDesdeUltimoPanal: minutos,
    }
  }

  return {
    calculadoEn: ahora.toISOString(),
    edadDias,
    proximaToma,
    proximaSiesta,
    durmiendo,
    incomodidad,
  }
}

/** ¿Es de noche (21:00-07:00) a esa hora? Para la UI de Ñeñeñi. */
export function esHoraNocturna(fecha: Date): boolean {
  return esDeNoche(fecha)
}

export interface PronosticoNoche {
  /** Intervalo nocturno esperado entre tomas (minutos, mezcla 3 capas) */
  intervaloMin: number
  /** Tomas previstas entre ahora y las 07:00 (ISO) */
  tomas: string[]
  pesoPersonal: number
  pesoReciente: number
}

/**
 * Pronóstico de la noche: cuántas tomas quedan hasta las 07:00 y a qué
 * horas, proyectando la cadencia NOCTURNA (mezcla base ← histórico ←
 * reciente) desde la última toma. Solo tiene sentido en franja nocturna;
 * devuelve null si no es de noche o no hay tomas.
 */
export function pronosticoNoche(
  datos: DatosPredictor,
  edadDias: number,
  ahora: Date,
): PronosticoNoche | null {
  if (!esDeNoche(ahora)) return null
  const ultimaToma = ultimaTomaAntesDe(datos.tomas, ahora)
  if (!ultimaToma) return null

  const etapa = etapaPrediccion(edadDias)
  const patrones = intervalosToma(datos.tomas, ahora)
  const { valor, pesoPersonal, pesoReciente } = mezclarTresCapas(
    patrones.recienteNoche,
    patrones.noche,
    centro(etapa.intervaloTomaNoche),
    AJUSTES.kToma,
  )

  // Fin de la noche: las 07:00 siguientes a `ahora`
  const finNoche = new Date(ahora)
  finNoche.setHours(AJUSTES.horaNocheHasta, 0, 0, 0)
  if (finNoche.getTime() <= ahora.getTime()) finNoche.setDate(finNoche.getDate() + 1)

  // Primer eslabón: si la última toma fue DIURNA (recién entrada la
  // noche), la siguiente aún sigue la cadencia de día — proyectar el
  // salto entero con el intervalo nocturno se saltaría esa toma
  const primerPaso = esDeNoche(new Date(ultimaToma.inicio))
    ? valor
    : mezclarTresCapas(
        patrones.recienteDia,
        patrones.dia,
        centro(etapa.intervaloToma),
        AJUSTES.kToma,
      ).valor

  // Proyectar desde la última toma; a partir de ahí, cadencia nocturna
  const tomas: string[] = []
  let t = new Date(ultimaToma.inicio).getTime() + primerPaso * 60_000
  // Si la prevista ya pasó, la siguiente cuenta desde ahora ("ya toca")
  if (t < ahora.getTime()) t = ahora.getTime()
  while (t < finNoche.getTime() && tomas.length < 8) {
    tomas.push(new Date(t).toISOString())
    t += valor * 60_000
  }

  return {
    intervaloMin: Math.round(valor),
    tomas,
    pesoPersonal: Math.round(pesoPersonal * 100) / 100,
    pesoReciente: Math.round(pesoReciente * 100) / 100,
  }
}

/**
 * ¿Por qué llora? — reparto de probabilidad entre Sueño, Hambre e
 * Incomodidad según la "presión" de cada necesidad (tiempo transcurrido
 * frente a lo esperado), pasada por un softmax con temperatura calibrada.
 */
export function porQueLlora(datos: DatosPredictor, edadDias: number, ahora: Date): PorQueLlora {
  const prediccion = predecir(datos, edadDias, ahora)
  const etapa = etapaPrediccion(edadDias)

  // Presión de cada necesidad: 1.0 = "ya le tocaría ahora mismo"
  const presionDe = (p: Prediccion | null, esperadoBase: number): number => {
    if (!p) return 0.6 // sin datos: presión neutra tirando a baja
    const esperadoMin = Math.max(30, esperadoBase)
    return 1 + -p.minutosRestantes / esperadoMin // resta → pasado = presión > 1
  }

  let presionSueno = presionDe(prediccion.proximaSiesta, centro(etapa.ventanaVigilia))
  if (prediccion.durmiendo) presionSueno = 0 // durmiendo: el sueño no es la causa
  // La presión se normaliza con el intervalo de la MISMA franja que usó la
  // predicción: de noche el esperado es ~el doble y cada minuto de retraso
  // no puede contar el doble en el softmax
  const rangoTomaAhora = esDeNoche(ahora) ? etapa.intervaloTomaNoche : etapa.intervaloToma
  const presionHambre = presionDe(prediccion.proximaToma, centro(rangoTomaAhora))
  // La incomodidad ya es una probabilidad 0-1: se escala a presión comparable
  const presionIncomodidad = 0.35 + prediccion.incomodidad.probabilidad * 0.9

  const T = AJUSTES.temperaturaLlanto
  const expS = Math.exp(presionSueno / T)
  const expH = Math.exp(presionHambre / T)
  const expI = Math.exp(presionIncomodidad / T)
  const total = expS + expH + expI

  const sueno = expS / total
  const hambre = expH / total
  const incomodidad = expI / total

  const partes: { clave: keyof Omit<PorQueLlora, 'explicaciones'>; p: number; texto: string }[] = [
    {
      clave: 'sueno',
      p: sueno,
      texto: prediccion.durmiendo
        ? 'Está durmiendo: el sueño no parece la causa'
        : prediccion.proximaSiesta
          ? `Lleva despierta desde hace un rato (siesta prevista ${prediccion.proximaSiesta.minutosRestantes <= 0 ? 'ya pasada' : `en ${prediccion.proximaSiesta.minutosRestantes} min`})`
          : 'Sin sueños registrados para afinar',
    },
    {
      clave: 'hambre',
      p: hambre,
      texto: prediccion.proximaToma
        ? prediccion.proximaToma.minutosRestantes <= 0
          ? 'La siguiente toma ya tocaba'
          : `La siguiente toma se espera en ${prediccion.proximaToma.minutosRestantes} min`
        : 'Sin tomas registradas para afinar',
    },
    {
      clave: 'incomodidad',
      p: incomodidad,
      texto:
        prediccion.incomodidad.minutosDesdeUltimoPanal === null
          ? 'Sin pañales registrados para afinar'
          : `Último pañal hace ${Math.floor(prediccion.incomodidad.minutosDesdeUltimoPanal / 60)} h ${prediccion.incomodidad.minutosDesdeUltimoPanal % 60} min`,
    },
  ]
  partes.sort((a, b) => b.p - a.p)

  return {
    sueno: Math.round(sueno * 100) / 100,
    hambre: Math.round(hambre * 100) / 100,
    incomodidad: Math.round(incomodidad * 100) / 100,
    explicaciones: partes.map((parte) => parte.texto),
  }
}

/**
 * Aplana unas Predicciones a la fila de la tabla `predicciones` (sin
 * bebe_id, que lo pone el servicio). Los parámetros aprendidos van en
 * `parametros` para poder inspeccionar el cálculo a posteriori.
 */
export function aFilaPrediccion(p: Predicciones): {
  calculado_en: string
  edad_dias: number
  proxima_toma: string | null
  proxima_toma_desde: string | null
  proxima_toma_hasta: string | null
  proxima_siesta: string | null
  proxima_siesta_desde: string | null
  proxima_siesta_hasta: string | null
  durmiendo: boolean
  incomodidad_prob: number | null
  parametros: Record<string, unknown>
} {
  return {
    calculado_en: p.calculadoEn,
    edad_dias: p.edadDias,
    proxima_toma: p.proximaToma?.prevista ?? null,
    proxima_toma_desde: p.proximaToma?.franja.desde ?? null,
    proxima_toma_hasta: p.proximaToma?.franja.hasta ?? null,
    proxima_siesta: p.proximaSiesta?.prevista ?? null,
    proxima_siesta_desde: p.proximaSiesta?.franja.desde ?? null,
    proxima_siesta_hasta: p.proximaSiesta?.franja.hasta ?? null,
    durmiendo: p.durmiendo,
    incomodidad_prob: p.incomodidad.probabilidad,
    parametros: {
      ajustes: AJUSTES,
      pesoPersonalToma: p.proximaToma?.pesoPersonal ?? null,
      pesoRecienteToma: p.proximaToma?.pesoReciente ?? null,
      factorCantidadToma: p.proximaToma?.factorCantidad ?? null,
      esRemateToma: p.proximaToma?.esRemate ?? null,
      mlPrevistoToma: p.proximaToma?.mlPrevisto ?? null,
      muestrasToma: p.proximaToma?.muestras ?? null,
      pesoPersonalSiesta: p.proximaSiesta?.pesoPersonal ?? null,
      pesoRecienteSiesta: p.proximaSiesta?.pesoReciente ?? null,
      factorSiesta: p.proximaSiesta?.factorSiesta ?? null,
      esSuenoNocturno: p.proximaSiesta?.esSuenoNocturno ?? null,
      muestrasSiesta: p.proximaSiesta?.muestras ?? null,
    },
  }
}
