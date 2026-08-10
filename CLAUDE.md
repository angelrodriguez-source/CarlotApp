# CarlotApp — Guia para Claude Code

## Contexto del proyecto

App personal para seguir la evolucion de Carlota (bebe): tomas, sueno,
panales, eventos, medidas (peso/altura/PC), citas medicas y tramites.
Dos usuarios (los padres), datos compartidos.

Toda la documentacion detallada esta en `project-context/`. Lee ese
directorio al inicio de cada sesion:

- [01-OVERVIEW.md](project-context/01-OVERVIEW.md) — Vision, stack, URLs, estructura
- [02-DATABASE.md](project-context/02-DATABASE.md) — Tablas, RLS, migraciones
- [03-FRONTEND-ARCHITECTURE.md](project-context/03-FRONTEND-ARCHITECTURE.md) — Entry point, routing, stores, servicios, vistas
- [07-DEPLOYMENT.md](project-context/07-DEPLOYMENT.md) — GitHub Pages, build, Supabase
- [08-PENDING-WORK.md](project-context/08-PENDING-WORK.md) — Bugs, deuda tecnica, roadmap

(La numeracion salta 04-06 a proposito: mantiene el paralelismo con
Mimes-Care-Corp, el proyecto del que se heredo este montaje.)

## Rama de desarrollo

La rama principal es `main`. No se desarrolla sobre `gh-pages` (solo build publicado).

## Convenciones

- Frontend: Vue 3 + TypeScript + Vite, en `app/`
- Backend: Supabase (Auth con Google + PostgreSQL + RLS)
- Estilos: CSS puro con variables CSS (`app/src/assets/main.css`)
- Idioma del codigo: nombres en espanol (tomas, suenos, panales, citas)
- Idioma de comentarios/docs: espanol
- Router: hash mode (GitHub Pages no soporta history mode)
- Los componentes no llaman a Supabase directamente — usan `services/carlotaService.ts`
- Logica pura del dominio en `models/CarlotaModel.ts` (sin side-effects) — es lo que se testea
- Migraciones: `supabase/migrations/YYYYMMDDHHMM_descripcion.sql`, idempotentes,
  nunca se edita una ya aplicada
- RLS en TODAS las tablas; el acceso se decide con `es_usuario_autorizado()`
  (lista blanca de emails en `usuarios_autorizados`)

## Estructura clave

```
app/                    # Codigo fuente Vue (la app real)
project-context/        # Documentacion (leer al inicio)
supabase/migrations/    # Migraciones SQL (se aplican solas al hacer push)
scripts/                # apply-migrations.sh (motor de migraciones)
.github/workflows/      # deploy.yml, migrate.yml, keepalive.yml, recordatorio.yml
```

## Al terminar una sesion

- Commitear cambios
- Actualizar `project-context/08-PENDING-WORK.md` si se resolvieron bugs o se anadieron features
- Actualizar otros docs de project-context si hubo cambios arquitecturales
