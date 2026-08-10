/**
 * notificaciones.ts — Notificaciones locales (fase 1 del camino a Web Push).
 *
 * Esta fase NO usa un servidor de push: la propia app, mientras está
 * abierta (pestaña o PWA instalada), muestra notificaciones del sistema a
 * través del service worker. Sirve para probar el flujo completo de
 * permiso + notificación + tap. La fase 2 (avisar con la app cerrada)
 * necesitará claves VAPID, guardar suscripciones y un emisor
 * (Edge Function o workflow programado).
 */
import { urlPublica } from '../assets/branding'

export type PermisoNotificaciones = NotificationPermission | 'no_soportado'

/** ¿Este navegador puede mostrar notificaciones vía service worker? */
export function soportaNotificaciones(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator
}

export function permisoNotificaciones(): PermisoNotificaciones {
  return soportaNotificaciones() ? Notification.permission : 'no_soportado'
}

/** Pide el permiso al usuario (el navegador solo pregunta una vez) */
export async function pedirPermisoNotificaciones(): Promise<PermisoNotificaciones> {
  if (!soportaNotificaciones()) return 'no_soportado'
  return Notification.requestPermission()
}

/**
 * Muestra una notificación del sistema. Devuelve false si no hay permiso
 * o no hay service worker activo (p. ej. en dev sin SW registrado).
 * `tag` agrupa: una notificación nueva con el mismo tag sustituye a la
 * anterior en vez de apilarse.
 */
export async function mostrarNotificacion(
  titulo: string,
  cuerpo: string,
  tag = 'carlotapp',
): Promise<boolean> {
  if (permisoNotificaciones() !== 'granted') return false
  const registro = await navigator.serviceWorker.getRegistration()
  if (!registro) return false
  await registro.showNotification(titulo, {
    body: cuerpo,
    tag,
    icon: urlPublica('icon-192.png'),
    badge: urlPublica('icon-192.png'),
  })
  return true
}
