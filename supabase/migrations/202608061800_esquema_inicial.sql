-- ============================================================
-- Esquema inicial de CarlotApp
--
-- App personal de seguimiento de un bebe para DOS usuarios (los
-- padres). Los datos son COMPARTIDOS entre ambos: cualquiera de los
-- dos ve y edita todo. El acceso se controla con una lista blanca de
-- emails (usuarios_autorizados) + RLS en todas las tablas.
--
--
-- Convenciones (heredadas de Mimes-Care-Corp):
--  - Idempotente: IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT
--  - Nunca se edita una migracion ya aplicada: se crea otra encima
--  - RLS activado en TODAS las tablas
--  - Fechas en timestamptz (Postgres en UTC); el "dia" local lo
--    calcula el cliente con toLocaleDateString('sv-SE')
-- ============================================================

-- ------------------------------------------------------------
-- Lista blanca de usuarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios_autorizados (
  email TEXT PRIMARY KEY,
  nota  TEXT
);

-- RLS sin policies: el cliente (anon/authenticated) no puede leerla ni
-- tocarla. Solo la lee la funcion SECURITY DEFINER de abajo y el runner
-- de migraciones (postgres, BYPASSRLS).
ALTER TABLE public.usuarios_autorizados ENABLE ROW LEVEL SECURITY;

-- ¿El usuario logueado esta en la lista blanca?
-- SECURITY DEFINER para poder leer usuarios_autorizados saltandose RLS.
CREATE OR REPLACE FUNCTION public.es_usuario_autorizado()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_autorizados
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ------------------------------------------------------------
-- Tablas de datos
-- ------------------------------------------------------------

-- El bebe (tabla por si algun dia hay hermanos; hoy solo Carlota)
CREATE TABLE IF NOT EXISTS public.bebes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Peso / altura / perimetro craneal (revision del pediatra o bascula de casa)
CREATE TABLE IF NOT EXISTS public.medidas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bebe_id              UUID NOT NULL REFERENCES public.bebes(id) ON DELETE CASCADE,
  fecha                DATE NOT NULL,
  peso_gramos          INTEGER CHECK (peso_gramos > 0),
  altura_cm            NUMERIC(5,1) CHECK (altura_cm > 0),
  perimetro_craneal_cm NUMERIC(5,1) CHECK (perimetro_craneal_cm > 0),
  notas                TEXT,
  registrado_por       UUID DEFAULT auth.uid(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS medidas_bebe_fecha ON public.medidas (bebe_id, fecha);

-- Tomas (pecho o biberon). fin y cantidad_ml son opcionales:
-- pecho = duracion (inicio/fin), biberon = cantidad_ml.
CREATE TABLE IF NOT EXISTS public.tomas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bebe_id        UUID NOT NULL REFERENCES public.bebes(id) ON DELETE CASCADE,
  inicio         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fin            TIMESTAMPTZ,
  tipo           TEXT NOT NULL CHECK (tipo IN ('pecho_izq', 'pecho_der', 'biberon_formula', 'biberon_materna')),
  cantidad_ml    INTEGER CHECK (cantidad_ml > 0),
  notas          TEXT,
  registrado_por UUID DEFAULT auth.uid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tomas_bebe_inicio ON public.tomas (bebe_id, inicio);

-- Suenos (siestas y noche). fin NULL = todavia dormida.
CREATE TABLE IF NOT EXISTS public.suenos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bebe_id        UUID NOT NULL REFERENCES public.bebes(id) ON DELETE CASCADE,
  inicio         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fin            TIMESTAMPTZ,
  notas          TEXT,
  registrado_por UUID DEFAULT auth.uid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS suenos_bebe_inicio ON public.suenos (bebe_id, inicio);

-- Panales
CREATE TABLE IF NOT EXISTS public.panales (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bebe_id        UUID NOT NULL REFERENCES public.bebes(id) ON DELETE CASCADE,
  fecha          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo           TEXT NOT NULL CHECK (tipo IN ('pis', 'caca', 'mixto')),
  notas          TEXT,
  registrado_por UUID DEFAULT auth.uid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS panales_bebe_fecha ON public.panales (bebe_id, fecha);

-- Otros eventos del dia a dia (bano, vitamina D, medicacion, hitos...)
CREATE TABLE IF NOT EXISTS public.eventos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bebe_id        UUID NOT NULL REFERENCES public.bebes(id) ON DELETE CASCADE,
  fecha          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo           TEXT NOT NULL CHECK (tipo IN ('bano', 'vitamina_d', 'medicacion', 'hito', 'otro')),
  descripcion    TEXT,
  registrado_por UUID DEFAULT auth.uid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS eventos_bebe_fecha ON public.eventos (bebe_id, fecha);

-- Citas medicas y tramites (registro civil, empadronamiento...)
CREATE TABLE IF NOT EXISTS public.citas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bebe_id        UUID NOT NULL REFERENCES public.bebes(id) ON DELETE CASCADE,
  fecha          TIMESTAMPTZ NOT NULL,
  titulo         TEXT NOT NULL,
  tipo           TEXT NOT NULL DEFAULT 'medica' CHECK (tipo IN ('medica', 'tramite', 'otro')),
  lugar          TEXT,
  notas          TEXT,
  completada     BOOLEAN NOT NULL DEFAULT FALSE,
  registrado_por UUID DEFAULT auth.uid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS citas_bebe_fecha ON public.citas (bebe_id, fecha);

-- ------------------------------------------------------------
-- RLS: mismo patron en todas las tablas de datos.
-- Datos compartidos: cualquier usuario autorizado ve y edita todo.
-- Un usuario logueado que NO este en la lista blanca no ve nada.
-- ------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['bebes', 'medidas', 'tomas', 'suenos', 'panales', 'eventos', 'citas']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS autorizados_select ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY autorizados_select ON public.%I FOR SELECT TO authenticated USING (public.es_usuario_autorizado())', t);

    EXECUTE format('DROP POLICY IF EXISTS autorizados_insert ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY autorizados_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.es_usuario_autorizado())', t);

    EXECUTE format('DROP POLICY IF EXISTS autorizados_update ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY autorizados_update ON public.%I FOR UPDATE TO authenticated USING (public.es_usuario_autorizado()) WITH CHECK (public.es_usuario_autorizado())', t);

    EXECUTE format('DROP POLICY IF EXISTS autorizados_delete ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY autorizados_delete ON public.%I FOR DELETE TO authenticated USING (public.es_usuario_autorizado())', t);
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- Seeds
-- ------------------------------------------------------------

-- Los emails de Google con los que hacen login los dos usuarios.
-- Para cambiarlos una vez aplicada esta migracion: crear OTRA migracion
-- con el INSERT/DELETE correspondiente (nunca editar esta).
INSERT INTO public.usuarios_autorizados (email, nota) VALUES
  ('angel.rodriguez@nfq.es', 'Angel'),
  ('cristina.villarino.ledo@gmail.com', 'Cristina')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.bebes (nombre, fecha_nacimiento)
SELECT 'Carlota', DATE '2026-06-05'
WHERE NOT EXISTS (SELECT 1 FROM public.bebes);
