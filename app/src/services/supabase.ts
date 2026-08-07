/**
 * supabase.ts — Cliente de conexión a Supabase (una sola instancia)
 *
 * Todos los demás archivos (stores, services) importan este cliente.
 * Los componentes NUNCA llaman a Supabase directamente: usan carlotaService.
 *
 * La anon key es SEGURA para frontend: solo permite lo que RLS autorice.
 * (La service_role key sí es secreta y jamás va en el cliente.)
 *
 * TODO(config): sustituye los dos fallbacks por la URL y la anon key de
 * TU proyecto Supabase de CarlotApp (Dashboard > Settings > API). El build
 * de GitHub Actions no tiene .env.local, así que usa estos fallbacks.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://PEGA-AQUI-TU-PROYECTO.supabase.co'

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'PEGA-AQUI-LA-ANON-KEY'

// flowType 'pkce': el retorno del OAuth (Google) llega como ?code=... en
// la query string, ANTES del hash — así no choca con el hash router de
// GitHub Pages. Con el flujo 'implicit' (default) los tokens vendrían en
// el #fragment y el router los interpretaría como una ruta.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce' },
})
