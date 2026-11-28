-- Armarios de la familia: la ropa ya no es solo de Carlota — tambien
-- el armario de su madre (Cristina) y el de su padre (Angel). Nueva
-- columna 'dueno' y CHECK de 'tipo' ampliado con prendas de adulto
-- (camisa, blusa, top, vaqueros, traje, ropa interior, zapatillas,
-- deporte, accesorio). Cada dueno ofrece SU lista de tipos en el front
-- (models/armario.ts); el CHECK es la union de todas.
-- Idempotente: se puede aplicar N veces.

ALTER TABLE public.prendas
  ADD COLUMN IF NOT EXISTS dueno TEXT NOT NULL DEFAULT 'carlota';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'prendas_dueno_check' AND conrelid = 'public.prendas'::regclass
  ) THEN
    ALTER TABLE public.prendas
      ADD CONSTRAINT prendas_dueno_check CHECK (dueno IN ('carlota', 'madre', 'padre'));
  END IF;
END
$$;

-- CHECK de tipo ampliado (recrear, patron de eventos_unas/ejercicio)
ALTER TABLE public.prendas DROP CONSTRAINT IF EXISTS prendas_tipo_check;
ALTER TABLE public.prendas ADD CONSTRAINT prendas_tipo_check CHECK (tipo IN (
  'body', 'pijama', 'camiseta', 'pantalon', 'leggings', 'vestido',
  'falda', 'jersey', 'sudadera', 'chaqueta', 'abrigo', 'buzo',
  'calcetines', 'zapatos', 'gorro', 'manoplas', 'babero', 'banador',
  'camisa', 'blusa', 'top', 'vaqueros', 'traje', 'ropa_interior',
  'zapatillas', 'deporte', 'accesorio',
  'otro'
));
