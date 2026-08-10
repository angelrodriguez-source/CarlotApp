-- Recordatorios: "sobre un elemento de registro, cada cuánto tendría que
-- hacerse" — ítem + intervalo (día/semana) + repeticiones dentro del
-- intervalo. P. ej.: vitamina D 1 vez al día, Ejercicio (Tummy Time)
-- 3 veces al día. El estado (hechas/pendientes) NO se guarda: se calcula
-- en el cliente contando los registros reales (models/recordatorios.ts).
-- Idempotente: se puede aplicar N veces.

CREATE TABLE IF NOT EXISTS public.recordatorios (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bebe_id        UUID NOT NULL REFERENCES public.bebes(id) ON DELETE CASCADE,
  -- Qué se recuerda: un tipo de registro contable
  item           TEXT NOT NULL CHECK (
    item IN ('toma', 'sueno', 'panal', 'bano', 'vitamina_d', 'medicacion', 'unas', 'ejercicio')
  ),
  -- Solo para item = 'ejercicio': NULL = cualquier ejercicio
  subtipo        TEXT CHECK (subtipo IS NULL OR subtipo IN ('tummy_time', 'estimulacion', 'otros')),
  intervalo      TEXT NOT NULL DEFAULT 'dia' CHECK (intervalo IN ('dia', 'semana')),
  repeticiones   INTEGER NOT NULL DEFAULT 1 CHECK (repeticiones >= 1 AND repeticiones <= 24),
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  registrado_por UUID DEFAULT auth.uid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recordatorios_bebe ON public.recordatorios (bebe_id);

-- RLS con la misma lista blanca que el resto de tablas
ALTER TABLE public.recordatorios ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'recordatorios'
      AND policyname = 'autorizados_select'
  ) THEN
    CREATE POLICY autorizados_select ON public.recordatorios
      FOR SELECT TO authenticated USING (public.es_usuario_autorizado());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'recordatorios'
      AND policyname = 'autorizados_insert'
  ) THEN
    CREATE POLICY autorizados_insert ON public.recordatorios
      FOR INSERT TO authenticated WITH CHECK (public.es_usuario_autorizado());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'recordatorios'
      AND policyname = 'autorizados_update'
  ) THEN
    CREATE POLICY autorizados_update ON public.recordatorios
      FOR UPDATE TO authenticated
      USING (public.es_usuario_autorizado())
      WITH CHECK (public.es_usuario_autorizado());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'recordatorios'
      AND policyname = 'autorizados_delete'
  ) THEN
    CREATE POLICY autorizados_delete ON public.recordatorios
      FOR DELETE TO authenticated USING (public.es_usuario_autorizado());
  END IF;
END
$$;
