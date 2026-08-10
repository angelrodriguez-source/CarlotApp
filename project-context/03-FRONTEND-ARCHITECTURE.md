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
| `/hoy` | HoyView | Dashboard en 3 cards: (1) "La bebe" — carita + nombre completo + tiles edad/peso/altura con percentil (enlazan a Evolucion); (2) "Cómo va el día" (icono icono-dia.png) con fecha y hora actual en la cabecera y 3 secciones — objetivos del dia, ultimos hitos (el ultimo de CADA tipo, los visibles sin desplegar los configura cada usuario) y registro del dia (2 ultimos, expandible, swipe para borrar, tocar una fila abre su edicion; el sueño nocturno que cruza la medianoche aparece en ambos dias via suenosDeDia — solo presentacion, con aviso "empezo el dia anterior / sigue tras medianoche" y su parte del dia); (3) "⚡ Accesos directos" — las acciones que configure cada usuario. El FAB ＋ de la nav abre la hoja con TODOS los tipos de registro (?registrar=1); panales, eventos y momentos se registran en una hoja con hora editable (precargada con ahora); ?config=1 abre la hoja de Configuracion (menu de usuario). Banda de proxima cita &lt;7 dias → Citas |
| `/historial` | HistorialView | Grafica de ritmo de 24h (tocar una fila abre ese dia) + seccion Momentos + dias plegables con resumen en una linea; edicion en hoja inferior (HojaEdicionRegistro) |
| `/evolucion` | EvolucionView | Alta de medidas (?nueva=1 la abre directamente) + segmento Valor \| Percentil: peso y altura con las curvas estandar OMS de fondo (deciles P0-P100, ventana de 60 dias con hoy en el dia 45, GraficaCrecimiento) y PC con banda P3-P97 + tabla con percentiles + graficas de dia a dia (leche ml/dia y sueno h/dia, rango 7/14/30, con franja naranja del rango recomendado por edad; ?grafica=tomas\|sueno hace scroll hasta ellas — enlazan los objetivos de Hoy); ✎ en cada medicion abre su edicion/borrado en hoja inferior |
| `/citas` | CitasView | "Citas & Recordatorios": proximas y hechas, alta, check de completada; y la card de Recordatorios (item + intervalo dia/semana + repeticiones, alta/pausa/borrado, estado "Hoy: 1 de 3 · quedan 2" via recordatoriosStore) |

Guard global: espera `userStore.waitUntilReady()` y redirige segun sesion
(login ↔ hoy). Todas las rutas salvo `/` requieren sesion.

## Stores (Pinia)

- **userStore**: `user`, `isLoggedIn`, `nombre`, `init()`,
  `waitUntilReady()`, `loginConGoogle()` (OAuth con `redirectTo` a la raiz
  de la app), `logout()`
- **bebeStore**: `bebe` (Carlota), `edad` (texto legible), `cargar()`
  (una vez, cacheado), `reset()` al logout. `bebe === null` con
  `cargado === true` ⇒ usuario sin acceso (no esta en la lista blanca)
- **recordatoriosStore**: `recordatorios`, `estados` (hechas/pendientes,
  de models/recordatorios.ts), `avisos(ahora)` (numerito del badge de
  Neneni), `refrescar()` (recordatorios + registros de 7 dias en paralelo,
  con guard de un solo refresco en vuelo), `iniciar()` (al login: primera
  carga + escucha de `EVENTO_DATOS_CAMBIADOS` con debounce de 800 ms),
  `reset()` al logout. Sin polling: se refresca al escribir datos.

## Servicios

- **services/supabase.ts**: UNICA instancia del cliente. `flowType: 'pkce'`
  para que el retorno del OAuth de Google (`?code=...`) no choque con el
  hash router. Credenciales: `.env.local` en dev, fallbacks hardcoded en
  produccion (la anon key es publica).
- **services/carlotaService.ts**: TODO el acceso a datos. Funciones por
  entidad (registrar/listar/actualizar/eliminar tomas, suenos, panales,
  eventos, medidas, citas, recordatorios; iniciar/finalizar sueno;
  registrar sueno a posteriori; marcar cita). Convencion:
  lanzan `Error` si Supabase devuelve error; las vistas capturan y
  muestran el mensaje. Toda mutacion emite `EVENTO_DATOS_CAMBIADOS`
  (window event) para que los stores/paneles se refresquen solos.
  `iniciarEscuchaRemota()`/`pararEscuchaRemota()` (las llama App.vue con
  el login/logout): canal de Supabase Realtime sobre las tablas de datos
  (migracion 9) que reemite el MISMO evento cuando escribe la otra
  persona — asi todo lo que ya escucha el evento se refresca tambien con
  los cambios remotos, sin polling.

