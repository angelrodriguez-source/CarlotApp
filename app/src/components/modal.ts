/**
 * modal.ts — Utilidades compartidas de los diálogos modales
 * (HojaInferior y NeneniPanel): ciclo de vida completo (usarModal),
 * bloqueo de scroll del fondo con contador compartido y trampa de foco
 * para Tab.
 */
import { nextTick, onUnmounted, watch, type Ref } from 'vue'

// Contador de modales abiertos COMPARTIDO: cuando un diálogo sustituye a
// otro en el mismo tick, el que se cierra no debe desbloquear el fondo
// del que se abre
let modalesAbiertos = 0

/**
 * Crea el bloqueador de scroll de UNA instancia de diálogo: llama con
 * true/false al abrir/cerrar (idempotente) y no olvides llamar con false
 * en onUnmounted.
 */
export function crearBloqueoScroll(): (abierta: boolean) => void {
  let estaBloqueando = false
  return (abierta: boolean) => {
    if (abierta === estaBloqueando) return
    estaBloqueando = abierta
    modalesAbiertos += abierta ? 1 : -1
    document.body.style.overflow = modalesAbiertos > 0 ? 'hidden' : ''
  }
}

/**
 * Ciclo de vida modal completo, compartido para que las copias no
 * diverjan: bloqueo de scroll, captura del foco al abrir (con
 * `immediate: true` — un diálogo puede montarse YA abierto, p. ej. un
 * componente async cuyo chunk llega después del tap) y devolución del
 * foco al cerrar o desmontar (WCAG 2.4.3).
 */
export function usarModal(
  abierta: () => boolean,
  panel: Ref<HTMLElement | null>,
  hooks: { alAbrir?: () => void; alCerrar?: () => void } = {},
) {
  let origenFoco: HTMLElement | null = null
  const bloquear = crearBloqueoScroll()

  watch(
    abierta,
    async (estaAbierta) => {
      bloquear(estaAbierta)
      if (estaAbierta) {
        origenFoco = document.activeElement instanceof HTMLElement ? document.activeElement : null
        hooks.alAbrir?.()
        await nextTick()
        panel.value?.focus()
      } else {
        hooks.alCerrar?.()
        origenFoco?.focus()
        origenFoco = null
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    bloquear(false)
    origenFoco?.focus()
  })
}

const FOCUSABLES = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Trampa de foco: Tab desde el último enfocable vuelve al primero (y al revés) */
export function atraparTab(raiz: HTMLElement | null, evento: KeyboardEvent) {
  if (!raiz) return
  const enfocables = [...raiz.querySelectorAll<HTMLElement>(FOCUSABLES)].filter(
    (el) => el.offsetParent !== null,
  )
  if (enfocables.length === 0) return
  const primero = enfocables[0]!
  const ultimo = enfocables[enfocables.length - 1]!
  const activo = document.activeElement
  if (evento.shiftKey && (activo === primero || activo === raiz)) {
    evento.preventDefault()
    ultimo.focus()
  } else if (!evento.shiftKey && activo === ultimo) {
    evento.preventDefault()
    primero.focus()
  }
}
