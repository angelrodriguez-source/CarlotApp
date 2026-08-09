import { describe, it, expect } from 'vitest'
import {
  bandaOMS,
  edadTexto,
  edadCorta,
  duracionMinutos,
  edadDias,
  formatoDuracion,
  formatoPeso,
  percentilOMS,
  agruparPorDia,
  resumenDia,
  minutoDelDia,
  minutosSuenoEnDia,
  suenosDeDia,
  textoSuenoEnDia,
  objetivoLecheMl,
  objetivoSuenoMinutos,
  serieGrafica,
  textoPanal,
  textoSueno,
  textoToma,
  tramoEnDia,
  fechaCortaDia,
  horaCorta,
  mensajeError,
  minutosEnDia,
  mlEnDia,
  numeroONull,
  rangoDesde,
  recortarSerieAVentana,
  recortarVaciosIniciales,
  sinEmojiInicial,
  ultimosDias,
  ultimoValor,
  valorPercentilOMS,
} from '../CarlotaModel'
import type { Toma, Sueno, Panal } from '../../types'

describe('edadTexto', () => {
  it('cuenta en semanas antes de las 10 semanas', () => {
    expect(edadTexto('2026-06-06', new Date('2026-08-06T12:00:00'))).toBe('8 semanas y 5 días')
    expect(edadTexto('2026-06-06', new Date('2026-06-13T12:00:00'))).toBe('1 semana')
    expect(edadTexto('2026-06-06', new Date('2026-06-08T12:00:00'))).toBe('2 días')
  })

  it('cuenta en meses a partir de las 10 semanas', () => {
    expect(edadTexto('2026-06-06', new Date('2026-09-06T12:00:00'))).toBe('3 meses')
    expect(edadTexto('2026-06-06', new Date('2026-09-18T12:00:00'))).toBe('3 meses y 12 días')
  })
})

describe('edadTexto con nacimiento a fin de mes', () => {
  it('clampa el ancla en meses cortos (nacida el 31)', () => {
    // 6 meses de una nacida el 31-ago caen el 28-feb (no el 3-mar)
    expect(edadTexto('2025-08-31', new Date('2026-03-01T12:00:00'))).toBe('6 meses y 1 día')
    expect(edadTexto('2025-08-31', new Date('2026-03-20T12:00:00'))).toBe('6 meses y 20 días')
  })
})

describe('edadCorta', () => {
  it('compacta dias, semanas y meses', () => {
    expect(edadCorta('2026-06-06', new Date('2026-06-08T12:00:00'))).toBe('2 d')
    expect(edadCorta('2026-06-06', new Date('2026-06-13T12:00:00'))).toBe('1 sem')
    expect(edadCorta('2026-06-06', new Date('2026-08-06T12:00:00'))).toBe('8 sem 5 d')
    expect(edadCorta('2026-06-06', new Date('2026-09-06T12:00:00'))).toBe('3 m')
    expect(edadCorta('2026-06-06', new Date('2026-09-18T12:00:00'))).toBe('3 m 12 d')
  })
})

describe('formatoPeso', () => {
  it('usa gramos por debajo de 1 kg y kilos con coma a partir de ahi', () => {
    expect(formatoPeso(830)).toBe('830 g')
    expect(formatoPeso(4320)).toBe('4,32 kg')
    expect(formatoPeso(5000)).toBe('5,0 kg')
  })
})

describe('ultimoValor', () => {
  const medidas = [
    { fecha: '2026-07-01', peso: 4400, altura: 55 },
    { fecha: '2026-08-01', peso: 5200, altura: null },
    { fecha: '2026-07-15', peso: null, altura: 56.5 },
  ]

  it('devuelve el valor no nulo mas reciente por fecha', () => {
    expect(
      ultimoValor(
        medidas,
        (m) => m.fecha,
        (m) => m.peso,
      ),
    ).toEqual({
      valor: 5200,
      fecha: '2026-08-01',
    })
    expect(
      ultimoValor(
        medidas,
        (m) => m.fecha,
        (m) => m.altura,
      ),
    ).toEqual({
      valor: 56.5,
      fecha: '2026-07-15',
    })
  })

  it('devuelve null si no hay ningun valor', () => {
    expect(
      ultimoValor(
        medidas,
        (m) => m.fecha,
        () => null,
      ),
    ).toBeNull()
  })
})

