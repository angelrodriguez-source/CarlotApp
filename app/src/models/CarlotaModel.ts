/**
 * CarlotaModel.ts — Lógica pura del dominio (sin DOM, sin red, sin Supabase)
 *
 * Todo lo calculable a partir de datos vive aquí: edad, duraciones,
 * agrupaciones por día, resúmenes. Es lo único que se testea con Vitest
 * (src/models/__tests__/).
 */
import {
  ETIQUETAS_CANTIDAD_PANAL,
  ETIQUETAS_EVENTO,
  ETIQUETAS_PANAL,
  ETIQUETAS_TOMA,
  type Evento,
  type Panal,
  type Sueno,
  type Toma,
} from '../types'
import { REFERENCIA_OMS_NINAS } from './referenciaOMS'

/** Clave de día local 'YYYY-MM-DD' de una fecha ISO (zona del usuario) */
export function claveDia(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE')
}

/** Hoy en la zona del usuario, como 'YYYY-MM-DD' */
export function hoyLocal(ahora: Date = new Date()): string {
  return ahora.toLocaleDateString('sv-SE')
}

/** Date → valor para <input type="datetime-local"> en hora local */
export function aInputLocal(fecha: Date): string {
  const dia = fecha.toLocaleDateString('sv-SE')
  const hora = fecha.toTimeString().slice(0, 5)
  return `${dia}T${hora}`
}

/** Desglose interno de la edad: días sueltos, semanas+días o meses+días */
interface EdadDesglosada {
  unidad: 'dias' | 'semanas' | 'meses'
  mayor: number // semanas o meses (0 si unidad === 'dias')
  dias: number
}

function desglosarEdad(fechaNacimiento: string, hoy: Date): EdadDesglosada {
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00')
  const dias = Math.max(0, Math.floor((hoy.getTime() - nacimiento.getTime()) / 86_400_000))

  if (dias < 7) return { unidad: 'dias', mayor: 0, dias }
  if (dias < 70) return { unidad: 'semanas', mayor: Math.floor(dias / 7), dias: dias % 7 }

  // Meses de calendario + días sueltos
  let meses =
    (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + (hoy.getMonth() - nacimiento.getMonth())
  if (hoy.getDate() < nacimiento.getDate()) meses--
  const ancla = new Date(nacimiento)
  ancla.setMonth(ancla.getMonth() + meses)
  const diasSueltos = Math.floor((hoy.getTime() - ancla.getTime()) / 86_400_000)
  return { unidad: 'meses', mayor: meses, dias: Math.max(0, diasSueltos) }
}

/**
 * Edad legible a partir de la fecha de nacimiento.
 * < 10 semanas → "8 semanas y 3 días"; después → "3 meses y 12 días".
 */
export function edadTexto(fechaNacimiento: string, hoy: Date = new Date()): string {
  const { unidad, mayor, dias } = desglosarEdad(fechaNacimiento, hoy)
  const diasTexto = `${dias} ${dias === 1 ? 'día' : 'días'}`
  if (unidad === 'dias') return diasTexto
  const mayorTexto =
    unidad === 'semanas'
      ? `${mayor} ${mayor === 1 ? 'semana' : 'semanas'}`
      : `${mayor} ${mayor === 1 ? 'mes' : 'meses'}`
  return dias === 0 ? mayorTexto : `${mayorTexto} y ${diasTexto}`
}

/** Edad compacta para tiles con poco espacio: "5 d", "8 sem 5 d", "3 m 12 d" */
export function edadCorta(fechaNacimiento: string, hoy: Date = new Date()): string {
  const { unidad, mayor, dias } = desglosarEdad(fechaNacimiento, hoy)
  if (unidad === 'dias') return `${dias} d`
  const mayorTexto = unidad === 'semanas' ? `${mayor} sem` : `${mayor} m`
  return dias === 0 ? mayorTexto : `${mayorTexto} ${dias} d`
}

/** Minutos entre inicio y fin; null si el fin aún no existe */
export function duracionMinutos(inicio: string, fin: string | null): number | null {
  if (!fin) return null
  return Math.max(0, Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60_000))
}

/** Gramos → texto legible: 830 → '830 g'; 4320 → '4,32 kg' */
export function formatoPeso(gramos: number): string {
  if (gramos < 1000) return `${gramos} g`
  const kg = (gramos / 1000).toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })
  return `${kg} kg`
}

