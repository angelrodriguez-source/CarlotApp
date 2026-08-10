/**
 * recordatorios.ts — Lógica pura de los Recordatorios (testeada).
 *
 * Un recordatorio dice "este ítem de registro debería hacerse N veces por
 * intervalo" (vitamina D 1 vez al día, Tummy Time 3 veces al día...). El
 * estado NO se guarda: se calcula contando los registros reales dentro de
 * la ventana — día local de hoy, o los últimos 7 días si el intervalo es
 * semanal (ventana rodante). Ñeñeñi avisa de lo pendiente al caer el día
 * y la cabecera muestra el numerito rojo sobre su icono.
 */
import {
  ETIQUETAS_EJERCICIO,
  type Evento,
  type ItemRecordatorio,
  type Panal,
  type Recordatorio,
  type Sueno,
  type Toma,
} from '../types'
import { claveDia, hoyLocal } from './CarlotaModel'

/** Único punto de ajuste de los recordatorios */
export const AJUSTES_RECORDATORIOS = {
  /** Desde esta hora local, lo pendiente del día pasa a AVISO (badge rojo) */
  horaAvisoDesde: 19,
  /** Ventana rodante del intervalo semanal (días, hoy incluido) */
  diasSemana: 7,
  /** Repeticiones admitidas por intervalo */
  repeticiones: { min: 1, max: 24 },
} as const

/** Catálogo de ítems recordables (etiqueta + clave de icono ICONOS_REGISTRO) */
export const ITEMS_RECORDATORIO: readonly {
  id: ItemRecordatorio
  etiqueta: string
  icono: string
}[] = [
  { id: 'toma', etiqueta: 'Toma', icono: 'toma' },
  { id: 'sueno', etiqueta: 'Sueño', icono: 'sueno' },
  { id: 'panal', etiqueta: 'Pañal', icono: 'panal' },
  { id: 'bano', etiqueta: 'Baño', icono: 'bano' },
  { id: 'vitamina_d', etiqueta: 'Vitamina D', icono: 'vitamina_d' },
  { id: 'medicacion', etiqueta: 'Medicación', icono: 'medicacion' },
  { id: 'unas', etiqueta: 'Uñas', icono: 'unas' },
  { id: 'ejercicio', etiqueta: 'Ejercicio', icono: 'ejercicio' },
] as const

export interface DatosRecordatorios {
  tomas: Toma[]
  suenos: Sueno[]
  panales: Panal[]
  eventos: Evento[]
}

export interface EstadoRecordatorio {
  recordatorio: Recordatorio
  /** "Vitamina D" o "Ejercicio (Tummy Time)" */
  etiqueta: string
  /** Clave de icono en ICONOS_REGISTRO */
  icono: string
  hechas: number
  objetivo: number
  pendientes: number
  cumplido: boolean
}

/** Etiqueta legible de un recordatorio (con el subtipo del ejercicio) */
export function etiquetaRecordatorio(r: Pick<Recordatorio, 'item' | 'subtipo'>): string {
  const base = ITEMS_RECORDATORIO.find((i) => i.id === r.item)?.etiqueta ?? r.item
  if (r.item === 'ejercicio' && r.subtipo) return `${base} (${ETIQUETAS_EJERCICIO[r.subtipo]})`
  return base
}

/** Días 'YYYY-MM-DD' de la ventana del recordatorio (hoy, o últimos 7) */
function diasVentana(intervalo: Recordatorio['intervalo'], ahora: Date): Set<string> {
  const dias = new Set<string>()
  const n = intervalo === 'dia' ? 1 : AJUSTES_RECORDATORIOS.diasSemana
  for (let i = 0; i < n; i++) {
    const fecha = new Date(ahora)
    fecha.setDate(fecha.getDate() - i)
    dias.add(hoyLocal(fecha))
  }
  return dias
}

/** Cuenta las veces que el ítem se ha hecho dentro de la ventana */
function contarHechas(r: Recordatorio, datos: DatosRecordatorios, ahora: Date): number {
  const dias = diasVentana(r.intervalo, ahora)
  const enVentana = (iso: string) =>
    dias.has(claveDia(iso)) && new Date(iso).getTime() <= ahora.getTime()
  switch (r.item) {
    case 'toma':
      return datos.tomas.filter((t) => enVentana(t.inicio)).length
    case 'sueno':
      return datos.suenos.filter((s) => enVentana(s.inicio)).length
    case 'panal':
      return datos.panales.filter((p) => enVentana(p.fecha)).length
    default:
      // Eventos por tipo; el ejercicio filtra además por subtipo si lo hay
      return datos.eventos.filter(
        (e) =>
          e.tipo === r.item &&
          enVentana(e.fecha) &&
          (r.item !== 'ejercicio' || r.subtipo === null || e.subtipo === r.subtipo),
      ).length
  }
}

/** Estado de todos los recordatorios ACTIVOS contra los registros reales */
export function estadoRecordatorios(
  recordatorios: Recordatorio[],
  datos: DatosRecordatorios,
  ahora: Date = new Date(),
): EstadoRecordatorio[] {
  return recordatorios
    .filter((r) => r.activo)
    .map((r) => {
      const hechas = contarHechas(r, datos, ahora)
      const pendientes = Math.max(0, r.repeticiones - hechas)
      return {
        recordatorio: r,
        etiqueta: etiquetaRecordatorio(r),
        icono: ITEMS_RECORDATORIO.find((i) => i.id === r.item)?.icono ?? 'otro',
        hechas,
        objetivo: r.repeticiones,
        pendientes,
        cumplido: pendientes === 0,
      }
    })
}

/** ¿Estamos ya en la franja de aviso ("se acaba el día")? */
export function esHoraDeAviso(ahora: Date = new Date()): boolean {
  return ahora.getHours() >= AJUSTES_RECORDATORIOS.horaAvisoDesde
}

/**
 * Nº para el badge rojo sobre Ñeñeñi: recordatorios con pendientes,
 * SOLO desde la hora de aviso — antes se ven en su sección y en el
 * bocadillo, pero sin presión visual.
 */
export function avisosRecordatorios(estados: EstadoRecordatorio[], ahora: Date): number {
  if (!esHoraDeAviso(ahora)) return 0
  return estados.filter((e) => e.pendientes > 0).length
}

/** Texto "2 de 3" o "1" (cuando el objetivo es 1, el número solo estorba) */
function cuenta(e: EstadoRecordatorio): string {
  return e.objetivo === 1 ? e.etiqueta : `${e.etiqueta} (${e.hechas} de ${e.objetivo})`
}

/**
 * La frase de Ñeñeñi sobre los recordatorios, o null si no hay nada que
 * decir. De día enumera lo que queda; desde la hora de aviso lo dice en
 * tono de "el día se acaba"; y si todo está hecho, lo celebra.
 */
export function fraseRecordatorios(
  estados: EstadoRecordatorio[],
  ahora: Date = new Date(),
): string | null {
  if (estados.length === 0) return null
  const pendientes = estados.filter((e) => e.pendientes > 0)
  if (pendientes.length === 0) {
    return esHoraDeAviso(ahora)
      ? 'Todos los recordatorios de hoy están cumplidos. ¡Buen trabajo!'
      : null
  }
  const lista = pendientes.map(cuenta).join(', ')
  return esHoraDeAviso(ahora)
    ? `¡Ojo! El día se acaba y aún queda pendiente: ${lista}.`
    : `Hoy aún queda pendiente: ${lista}.`
}
