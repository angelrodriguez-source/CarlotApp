import { describe, it, expect } from 'vitest'
import {
  LIMITES_ENTRADA,
  primerError,
  validarFechaDia,
  validarFechaRegistro,
  validarRango,
  validarTramoSueno,
} from '../validacion'

const NACIMIENTO = '2026-06-05'
const AHORA = new Date(2026, 7, 8, 12, 0)

describe('validarRango', () => {
  it('acepta el rango completo, incluidos los bordes', () => {
    expect(validarRango(LIMITES_ENTRADA.tomaMl.min, LIMITES_ENTRADA.tomaMl)).toBeNull()
    expect(validarRango(LIMITES_ENTRADA.tomaMl.max, LIMITES_ENTRADA.tomaMl)).toBeNull()
    expect(validarRango(120, LIMITES_ENTRADA.tomaMl)).toBeNull()
  })

  it('rechaza fuera de rango con la etiqueta y unidad del campo', () => {
    const error = validarRango(1200, LIMITES_ENTRADA.tomaMl)
    expect(error).toContain('cantidad del biberón')
    expect(error).toContain('500 ml')
    expect(validarRango(4, LIMITES_ENTRADA.tomaMl)).not.toBeNull()
    expect(validarRango(30000, LIMITES_ENTRADA.pesoGramos)).not.toBeNull()
    expect(validarRango(200, LIMITES_ENTRADA.alturaCm)).not.toBeNull()
  })

  it('null/undefined pasan (lo obligatorio lo exige el formulario) y NaN no', () => {
    expect(validarRango(null, LIMITES_ENTRADA.tomaMl)).toBeNull()
    expect(validarRango(undefined, LIMITES_ENTRADA.tomaMl)).toBeNull()
    expect(validarRango(Number.NaN, LIMITES_ENTRADA.tomaMl)).toContain('no es un número')
  })
})

describe('validarFechaRegistro', () => {
  it('acepta el pasado dentro de la vida de la bebé', () => {
    expect(validarFechaRegistro(new Date(2026, 7, 8, 9, 0), NACIMIENTO, AHORA)).toBeNull()
    expect(validarFechaRegistro(new Date(2026, 5, 5, 0, 0), NACIMIENTO, AHORA)).toBeNull()
  })

  it('tolera unos minutos de futuro (desfase de relojes) pero no más', () => {
    expect(validarFechaRegistro(new Date(2026, 7, 8, 12, 3), NACIMIENTO, AHORA)).toBeNull()
    expect(validarFechaRegistro(new Date(2026, 7, 8, 13, 0), NACIMIENTO, AHORA)).toContain('futuro')
  })

  it('rechaza fechas anteriores al nacimiento y fechas inválidas', () => {
    expect(validarFechaRegistro(new Date(2026, 5, 4, 23, 59), NACIMIENTO, AHORA)).toContain(
      'anterior al nacimiento',
    )
    expect(validarFechaRegistro(new Date('patata'), NACIMIENTO, AHORA)).toContain('no es válida')
  })
})

describe('validarTramoSueno', () => {
  it('acepta un tramo normal y rechaza fin <= inicio', () => {
    const inicio = new Date(2026, 7, 8, 9, 0)
    expect(validarTramoSueno(inicio, new Date(2026, 7, 8, 10, 30))).toBeNull()
    expect(validarTramoSueno(inicio, inicio)).toContain('posterior al inicio')
    expect(validarTramoSueno(inicio, new Date(2026, 7, 8, 8, 0))).toContain('posterior al inicio')
  })

  it('rechaza duraciones implausibles (> 16 h)', () => {
    const inicio = new Date(2026, 7, 7, 9, 0)
    expect(validarTramoSueno(inicio, new Date(2026, 7, 8, 9, 0))).toContain('16 h')
  })
})

describe('validarFechaDia', () => {
  it('acepta el rango [nacimiento, hoy] y rechaza fuera', () => {
    expect(validarFechaDia('2026-08-08', NACIMIENTO, '2026-08-08')).toBeNull()
    expect(validarFechaDia(NACIMIENTO, NACIMIENTO, '2026-08-08')).toBeNull()
    expect(validarFechaDia('2026-08-09', NACIMIENTO, '2026-08-08')).toContain('futuro')
    expect(validarFechaDia('2026-06-04', NACIMIENTO, '2026-08-08')).toContain('nacimiento')
    expect(validarFechaDia('08/08/2026', NACIMIENTO, '2026-08-08')).toContain('no es válida')
  })
})

describe('primerError', () => {
  it('devuelve el primer error no nulo, o null si todo pasa', () => {
    expect(primerError(null, null)).toBeNull()
    expect(primerError(null, 'a', 'b')).toBe('a')
  })
})
