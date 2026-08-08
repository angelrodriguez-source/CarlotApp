-- Origen de cada medición: 'casa' (la hacemos nosotros) u 'oficial'
-- (validada por el pediatra o en una farmacia). Las existentes quedan
-- como 'casa'.
ALTER TABLE public.medidas
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'casa'
  CHECK (origen IN ('casa', 'oficial'));
