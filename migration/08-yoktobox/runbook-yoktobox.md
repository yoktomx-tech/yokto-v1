# Runbook — Migración definitiva a `yoktobox` (Supabase externo)

**Estado**
- `CURRENT LOVABLE PROJECT: ARTIFACT GENERATOR ONLY`
- `OLD BACKEND: diqdpygummlrajsugotv — DO NOT TOUCH`
- `TARGET BACKEND: yoktobox`
- `EXECUTION: EXTERNAL OPERATOR REQUIRED`
- `PRODUCTION CUTOVER: NOT YET EXECUTED`

Este runbook lo ejecuta **exclusivamente el operador** desde una estación DevOps controlada. Lovable NO ejecuta ninguna acción de este runbook. Lovable NO recibe credenciales de `yoktobox`.

---

## 0. Prerrequisitos del operador

Instalado localmente:
- Supabase CLI ≥ 1.200
- Deno ≥ 1.45 (para tests de Edge Functions)
- `psql` (PostgreSQL client) ≥ 15
- `git`, `bun` o `npm`
- PowerShell 7+ (Windows) o Bash 5+ (macOS/Linux)

Credenciales que el operador obtiene del Dashboard de Supabase → **yoktobox**:
- `SUPABASE_PROJECT_REF` (ref del proyecto yoktobox — **NO es `diqdpygummlrajsugotv`**)
- `SUPABASE_DB_URL` (Connection string — Session pooler)
- `SUPABASE_ACCESS_TOKEN` (Personal Access Token del operador)
- `SUPABASE_URL` (`https://<ref>.supabase.co`)
- `SUPABASE_PUBLISHABLE_KEY` (anon/publishable)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

**Nunca** copies estas credenciales a Lovable, ni a este repo, ni a chat.

---

## 1. Guard obligatorio (aborta si el ref es el prohibido)

Antes de cualquier stage, el script (`apply-yoktobox.sh` / `.ps1`) debe verificar:

```
if SUPABASE_PROJECT_REF == "diqdpygummlrajsugotv"  → ABORT
if SUPABASE_PROJECT_REF is empty                    → ABORT
if $CONFIRM_TARGET != "yoktobox"                    → ABORT
```

El script imprime el ref detectado y pide confirmación explícita antes de continuar.

---

## 2. Preflight de conexión

```bash
supabase login --token "$SUPABASE_ACCESS_TOKEN"
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase projects list                # verificar visualmente
psql "$SUPABASE_DB_URL" -c "SELECT current_database(), current_user, now();"
```

Verificar:
- `supabase status` responde OK.
- El nombre del proyecto listado coincide con **yoktobox**.
- `SELECT current_database()` devuelve `postgres` (Supabase estándar).

---

## 3. Orden exacto de ejecución de SQL

Ejecutar `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f <archivo>` para cada uno, **en este orden estricto**:

| # | Archivo | Contenido |
|---|---------|-----------|
| 01 | `migration/01-schema/00_extensions.sql` | Extensiones (pgcrypto, uuid-ossp, pg_cron, pg_net, vault) |
| 02 | `migration/01-schema/01_enums.sql` | Enums base |
| 03 | `migration/02-role-model-migration/10_new_role_enums.sql` | Enums oficiales v2 (app_role, org_role, internal_role) |
| 04 | `migration/01-schema/02_tables.sql` | Todas las tablas |
| 05 | `migration/02-role-model-migration/11_new_role_tables.sql` | Tablas de roles v2 |
| 06 | `migration/01-schema/09_foreign_keys.sql` | FKs |
| 07 | `migration/01-schema/10_constraints.sql` | Check constraints |
| 08 | `migration/01-schema/05_indexes.sql` | Índices |
| 09 | `migration/01-schema/03_functions.sql` | Funciones base |
| 10 | `migration/02-role-model-migration/12_authz_functions.sql` | Funciones de authz (has_role, has_org_role, etc.) |
| 11 | `migration/01-schema/04_triggers.sql` | Triggers |
| 12 | `migration/01-schema/07_grants.sql` | GRANTs a `anon`, `authenticated`, `service_role` |
| 13 | `migration/01-schema/06_rls_policies.sql` | RLS legacy (compat) |
| 14 | `migration/02-role-model-migration/14_new_rls_policies.sql` | RLS del modelo oficial v2 |
| 15 | `migration/01-schema/08_storage_buckets_and_policies.sql` | 6 buckets + policies de storage |

