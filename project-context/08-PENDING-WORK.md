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

- [ ] Pintar las bandas P3-P97 de la OMS sobre las graficas de peso/altura/PC
      (los datos ya estan en referenciaOMS.ts; GraficaLinea necesitaria
      soporte de bandas)
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

- [x] Momentos (2026-08-07): alta dedicada en Hoy → Mas → "✨ Momento"
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