- **services/notificaciones.ts**: notificaciones locales (fase 1 de Web
  Push, sin servidor) — `soportaNotificaciones()`,
  `permisoNotificaciones()`, `pedirPermisoNotificaciones()` y
  `mostrarNotificacion(titulo, cuerpo, tag)` via
  `registration.showNotification` del SW. Lo usa App.vue: boton
  "Activar/Probar notificaciones" en el menu de usuario y el aviso de
  recordatorios de las 19h como notificacion del sistema (una vez al dia,
  guard `carlotapp-aviso-recordatorios` en localStorage). El tap en la
  notificacion enfoca/abre la app (`notificationclick` en sw.js). Solo
  funciona con la app abierta; el push real con app cerrada es fase 2.

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
- `valorPercentilOMS` — valor de un decil OMS (P10-P90) a cierta edad, para
  las curvas estandar de fondo de GraficaCrecimiento
- `tramoEnDia`, `minutoDelDia`, `ultimosDias` — helpers del ritmo de 24h
  (recorte de intervalos por dia local, con cruce de medianoche)
- `mensajeError`, `horaCorta`, `fechaCortaDia`, `rangoDesde` — helpers
  compartidos por las vistas (mensaje de error, formatos, rango de fechas)
- `percentilRedondeado`, `mlEnDia`, `recortarVaciosIniciales`,
  `minutosEnDia` — agregados puros que antes vivian duplicados en vistas
- `objetivoSuenoMinutos`, `objetivoLecheMl` — objetivos diarios orientativos
  por edad (sueno: rangos NSF/AASM; leche: regla ml/kg sobre el peso)

Ademas, el **Mime Predictor** (con su UI: el bocadillo de Ñeñeñi, ver
Componentes):

- `models/prediccionBase.ts` — linea base poblacional precargada por edad
  (ventanas de vigilia, intervalos de toma dia/noche, panales/dia; fuentes:
  Taking Cara Babies, Huckleberry, Cleveland Clinic, AAP/Enfamil, Pampers)
- `models/MimePredictor.ts` — `predecir()` (proxima toma, proxima siesta,
  incomodidad, con franja de confianza) y `porQueLlora()` (probabilidades
  Sueno/Hambre/Incomodidad por softmax de presiones). Mezcla en TRES
  capas con shrinkage peso=n/(n+k): base poblacional ← patron historico
  (medianas/IQR de 7 dias, dia/noche separados, k=3) ← comportamiento
  ACTUAL (mediana de hasta 5 intervalos de hoy, kReciente=1, excluyendo
  los que cruzan el amanecer). Calibrado por backtesting walk-forward
  (MimePredictor.spec.ts, bebes simulados con RNG sembrado): MAE tomas
  <25 min y siestas <22 min en bebe regular; un brote de crecimiento
  (hoy toma cada 130 vs historico 195) pasa de MAE ~33 a <25 gracias a
  la capa actual; frio, cambiante e irregular acotados
- `pronosticoNoche()` — en franja nocturna (21-07h), tomas que quedan
  hasta las 07:00 proyectando la cadencia nocturna (misma mezcla de 3
  capas; el primer eslabon usa la cadencia DIURNA si la ultima toma fue
  de dia); `esHoraNocturna()` para que la UI sepa cuando mostrarlo
- Robustez: los anclas (ultima toma/panal) ignoran registros con hora
  futura; los intervalos que cruzan franja (amanecer, tarde→noche) se
  excluyen tambien del historico; banda de confianza = 1.0·IQR
  (recalibrada por backtest tras esa exclusion, cobertura ~70-88%)