**NO ejecutar aún** `migration/02-role-model-migration/15_finalize_role_rename.sql` — este script es **irreversible** y solo se corre al final del cutover, después de validar la app completa.

**NO ejecutar** los fixtures de staging (`migration/07-cutover/fixtures/staging-seed.sql`) contra yoktobox productivo.

---

## 4. Modelo oficial de roles (aplicado por el paso 3)

`app_role`: `buyer`, `seller`, `admin`
`org_role`: `owner`, `admin`, `finance`, `operator`, `viewer`, `auditor`
`internal_role`: `super_admin`, `compliance_officer`, `kyc_reviewer`, `document_reviewer`, `dispute_manager`, `finance_ops`, `support_agent`

Reglas ya codificadas en `12_authz_functions.sql` y `14_new_rls_policies.sql`:
- Todo usuario nuevo recibe `buyer` (trigger `handle_new_user`).
- `buyer` y `seller` coexisten.
- Un usuario puede tener múltiples `org_role`.
- Solo un `internal_role` activo por usuario (`internal_role_assignments.activo=true` + `expira_at`).
- `admin` de app, `owner`/`admin` de org **NO** conceden backoffice.
- Backoffice exige `internal_role_assignments` activo.
- Los tres niveles son independientes y acumulables.

---

## 5. Edge Functions

### 5.1 Desplegar

```bash
supabase functions deploy ai-gateway --project-ref "$SUPABASE_PROJECT_REF"
```

`supabase/functions/ai-gateway/` ya está preparado sin `LOVABLE_API_KEY`. Verificar en `supabase/config.toml` o al deploy que `verify_jwt = true`.

### 5.2 Secretos por nombre (sin valores)

```bash
supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" \
  AI_PROVIDER=<valor> \
  AI_PROVIDER_API_KEY=<valor> \
  AI_DEFAULT_MODEL=<valor> \
  AI_MAX_INPUT_TOKENS=<valor> \
  AI_MAX_OUTPUT_TOKENS=<valor> \
  AI_REQUEST_TIMEOUT_MS=<valor>
```

Otros secretos que la app usa hoy en Cloud y que el operador debe recrear **en yoktobox** (nombres, no valores):

- `NUBARIUM_USER`
- `NUBARIUM_PASSWORD`
- `COPOMEX_TOKEN`
- `VERIFICAMEX_API_KEY`
- `VERIFICAMEX_WEBHOOK_TOKEN`
- `BANK_ACCOUNT_HASH_SECRET`
- `STRIPE_SECRET_KEY` (sandbox; **NO Live**)
- `STRIPE_WEBHOOK_SECRET` (sandbox)

**Prohibido:** copiar valores desde `diqdpygummlrajsugotv`. Regenerar en cada proveedor.

### 5.3 Verificar

```bash
supabase functions list --project-ref "$SUPABASE_PROJECT_REF"
deno test --allow-env --allow-read supabase/functions/ai-gateway/index.test.ts
```

---

## 6. Generar tipos TypeScript desde yoktobox

```bash
supabase gen types typescript \
  --project-id "$SUPABASE_PROJECT_REF" \
  --schema public \
  > src/integrations/supabase/types.ts
```

Reemplazar el `types.ts` del fork frontend externo (**no el de este repo Lovable**).

---

## 7. Frontend portable (ejecutado en el fork externo, no en Lovable)

Copiar desde `migration/06-frontend-portable/` sobre `src/integrations/supabase/`:
- `client.ts`
- `client.server.ts`
- `auth-middleware.ts`
- `auth-attacher.ts`

Eliminar del fork:
- `src/integrations/lovable/index.ts`
- `bun remove @lovable.dev/cloud-auth-js`
- `src/lib/lovable-error-reporting.ts` (o dejarlo no-op)

