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

/** Icono de la card "Cómo va el día" (calendario con check) */
export const iconoDiaUrl = import.meta.env.BASE_URL + 'icono-dia.png'

/** Icono de Inicio en la navegación inferior (portapapeles con mano) */
export const iconoInicioUrl = import.meta.env.BASE_URL + 'icono-inicio.png'

/** Icono de Citas en la navegación inferior (calendario) */
export const iconoCitasUrl = import.meta.env.BASE_URL + 'icono-citas.png'

/** Icono de Evolución en la navegación inferior (gráfica de barras) */
export const iconoEvolucionUrl = import.meta.env.BASE_URL + 'icono-evolucion.png'

/** Icono de Historial en la navegación inferior (libro con pluma) */
export const iconoHistorialUrl = import.meta.env.BASE_URL + 'icono-historial.png'

/** URL de un estático de public/ respetando la base (/CarlotApp/ en Pages) */
export function urlPublica(archivo: string): string {
  return import.meta.env.BASE_URL + archivo
}

/**
 * Iconos propios de los conceptos de registro (los que ya tienen imagen;
 * el resto sigue con su emoji hasta que llegue el icono). Los usan los
 * accesos, los hitos, las líneas de tiempo y los títulos de hoja.
 */
export const ICONOS_REGISTRO: Partial<Record<string, string>> = {
  toma: urlPublica('icono-toma.png'),
  sueno: urlPublica('icono-sueno.png'),
  sueno_post: urlPublica('icono-sueno-post.png'),
  objetivo_sueno: urlPublica('icono-objetivo-sueno.png'),
  bano: urlPublica('icono-bano.png'),
  vitamina_d: urlPublica('icono-vitamina.png'),
  medicacion: urlPublica('icono-medicacion.png'),
}