describe('duracionMinutos / formatoDuracion', () => {
  it('calcula minutos entre inicio y fin', () => {
    expect(duracionMinutos('2026-08-06T10:00:00Z', '2026-08-06T10:25:00Z')).toBe(25)
    expect(duracionMinutos('2026-08-06T10:00:00Z', null)).toBeNull()
  })

  it('formatea duraciones', () => {
    expect(formatoDuracion(45)).toBe('45 min')
    expect(formatoDuracion(60)).toBe('1 h')
    expect(formatoDuracion(135)).toBe('2 h 15 min')
  })
})

describe('agruparPorDia', () => {
  it('agrupa por dia local con los dias recientes primero', () => {
    const items = [
      { fecha: '2026-08-05T10:00:00' },
      { fecha: '2026-08-06T09:00:00' },
      { fecha: '2026-08-06T21:00:00' },
    ]
    const grupos = agruparPorDia(items, (i) => i.fecha)
    expect([...grupos.keys()]).toEqual(['2026-08-06', '2026-08-05'])
    expect(grupos.get('2026-08-06')).toHaveLength(2)
  })
})

describe('resumenDia', () => {
  const toma = (extra: Partial<Toma>): Toma => ({
    id: '1',
    bebe_id: 'b',
    inicio: '2026-08-06T10:00:00Z',
    fin: null,
    tipo: 'biberon_formula',
    cantidad_ml: null,
    notas: null,
    ...extra,
  })

  it('separa ml de biberon y minutos de pecho', () => {
    const tomas = [
      toma({ tipo: 'biberon_formula', cantidad_ml: 120 }),
      toma({ tipo: 'biberon_materna', cantidad_ml: 90 }),
      toma({ tipo: 'pecho_izq', fin: '2026-08-06T10:20:00Z' }),
    ]
    const suenos: Sueno[] = [
      {
        id: 's',
        bebe_id: 'b',
        inicio: '2026-08-06T12:00:00Z',
        fin: '2026-08-06T13:30:00Z',
        notas: null,
      },
    ]
    const panales: Panal[] = [
      {
        id: 'p1',
        bebe_id: 'b',
        fecha: '2026-08-06T11:00:00Z',
        tipo: 'pis',
        cantidad: null,
        notas: null,
      },
      {
        id: 'p2',
        bebe_id: 'b',
        fecha: '2026-08-06T15:00:00Z',
        tipo: 'mixto',
        cantidad: 'poco',
        notas: null,
      },
    ]
    const resumen = resumenDia(tomas, suenos, panales)
    expect(resumen.numTomas).toBe(3)
    expect(resumen.mlBiberon).toBe(210)
    expect(resumen.minutosPecho).toBe(20)
    expect(resumen.minutosSueno).toBe(90)
    expect(resumen.numPanales).toBe(2)
    expect(resumen.numCacas).toBe(1)
  })
})

describe('texto de registros', () => {
  it('describe tomas con ml o duracion', () => {
    const base: Toma = {
      id: '1',
      bebe_id: 'b',
      inicio: '2026-08-06T10:00:00Z',
      fin: null,
      tipo: 'biberon_formula',
      cantidad_ml: 120,
      notas: null,
    }
    expect(textoToma(base)).toBe('🍼 Biberón (fórmula) — 120 ml')
    expect(
      textoToma({ ...base, tipo: 'pecho_izq', cantidad_ml: null, fin: '2026-08-06T10:20:00Z' }),
    ).toBe('🍼 Pecho izq. — 20 min')
  })

  it('describe suenos terminados y en curso', () => {
    const sueno: Sueno = {
      id: 's',
      bebe_id: 'b',
      inicio: '2026-08-06T12:00:00Z',
      fin: '2026-08-06T13:30:00Z',
      notas: null,
    }
    expect(textoSueno(sueno)).toBe('😴 Sueño — 1 h 30 min')
    expect(textoSueno({ ...sueno, fin: null })).toBe('😴 Sueño (en curso)')
  })

  it('describe panales con y sin cantidad', () => {
    const panal: Panal = {
      id: 'p',
      bebe_id: 'b',
      fecha: '2026-08-06T11:00:00Z',
      tipo: 'caca',
      cantidad: 'mucho',
      notas: null,
    }
    expect(textoPanal(panal)).toBe('🧷 Pañal — Caca (mucho)')
    expect(textoPanal({ ...panal, tipo: 'pis', cantidad: null })).toBe('🧷 Pañal — Pis')
  })
})

