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
  /** Nº de intervalos personales usados */
  muestras: number
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

/** Intervalos entre inicios de toma consecutivos, separados en día/noche */
export function intervalosToma(
  tomas: Toma[],
  ahora: Date,
): { dia: PatronIntervalo; noche: PatronIntervalo } {
  const desde = ahora.getTime() - AJUSTES.historicoDias * 86_400_000
  const inicios = tomas
    .map((t) => new Date(t.inicio).getTime())
    .filter((t) => t >= desde && t <= ahora.getTime())
    .sort((a, b) => a - b)
  const dia: number[] = []
  const noche: number[] = []
  for (let i = 1; i < inicios.length; i++) {
    const intervalo = (inicios[i]! - inicios[i - 1]!) / 60_000
    // El intervalo se clasifica por la franja en la que TERMINA (la toma
    // que estamos "prediciendo" en ese punto del pasado)
    const enNoche = esDeNoche(new Date(inicios[i]!))
    const tope = enNoche ? AJUSTES.maxIntervaloTomaNocheMin : AJUSTES.maxIntervaloTomaDiaMin
    if (intervalo < AJUSTES.minIntervaloTomaMin || intervalo > tope) continue
    ;(enNoche ? noche : dia).push(intervalo)
  }
  return { dia: patronDe(dia), noche: patronDe(noche) }
}

/** Ventanas de vigilia reales: fin de un sueño → inicio del siguiente */
export function ventanasVigilia(suenos: Sueno[], ahora: Date): PatronIntervalo {
  const desde = ahora.getTime() - AJUSTES.historicoDias * 86_400_000
  const tramos = suenos
    .filter((s) => s.fin !== null)
    .map((s) => ({ inicio: new Date(s.inicio).getTime(), fin: new Date(s.fin!).getTime() }))
    .filter((s) => s.fin >= desde && s.fin <= ahora.getTime())
    .sort((a, b) => a.inicio - b.inicio)
  const ventanas: number[] = []
  for (let i = 1; i < tramos.length; i++) {
    const ventana = (tramos[i]!.inicio - tramos[i - 1]!.fin) / 60_000
    // Solo ventanas diurnas: un despertar nocturno con vuelta a dormir
    // no es una "ventana de vigilia" comparable
    if (esDeNoche(new Date(tramos[i - 1]!.fin))) continue
    if (ventana < AJUSTES.minVentanaVigiliaMin || ventana > AJUSTES.maxVentanaVigiliaMin) continue
    ventanas.push(ventana)
  }
  return patronDe(ventanas)
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
    muestras,
  }
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
  const ultimaToma = [...datos.tomas].sort(
    (a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime(),
  )[0]
  if (ultimaToma) {
    const patrones = intervalosToma(datos.tomas, ahora)
    const patron = nocheAhora ? patrones.noche : patrones.dia
    const baseRango = nocheAhora ? etapa.intervaloTomaNoche : etapa.intervaloToma
    const { valor, peso } = mezclar(patron.medianaMin, centro(baseRango), patron.n, AJUSTES.kToma)
    // Semiancho personal = 0.75·IQR ≈ ±1σ en una normal (cobertura ~70%);
    // IQR/2 solo cubriría el 50% por definición (lo detectó el backtest)
    const banda = mezclar(
      patron.iqrMin === null ? null : patron.iqrMin * 0.75,
      semiancho(baseRango),
      patron.n,
      AJUSTES.kToma,
    ).valor
    proximaToma = construirPrediccion(
      new Date(ultimaToma.inicio).getTime(),
      valor,
      banda,
      peso,
      patron.n,
      ahora,
    )
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
    const patron = ventanasVigilia(datos.suenos, ahora)
    const { valor, peso } = mezclar(
      patron.medianaMin,
      centro(etapa.ventanaVigilia),
      patron.n,
      AJUSTES.kSueno,
    )
    const banda = mezclar(
      patron.iqrMin === null ? null : patron.iqrMin * 0.75,
      semiancho(etapa.ventanaVigilia),
      patron.n,
      AJUSTES.kSueno,
    ).valor
    proximaSiesta = construirPrediccion(ultimoFin, valor, banda, peso, patron.n, ahora)
  }

  // --- Incomodidad (presión de pañal/molestia) ---
  const ultimoPanal = [...datos.panales].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  )[0]
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
  if (prediccion.durmiendo) presionSueno = 0.15 // durmiendo: el sueño no es la causa
  const presionHambre = presionDe(prediccion.proximaToma, centro(etapa.intervaloToma))
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
          : `Último pañal hace ${Math.round(prediccion.incomodidad.minutosDesdeUltimoPanal / 60)} h ${prediccion.incomodidad.minutosDesdeUltimoPanal % 60} min`,
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
      muestrasToma: p.proximaToma?.muestras ?? null,
      pesoPersonalSiesta: p.proximaSiesta?.pesoPersonal ?? null,
      muestrasSiesta: p.proximaSiesta?.muestras ?? null,
    },
  }
}
