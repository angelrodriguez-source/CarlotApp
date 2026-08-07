/**
 * branding.ts — Recursos de marca compartidos (cabecera, hero de Hoy, login).
 *
 * El logo vive en public/: la URL debe respetar la base (/CarlotApp/ en
 * GitHub Pages), por eso no se puede escribir "/icon.svg" a pelo en los
 * templates (el plugin de Vue no reescribe rutas absolutas con la base).
 */
export const logoUrl = import.meta.env.BASE_URL + 'icon.svg'

/**
 * Foto de la bebé para el avatar de Hoy (public/carlota.jpg). OJO: los
 * estáticos de GitHub Pages son públicos por URL — decisión consciente;
 * la alternativa privada (Supabase Storage) está en el backlog. Si el
 * archivo no existe, la vista cae al logo (@error).
 */
export const fotoBebeUrl = import.meta.env.BASE_URL + 'carlota.jpg'
