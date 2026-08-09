/**
 * sw.js — Service Worker de CarlotApp
 *
 * Estrategia conservadora para no servir versiones viejas:
 *  - Navegaciones (HTML): red primero, cache como fallback offline
 *  - Assets con hash de Vite (/assets/): cache primero (son inmutables)
 *  - Resto: red con fallback a cache
 */
const CACHE = 'carlotapp-v12'

// Estaticos de public/ (sin hash): precacheados para que el avatar y los
// iconos de la navegacion funcionen offline desde el primer arranque
const PRECACHE = [
  './',
  './manifest.webmanifest',
  './icon.svg',
  './carlota.jpg',
  './icono-inicio.png',
  './icono-historial.png',
  './icono-evolucion.png',
  './icono-citas.png',
  './icono-dia.png',
  './icono-toma.png',
  './icono-pis.png',
  './icono-caca.png',
  './icono-panal.png',
  './icono-sueno.png',
  './icono-sueno-post.png',
  './icono-objetivo-sueno.png',
  './icono-momento.png',
  './icono-unas.png',
  './icono-otro.png',
  './icono-bano.png',
  './icono-vitamina.png',
  './icono-medicacion.png',
  './icono-ritmo.png',
  './icono-peso.png',
  './icono-altura.png',
  './nenei.png?v=2',
]

self.addEventListener('install', (event) => {
  // allSettled y no addAll: addAll es atomico y un solo 404 (p. ej. un
  // icono renombrado con la lista sin actualizar) abortaria TODAS las
  // instalaciones futuras del SW sin sintoma visible. Con allSettled el
  // recurso que falte solo pierde su copia offline.
  // cache: 'reload' salta la cache HTTP del navegador: sin ello, un
  // precache nuevo puede rellenarse con bytes viejos (max-age de Pages)
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })))),
      ),
  )
})

// La app envia SKIP_WAITING cuando el usuario acepta actualizar
// (toast "version nueva" en App.vue)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
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
        (hit) =>
          hit ??
          fetch(request).then((res) => {
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
