-- Realtime en las tablas de datos: la app escucha los cambios de la BBDD
-- (postgres_changes) para autorrecargarse cuando la otra persona registra
-- algo. RLS sigue mandando: cada suscriptor solo recibe filas que puede
-- leer (lista blanca via es_usuario_autorizado()).
-- Idempotente: se puede aplicar N veces.

-- Supabase crea la publicacion 'supabase_realtime' vacia por defecto,
-- pero por si acaso no existiera:
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

DO $$
DECLARE
  tabla TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'tomas', 'suenos', 'panales', 'eventos', 'medidas', 'citas', 'recordatorios'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tabla
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tabla);
    END IF;
  END LOOP;
END
$$;
