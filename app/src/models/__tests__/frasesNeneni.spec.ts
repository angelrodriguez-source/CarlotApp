import { describe, it, expect } from 'vitest'
import { frasesNeneni, notaAprendizaje } from '../frasesNeneni'
import type { Prediccion, Predicciones, PronosticoNoche } from '../MimePredictor'

/** Predicción mínima para componer escenarios */
function prediccion(sobre: Partial<Prediccion> = {}): Prediccion {
  return {
    prevista: new Date(2026, 7, 7, 16, 30).toISOString(),
    franja: {
      desde: new Date(2026, 7, 7, 16, 0).toISOString(),
      hasta: new Date(2026, 7, 7, 17, 0).toISOString(),
    },
    minutosRestantes: 45,
    pesoPersonal: 0.8,
    pesoReciente: 0.5,
    muestras: 20,
    ...sobre,
  }
}

function predicciones(sobre: Partial<Predicciones> = {}): Predicciones {
  return {
    calculadoEn: new Date(2026, 7, 7, 15, 45).toISOString(),
    edadDias: 63,
    proximaToma: prediccion(),
    proximaSiesta: prediccion({ minutosRestantes: 80 }),
    durmiendo: false,
    incomodidad: { probabilidad: 0.2, minutosDesdeUltimoPanal: 90 },
    ...sobre,
  }
}

describe('frasesNeneni', () => {
  it('caso normal: toma con franja y siesta con duración legible', () => {
    const frases = frasesNeneni(predicciones(), null, 'Carlota')
    expect(frases).toHaveLength(2)
    expect(frases[0]).toContain('la próxima toma será a las')
    expect(frases[0]).toContain('entre las')
    expect(frases[1]).toContain('1 h 20 min')
    expect(frases[1]).toContain('le tocará dormir')
  })

  it('la cantidad de la última toma añade su matiz (corta/copiosa/neutra)', () => {
    const corta = frasesNeneni(
      predicciones({ proximaToma: prediccion({ factorCantidad: 0.82 }) }),
      null,
      'Carlota',
    )
    expect(corta[1]).toContain('más corta de lo habitual')
    const copiosa = frasesNeneni(
      predicciones({ proximaToma: prediccion({ factorCantidad: 1.15 }) }),
      null,
      'Carlota',
    )
    expect(copiosa[1]).toContain('aguante un poco más')
    const neutra = frasesNeneni(
      predicciones({ proximaToma: prediccion({ factorCantidad: 1 }) }),
      null,
      'Carlota',
    )
    expect(neutra.join(' ')).not.toContain('corta de lo habitual')
  })

  it('"ya toca": minutos restantes <= 0 cambia la frase', () => {
    const frases = frasesNeneni(
      predicciones({
        proximaToma: prediccion({ minutosRestantes: -10 }),
        proximaSiesta: prediccion({ minutosRestantes: 0 }),
      }),
      null,
      'Carlota',
    )
    expect(frases[0]).toContain('¡La próxima toma ya toca!')
    expect(frases[1]).toContain('Ya le va tocando dormir')
  })

  it('durmiendo: no anuncia siesta, dice que está durmiendo', () => {
    const frases = frasesNeneni(
      predicciones({ durmiendo: true, proximaSiesta: null }),
      null,
      'Carlota',
    )
    expect(frases[1]).toContain('Carlota está durmiendo')
  })

  it('sin ningún dato: frase honesta de que no puede predecir', () => {
    const frases = frasesNeneni(
      predicciones({ proximaToma: null, proximaSiesta: null }),
      null,
      'Carlota',
    )
    expect(frases[0]).toContain('Todavía no tengo tomas registradas')
    expect(frases).toHaveLength(1)
  })

  it('pronóstico nocturno: singular, plural y noche sin tomas', () => {
    const base: PronosticoNoche = {
      intervaloMin: 240,
      tomas: [new Date(2026, 7, 8, 1, 30).toISOString()],
      pesoPersonal: 0.8,
      pesoReciente: 0,
    }
    const una = frasesNeneni(predicciones(), base, 'Carlota')
    expect(una[una.length - 1]).toContain('una toma más')
    expect(una[una.length - 1]).toContain('cada 4 h')

    const dos = frasesNeneni(
      predicciones(),
      { ...base, tomas: [...base.tomas, new Date(2026, 7, 8, 5, 30).toISOString()] },
      'Carlota',
    )
    expect(dos[dos.length - 1]).toContain('2 tomas más')

    const ninguna = frasesNeneni(predicciones(), { ...base, tomas: [] }, 'Carlota')
    expect(ninguna[ninguna.length - 1]).toContain('no espero más tomas hasta las 07:00')
  })
})

describe('notaAprendizaje', () => {
  it('sin predicción: frase genérica de aprendizaje', () => {
    expect(notaAprendizaje(null, 'Carlota')).toContain('aprende del ritmo real')
  })

  it('peso personal < 40%: reconoce que se apoya en la base', () => {
    const nota = notaAprendizaje(
      predicciones({ proximaToma: prediccion({ pesoPersonal: 0.25 }) }),
      'Carlota',
    )
    expect(nota).toContain('Aún estoy aprendiendo')
    expect(nota).toContain('25%')
  })

  it('peso personal alto: lo dice con el porcentaje reciente si lo hay', () => {
    const nota = notaAprendizaje(predicciones(), 'Carlota')
    expect(nota).toContain('80%')
    expect(nota).toContain('lo que va de hoy un 50%')
    const sinReciente = notaAprendizaje(
      predicciones({ proximaToma: prediccion({ pesoReciente: 0 }) }),
      'Carlota',
    )
    expect(sinReciente).not.toContain('lo que va de hoy')
  })
})
