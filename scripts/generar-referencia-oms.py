#!/usr/bin/env python3
"""
Genera app/src/models/referenciaOMS.ts con los estándares de crecimiento
de la OMS para niñas, semanas 0-100 (peso, longitud/altura y perímetro
craneal, percentiles P3/P15/P50/P85/P97).

Fuente: tablas LMS por día del paquete oficial `anthro` de la OMS
(https://github.com/WorldHealthOrganization/anthro, data-raw/growthstandards):
weianthro.txt, lenanthro.txt, hcanthro.txt. Sexo 2 = niña; día = semana*7.

Percentil desde LMS: X = M*(1 + L*S*z)^(1/L)  (o M*e^(S*z) si L = 0).

Uso: python3 scripts/generar-referencia-oms.py <ruta-a-growthstandards>
"""
import math
import sys
from pathlib import Path

Z_PERCENTILES = {
    'p3': -1.8807936081512509,
    'p15': -1.0364333894937898,
    'p50': 0.0,
    'p85': 1.0364333894937898,
    'p97': 1.8807936081512509,
}

SEXO_NINA = 2
SEMANAS = range(0, 101)


def leer_lms(ruta: Path) -> dict[int, tuple[float, float, float]]:
    """Tabla LMS de la OMS → {dia: (L, M, S)} solo para niñas."""
    filas: dict[int, tuple[float, float, float]] = {}
    with open(ruta) as f:
        f.readline()  # cabecera
        for linea in f:
            campos = linea.split()
            if int(campos[0]) != SEXO_NINA:
                continue
            filas[int(campos[1])] = (float(campos[2]), float(campos[3]), float(campos[4]))
    return filas


def percentil(l: float, m: float, s: float, z: float) -> float:
    if l == 0:
        return m * math.exp(s * z)
    return m * (1 + l * s * z) ** (1 / l)


def percentiles(lms: tuple[float, float, float], factor: float, decimales: int) -> str:
    valores = []
    for clave, z in Z_PERCENTILES.items():
        v = round(percentil(*lms, z) * factor, decimales)
        valores.append(f'{clave}: {v if decimales else int(v)}')
    return '{ ' + ', '.join(valores) + ' }'


def lms_ts(lms: tuple[float, float, float], factor: float) -> str:
    """LMS en unidades de la app (peso en gramos): para calcular percentiles exactos."""
    l, m, s = lms
    return f'{{ l: {l}, m: {round(m * factor, 1 if factor > 1 else 4)}, s: {s} }}'


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit('Uso: generar-referencia-oms.py <ruta-a-growthstandards>')
    base = Path(sys.argv[1])
    peso = leer_lms(base / 'weianthro.txt')      # kg
    altura = leer_lms(base / 'lenanthro.txt')    # cm
    pc = leer_lms(base / 'hcanthro.txt')         # cm

    filas = []
    for semana in SEMANAS:
        dia = semana * 7
        filas.append(
            f'  {{ semana: {semana}, '
            f'pesoG: {percentiles(peso[dia], 1000, 0)}, '
            f'alturaCm: {percentiles(altura[dia], 1, 1)}, '
            f'perimetroCranealCm: {percentiles(pc[dia], 1, 1)}, '
            f'lms: {{ peso: {lms_ts(peso[dia], 1000)}, '
            f'altura: {lms_ts(altura[dia], 1)}, '
            f'pc: {lms_ts(pc[dia], 1)} }} }},'
        )

    salida = Path(__file__).parent.parent / 'app' / 'src' / 'models' / 'referenciaOMS.ts'
    contenido = (
        '/**\n'
        ' * referenciaOMS.ts — Estándares de crecimiento de la OMS para NIÑAS,\n'
        ' * semanas 0-100 de vida: peso, longitud/altura y perímetro craneal en\n'
        ' * percentiles P3/P15/P50/P85/P97 (P50 = mediana, el "valor medio").\n'
        ' *\n'
        ' * GENERADO por scripts/generar-referencia-oms.py — NO editar a mano.\n'
        ' * Fuente: tablas LMS por día del paquete oficial `anthro` de la OMS\n'
        ' * (github.com/WorldHealthOrganization/anthro), sexo niña, día = semana*7.\n'
        ' */\n\n'
        'export interface PercentilesReferencia {\n'
        '  p3: number\n  p15: number\n  p50: number\n  p85: number\n  p97: number\n'
        '}\n\n'
        '/** Parámetros LMS de la OMS (m en las unidades de la app: peso en g) */\n'
        'export interface ParametrosLMS {\n'
        '  l: number\n  m: number\n  s: number\n'
        '}\n\n'
        'export interface ReferenciaSemana {\n'
        '  semana: number\n'
        '  pesoG: PercentilesReferencia\n'
        '  alturaCm: PercentilesReferencia\n'
        '  perimetroCranealCm: PercentilesReferencia\n'
        '  lms: { peso: ParametrosLMS; altura: ParametrosLMS; pc: ParametrosLMS }\n'
        '}\n\n'
        'export const REFERENCIA_OMS_NINAS: ReferenciaSemana[] = [\n'
        + '\n'.join(filas)
        + '\n]\n\n'
        '/** Referencia OMS de la semana pedida (0-100), o null fuera de rango */\n'
        'export function referenciaSemana(semana: number): ReferenciaSemana | null {\n'
        '  return REFERENCIA_OMS_NINAS[Math.floor(semana)] ?? null\n'
        '}\n'
    )
    salida.write_text(contenido)
    print(f'Escrito {salida} ({len(filas)} semanas)')


if __name__ == '__main__':
    main()
