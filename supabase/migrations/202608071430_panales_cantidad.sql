-- Nivel de cantidad de los pañales con caca: poco / medio / mucho.
-- Opcional (NULL = sin especificar); aplica a tipos 'caca' y 'mixto'.
ALTER TABLE public.panales
  ADD COLUMN IF NOT EXISTS cantidad TEXT CHECK (cantidad IN ('poco', 'medio', 'mucho'));
