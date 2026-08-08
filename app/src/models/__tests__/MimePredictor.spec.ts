import { describe, it, expect } from 'vitest'
import {
  intervalosToma,
  porQueLlora,
  predecir,
  pronosticoNoche,
  ventanasVigilia,
  type DatosPredictor,
} from '../MimePredictor'
import { etapaPrediccion } from '../prediccionBase'
import type { Panal, Sueno, Toma } from '../../types'

/**
 * Backtesting del Mime Predictor sobre BEBÉS SIMULADOS con parámetros
 * conocidos: se genera un histórico sintético (RNG con semilla, un
 * comportamiento "real" conocido), se predice cada evento usando SOLO los
 * anteriores (walk-forward) y se mide el error absoluto medio en minutos.
 * Los umbrales de estos tests son el contrato de fiabilidad del algoritmo;
 * los parámetros de AJUSTES salieron de barrer valores contra este mismo
 * harness (k=3, histórico=7 días — ver comentario en MimePredictor.ts).
 */

// ---- RNG determinista (LCG + Box-Muller) ----

function crearRng(semilla: number) {
  let estado = semilla >>> 0
  const uniforme = () => {
    estado = (estado * 1664525 + 1013904223) >>> 0
    return estado / 2 ** 32
  }
  const normal = (mu: number, sd: number) => {
    const u1 = Math.max(uniforme(), 1e-9)
    const u2 = uniforme()
    return mu + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }
  return { uniforme, normal }
}

// ---- Simulador de bebé ----

interface ConfigBebe {
  dias: number
  /** Intervalo real entre tomas de día (min) */
  tomaDiaMu: number
  tomaDiaSd: number
  /** Ventana de vigilia real (min) */
  vigiliaMu: number
  vigiliaSd: number
  /** Duración de siesta (min) */
  siestaMu: number
  siestaSd: number
  semilla: number
  /** Override del intervalo de toma SOLO para el último día (brote...) */
  hoyTomaMu?: number
}

interface BebeSimulado extends DatosPredictor {
  iniciosTomaDia: Date[]
  iniciosSiesta: Date[]
}

/** Días completos terminando el 2026-08-07 (fechas locales, como la app) */
function generarBebe(config: ConfigBebe): BebeSimulado {
  const rng = crearRng(config.semilla)
  const tomas: Toma[] = []
  const suenos: Sueno[] = []
  const panales: Panal[] = []
  const iniciosTomaDia: Date[] = []
  const iniciosSiesta: Date[] = []
  let id = 0
  const nuevaId = () => `sim-${id++}`

  for (let d = 0; d < config.dias; d++) {
    const base = new Date(2026, 7, 7 - config.dias + 1 + d) // medianoche local
    const esUltimoDia = d === config.dias - 1
    const tomaMu =
      esUltimoDia && config.hoyTomaMu !== undefined ? config.hoyTomaMu : config.tomaDiaMu

    // Tomas de día: desde ~7:30 cada tomaDiaMu±sd hasta las 21:00
    let t = 7.5 * 60 + rng.normal(0, 20)
    while (t < 21 * 60) {
      const inicio = new Date(base.getTime() + t * 60_000)
      tomas.push({
        id: nuevaId(),
        bebe_id: 'b',
        inicio: inicio.toISOString(),
        fin: null,
        tipo: 'biberon_formula',
        cantidad_ml: 120,
        notas: null,
      })
      iniciosTomaDia.push(inicio)
      t += Math.max(60, rng.normal(tomaMu, config.tomaDiaSd))
    }
    // Toma nocturna (~3:30±40)
    const nocturna = new Date(base.getTime() + (3.5 * 60 + rng.normal(0, 40)) * 60_000)
    tomas.push({
      id: nuevaId(),
      bebe_id: 'b',
      inicio: nocturna.toISOString(),
      fin: null,
      tipo: 'biberon_formula',
      cantidad_ml: 90,
      notas: null,
    })

    // Siestas: despierta ~7:00; vigilia±sd → siesta±sd, hasta las 20:00
    let s = 7 * 60 + rng.normal(0, 15)
    while (true) {
      const vigilia = Math.max(20, rng.normal(config.vigiliaMu, config.vigiliaSd))
      const inicioSiesta = s + vigilia
      if (inicioSiesta > 19.5 * 60) break
      const duracion = Math.max(20, rng.normal(config.siestaMu, config.siestaSd))
      const inicio = new Date(base.getTime() + inicioSiesta * 60_000)
      suenos.push({
        id: nuevaId(),
        bebe_id: 'b',
        inicio: inicio.toISOString(),
        fin: new Date(base.getTime() + (inicioSiesta + duracion) * 60_000).toISOString(),
        notas: null,
      })
      iniciosSiesta.push(inicio)
      s = inicioSiesta + duracion
    }
    // Sueño nocturno 20:30 → 6:45 del día siguiente
    suenos.push({
      id: nuevaId(),
      bebe_id: 'b',
      inicio: new Date(base.getTime() + (20.5 * 60 + rng.normal(0, 15)) * 60_000).toISOString(),
      fin: new Date(base.getTime() + (30.75 * 60 + rng.normal(0, 20)) * 60_000).toISOString(),
      notas: null,
    })

    // Pañales de día cada ~3h
    let p = 7.75 * 60 + rng.normal(0, 20)
    while (p < 20.5 * 60) {
      panales.push({
        id: nuevaId(),
        bebe_id: 'b',
        fecha: new Date(base.getTime() + p * 60_000).toISOString(),
        tipo: rng.uniforme() < 0.3 ? 'caca' : 'pis',
        cantidad: null,
        notas: null,
      })
      p += Math.max(45, rng.normal(180, 35))
    }
  }
  return { tomas, suenos, panales, iniciosTomaDia, iniciosSiesta }
}

