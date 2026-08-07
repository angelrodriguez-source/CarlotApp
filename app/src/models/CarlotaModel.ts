/**
 * CarlotaModel.ts — Lógica pura del dominio (sin DOM, sin red, sin Supabase)
 *
 * Todo lo calculable a partir de datos vive aquí: edad, duraciones,
 * agrupaciones por día, resúmenes. Es lo único que se testea con Vitest
 * (src/models/__tests__/).
 */
import type { Sueno, Toma, Panal } from '../types'

/** Clave de día local 'YYYY-MM-DD' de una fecha ISO (zona del usuario) */
export function claveDia(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE')
}

/** Hoy en la zona del usuario, como 'YYYY-MM-DD' */
export function hoyLocal(ahora: Date = new Date()): string {
  return ahora.toLocaleDateString('sv-SE')
}

/**
 * Edad legible a partir de la fecha de nacimiento.
 * < 10 semanas → "8 semanas y 3 días"; después → "3 meses y 12 días".
 */
export function edadTexto(fechaNacimiento: string, hoy: Date = new Date()): string {
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00')
  const dias = Math.max(0, Math.floor((hoy.getTime() - nacimiento.getTime()) / 86_400_000))

  if (dias < 70) {
    const semanas = Math.floor(dias / 7)
    const resto = dias % 7
    if (semanas === 0) return `${dias} ${dias === 1 ? 'día' : 'días'}`
    if (resto === 0) return `${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`
    return `${semanas} ${semanas === 1 ? 'semana' : 'semanas'} y ${resto} ${resto === 1 ? 'día' : 'días'}`
  }

  // Meses de calendario + días sueltos
  let meses =
    (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + (hoy.getMonth() - nacimiento.getMonth())
  if (hoy.getDate() < nacimiento.getDate()) meses--
  const ancla = new Date(nacimiento)
  ancla.setMonth(ancla.getMonth() + meses)
  const diasSueltos = Math.floor((hoy.getTime() - ancla.getTime()) / 86_400_000)
  if (diasSueltos <= 0) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`
  return `${meses} ${meses === 1 ? 'mes' : 'meses'} y ${diasSueltos} ${diasSueltos === 1 ? 'día' : 'días'}`
}

/** Minutos entre inicio y fin; null si el fin aún no existe */
export function duracionMinutos(inicio: string, fin: string | null): number | null {
  if (!fin) return null
  return Math.max(0, Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60_000))
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
