#!/usr/bin/env bash
# ============================================================
# apply-migrations.sh — Aplica las migraciones NUEVAS de
# supabase/migrations/ contra la base de datos de Supabase.
#
# Lleva la cuenta de lo ya aplicado en la tabla public._migrations,
# asi que es seguro ejecutarlo N veces: solo aplica lo pendiente.
#
# Uso local:
#   SUPABASE_DB_URL='postgresql://...' bash scripts/apply-migrations.sh
#
# En CI lo ejecuta .github/workflows/migrate.yml con el secret
# SUPABASE_DB_URL (Dashboard > Settings > Database > Connection string).
#
# Cada archivo se aplica dentro de una transaccion (-1): si algo
# falla, esa migracion se revierte entera y el script se detiene.
# ============================================================
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ERROR: define la variable SUPABASE_DB_URL" >&2
  exit 1
fi

# --- Diagnostico del formato (sin imprimir nunca el valor del secret) ---
if printf '%s' "$SUPABASE_DB_URL" | grep -q '\[YOUR-PASSWORD\]'; then
  echo "ERROR: la connection string todavia contiene [YOUR-PASSWORD]." >&2
  echo "Sustituyelo por tu contrasena real de la base de datos, SIN corchetes." >&2
  exit 1
fi

if ! printf '%s' "$SUPABASE_DB_URL" | grep -q '@'; then
  echo "ERROR: la connection string NO contiene '@servidor'." >&2
  echo "Se ha cortado al copiarla: falta la parte ':contrasena@aws-X-region.pooler.supabase.com:5432/postgres'." >&2
  echo "Copia la cadena COMPLETA de Supabase > Project Settings > Database > Connection string (URI)." >&2
  exit 1
fi

if ! printf '%s' "$SUPABASE_DB_URL" | grep -Eq '^postgres(ql)?://[^:@]+:[^@]+@[^@]+:[0-9]+/'; then
  echo "ERROR: el formato de la connection string no es valido." >&2
  echo "Debe tener la forma: postgresql://usuario:contrasena@servidor:5432/postgres" >&2
  echo "Revisa que no haya espacios, saltos de linea, ni caracteres raros en la contrasena (@ # / :)." >&2
  exit 1
fi

MIGRATIONS_DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "No existe $MIGRATIONS_DIR — nada que aplicar"
  exit 0
fi

# Tabla de control (idempotente). RLS activado sin policies: PostgREST
# (anon/authenticated) no puede tocarla; este runner conecta como
# postgres (BYPASSRLS) asi que no le afecta.
psql "$SUPABASE_DB_URL" -q -v ON_ERROR_STOP=1 -c \
  "CREATE TABLE IF NOT EXISTS public._migrations (
     name TEXT PRIMARY KEY,
     applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ALTER TABLE public._migrations ENABLE ROW LEVEL SECURITY;"

applied=0
skipped=0

# Orden alfabetico = orden cronologico (nombres con prefijo YYYYMMDDHHMM)
for file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  name="$(basename "$file")"

  # El nombre se interpola en SQL: solo caracteres seguros
  if ! printf '%s' "$name" | grep -Eq '^[A-Za-z0-9._-]+$'; then
    echo "ERROR: nombre de migracion invalido: $name (solo letras, numeros, punto, guion)" >&2
    exit 1
  fi

  exists="$(psql "$SUPABASE_DB_URL" -tA -c \
    "SELECT 1 FROM public._migrations WHERE name = '$name'")"

  if [ "$exists" = "1" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  echo ">> Aplicando $name ..."
  # Migracion + registro en _migrations en LA MISMA transaccion (-1 con
  # dos -f/-c encadenados no existe: se concatena la sentencia al vuelo).
  # Si el runner muere a mitad, o se aplica y registra todo, o nada —
  # nunca queda aplicada sin registrar (que la reaplicaria en el
  # siguiente run).
  { cat "$file"; printf "\nINSERT INTO public._migrations (name) VALUES ('%s');\n" "$name"; } |
    psql "$SUPABASE_DB_URL" -q -v ON_ERROR_STOP=1 -1 -f -
  echo "   OK"
  applied=$((applied + 1))
done

echo "Hecho: $applied aplicadas, $skipped ya estaban"
