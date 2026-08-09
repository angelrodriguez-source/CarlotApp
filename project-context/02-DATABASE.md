# 02 - Base de datos (Supabase)

## Modelo de acceso

**Lista blanca de 2 usuarios con datos compartidos.**

- `usuarios_autorizados(email, nota)` — los emails de Google de los padres.
  RLS activado SIN policies: el cliente no puede ni leerla.
- `es_usuario_autorizado()` — funcion `SECURITY DEFINER` que comprueba si
  el email del JWT (`auth.jwt()->>'email'`) esta en la lista (case-insensitive).
- TODAS las tablas de datos tienen las mismas 4 policies (select/insert/
  update/delete) para `authenticated` con `es_usuario_autorizado()`.

Consecuencia: cualquier persona puede hacer login con Google (Supabase no
lo impide), pero si su email no esta en la lista blanca **no ve ni escribe
nada** (RLS devuelve 0 filas). La app muestra "Cuenta sin acceso".

Para anadir/cambiar un email: **migracion nueva** con un INSERT/DELETE
sobre `usuarios_autorizados` (nunca editar una migracion aplicada).

## Tablas

| Tabla | Campos clave | Notas |
|-------|-------------|-------|
| `bebes` | nombre, fecha_nacimiento | Seed: Carlota. Soporta hermanos futuros |
| `medidas` | fecha (date), peso_gramos, altura_cm, perimetro_craneal_cm, origen, notas | Valores opcionales. origen: casa (defecto) / oficial (pediatra o farmacia) |
| `tomas` | inicio, fin, tipo, cantidad_ml, notas | tipo: pecho_izq/pecho_der/biberon_formula/biberon_materna. Pecho→duracion, biberon→ml |
| `suenos` | inicio, fin, notas | `fin NULL` = sueno en curso |
| `panales` | fecha, tipo, cantidad | tipo: pis/caca/mixto. cantidad (poco/medio/mucho, opcional) para caca/mixto |
| `eventos` | fecha, tipo, descripcion, subtipo, duracion_min | tipo: bano/vitamina_d/medicacion/unas/hito/otro/ejercicio; subtipo (tummy_time/estimulacion/otros) y duracion_min solo los usa el ejercicio |
| `citas` | fecha, titulo, tipo, lugar, notas, completada | tipo: medica/tramite/otro |
| `usuarios_autorizados` | email, nota | Lista blanca (ver arriba) |
| `predicciones` | calculado_en, proxima_toma(+franja), proxima_siesta(+franja), durmiendo, incomodidad_prob, parametros | Mime Predictor: UNA fila viva por bebe (upsert), con los parametros del calculo en JSONB. La linea base poblacional vive en el codigo (prediccionBase.ts) |
| `_migrations` | name, applied_at | Control del runner de migraciones. RLS sin policies |

Todas las tablas de datos llevan ademas `registrado_por UUID DEFAULT auth.uid()`
(quien lo anoto) y `created_at`. FKs a `bebes` con `ON DELETE CASCADE`.
Indices `(bebe_id, fecha|inicio)` en todas las tablas de registros.

## Migraciones

- Carpeta `supabase/migrations/`, nombre `YYYYMMDDHHMM_descripcion.sql`
- Idempotentes (`IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT`)
- **Nunca** se edita una ya aplicada: se crea otra encima
- Al hacer push a `main` con cambios en la carpeta, `migrate.yml` ejecuta
  `scripts/apply-migrations.sh` (control en `_migrations`, una transaccion
  por archivo). Tambien manual: pestana Actions o
  `SUPABASE_DB_URL='...' bash scripts/apply-migrations.sh`

Migraciones existentes:

1. `202608061800_esquema_inicial.sql` — todo el esquema + RLS + seeds
   (emails autorizados y bebe Carlota).
2. `202608071430_panales_cantidad.sql` — columna `cantidad` en `panales`
   (poco/medio/mucho, opcional).
3. `202608072100_eventos_unas.sql` — tipo de evento 'unas' (corte de unas):
   recrea el CHECK de `eventos` con el valor nuevo.
4. `202608072230_nombre_completo.sql` — cambia el valor de `bebes.nombre`
   al nombre completo (no anade columna).
5. `202608080030_medidas_origen.sql` — columna `origen` en `medidas`
   ('casa' por defecto / 'oficial' — pediatra o farmacia).
6. `202608081700_predicciones.sql` — tabla `predicciones` del Mime
   Predictor (una fila viva por bebe, RLS con la lista blanca).
7. `202608091300_ejercicio.sql` — tipo de evento 'ejercicio' (Tummy
   Time/estimulacion/otros) + columnas `subtipo` y `duracion_min` en
   `eventos` con sus CHECK.

## Reglas aprendidas en Mimes (aplican aqui)

- RLS activado en TODAS las tablas, tambien auxiliares (`_migrations`,
  `usuarios_autorizados`) — Supabase manda email de seguridad si no.
- Funciones `SECURITY DEFINER` siempre con `SET search_path = public`.
- Contrasena de la BBDD sin caracteres especiales (`@ # / : ?` rompen la
  connection string del secret).
- Postgres esta en UTC: el "hoy" local lo decide el cliente.
