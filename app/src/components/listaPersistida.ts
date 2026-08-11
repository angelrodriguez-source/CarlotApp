/**
 * listaPersistida.ts — Lista de ids persistida en localStorage POR USUARIO
 * (cada padre la suya en este dispositivo). La lista vacía también se
 * respeta al recargar (deseleccionarlo todo es una elección válida): los
 * valores por defecto solo aplican si nunca se guardó nada o la config
 * está corrupta. La usan los hitos visibles y los accesos directos de Hoy.
 */
import { computed, ref, watch, type Ref } from 'vue'
import { useUserStore } from '../stores/userStore'

export function usarListaPersistida(
  prefijo: string,
  porDefecto: readonly string[],
): { valor: Ref<string[]>; cargar: () => void } {
  const userStore = useUserStore()
  const clave = computed(() => `${prefijo}-${userStore.user?.id ?? 'anon'}`)
  const valor = ref<string[]>([...porDefecto])
  function cargar() {
    try {
      const guardado = JSON.parse(localStorage.getItem(clave.value) ?? 'null')
      if (Array.isArray(guardado)) valor.value = guardado
    } catch {
      // config corrupta: se queda la de por defecto
    }
  }
  watch(valor, (v) => localStorage.setItem(clave.value, JSON.stringify(v)), { deep: true })
  return { valor, cargar }
}
