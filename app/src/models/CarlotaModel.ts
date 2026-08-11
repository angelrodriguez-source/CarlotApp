/**
 * CarlotaModel.ts — Lógica pura del dominio (sin DOM, sin red, sin Supabase)
 *
 * Todo lo calculable a partir de datos vive aquí: edad, duraciones,
 * agrupaciones por día, resúmenes. Es lo único que se testea con Vitest
 * (src/models/__tests__/).
 */
import {
  ETIQUETAS_CANTIDAD_PANAL,
  ETIQUETAS_EJERCICIO,
  ETIQUETAS_EVENTO,
  ETIQUETAS_PANAL,
  ETIQUETAS_TOMA,
  type Evento,
  type Panal,
  type RegistroEditable,
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
  // Se comparan medianoches (no el instante actual): la edad civil cambia a
  // las 00:00, y el round absorbe el desfase de ±1 h del cambio de horario
  const medianocheHoy = new Date(hoy)
  medianocheHoy.setHours(0, 0, 0, 0)
  const dias = Math.max(
    0,
    Math.round((medianocheHoy.getTime() - nacimiento.getTime()) / 86_400_000),
  )

  if (dias < 7) return { unidad: 'dias', mayor: 0, dias }
  if (dias < 70) return { unidad: 'semanas', mayor: Math.floor(dias / 7), dias: dias % 7 }

  // Meses de calendario + días sueltos. El ancla clampa el día del mes:
  // una nacida el 31 "cumple mes" el 28/30 en los meses cortos (setMonth a
  // pelo desbordaría a principios del mes siguiente y congelaría la edad)
  const anclaDe = (meses: number): Date => {
    const base = new Date(nacimiento.getFullYear(), nacimiento.getMonth() + meses, 1)
    const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
    return new Date(base.getFullYear(), base.getMonth(), Math.min(nacimiento.getDate(), ultimoDia))
  }
  let meses =
    (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + (hoy.getMonth() - nacimiento.getMonth())
  if (anclaDe(meses).getTime() > medianocheHoy.getTime()) meses--
  const diasSueltos = Math.round((medianocheHoy.getTime() - anclaDe(meses).getTime()) / 86_400_000)
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

/**
 * Un <input type="number"> vaciado llega como '' (no null) por looseToNumber:
 * normaliza a numero o null antes de mandar nada a la base de datos.
 */
export function numeroONull(valor: number | null): number | null {
  if (valor === null || (valor as unknown) === '') return null
  return Number.isNaN(Number(valor)) ? null : Number(valor)
}

/**
 * Quita el emoji inicial de un texto de registro ("🍼 Biberón — 120 ml" →
 * "Biberón — 120 ml") cuando la vista pinta su propio icono delante.
 */
export function sinEmojiInicial(texto: string): string {
  return texto.replace(/^\S+\s+/u, '')
}

/** Mensaje legible de cualquier error capturado (patron comun de las vistas) */
export function mensajeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Hora corta local "HH:MM" de un instante ISO */
export function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

/** 'YYYY-MM-DD' → 'DD/MM' (ejes de las graficas) */
export function fechaCortaDia(dia: string): string {
  const [, mes, d] = dia.split('-')
  return `${d}/${mes}`
}

/** "mié, 12 ago, 10:30" — citas en Hoy y en la vista de Citas */
export function fechaHoraCita(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "12 ago" — acepta ISO completo o 'YYYY-MM-DD' (se interpreta local) */
export function fechaDiaCorta(fecha: string): string {
  const iso = fecha.includes('T') ? fecha : fecha + 'T00:00:00'
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

/**
 * Rango "ultimos N dias": ISO del inicio del rango (hoy incluido) y, para
 * sueños, un dia antes — el nocturno que empezo la vispera aporta sus horas
 * de madrugada al primer dia visible.
 */
export function rangoDesde(
  dias: number,
  ahora: Date = new Date(),
): { desdeIso: string; desdeSuenosIso: string } {
  const desde = new Date(ahora)
  desde.setDate(desde.getDate() - (dias - 1))
  desde.setHours(0, 0, 0, 0)
  const desdeSuenos = new Date(desde)
  desdeSuenos.setDate(desdeSuenos.getDate() - 1)
  return { desdeIso: desde.toISOString(), desdeSuenosIso: desdeSuenos.toISOString() }
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
  if (e.tipo === 'ejercicio') {
    const subtipo = ETIQUETAS_EJERCICIO[e.subtipo ?? 'tummy_time']
    const duracion = e.duracion_min !== null ? ` — ${formatoDuracion(e.duracion_min)}` : ''
    return `🤸 Ejercicio (${subtipo})${duracion}${e.descripcion ? ` · ${e.descripcion}` : ''}`
  }
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
  // Medianoche del día siguiente vía Date (no +24h fijas): así los días de
  // cambio de hora (23/25 h) se recortan donde toca
  const siguiente = new Date(dia + 'T00:00:00')
  siguiente.setDate(siguiente.getDate() + 1)
  const finDia = siguiente.getTime()
  const desde = Math.max(new Date(inicioIso).getTime(), inicioDia)
  // Un intervalo abierto (fin null) se recorta en `ahora`, con tope de 24 h
  // desde su inicio: un sueño olvidado sin terminar no debe pintar de sueño
  // todos los dias posteriores
  const topeAbierto = Math.min(ahora.getTime(), new Date(inicioIso).getTime() + 24 * 3600_000)
  const hasta = Math.min(finIso ? new Date(finIso).getTime() : topeAbierto, finDia)
  if (hasta <= desde) return null
  return {
    desdeMin: Math.round((desde - inicioDia) / 60_000),
    hastaMin: Math.round((hasta - inicioDia) / 60_000),
  }
}

/**
 * Minutos de sueño que caen dentro de un día local: cada sueño aporta solo
 * su parte de ese día (los nocturnos que cruzan medianoche se reparten
 * entre los dos días; los abiertos se recortan en `ahora`).
 */
export function minutosSuenoEnDia(suenos: Sueno[], dia: string, ahora: Date = new Date()): number {
  let minutos = 0
  for (const s of suenos) {
    const tramo = tramoEnDia(s.inicio, s.fin, dia, ahora)
    if (tramo) minutos += tramo.hastaMin - tramo.desdeMin
  }
  return minutos
}

/**
 * Un sueño tal y como se MUESTRA en un día concreto: los nocturnos que
 * cruzan la medianoche aparecen en los dos días (solo presentación — el
 * registro vive en su día de inicio), cada uno con los minutos que le
 * corresponden y su aviso.
 */
export interface SuenoDeDia {
  sueno: Sueno
  /** Minutos del sueño que caen dentro de este día */
  minutosDelDia: number
  /** Empezó un día anterior (fila "prestada" con aviso) */
  empezoAntes: boolean
  /** Sigue después de la medianoche (aporta parte al día siguiente) */
  sigueDespues: boolean
  /** Hora ISO para ordenar la línea de tiempo (00:00 si empezó antes) */
  horaOrden: string
}

/** Sueños visibles en un día local, con su parte y avisos de cruce */
export function suenosDeDia(suenos: Sueno[], dia: string, ahora: Date = new Date()): SuenoDeDia[] {
  const resultado: SuenoDeDia[] = []
  for (const s of suenos) {
    const tramo = tramoEnDia(s.inicio, s.fin, dia, ahora)
    if (!tramo) continue
    const empezoAntes = claveDia(s.inicio) < dia
    // Fin efectivo: para un sueño ABIERTO, el mismo tope que usa
    // tramoEnDia (ahora, acotado a 24 h). Sin él, el sueño en curso que
    // cruza la medianoche no llevaba el aviso "sigue tras medianoche"
    // aunque el resumen del día solo contase su parte
    const finEfectivoMs =
      s.fin !== null
        ? new Date(s.fin).getTime()
        : Math.min(ahora.getTime(), new Date(s.inicio).getTime() + 24 * 3_600_000)
    resultado.push({
      sueno: s,
      minutosDelDia: tramo.hastaMin - tramo.desdeMin,
      empezoAntes,
      sigueDespues: claveDia(new Date(finEfectivoMs).toISOString()) > dia,
      horaOrden: empezoAntes ? new Date(dia + 'T00:00:00').toISOString() : s.inicio,
    })
  }
  return resultado
}

/** Fila de la línea de tiempo de un día (la usan Hoy y el Historial) */
export interface FilaDia {
  id: string
  /** ISO para ordenar (00:00 del día si el sueño empezó el día anterior) */
  hora: string
  /** Texto completo, con su emoji (la vista lo quita si pinta icono) */
  texto: string
  /** Clave de icono en ICONOS_REGISTRO (branding) */
  icono: string
  editable: RegistroEditable
}

/**
 * Las filas de registros de un día local: tomas, sueños (incluido el
 * nocturno que cruza la medianoche, con su aviso), pañales y eventos,
 * ordenadas por hora. ÚNICA fuente del formato de fila: Hoy añade encima
 * el borrado y el Historial la usa tal cual — un tipo de registro nuevo
 * se cablea solo aquí.
 */
export function filasDeDia(
  datos: { tomas: Toma[]; suenos: Sueno[]; panales: Panal[]; eventos: Evento[] },
  dia: string,
  ahora: Date = new Date(),
  orden: 'asc' | 'desc' = 'asc',
): FilaDia[] {
  const filas: FilaDia[] = [
    ...datos.tomas
      .filter((t) => claveDia(t.inicio) === dia)
      .map((t): FilaDia => ({
        id: t.id,
        hora: t.inicio,
        texto: textoToma(t),
        icono: 'toma',
        editable: { kind: 'toma', toma: t },
      })),
    // Sueños VISIBLES en el día: el que cruza la medianoche aparece en
    // ambos días con su parte (solo presentación, el registro no se mueve)
    ...suenosDeDia(datos.suenos, dia, ahora).map((v): FilaDia => ({
      id: v.sueno.id,
      hora: v.horaOrden,
      texto: textoSuenoEnDia(v),
      icono: 'sueno',
      editable: { kind: 'sueno', sueno: v.sueno },
    })),
    ...datos.panales
      .filter((p) => claveDia(p.fecha) === dia)
      .map((p): FilaDia => ({
        id: p.id,
        hora: p.fecha,
        texto: textoPanal(p),
        icono: p.tipo === 'pis' ? 'pis' : 'caca',
        editable: { kind: 'panal', panal: p },
      })),
    ...datos.eventos
      .filter((e) => claveDia(e.fecha) === dia)
      .map((e): FilaDia => ({
        id: e.id,
        hora: e.fecha,
        texto: textoEvento(e),
        icono: e.tipo,
        editable: { kind: 'evento', evento: e },
      })),
  ]
  return filas.sort((a, b) =>
    orden === 'asc' ? a.hora.localeCompare(b.hora) : b.hora.localeCompare(a.hora),
  )
}

/**
 * Texto de la fila de un sueño mostrado en un día concreto: el de siempre
 * y, si cruza la medianoche, el aviso con la parte de este día.
 */
export function textoSuenoEnDia(v: SuenoDeDia): string {
  const base = textoSueno(v.sueno)
  if (v.empezoAntes)
    return `${base} · empezó el día anterior (${formatoDuracion(v.minutosDelDia)} de este día)`
  if (v.sigueDespues)
    return `${base} · sigue tras medianoche (${formatoDuracion(v.minutosDelDia)} de este día)`
  return base
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

/** Percentil OMS redondeado de una medida en cierta fecha, o null */
export function percentilRedondeado(
  tipo: MedidaOMS,
  valor: number | null,
  fechaNacimiento: string | null | undefined,
  fecha: string,
): number | null {
  if (!valor || !fechaNacimiento) return null
  const p = percentilOMS(tipo, valor, edadDias(fechaNacimiento, fecha))
  return p === null ? null : Math.round(p)
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

// z de los percentiles decilares (cuantiles de la normal estándar).
// El P0 y el P100 exactos no existen en una normal: se usan los extremos
// de la cartilla OMS (P0.1 y P99.9, ±3 desviaciones) con esas etiquetas.
const Z_DECILES: Record<number, number> = {
  0: -3.0902323062,
  10: -1.2815515655,
  20: -0.8416212336,
  30: -0.5244005127,
  40: -0.2533471031,
  50: 0,
  60: 0.2533471031,
  70: 0.5244005127,
  80: 0.8416212336,
  90: 1.2815515655,
  100: 3.0902323062,
}

/**
 * Valor de un percentil decilar OMS (10, 20, ... 90) de una medida de niña
 * a cierta edad, en unidades de la app — para pintar las curvas estándar
 * de fondo en las gráficas de crecimiento. null fuera de rango.
 */
export function valorPercentilOMS(tipo: MedidaOMS, percentil: number, dias: number): number | null {
  const z = Z_DECILES[percentil]
  if (z === undefined) return null
  const lms = lmsInterpolado(tipo, dias)
  if (!lms) return null
  const { l, m, s } = lms
  return l === 0 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l)
}

/** Duración real de un día local en minutos (1380/1440/1500 según DST) */
export function minutosEnDia(dia: string): number {
  const inicio = new Date(dia + 'T00:00:00')
  const fin = new Date(dia + 'T00:00:00')
  fin.setDate(fin.getDate() + 1)
  return Math.round((fin.getTime() - inicio.getTime()) / 60_000)
}

/** ml de biberon tomados en un dia local (hermana de minutosSuenoEnDia) */
export function mlEnDia(tomas: Toma[], dia: string): number {
  let total = 0
  for (const toma of tomas) {
    if (toma.cantidad_ml && claveDia(toma.inicio) === dia) total += toma.cantidad_ml
  }
  return total
}

export interface PuntoGrafica {
  etiqueta: string // fecha 'YYYY-MM-DD'
  valor: number
}

/** Punto de una serie por edad en días (gráficas de crecimiento) */
export interface PuntoSerieDia {
  dia: number
  valor: number
  etiqueta: string
  /** true = interpolado en el borde de la ventana (sin círculo ni tooltip) */
  virtual?: boolean
}

/**
 * Recorta una serie a la ventana [desde, hasta] de días SIN perder la
 * continuidad: si hay una medida anterior al borde (o posterior), se añade
 * un punto VIRTUAL interpolado en el borde para que la línea entre/salga
 * de la gráfica a la altura correcta en vez de aparecer flotando.
 */
export function recortarSerieAVentana(
  puntos: PuntoSerieDia[],
  desde: number,
  hasta: number,
): PuntoSerieDia[] {
  const orden = [...puntos].sort((a, b) => a.dia - b.dia)
  const dentro = orden.filter((p) => p.dia >= desde && p.dia <= hasta)
  const virtual = (a: PuntoSerieDia, b: PuntoSerieDia, dia: number): PuntoSerieDia => ({
    dia,
    valor: a.valor + ((b.valor - a.valor) * (dia - a.dia)) / (b.dia - a.dia),
    etiqueta: '',
    virtual: true,
  })
  const anterior = orden.filter((p) => p.dia < desde).pop()
  const posterior = orden.find((p) => p.dia > hasta)
  // Un único segmento que cruza la ventana entera: entra y sale
  if (dentro.length === 0) {
    return anterior && posterior
      ? [virtual(anterior, posterior, desde), virtual(anterior, posterior, hasta)]
      : []
  }
  const resultado = [...dentro]
  if (anterior && resultado[0]!.dia > desde) {
    resultado.unshift(virtual(anterior, resultado[0]!, desde))
  }
  if (posterior && resultado[resultado.length - 1]!.dia < hasta) {
    resultado.push(virtual(resultado[resultado.length - 1]!, posterior, hasta))
  }
  return resultado
}

/** Quita los puntos iniciales sin valor (antes del primer registro real) */
export function recortarVaciosIniciales(puntos: PuntoGrafica[]): PuntoGrafica[] {
  const primero = puntos.findIndex((p) => p.valor > 0)
  return primero === -1 ? [] : puntos.slice(primero)
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
