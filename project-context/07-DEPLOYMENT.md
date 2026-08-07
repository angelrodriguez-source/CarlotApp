# 07 - Deployment y build

## GitHub Pages

**URL produccion**: `https://angelrodriguez-source.github.io/CarlotApp/`

**Push a `main` = deploy.** `.github/workflows/deploy.yml`:

1. `npm ci` + `npm run test` + `npm run build` en `app/` (si algo falla, NO se publica)
2. Publica `app/dist/` en la rama `gh-pages` (peaceiris/actions-gh-pages)

En PRs solo testea y buildea (sin publicar). Tras el PRIMER deploy hay que
activar Pages una vez: Settings > Pages > Deploy from a branch > `gh-pages` / root.

### Requisitos criticos (heredados de Mimes)

1. **`base: '/CarlotApp/'`** en `app/vite.config.ts` — case-sensitive,
   igual que el nombre del repo
2. **Hash router** — GitHub Pages no soporta history mode
3. `.nojekyll` — lo pone solo peaceiris/actions-gh-pages

## Migraciones automaticas

Cambios en `supabase/migrations/` + push a `main` → `migrate.yml` ejecuta
`scripts/apply-migrations.sh` (solo lo pendiente; registro en `_migrations`).

**Requiere** el secret `SUPABASE_DB_URL` (Settings > Secrets and variables >
Actions): connection string URI del **session pooler** (Dashboard > Connect),
contrasena sin caracteres especiales.

## Recordatorio nocturno

`recordatorio.yml` envía cada noche (20:15 UTC) un email a los dos padres
con el resumen del día (consulta la BBDD con `SUPABASE_DB_URL`) y el
recordatorio de apuntar lo que falte.

**Requiere** dos secrets: `MAIL_USERNAME` (el Gmail emisor) y
`MAIL_PASSWORD` (contraseña de aplicación de ese Gmail:
myaccount.google.com/apppasswords, exige 2FA). Sin ellos el workflow
falla y GitHub avisa por email.

## Keepalive

`keepalive.yml` hace un ping cada 3 dias para que el free tier de Supabase
no pause el proyecto (pausa tras ~7 dias inactivo). Si Supabase no responde,
el workflow falla y GitHub avisa por email (monitorizacion gratis).
Si el repo pasa 60 dias sin commits, GitHub deshabilita los crons —
se reactivan con un click en la pestana Actions.

## Build local

```bash
cd app
npm install
npm run dev          # Dev server en http://localhost:5173 (host: true → accesible por WiFi)
npm run test         # Vitest — CarlotaModel
npm run lint         # ESLint con --fix (lint-check en CI, sin fix)
npm run format       # Prettier sobre src/ (referenciaOMS.ts excluido)
npm run build        # Type-check (vue-tsc) + build
npm run preview      # Preview del build
```

Para desarrollo con datos reales: copiar `.env.local.example` a `.env.local`
con la URL y anon key del proyecto Supabase.

**Node requerido**: ^20.19.0 || >=22.12.0

## PWA

- `public/manifest.webmanifest` — nombre, colores, standalone, icono SVG
- `public/icon.svg` — icono (carita de bebe con lacito)
- `public/sw.js` — red-primero para HTML, cache-primero para `/assets/`
  (inmutables por hash de Vite), no intercepta Supabase
- Registro solo en produccion (main.ts); toast "Actualizar" en App.vue
  cuando hay version nueva (`SKIP_WAITING`)

En el movil: abrir la URL en Chrome/Safari > "Anadir a pantalla de inicio".

## Supabase — configuracion del dashboard

1. **Authentication > URL Configuration**:
   - Site URL: `https://angelrodriguez-source.github.io/CarlotApp/`
   - Redirect URLs: la misma + `http://localhost:5173/**` para dev
2. **Authentication > Sign In / Providers > Google**: activado (client ID y
   secret del mismo proyecto de Google Cloud que Mimes; anadir el callback
   `https://<ref-del-proyecto>.supabase.co/auth/v1/callback` al OAuth client)
3. La anon key y la URL van en: `app/src/services/supabase.ts` (fallbacks),
   `.env.local` (dev) y `keepalive.yml`
