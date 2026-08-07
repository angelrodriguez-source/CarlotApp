# 03 - Arquitectura del frontend

## Arranque (`app/src/main.ts`)

1. Crea la app Vue, registra Pinia (antes que nada) y el router
2. Monta la app (siempre se ve algo en pantalla)
3. `userStore.init()` en background: comprueba la sesion guardada y
   escucha `onAuthStateChange` (sin llamadas a Supabase dentro del
   callback — deadlock del lock de auth)
4. En produccion registra el service worker (`sw.js`) y escucha
   actualizaciones → evento `carlotapp-sw-update` → toast en App.vue

## Routing (`router/index.ts`)

Hash mode (`createWebHashHistory`) — obligatorio en GitHub Pages.

| Ruta | Vista | Que hace |
|------|-------|----------|
| `/` | LoginView | Boton "Entrar con Google" |
| `/hoy` | HoyView | Dashboard: resumen en grande (edad/peso/altura, sueno del dia, leche) + accesos rapidos (Sueno, Toma, Caca, Mas) + linea de tiempo |
| `/historial` | HistorialView | Dias plegables con resumen y registros (7/14/30 dias); edicion y borrado inline de cada registro |
| `/evolucion` | EvolucionView | Alta de medidas + graficas peso/altura/PC con percentil OMS junto a cada valor y graficas de evolucion del percentil + tabla |
| `/citas` | CitasView | Proximas y hechas, alta, check de completada |

Guard global: espera `userStore.waitUntilReady()` y redirige segun sesion
(login ↔ hoy). Todas las rutas salvo `/` requieren sesion.

## Stores (Pinia)

- **userStore**: `user`, `isLoggedIn`, `nombre`, `init()`,
  `waitUntilReady()`, `loginConGoogle()` (OAuth con `redirectTo` a la raiz
  de la app), `logout()`
- **bebeStore**: `bebe` (Carlota), `edad` (texto legible), `cargar()`
  (una vez, cacheado), `reset()` al logout. `bebe === null` con
  `cargado === true` ⇒ usuario sin acceso (no esta en la lista blanca)

## Servicios

- **services/supabase.ts**: UNICA instancia del cliente. `flowType: 'pkce'`
  para que el retorno del OAuth de Google (`?code=...`) no choque con el
  hash router. Credenciales: `.env.local` en dev, fallbacks hardcoded en
  produccion (la anon key es publica).
- **services/carlotaService.ts**: TODO el acceso a datos. Funciones por
  entidad (registrar/listar/actualizar/eliminar tomas, suenos, panales,
  eventos, medidas, citas; iniciar/finalizar sueno; registrar sueno a
  posteriori; marcar cita). Convencion:
  lanzan `Error` si Supabase devuelve error; las vistas capturan y
  muestran el mensaje.

**Los componentes/vistas jamas importan `supabase` directamente.**

## Logica pura (`models/CarlotaModel.ts`)

Sin DOM, sin red — lo unico testeado (Vitest, `models/__tests__/`):

- `edadTexto(nacimiento)` — "8 semanas y 5 dias" / "3 meses y 12 dias"
- `edadCorta(nacimiento)` — version compacta para tiles: "8 sem 5 d" / "3 m 12 d"
- `duracionMinutos`, `formatoDuracion` — "2 h 15 min"
- `formatoPeso` — 4320 g → "4,32 kg"
- `ultimoValor` — ultimo valor no nulo de una serie por fecha (peso/altura mas recientes)
- `claveDia`, `hoyLocal` — dia local via `toLocaleDateString('sv-SE')`
- `agruparPorDia` — registros → Map por dia (recientes primero)
- `resumenDia` — nº tomas, ml biberon, min pecho, min sueno, panales/cacas
- `serieGrafica` — medidas → puntos (fecha, valor) para GraficaLinea
- `textoToma/textoSueno/textoPanal/textoEvento` — registro → texto de las
  lineas de tiempo (compartido por Hoy e Historial)
- `aInputLocal` — Date → valor de `<input type="datetime-local">`
- `edadDias`, `percentilOMS` — percentil OMS de una medida (LMS + CDF normal)

Ademas, `models/referenciaOMS.ts` (GENERADO, no editar a mano): estandares
OMS de ninas semanas 0-100 (P3/P15/P50/P85/P97 + parametros LMS de peso,
altura y perimetro craneal). Se regenera con
`python3 scripts/generar-referencia-oms.py <ruta-a-growthstandards>` a partir
de las tablas del repo oficial github.com/WorldHealthOrganization/anthro.

## Componentes

- **GraficaLinea.vue**: grafica de linea en SVG puro (sin librerias),
  eje Y autoajustado, tooltips nativos (`<title>`), responsive via viewBox.

## Estilos

CSS puro. Variables y utilidades compartidas en `assets/main.css`
(`.pantalla`, `.tarjeta`, `.boton`, `.campo`, `.chip`, `.fila-registro`).
Paleta rosa suave (`--color-primario: #e57398`). Navegacion inferior fija
(App.vue) con safe-area para iPhone.
