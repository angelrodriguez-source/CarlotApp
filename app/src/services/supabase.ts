/**
 * supabase.ts — Cliente de conexión a Supabase (una sola instancia)
 *
 * Todos los demás archivos (stores, services) importan este cliente.
 * Los componentes NUNCA llaman a Supabase directamente: usan carlotaService.
 *
 * La anon key es SEGURA para frontend: solo permite lo que RLS autorice.
 * (La service_role key sí es secreta y jamás va en el cliente.)
 *
 * El build de GitHub Actions no tiene .env.local, así que usa estos
 * fallbacks hardcoded (la publishable/anon key es pública por diseño).
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://aolbgcuvgcjpogdarpmg.supabase.co'

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_9GZyG7vIJem21Zc52BE2aw_IdW3wI0W'

// flowType 'pkce': el retorno del OAuth (Google) llega como ?code=... en
// la query string, ANTES del hash — así no choca con el hash router de
// GitHub Pages. Con el flujo 'implicit' (default) los tokens vendrían en
// el #fragment y el router los interpretaría como una ruta.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce' },
})
