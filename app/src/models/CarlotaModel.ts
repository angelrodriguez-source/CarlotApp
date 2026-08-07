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
  const minutosSueno = suenos.reduce((total, s) => total + (duracionMinutos(s.inicio, s.fin) ?? 0), 0)
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
      : ''
  return `🍼 ${ETIQUETAS_TOMA[t.tipo]}${detalle ? ` — ${detalle}` : ''}${t.notas ? ` · ${t.notas}` : ''}`
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

/**
 * Percentil OMS (0.1-99.9) de una medida de niña a cierta edad en días.
 * `valor` en unidades de la app (peso en g, altura/PC en cm). Interpola los
 * parámetros LMS entre semanas; null fuera de rango (0-700 días).
 */
export function percentilOMS(tipo: MedidaOMS, valor: number, dias: number): number | null {
  if (valor <= 0 || dias < 0) return null
  const semanas = dias / 7
  const ref0 = REFERENCIA_OMS_NINAS[Math.floor(semanas)]
  const ref1 = REFERENCIA_OMS_NINAS[Math.ceil(semanas)]
  if (!ref0 || !ref1) return null
  const t = semanas - Math.floor(semanas)
  const interpolar = (a: number, b: number) => a + (b - a) * t
  const l = interpolar(ref0.lms[tipo].l, ref1.lms[tipo].l)
  const m = interpolar(ref0.lms[tipo].m, ref1.lms[tipo].m)
  const s = interpolar(ref0.lms[tipo].s, ref1.lms[tipo].s)
  const z = l === 0 ? Math.log(valor / m) / s : (Math.pow(valor / m, l) - 1) / (l * s)
  return Math.min(99.9, Math.max(0.1, cdfNormal(z) * 100))
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