/** '135' minutos → '2 h 15 min'; '45' → '45 min' */
export function formatoDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/** Agrupa registros por día local (clave 'YYYY-MM-DD'), días más recientes primero */
export function agruparPorDia<T>(items: T[], fechaDe: (item: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>()
  for (const item of items) {
    const dia = claveDia(fechaDe(item))
    const lista = grupos.get(dia) ?? []
    lista.push(item)
    grupos.set(dia, lista)
  }
  return new Map([...grupos.entries()].sort((a, b) => b[0].localeCompare(a[0])))
}

export interface ResumenDia {
  numTomas: number
  mlBiberon: number
  minutosPecho: number
  minutosSueno: number
  numPanales: number
  numCacas: number
}

/** Resumen agregado de un día (para las tarjetas de Hoy e Historial) */
export function resumenDia(tomas: Toma[], suenos: Sueno[], panales: Panal[]): ResumenDia {
  let mlBiberon = 0
  let minutosPecho = 0
  for (const toma of tomas) {
    if (toma.tipo === 'pecho_izq' || toma.tipo === 'pecho_der') {
      minutosPecho += duracionMinutos(toma.inicio, toma.fin) ?? 0
    } else {
      mlBiberon += toma.cantidad_ml ?? 0
    }
  }
  const minutosSueno = suenos.reduce(
    (total, s) => total + (duracionMinutos(s.inicio, s.fin) ?? 0),
    0,
  )
  return {
    numTomas: tomas.length,
    mlBiberon,
    minutosPecho,
    minutosSueno,
    numPanales: panales.length,
    numCacas: panales.filter((p) => p.tipo === 'caca' || p.tipo === 'mixto').length,
  }
}

// ---- Texto de los registros (compartido por Hoy e Historial) ----

export function textoToma(t: Toma): string {
  const minutos = duracionMinutos(t.inicio, t.fin)
  const detalle = t.cantidad_ml
    ? `${t.cantidad_ml} ml`
    : minutos !== null
      ? formatoDuracion(minutos)
      : '(en curso)'
  return `🍼 ${ETIQUETAS_TOMA[t.tipo]} — ${detalle}${t.notas ? ` · ${t.notas}` : ''}`
}

export function textoSueno(s: Sueno): string {
  const minutos = duracionMinutos(s.inicio, s.fin)
  return `😴 Sueño${minutos !== null ? ` — ${formatoDuracion(minutos)}` : ' (en curso)'}`
}

export function textoPanal(p: Panal): string {
  const cantidad = p.cantidad ? ` (${ETIQUETAS_CANTIDAD_PANAL[p.cantidad].toLowerCase()})` : ''
  return `🧷 Pañal — ${ETIQUETAS_PANAL[p.tipo]}${cantidad}`
}

export function textoEvento(e: Evento): string {
  return `⭐ ${ETIQUETAS_EVENTO[e.tipo]}${e.descripcion ? ` — ${e.descripcion}` : ''}`
}

/**
 * Último valor no nulo de una serie por fecha (p. ej. el peso más reciente
 * entre medidas donde no siempre se apunta todo). null si no hay ninguno.
 */
export function ultimoValor<T>(
  items: T[],
  fechaDe: (item: T) => string,
  valorDe: (item: T) => number | null,
): { valor: number; fecha: string } | null {
  let ultimo: { valor: number; fecha: string } | null = null
  for (const item of items) {
    const valor = valorDe(item)
    if (valor === null) continue
    const fecha = fechaDe(item)
    if (!ultimo || fecha.localeCompare(ultimo.fecha) >= 0) ultimo = { valor, fecha }
  }
  return ultimo
}

// ---- Objetivos diarios (orientativos) ----

export interface ObjetivoDiario {
  min: number
  max: number
}

/**
 * Sueño recomendado por 24 h según la edad, en minutos (rangos de la
 * National Sleep Foundation / AASM): 0-3 meses 14-17 h, 4-11 meses
 * 12-15 h, 1-2 años 11-14 h.
 */
export function objetivoSuenoMinutos(edadDias: number): ObjetivoDiario {
  if (edadDias < 120) return { min: 14 * 60, max: 17 * 60 }
  if (edadDias < 365) return { min: 12 * 60, max: 15 * 60 }
  return { min: 11 * 60, max: 14 * 60 }
}

/**
 * Leche diaria orientativa (ml) con la regla pediátrica de ml/kg por edad
 * (~150 ml/kg hasta los 3 meses, 120 hasta los 6, 100 hasta los 9, 90
 * después), con banda del ±15% y tope de 1000 ml/día. Requiere conocer el
 * peso: null si no hay medida de peso.
 */
export function objetivoLecheMl(
  edadDias: number,
  pesoGramos: number | null,
): ObjetivoDiario | null {
  if (!pesoGramos || pesoGramos <= 0) return null
  const porKg = edadDias < 90 ? 150 : edadDias < 180 ? 120 : edadDias < 270 ? 100 : 90
  const kg = pesoGramos / 1000
  const redondear = (v: number) => Math.round(v / 10) * 10
  const max = Math.min(1000, redondear(kg * porKg * 1.15))
  const min = Math.min(max, redondear(kg * porKg * 0.85))
  return { min, max }
}

// ---- Ritmo de 24 h ----

export interface TramoRitmo {
  desdeMin: number // minuto del día (0-1440)
  hastaMin: number
}

/**
 * Recorta un intervalo [inicio, fin] al día local indicado y lo devuelve en
 * minutos del día (0-1440). Un intervalo que cruza medianoche aporta un tramo
 * a cada día. fin === null (en curso) se recorta en `ahora`. null si el
 * intervalo no toca el día.
 */
export function tramoEnDia(
  inicioIso: string,
  finIso: string | null,
  dia: string,
  ahora: Date = new Date(),
): TramoRitmo | null {
  const inicioDia = new Date(dia + 'T00:00:00').getTime()
  const finDia = inicioDia + 86_400_000
  const desde = Math.max(new Date(inicioIso).getTime(), inicioDia)
  const hasta = Math.min(finIso ? new Date(finIso).getTime() : ahora.getTime(), finDia)
  if (hasta <= desde) return null
  return {
    desdeMin: Math.round((desde - inicioDia) / 60_000),
    hastaMin: Math.round((hasta - inicioDia) / 60_000),
  }
}

/** Minuto del día local (0-1439) de una fecha ISO */
export function minutoDelDia(iso: string): number {
  const fecha = new Date(iso)
  return fecha.getHours() * 60 + fecha.getMinutes()
}

/** Los últimos `n` días locales como 'YYYY-MM-DD', el más reciente primero */
export function ultimosDias(n: number, ahora: Date = new Date()): string[] {
  const dias: string[] = []
  for (let i = 0; i < n; i++) {
    const fecha = new Date(ahora)
    fecha.setDate(fecha.getDate() - i)
    dias.push(fecha.toLocaleDateString('sv-SE'))
  }
  return dias
}

// ---- Percentiles OMS (niñas) ----

export type MedidaOMS = 'peso' | 'altura' | 'pc'

/** Función error de Gauss (aproximación Abramowitz-Stegun 7.1.26, error < 1.5e-7) */
function erf(x: number): number {
  const signo = x < 0 ? -1 : 1
  x = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * x)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x)
  return signo * y
}

