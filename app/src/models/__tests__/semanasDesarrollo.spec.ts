import { describe, it, expect } from 'vitest'
import { ETAPAS_DESARROLLO, desarrolloSemana } from '../semanasDesarrollo'

describe('semanasDesarrollo', () => {
  it('cubre todas las semanas 0-100 sin huecos ni solapes', () => {
    for (let semana = 0; semana <= 100; semana++) {
      const etapas = ETAPAS_DESARROLLO.filter(
        (e) => semana >= e.desdeSemana && semana <= e.hastaSemana,
      )
      expect(etapas, `semana ${semana}`).toHaveLength(1)
    }
  })

  it('devuelve la etapa correcta y null fuera de rango', () => {
    expect(desarrolloSemana(9)?.titulo).toBe('Dos meses: gorjeos')
    expect(desarrolloSemana(52)?.titulo).toBe('Once-doce meses: casi andando')
    expect(desarrolloSemana(101)).toBeNull()
    expect(desarrolloSemana(-1)).toBeNull()
  })

  it('todas las etapas tienen contenido completo', () => {
    for (const etapa of ETAPAS_DESARROLLO) {
      expect(etapa.titulo.length).toBeGreaterThan(0)
      expect(etapa.cambios.length).toBeGreaterThanOrEqual(3)
      expect(etapa.sueno.length).toBeGreaterThan(0)
      expect(etapa.tomas.length).toBeGreaterThan(0)
    }
  })
})
