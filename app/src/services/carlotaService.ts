/**
 * carlotaService.ts — Única puerta de acceso a los datos de Supabase
 *
 * Los componentes/vistas NUNCA llaman a Supabase directamente: importan
 * estas funciones. Así todos los accesos a datos están en un solo sitio.
 *
 * Convención de errores: cada función lanza (throw) si Supabase devuelve
 * error; las vistas capturan y muestran el mensaje.
 */
import { supabase } from './supabase'
import {
  ETIQUETAS_EVENTO,
  type Bebe,
  type Cita,
  type Evento,
  type Medida,
  type Panal,
  type Sueno,
  type Toma,
} from '../types'

function lanzarSi(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

/**
 * Evento global que emite este servicio tras CUALQUIER escritura de
 * tomas/sueños/pañales. Quien cachee derivados de esos datos (p. ej. la
 * memoización del bocadillo de Ñeñeñi) lo escucha para invalidarse.
 */
export const EVENTO_DATOS_CAMBIADOS = 'carlotapp-datos-cambiados'

function avisarDatosCambiados(): void {
  window.dispatchEvent(new Event(EVENTO_DATOS_CAMBIADOS))
}

// ------------------------------------------------------------
// Bebé
// ------------------------------------------------------------

/**
 * Devuelve el bebé (Carlota). null significa "sin acceso": o el usuario
 * no está en usuarios_autorizados (RLS devuelve 0 filas) o falta el seed.
 */
export async function getBebe(): Promise<Bebe | null> {
  const { data, error } = await supabase
    .from('bebes')
    .select('id, nombre, fecha_nacimiento')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  lanzarSi(error)
  return data
}

// ------------------------------------------------------------
// Tomas
// ------------------------------------------------------------

export async function registrarToma(
  toma: Pick<Toma, 'bebe_id' | 'inicio' | 'fin' | 'tipo' | 'cantidad_ml' | 'notas'>,
): Promise<Toma> {
  const { data, error } = await supabase.from('tomas').insert(toma).select().single()
  lanzarSi(error)
  avisarDatosCambiados()
  return data as Toma
}

export async function listarTomas(bebeId: string, desdeIso: string): Promise<Toma[]> {
  const { data, error } = await supabase
    .from('tomas')
    .select()
    .eq('bebe_id', bebeId)
    .gte('inicio', desdeIso)
    .order('inicio', { ascending: false })
  lanzarSi(error)
  return (data ?? []) as Toma[]
}

/** La última toma registrada (de cualquier día), si la hay */
export async function getUltimaToma(bebeId: string): Promise<Toma | null> {
  const { data, error } = await supabase
    .from('tomas')
    .select()
    .eq('bebe_id', bebeId)
    .order('inicio', { ascending: false })
    .limit(1)
    .maybeSingle()
  lanzarSi(error)
  return data as Toma | null
}

/**
 * La toma en curso del cronómetro (sin fin ni ml), si la hay. Solo se
 * consideran las últimas 3 horas para no confundir con tomas antiguas
 * apuntadas sin duración.
 */
export async function getTomaAbierta(bebeId: string): Promise<Toma | null> {
  const hace3h = new Date(Date.now() - 3 * 3600_000).toISOString()
  const { data, error } = await supabase
    .from('tomas')
    .select()
    .eq('bebe_id', bebeId)
    .is('fin', null)
    .is('cantidad_ml', null)
    .gte('inicio', hace3h)
    .order('inicio', { ascending: false })
    .limit(1)
    .maybeSingle()
  lanzarSi(error)
  return data as Toma | null
}

export async function actualizarToma(
  id: string,
  cambios: Partial<Pick<Toma, 'inicio' | 'fin' | 'tipo' | 'cantidad_ml' | 'notas'>>,
): Promise<void> {
  const { error } = await supabase.from('tomas').update(cambios).eq('id', id)
  lanzarSi(error)
  avisarDatosCambiados()
}

export async function eliminarToma(id: string): Promise<void> {
  const { error } = await supabase.from('tomas').delete().eq('id', id)
  lanzarSi(error)
  avisarDatosCambiados()
}

// ------------------------------------------------------------
// Sueño
// ------------------------------------------------------------

/** Registra un sueño ya terminado (a posteriori), con inicio y fin conocidos */
export async function registrarSueno(
  sueno: Pick<Sueno, 'bebe_id' | 'inicio' | 'fin' | 'notas'>,
): Promise<Sueno> {
  const { data, error } = await supabase.from('suenos').insert(sueno).select().single()
  lanzarSi(error)
  avisarDatosCambiados()
  return data as Sueno
}

/** Inicia un sueño (fin = null). Si ya hay uno abierto, la vista debe cerrarlo antes. */
export async function iniciarSueno(bebeId: string, inicioIso: string): Promise<Sueno> {
  const { data, error } = await supabase
    .from('suenos')
    .insert({ bebe_id: bebeId, inicio: inicioIso })
    .select()
    .single()
  lanzarSi(error)
  avisarDatosCambiados()
  return data as Sueno
}

export async function finalizarSueno(id: string, finIso: string): Promise<void> {
  const { error } = await supabase.from('suenos').update({ fin: finIso }).eq('id', id)
  lanzarSi(error)
  avisarDatosCambiados()
}

/** El sueño abierto (sin fin) más reciente, si lo hay */
export async function getSuenoAbierto(bebeId: string): Promise<Sueno | null> {
  // Solo cuenta como "en curso" un sueño empezado en las ultimas 24 h: uno
  // olvidado sin terminar no debe dejar la card en "durmiendo" para siempre
  const hace24h = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { data, error } = await supabase
    .from('suenos')
    .select()
    .eq('bebe_id', bebeId)
    .is('fin', null)
    .gte('inicio', hace24h)
    .order('inicio', { ascending: false })
    .limit(1)
    .maybeSingle()
  lanzarSi(error)
  return data as Sueno | null
}

export async function listarSuenos(bebeId: string, desdeIso: string): Promise<Sueno[]> {
  const { data, error } = await supabase
    .from('suenos')
    .select()
    .eq('bebe_id', bebeId)
    .gte('inicio', desdeIso)
    .order('inicio', { ascending: false })
  lanzarSi(error)
  return (data ?? []) as Sueno[]
}

/** El último sueño terminado (por hora de fin), para "despierta desde hace X" */
export async function getUltimoSuenoTerminado(bebeId: string): Promise<Sueno | null> {
  const { data, error } = await supabase
    .from('suenos')
    .select()
    .eq('bebe_id', bebeId)
    .not('fin', 'is', null)
    .order('fin', { ascending: false })
    .limit(1)
    .maybeSingle()
  lanzarSi(error)
  return data as Sueno | null
}

export async function actualizarSueno(
  id: string,
  cambios: Partial<Pick<Sueno, 'inicio' | 'fin' | 'notas'>>,
): Promise<void> {
  const { error } = await supabase.from('suenos').update(cambios).eq('id', id)
  lanzarSi(error)
  avisarDatosCambiados()
}

export async function eliminarSueno(id: string): Promise<void> {
  const { error } = await supabase.from('suenos').delete().eq('id', id)
  lanzarSi(error)
  avisarDatosCambiados()
}

// ------------------------------------------------------------
// Pañales
// ------------------------------------------------------------

export async function registrarPanal(
  panal: Pick<Panal, 'bebe_id' | 'fecha' | 'tipo' | 'cantidad' | 'notas'>,
): Promise<Panal> {
  const { data, error } = await supabase.from('panales').insert(panal).select().single()
  lanzarSi(error)
  avisarDatosCambiados()
  return data as Panal
}

/** El último pañal registrado (de cualquier día), si lo hay */
export async function getUltimoPanal(bebeId: string): Promise<Panal | null> {
  const { data, error } = await supabase
    .from('panales')
    .select()
    .eq('bebe_id', bebeId)
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle()
  lanzarSi(error)
  return data as Panal | null
}

export async function actualizarPanal(
  id: string,
  cambios: Partial<Pick<Panal, 'fecha' | 'tipo' | 'cantidad' | 'notas'>>,
): Promise<void> {
  const { error } = await supabase.from('panales').update(cambios).eq('id', id)
  lanzarSi(error)
  avisarDatosCambiados()
}

export async function listarPanales(bebeId: string, desdeIso: string): Promise<Panal[]> {
  const { data, error } = await supabase
    .from('panales')
    .select()
    .eq('bebe_id', bebeId)
    .gte('fecha', desdeIso)
    .order('fecha', { ascending: false })
  lanzarSi(error)
  return (data ?? []) as Panal[]
}

export async function eliminarPanal(id: string): Promise<void> {
  const { error } = await supabase.from('panales').delete().eq('id', id)
  lanzarSi(error)
  avisarDatosCambiados()
}

// ------------------------------------------------------------
// Eventos (baño, vitamina D, medicación, hitos...)
// ------------------------------------------------------------

export async function registrarEvento(
  evento: Pick<Evento, 'bebe_id' | 'fecha' | 'tipo' | 'descripcion'>,
): Promise<Evento> {
  const { data, error } = await supabase.from('eventos').insert(evento).select().single()
  lanzarSi(error)
  return data as Evento
}

export async function listarEventos(bebeId: string, desdeIso: string): Promise<Evento[]> {
  const { data, error } = await supabase
    .from('eventos')
    .select()
    .eq('bebe_id', bebeId)
    .gte('fecha', desdeIso)
    .order('fecha', { ascending: false })
  lanzarSi(error)
  return (data ?? []) as Evento[]
}

/** El último evento de un tipo dado (p. ej. el último corte de uñas) */
export async function getUltimoEventoDeTipo(
  bebeId: string,
  tipo: Evento['tipo'],
): Promise<Evento | null> {
  const { data, error } = await supabase
    .from('eventos')
    .select()
    .eq('bebe_id', bebeId)
    .eq('tipo', tipo)
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle()
  lanzarSi(error)
  return data as Evento | null
}

/**
 * El último evento de CADA tipo (para la sección "Últimos hitos" de Hoy):
 * varias consultas pequeñas en paralelo — la tabla es diminuta y está
 * indexada por (bebe_id, fecha).
 */
export async function getUltimosEventosPorTipo(
  bebeId: string,
): Promise<Partial<Record<Evento['tipo'], Evento | null>>> {
  // Derivado de ETIQUETAS_EVENTO: un tipo nuevo entra aquí solo
  const tipos = Object.keys(ETIQUETAS_EVENTO) as Evento['tipo'][]
  const resultados = await Promise.all(tipos.map((tipo) => getUltimoEventoDeTipo(bebeId, tipo)))
  return Object.fromEntries(tipos.map((tipo, i) => [tipo, resultados[i]]))
}

/**
 * Los "Momentos" (eventos tipo hito) de todos los tiempos, el más reciente
 * primero — para la sección Momentos del Historial.
 */
export async function listarMomentos(bebeId: string): Promise<Evento[]> {
  const { data, error } = await supabase
    .from('eventos')
    .select()
    .eq('bebe_id', bebeId)
    .eq('tipo', 'hito')
    .order('fecha', { ascending: false })
  lanzarSi(error)
  return (data ?? []) as Evento[]
}

export async function actualizarEvento(
  id: string,
  cambios: Partial<Pick<Evento, 'fecha' | 'tipo' | 'descripcion'>>,
): Promise<void> {
  const { error } = await supabase.from('eventos').update(cambios).eq('id', id)
  lanzarSi(error)
}

export async function eliminarEvento(id: string): Promise<void> {
  const { error } = await supabase.from('eventos').delete().eq('id', id)
  lanzarSi(error)
}

// ------------------------------------------------------------
// Medidas (peso / altura / perímetro craneal)
// ------------------------------------------------------------

export async function registrarMedida(
  medida: Pick<
    Medida,
    'bebe_id' | 'fecha' | 'peso_gramos' | 'altura_cm' | 'perimetro_craneal_cm' | 'origen' | 'notas'
  >,
): Promise<Medida> {
  const { data, error } = await supabase.from('medidas').insert(medida).select().single()
  lanzarSi(error)
  return data as Medida
}

export async function listarMedidas(bebeId: string): Promise<Medida[]> {
  const { data, error } = await supabase
    .from('medidas')
    .select()
    .eq('bebe_id', bebeId)
    .order('fecha')
  lanzarSi(error)
  return (data ?? []) as Medida[]
}

export async function actualizarMedida(
  id: string,
  cambios: Partial<
    Pick<
      Medida,
      'fecha' | 'peso_gramos' | 'altura_cm' | 'perimetro_craneal_cm' | 'origen' | 'notas'
    >
  >,
): Promise<void> {
  const { error } = await supabase.from('medidas').update(cambios).eq('id', id)
  lanzarSi(error)
}

export async function eliminarMedida(id: string): Promise<void> {
  const { error } = await supabase.from('medidas').delete().eq('id', id)
  lanzarSi(error)
}

// ------------------------------------------------------------
// Citas y trámites
// ------------------------------------------------------------

export async function crearCita(
  cita: Pick<Cita, 'bebe_id' | 'fecha' | 'titulo' | 'tipo' | 'lugar' | 'notas'>,
): Promise<Cita> {
  const { data, error } = await supabase.from('citas').insert(cita).select().single()
  lanzarSi(error)
  return data as Cita
}

export async function listarCitas(bebeId: string): Promise<Cita[]> {
  const { data, error } = await supabase.from('citas').select().eq('bebe_id', bebeId).order('fecha')
  lanzarSi(error)
  return (data ?? []) as Cita[]
}

export async function marcarCita(id: string, completada: boolean): Promise<void> {
  const { error } = await supabase.from('citas').update({ completada }).eq('id', id)
  lanzarSi(error)
}

export async function eliminarCita(id: string): Promise<void> {
  const { error } = await supabase.from('citas').delete().eq('id', id)
  lanzarSi(error)
}

// ------------------------------------------------------------
// Mime Predictor (resultados del cálculo; el algoritmo es puro y
// vive en models/MimePredictor.ts)
// ------------------------------------------------------------

export interface PrediccionGuardada {
  id: string
  bebe_id: string
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
}

/**
 * Guarda (upsert por bebé: una única fila viva) el resultado de un
 * cálculo del predictor, con sus parámetros para diagnóstico.
 * `registrado_por` va en el payload: el DEFAULT auth.uid() de la columna
 * solo aplica en el INSERT inicial y el upsert no la tocaría — quedaría
 * fosilizado el uid del primer padre que abrió el panel.
 */
export async function guardarPrediccion(fila: Omit<PrediccionGuardada, 'id'>): Promise<void> {
  // getSession lee el uid en local (getUser haría un round-trip al
  // servidor de auth en cada guardado)
  const { data } = await supabase.auth.getSession()
  const { error } = await supabase
    .from('predicciones')
    .upsert({ ...fila, registrado_por: data.session?.user.id }, { onConflict: 'bebe_id' })
  lanzarSi(error)
}

/** Última predicción guardada del bebé, o null si aún no hay ninguna */
export async function getPrediccionGuardada(bebeId: string): Promise<PrediccionGuardada | null> {
  const { data, error } = await supabase
    .from('predicciones')
    .select()
    .eq('bebe_id', bebeId)
    .maybeSingle()
  lanzarSi(error)
  return data as PrediccionGuardada | null
}
