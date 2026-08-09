-- Nuevo tipo de evento: 'ejercicio' (Tummy Time, estimulación...).
-- Se registra el subtipo y la duración en minutos; en las líneas de
-- tiempo se muestra "Ejercicio (Tummy Time) — 15 min".
-- Idempotente: se puede aplicar N veces.

ALTER TABLE public.eventos DROP CONSTRAINT IF EXISTS eventos_tipo_check;
ALTER TABLE public.eventos
  ADD CONSTRAINT eventos_tipo_check
  CHECK (tipo IN ('bano', 'vitamina_d', 'medicacion', 'unas', 'hito', 'otro', 'ejercicio'));

-- Subtipo del ejercicio (tummy_time | estimulacion | otros); NULL en el
-- resto de tipos de evento
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS subtipo TEXT;
ALTER TABLE public.eventos DROP CONSTRAINT IF EXISTS eventos_subtipo_check;
ALTER TABLE public.eventos
  ADD CONSTRAINT eventos_subtipo_check
  CHECK (subtipo IS NULL OR subtipo IN ('tummy_time', 'estimulacion', 'otros'));

-- Duración en minutos (por ahora solo la usa el ejercicio)
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS duracion_min INTEGER;
ALTER TABLE public.eventos DROP CONSTRAINT IF EXISTS eventos_duracion_check;
ALTER TABLE public.eventos
  ADD CONSTRAINT eventos_duracion_check
  CHECK (duracion_min IS NULL OR (duracion_min > 0 AND duracion_min <= 24 * 60));
