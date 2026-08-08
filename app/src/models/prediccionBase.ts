/**
 * prediccionBase.ts — Línea base POBLACIONAL del Mime Predictor.
 *
 * Valores típicos por edad (en semanas) recopilados de fuentes públicas,
 * para bebés alimentados con biberón de fórmula (el caso de Carlota):
 *
 * - Ventanas de vigilia (minutos despierta entre sueños):
 *   Taking Cara Babies (takingcarababies.com/blogs/sleep-basics/wake-windows),
 *   Huckleberry (huckleberrycare.com/blog/first-year-of-sleep-expectations)
 *   y Cleveland Clinic (health.clevelandclinic.org/wake-windows-by-age).
 * - Intervalos entre tomas: AAP/Enfamil — fórmula cada 2.5-3.5 h en las
 *   primeras semanas, alargándose hacia 3-4 h + sólidos desde los 6 meses
 *   (huckleberrycare.com/blog/baby-feeding-and-nap-schedule).
 * - Cambios de pañal al día: ~8-10 recién nacida bajando a ~5-6 desde el
 *   tercer mes (pampers.com, healthline.com/health/parenting).
 *
 * Igual que referenciaOMS y semanasDesarrollo, esta capa vive PRECARGADA
 * en el código (versionada y testeable, sin red en runtime); la BBDD solo
 * guarda los RESULTADOS del cálculo (tabla `predicciones`).
 */

export interface RangoMin {
  min: number // minutos
  max: number // minutos
}

export interface EtapaPrediccion {
  /** Etapa aplicable desde esta semana de vida (incluida) */
  semanaDesde: number
  /** Minutos que aguanta despierta entre sueños */
  ventanaVigilia: RangoMin
  /** Minutos entre inicios de toma durante el día */
  intervaloToma: RangoMin
  /** Minutos entre tomas por la noche (se alarga con la edad) */
  intervaloTomaNoche: RangoMin
  /** Cambios de pañal típicos por día (para la señal de incomodidad) */
  panalesDia: number
}

export const ETAPAS_PREDICCION: readonly EtapaPrediccion[] = [
  {
    semanaDesde: 0,
    ventanaVigilia: { min: 30, max: 60 },
    intervaloToma: { min: 120, max: 180 },
    intervaloTomaNoche: { min: 150, max: 240 },
    panalesDia: 8,
  },
  {
    semanaDesde: 4,
    ventanaVigilia: { min: 60, max: 90 },
    intervaloToma: { min: 150, max: 210 },
    intervaloTomaNoche: { min: 180, max: 300 },
    panalesDia: 7,
  },
  {
    semanaDesde: 8,
    ventanaVigilia: { min: 60, max: 105 },
    intervaloToma: { min: 150, max: 240 },
    intervaloTomaNoche: { min: 240, max: 360 },
    panalesDia: 6,
  },
  {
    semanaDesde: 13,
    ventanaVigilia: { min: 75, max: 120 },
    intervaloToma: { min: 180, max: 240 },
    intervaloTomaNoche: { min: 300, max: 480 },
    panalesDia: 6,
  },
  {
    semanaDesde: 17,
    ventanaVigilia: { min: 90, max: 135 },
    intervaloToma: { min: 180, max: 240 },
    intervaloTomaNoche: { min: 360, max: 600 },
    panalesDia: 6,
  },
  {
    semanaDesde: 22,
    ventanaVigilia: { min: 120, max: 150 },
    intervaloToma: { min: 210, max: 270 },
    intervaloTomaNoche: { min: 480, max: 700 },
    panalesDia: 5,
  },
  {
    semanaDesde: 26,
    ventanaVigilia: { min: 120, max: 180 },
    intervaloToma: { min: 210, max: 300 },
    intervaloTomaNoche: { min: 540, max: 720 },
    panalesDia: 5,
  },
  {
    semanaDesde: 30,
    ventanaVigilia: { min: 150, max: 210 },
    intervaloToma: { min: 240, max: 300 },
    intervaloTomaNoche: { min: 600, max: 720 },
    panalesDia: 5,
  },
  {
    semanaDesde: 39,
    ventanaVigilia: { min: 180, max: 240 },
    intervaloToma: { min: 240, max: 330 },
    intervaloTomaNoche: { min: 600, max: 720 },
    panalesDia: 5,
  },
  {
    semanaDesde: 48,
    ventanaVigilia: { min: 180, max: 300 },
    intervaloToma: { min: 270, max: 360 },
    intervaloTomaNoche: { min: 600, max: 720 },
    panalesDia: 4,
  },
  {
    semanaDesde: 61,
    ventanaVigilia: { min: 240, max: 360 },
    intervaloToma: { min: 270, max: 390 },
    intervaloTomaNoche: { min: 600, max: 720 },
    panalesDia: 4,
  },
] as const

/** Etapa de la línea base aplicable a una edad en días (la última que empieza antes) */
export function etapaPrediccion(edadDias: number): EtapaPrediccion {
  const semana = Math.max(0, Math.floor(edadDias / 7))
  let aplicable = ETAPAS_PREDICCION[0]!
  for (const etapa of ETAPAS_PREDICCION) {
    if (etapa.semanaDesde <= semana) aplicable = etapa
    else break
  }
  return aplicable
}
