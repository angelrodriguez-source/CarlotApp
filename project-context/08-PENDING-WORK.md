# 08 - Trabajo pendiente

## Configuracion inicial (bloqueante — lo hace Angel, ver README.md raiz)

- [x] Crear el repo `CarlotApp` en GitHub y volcar este esqueleto (2026-08-07)
- [x] Crear el proyecto Supabase nuevo: `aolbgcuvgcjpogdarpmg` (2026-08-07)
- [x] Rellenar los `TODO(config)` (2026-08-07): emails (Angel y Cristina),
      fecha de nacimiento (2026-06-05), URL + publishable key
- [x] Secret `SUPABASE_DB_URL` en el repo + lanzar workflow de migraciones (2026-08-07)
- [x] Google OAuth en Supabase + Site URL (2026-08-07)
- [x] Activar GitHub Pages (rama `gh-pages`) tras el primer deploy (2026-08-07)
- [ ] Secrets `MAIL_USERNAME` y `MAIL_PASSWORD` (contrasena de aplicacion
      Gmail) para el recordatorio nocturno por email (ver 07-DEPLOYMENT)

## Registro de Ejercicio (2026-08-09)

- [x] Nuevo tipo de registro **Ejercicio** (idea de Angel): subtipo
      Tummy Time (por defecto) / Estimulacion / Otros + tiempo en
      minutos. Es un evento (tipo 'ejercicio', migracion 7) con
      `subtipo` y `duracion_min`; en las lineas de tiempo se muestra
      "Ejercicio (Tummy Time) — 15 min". Hoja de alta propia (accion en
      el catalogo del + y de accesos directos), hito "Ultimo ejercicio"
      en el catalogo, edicion completa en HojaEdicionRegistro y rango de
      validacion 1-180 min. Icono pendiente (de momento emoji 🤸).

## Recordatorios (2026-08-10)

- [x] Seccion **Recordatorios** (idea de Angel): sobre un item de
      registro, "deberia hacerse N veces al dia/semana" (vitamina D 1
      vez al dia, Tummy Time 3 veces al dia...). Tabla `recordatorios`
      (migracion 8: item + subtipo de ejercicio opcional + intervalo
      dia/semana + repeticiones 1-24 + activo, RLS lista blanca). El
      estado NO se persiste: `models/recordatorios.ts` (testeado) cuenta
      los registros reales en la ventana (dia local / 7 dias rodantes).
      `recordatoriosStore` carga recordatorios + registros de la semana
      y se refresca con EVENTO_DATOS_CAMBIADOS (debounce 800 ms, sin
      polling). UI: la vista Citas pasa a "Citas & Recordatorios" con
      card propia (alta, pausa, borrado, "Hoy: 1 de 3 · quedan 2");
      Ñeñeñi enumera lo pendiente en el bocadillo y desde las 19h avisa
      con "el dia se acaba" + badge rojo con numerito sobre su icono de
      la cabecera. Ajustes en AJUSTES_RECORDATORIOS (hora de aviso,
      ventana semanal, rango de repeticiones).

## Autorrecarga con Realtime (2026-08-10)

- [x] La app abierta se refresca sola cuando la OTRA persona registra
      algo: Supabase Realtime (migracion 9: tablas de datos en la
      publicacion supabase_realtime) → `iniciarEscuchaRemota()` en el
      servicio reemite EVENTO_DATOS_CAMBIADOS → las 4 vistas lo escuchan
      con `usarAutorrecarga()` (recarga silenciosa con debounce 900 ms,
      tambien al volver a primer plano, que cubre sockets dormidos en
      segundo plano). Sin polling; los tokens anti-pisado de cada vista
      evitan que una respuesta vieja machaque datos recientes.

## Introspeccion a fondo 2026-08-10 (revision total — APLICADA ese dia)

Code-review del ultimo merge + 3 auditorias paralelas (modelos puros,
vistas/stores, PWA/infra/docs). 20 hallazgos aplicados:

- [x] Robustez de la autorrecarga: tokens anti-pisado en Citas y
      Evolucion (medidas); `recargarAhora()` en el composable — la
      recarga tras una escritura propia cancela el debounce de su propio
      evento (antes cada registro lanzaba las consultas DOS veces);
      banner de error se limpia al completar una carga con exito;
      listener visibilitychange duplicado de Hoy eliminado; suscripcion
      Realtime con callback de estado y reintento a 30 s (antes un fallo
      al entrar dejaba la sesion sin refresco remoto en silencio);
      refrescar() del recordatoriosStore repite al terminar si llego
      otro cambio en pleno vuelo.