// ---- Walk-forward: predecir cada evento con solo los anteriores ----

function hasta<T extends { [k: string]: unknown }>(items: T[], campo: string, limite: Date): T[] {
  return items.filter((item) => new Date(item[campo] as string).getTime() < limite.getTime())
}

/** MAE en minutos prediciendo cada toma de día de los últimos `diasEval` días */
function maeTomas(bebe: BebeSimulado, edadDias: number, diasEval: number): number {
  const limite = new Date(2026, 7, 7 - diasEval + 1)
  const objetivos = bebe.iniciosTomaDia.filter((f) => f >= limite && f.getHours() >= 9)
  const errores: number[] = []
  for (const objetivo of objetivos) {
    const ahora = new Date(objetivo.getTime() - 30 * 60_000) // media hora antes
    const datos: DatosPredictor = {
      tomas: hasta(bebe.tomas as never, 'inicio', ahora),
      suenos: hasta(bebe.suenos as never, 'inicio', ahora),
      panales: hasta(bebe.panales as never, 'fecha', ahora),
    }
    const prediccion = predecir(datos, edadDias, ahora)
    if (!prediccion.proximaToma) continue
    errores.push(
      Math.abs(new Date(prediccion.proximaToma.prevista).getTime() - objetivo.getTime()) / 60_000,
    )
  }
  return errores.reduce((a, b) => a + b, 0) / errores.length
}

/** MAE en minutos prediciendo cada inicio de siesta (a partir de la 2ª del día) */
function maeSiestas(bebe: BebeSimulado, edadDias: number, diasEval: number): number {
  const limite = new Date(2026, 7, 7 - diasEval + 1)
  const objetivos = bebe.iniciosSiesta.filter((f) => f >= limite && f.getHours() >= 10)
  const errores: number[] = []
  for (const objetivo of objetivos) {
    const ahora = new Date(objetivo.getTime() - 20 * 60_000)
    const datos: DatosPredictor = {
      tomas: hasta(bebe.tomas as never, 'inicio', ahora),
      suenos: hasta(bebe.suenos as never, 'inicio', ahora),
      panales: hasta(bebe.panales as never, 'fecha', ahora),
    }
    const prediccion = predecir(datos, edadDias, ahora)
    if (!prediccion.proximaSiesta || prediccion.durmiendo) continue
    errores.push(
      Math.abs(new Date(prediccion.proximaSiesta.prevista).getTime() - objetivo.getTime()) / 60_000,
    )
  }
  return errores.reduce((a, b) => a + b, 0) / errores.length
}

// ---- Tests de fiabilidad (el contrato del algoritmo) ----

