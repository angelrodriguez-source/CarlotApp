# CarlotApp 🍼

App personal (2 usuarios) para seguir la evolucion de Carlota: tomas,
sueno, panales, eventos, medidas con graficas, y citas medicas/tramites.

Mismo montaje que [Mimes-Care-Corp](https://github.com/angelrodriguez-source/Mimes-Care-Corp):
**Vue 3 + TS + Pinia + Supabase + GitHub Pages**, con deploy y migraciones
automaticas al hacer push. Documentacion en [`project-context/`](project-context/).

---

## Puesta en marcha (una vez, ~15 min)

Este esqueleto nacio en el repo Mimes-Care-Corp (carpeta `carlotapp/` de la
rama `claude/carlotapp-baby-tracking-0pq83p`). Pasos para dejarlo funcionando:

### 1. Repo nuevo en GitHub — ✅ hecho (2026-08-07)

El esqueleto ya esta volcado en este repo.

### 2. Proyecto Supabase — ✅ hecho (2026-08-07)

Proyecto creado: `https://aolbgcuvgcjpogdarpmg.supabase.co`. Queda por
configurar en su dashboard (paso 4):

- **Authentication > URL Configuration**:
  - Site URL: `https://angelrodriguez-source.github.io/CarlotApp/`
  - Redirect URLs: anade tambien `http://localhost:5173/**` (para dev)
- **Authentication > Sign In / Providers > Google**: activalo reutilizando
  el client ID/secret de Google Cloud que ya usas en Mimes, y en
  [console.cloud.google.com](https://console.cloud.google.com) > Credentials >
  tu OAuth client > Authorized redirect URIs anade:
  `https://aolbgcuvgcjpogdarpmg.supabase.co/auth/v1/callback`

### 3. Rellenar los TODO(config) del codigo — ✅ hecho (2026-08-07)

URL + publishable key en `app/src/services/supabase.ts` y `keepalive.yml`;
emails autorizados (Angel y Cristina) y fecha de nacimiento (2026-06-05)
en la migracion inicial.

### 4. Secret de migraciones

1. En el repo `CarlotApp`: **Settings > Secrets and variables > Actions >
   New repository secret**, nombre `SUPABASE_DB_URL`, valor: la connection
   string **URI del session pooler** (Dashboard > boton **Connect** arriba >
   Session pooler), con tu contrasena en lugar de `[YOUR-PASSWORD]`.
   ⚠️ La contrasena no debe llevar caracteres especiales (`@ # / : ?`).
2. Lanza a mano el workflow **Migraciones Supabase** (pestana Actions >
   Run workflow) — creara todo el esquema. Configura tambien lo del paso 2
   (Google + Site URL) en el dashboard de Supabase.

### 5. Activar GitHub Pages (solo la primera vez)

Repo `CarlotApp` > **Settings > Pages > Deploy from a branch** >
rama `gh-pages`, carpeta `/ (root)` > Save.

En un par de minutos: **https://angelrodriguez-source.github.io/CarlotApp/**
Entrad con Google los dos, y en el movil "Anadir a pantalla de inicio" (PWA).

---

## Desarrollo local

```bash
cd app
cp .env.local.example .env.local   # y rellena URL + anon key
npm install
npm run dev     # http://localhost:5173
npm run test    # tests de la logica pura (CarlotaModel)
npm run build   # type-check + build
```

## Como funciona el pipeline

- **Push a `main`** → tests + type-check + build → publica en `gh-pages`
- **Push con cambios en `supabase/migrations/`** → aplica solo las
  migraciones nuevas (control en la tabla `_migrations`)
- **Cada 3 dias** → ping a Supabase para que el free tier no pause el
  proyecto (y avisa por email si esta caido)
