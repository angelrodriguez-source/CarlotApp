# 08 - Trabajo pendiente

## Configuracion inicial (bloqueante — lo hace Angel, ver README.md raiz)

- [x] Crear el repo `CarlotApp` en GitHub y volcar este esqueleto (2026-08-07)
- [x] Crear el proyecto Supabase nuevo: `aolbgcuvgcjpogdarpmg` (2026-08-07)
- [x] Rellenar los `TODO(config)` (2026-08-07): emails (Angel y Cristina),
      fecha de nacimiento (2026-06-05), URL + publishable key
- [ ] Secret `SUPABASE_DB_URL` en el repo + lanzar workflow de migraciones
- [ ] Google OAuth en Supabase + Site URL
- [ ] Activar GitHub Pages (rama `gh-pages`) tras el primer deploy

## Proximas features (ideas)

- [ ] Editar registros (ahora solo crear/borrar)
- [ ] Cronometro de toma de pecho en vivo (como el de sueno, con inicio/fin)
- [ ] Percentiles OMS en las graficas de peso/altura
- [ ] Recordatorios de citas (notificaciones o export a Google Calendar)
- [ ] Grafica de tomas/sueno por dia en Historial
- [ ] Export de datos (CSV)
- [ ] Registrar quien anoto cada cosa en la UI (`registrado_por` ya se guarda)

## Deuda tecnica

- [ ] Sin linting configurado (Mimes usa eslint+oxlint+prettier; se quito
      del esqueleto para aligerar — anadir si el proyecto crece)
- [ ] HoyView e HistorialView duplican el mapeo registro→texto; extraer a
      un helper si se toca una tercera vez
- [ ] Solo hay tests de CarlotaModel; las vistas no se testean (aceptado)

## Bugs conocidos

(ninguno todavia)