describe('MimePredictor — backtesting con bebés simulados', () => {
  // Bebé regular de 9 semanas: toma cada 180±15, vigilia 80±12
  const regular = generarBebe({
    dias: 14,
    tomaDiaMu: 180,
    tomaDiaSd: 15,
    vigiliaMu: 80,
    vigiliaSd: 12,
    siestaMu: 50,
    siestaSd: 12,
    semilla: 42,
  })

  it('bebé regular: MAE de tomas < 25 min', () => {
    expect(maeTomas(regular, 63, 4)).toBeLessThan(25)
  })

  it('bebé regular: MAE de siestas < 22 min', () => {
    expect(maeSiestas(regular, 63, 4)).toBeLessThan(22)
  })

  it('bebé regular DESVIADO de la base: el patrón personal manda', () => {
    // Toma cada 140 min (la base de 9 semanas dice 150-240 → centro 195):
    // sin capa personal el error sería ~55 min por sesgo de la base
    const desviado = generarBebe({
      dias: 14,
      tomaDiaMu: 140,
      tomaDiaSd: 15,
      vigiliaMu: 110,
      vigiliaSd: 12,
      siestaMu: 45,
      siestaSd: 10,
      semilla: 7,
    })
    expect(maeTomas(desviado, 63, 4)).toBeLessThan(28)
    expect(maeSiestas(desviado, 63, 4)).toBeLessThan(24)
    // Y el peso personal domina con dos semanas de datos
    const ahora = new Date(2026, 7, 7, 12, 0)
    const prediccion = predecir(desviado, 63, ahora)
    expect(prediccion.proximaToma!.pesoPersonal).toBeGreaterThan(0.6)
  })

  it('brote de crecimiento: la capa de HOY corrige al histórico', () => {
    // Histórico de 195 min; hoy pide cada 130 (cluster feeding)
    const brote = generarBebe({
      dias: 10,
      tomaDiaMu: 195,
      tomaDiaSd: 15,
      vigiliaMu: 85,
      vigiliaSd: 12,
      siestaMu: 50,
      siestaSd: 12,
      semilla: 7,
      hoyTomaMu: 130,
    })
    // Evaluando solo las tomas de hoy desde media mañana: sin capa
    // reciente el MAE sería ~33 min (sesgo del histórico); con ella < 25
    const objetivos = brote.iniciosTomaDia.filter((f) => f.getDate() === 7 && f.getHours() >= 11)
    const errores: number[] = []
    let pesoRecienteVisto = 0
    for (const objetivo of objetivos) {
      const ahora = new Date(objetivo.getTime() - 25 * 60_000)
      const datos: DatosPredictor = {
        tomas: hasta(brote.tomas as never, 'inicio', ahora),
        suenos: hasta(brote.suenos as never, 'inicio', ahora),
        panales: [],
      }
      const p = predecir(datos, 63, ahora).proximaToma
      if (!p) continue
      errores.push(Math.abs(new Date(p.prevista).getTime() - objetivo.getTime()) / 60_000)
      pesoRecienteVisto = Math.max(pesoRecienteVisto, p.pesoReciente)
    }
    const mae = errores.reduce((a, b) => a + b, 0) / errores.length
    expect(mae).toBeLessThan(25)
    expect(pesoRecienteVisto).toBeGreaterThan(0.6)
  })

  it('bebé irregular: el error crece pero queda acotado', () => {
    const irregular = generarBebe({
      dias: 14,
      tomaDiaMu: 190,
      tomaDiaSd: 45,
      vigiliaMu: 90,
      vigiliaSd: 35,
      siestaMu: 50,
      siestaSd: 20,
      semilla: 99,
    })
    expect(maeTomas(irregular, 63, 4)).toBeLessThan(55)
    expect(maeSiestas(irregular, 63, 4)).toBeLessThan(45)
  })

  it('arranque en frío (día y medio de datos): cae en la línea base', () => {
    const frio = generarBebe({
      dias: 2,
      tomaDiaMu: 180,
      tomaDiaSd: 15,
      vigiliaMu: 80,
      vigiliaSd: 12,
      siestaMu: 50,
      siestaSd: 12,
      semilla: 5,
    })
    const ahora = new Date(2026, 7, 7, 12, 0)
    const etapa = etapaPrediccion(63)
    const prediccion = predecir(frio, 63, ahora)
    // Con pocas muestras la base pesa: el intervalo usado queda dentro
    // (con margen) del rango poblacional de la etapa
    expect(prediccion.proximaToma!.pesoPersonal).toBeLessThan(0.75)
    const intervaloUsado =
      (new Date(prediccion.proximaToma!.prevista).getTime() -
        new Date(frio.tomas[frio.tomas.length - 2]!.inicio).getTime()) /
      60_000
    expect(intervaloUsado).toBeGreaterThan(etapa.intervaloToma.min - 45)
    expect(intervaloUsado).toBeLessThan(etapa.intervaloToma.max + 45)
  })

  it('sin ningún dato: no revienta y no predice', () => {
    const vacio: DatosPredictor = { tomas: [], suenos: [], panales: [] }
    const prediccion = predecir(vacio, 63, new Date(2026, 7, 7, 12, 0))
    expect(prediccion.proximaToma).toBeNull()
    expect(prediccion.proximaSiesta).toBeNull()
    expect(prediccion.incomodidad.minutosDesdeUltimoPanal).toBeNull()
  })

  it('durmiendo ahora: no se predice siesta y se marca durmiendo', () => {
    const conSuenoAbierto: DatosPredictor = {
      tomas: [],
      panales: [],
      suenos: [
        {
          id: 's1',
          bebe_id: 'b',
          inicio: new Date(2026, 7, 7, 11, 30).toISOString(),
          fin: null,
          notas: null,
        },
      ],
    }
    const prediccion = predecir(conSuenoAbierto, 63, new Date(2026, 7, 7, 12, 0))
    expect(prediccion.durmiendo).toBe(true)
    expect(prediccion.proximaSiesta).toBeNull()
  })

  it('la franja de confianza cubre la mayoría de las tomas reales', () => {
    const limite = new Date(2026, 7, 5)
    const objetivos = regular.iniciosTomaDia.filter((f) => f >= limite && f.getHours() >= 9)
    let dentro = 0
    for (const objetivo of objetivos) {
      const ahora = new Date(objetivo.getTime() - 30 * 60_000)
      const datos: DatosPredictor = {
        tomas: hasta(regular.tomas as never, 'inicio', ahora),
        suenos: hasta(regular.suenos as never, 'inicio', ahora),
        panales: hasta(regular.panales as never, 'fecha', ahora),
      }
      const p = predecir(datos, 63, ahora).proximaToma
      if (!p) continue
      const t = objetivo.getTime()
      if (t >= new Date(p.franja.desde).getTime() && t <= new Date(p.franja.hasta).getTime())
        dentro++
    }
    expect(dentro / objetivos.length).toBeGreaterThan(0.55)
  })
})

