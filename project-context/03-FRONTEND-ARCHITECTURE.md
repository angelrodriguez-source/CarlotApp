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
| `/hoy` | HoyView | Dashboard en 3 cards: (1) "La bebe" — carita + nombre completo + tiles edad/peso/altura con percentil (enlazan a Evolucion) + semana 🌱 plegable; (2) "📅 Datos de Hoy" con hora actual y 3 secciones — objetivos del dia, ultimos hitos (el ultimo de CADA tipo, los visibles sin desplegar los configura cada usuario) y registro del dia (2 ultimos, expandible, swipe para borrar, tocar una fila abre su edicion); (3) "⚡ Accesos directos" — las acciones que configure cada usuario. El FAB ＋ de la nav abre la hoja con TODOS los tipos de registro (?registrar=1); ?config=1 abre la hoja de Configuracion (menu de usuario). Banda de proxima cita &lt;7 dias → Citas |
| `/historial` | HistorialView | Grafica de ritmo de 24h (tocar una fila abre ese dia) + seccion Momentos + dias plegables con resumen en una linea; edicion en hoja inferior (HojaEdicionRegistro) |
| `/evolucion` | EvolucionView | Alta de medidas (?nueva=1 la abre directamente) + segmento Valor \| Percentil (3 graficas) con bandas P3-P97 de la OMS y mediana punteada + graficas de dia a dia (leche ml/dia y sueno h/dia, rango 7/14/30; ?grafica=tomas\|sueno hace scroll hasta ellas — enlazan los objetivos de Hoy) + tabla con percentiles; ✎ en cada medicion abre su edicion/borrado en hoja inferior |
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
- `tramoEnDia`, `minutoDelDia`, `ultimosDias` — helpers del ritmo de 24h
  (recorte de intervalos por dia local, con cruce de medianoche)
- `objetivoSuenoMinutos`, `objetivoLecheMl` — objetivos diarios orientativos
  por edad (sueno: rangos NSF/AASM; leche: regla ml/kg sobre el peso)

Ademas, `models/referenciaOMS.ts` (GENERADO, no editar a mano): estandares
OMS de ninas semanas 0-100 (P3/P15/P50/P85/P97 + parametros LMS de peso,
altura y perimetro craneal). Se regenera con
`python3 scripts/generar-referencia-oms.py <ruta-a-growthstandards>` a partir
de las tablas del repo oficial github.com/WorldHealthOrganization/anthro.

Y `models/semanasDesarrollo.ts` (editado a mano): etapas de desarrollo para
las semanas 0-100 — cambios principales + ajustes de sueno y tomas por
etapa (hitos CDC/AAP/NHS, orientativo). `desarrolloSemana(n)` hace el
lookup; test de cobertura garantiza que ninguna semana queda sin etapa.

## Componentes

- **GraficaLinea.vue**: grafica de linea en SVG puro (sin librerias),
  eje Y autoajustado, tooltips nativos (`<title>`), responsive via viewBox.
  Prop opcional `banda` (P3/P50/P97 OMS por punto) que pinta la franja de
  la cartilla con la mediana punteada.
- **GraficaRitmo.vue**: ritmo de 24h en SVG puro — una fila por dia,
  tramos de sueno como bloques y tomas como puntos, con leyenda; emite
  `seleccionarDia` al tocar una fila.
- **BarraObjetivo.vue**: fila de objetivo diario (valor en negrita +
  objetivo + barra con marca en el minimo; relleno verde al entrar en rango).
- **HojaInferior.vue**: bottom sheet (Teleport a body) para formularios,
  con transicion "hoja" y cierre por fondo o ✕.
- **HojaEdicionRegistro.vue**: hoja de edicion/borrado de cualquier
  registro (toma, sueno, panal, evento). Prop `registro:
  RegistroEditable | null` (union discriminada de
  `components/registroEditable.ts`), emite `cerrar`/`guardado`. La usan
  el registro del dia de Hoy (tocar una fila) y el Historial (✎).

## Estilos

CSS puro. Variables y utilidades compartidas en `assets/main.css`
(`.pantalla`, `.tarjeta`, `.boton`, `.campo`, `.chip`, `.fila-registro`,
`.esqueleto`, `.pulso`, transiciones `hoja`/`aparecer` con
prefers-reduced-motion). Paleta verde aguamarina con roles: `--color-accion`
(#17685e, botones primarios — texto blanco cumple AA), `--color-primario`
(graficas/barras), `--color-primario-suave` (tintes). Jerarquia de
tarjetas: `.tarjeta` (accionable, con sombra), `.tarjeta-hero` (tinte, sin
borde), `.tarjeta-plana` (sin sombra). Navegacion inferior fija (App.vue)
con FAB central "+" (abre el registro desde cualquier pantalla) y
safe-area para iPhone.

**Cabecera (App.vue)**: logo + "CarlotApp" (enlaza a Hoy desde cualquier
pantalla) y la bolita de usuario (inicial de la cuenta) con el menu:
nombre/email, ⚙ Configuracion (→ hoja de Hoy via ?config), tema
(auto → oscuro → claro, localStorage `carlotapp-tema`) y salir.

**Modo noche**: clase `.noche` en `<html>` que redefine las variables de
color (paleta oscura); automatica de 22:00 a 08:00, forzable desde el
menu de usuario.

**Configuracion por usuario** (hoja "⚙ Configuracion" en Hoy): hitos
visibles sin desplegar y accesos directos de la card, persistidos en
localStorage con clave por usuario (`carlotapp-hitos-<uid>` /
`carlotapp-accesos-<uid>`) via el helper `listaPersistida`. La URL del
logo (respetando BASE_URL) vive en `assets/branding.ts`.
