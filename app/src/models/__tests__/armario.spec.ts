/**
 * armario.spec.ts — Lógica pura del Armario: catálogos, filtrado,
 * orden y resumen por tipo.
 */
import { describe, expect, it } from 'vitest'
import {
  COLORES_PRENDA,
  TIPOS_PRENDA,
  etiquetaColorPrenda,
  etiquetaTipoPrenda,
  filtrarPrendas,
  gruposPorTipo,
  ordenarPrendas,
  resumenArmario,
  tituloPrenda,
  ubicacionesUsadas,
} from '../armario'
import type { Prenda } from '../../types'

let secuencia = 0

function prenda(parcial: Partial<Prenda>): Prenda {
  return {
    id: `p-${++secuencia}`,
    bebe_id: 'bebe-1',
    tipo: 'body',
    color: 'blanco',
    talla: null,
    notas: null,
    ubicacion: null,
    foto_path: null,
    created_at: `2026-11-0${(secuencia % 9) + 1}T10:00:00Z`,
    ...parcial,
  }
}

describe('catálogos del armario', () => {
  it("'otro' es SIEMPRE el último tipo (regla de la casa)", () => {
    expect(TIPOS_PRENDA[TIPOS_PRENDA.length - 1]!.id).toBe('otro')
  })

  it('tipos y colores no se repiten y tienen etiqueta y muestra', () => {
    expect(new Set(TIPOS_PRENDA.map((t) => t.id)).size).toBe(TIPOS_PRENDA.length)
    expect(new Set(COLORES_PRENDA.map((c) => c.id)).size).toBe(COLORES_PRENDA.length)
    for (const c of COLORES_PRENDA) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('etiquetas legibles', () => {
    expect(etiquetaTipoPrenda('banador')).toBe('Bañador')
    expect(etiquetaColorPrenda('marron')).toBe('Marrón')
  })
})

describe('tituloPrenda', () => {
  it('tipo · color · talla, y sin talla no deja hueco', () => {
    expect(tituloPrenda({ tipo: 'body', color: 'rosa', talla: '3-6 m' })).toBe(
      'Body · Rosa · 3-6 m',
    )
    expect(tituloPrenda({ tipo: 'pijama', color: 'celeste', talla: null })).toBe('Pijama · Celeste')
  })
})

describe('filtrarPrendas / ordenarPrendas / resumenArmario', () => {
  const armario = [
    prenda({ tipo: 'pijama', color: 'celeste', created_at: '2026-11-01T10:00:00Z' }),
    prenda({ tipo: 'body', color: 'blanco', created_at: '2026-11-02T10:00:00Z' }),
    prenda({ tipo: 'body', color: 'rosa', created_at: '2026-11-05T10:00:00Z' }),
    prenda({ tipo: 'otro', color: 'rosa', created_at: '2026-11-03T10:00:00Z' }),
  ]

  it('filtra por tipo, por color y por ambos; null no filtra', () => {
    expect(filtrarPrendas(armario, { tipo: 'body', color: null })).toHaveLength(2)
    expect(filtrarPrendas(armario, { tipo: null, color: 'rosa' })).toHaveLength(2)
    expect(filtrarPrendas(armario, { tipo: 'body', color: 'rosa' })).toHaveLength(1)
    expect(filtrarPrendas(armario, { tipo: null, color: null })).toHaveLength(4)
  })

  it('ordena por catálogo (otro al final) y por novedad dentro del tipo', () => {
    const orden = ordenarPrendas(armario)
    expect(orden.map((p) => p.tipo)).toEqual(['body', 'body', 'pijama', 'otro'])
    // Dentro de body, la más nueva primero
    expect(orden[0]!.color).toBe('rosa')
  })

  it('resumen: solo tipos con prendas, en orden de catálogo', () => {
    const r = resumenArmario(armario)
    expect(r.map((x) => `${x.tipo}:${x.n}`)).toEqual(['body:2', 'pijama:1', 'otro:1'])
  })
})

describe('gruposPorTipo', () => {
  it('agrupa en orden de catálogo con nuevas primero dentro del grupo', () => {
    const grupos = gruposPorTipo([
      prenda({ tipo: 'pijama', created_at: '2026-11-01T10:00:00Z' }),
      prenda({ tipo: 'body', color: 'blanco', created_at: '2026-11-02T10:00:00Z' }),
      prenda({ tipo: 'body', color: 'rosa', created_at: '2026-11-05T10:00:00Z' }),
      prenda({ tipo: 'otro', created_at: '2026-11-03T10:00:00Z' }),
    ])
    expect(grupos.map((g) => `${g.tipo}:${g.prendas.length}`)).toEqual([
      'body:2',
      'pijama:1',
      'otro:1',
    ])
    expect(grupos[0]!.prendas[0]!.color).toBe('rosa')
    expect(grupos[0]!.emoji).toBeTruthy()
  })
})

describe('ubicacionesUsadas', () => {
  it('únicas sin distinguir mayúsculas/espacios, orden alfabético', () => {
    const lista = ubicacionesUsadas([
      prenda({ ubicacion: 'Cómoda' }),
      prenda({ ubicacion: ' cómoda ' }),
      prenda({ ubicacion: 'Cajón de arriba' }),
      prenda({ ubicacion: null }),
      prenda({ ubicacion: '  ' }),
    ])
    expect(lista).toEqual(['Cajón de arriba', 'Cómoda'])
  })
})
