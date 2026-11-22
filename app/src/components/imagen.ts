/**
 * imagen.ts — Compresión de fotos en el cliente antes de subirlas.
 *
 * Una foto de móvil pesa 3-6 MB; para una miniatura de prenda sobran.
 * Se reescala al lado máximo indicado y se reencoda a JPEG: ~100-200 KB
 * por foto, que en el free tier de Supabase Storage (1 GB + 5 GB de
 * egress/mes) da para miles de prendas sin despeinarse.
 */

export async function comprimirImagen(
  archivo: File,
  maxLado = 1024,
  calidad = 0.82,
): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo)
  try {
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
    const ancho = Math.max(1, Math.round(bitmap.width * escala))
    const alto = Math.max(1, Math.round(bitmap.height * escala))
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const ctx = lienzo.getContext('2d')
    if (!ctx) throw new Error('No se pudo preparar la imagen')
    ctx.drawImage(bitmap, 0, 0, ancho, alto)
    const blob = await new Promise<Blob | null>((resolver) =>
      lienzo.toBlob(resolver, 'image/jpeg', calidad),
    )
    if (!blob) throw new Error('No se pudo comprimir la imagen')
    return blob
  } finally {
    bitmap.close()
  }
}