- [x] Mutaciones de eventos/medidas/citas emiten avisarDatosCambiados()
      (los recordatorios cuentan eventos: sin esto el badge no se
      enteraba de la vitamina D con el socket dormido).
- [x] Mime Predictor: ancla de acostarse construida con setHours (los
      dias de cambio de hora la suma de ms la desplazaba 1 h);
      CADUCIDAD del modo remate (caducidadRemateMin 75 o gap+banda
      personales — antes "el remate ya toca" quedaba congelado horas);
      suenosDeDia marca "sigue tras medianoche" tambien en el sueno
      ABIERTO que cruza (fin efectivo = min(ahora, inicio+24h)).
- [x] HojaEdicionRegistro: editar una toma con el cronometro en marcha
      con duracion/ml vacios corrige inicio/tipo/notas SIN cerrarla
      (etiqueta "vacio = sigue en curso", como el sueno).
- [x] PWA: precache de icon-192/512 y maskable (icon/badge de las
      notificaciones), fallback offline al index SOLO para navegaciones
      (una imagen no debe resolver con HTML), CACHE v17; ruta comodin
      del router (hash desconocido → Hoy, antes pantalla en blanco);
      migrate.yml con concurrency y el INSERT en _migrations dentro de
      la MISMA transaccion que la migracion; fecha de "+ Cita" fresca al
      abrir el formulario; dedupe suenosConAbierto en Hoy; created_at en
      el tipo Recordatorio; docs desalineados corregidos (01/02/CLAUDE).

Diferido a proposito (bajo valor/alto riesgo hoy, candidatos a proxima
sesion de orden):

- [ ] Encadenar deploy.yml tras migrate.yml (hoy hay una ventana en la
      que la UI nueva puede llegar antes que su tabla)
- [ ] Purga de chunks huerfanos de /assets/ en el SW (se acumulan entre
      bumps de CACHE)
- [ ] Extraer el builder de filas del dia (Hoy/Historial lo duplican) a
      CarlotaModel como funcion pura testeada
- [ ] Trocear HoyView (~2000 lineas): extraer las 8 hojas inferiores a
      componentes (empezar por toma/panal/configuracion)
- [ ] Unificar formateadores de fecha repetidos entre vistas en
      CarlotaModel

## Super analisis 2026-08-08 (revision multi-agente — EJECUTADO ese mismo dia)

Revision de 6 dimensiones (correccion, UX, accesibilidad, rendimiento,
robustez de datos, arquitectura) con verificacion adversarial de cada
hallazgo: 27 confirmados, 3 refutados. Deduplicados y priorizados.
TODO CORREGIDO el 2026-08-08 (misma sesion). Notas de la ejecucion:
la banda de confianza de TOMAS se recalibro de 0.75·IQR a 1.0·IQR al
excluir cruzaFranja del historico (el IQR dejo de estar inflado;
cobertura 69-88% con el mismo MAE en el backtest; la de siestas sigue
en 0.75·IQR porque la vigilia nunca tuvo esa inflacion); las frases de
Ñeñeñi viven en models/frasesNeneni.ts (11 tests nuevos, 64 en total);
el ciclo de vida modal completo (scroll-lock, foco con immediate,
trampa de Tab) se compartio como `usarModal()` en components/modal.ts.
Una code-review posterior sobre el diff aporto 7 ajustes residuales,
tambien aplicados: immediate en el modal del panel (podia montarse ya
abierto al ser async), la memoizacion del bocadillo se invalida con el
evento EVENTO_DATOS_CAMBIADOS que emite el servicio en cada escritura
de tomas/suenos/panales, Tab cierra el menu de usuario (el foco no se
escapa detras del overlay), guardarPrediccion usa getSession (local)
en vez de getUser (round-trip), y el tope :max tambien en los 5 inputs
de HojaEdicionRegistro.

### Prioridad alta

