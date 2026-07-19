# Prerequisitos externos — Fase 0 dry run

Elementos que **tú** debes crear/configurar fuera de Lovable antes de
ejecutar el runbook `07-cutover/staging-runbook.md`. Yo no puedo hacer
ninguno de estos por ti desde este entorno.

**Notación de columnas:**

- `responsible`: quién debe ejecutarlo.
- `where_configured`: dashboard/CLI/DNS donde vive el valor.
- `required_before_step`: sección del runbook que lo necesita.
- `secret_or_public`: cómo tratar el valor.
- `validation_method`: cómo verificar que quedó bien.

| # | Elemento | responsible | where_configured | required_before_step | secret_or_public | validation_method |
|---|----------|-------------|------------------|----------------------|------------------|-------------------|
| 1 | Proyecto Supabase staging | Cliente | Supabase Dashboard → New project | §3 Link | metadata pública | `supabase projects list` muestra ref |
| 2 | `TARGET_STAGING_PROJECT_REF` | Cliente | Anotar del Dashboard → Settings → General | §0 Guards | público | Coincide con ref del proyecto creado |
| 3 | `TARGET_STAGING_URL` = `https://<ref>.supabase.co` | Auto | Dashboard → Settings → API | §3 | público | `curl -sf $TARGET_STAGING_URL/rest/v1/` |
| 4 | Anon / Publishable key (staging) | Auto | Dashboard → Settings → API | §14 frontend | público (JWT anon) | Copiar a `.env.staging` |
| 5 | Service role key (staging) | Auto | Dashboard → Settings → API | §10 secretos | **SECRETO** — sólo Vault y `.env.staging.secrets` (git-ignored) | Nunca en frontend ni en logs |
| 6 | Password de base de datos (staging) | Cliente | Dashboard → Settings → Database → Reset | §3, §5 | **SECRETO** | `psql "$STAGING_DB_URL" -c 'select 1'` |
| 7 | Personal Access Token para Supabase CLI | Cliente | Account → Access Tokens | §2 CLI login | **SECRETO** | `supabase login --token ...` OK |
| 8 | Conexión PostgreSQL directa (`STAGING_DB_URL`) | Cliente | Compuesta con 5+6 | §4–§17 | **SECRETO** | `psql -c 'select current_database()'` |
| 9 | Google OAuth Client staging | Cliente | Google Cloud Console → APIs & Services → Credentials | §11 Auth | Client ID = público, Secret = **SECRETO** | Login prueba desde frontend staging |
| 10 | Site URL staging | Cliente | Dashboard → Auth → URL Configuration | §11 | público | Test signup redirige correctamente |
| 11 | Redirect URLs allow-list | Cliente | Idem | §11 | público | Test OAuth Google → no error `redirect_to not allowed` |
| 12 | SMTP staging (Mailtrap/Resend sandbox) | Cliente | Dashboard → Auth → Emails → SMTP Settings | §11 | **SECRETO** (SMTP password) | Signup dispara correo ficticio |
| 13 | Stripe Test Mode (account) | Cliente | Stripe Dashboard → Toggle Test Mode | §10 | Publishable = público, Secret = **SECRETO** | `stripe balance retrieve --api-key sk_test_...` |
| 14 | Stripe webhook signing secret (test) | Cliente | Stripe Dashboard → Developers → Webhooks → nuevo endpoint apuntando a `$TARGET_STAGING_URL/functions/v1/stripe-webhook` (o TSS route staging) | §10 | **SECRETO** | `stripe trigger payment_intent.succeeded` |
| 15 | Nubarium sandbox credentials | Cliente | Portal Nubarium sandbox | §10 | **SECRETOS** (user + password) | Prueba `/api/curp-consulta` con CURP ficticio |
| 16 | Verificamex sandbox credentials | Cliente | Portal Verificamex sandbox | §10 | **SECRETOS** (API key + webhook token) | Penny test simulado en cuenta ficticia |
| 17 | Copomex token | Cliente | Portal Copomex (mismo o cuenta test) | §10 | **SECRETO** | Consulta CP ficticio devuelve datos |
| 18 | `BANK_ACCOUNT_HASH_SECRET` (staging, distinto al prod) | Cliente | Generar con `openssl rand -hex 32` | §10 | **SECRETO** | Longitud >= 32 chars |
| 19 | `CRON_SECRET` (staging) | Cliente | `openssl rand -hex 32` | §10 crons | **SECRETO** | Hooks aceptan sólo con este token |
| 20 | `RESEND_API_KEY` (sandbox) o SMTP | Cliente | Resend dashboard | §10 | **SECRETO** | Test email a dirección ficticia |
| 21 | `GEMINI_API_KEY` (reemplazo de LOVABLE_API_KEY) | Cliente | Google AI Studio → Get API key | §10 (blocker categoría C) | **SECRETO** | `curl -H "x-goog-api-key: ..." https://generativelanguage.googleapis.com/v1beta/models` |
| 22 | Extensiones (`pg_cron`, `pg_net`, `pgcrypto`) habilitadas | Cliente / auto vía SQL | Dashboard → Database → Extensions o §4 runbook | §4 | público | `select extname from pg_extension` |
| 23 | Buckets Storage creados | Runbook §12 | Vía SQL | §12 | público metadata | 6 buckets, todos `public=false` |
| 24 | `pg_cron` jobs (dispute-deadlines, support-sla) | Cliente en dashboard SQL Editor | §9 runbook + `05-edge-functions/README.md` | §9 | metadata pública | `select * from cron.job` |
| 25 | Realtime publications | Auto (schema) | Aplicar `01-schema/06_rls_policies.sql` | §5 | público | `select * from pg_publication_tables` |
| 26 | Dominios permitidos en Auth | Cliente | Dashboard → Auth → Providers → Email → Allowed domains (opcional) | §11 | público | Signup rechaza dominio no permitido |
| 27 | Edge Function secrets aplicados | Runbook §10 | `supabase secrets set --env-file` | §9 despliegue | **SECRETOS** | `supabase secrets list` muestra nombres |
| 28 | Hosting frontend staging (URL) | Cliente | Vercel/Cloudflare Pages/Netlify staging, o rama Lovable staging | §14 | público | `curl -I` responde 200 |
| 29 | Rama `chore/staging-cutover-dryrun` en repo | Ingeniería | GitHub | §14 | público | Rama existe, no fusionable |
| 30 | `mc` client con S3 keys de staging Storage | Cliente | Dashboard → Storage → S3 Access Keys | §12 mirror | **SECRETOS** | `mc alias set supabase-staging ...` OK |

## Elementos que quedan expresamente FUERA de esta fase

- Cambio de webhooks Stripe / Verificamex productivos.
- Rotación de secretos productivos.
- Cambio de URL productiva del frontend.
- Cualquier acción sobre `diqdpygummlrajsugotv`.

## Confirmación previa a §0 del runbook

Antes de correr un solo bloque `# RUN`, tener llenos:

- `.env.staging.local` con: `TARGET_STAGING_PROJECT_REF`, `ENVIRONMENT=staging`,
  `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `STAGING_DB_HOST`,
  `STAGING_DB_URL`.
- `.env.staging.secrets` (git-ignored) con TODOS los secretos de
  proveedores sandbox (filas 5, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21).
- `.env.staging` (git-ignored) con las VITE_* públicas (filas 3, 4, 10, 11).
- Todos los ítems de la tabla marcados como completos por el operador.

Sin cualquiera de estos, el guard aborta la ejecución.
