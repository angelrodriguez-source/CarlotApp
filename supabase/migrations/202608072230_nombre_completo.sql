-- Nombre completo del bebé en la cabecera de Hoy.
-- El WHERE lo hace idempotente y no pisa futuros cambios manuales.
UPDATE public.bebes
   SET nombre = 'Carlota Rodríguez Villarino'
 WHERE nombre = 'Carlota';