describe('objetivos diarios', () => {
  it('sueno recomendado por tramos de edad', () => {
    expect(objetivoSuenoMinutos(60)).toEqual({ min: 840, max: 1020 }) // 14-17 h
    expect(objetivoSuenoMinutos(200)).toEqual({ min: 720, max: 900 }) // 12-15 h
    expect(objetivoSuenoMinutos(400)).toEqual({ min: 660, max: 840 }) // 11-14 h
  })

  it('leche por regla ml/kg segun edad, con banda y tope', () => {
    // 5 kg a los 2 meses: 150 ml/kg → 750, banda 640-860
    expect(objetivoLecheMl(60, 5000)).toEqual({ min: 640, max: 860 })
    // 7 kg a los 5 meses: 120 ml/kg → 840, banda 710-970
    expect(objetivoLecheMl(150, 7000)).toEqual({ min: 710, max: 970 })
    // Tope de 1000 ml/dia
    expect(objetivoLecheMl(60, 9000)!.max).toBe(1000)
    // Sin peso no hay objetivo
    expect(objetivoLecheMl(60, null)).toBeNull()
  })
})

describe('recortarSerieAVentana — la línea entra por el borde', () => {
  const p = (dia: number, valor: number): { dia: number; valor: number; etiqueta: string } => ({
    dia,
    valor,
    etiqueta: `d${dia}`,
  })

  it('una medida anterior a la ventana genera un punto virtual en el borde', () => {
    // Medidas en los días 10 y 50; ventana [30, 90]: la línea debe entrar
    // por el día 30 con el valor interpolado (10→50 lineal)
    const serie = recortarSerieAVentana([p(10, 4000), p(50, 6000)], 30, 90)
    expect(serie).toHaveLength(2)
    expect(serie[0]).toMatchObject({ dia: 30, valor: 5000, virtual: true })
    expect(serie[1]).toMatchObject({ dia: 50, valor: 6000 })
    expect(serie[1]!.virtual).toBeUndefined()
  })

  it('sin medidas fuera no añade nada; también recorta por la derecha', () => {
    expect(recortarSerieAVentana([p(35, 5000), p(50, 6000)], 30, 90)).toHaveLength(2)
    const conFutura = recortarSerieAVentana([p(80, 7000), p(100, 8000)], 30, 90)
    expect(conFutura).toHaveLength(2)
    expect(conFutura[1]).toMatchObject({ dia: 90, valor: 7500, virtual: true })
  })

  it('un solo segmento que cruza toda la ventana entra y sale', () => {
    const serie = recortarSerieAVentana([p(10, 4000), p(110, 9000)], 30, 90)
    expect(serie).toHaveLength(2)
    expect(serie[0]).toMatchObject({ dia: 30, valor: 5000, virtual: true })
    expect(serie[1]).toMatchObject({ dia: 90, valor: 8000, virtual: true })
  })

  it('todo fuera y sin cruce: serie vacía', () => {
    expect(recortarSerieAVentana([p(10, 4000), p(20, 4500)], 30, 90)).toEqual([])
  })
})