function cdfNormal(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

/** Edad en días entre el nacimiento y una fecha, ambas 'YYYY-MM-DD' */
export function edadDias(fechaNacimiento: string, fecha: string): number {
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00')
  const dia = new Date(fecha + 'T00:00:00')
  return Math.round((dia.getTime() - nacimiento.getTime()) / 86_400_000)
}

/** Parámetros LMS de la OMS interpolados entre semanas, o null fuera de rango */
function lmsInterpolado(tipo: MedidaOMS, dias: number): { l: number; m: number; s: number } | null {
  if (dias < 0) return null
  const semanas = dias / 7
  const ref0 = REFERENCIA_OMS_NINAS[Math.floor(semanas)]
  const ref1 = REFERENCIA_OMS_NINAS[Math.ceil(semanas)]
  if (!ref0 || !ref1) return null
  const t = semanas - Math.floor(semanas)
  const interpolar = (a: number, b: number) => a + (b - a) * t
  return {
    l: interpolar(ref0.lms[tipo].l, ref1.lms[tipo].l),
    m: interpolar(ref0.lms[tipo].m, ref1.lms[tipo].m),
    s: interpolar(ref0.lms[tipo].s, ref1.lms[tipo].s),
  }
}

/**
 * Percentil OMS (0.1-99.9) de una medida de niña a cierta edad en días.
 * `valor` en unidades de la app (peso en g, altura/PC en cm). Interpola los
 * parámetros LMS entre semanas; null fuera de rango (0-700 días).
 */
export function percentilOMS(tipo: MedidaOMS, valor: number, dias: number): number | null {
  if (valor <= 0) return null
  const lms = lmsInterpolado(tipo, dias)
  if (!lms) return null
  const { l, m, s } = lms
  const z = l === 0 ? Math.log(valor / m) / s : (Math.pow(valor / m, l) - 1) / (l * s)
  return Math.min(99.9, Math.max(0.1, cdfNormal(z) * 100))
}

export interface BandaOMS {
  p3: number
  p50: number
  p97: number
}

const Z_P97 = 1.8807936081512509

/**
 * Banda de referencia OMS (P3/P50/P97) de una medida de niña a cierta edad,
 * en unidades de la app — para pintar la franja de la cartilla en las
 * gráficas. null fuera de rango (0-700 días).
 */
export function bandaOMS(tipo: MedidaOMS, dias: number): BandaOMS | null {
  const lms = lmsInterpolado(tipo, dias)
  if (!lms) return null
  const { l, m, s } = lms
  const valorEnZ = (z: number) =>
    l === 0 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l)
  return { p3: valorEnZ(-Z_P97), p50: m, p97: valorEnZ(Z_P97) }
}

export interface PuntoGrafica {
  etiqueta: string // fecha 'YYYY-MM-DD'
  valor: number
}

/** Extrae los puntos (fecha, valor) no nulos de una serie, orden cronológico */
export function serieGrafica<T>(
  items: T[],
  fechaDe: (item: T) => string,
  valorDe: (item: T) => number | null,
): PuntoGrafica[] {
  return items
    .map((item) => ({ etiqueta: fechaDe(item), valor: valorDe(item) }))
    .filter((p): p is PuntoGrafica => p.valor !== null)
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta))
}
