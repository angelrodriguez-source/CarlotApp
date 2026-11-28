/**
 * armario.ts — Lógica pura del Armario (testeada).
 *
 * Catálogos de tipos de prenda y colores (único punto de ajuste: añadir
 * uno aquí + ampliar el CHECK con una migración), filtrado por tipo y
 * color, y los conteos del resumen. Las fotos viven en Supabase Storage;
 * aquí solo se razona sobre los datos.
 */
import type { ColorPrenda, Prenda, TipoPrenda } from '../types'

/** Catálogo de tipos de prenda (define el orden; 'otro' SIEMPRE al final) */
export const TIPOS_PRENDA: readonly { id: TipoPrenda; etiqueta: string; emoji: string }[] = [
  { id: 'body', etiqueta: 'Body', emoji: '🩱' },
  { id: 'pijama', etiqueta: 'Pijama', emoji: '🌙' },
  { id: 'camiseta', etiqueta: 'Camiseta', emoji: '👕' },
  { id: 'pantalon', etiqueta: 'Pantalón', emoji: '👖' },
  { id: 'leggings', etiqueta: 'Leggings', emoji: '🦵' },
  { id: 'vestido', etiqueta: 'Vestido', emoji: '👗' },
  { id: 'falda', etiqueta: 'Falda', emoji: '🩳' },
  { id: 'jersey', etiqueta: 'Jersey', emoji: '🧶' },
  { id: 'sudadera', etiqueta: 'Sudadera', emoji: '🏃' },
  { id: 'chaqueta', etiqueta: 'Chaqueta', emoji: '🧥' },
  { id: 'abrigo', etiqueta: 'Abrigo', emoji: '🧸' },
  { id: 'buzo', etiqueta: 'Buzo / mono', emoji: '🪱' },
  { id: 'calcetines', etiqueta: 'Calcetines', emoji: '🧦' },
  { id: 'zapatos', etiqueta: 'Zapatos', emoji: '👟' },
  { id: 'gorro', etiqueta: 'Gorro', emoji: '🧢' },
  { id: 'manoplas', etiqueta: 'Manoplas', emoji: '🧤' },
  { id: 'babero', etiqueta: 'Babero', emoji: '🍼' },
  { id: 'banador', etiqueta: 'Bañador', emoji: '🏖️' },
  { id: 'otro', etiqueta: 'Otro', emoji: '⭐' },
] as const

/** Catálogo de colores, con su muestra (hex) para pintar el swatch */
export const COLORES_PRENDA: readonly { id: ColorPrenda; etiqueta: string; hex: string }[] = [
  { id: 'blanco', etiqueta: 'Blanco', hex: '#ffffff' },
  { id: 'crudo', etiqueta: 'Crudo', hex: '#f3ead8' },
  { id: 'amarillo', etiqueta: 'Amarillo', hex: '#f5d442' },
  { id: 'naranja', etiqueta: 'Naranja', hex: '#f08c3c' },
  { id: 'rosa', etiqueta: 'Rosa', hex: '#f4a6c0' },
  { id: 'rojo', etiqueta: 'Rojo', hex: '#d64545' },
  { id: 'morado', etiqueta: 'Morado', hex: '#9b6bbf' },
  { id: 'azul', etiqueta: 'Azul', hex: '#3f6fb5' },
  { id: 'celeste', etiqueta: 'Celeste', hex: '#9cc8e8' },
  { id: 'verde', etiqueta: 'Verde', hex: '#5ca86f' },
  { id: 'gris', etiqueta: 'Gris', hex: '#9aa2a6' },
  { id: 'marron', etiqueta: 'Marrón', hex: '#8a6648' },
  { id: 'negro', etiqueta: 'Negro', hex: '#2b2b2b' },
  // El multicolor se pinta con un degradado en la vista; el hex es reserva
  { id: 'multicolor', etiqueta: 'Multicolor', hex: '#e8d44d' },
] as const

