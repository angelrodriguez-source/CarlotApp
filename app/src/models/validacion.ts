/**
 * validacion.ts — Controles de rango de las entradas (lógica pura).
 *
 * Todos los formularios validan contra estas reglas ANTES de llamar al
 * servicio: fechas dentro de [nacimiento, ahora+tolerancia] y cantidades
 * dentro de rangos plausibles. Un solo sitio parametrizable
 * (LIMITES_ENTRADA) y comprobaciones O(1) sin dependencias — el coste en
 * ejecución es despreciable frente al round-trip que evitan.
 *
 * Filosofía: el rango es de PLAUSIBILIDAD, no de normalidad — lo bastante
 * ancho para no molestar nunca con un valor real (un biberón de 300 ml
 * pasa), lo bastante estrecho para cazar el error de tecleo típico (un 0
 * de más, AM/PM confundido, el año cambiado). Cada función devuelve el
 * mensaje de error o null si el valor es aceptable.
 */

export interface RangoEntrada {
  min: number
  max: number
  /** Unidad para el mensaje ("ml", "min", "g", "cm") */
  unidad: string
  /** Nombre legible del campo para el mensaje */
  etiqueta: string
}

/** Único punto de ajuste de todos los rangos de entrada de la app */
export const LIMITES_ENTRADA = {
  /** Margen de futuro tolerado (desfase entre relojes), en minutos */
  toleranciaFuturoMin: 5,
  /** Biberón: de un chupito a un biberón enorme */
  tomaMl: { min: 5, max: 500, unidad: 'ml', etiqueta: 'La cantidad del biberón' },
  /** Toma de pecho */
  tomaPechoMin: { min: 1, max: 120, unidad: 'min', etiqueta: 'La duración de la toma' },
  /** Un sueño de más de 16 h seguidas es un registro olvidado o un error */
  suenoMin: { min: 1, max: 16 * 60, unidad: 'min', etiqueta: 'La duración del sueño' },
  /** Ejercicio (Tummy Time...): de 1 min a 3 h */
  ejercicioMin: { min: 1, max: 180, unidad: 'min', etiqueta: 'La duración del ejercicio' },
  /** Peso: de prematura a más que percentil 100 con 2 años */
  pesoGramos: { min: 1500, max: 25000, unidad: 'g', etiqueta: 'El peso' },
  alturaCm: { min: 40, max: 120, unidad: 'cm', etiqueta: 'La altura' },
  perimetroCm: { min: 28, max: 60, unidad: 'cm', etiqueta: 'El perímetro craneal' },
} as const

/**
 * Valida un número opcional contra su rango. null/undefined pasa (lo
 * obligatorio ya lo exige el formulario con `required`).
 */
export function validarRango(valor: number | null | undefined, rango: RangoEntrada): string | null {
  if (valor === null || valor === undefined) return null
  if (!Number.isFinite(valor)) return `${rango.etiqueta} no es un número válido`
  if (valor < rango.min || valor > rango.max)
    return `${rango.etiqueta} debería estar entre ${rango.min} y ${rango.max} ${rango.unidad} (revísala)`
  return null
}

/**
 * Valida la fecha/hora de un registro: dentro de la vida de la bebé y no
 * en el futuro (con tolerancia de relojes). `nacimiento` es 'YYYY-MM-DD'.
 */
export function validarFechaRegistro(
  fecha: Date,
  nacimiento: string,
  ahora: Date = new Date(),
): string | null {
  if (Number.isNaN(fecha.getTime())) return 'La fecha no es válida'
  const tope = ahora.getTime() + LIMITES_ENTRADA.toleranciaFuturoMin * 60_000
  if (fecha.getTime() > tope) return 'La fecha está en el futuro (revísala)'
  const desde = new Date(nacimiento + 'T00:00:00')
  if (!Number.isNaN(desde.getTime()) && fecha.getTime() < desde.getTime())
    return 'La fecha es anterior al nacimiento (revísala)'
  return null
}

/**
 * Valida un tramo de sueño ya cerrado: fin posterior al inicio y duración
 * plausible (LIMITES_ENTRADA.suenoMin).
 */
export function validarTramoSueno(inicio: Date, fin: Date): string | null {
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return 'La fecha no es válida'
  const minutos = (fin.getTime() - inicio.getTime()) / 60_000
  if (minutos <= 0) return 'El fin del sueño debe ser posterior al inicio (revisa la fecha)'
  if (minutos > LIMITES_ENTRADA.suenoMin.max)
    return `Un sueño de más de ${LIMITES_ENTRADA.suenoMin.max / 60} h seguidas parece un error (revisa las fechas)`
  return null
}

/**
 * Valida un día suelto 'YYYY-MM-DD' (las medidas van por día, sin hora):
 * ni futuro ni anterior al nacimiento. Comparación lexicográfica — para
 * fechas ISO es equivalente a la cronológica y no depende de zonas.
 */
export function validarFechaDia(dia: string, nacimiento: string, hoy: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return 'La fecha no es válida'
  if (dia > hoy) return 'La fecha está en el futuro (revísala)'
  if (nacimiento && dia < nacimiento) return 'La fecha es anterior al nacimiento (revísala)'
  return null
}

/** Devuelve el primer error no nulo, o null si todo pasa */
export function primerError(...errores: (string | null)[]): string | null {
  for (const e of errores) if (e !== null) return e
  return null
}