describe('suenosDeDia — el nocturno se muestra en ambos días', () => {
  const nocturno: Sueno = {
    id: 'noche',
    bebe_id: 'b',
    inicio: '2026-08-05T23:20:00',
    fin: '2026-08-06T07:00:00',
    notas: null,
  }
  const siesta: Sueno = {
    id: 'siesta',
    bebe_id: 'b',
    inicio: '2026-08-06T11:00:00',
    fin: '2026-08-06T13:00:00',
    notas: null,
  }

  it('en su día de inicio: aviso de que sigue tras medianoche con su parte', () => {
    const dia5 = suenosDeDia([nocturno, siesta], '2026-08-05')
    expect(dia5).toHaveLength(1)
    expect(dia5[0]!.sueno.id).toBe('noche')
    expect(dia5[0]!.minutosDelDia).toBe(40)
    expect(dia5[0]!.sigueDespues).toBe(true)
    expect(dia5[0]!.empezoAntes).toBe(false)
    expect(textoSuenoEnDia(dia5[0]!)).toContain('sigue tras medianoche (40 min de este día)')
  })

  it('en el día siguiente: fila prestada con aviso y su parte', () => {
    const dia6 = suenosDeDia([nocturno, siesta], '2026-08-06')
    expect(dia6).toHaveLength(2)
    const prestada = dia6.find((v) => v.sueno.id === 'noche')!
    expect(prestada.empezoAntes).toBe(true)
    expect(prestada.minutosDelDia).toBe(7 * 60)
    // Ordena a las 00:00 del día mostrado, no a su inicio real de ayer
    expect(new Date(prestada.horaOrden).getTime()).toBe(new Date('2026-08-06T00:00:00').getTime())
    expect(textoSuenoEnDia(prestada)).toContain('empezó el día anterior (7 h de este día)')
    // La siesta normal ni aviso ni recorte
    const normal = dia6.find((v) => v.sueno.id === 'siesta')!
    expect(normal.empezoAntes).toBe(false)
    expect(normal.sigueDespues).toBe(false)
    expect(textoSuenoEnDia(normal)).not.toContain('este día')
  })

  it('un sueño abierto que cruza medianoche aparece hoy recortado en ahora', () => {
    const abierto: Sueno = {
      id: 'abierto',
      bebe_id: 'b',
      inicio: '2026-08-05T23:00:00',
      fin: null,
      notas: null,
    }
    const hoy = suenosDeDia([abierto], '2026-08-06', new Date('2026-08-06T06:30:00'))
    expect(hoy).toHaveLength(1)
    expect(hoy[0]!.empezoAntes).toBe(true)
    expect(hoy[0]!.minutosDelDia).toBe(6.5 * 60)
    expect(hoy[0]!.sigueDespues).toBe(false)
  })
})

describe('ritmo de 24 h', () => {
  it('recorta intervalos al dia, incluyendo los que cruzan medianoche', () => {
    // Contenido en el dia
    expect(tramoEnDia('2026-08-06T13:00:00', '2026-08-06T14:30:00', '2026-08-06')).toEqual({
      desdeMin: 780,
      hastaMin: 870,
    })
    // Cruza medianoche: aporta a los dos dias
    expect(tramoEnDia('2026-08-05T23:00:00', '2026-08-06T01:30:00', '2026-08-05')).toEqual({
      desdeMin: 1380,
      hastaMin: 1440,
    })
    expect(tramoEnDia('2026-08-05T23:00:00', '2026-08-06T01:30:00', '2026-08-06')).toEqual({
      desdeMin: 0,
      hastaMin: 90,
    })
    // Fuera del dia
    expect(tramoEnDia('2026-08-04T10:00:00', '2026-08-04T11:00:00', '2026-08-06')).toBeNull()
    // En curso: recorta en "ahora"
    expect(
      tramoEnDia('2026-08-06T13:00:00', null, '2026-08-06', new Date('2026-08-06T13:45:00')),
    ).toEqual({ desdeMin: 780, hastaMin: 825 })
  })

  it('reparte el sueno nocturno entre los dos dias', () => {
    const suenos: Sueno[] = [
      // Nocturno 23:00 → 07:00: 60 min para el dia 5, 420 para el dia 6
      {
        id: 'a',
        bebe_id: 'b',
        inicio: '2026-08-05T23:00:00',
        fin: '2026-08-06T07:00:00',
        notas: null,
      },
      // Siesta entera dentro del dia 6
      {
        id: 'b',
        bebe_id: 'b',
        inicio: '2026-08-06T13:00:00',
        fin: '2026-08-06T14:30:00',
        notas: null,
      },
    ]
    expect(minutosSuenoEnDia(suenos, '2026-08-05')).toBe(60)
    expect(minutosSuenoEnDia(suenos, '2026-08-06')).toBe(420 + 90)
    expect(minutosSuenoEnDia(suenos, '2026-08-07')).toBe(0)
    // Abierto (fin null): recortado en "ahora"
    const abierto: Sueno[] = [
      { id: 'c', bebe_id: 'b', inicio: '2026-08-06T22:00:00', fin: null, notas: null },
    ]
    expect(minutosSuenoEnDia(abierto, '2026-08-06', new Date('2026-08-06T23:30:00'))).toBe(90)
  })

  it('minutoDelDia y ultimosDias', () => {
    expect(minutoDelDia('2026-08-06T13:30:00')).toBe(810)
    expect(ultimosDias(3, new Date('2026-08-06T12:00:00'))).toEqual([
      '2026-08-06',
      '2026-08-05',
      '2026-08-04',
    ])
  })
})

