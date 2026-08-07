-- Nuevo tipo de evento: 'unas' (corte de uñas).
-- El CHECK inline del esquema inicial se llama eventos_tipo_check
-- (nombre autogenerado por Postgres); se recrea con el valor nuevo.
ALTER TABLE public.eventos DROP CONSTRAINT IF EXISTS eventos_tipo_check;
ALTER TABLE public.eventos
  ADD CONSTRAINT eventos_tipo_check
  CHECK (tipo IN ('bano', 'vitamina_d', 'medicacion', 'unas', 'hito', 'otro'));
