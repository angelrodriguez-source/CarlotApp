# Migraciones de CarlotApp

Cada cambio de esquema = un archivo nuevo aqui, con nombre
`YYYYMMDDHHMM_descripcion.sql`.

Reglas (las mismas que en Mimes-Care-Corp):

- **Idempotentes**: `IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT DO NOTHING`.
- **Nunca se edita una migracion ya aplicada** — se crea otra encima.
- Al hacer push a `main`, `.github/workflows/migrate.yml` ejecuta
  `scripts/apply-migrations.sh`, que aplica solo lo pendiente (control en
  la tabla `public._migrations`, una transaccion por archivo).
- Tambien se puede aplicar en local:
  `SUPABASE_DB_URL='postgresql://...' bash scripts/apply-migrations.sh`
- RLS activado en TODAS las tablas nuevas, sin excepcion.
