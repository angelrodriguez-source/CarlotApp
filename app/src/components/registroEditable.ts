/**
 * registroEditable.ts — Unión discriminada que HojaEdicionRegistro acepta:
 * un registro de cualquier tipo con su objeto original a cuestas.
 * La construyen HoyView (línea de tiempo) e HistorialView (días).
 */
import type { Evento, Panal, Sueno, Toma } from '../types'

export type RegistroEditable =
  | { kind: 'toma'; toma: Toma }
  | { kind: 'sueno'; sueno: Sueno }
  | { kind: 'panal'; panal: Panal }
  | { kind: 'evento'; evento: Evento }
