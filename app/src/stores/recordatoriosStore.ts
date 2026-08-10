/**
 * recordatoriosStore.ts — Estado global de los Recordatorios.
 *
 * Carga los recordatorios y los registros de la última semana (tablas
 * pequeñas e indexadas) y calcula el estado con la lógica pura de
 * models/recordatorios.ts. Se refresca solo cuando el servicio avisa de
 * una escritura (EVENTO_DATOS_CAMBIADOS, con un pequeño debounce): así
 * el badge de Ñeñeñi se actualiza al registrar sin ningún polling.
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  EVENTO_DATOS_CAMBIADOS,
  listarEventos,
  listarPanales,
  listarRecordatorios,
  listarSuenos,
  listarTomas,
} from '../services/carlotaService'
import {
  AJUSTES_RECORDATORIOS,
  avisosRecordatorios,
  estadoRecordatorios,
  type EstadoRecordatorio,
} from '../models/recordatorios'
import { useBebeStore } from './bebeStore'
import type { Recordatorio } from '../types'

export const useRecordatoriosStore = defineStore('recordatorios', () => {
  const recordatorios = ref<Recordatorio[]>([])
  const estados = ref<EstadoRecordatorio[]>([])
  const cargado = ref(false)

  let escuchando = false
  let temporizadorDebounce: number | undefined
  let cargando: Promise<void> | null = null
  // Un refresco pedido MIENTRAS otro está en vuelo no puede descartarse:
  // el cambio que lo motivó quizá llegó después de que el primero
  // consultara. Se apunta y se repite al terminar.
  let repetirAlTerminar = false

  /** Nº del badge rojo sobre Ñeñeñi; el llamador aporta la hora reactiva */
  function avisos(ahora: Date): number {
    return avisosRecordatorios(estados.value, ahora)
  }

  const hayRecordatorios = computed(() => recordatorios.value.some((r) => r.activo))

  async function refrescar(): Promise<void> {
    // Un solo refresco en vuelo: las ráfagas (alta + recarga) se funden,
    // pero dejando apuntado que hay que repetir al terminar
    if (cargando) {
      repetirAlTerminar = true
      return cargando
    }
    cargando = (async () => {
      const bebe = await useBebeStore().cargar()
      if (!bebe) return
      const ahora = new Date()
      const desde = new Date(ahora)
      desde.setDate(desde.getDate() - (AJUSTES_RECORDATORIOS.diasSemana - 1))
      desde.setHours(0, 0, 0, 0)
      const desdeIso = desde.toISOString()
      const [lista, tomas, suenos, panales, eventos] = await Promise.all([
        listarRecordatorios(bebe.id),
        listarTomas(bebe.id, desdeIso),
        listarSuenos(bebe.id, desdeIso),
        listarPanales(bebe.id, desdeIso),
        listarEventos(bebe.id, desdeIso),
      ])
      recordatorios.value = lista
      estados.value = estadoRecordatorios(lista, { tomas, suenos, panales, eventos }, ahora)
      cargado.value = true
    })().finally(() => {
      cargando = null
      if (repetirAlTerminar) {
        repetirAlTerminar = false
        void refrescar().catch(() => undefined)
      }
    })
    return cargando
  }

  /** Arranque tras el login: primera carga + escucha de escrituras */
  function iniciar(): void {
    if (!escuchando) {
      escuchando = true
      window.addEventListener(EVENTO_DATOS_CAMBIADOS, () => {
        window.clearTimeout(temporizadorDebounce)
        temporizadorDebounce = window.setTimeout(() => void refrescar().catch(() => undefined), 800)
      })
    }
    void refrescar().catch(() => undefined)
  }

  /** Al hacer logout: olvidar el estado para el siguiente login */
  function reset(): void {
    recordatorios.value = []
    estados.value = []
    cargado.value = false
  }

  return { recordatorios, estados, cargado, hayRecordatorios, avisos, refrescar, iniciar, reset }
})