describe('MimePredictor — patrones aprendidos', () => {
  const bebe = generarBebe({
    dias: 10,
    tomaDiaMu: 170,
    tomaDiaSd: 10,
    vigiliaMu: 95,
    vigiliaSd: 10,
    siestaMu: 50,
    siestaSd: 10,
    semilla: 11,
  })
  const ahora = new Date(2026, 7, 7, 12, 0)

  it('recupera el intervalo real de tomas de día (±15 min)', () => {
    const patron = intervalosToma(bebe.tomas, ahora)
    expect(patron.dia.n).toBeGreaterThan(10)
    expect(Math.abs(patron.dia.medianaMin! - 170)).toBeLessThan(15)
  })

  it('recupera la ventana de vigilia real (±15 min)', () => {
    const patron = ventanasVigilia(bebe.suenos, ahora).historico
    expect(patron.n).toBeGreaterThan(5)
    expect(Math.abs(patron.medianaMin! - 95)).toBeLessThan(15)
  })
})

describe('Pronóstico de la noche', () => {
  const bebe = generarBebe({
    dias: 10,
    tomaDiaMu: 180,
    tomaDiaSd: 12,
    vigiliaMu: 80,
    vigiliaSd: 10,
    siestaMu: 50,
    siestaSd: 10,
    semilla: 33,
  })

  it('de noche: proyecta las tomas que quedan hasta las 07:00', () => {
    const ahora = new Date(2026, 7, 7, 22, 0)
    const datos: DatosPredictor = {
      tomas: hasta(bebe.tomas as never, 'inicio', ahora),
      suenos: [],
      panales: [],
    }
    const pronostico = pronosticoNoche(datos, 63, ahora)
    expect(pronostico).not.toBeNull()
    // Cadencia nocturna plausible: entre la base (240-360) y el patrón
    // simulado (última toma de la tarde → nocturna de las ~3:30)
    expect(pronostico!.intervaloMin).toBeGreaterThan(200)
    expect(pronostico!.intervaloMin).toBeLessThan(500)
    expect(pronostico!.tomas.length).toBeGreaterThanOrEqual(1)
    const finNoche = new Date(2026, 7, 8, 7, 0).getTime()
    for (const t of pronostico!.tomas) {
      expect(new Date(t).getTime()).toBeGreaterThan(ahora.getTime())
      expect(new Date(t).getTime()).toBeLessThan(finNoche)
    }
  })

  it('de día devuelve null; sin tomas también', () => {
    const mediodia = new Date(2026, 7, 7, 12, 0)
    const datos: DatosPredictor = {
      tomas: hasta(bebe.tomas as never, 'inicio', mediodia),
      suenos: [],
      panales: [],
    }
    expect(pronosticoNoche(datos, 63, mediodia)).toBeNull()
    expect(pronosticoNoche({ tomas: [], suenos: [], panales: [] }, 63, new Date(2026, 7, 7, 23, 0))).toBeNull()
  })
})