describe('edadDias / percentilOMS', () => {
  it('calcula la edad en dias', () => {
    expect(edadDias('2026-06-05', '2026-06-05')).toBe(0)
    expect(edadDias('2026-06-05', '2026-08-07')).toBe(63)
  })

  it('la mediana OMS cae en el percentil 50', () => {
    // Medianas oficiales OMS ninas: nacimiento 3232.2 g / 49.1477 cm; semana 8: 4995.9 g
    expect(percentilOMS('peso', 3232.2, 0)).toBeCloseTo(50, 0)
    expect(percentilOMS('altura', 49.1477, 0)).toBeCloseTo(50, 0)
    expect(percentilOMS('peso', 4995.9, 56)).toBeCloseTo(50, 0)
  })

  it('los extremos caen en sus percentiles', () => {
    // P3 y P97 de la tabla generada (semana 8)
    expect(percentilOMS('peso', 3893, 56)!).toBeCloseTo(3, 0)
    expect(percentilOMS('altura', 60.4, 56)!).toBeCloseTo(97, 0)
  })

  it('bandaOMS coincide con la tabla generada en semanas exactas', () => {
    // Semana 8 (dia 56) de la tabla: peso p3 3893 / p50 4996 / p97 6370
    const banda = bandaOMS('peso', 56)!
    expect(banda.p3).toBeCloseTo(3893, -1)
    expect(banda.p50).toBeCloseTo(4996, -1)
    expect(banda.p97).toBeCloseTo(6370, -1)
    expect(bandaOMS('peso', 800)).toBeNull()
  })

  it('interpola entre semanas y limita el rango', () => {
    const p = percentilOMS('peso', 4800, 59) // entre semana 8 y 9
    expect(p).not.toBeNull()
    expect(p!).toBeGreaterThan(20)
    expect(p!).toBeLessThan(50)
    expect(percentilOMS('peso', 5000, -1)).toBeNull()
    expect(percentilOMS('peso', 12000, 800)).toBeNull() // > 100 semanas
    expect(percentilOMS('peso', 0, 10)).toBeNull()
  })

  it('valorPercentilOMS: P50 es la mediana y los deciles crecen', () => {
    // La mediana de la banda y el decil 50 son el mismo valor
    expect(valorPercentilOMS('peso', 50, 56)!).toBeCloseTo(bandaOMS('peso', 56)!.p50, 5)
    // Deciles estrictamente crecientes y dentro de P3-P97
    const banda = bandaOMS('peso', 56)!
    let anterior = banda.p3
    for (const decil of [10, 20, 30, 40, 50, 60, 70, 80, 90]) {
      const valor = valorPercentilOMS('peso', decil, 56)!
      expect(valor).toBeGreaterThan(anterior)
      anterior = valor
    }
    expect(anterior).toBeLessThan(banda.p97)
    // Los extremos P0/P100 (±3 desviaciones) quedan fuera de la banda P3-P97
    expect(valorPercentilOMS('peso', 0, 56)!).toBeLessThan(banda.p3)
    expect(valorPercentilOMS('peso', 100, 56)!).toBeGreaterThan(banda.p97)
    // El valor del decil devuelve su percentil al pasar por percentilOMS
    expect(percentilOMS('peso', valorPercentilOMS('peso', 30, 56)!, 56)!).toBeCloseTo(30, 0)
    // Percentil no decilar o edad fuera de rango → null
    expect(valorPercentilOMS('peso', 55, 56)).toBeNull()
    expect(valorPercentilOMS('peso', 50, 800)).toBeNull()
  })
})

