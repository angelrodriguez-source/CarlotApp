/**
 * autorrecarga.ts — Recarga automática de los datos de una vista.
 *
 * La vista pasa su función de recarga (idealmente silenciosa: sin
 * esqueletos, con token anti-pisado) y esta se dispara, con debounce:
 *  - al llegar EVENTO_DATOS_CAMBIADOS — escrituras propias Y remotas
 *    (la otra persona), porque el servicio reemite los cambios que le
 *    llegan por Supabase Realtime; y
 *  - al volver la pestaña/PWA a primer plano (visibilitychange), que
 *    cubre los huecos si el socket estuvo dormido en segundo plano.
 *
 * El debounce funde la ráfaga típica (escritura propia + eco Realtime
 * de esa misma escritura) en una sola recarga.
 */
import { onMounted, onUnmounted } from 'vue'
import { EVENTO_DATOS_CAMBIADOS } from '../services/carlotaService'

export function usarAutorrecarga(recargar: () => unknown, esperaMs = 900): void {
  let temporizador: number | undefined

  function programar() {
    window.clearTimeout(temporizador)
    temporizador = window.setTimeout(() => void recargar(), esperaMs)
  }

  function alCambiarVisibilidad() {
    if (document.visibilityState === 'visible') programar()
  }

  onMounted(() => {
    window.addEventListener(EVENTO_DATOS_CAMBIADOS, programar)
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
  })

  onUnmounted(() => {
    window.clearTimeout(temporizador)
    window.removeEventListener(EVENTO_DATOS_CAMBIADOS, programar)
    document.removeEventListener('visibilitychange', alCambiarVisibilidad)
  })
}
