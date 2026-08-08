/**
 * frasesNeneni.ts — Lo que dice Ñeñeñi en su bocadillo (lógica pura).
 *
 * Convierte unas Predicciones en las frases en primera persona del panel
 * (próxima toma, sueño, pronóstico de la noche) y en la nota de cuánto
 * pesa ya el patrón personal. Vive en models/ (y no en el componente)
 * porque contiene reglas de interpretación —"ya toca", umbral de
 * aprendizaje, singular/plural del pronóstico— que se testean en
 * frasesNeneni.spec.ts, igual que las explicaciones de porQueLlora().
 */
import { formatoDuracion, horaCorta } from './CarlotaModel'
import type { Predicciones, PronosticoNoche } from './MimePredictor'

/** Frases del bocadillo, en el orden en que las "dice" Ñeñeñi */
export function frasesNeneni(
  p: Predicciones,
  noche: PronosticoNoche | null,
  nombre: string,
): string[] {
  const lista: string[] = []

  // Próxima toma
  if (p.proximaToma) {
    const t = p.proximaToma
    if (t.minutosRestantes <= 0) {
      lista.push(`¡La próxima toma ya toca! La esperaba hacia las ${horaCorta(t.prevista)}.`)
    } else {
      lista.push(
        `Yo creo que la próxima toma será a las ${horaCorta(t.prevista)} (entre las ${horaCorta(t.franja.desde)} y las ${horaCorta(t.franja.hasta)}).`,
      )
    }
  } else {
    lista.push('Todavía no tengo tomas registradas para predecir la siguiente.')
  }

  // Sueño
  if (p.durmiendo) {
    lista.push(`Ahora mismo ${nombre} está durmiendo… ¡a aprovechar!`)
  } else if (p.proximaSiesta) {
    const s = p.proximaSiesta
    if (s.minutosRestantes <= 0) {
      lista.push('Ya le va tocando dormir: lleva despierta más de lo habitual en ella.')
    } else {
      lista.push(
        `Y en unos ${formatoDuracion(s.minutosRestantes)} le tocará dormir, hacia las ${horaCorta(s.prevista)}.`,
      )
    }
  }

  // Pronóstico de la noche (solo llega en franja nocturna)
  if (noche) {
    if (noche.tomas.length === 0) {
      lista.push('Con su ritmo, no espero más tomas hasta las 07:00. ¡Feliz noche!')
    } else {
      const horas = noche.tomas.map((t) => horaCorta(t)).join(' y a las ')
      lista.push(
        `Esta noche creo que ${nombre} pedirá ${noche.tomas.length === 1 ? 'una toma más' : `${noche.tomas.length} tomas más`}, más o menos cada ${formatoDuracion(noche.intervaloMin)}: a las ${horas}.`,
      )
    }
  }
  return lista
}

/** Nota de honestidad: cuánto pesa ya el patrón propio frente a la base */
export function notaAprendizaje(p: Predicciones | null, nombre: string): string {
  const t = p?.proximaToma
  if (!t) return 'Ñeñeñi aprende del ritmo real según se registran tomas, sueños y pañales.'
  const pct = Math.round(t.pesoPersonal * 100)
  if (pct < 40)
    return `Aún estoy aprendiendo su ritmo (el patrón propio solo pesa un ${pct}%): de momento me apoyo en lo típico para su edad.`
  const reciente =
    t.pesoReciente > 0 ? ` y lo que va de hoy un ${Math.round(t.pesoReciente * 100)}%` : ''
  return `El ritmo propio de ${nombre} ya pesa un ${pct}% en mi cálculo${reciente}.`
}
