# 08 - Trabajo pendiente

## Configuracion inicial (bloqueante — lo hace Angel, ver README.md raiz)

- [x] Crear el repo `CarlotApp` en GitHub y volcar este esqueleto (2026-08-07)
- [x] Crear el proyecto Supabase nuevo: `aolbgcuvgcjpogdarpmg` (2026-08-07)
- [x] Rellenar los `TODO(config)` (2026-08-07): emails (Angel y Cristina),
      fecha de nacimiento (2026-06-05), URL + publishable key
- [ ] Secret `SUPABASE_DB_URL` en el repo + lanzar workflow de migraciones
- [ ] Google OAuth en Supabase + Site URL
- [ ] Activar GitHub Pages (rama `gh-pages`) tras el primer deploy

## Proximas features (brainstorming 2026-08-07)

### Registro mas rapido / util

- [ ] Contadores "hace X" en el dashboard: tiempo desde la ultima toma,
      ultimo panal y ultimo sueno (el dato que mas se consulta)
- [ ] Deshacer rapido: toast con "deshacer" unos segundos tras registrar
      (para toques accidentales)
- [ ] Cronometro de toma en vivo (empezar/parar como el sueno; al parar,
      pregunta los ml si es biberon)
- [ ] Modo noche: tema oscuro automatico por horario (tomas nocturnas)

### Analisis y graficas

- [ ] Grafica de ritmo de 24h: barras horarias por dia con sueno/tomas,
      para ver el patron emerger semana a semana
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

- [x] Editar registros (2026-08-07: edicion y borrado inline en Historial)
- [x] Dashboard de inicio con resumen en grande y accesos rapidos (2026-08-07)
- [x] Niveles de caca (poco/medio/mucho) y sueno a posteriori (2026-08-07)
- [x] Percentiles OMS (2026-08-07): referencia oficial de ninas semanas 0-100
      precargada (`referenciaOMS.ts`, generada con
      `scripts/generar-referencia-oms.py` desde las tablas LMS del repo
      oficial de la OMS), percentil junto a cada medida en Evolucion y
      graficas de evolucion del percentil (peso/altura/PC)

## Deuda tecnica

- [ ] Sin linting configurado (Mimes usa eslint+oxlint+prettier; se quito
      del esqueleto para aligerar — anadir si el proyecto crece)
- [x] HoyView e HistorialView duplican el mapeo registro→texto (2026-08-07:
      extraido a `textoToma/textoSueno/textoPanal/textoEvento` en CarlotaModel)
- [ ] Solo hay tests de CarlotaModel; las vistas no se testean (aceptado)

## Bugs conocidos

(ninguno todavia)
