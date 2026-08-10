/**
 * recordatorios.spec.ts — Lógica pura de los Recordatorios:
 * conteo en ventana (día/semana), badge de avisos y frases de Ñeñeñi.
 */
import { describe, expect, it } from 'vitest'
import {
  AJUSTES_RECORDATORIOS,
  avisosRecordatorios,
  estadoRecordatorios,
  etiquetaRecordatorio,
  fraseRecordatorios,
  type DatosRecordatorios,
} from '../recordatorios'
import type { Evento, Panal, Recordatorio, Sueno, Toma } from '../../types'

// ---- Utilidades de construcción ----

let secuencia = 0

/** ISO de una hora local del día base (2026-08-10) o de otro día */
function iso(horaLocal: string, dia = '2026-08-10'): string {
  return new Date(`${dia}T${horaLocal}:00`).toISOString()
}

function recordatorio(parcial: Partial<Recordatorio>): Recordatorio {
  return {
    id: `rec-${++secuencia}`,
    bebe_id: 'bebe-1',
    item: 'vitamina_d',
    subtipo: null,
    intervalo: 'dia',
    repeticiones: 1,
    activo: true,
    ...parcial,
  }
}

function evento(parcial: Partial<Evento>): Evento {
  return {
    id: `ev-${++secuencia}`,
    bebe_id: 'bebe-1',
    fecha: iso('10:00'),
    tipo: 'vitamina_d',
    descripcion: null,
    subtipo: null,
    duracion_min: null,
    ...parcial,
  }
}

function toma(inicio: string): Toma {
  return {
    id: `t-${++secuencia}`,
    bebe_id: 'bebe-1',
    inicio,
    fin: null,
    tipo: 'biberon_formula',
    cantidad_ml: 120,
    notas: null,
  }
}

function sueno(inicio: string): Sueno {
  return { id: `s-${++secuencia}`, bebe_id: 'bebe-1', inicio, fin: null, notas: null }
}

function panal(fecha: string): Panal {
  return {
    id: `p-${++secuencia}`,
    bebe_id: 'bebe-1',
    fecha,
    tipo: 'pis',
    cantidad: null,
    notas: null,
  }
}

function datos(parcial: Partial<DatosRecordatorios> = {}): DatosRecordatorios {
  return { tomas: [], suenos: [], panales: [], eventos: [], ...parcial }
}

const TARDE = new Date('2026-08-10T15:00:00') // antes de la hora de aviso
const NOCHE = new Date('2026-08-10T20:30:00') // ya en franja de aviso

// ---- Etiquetas ----

describe('etiquetaRecordatorio', () => {
  it('usa la etiqueta del catálogo', () => {
    expect(etiquetaRecordatorio({ item: 'vitamina_d', subtipo: null })).toBe('Vitamina D')
  })

  it('añade el subtipo del ejercicio entre paréntesis', () => {
    expect(etiquetaRecordatorio({ item: 'ejercicio', subtipo: 'tummy_time' })).toBe(
      'Ejercicio (Tummy Time)',
    )
  })

  it('sin subtipo, el ejercicio va a secas', () => {
    expect(etiquetaRecordatorio({ item: 'ejercicio', subtipo: null })).toBe('Ejercicio')
  })
})

// ---- Conteo y estado ----

describe('estadoRecordatorios', () => {
  it('cuenta los eventos del día y calcula pendientes', () => {
    const r = recordatorio({ item: 'vitamina_d', repeticiones: 1 })
    const conHecho = estadoRecordatorios([r], datos({ eventos: [evento({})] }), TARDE)
    expect(conHecho[0]).toMatchObject({ hechas: 1, objetivo: 1, pendientes: 0, cumplido: true })

    const sinHacer = estadoRecordatorios([r], datos(), TARDE)
    expect(sinHacer[0]).toMatchObject({ hechas: 0, pendientes: 1, cumplido: false })
  })

  it('cuenta tomas, sueños y pañales por su fecha propia', () => {
    const d = datos({
      tomas: [toma(iso('09:00')), toma(iso('12:00'))],
      suenos: [sueno(iso('13:00'))],
      panales: [panal(iso('08:00'))],
    })
    const rs = [
      recordatorio({ item: 'toma', repeticiones: 8 }),
      recordatorio({ item: 'sueno', repeticiones: 4 }),
      recordatorio({ item: 'panal', repeticiones: 5 }),
    ]
    const estados = estadoRecordatorios(rs, d, TARDE)
    expect(estados.map((e) => e.hechas)).toEqual([2, 1, 1])
  })

  it('ignora registros de otros días y los posteriores a ahora', () => {
    const r = recordatorio({ item: 'vitamina_d' })
    const d = datos({
      eventos: [
        evento({ fecha: iso('10:00', '2026-08-09') }), // ayer
        evento({ fecha: iso('18:00') }), // hoy pero después de "ahora" (15:00)
      ],
    })
    expect(estadoRecordatorios([r], d, TARDE)[0].hechas).toBe(0)
  })

  it('el ejercicio filtra por subtipo solo si el recordatorio lo fija', () => {
    const d = datos({
      eventos: [
        evento({ tipo: 'ejercicio', subtipo: 'tummy_time' }),
        evento({ tipo: 'ejercicio', subtipo: 'estimulacion' }),
      ],
    })
    const tummy = recordatorio({ item: 'ejercicio', subtipo: 'tummy_time', repeticiones: 3 })
    const cualquiera = recordatorio({ item: 'ejercicio', subtipo: null, repeticiones: 3 })
    expect(estadoRecordatorios([tummy], d, TARDE)[0].hechas).toBe(1)
    expect(estadoRecordatorios([cualquiera], d, TARDE)[0].hechas).toBe(2)
  })

  it('el intervalo semanal usa una ventana rodante de 7 días', () => {
    const r = recordatorio({ item: 'unas', intervalo: 'semana', repeticiones: 1 })
    const dentro = datos({ eventos: [evento({ tipo: 'unas', fecha: iso('10:00', '2026-08-04') })] })
    const fuera = datos({ eventos: [evento({ tipo: 'unas', fecha: iso('10:00', '2026-08-03') })] })
    expect(estadoRecordatorios([r], dentro, TARDE)[0].cumplido).toBe(true)
    expect(estadoRecordatorios([r], fuera, TARDE)[0].cumplido).toBe(false)
  })

  it('los inactivos no aparecen y las hechas de más no dan pendientes negativos', () => {
    const pausado = recordatorio({ activo: false })
    const cumplidor = recordatorio({ item: 'vitamina_d', repeticiones: 1 })
    const d = datos({ eventos: [evento({}), evento({ fecha: iso('11:00') })] })
    const estados = estadoRecordatorios([pausado, cumplidor], d, TARDE)
    expect(estados).toHaveLength(1)
    expect(estados[0]).toMatchObject({ hechas: 2, pendientes: 0 })
  })
})

