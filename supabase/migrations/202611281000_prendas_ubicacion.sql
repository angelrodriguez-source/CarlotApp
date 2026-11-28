-- Armario v2: columna 'ubicacion' en prendas — "donde la sueles
-- guardar" (texto libre: "comoda", "cajon de arriba", "casa de los
-- abuelos"...; el front autocompleta con las ubicaciones ya usadas).
-- Idempotente: se puede aplicar N veces.

ALTER TABLE public.prendas ADD COLUMN IF NOT EXISTS ubicacion TEXT;