- Capa de CANTIDAD con dos modos: (1) tomas separadas por <45 min se
  consolidan en COMIDAS; si la ultima comida quedo por debajo del 65% de
  la racion tipica (mediana por comida) Y la bebe ha demostrado que
  remata (≥2 remates observados), se predice un REMATE cercano — mediana
  de sus huecos intra-comida con prior de 40 min — con los ml que faltan
  (`esRemate`, `mlPrevisto`); (2) si no, cadencia normal modulada por el
  factor 1 + 0.35·(mlComida/tipico − 1) acotado [0.5, 1.4], calibrado
  por barrido con bebes acoplados (α fuerte: MAE 32→23; sin acople solo
  paga +1.4 min). Backtest de comidas partidas (35%): remates predichos
  con error de 0-9 min. Ñeñeñi lo cuenta ("pedira un remate de unos
  60 ml para completarla" / "la proxima toma, de unos 120 ml, ...")
- MINI-DESPERTARES: tramos de sueño separados por <25 min se consolidan
  en un mismo bloque antes de aprender ventanas de vigilia (despertarse
  10-20 min y volver a dormir no es una ventana y contaminaria la
  mediana); backtest con 50% de siestas fragmentadas mantiene el MAE
- SIESTA CORTA: la duracion de la ultima siesta frente a su tipica
  (mediana de bloques diurnos) modula la ventana siguiente — factor
  1 + 0.4·(dur/tipica − 1) acotado [0.55, 1.25], sens calibrada por
  barrido (acople fuerte: MAE 23→17.5; la literatura recorta ~45 min la
  ventana tras siesta de <45 min ≈ un ciclo). `factorSiesta` expuesto
- SUEÑO NOCTURNO: si la proyeccion (o la hora actual) cae a <60 min de
  su hora de acostarse — mediana personal de inicios nocturnos con
  shrinkage k=3 hacia la base por edad (horaAcostar en
  prediccionBase.ts, fuentes BabySleepSite/Sleep Foundation) — lo
  previsto ya no es una siesta sino el sueño largo (`esSuenoNocturno`);
  margen 60 calibrado por barrido {30..90} sobre inicios vespertinos
  (optimo ~12 min de MAE; con ≥75 las siestas tardias se marcan mal)
- `models/frasesNeneni.ts` — las frases del bocadillo y la nota de
  aprendizaje como funciones puras (frasesNeneni, notaAprendizaje),
  testeadas en frasesNeneni.spec.ts
- `models/validacion.ts` — controles de rango de TODAS las entradas
  (testeados): `LIMITES_ENTRADA` es el unico punto de ajuste (ml de
  biberon 5-500, pecho 1-120 min, sueno <= 16 h, peso 1.5-25 kg, altura
  40-120 cm, PC 28-60 cm, tolerancia de futuro 5 min);
  `validarRango`, `validarFechaRegistro` (dentro de [nacimiento,
  ahora+tolerancia]), `validarFechaDia` (medidas), `validarTramoSueno` y
  `primerError`. Los formularios (HoyView, HojaEdicionRegistro,
  EvolucionView) validan ANTES de llamar al servicio y ademas llevan
  min/max nativos en los inputs (fechas acotadas a la vida de la bebe)
- Persistencia: `guardarPrediccion`/`getPrediccionGuardada` en el servicio
  (upsert de una fila viva por bebe en `predicciones`) +
  `aFilaPrediccion()` para serializar
- `models/recordatorios.ts` — logica pura de los Recordatorios
  (testeada en recordatorios.spec.ts): `AJUSTES_RECORDATORIOS` (hora de
  aviso 19h, ventana semanal 7 dias, repeticiones 1-24) como unico punto
  de ajuste; `ITEMS_RECORDATORIO` (catalogo con etiqueta e icono);
  `estadoRecordatorios()` cuenta los registros reales dentro de la
  ventana (dia local u ultimos 7 dias rodantes; el ejercicio filtra por
  subtipo si el recordatorio lo fija); `avisosRecordatorios()` (badge:
  solo desde la hora de aviso); `fraseRecordatorios()` (la frase del
  bocadillo: enumeracion de dia, aviso al caer el dia, celebracion si
  todo esta hecho) y `etiquetaRecordatorio()`

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
- **GraficaCrecimiento.vue**: grafica de crecimiento en SVG puro con eje X
  en dias de edad: curvas estandar OMS de fondo (deciles P0-P100, la P50
  punteada, etiquetadas a la derecha) y la serie medida encima. La usan
  peso y altura en Evolucion (ventana de 60 dias).
- **GraficaRitmo.vue**: ritmo de 24h en SVG puro — una fila por dia,
  tramos de sueno como bloques y tomas como puntos, con leyenda; emite
  `seleccionarDia` al tocar una fila.
- **BarraObjetivo.vue**: fila de objetivo diario (valor en negrita +
  objetivo + barra con marca en el minimo; relleno verde al entrar en rango).
- **HojaInferior.vue**: bottom sheet (Teleport a body) para formularios,
  con transicion "hoja" y cierre por fondo o ✕.
- **NeneniPanel.vue**: el bocadillo de Ñeñeñi (public/nenei.png, mascota
  Mime experta en bebes) — la UI del Mime Predictor. Se abre desde su
  icono de la cabecera (App.vue), carga los ultimos 8 dias via servicio
  (memoizado 60 s: reabrir no repite consultas), ejecuta `predecir()` y
  lo cuenta en primera persona con las frases de models/frasesNeneni.ts
  (proxima toma con franja, proxima siesta, pronostico de la noche si es
  de noche), con nota de cuanto pesa ya el patron personal. Boton
  "¿Por que llora?" con barras Sueno/Hambre/Incomodidad + explicaciones,
  y despues la seccion plegable "Semana N" (semanasDesarrollo.ts, voz de
  experto: cambios + ajustes de sueno/tomas de la semana — vivia en la
  card de la bebe de Hoy y se movio aqui). Tras las frases de prediccion,
  la frase de recordatorios (models/recordatorios.ts via
  recordatoriosStore): que queda pendiente hoy, con tono de aviso desde
  las 19h. El icono de la cabecera lleva el badge rojo con el numero de
  recordatorios pendientes (App.vue, `avisos()` del store, visible solo
  desde la hora de aviso; la reactividad horaria la da el ref horaActual
  que ya se refresca cada minuto).
  Es un modal completo (mismo patron que HojaInferior: foco, trampa de
  Tab, Escape, scroll-lock via components/modal.ts, Teleport). Persiste
  el calculo en `predicciones` en segundo plano con boton de reintento
  si falla la carga.
- **autorrecarga.ts** (components/): `usarAutorrecarga(recargar)` — la
  vista pasa su funcion de recarga SILENCIOSA (sin esqueletos, con token
  anti-pisado) y se dispara con debounce (900 ms) al llegar
  `EVENTO_DATOS_CAMBIADOS` (escrituras propias y remotas via Realtime) y
  al volver la pestana/PWA a primer plano. Devuelve `recargarAhora()`:
  las vistas la usan tras sus PROPIAS escrituras — recarga inmediata que
  cancela el debounce del evento de esa misma escritura (una sola tanda
  de consultas por registro). Lo usan Hoy (cargarDia), Historial
  (cargar(silenciosa=true)), Evolucion y Citas; las cuatro limpian el
  banner de error al completar una carga con exito.
- **modal.ts** (components/): el ciclo de vida modal compartido —
  `usarModal(abierta, panel, {alAbrir, alCerrar})` (scroll-lock con
  contador comun, captura/devolucion de foco, `immediate: true` para
  dialogos que se montan ya abiertos) y `atraparTab()`. Lo usan
  HojaInferior y NeneniPanel, que ademas invalida su memoizacion con el
  evento `EVENTO_DATOS_CAMBIADOS` que emite carlotaService en cada
  escritura de tomas/suenos/panales.
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
borde), `.tarjeta-plana` (sin sombra). Navegacion inferior fija (App.vue; la pestana Inicio usa icono propio public/icono-inicio.png)
con FAB central "+" (abre el registro desde cualquier pantalla) y
safe-area para iPhone.

**Cabecera (App.vue)**: logo + "CarlotApp" (enlaza a Hoy desde cualquier
pantalla), el icono de Ñeñeñi (abre su bocadillo de predicciones,
NeneniPanel, cargado con defineAsyncComponent para no engordar el chunk
de entrada) y la bolita de usuario (inicial de la cuenta) con el menu:
nombre/email, ⚙ Configuracion (→ hoja de Hoy via ?config), tema
(auto → oscuro → claro, localStorage `carlotapp-tema`), 💚 Acerca de
(hoja inferior con la marca) y salir. El menu es navegable con teclado
(foco al abrir/cerrar, flechas, Escape).

**Modo noche**: clase `.noche` en `<html>` que redefine las variables de
color (paleta oscura); automatica de 22:00 a 08:00, forzable desde el
menu de usuario.

**Configuracion por usuario** (hoja "⚙ Configuracion" en Hoy): hitos
visibles sin desplegar y accesos directos de la card, persistidos en
localStorage con clave por usuario (`carlotapp-hitos-<uid>` /
`carlotapp-accesos-<uid>`) via el helper `listaPersistida`. La URL del
logo (respetando BASE_URL) vive en `assets/branding.ts`.