Reemplazar en el frontend:
```ts
// Antes (Lovable Cloud):
lovable.auth.signInWithOAuth("google", { redirect_uri: ... })
// Después (Supabase estándar):
supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${window.location.origin}/auth/callback` }
});
```

Variables de entorno del frontend (`.env.production` del hosting externo):

```
VITE_SUPABASE_URL=https://<ref-yoktobox>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key-yoktobox>
```

**Prohibido en frontend:** `SUPABASE_SERVICE_ROLE_KEY`, Secret Key, DB password, OAuth Secret, `STRIPE_SECRET_KEY`, `AI_PROVIDER_API_KEY`.

---

## 8. Checklist manual — Dashboard de Supabase (yoktobox)

Solo el operador puede hacer esto:

**Auth → URL Configuration**
- [ ] Site URL = `https://<hosting-yokto-definitivo>`
- [ ] Redirect URLs = `https://<hosting-yokto-definitivo>/**`
- [ ] Rate limit: emails/hora ajustado al plan del SMTP

**Auth → Providers**
- [ ] Email: **enabled**, "Confirm email" ON, HIBP ON, auto-confirm OFF
- [ ] Google: enabled con Client ID/Secret **propios** (nuevos, no reutilizar los del Cloud)
- [ ] Anonymous sign-ups: **disabled**

**Auth → Email Templates**
- [ ] Confirmación, magic link, invitación, reset password: personalizados con branding YOKTO
- [ ] Sender name/email configurado

**Auth → SMTP**
- [ ] SMTP propio configurado (Resend, SendGrid, SES, etc.) — no depender del SMTP compartido de Supabase
- [ ] Prueba de envío exitosa

**Auth → Advanced**
- [ ] OTP expiry ≤ 3600s
- [ ] Password recovery flow validado

**Storage**
- [ ] Buckets `kyc-documents`, `dispute-evidence`, `verification-evidence`, `biometric-captures`, `transaction-documents`, `support-attachments` creados por el SQL del paso 3.
- [ ] Todos privados (public = false).

**Database → Extensions**
- [ ] pgcrypto, uuid-ossp, pg_cron, pg_net, vault: enabled

**Database → Webhooks** (posterior a Fase 1)
- [ ] Endpoints hacia el hosting del frontend externo, no hacia Lovable Cloud.

---

## 9. Checklist — Hosting del frontend fuera de Lovable

Opciones sugeridas (elige una):
- Vercel
- Cloudflare Pages
- Netlify
- Fly.io

Pasos:
- [ ] Fork del repo (o export desde Lovable) a Git privado del operador.
- [ ] Aplicar cambios de la sección 7 (frontend portable) en el fork.
- [ ] Configurar variables de build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- [ ] Variables server-side (server functions TanStack): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (**solo** en el runtime del hosting, nunca en cliente).
- [ ] Dominio productivo apuntado (DNS + TLS).
- [ ] Actualizar Site URL / Redirect URLs en Supabase Auth (paso 8) al dominio final.
- [ ] Actualizar Stripe webhook URL, Verificamex webhook, dispute-deadlines cron, support-sla cron para apuntar al hosting externo.

---

## 10. Datos que NO se migran automáticamente

| Categoría | Estado | Razón / Acción |
|-----------|--------|----------------|
| `auth.users` (contraseñas hasheadas) | **NO migrable desde este runbook** | Requiere `pg_dump` con acceso al proyecto Cloud, que Lovable no expone. Alternativa: reset masivo con magic links tras el corte. |
| Sesiones activas | **NO migrable** | Los usuarios deberán re-autenticarse. |
| Archivos en buckets | **NO migrable automáticamente** | Requiere script del operador con `supabase storage cp` o rclone entre proyectos. |
| Datos operativos (transactions, disputes, tickets) | **NO migrable desde Lovable** | `pg_dump` + `pg_restore` los realiza el operador si se autoriza el export desde Cloud. |
| Stripe customers/subscriptions | Mantener con la misma cuenta Stripe | Reapuntar webhooks al nuevo hosting. |
| Nubarium/Verificamex/Copomex historial | No migrable | Se preserva en logs del proveedor, no en la app. |

**En Fase 1 (corte productivo)** el operador decidirá si:
- (a) Se hace corte limpio (yoktobox arranca vacío, usuarios re-registran), o
- (b) Se ejecuta `pg_dump/pg_restore` de datos operativos con ventana de freeze.

---

## 11. Intervención manual del operador (resumen)

