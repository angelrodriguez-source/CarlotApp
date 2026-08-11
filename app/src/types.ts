/**
 * types.ts — Tipos de dominio de CarlotApp
 *
 * Espejo de las tablas de Supabase (supabase/migrations/). Las fechas
 * llegan como string ISO (timestamptz) o 'YYYY-MM-DD' (date).
 */

export interface Bebe {
  id: string
  nombre: string
  fecha_nacimiento: string // 'YYYY-MM-DD'
}

export type TipoToma = 'biberon_formula' | 'biberon_materna' | 'pecho_izq' | 'pecho_der'

export interface Toma {
  id: string
  bebe_id: string
  inicio: string
  fin: string | null
  tipo: TipoToma
  cantidad_ml: number | null
  notas: string | null
}

export interface Sueno {
  id: string
  bebe_id: string
  inicio: string
  fin: string | null // null = todavía dormida
  notas: string | null
}

export type TipoPanal = 'pis' | 'caca' | 'mixto'

/** Cuánta caca traía el pañal (solo tipos caca/mixto; null = sin especificar) */
export type CantidadPanal = 'poco' | 'medio' | 'mucho'

export interface Panal {
  id: string
  bebe_id: string
  fecha: string
  tipo: TipoPanal
  cantidad: CantidadPanal | null
  notas: string | null
}

export type TipoEvento =
  'bano' | 'vitamina_d' | 'medicacion' | 'unas' | 'hito' | 'otro' | 'ejercicio'

/** Subtipo del evento 'ejercicio' */
export type TipoEjercicio = 'tummy_time' | 'estimulacion' | 'otros'

export interface Evento {
  id: string
  bebe_id: string
  fecha: string
  tipo: TipoEvento
  descripcion: string | null
  /** Solo en tipo 'ejercicio' */
  subtipo: TipoEjercicio | null
  /** Duración en minutos (solo la usa el ejercicio) */
  duracion_min: number | null
}

/** 'casa' = medición nuestra; 'oficial' = validada (pediatra o farmacia) */
export type OrigenMedida = 'casa' | 'oficial'

export interface Medida {
  id: string
  bebe_id: string
  fecha: string // 'YYYY-MM-DD'
  peso_gramos: number | null
  altura_cm: number | null
  perimetro_craneal_cm: number | null
  origen: OrigenMedida
  notas: string | null
}

export type TipoCita = 'medica' | 'tramite' | 'otro'

export interface Cita {
  id: string
  bebe_id: string
  fecha: string
  titulo: string
  tipo: TipoCita
  lugar: string | null
  notas: string | null
  completada: boolean
}

export const ETIQUETAS_TOMA: Record<TipoToma, string> = {
  biberon_formula: 'Biberón (fórmula)',
  biberon_materna: 'Biberón (materna)',
  pecho_izq: 'Pecho izq.',
  pecho_der: 'Pecho der.',
}

export const ETIQUETAS_PANAL: Record<TipoPanal, string> = {
  pis: 'Pis',
  caca: 'Caca',
  mixto: 'Pis + caca',
}

export const ETIQUETAS_CANTIDAD_PANAL: Record<CantidadPanal, string> = {
  poco: 'Poco',
  medio: 'Medio',
  mucho: 'Mucho',
}

export const ETIQUETAS_EVENTO: Record<TipoEvento, string> = {
  bano: 'Baño',
  vitamina_d: 'Vitamina D',
  medicacion: 'Medicación',
  unas: 'Uñas cortadas',
  hito: 'Momento',
  otro: 'Otro',
  ejercicio: 'Ejercicio',
}

/** Ítems sobre los que se puede poner un recordatorio (registros contables) */
export type ItemRecordatorio =
  'toma' | 'sueno' | 'panal' | 'bano' | 'vitamina_d' | 'medicacion' | 'unas' | 'ejercicio'

export type IntervaloRecordatorio = 'dia' | 'semana'

export interface Recordatorio {
  id: string
  bebe_id: string
  item: ItemRecordatorio
  /** Solo para item 'ejercicio': null = cualquier ejercicio */
  subtipo: TipoEjercicio | null
  intervalo: IntervaloRecordatorio
  repeticiones: number
  activo: boolean
  /** Orden estable del listado (el servicio ordena por esta columna) */
  created_at: string
}

export const ETIQUETAS_EJERCICIO: Record<TipoEjercicio, string> = {
  tummy_time: 'Tummy Time',
  estimulacion: 'Estimulación',
  otros: 'Otros',
}

/**
 * Unión discriminada "un registro de cualquier tipo con su objeto
 * original a cuestas": la construye filasDeDia (CarlotaModel) y la
 * consume HojaEdicionRegistro para editar cualquier fila.
 */
export type RegistroEditable =
  | { kind: 'toma'; toma: Toma }
  | { kind: 'sueno'; sueno: Sueno }
  | { kind: 'panal'; panal: Panal }
  | { kind: 'evento'; evento: Evento }

export const ETIQUETAS_ORIGEN_MEDIDA: Record<OrigenMedida, string> = {
  casa: '🏠 En casa',
  oficial: '✅ Oficial (pediatra/farmacia)',
}

export const ETIQUETAS_CITA: Record<TipoCita, string> = {
  medica: 'Médica',
  tramite: 'Trámite',
  otro: 'Otro',
}