// ---- Badge de avisos ----

describe('avisosRecordatorios', () => {
  const r = recordatorio({ item: 'vitamina_d' })

  it('antes de la hora de aviso no hay badge aunque haya pendientes', () => {
    const estados = estadoRecordatorios([r], datos(), TARDE)
    expect(avisosRecordatorios(estados, TARDE)).toBe(0)
  })

  it('desde la hora de aviso cuenta los recordatorios con pendientes', () => {
    const otro = recordatorio({ item: 'bano' })
    const estados = estadoRecordatorios([r, otro], datos(), NOCHE)
    expect(avisosRecordatorios(estados, NOCHE)).toBe(2)
  })

  it('lo cumplido no suma al badge', () => {
    const estados = estadoRecordatorios([r], datos({ eventos: [evento({})] }), NOCHE)
    expect(avisosRecordatorios(estados, NOCHE)).toBe(0)
  })

  it('la hora de aviso sale de AJUSTES_RECORDATORIOS', () => {
    const justoAntes = new Date('2026-08-10T00:00:00')
    justoAntes.setHours(AJUSTES_RECORDATORIOS.horaAvisoDesde - 1)
    const justoDespues = new Date('2026-08-10T00:00:00')
    justoDespues.setHours(AJUSTES_RECORDATORIOS.horaAvisoDesde)
    const estados = estadoRecordatorios([r], datos(), justoAntes)
    expect(avisosRecordatorios(estados, justoAntes)).toBe(0)
    expect(avisosRecordatorios(estados, justoDespues)).toBe(1)
  })
})

// ---- Frases de Ñeñeñi ----

describe('fraseRecordatorios', () => {
  it('sin recordatorios no dice nada', () => {
    expect(fraseRecordatorios([], NOCHE)).toBeNull()
  })

  it('de día enumera lo pendiente sin dramatismo', () => {
    const rs = [
      recordatorio({ item: 'vitamina_d', repeticiones: 1 }),
      recordatorio({ item: 'ejercicio', subtipo: 'tummy_time', repeticiones: 3 }),
    ]
    const d = datos({ eventos: [evento({ tipo: 'ejercicio', subtipo: 'tummy_time' })] })
    const frase = fraseRecordatorios(estadoRecordatorios(rs, d, TARDE), TARDE)
    expect(frase).toBe('Hoy aún queda pendiente: Vitamina D, Ejercicio (Tummy Time) (1 de 3).')
  })

  it('al caer el día avisa con tono de urgencia', () => {
    const rs = [recordatorio({ item: 'vitamina_d', repeticiones: 1 })]
    const frase = fraseRecordatorios(estadoRecordatorios(rs, datos(), NOCHE), NOCHE)
    expect(frase).toContain('¡Ojo! El día se acaba')
    expect(frase).toContain('Vitamina D')
  })

  it('todo cumplido: celebra por la noche, calla de día', () => {
    const rs = [recordatorio({ item: 'vitamina_d', repeticiones: 1 })]
    const d = datos({ eventos: [evento({})] })
    expect(fraseRecordatorios(estadoRecordatorios(rs, d, TARDE), TARDE)).toBeNull()
    expect(fraseRecordatorios(estadoRecordatorios(rs, d, NOCHE), NOCHE)).toContain('¡Buen trabajo!')
  })
})
