/**
 * bebeStore.ts — El bebé activo (Carlota), compartido por todas las vistas
 *
 * Se carga una vez tras el login. bebe === null con cargado === true
 * significa "sin acceso": el usuario no está en usuarios_autorizados.
 */
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getBebe } from '../services/carlotaService'
import type { Bebe } from '../types'

export const useBebeStore = defineStore('bebe', () => {
  const bebe = ref<Bebe | null>(null)
  const cargado = ref(false)

  /**
   * Carga el bebé si aún no está cargado. Devuelve el bebé (o null sin
   * acceso). Un fallo de red se relanza para que la vista lo muestre con su
   * patrón try/catch — null queda reservado para "no está en la lista blanca".
   */
  async function cargar(): Promise<Bebe | null> {
    if (cargado.value) return bebe.value
    bebe.value = await getBebe()
    cargado.value = true
    return bebe.value
  }

  /** Al hacer logout: olvidar el estado para el siguiente login */
  function reset() {
    bebe.value = null
    cargado.value = false
  }

  return { bebe, cargado, cargar, reset }
})