- [ ] Crear proyecto Supabase `yoktobox` (si no existe).
- [ ] Obtener credenciales (sección 0).
- [ ] Ejecutar `apply-yoktobox.sh` o `.ps1` con los guards.
- [ ] Cargar secretos con `supabase secrets set` (sección 5.2).
- [ ] Configurar Auth/OAuth/SMTP en Dashboard (sección 8).
- [ ] Fork y hosting del frontend (sección 9).
- [ ] Regenerar `types.ts` (sección 6).
- [ ] Configurar webhooks de proveedores externos hacia el nuevo hosting.
- [ ] Correr `verification-suite.sql` post-migración (sección 13).
- [ ] Solo tras validar todo: ejecutar `15_finalize_role_rename.sql`.

---

## 12. Rollback

**Antes del cutover DNS/hosting:**
- El backend Cloud `diqdpygummlrajsugotv` sigue vivo e intacto (Lovable no lo tocó).
- Basta con no cambiar el DNS y `yoktobox` queda descartable.

**Después del cutover DNS pero antes de `15_finalize_role_rename.sql`:**
- Revertir DNS al hosting Cloud.
- El estado de `yoktobox` se puede purgar con `migration/07-cutover/rollback-drill.sql` (revisar antes; ejecuta `TRUNCATE`).

**Después de `15_finalize_role_rename.sql`:**
- IRREVERSIBLE en `yoktobox` (dropea enums y tablas legacy).
- Rollback = restaurar `yoktobox` desde backup PITR de Supabase.
- Requiere ventana de freeze y comunicación a usuarios.

Backups obligatorios antes del cutover:
- [ ] Snapshot PITR de yoktobox habilitado y verificado.
- [ ] `pg_dump` de yoktobox pre-finalize.
- [ ] Snapshot de storage.

---

## 13. Validaciones post-migración

Todas se ejecutan contra `yoktobox`:

```bash
psql "$SUPABASE_DB_URL" -f migration/07-cutover/verification-suite.sql
psql "$SUPABASE_DB_URL" -f migration/07-cutover/rls-tests.sql
psql "$SUPABASE_DB_URL" -f migration/07-cutover/rls-tests-extended.sql
```

Criterios PASS:
- [ ] Los 3 enums oficiales existen (`app_role`, `org_role`, `internal_role`).
- [ ] 51 tablas presentes en `public`.
- [ ] Todas las tablas de datos de usuario con RLS ENABLED.
- [ ] GRANTs verificables: `SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');`
- [ ] `has_role`, `has_org_role`, `has_platform_role`, `has_internal_role` responden.
- [ ] 6 buckets creados y privados.
- [ ] `ai-gateway` responde 200 a un JWT válido y 401 sin JWT.
- [ ] Auth: signup → email de confirmación llega → login OK.
- [ ] Google OAuth: flujo completo hasta callback.
- [ ] `supabase.auth.getUser()` desde frontend devuelve el user esperado.
- [ ] `supabase.from('profiles').select()` respeta RLS.

Reportes a completar por el operador (plantillas ya existen en `migration/07-cutover/reports/`):
- `schema-reconciliation-report.md`
- `rls-test-report.md`
- `role-model-test-report.md`
- `storage-reconciliation-report.md`
- `edge-functions-inventory-final.md`
- `auth-reconciliation-report.md`
- `frontend-portable-test-report.md`
- `webhook-test-report.md`
- `payments-test-report.md`
- `rollback-test-report.md`
- `phase-1-readiness-report.md`

**Prohibido:** marcar PASS pruebas no ejecutadas.

---

## 14. Prohibiciones

- ❌ No ejecutar nada de esto contra `diqdpygummlrajsugotv`.
- ❌ No copiar valores de secretos desde Cloud a yoktobox.
- ❌ No usar Stripe Live durante la migración.
- ❌ No cambiar webhooks productivos antes de validar yoktobox.
- ❌ No eliminar tablas legacy sin backup.
- ❌ No marcar PASS pruebas no ejecutadas.
- ❌ No dar a Lovable las credenciales de yoktobox.

---

## 15. Estado final esperado

```
CURRENT LOVABLE PROJECT: ARTIFACT GENERATOR ONLY
OLD BACKEND: diqdpygummlrajsugotv — DO NOT TOUCH
TARGET BACKEND: yoktobox
EXECUTION: EXTERNAL OPERATOR REQUIRED
PRODUCTION CUTOVER: NOT YET EXECUTED
```
