-- Armario: la ropa de Carlota, clasificada por tipo de prenda y color,
-- con foto opcional en Supabase Storage (bucket privado 'armario').
-- El catalogo de tipos/colores vive en el front (models/armario.ts);
-- aqui los CHECK espejan esas listas (ampliar = migracion nueva, como
-- con los tipos de evento). Idempotente: se puede aplicar N veces.

CREATE TABLE IF NOT EXISTS public.prendas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bebe_id        UUID NOT NULL REFERENCES public.bebes(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL CHECK (tipo IN (
    'body', 'pijama', 'camiseta', 'pantalon', 'leggings', 'vestido',
    'falda', 'jersey', 'sudadera', 'chaqueta', 'abrigo', 'buzo',
    'calcetines', 'zapatos', 'gorro', 'manoplas', 'babero', 'banador',
    'otro'
  )),
  color          TEXT NOT NULL CHECK (color IN (
    'blanco', 'crudo', 'amarillo', 'naranja', 'rosa', 'rojo', 'morado',
    'azul', 'celeste', 'verde', 'gris', 'marron', 'negro', 'multicolor'
  )),
  -- Talla tal cual la dice la etiqueta ("3-6 m", "68"...); libre
  talla          TEXT,
  notas          TEXT,
  -- Ruta del objeto en el bucket 'armario' (null = sin foto)
  foto_path      TEXT,
  registrado_por UUID DEFAULT auth.uid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prendas_bebe ON public.prendas (bebe_id);

-- RLS con la misma lista blanca que el resto de tablas
ALTER TABLE public.prendas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'prendas'
      AND policyname = 'autorizados_select'
  ) THEN
    CREATE POLICY autorizados_select ON public.prendas
      FOR SELECT TO authenticated USING (public.es_usuario_autorizado());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'prendas'
      AND policyname = 'autorizados_insert'
  ) THEN
    CREATE POLICY autorizados_insert ON public.prendas
      FOR INSERT TO authenticated WITH CHECK (public.es_usuario_autorizado());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'prendas'
      AND policyname = 'autorizados_update'
  ) THEN
    CREATE POLICY autorizados_update ON public.prendas
      FOR UPDATE TO authenticated
      USING (public.es_usuario_autorizado())
      WITH CHECK (public.es_usuario_autorizado());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'prendas'
      AND policyname = 'autorizados_delete'
  ) THEN
    CREATE POLICY autorizados_delete ON public.prendas
      FOR DELETE TO authenticated USING (public.es_usuario_autorizado());
  END IF;
END
$$;

-- La tabla entra en la publicacion Realtime (autorrecarga entre moviles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'prendas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.prendas;
  END IF;
END
$$;

-- ---- Storage: bucket privado 'armario' para las fotos ----
-- En algunos proyectos de Supabase el rol del runner no es owner de
-- storage.objects y no puede crear policies alli: por eso TODO este
-- bloque es best-effort (WARNING en vez de fallo) — la migracion nunca
-- debe tumbar el deploy. Si las fotos no suben (error de permisos),
-- se crean el bucket y las policies a mano en Dashboard > Storage
-- (bucket privado 'armario' + policies para authenticated con
-- public.es_usuario_autorizado()).
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('armario', 'armario', false)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'armario_select'
  ) THEN
    CREATE POLICY armario_select ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'armario' AND public.es_usuario_autorizado());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'armario_insert'
  ) THEN
    CREATE POLICY armario_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'armario' AND public.es_usuario_autorizado());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'armario_update'
  ) THEN
    CREATE POLICY armario_update ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'armario' AND public.es_usuario_autorizado())
      WITH CHECK (bucket_id = 'armario' AND public.es_usuario_autorizado());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'armario_delete'
  ) THEN
    CREATE POLICY armario_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'armario' AND public.es_usuario_autorizado());
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING 'Sin permisos para configurar Storage desde la migracion: crea el bucket privado "armario" y sus policies en Dashboard > Storage (ver comentario de esta migracion)';
END
$$;