describe('serieGrafica', () => {
  it('filtra nulos y ordena cronologicamente', () => {
    const medidas = [
      { fecha: '2026-08-01', peso: 5200 },
      { fecha: '2026-07-01', peso: 4400 },
      { fecha: '2026-07-15', peso: null },
    ]
    const serie = serieGrafica(
      medidas,
      (m) => m.fecha,
      (m) => m.peso,
    )
    expect(serie).toEqual([
      { etiqueta: '2026-07-01', valor: 4400 },
      { etiqueta: '2026-08-01', valor: 5200 },
    ])
  })
})

describe('helpers compartidos', () => {
  it('numeroONull normaliza el "" de un input number vaciado', () => {
    expect(numeroONull(120)).toBe(120)
    expect(numeroONull(null)).toBeNull()
    expect(numeroONull('' as unknown as number)).toBeNull()
    expect(numeroONull(NaN)).toBeNull()
  })

  it('sinEmojiInicial quita solo el primer token (el emoji)', () => {
    expect(sinEmojiInicial('🍼 Biberón (fórmula) — 120 ml')).toBe('Biberón (fórmula) — 120 ml')
    expect(sinEmojiInicial('⭐ Baño')).toBe('Baño')
    expect(sinEmojiInicial('😴 Sueño — 2 h 15 min')).toBe('Sueño — 2 h 15 min')
  })

  it('mensajeError extrae el mensaje de cualquier cosa lanzada', () => {
    expect(mensajeError(new Error('boom'))).toBe('boom')
    expect(mensajeError('texto plano')).toBe('texto plano')
    expect(mensajeError(42)).toBe('42')
  })

  it('fechaCortaDia y horaCorta formatean para las gráficas', () => {
    expect(fechaCortaDia('2026-08-07')).toBe('07/08')
    expect(horaCorta('2026-08-07T09:05:00')).toBe('09:05')
  })

  it('rangoDesde da el inicio del rango y un día antes para sueños', () => {
    const ahora = new Date('2026-08-07T15:30:00')
    const { desdeIso, desdeSuenosIso } = rangoDesde(7, ahora)
    expect(new Date(desdeIso).getDate()).toBe(1) // 7 días incluyendo hoy
    expect(new Date(desdeIso).getHours()).toBe(0)
    expect(new Date(desdeSuenosIso).getDate()).toBe(31) // víspera (julio)
  })

  it('mlEnDia suma solo los biberones del día', () => {
    const tomas = [
      { inicio: '2026-08-07T09:00:00', cantidad_ml: 120 },
      { inicio: '2026-08-07T13:00:00', cantidad_ml: 90 },
      { inicio: '2026-08-07T16:00:00', cantidad_ml: null }, // pecho
      { inicio: '2026-08-06T22:00:00', cantidad_ml: 150 }, // otro día
    ] as Toma[]
    expect(mlEnDia(tomas, '2026-08-07')).toBe(210)
    expect(mlEnDia(tomas, '2026-08-05')).toBe(0)
  })

  it('recortarVaciosIniciales quita la cola de ceros del principio', () => {
    const puntos = [
      { etiqueta: '2026-08-01', valor: 0 },
      { etiqueta: '2026-08-02', valor: 0 },
      { etiqueta: '2026-08-03', valor: 5 },
      { etiqueta: '2026-08-04', valor: 0 },
    ]
    expect(recortarVaciosIniciales(puntos).map((p) => p.etiqueta)).toEqual([
      '2026-08-03',
      '2026-08-04',
    ])
    expect(recortarVaciosIniciales([{ etiqueta: 'x', valor: 0 }])).toEqual([])
  })

  it('minutosEnDia devuelve la duración real del día', () => {
    expect(minutosEnDia('2026-08-07')).toBe(1440)
  })
})
