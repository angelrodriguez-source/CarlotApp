import { describe, it, expect } from 'vitest'
import {
  edadTexto,
  edadCorta,
  duracionMinutos,
  formatoDuracion,
  formatoPeso,
  agruparPorDia,
  resumenDia,
  serieGrafica,
  ultimoValor,
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
    expect(ultimoValor(medidas, (m) => m.fecha, (m) => m.peso)).toEqual({
      valor: 5200,
      fecha: '2026-08-01',
    })
    expect(ultimoValor(medidas, (m) => m.fecha, (m) => m.altura)).toEqual({
      valor: 56.5,
      fecha: '2026-07-15',
    })
  })

  it('devuelve null si no hay ningun valor', () => {
    expect(ultimoValor(medidas, (m) => m.fecha, () => null)).toBeNull()
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
      { id: 's', bebe_id: 'b', inicio: '2026-08-06T12:00:00Z', fin: '2026-08-06T13:30:00Z', notas: null },
    ]
    const panales: Panal[] = [
      { id: 'p1', bebe_id: 'b', fecha: '2026-08-06T11:00:00Z', tipo: 'pis', notas: null },
      { id: 'p2', bebe_id: 'b', fecha: '2026-08-06T15:00:00Z', tipo: 'mixto', notas: null },
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

describe('serieGrafica', () => {
  it('filtra nulos y ordena cronologicamente', () => {
    const medidas = [
      { fecha: '2026-08-01', peso: 5200 },
      { fecha: '2026-07-01', peso: 4400 },
      { fecha: '2026-07-15', peso: null },
    ]
    const serie = serieGrafica(medidas, (m) => m.fecha, (m) => m.peso)
    expect(serie).toEqual([
      { etiqueta: '2026-07-01', valor: 4400 },
      { etiqueta: '2026-08-01', valor: 5200 },
    ])
  })
})
