-- Mime Predictor: almacen de RESULTADOS del calculo de predicciones.
--
-- La linea base poblacional (ventanas de vigilia, intervalos de toma y
-- panales por edad) vive PRECARGADA en el codigo, igual que las tablas
-- OMS (app/src/models/prediccionBase.ts): versionada, testeable y sin
-- red en runtime. Aqui solo se guarda el ultimo calculo por bebe — una
-- fila viva que se machaca en cada recalculo (al abrir la app o
-- desplegar el panel) — con los parametros aprendidos en `parametros`
-- (medianas personales, pesos, nº de muestras) para poder inspeccionar
-- y comparar predicciones sin recalcular.
--
-- Idempotente: se puede aplicar N veces.

CREATE TABLE IF NOT EXISTS public.predicciones (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bebe_id               UUID NOT NULL REFERENCES public.bebes(id) ON DELETE CASCADE,
  calculado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edad_dias             INTEGER NOT NULL,
  -- Proxima toma: instante previsto + franja de confianza
  proxima_toma          TIMESTAMPTZ,
  proxima_toma_desde    TIMESTAMPTZ,
  proxima_toma_hasta    TIMESTAMPTZ,
  -- Proxima siesta (NULL si estaba durmiendo al calcular)
  proxima_siesta        TIMESTAMPTZ,
  proxima_siesta_desde  TIMESTAMPTZ,
  proxima_siesta_hasta  TIMESTAMPTZ,
  durmiendo             BOOLEAN NOT NULL DEFAULT FALSE,
  -- Presion de incomodidad 0-1
  incomodidad_prob      NUMERIC(4, 3),
  -- Parametros del calculo (pesos personales, medianas aprendidas,
  -- muestras, version de AJUSTES) para diagnostico
  parametros            JSONB NOT NULL DEFAULT '{}'::JSONB,
  registrado_por        UUID DEFAULT auth.uid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una unica fila viva por bebe (el upsert del servicio usa este indice)
CREATE UNIQUE INDEX IF NOT EXISTS predicciones_bebe_unica
  ON public.predicciones (bebe_id);

-- RLS con la misma lista blanca que el resto de tablas
ALTER TABLE public.predicciones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'predicciones'
      AND policyname = 'autorizados_select'
  ) THEN
    CREATE POLICY autorizados_select ON public.predicciones
      FOR SELECT TO authenticated USING (public.es_usuario_autorizado());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'predicciones'
      AND policyname = 'autorizados_insert'
  ) THEN
    CREATE POLICY autorizados_insert ON public.predicciones
      FOR INSERT TO authenticated WITH CHECK (public.es_usuario_autorizado());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'predicciones'
      AND policyname = 'autorizados_update'
  ) THEN
    CREATE POLICY autorizados_update ON public.predicciones
      FOR UPDATE TO authenticated
      USING (public.es_usuario_autorizado())
      WITH CHECK (public.es_usuario_autorizado());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'predicciones'
      AND policyname = 'autorizados_delete'
  ) THEN
    CREATE POLICY autorizados_delete ON public.predicciones
      FOR DELETE TO authenticated USING (public.es_usuario_autorizado());
  END IF;
END
$$;
