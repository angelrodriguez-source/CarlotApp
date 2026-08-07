/**
 * sw.js — Service Worker de CarlotApp
 *
 * Estrategia conservadora para no servir versiones viejas:
 *  - Navegaciones (HTML): red primero, cache como fallback offline
 *  - Assets con hash de Vite (/assets/): cache primero (son inmutables)
 *  - Resto: red con fallback a cache
 */
const CACHE = 'carlotapp-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['./', './manifest.webmanifest', './icon.svg'])),
  )
})

// La app envia SKIP_WAITING cuando el usuario acepta actualizar
// (toast "version nueva" en App.vue)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // No interceptar llamadas a Supabase ni a otros origenes
  if (url.origin !== self.location.origin) return

  // Assets inmutables de Vite: cache primero.
  // Solo se cachean respuestas OK — un 404/500 transitorio (p.ej. durante
  // un deploy) no debe quedar congelado en la cache.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) => hit ?? fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return res
        }),
      ),
    )
    return
  }

  // Navegaciones y demas: red primero, cache si estamos offline
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return res
      })
      .catch(() => caches.match(request).then((hit) => hit ?? caches.match('./'))),
  )
})
