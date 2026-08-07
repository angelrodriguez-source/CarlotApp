# 08 - Trabajo pendiente

## Configuracion inicial (bloqueante — lo hace Angel, ver README.md raiz)

- [ ] Crear el repo `CarlotApp` en GitHub y volcar este esqueleto
- [ ] Crear el proyecto Supabase nuevo (free tier: es el 2º y ultimo)
- [ ] Rellenar los `TODO(config)`:
  - [ ] `supabase/migrations/202608061800_esquema_inicial.sql` — email de
        la madre + fecha de nacimiento real de Carlota (ANTES del primer push)
  - [ ] `app/src/services/supabase.ts` — URL + anon key
  - [ ] `.github/workflows/keepalive.yml` — URL + anon key
- [ ] Secret `SUPABASE_DB_URL` en el repo nuevo
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
