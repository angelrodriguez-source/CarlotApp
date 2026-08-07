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

### 1. Repo nuevo en GitHub

1. Crea `CarlotApp` en [github.com/new](https://github.com/new) (publico, sin README).
   ⚠️ El nombre debe ser EXACTAMENTE `CarlotApp` (case-sensitive): esta
   hardcodeado en `app/vite.config.ts` (`base: '/CarlotApp/'`).
2. Vuelca este esqueleto y sube:

```bash
git clone --branch claude/carlotapp-baby-tracking-0pq83p \
  https://github.com/angelrodriguez-source/Mimes-Care-Corp.git /tmp/mimes-rama
cp -r /tmp/mimes-rama/carlotapp ~/CarlotApp
cd ~/CarlotApp
git init -b main
git add -A
git commit -m "Esqueleto inicial de CarlotApp"
git remote add origin https://github.com/angelrodriguez-source/CarlotApp.git
# ⛔ NO hagas push todavia: antes rellena los TODO(config) del paso 3
```

### 2. Proyecto Supabase nuevo

1. [supabase.com/dashboard](https://supabase.com/dashboard) > **New project**
   (misma cuenta; el free tier permite 2 proyectos y Mimes usa 1).
   - Region: la de Mimes (eu-west)
   - Contrasena de BBDD: fuerte pero **sin caracteres especiales** (`@ # / : ?`)
2. Apunta de **Project Settings > API** (o Connect): la **Project URL**
   (`https://xxxx.supabase.co`) y la **anon key** (`eyJ...`).
3. **Authentication > URL Configuration**:
   - Site URL: `https://angelrodriguez-source.github.io/CarlotApp/`
   - Redirect URLs: anade tambien `http://localhost:5173/**` (para dev)
4. **Authentication > Sign In / Providers > Google**: activalo reutilizando
   el client ID/secret de Google Cloud que ya usas en Mimes, y en
   [console.cloud.google.com](https://console.cloud.google.com) > Credentials >
   tu OAuth client > Authorized redirect URIs anade:
   `https://xxxx.supabase.co/auth/v1/callback` (la URL del proyecto NUEVO).

### 3. Rellenar los TODO(config) del codigo

Busca `TODO(config)` (hay 3 archivos) y sustituye:

| Archivo | Que poner |
|---------|-----------|
| `supabase/migrations/202608061800_esquema_inicial.sql` | Email de Google de tu mujer y fecha de nacimiento real de Carlota. **Hazlo ANTES del primer push** (una migracion aplicada no se edita: habria que corregir con otra migracion) |
| `app/src/services/supabase.ts` | Project URL y anon key (los fallbacks hardcoded) |
| `.github/workflows/keepalive.yml` | La misma URL y anon key |

### 4. Secret de migraciones y push

1. En el repo `CarlotApp`: **Settings > Secrets and variables > Actions >
   New repository secret**, nombre `SUPABASE_DB_URL`, valor: la connection
   string **URI del session pooler** (Dashboard > boton **Connect** arriba >
   Session pooler), con tu contrasena en lugar de `[YOUR-PASSWORD]`.
2. `git add -A && git commit -m "Config de Supabase" && git push -u origin main`
3. El push dispara los dos workflows: **Migraciones Supabase** (crea todo el
   esquema) y **CI y Deploy** (publica la rama `gh-pages`).

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
