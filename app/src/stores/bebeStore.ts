/**
 * bebeStore.ts — El bebé activo (Carlota), compartido por todas las vistas
 *
 * Se carga una vez tras el login. bebe === null con cargado === true
 * significa "sin acceso": el usuario no está en usuarios_autorizados.
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getBebe } from '../services/carlotaService'
import { edadTexto } from '../models/CarlotaModel'
import type { Bebe } from '../types'

export const useBebeStore = defineStore('bebe', () => {
  const bebe = ref<Bebe | null>(null)
  const cargado = ref(false)
  const error = ref('')

  const edad = computed(() => (bebe.value ? edadTexto(bebe.value.fecha_nacimiento) : ''))

  /** Carga el bebé si aún no está cargado. Devuelve el bebé (o null sin acceso). */
  async function cargar(): Promise<Bebe | null> {
    if (cargado.value) return bebe.value
    error.value = ''
    try {
      bebe.value = await getBebe()
      cargado.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
    return bebe.value
  }

  /** Al hacer logout: olvidar el estado para el siguiente login */
  function reset() {
    bebe.value = null
    cargado.value = false
    error.value = ''
  }

  return { bebe, cargado, error, edad, cargar, reset }
})