export function etiquetaTipoPrenda(tipo: TipoPrenda): string {
  return TIPOS_PRENDA.find((t) => t.id === tipo)?.etiqueta ?? tipo
}

export function etiquetaColorPrenda(color: ColorPrenda): string {
  return COLORES_PRENDA.find((c) => c.id === color)?.etiqueta ?? color
}

/** "Body · Rosa · 3-6 m" (las partes vacías no estorban) */
export function tituloPrenda(p: Pick<Prenda, 'tipo' | 'color' | 'talla'>): string {
  const partes = [etiquetaTipoPrenda(p.tipo), etiquetaColorPrenda(p.color)]
  if (p.talla) partes.push(p.talla)
  return partes.join(' · ')
}

export interface FiltroArmario {
  tipo: TipoPrenda | null
  color: ColorPrenda | null
}

/** Filtra por tipo y/o color (null = sin filtrar esa dimensión) */
export function filtrarPrendas(prendas: Prenda[], filtro: FiltroArmario): Prenda[] {
  return prendas.filter(
    (p) =>
      (filtro.tipo === null || p.tipo === filtro.tipo) &&
      (filtro.color === null || p.color === filtro.color),
  )
}

/**
 * Prendas ordenadas como el catálogo (tipos en su orden, 'otro' al
 * final) y, dentro de un tipo, las más nuevas primero.
 */
export function ordenarPrendas(prendas: Prenda[]): Prenda[] {
  const ordenTipo = new Map(TIPOS_PRENDA.map((t, i) => [t.id, i]))
  return [...prendas].sort((a, b) => {
    const dif = (ordenTipo.get(a.tipo) ?? 99) - (ordenTipo.get(b.tipo) ?? 99)
    if (dif !== 0) return dif
    return b.created_at.localeCompare(a.created_at)
  })
}

/** Conteo por tipo (solo tipos con alguna prenda, en orden de catálogo) */
export function resumenArmario(
  prendas: Prenda[],
): { tipo: TipoPrenda; etiqueta: string; n: number }[] {
  const conteos = new Map<TipoPrenda, number>()
  for (const p of prendas) conteos.set(p.tipo, (conteos.get(p.tipo) ?? 0) + 1)
  return TIPOS_PRENDA.filter((t) => conteos.has(t.id)).map((t) => ({
    tipo: t.id,
    etiqueta: t.etiqueta,
    n: conteos.get(t.id)!,
  }))
}

/** Grupo de la rejilla: un tipo con sus prendas (ya ordenadas) */
export interface GrupoArmario {
  tipo: TipoPrenda
  etiqueta: string
  emoji: string
  prendas: Prenda[]
}

/**
 * Prendas agrupadas por tipo en orden de catálogo ('otro' al final),
 * las más nuevas primero dentro de cada grupo. Solo tipos con prendas.
 */
export function gruposPorTipo(prendas: Prenda[]): GrupoArmario[] {
  const ordenadas = ordenarPrendas(prendas)
  const grupos: GrupoArmario[] = []
  for (const p of ordenadas) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.tipo === p.tipo) {
      ultimo.prendas.push(p)
    } else {
      const info = TIPOS_PRENDA.find((t) => t.id === p.tipo)
      grupos.push({
        tipo: p.tipo,
        etiqueta: info?.etiqueta ?? p.tipo,
        emoji: info?.emoji ?? '⭐',
        prendas: [p],
      })
    }
  }
  return grupos
}

/**
 * Ubicaciones ya usadas, sin repetir (ignorando mayúsculas y espacios),
 * por orden alfabético — alimentan el autocompletar del formulario.
 */
export function ubicacionesUsadas(prendas: Prenda[]): string[] {
  const vistas = new Map<string, string>()
  for (const p of prendas) {
    const limpia = p.ubicacion?.trim()
    if (!limpia) continue
    const clave = limpia.toLocaleLowerCase('es')
    if (!vistas.has(clave)) vistas.set(clave, limpia)
  }
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, 'es'))
}