- [x] **NeneniPanel sin semantica modal** (NeneniPanel.vue:168): declara
      `role="dialog"` pero le falta todo lo que HojaInferior si hace
      (HojaInferior.vue:27-102): `aria-modal`, captura/devolucion de foco,
      trampa de Tab (se tabula al contenido de fondo), Escape y bloqueo de
      scroll del body. Replicar el patron de HojaInferior (idealmente
      extrayendo el contador de scroll-lock a un modulo compartido).

### Prioridad media

- [x] **Anclas de prediccion admiten registros con hora futura**
      (MimePredictor.ts:349, 416, 471): el aprendizaje filtra
      `<= ahora` pero `ultimaToma` y `ultimoPanal` no — una toma guardada
      con hora futura por error ancla la prediccion ("proxima toma en
      7 h") y un panal futuro da "hace -1 h -30 min". Filtrar el futuro en
      los tres anclas + `:max` en los `datetime-local` de HoyView
      (1263, 1301, 1396, 1440) como segundo cinturon.
- [x] **porQueLlora normaliza el hambre con el intervalo de DIA tambien
      de noche** (MimePredictor.ts:526): `presionDe(..., centro(etapa.
      intervaloToma))` mientras la prediccion nocturna uso
      `intervaloTomaNoche` — de noche cada minuto de retraso cuenta doble
      y las barras se sesgan hacia Hambre. Usar la franja de `ahora`.
- [x] **"Ultimo panal hace X h Y min" mezcla Math.round con modulo**
      (MimePredictor.ts:565): 100 min se muestra como "2 h 40 min"
      (deberia ser 1 h 40). Cambiar a Math.floor (pasa la mitad de las
      veces que el resto es >= 30 min).
- [x] **pronosticoNoche proyecta cadencia nocturna desde una ultima toma
      diurna** (MimePredictor.ts:492): a las 21:15 con ultima toma 18:45
      se salta la toma de ~22:00 (cadencia diurna) y la lista queda corta
      justo cuando mas se consulta (21-23h). Primer eslabon con la mezcla
      diurna si la ultima toma es de dia; encadenar el resto en nocturna.
- [x] **esNoche congelado en NeneniPanel** (NeneniPanel.vue:163):
      `computed(() => esHoraNocturna(new Date()))` sin dependencia
      reactiva — Vue lo cachea para siempre y la nota nocturna puede salir
      a mediodia (o nunca). Pasarlo a ref asignado dentro de calcular()
      con el mismo `ahora`.
- [x] **Import estatico de NeneniPanel infla el chunk de entrada**
      (App.vue:12): arrastra MimePredictor + CarlotaModel + tabla OMS
      (~40 KB, ~10 KB gzip) al index-*.js que se descarga antes del login.
      Cambiar a `defineAsyncComponent(() => import(...))`. (Verificado: el
      chunk branding-*.js de 278 KB es @supabase/supabase-js entero,
      necesario en arranque — ahi no hay recorte.)
- [x] **nenei.png pesa 117 KB para pintarse a 36/76 px**: reprocesar a
      192x192 + paleta 256 colores (~9 KB medidos) en el mismo path y
      subir el SW a v8. Ahorro ~108 KB en cada instalacion del precache.
- [x] **Cada apertura del bocadillo repite 3 SELECT de 8 dias + 1 upsert**
      (NeneniPanel.vue:50): abrir/cerrar 3 veces = 9 consultas + 3
      escrituras identicas. Memoizar: saltar el refetch si hay prediccion
      de hace < 60 s.
- [x] **Menu de usuario sin teclado ni gestion de foco** (App.vue:138):
      Escape no cierra, el foco no entra/vuelve, `role="menu"` promete
      flechas que no existen y a `.bolita` le falta `aria-haspopup`.
      Minimo: aria-haspopup + foco al abrir/cerrar + @keydown.esc (o
      quitar los roles de menu y dejar botones).
- [x] **Reglas de dominio en computeds de NeneniPanel** (frases:92,
      notaAprendizaje:143): umbrales ("ya toca" con minutos <= 0,
      pct < 40 "aun estoy aprendiendo", singular/plural del pronostico)
      viven en el componente y quedan sin test, rompiendo la convencion
      (logica pura en models/). Extraer `frasesNeneni()` y
      `notaAprendizaje()` a models/ + 2-3 tests.
- [x] **aFilaPrediccion sin test de contrato** (MimePredictor.ts:583): es
      la funcion que serializa a las columnas de `predicciones` y su unico
      llamador persiste con `.catch(() => undefined)` — un desajuste de
      claves fallaria en silencio para siempre. Test que compruebe el
      conjunto exacto de claves y los NULL con predicciones vacias.

### Prioridad baja

- [x] **calcular() sin guard de concurrencia** (NeneniPanel.vue:50):
      abrir-cerrar-abrir rapido con red lenta lanza dos calculos que
      escriben los mismos refs fuera de orden (y dos upserts). Guard
      `if (cargando.value) return` o token de generacion.
- [x] **Zonas tactiles pequenas en lo nuevo**: boton-nenei 36px
      (App.vue:243), bolita 34px, ✕ del panel 32px (NeneniPanel.vue:247)
      — el propio proyecto ya adopto min 40px (HojaInferior ✕,
      .boton.peligro). Ampliar zona de toque a 40-44px sin crecer el
      circulo visual.
- [x] **El "Pensando…" no luce el skeleton** (NeneniPanel.vue:180): el
      background scoped de .nenei-bocadillo pisa el gradiente de
      .esqueleto (especificidad) — solo se ve el pulso. Quitar la clase o
      replicar el gradiente en una regla scoped.
- [x] **Scrim distinto al resto de dialogos** (NeneniPanel.vue:224):
      rgba(0,0,0,.35) vs rgb(20 40 36 / .45) de HojaInferior. Extraer
      token --color-scrim en main.css y usarlo en ambos.
- [x] **Error del bocadillo sin reintento** (NeneniPanel.vue:181): sin
      red solo queda cerrar y volver a abrir. Boton "Reintentar" que
      relance calcular().
- [x] **Precache atomico del SW** (sw.js:40): `cache.addAll` con 22
      entradas — un solo 404 (p.ej. icono renombrado y lista sin
      actualizar) aborta TODAS las instalaciones futuras sin sintoma.
      Cambiar a `Promise.allSettled(PRECACHE.map((u) => cache.add(u)))`.
- [x] **El chunk "branding-*.js" (278 KB) es en realidad supabase-js**:
      nombre enganoso en cada auditoria del build. `manualChunks:
      { supabase: ['@supabase/supabase-js'] }` en vite.config.ts (cambio
      de nombre, no de peso).
- [x] **registrado_por fosilizado en la fila viva de predicciones**
      (carlotaService.ts:428): el upsert no incluye la columna y conserva
      para siempre el uid del primer insert. Incluir el uid en el payload
      (o quitar la columna).
- [x] **Los intervalos que cruzan franja entran en el historico dia/noche**
      (MimePredictor.ts:217): el hueco del amanecer infla la mediana "dia"
      cada dia y el salto tarde→noche deflacta la "noche" (pocas
      muestras). Excluir cruzaFranja tambien del historico y REVALIDAR el
      backtest completo antes de dar por buenos los k actuales.
- [x] **Docs desfasados (2 lineas)**: 03-FRONTEND (menu de usuario sin
      "Acerca de") y la deuda "Solo hay tests de CarlotaModel" (ya se
      testean 3 modulos de models/).

## Validacion de entradas (2026-08-08)

- [x] Controles de rango en todos los formularios (models/validacion.ts,
      testeado): fechas dentro de [nacimiento, ahora+5 min] (con
      min/max nativos en los inputs), biberon 5-500 ml, pecho 1-120 min,
      sueno <= 16 h, peso 1.5-25 kg, altura 40-120 cm, PC 28-60 cm.
      LIMITES_ENTRADA es el unico punto de ajuste. Aplica en alta
      (HoyView, EvolucionView) y edicion (HojaEdicionRegistro, hoja de
      medidas), siempre ANTES de llamar al servicio.

## Proximas features (brainstorming 2026-08-07)

### Registro mas rapido / util

(el primer bloque del brainstorming se completo el 2026-08-07, ver "Hechas")

### Mime Predictor (la super idea ⭐)

- [x] FASE 1e — Siestas cortas y ancla del sueño NOCTURNO (2026-08-08,
      idea de Angel): (1) una siesta mas corta que su tipica acorta la
      ventana siguiente (factor 1+0.4·(dur/tipica−1), calibrado por
      barrido: acople fuerte MAE 23→17.5; las guias recortan ~45 min tras
      siesta de <45 min ≈ un ciclo); (2) al caer la tarde lo previsto ya
      no es una siesta: hora de acostarse PERSONAL (mediana de inicios
      nocturnos, k=3 hacia la base por edad — nueva columna horaAcostar
      en prediccionBase con fuentes) con margen de 60 min calibrado por
      barrido {30..90} (optimo ~12 min MAE; la ultima ventana del dia es
      la mas larga y el modelo lo respeta). Ñeñeñi anuncia el sueño de la
      noche y las siestas acortadas. +5 tests (86 en total).
- [x] FASE 1d — REMATES y racion prevista (2026-08-08, idea de Angel):
      tomas separadas por <45 min se consolidan en COMIDAS; si la ultima
      comida quedo corta (<65% de la racion tipica) y la bebe HA
      DEMOSTRADO que remata (≥2 remates observados — sin evidencia no se
      asume, lo exigio el backtest), se predice un remate cercano
      (mediana de sus huecos intra-comida, prior 40 min avalado por
      fuentes: completar la toma en ~45 min, reofrecer biberon en 1-2 h)
      con los ml que faltan para la racion. Ademas `mlPrevisto` estima
      como sera la siguiente toma (remate o racion tipica) y Ñeñeñi lo
      anuncia. Backtest con 35% de comidas partidas: remates predichos
      con error 0-9 min, MAE global <25 con antelacion de 15 min.
      +3 tests (81 en total).
- [x] FASE 1c — Cantidad y mini-despertares (2026-08-08, idea de Angel):
      (1) los ml de la ultima toma frente a su mediana personal modulan
      la proxima prevista (toma corta → pedira antes), sensibilidad 0.35
      calibrada por barrido con bebes simulados acoplados a los ml
      (acople fuerte: MAE 32→23; bebe sin acople solo paga +1.4 min);
      Ñeñeñi lo comenta ("como la ultima toma ha sido mas corta...").
      (2) los tramos de sueño separados por <25 min se consolidan en un
      bloque (mini-despertar ≠ ventana de vigilia); backtest con 50% de
      siestas fragmentadas: la mediana se recupera ±15 y el MAE aguanta.
      +4 tests (78 en total).
- [x] FASE 1b — Capa de comportamiento ACTUAL (2026-08-08): tercera capa
      en la mezcla — los ultimos intervalos de HOY (mediana de hasta 5,
      misma franja horaria, sin los que cruzan el amanecer) corrigen al
      historico con su propio shrinkage (kReciente=1). Backtest con 5
      escenarios (estable, brote, siestas cortas, dia alargado, ruidoso):
      con la capa apagada un brote da MAE 66 (toma+siesta) y con ella 27;
      el estable solo paga ~5. El filtro del amanecer salio del propio
      backtest (el hueco toma nocturna→primera de la manana contaminaba
      la capa). pesoReciente registrado en `parametros` para diagnostico

- [x] FASE 1 — Algoritmo + datos + BBDD (2026-08-08): linea base
      poblacional precargada (prediccionBase.ts, fuentes publicas),
      algoritmo puro en MimePredictor.ts (shrinkage base↔personal con
      medianas/IQR de 7 dias separando dia/noche), tabla `predicciones`
      con RLS (fila viva por bebe) y persistencia en el servicio.
      Calibrado por backtesting recursivo (3 rondas de barrido k×historico
      contra 7 bebes simulados; k=3, historico=7d; la franja de confianza
      paso de IQR/2 a 0.75·IQR al detectar cobertura del 50%). 13 tests
      de contrato: MAE tomas <25 min y siestas <22 min (bebe regular),
      acotado en irregulares, arranque en frio cae en la base, porQueLlora
      ordena bien los escenarios. (La FASE 2 — UI con Ñeñeñi — se hizo
      el 2026-08-08, ver abajo.)
- [x] FASE 2 — UI con **Ñeñeñi** (2026-08-08): la mascota (Mime experto
      en bebes, public/nenei.png) vive en la cabecera entre la marca y el
      usuario; al tocarla se abre su bocadillo (NeneniPanel.vue) que carga
      los ultimos 8 dias, ejecuta `predecir()` y lo cuenta en primera
      persona ("Yo creo que la proxima toma sera a las 16:30, entre las
      16:05 y las 16:55"), con la siesta ("en unos 40 min le tocara
      dormir") y, en franja nocturna (21-07h), el pronostico de la noche
      (`pronosticoNoche()`: tomas que quedan hasta las 07:00 con la
      cadencia nocturna, 2 tests nuevos). Nota de honestidad con el peso
      del patron personal/reciente. Boton **¿Por que llora?** con el
      diagrama de barras Sueno/Hambre/Incomodidad de `porQueLlora()` y
      sus explicaciones. Cada calculo se persiste en `predicciones`
      (fila viva) en segundo plano.

### Analisis y graficas

- [ ] Estadisticas semanales: media de ml/dia, nº tomas, horas de sueno,
      tendencia
- [ ] Racha de noche: tramo mas largo de sueno nocturno (record historico)

### Salud y citas

- [ ] Calendario de vacunas espanol precargado con checks y proxima dosis
- [ ] Recordatorio de vitamina D: marca visual en Hoy si a mediodia no
      esta registrada
- [ ] Recordatorios de citas (notificaciones o export a Google Calendar)
- [ ] Notificaciones push (Web Push) en la PWA instalada: tabla de
      suscripciones en Supabase + claves VAPID + envio desde un cron de
      Actions o una Edge Function. Android funciona bien; iOS >= 16.4
      solo con la PWA anadida a pantalla de inicio y permiso concedido
  - [x] Fase 1 (2026-08-10): notificaciones LOCALES para probar el flujo
        — `services/notificaciones.ts` (permiso + showNotification via
        SW), `notificationclick` en sw.js (enfoca/abre la app), boton
        "Activar/Probar notificaciones" en el menu de usuario y aviso de
        recordatorios de las 19h como notificacion del sistema (una vez
        al dia, guard en localStorage). Limite conocido: solo suena con
        la app abierta (pestana o PWA); con la app cerrada hace falta la
        fase 2 (VAPID + suscripciones + emisor)

### Recuerdos

- [ ] Hitos con foto via Supabase Storage (el free tier incluye 1 GB de
      archivos y 5 GB de egress/mes: sobra para 2 usuarios SI se comprimen
      las fotos al subir, ~300-500 KB)
- [ ] Diario del dia: texto libre por dia ("hoy ha sonreido a papa")

### Familia y datos

- [ ] Registrar quien anoto cada cosa en la UI (`registrado_por` ya se guarda)
- [ ] Modo abuelos: enlace de solo lectura con el resumen del dia
- [ ] Export de datos (CSV)

### Hechas

- [x] Ultra-revision multiagente, rondas 2-4 (2026-08-08): iteracion con
      revisores hasta quedar limpio. Ronda 2: ancla mensual de la edad
      clampada (nacida el 31), dia capturado antes de las peticiones,
      filtro de registros con fecha futura, ritmo 24h con tomas y suenos
      en la misma base de minutos, '' de inputs number normalizado en la
      edicion, Historial sin dias pre-nacimiento, hoja inferior modal de
      verdad (foco, Tab, Escape, scroll-lock), contraste AA claro,
      confirmaciones en citas. Ronda 3: numeroONull en el modelo aplicado
      a TODOS los caminos de escritura, scroll-lock con contador
      compartido, foco devuelto al cerrar, checkbox de citas
      resincronizado, login con estado ocupado, toasts con role=status y
      safe-area. Ronda 4: guard anti doble-pulsacion en las altas, los
      formularios de Hoy solo se limpian si el alta fue bien, watch
      immediate en las hojas que nacen abiertas. Ronda 5: el guard se
      retiene hasta despues de la recarga, los 10 llamadores comprueban
      el resultado, botones :disabled durante el alta. Ronda 6:
      verificacion final → SIN HALLAZGOS

- [x] Ultra-revision multiagente (2026-08-08): 4 revisores (correccion,
      UX/accesibilidad, calidad, docs/config) → ~40 arreglos aplicados.
      Destacados: recarga al cruzar la medianoche o volver del segundo
      plano; tokens anti-carrera en todas las cargas; sueño abierto con
      tope de 24 h (modelo + servicio); las tomas de pecho nunca quedan
      "en curso" fantasma; validacion fin>inicio en sueños; borrar del
      dia con deshacer (recrea el registro) y confirmacion en momentos;
      bebeStore relanza errores (antes pantalla en blanco); edad civil
      correcta con DST; dias a cero visibles en Historial; ritmo 24h
      escalado al dia real (23/25 h) y accesible por teclado; toasts y
      estados legibles en modo noche (+color-scheme); checkboxes sin
      width global; zonas de toque ≥40px; aria-labels en citas; PWA:
      precache de estaticos, iconos PNG any+maskable en el manifest,
      theme-color oscuro; recordatorio.yml robusto sin secret; helpers
      puros extraidos al modelo con tests (34); CSS muerto fuera; docs
      de project-context realineadas con el codigo

- [x] Curvas estandar OMS de fondo en peso y altura (2026-08-08): las
      graficas de Valor pintan de fondo los deciles P0-P100 (de 10 en 10;
      P0/P100 son los extremos de la cartilla, ±3 desviaciones; P50
      punteada, etiquetados a la derecha) en una ventana de 60 dias con
      hoy en el dia 45 — los 15 dias a la derecha de la marca «hoy»
      ensenan como deberia progresar. Nuevo GraficaCrecimiento.vue (eje X
      en dias de edad) y valorPercentilOMS en el modelo (con test). El PC
      mantiene la banda P3-P97

- [x] Graficas de dia a dia en Evolucion (2026-08-08): leche tomada
      (ml/dia) y sueno (h/dia) de los ultimos 7/14/30 dias, con el sueno
      repartido por dia real (minutosSuenoEnDia) y franja naranja
      transparente del rango recomendado por edad (objetivoSuenoMinutos /
      objetivoLecheMl con el peso vigente en cada dia). Las barras de
      objetivos de Hoy enlazan a su grafica (?grafica=tomas|sueno con
      scroll); van despues de la tabla de Mediciones

- [x] Edicion en todas partes (2026-08-08): las mediciones de Evolucion se
      editan (✎ abre hoja inferior con todos los campos + borrar, via
      `actualizarMedida`) y el registro del dia de Hoy tambien (tocar una
      fila abre la misma hoja de edicion que el Historial). El formulario
      de edicion de registros se extrajo a un componente reutilizable
      (`HojaEdicionRegistro.vue` + `registroEditable.ts`)

- [x] Origen de las mediciones (2026-08-08): columna `origen` en medidas —
      🏠 en casa (por defecto) o ✅ oficial (pediatra/farmacia) — con
      selector en el alta de Evolucion e insignia en la lista. Preparado
      para filtrar/distinguir en graficas mas adelante

- [x] Ronda de retoques de UI dirigida (2026-08-07/08): cabecera con logo +
      "CarlotApp" enlazando a Hoy y bolita de menu de usuario (config, tema,
      salir); Hoy reorganizada en 3 cards — "La bebe" (carita + nombre
      completo via migracion + tiles + semana 🌱), "Datos de Hoy" (hora
      actual + objetivos + ultimos hitos de cada tipo + registro del dia
      plegado a 2) y "Accesos directos"; el FAB ＋ despliega TODOS los tipos
      de registro (con banio/vitamina D/medicacion/unas de un toque); hitos
      y accesos configurables POR USUARIO (localStorage por uid, hoja unica
      de Configuracion); fix del logo con BASE_URL en Pages; revision con 5
      arreglos (config vacia respetada, "hace N dias" por dia natural,
      tipos de evento derivados, persistencia deduplicada, branding.ts)

- [x] Reparto del sueno por dia natural en TODAS las vistas (2026-08-07):
      nuevo minutosSuenoEnDia en el modelo (con tests) — el resumen por dia
      del Historial ya reparte el nocturno entre los dos dias (antes lo
      asignaba entero al dia de inicio), los suenos se piden desde un dia
      antes del rango para no perder la madrugada del primer dia visible,
      y tramoEnDia usa la medianoche real del dia siguiente (correcto en
      los cambios de hora)
- [x] Corte de unas (2026-08-07): nuevo tipo de evento 'unas' (migracion
      del CHECK), boton rapido "✂️ Uñas cortadas" en la hoja del ＋ con
      "ultima vez hace N dias" (getUltimoEventoDeTipo)
- [x] Restyling completo tras auditoria UX (2026-08-07), fases F1-F4:
      contraste AA en botones (--color-accion), bloque "Ahora" arriba con
      contadores en grande, objetivos fusionados con sus barras, jerarquia
      de tarjetas (hero/accion/plana), skeletons, enlaces cruzados
      (peso/altura→Evolucion, aviso peso→formulario abierto, ver
      patron→Historial, ritmo→dia, Momentos vacio→Hoy, banda proxima
      cita→Citas, semana→momento), bottom sheets (HojaInferior) para todos
      los formularios, FAB central "+", swipe para borrar en la linea de
      tiempo, pulso en cronometros, segmento Valor|Percentil en Evolucion
      y bandas P3-P97 OMS con mediana punteada (bandaOMS con test)

- [x] Momentos (2026-08-07): alta dedicada en Hoy → ＋ → "✨ Momento"
      (reutiliza eventos tipo hito, sin migracion; etiqueta renombrada a
      "Momento") y seccion propia en Historial con todos los momentos de
      siempre (listarMomentos), con borrado

- [x] Revision exhaustiva del codigo (2026-08-07): 8 arreglos aplicados —
      el sueno nocturno que cruza medianoche ya cuenta en "Sueno hoy" y en
      el email nocturno (recorte por dia), editar un biberon conserva su
      fin, el formulario de cita no se pierde si falla el guardado,
      "ultimos 7 dias" ya no listaba 8, la etiqueta "Hoy" del historial no
      se queda obsoleta tras medianoche, claves de v-for sin colisiones en
      GraficaRitmo, aInputLocal deduplicado, y los ml del biberon manual
      son obligatorios (para no confundirlo con una toma en curso)

- [x] Editar registros (2026-08-07: edicion y borrado inline en Historial)
- [x] Dashboard de inicio con resumen en grande y accesos rapidos (2026-08-07)
- [x] Niveles de caca (poco/medio/mucho) y sueno a posteriori (2026-08-07)
- [x] Recordatorio nocturno por email (2026-08-07): recordatorio.yml a las
      20:15 UTC con el resumen del dia leido de la BBDD; pendiente de los
      secrets MAIL_* para activarse
- [x] Seccion "¿Que hay de nuevo esta semana?" (2026-08-07): tarjeta plegable
      en Hoy con los cambios de desarrollo y ajustes de sueno/tomas de la
      semana actual, precargados para las semanas 0-100 por etapas
      (`semanasDesarrollo.ts`, hitos CDC/AAP/NHS, con test de cobertura)
- [x] Objetivos diarios de sueno y leche (2026-08-07): barras de progreso en
      Hoy segun edad — sueno con rangos NSF/AASM (14-17h / 12-15h / 11-14h),
      leche con regla ml/kg por edad sobre el ultimo peso (BarraObjetivo.vue,
      objetivoSuenoMinutos/objetivoLecheMl con tests). Orientativo, no
      consejo medico
- [x] Contadores "hace X" en el dashboard (2026-08-07): ultima toma, ultimo
      panal y despierta/durmiendo desde, refrescados cada minuto
- [x] Deshacer rapido (2026-08-07): toast de 6 s tras cada alta rapida
- [x] Cronometro de toma en vivo (2026-08-07): toma con fin NULL en la BBDD
      (sincroniza entre moviles); al terminar un biberon pregunta los ml
- [x] Modo noche (2026-08-07): oscuro automatico de 22:00 a 08:00, con
      boton en la cabecera para forzar (auto → oscuro → claro)
- [x] Grafica de ritmo de 24h (2026-08-07): GraficaRitmo.vue en Historial,
      sueno como bloques y tomas como puntos, cruza medianoche bien
- [x] Percentiles OMS (2026-08-07): referencia oficial de ninas semanas 0-100
      precargada (`referenciaOMS.ts`, generada con
      `scripts/generar-referencia-oms.py` desde las tablas LMS del repo
      oficial de la OMS), percentil junto a cada medida en Evolucion y
      graficas de evolucion del percentil (peso/altura/PC)

## Deuda tecnica

- [x] Linting configurado (2026-08-07): ESLint flat config (vue +
      typescript + prettier) con `npm run lint` (--fix) / `lint-check`
      (CI) / `format`; el CI lo ejecuta antes de los tests.
      `referenciaOMS.ts` excluido de prettier (generado, una fila por
      semana)
- [x] HoyView e HistorialView duplican el mapeo registro→texto (2026-08-07:
      extraido a `textoToma/textoSueno/textoPanal/textoEvento` en CarlotaModel)
- [ ] Solo se testean los models/ (CarlotaModel, MimePredictor,
      frasesNeneni, semanasDesarrollo); las vistas no se testean (aceptado)

## Bugs conocidos

(ninguno todavia)
