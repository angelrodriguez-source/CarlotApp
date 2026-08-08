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

## Proximas features (brainstorming 2026-08-07)

### Registro mas rapido / util

(el primer bloque del brainstorming se completo el 2026-08-07, ver "Hechas")

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
      immediate en las hojas que nacen abiertas

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
- [ ] Solo hay tests de CarlotaModel; las vistas no se testean (aceptado)

## Bugs conocidos

(ninguno todavia)
