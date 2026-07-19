# YOKTO — Handoff Maestro: Migración a `yoktobox` + Nuevo Proyecto Lovable

> **Estado:** ARTIFACT GENERATOR ONLY. Este documento es el último entregable del proyecto Lovable actual.
> **Ejecutor:** Tú (operador), fuera de Lovable.
> **Objetivo:** Backend en tu Supabase `yoktobox`, frontend en un nuevo proyecto Lovable conectado a tu GitHub.

---

## 0. Prerrequisitos (tener antes de empezar)

- [ ] Cuenta en **https://supabase.com** con `yoktobox` creado (ver §1).
- [ ] Cuenta en **https://github.com** con un repo vacío o el que Lovable creará.
- [ ] Cuenta en **Vercel / Netlify / Cloudflare Pages** (para hosting del frontend).
- [ ] **Password manager** (Bitwarden, 1Password…) con las 6 credenciales de `yoktobox` guardadas.
- [ ] Herramientas locales instaladas:
  - `git`
  - `node >= 20` y `bun` (o `npm`)
  - `psql` (cliente PostgreSQL)
  - `supabase` CLI (`brew install supabase/tap/supabase` o https://supabase.com/docs/guides/cli)
  - `bash` (Mac/Linux) o `PowerShell 7+` (Windows)

---

## 1. Crear proyecto `yoktobox` en Supabase (5 min)

1. https://supabase.com/dashboard → **New Project**.
2. Configura:
   - **Name:** `yoktobox`
   - **DB Password:** contraseña fuerte (guárdala en password manager).
   - **Region:** `us-east-1` (o la más cercana a tus usuarios en MX).
   - **Plan:** Free (upgrade a Pro antes de producción real).
3. Espera ~2 min a que provisione.
4. Ve a **Settings → API** y guarda en tu password manager:

| Variable de entorno | De dónde sacarla |
|---|---|
| `SUPABASE_URL` | Settings → API → Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Settings → API → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` (**SECRETO**) |
| `SUPABASE_PROJECT_REF` | Settings → General → Reference ID |
| `SUPABASE_DB_PASSWORD` | El que definiste al crear |
| `SUPABASE_DB_URL` | `postgresql://postgres.<REF>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres` |

5. En **Settings → Auth → URL Configuration**:
   - **Site URL:** deja `http://localhost:8080` por ahora (luego cambias al dominio de producción).
   - **Redirect URLs:** agrega `http://localhost:8080/**` y (más adelante) `https://tu-dominio.com/**`.

---

## 2. Descargar el código de este proyecto Lovable (2 min)

**Opción A — Vía GitHub (recomendada):**
1. Aquí en Lovable: botón `+` (abajo izq. del chat) → **GitHub** → **Connect project** → **Create Repository**.
2. En tu terminal:
   ```bash
   git clone https://github.com/<tu-usuario>/<repo-yokto>.git
   cd <repo-yokto>
   ```

**Opción B — ZIP:**
1. Code Editor de Lovable → **Download codebase** (plan pagado).
2. Descomprime y `cd` a la carpeta.

---

## 3. Ejecutar migración de schema/RLS/storage contra `yoktobox` (10 min)

Desde la raíz del repo clonado:

```bash
cd migration/08-yoktobox

# Exporta las credenciales del entorno (NO las commitees)
export SUPABASE_PROJECT_REF="<tu-ref>"
export SUPABASE_DB_URL="postgresql://postgres.<REF>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres"
export SUPABASE_SERVICE_ROLE_KEY="<service_role_key>"

# Guard de seguridad — el script aborta si el ref = diqdpygummlrajsugotv
./apply-all.sh
```

El orquestador ejecuta 19 etapas en orden:
1. Preflight (verifica que NO es `diqdpygummlrajsugotv`).
2. Extensions (`pgcrypto`, `pg_net`, `uuid-ossp`).
3. Enums (30 tipos).
4. Tablas (51).
5. Funciones y triggers.
6. Índices, RLS, GRANTs, FKs, constraints.
7. Modelo de roles v2 (backfill + finalize).
8. Storage buckets (6) + policies.
9. Deploy Edge Functions (`ai-gateway`).
10. Reportes automáticos sanitizados en `state/reports/`.

**Verifica al final:**
```bash
cat state/apply-all.state       # todas las etapas en OK
ls state/reports/                # reportes sanitizados generados
psql "$SUPABASE_DB_URL" -c "\dt public.*"   # 51 tablas presentes
```

Si algo falla → ver `state/apply-all.log`. El script es idempotente: puedes re-ejecutarlo.

---

## 4. Configurar secretos de terceros en `yoktobox` (5 min)

En el dashboard de Supabase → **Settings → Edge Functions → Secrets**, agrega:

| Secreto | Fuente |
|---|---|
| `NUBARIUM_USER` | Tu password manager |
| `NUBARIUM_PASSWORD` | Tu password manager |
| `VERIFICAMEX_API_KEY` | Tu password manager |
| `VERIFICAMEX_WEBHOOK_TOKEN` | Tu password manager |
| `BANK_ACCOUNT_HASH_SECRET` | Genera con `openssl rand -hex 32` |
| `COPOMEX_TOKEN` | Tu password manager |
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey (nuevo, reemplaza a `LOVABLE_API_KEY`) |
| `STRIPE_SECRET_KEY` | Dashboard Stripe (cuando actives pagos) |
| `STRIPE_WEBHOOK_SECRET` | Dashboard Stripe → Webhooks |

**NO copies `LOVABLE_API_KEY`** — la arquitectura target lo eliminó.

---

## 5. Crear nuevo proyecto Lovable conectado a `yoktobox` + GitHub (10 min)

1. https://lovable.dev/ → **New Project**.
2. **NO actives Lovable Cloud** al crearlo (importante).
3. Una vez creado, abre el proyecto:
   - Menú `+` → **GitHub** → **Connect project** → selecciona el repo que ya tienes con el código.
   - Menú `+` → **Supabase** → **Connect** → pega:
     - `SUPABASE_URL`
     - `SUPABASE_PUBLISHABLE_KEY`
     - (Opcional) `SUPABASE_SERVICE_ROLE_KEY` si Lovable lo pide como secreto para server code.
4. Lovable detectará el código existente y podrás seguir desarrollando visualmente contra `yoktobox`.

---

## 6. Reemplazar clientes Supabase por versión portable (5 min)

En el nuevo proyecto (via Lovable o localmente):

```bash
# Sobrescribe los clientes auto-generados de Lovable Cloud
cp migration/06-frontend-portable/client.ts        src/integrations/supabase/client.ts
cp migration/06-frontend-portable/client.server.ts src/integrations/supabase/client.server.ts
cp migration/06-frontend-portable/auth-middleware.ts src/integrations/supabase/auth-middleware.ts
cp migration/06-frontend-portable/auth-attacher.ts   src/integrations/supabase/auth-attacher.ts
```

Crea `.env.local` en la raíz (**NO** lo commitees):

```env
VITE_SUPABASE_URL=<tu SUPABASE_URL de yoktobox>
VITE_SUPABASE_PUBLISHABLE_KEY=<tu anon key>
SUPABASE_URL=<tu SUPABASE_URL>
SUPABASE_PUBLISHABLE_KEY=<tu anon key>
SUPABASE_SERVICE_ROLE_KEY=<tu service_role>  # server only
```

Verifica local:
```bash
bun install
bun run dev
# Abre http://localhost:8080 y prueba signup/login contra yoktobox
```

---

## 7. Hospedar frontend en Vercel (10 min)

1. https://vercel.com/new → importa el repo de GitHub.
2. Framework preset: **Vite** (detecta automáticamente TanStack Start).
3. **Environment Variables** → agrega las mismas 5 del `.env.local`.
4. **Deploy** → obtienes URL `https://<proyecto>.vercel.app`.
5. Ve a `yoktobox` → Settings → Auth → agrega esa URL en **Site URL** y **Redirect URLs**.
6. (Opcional) Custom domain → apunta `yokto.com` (o el tuyo) al deployment de Vercel.

Guía detallada: `migration/08-yoktobox/frontend-hosting/README.md`.

---

## 8. Validación final (checklist)

- [ ] `psql "$SUPABASE_DB_URL" -c "SELECT count(*) FROM public.transactions"` responde sin error.
- [ ] Signup con email funciona en el frontend hospedado.
- [ ] Login existente funciona.
- [ ] Crear una transacción de prueba y verla en `SELECT * FROM public.transactions`.
- [ ] Storage: subir un archivo a `kyc-documents` y descargarlo con URL firmada.
- [ ] Edge Function `ai-gateway` responde con `GEMINI_API_KEY` (no `LOVABLE_API_KEY`).
- [ ] Ninguna llamada del frontend apunta a `*.lovable.dev` o a `diqdpygummlrajsugotv.supabase.co`.

Marca el reporte `migration/07-cutover/reports/backend-verification-report.md` como **PASS**.

---

## 9. Rollback (si algo sale mal en las primeras 24 h)

- El proyecto Lovable actual (`diqdpygummlrajsugotv`) **sigue vivo e intacto**.
- Basta con volver a apuntar DNS / usuarios a la URL de este proyecto Lovable original.
- `yoktobox` puede pausarse desde el dashboard sin costo.

---

## 10. Cerrar este proyecto Lovable (opcional, cuando `yoktobox` esté estable)

Cuando lleves 1-2 semanas operando en `yoktobox` sin issues:

1. Descarga un último export: **Cloud → Advanced → Export data**.
2. Guarda el ZIP en tu backup.
3. (Opcional) En este proyecto → Cloud tab → Advanced → **Disconnect** (irreversible, borra `diqdpygummlrajsugotv`).
4. O simplemente déjalo pausado sin desconectar.

---

## Estado final registrado

```
CURRENT LOVABLE PROJECT (this one):      ARTIFACT GENERATOR ONLY — DO NOT DEPLOY
OLD BACKEND (diqdpygummlrajsugotv):      LIVE UNTIL YOU DECIDE — DO NOT TOUCH FROM HERE
NEW BACKEND (yoktobox):                  YOU OWN IT — MIGRATION READY
NEW FRONTEND PROJECT:                    NEW LOVABLE PROJECT + GITHUB + VERCEL
PRODUCTION CUTOVER:                      EXECUTED BY OPERATOR — NOT FROM LOVABLE
```

---

## Contacto y soporte

- Docs Lovable: https://docs.lovable.dev
- Docs Supabase: https://supabase.com/docs
- Este documento y los artefactos: carpeta `migration/` del repo.

**Fin del handoff.**
