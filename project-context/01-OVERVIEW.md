# 01 - Overview

## Que es CarlotApp

App web personal (PWA instalable en el movil) para seguir el dia a dia y
la evolucion de **Carlota**. Dos usuarios — sus padres — con los datos
100% compartidos: cualquiera de los dos registra y ve todo.

Que registra:

- **Tomas**: pecho (izq/der, duracion) y biberon (formula/materna, ml)
- **Sueno**: inicio/fin (boton "empieza/termina"), siestas y noche
- **Panales**: pis / caca / mixto, con un toque
- **Eventos**: bano, vitamina D, medicacion, corte de unas, momentos (hitos), otros
- **Medidas**: peso (g), altura (cm), perimetro craneal (cm) → graficas de evolucion
- **Citas y tramites**: proximas citas medicas, registro civil, etc., con check de hecho

## Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | Vue 3 (Composition API) + TypeScript + Vite |
| Estado | Pinia |
| Routing | vue-router (hash mode) |
| Backend | Supabase: Auth (Google) + PostgreSQL + RLS |
| Estilos | CSS puro con variables |
| Tests | Vitest (solo logica pura: `models/`) |
| Hosting | GitHub Pages (gratis), deploy automatico |
| Migraciones | Automaticas al hacer push (GitHub Actions + psql) |

Es el mismo montaje que `angelrodriguez-source/Mimes-Care-Corp` (ver su
`PLANTILLA-NUEVA-APP.md`), simplificado para una app personal de 2 usuarios:
sin registro publico, sin RPCs de economia, sin realtime.

## URLs

- **Produccion**: `https://angelrodriguez-source.github.io/CarlotApp/`
- **Supabase**: proyecto propio (independiente del de Mimes) en supabase.com/dashboard

## Estructura del repo

```
app/                       # Proyecto Vue (npm install / dev / build aqui)
  public/                  # icon.svg + PNGs del manifest, iconos de la nav
                           # (icono-*.png), carlota.jpg, manifest, sw.js (PWA)
  src/
    assets/main.css        # Variables CSS + utilidades compartidas
    components/            # Graficas SVG (Linea/Crecimiento/Ritmo), BarraObjetivo,
                           # HojaInferior, HojaEdicionRegistro (+ registroEditable.ts)
    models/CarlotaModel.ts # Logica pura (edad, duraciones, resumenes) + tests
    router/index.ts        # Hash router + guard de sesion
    services/
      supabase.ts          # Unica instancia del cliente (PKCE)
      carlotaService.ts    # TODO acceso a datos pasa por aqui
    stores/
      userStore.ts         # Sesion (login Google, init, ready)
      bebeStore.ts         # El bebe activo + edad
    types.ts               # Tipos de dominio (espejo de las tablas)
    views/                 # Login, Hoy, Historial, Evolucion, Citas
project-context/           # Esta documentacion
supabase/migrations/       # Migraciones SQL (auto-aplicadas al push)
scripts/                   # apply-migrations.sh, generar-referencia-oms.py
.github/workflows/         # deploy.yml, migrate.yml, keepalive.yml, recordatorio.yml
```

## Decisiones de diseno

- **Datos compartidos, no por usuario**: las policies RLS comprueban
  pertenencia a una lista blanca de emails, no `user_id = auth.uid()`.
  `registrado_por` guarda igualmente quien anoto cada cosa.
- **Escrituras directas desde el cliente** (sin RPCs): al ser 2 usuarios de
  confianza y sin columnas criticas, no hace falta `SECURITY DEFINER` para
  escribir. Si algun dia hay logica sensible, se sigue la convencion de
  Mimes: RPC `SECURITY DEFINER` + `FOR UPDATE`.
- **Tabla `bebes`** aunque solo haya un bebe: deja la puerta abierta a
  hermanos sin migrar datos.
- **Fechas**: Postgres en UTC (`timestamptz`); el "dia" local lo calcula el
  cliente con `toLocaleDateString('sv-SE')`. Las medidas y citas de dia
  completo usan `date`.