describe('¿Por qué llora?', () => {
  const bebe = generarBebe({
    dias: 10,
    tomaDiaMu: 180,
    tomaDiaSd: 12,
    vigiliaMu: 80,
    vigiliaSd: 10,
    siestaMu: 50,
    siestaSd: 10,
    semilla: 21,
  })

  function escenario(ajuste: (datos: DatosPredictor, ahora: Date) => void): {
    datos: DatosPredictor
    ahora: Date
  } {
    const ahora = new Date(2026, 7, 7, 12, 0)
    const datos: DatosPredictor = {
      tomas: hasta(bebe.tomas as never, 'inicio', ahora),
      suenos: hasta(bebe.suenos as never, 'inicio', ahora),
      panales: hasta(bebe.panales as never, 'fecha', ahora),
    }
    ajuste(datos, ahora)
    return { datos, ahora }
  }

  it('recién comida y cambiada pero despierta hace mucho → gana el sueño', () => {
    const { datos, ahora } = escenario((d, ahora) => {
      // Toma y pañal hace 10 min; ningún sueño terminado en las últimas 3 h
      d.tomas.push({
        id: 'reciente',
        bebe_id: 'b',
        inicio: new Date(ahora.getTime() - 10 * 60_000).toISOString(),
        fin: new Date(ahora.getTime() - 5 * 60_000).toISOString(),
        tipo: 'biberon_formula',
        cantidad_ml: 120,
        notas: null,
      })
      d.panales.push({
        id: 'p-reciente',
        bebe_id: 'b',
        fecha: new Date(ahora.getTime() - 10 * 60_000).toISOString(),
        tipo: 'pis',
        cantidad: null,
        notas: null,
      })
      d.suenos = d.suenos.filter(
        (s) => !s.fin || new Date(s.fin).getTime() < ahora.getTime() - 3 * 3600_000,
      )
      d.suenos.push({
        id: 's-viejo',
        bebe_id: 'b',
        inicio: new Date(ahora.getTime() - 4 * 3600_000).toISOString(),
        fin: new Date(ahora.getTime() - 3 * 3600_000).toISOString(),
        notas: null,
      })
    })
    const r = porQueLlora(datos, 63, ahora)
    expect(r.sueno).toBeGreaterThan(r.hambre)
    expect(r.sueno).toBeGreaterThan(r.incomodidad)
  })

  it('siesta reciente pero toma hace 4 h → gana el hambre', () => {
    const { datos, ahora } = escenario((d, ahora) => {
      d.tomas = d.tomas.filter((t) => new Date(t.inicio).getTime() < ahora.getTime() - 4 * 3600_000)
      d.suenos.push({
        id: 's-reciente',
        bebe_id: 'b',
        inicio: new Date(ahora.getTime() - 50 * 60_000).toISOString(),
        fin: new Date(ahora.getTime() - 10 * 60_000).toISOString(),
        notas: null,
      })
      d.panales.push({
        id: 'p-reciente',
        bebe_id: 'b',
        fecha: new Date(ahora.getTime() - 15 * 60_000).toISOString(),
        tipo: 'pis',
        cantidad: null,
        notas: null,
      })
    })
    const r = porQueLlora(datos, 63, ahora)
    expect(r.hambre).toBeGreaterThan(r.sueno)
    expect(r.hambre).toBeGreaterThan(r.incomodidad)
  })

  it('durmiendo: el sueño casi no puntúa y las probabilidades suman 1', () => {
    const { datos, ahora } = escenario((d, ahora) => {
      d.suenos.push({
        id: 's-abierto',
        bebe_id: 'b',
        inicio: new Date(ahora.getTime() - 20 * 60_000).toISOString(),
        fin: null,
        notas: null,
      })
    })
    const r = porQueLlora(datos, 63, ahora)
    expect(r.sueno).toBeLessThan(0.25)
    expect(r.sueno + r.hambre + r.incomodidad).toBeCloseTo(1, 1)
    expect(r.explicaciones).toHaveLength(3)
  })
})
