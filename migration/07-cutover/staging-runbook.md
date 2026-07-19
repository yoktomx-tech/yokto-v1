# Staging Runbook — YOKTO Fase 0

**Entorno único autorizado:** proyecto Supabase staging externo (`TARGET_STAGING_PROJECT_REF`).
**Entorno PROHIBIDO:** `diqdpygummlrajsugotv` (Lovable Cloud producción).

Este runbook está diseñado para ejecutarse desde una estación DevOps o
un runner CI aislado, con las credenciales del proyecto staging. Nunca
desde la sesión del agente Lovable, ni contra el proyecto Cloud actual.

---

## 0. Guards obligatorios (incluir al inicio de cada script `.sh`)

Copiar este bloque literal como cabecera de todo script que despliegue,
migre o modifique infraestructura. Sin él, no ejecutar.

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${TARGET_STAGING_PROJECT_REF:?TARGET_STAGING_PROJECT_REF is required}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"
: "${ENVIRONMENT:?ENVIRONMENT is required}"

test "$ENVIRONMENT" = "staging" || {
  echo "ABORT: ENVIRONMENT is not staging"; exit 1;
}

test "$SUPABASE_PROJECT_REF" = "$TARGET_STAGING_PROJECT_REF" || {
  echo "ABORT: linked project does not match TARGET_STAGING_PROJECT_REF"; exit 1;
}

test "$SUPABASE_PROJECT_REF" != "diqdpygummlrajsugotv" || {
  echo "ABORT: refusing to execute against Lovable Cloud production"; exit 1;
}

# Confirmación adicional cross-check
LINKED_REF="$(supabase status 2>/dev/null | awk '/API URL/ {print $NF}' | sed -E 's|https?://([^.]+).*|\1|')"
test -n "$LINKED_REF" || { echo "ABORT: supabase CLI not linked"; exit 1; }
test "$LINKED_REF" = "$TARGET_STAGING_PROJECT_REF" || {
  echo "ABORT: supabase CLI linked to $LINKED_REF, expected $TARGET_STAGING_PROJECT_REF"; exit 1;
}

echo "OK: staging guard passed (project: $SUPABASE_PROJECT_REF)"
```

Cualquier bloque marcado con `# RUN` en este runbook debe ir precedido
por los guards. Los bloques marcados con `# LOCAL` no tocan
infraestructura remota.

---

## 1. Requisitos previos (fuera de Supabase)

Antes de la primera línea del runbook, verificar:

- Cuenta Supabase con permisos de owner sobre el proyecto staging.
- Proyecto staging **creado** con:
  - Plan que soporte `pg_cron` y `pg_net`.
  - Región cercana a producción.
  - `postgres` password (guardar en gestor de contraseñas, nunca en el repo).
- Access token de Supabase CLI (`Personal Access Tokens` en el dashboard).
- Cliente OAuth de Google **independiente** para staging (Client ID + Secret).
- Credenciales sandbox: Nubarium, Verificamex, Copomex, Stripe test.
- SMTP de staging (Mailtrap, Resend sandbox, etc. — nunca el productivo).
- `mc` (MinIO client) para mirror de storage, configurado con S3 keys.
- Docker (para `supabase start` local si se usará).
- `bun` >= 1.1 y Node LTS.
- `jq`, `curl`, `psql` (cliente Postgres) instalados.

Variables de entorno del operador (en `.env.staging.local`, git-ignored):

```bash
export TARGET_STAGING_PROJECT_REF="xxxx"      # NUNCA "diqdpygummlrajsugotv"
export ENVIRONMENT="staging"
export SUPABASE_ACCESS_TOKEN="sbp_xxx"
export SUPABASE_DB_PASSWORD="xxx"
export STAGING_DB_HOST="db.${TARGET_STAGING_PROJECT_REF}.supabase.co"
export STAGING_DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@${STAGING_DB_HOST}:5432/postgres"
```

Verificar:

```bash
# LOCAL
test "$TARGET_STAGING_PROJECT_REF" != "diqdpygummlrajsugotv" \
  || { echo "ABORT: staging ref cannot equal prod"; exit 1; }
```

---

## 2. Instalación y validación de Supabase CLI

```bash
# LOCAL
# macOS
brew install supabase/tap/supabase
# Linux
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
  | tar -xz -C /usr/local/bin supabase

supabase --version   # >= 1.200
```

Validar acceso:

```bash
supabase login --token "$SUPABASE_ACCESS_TOKEN"
supabase projects list
```

Confirmar que `TARGET_STAGING_PROJECT_REF` aparece y que el proyecto
productivo NO se usará. Si ves ambos, ten cuidado con qué ref pasas
al comando `link`.

---

## 3. Enlace al proyecto staging + validación de ref

```bash
# RUN
cd migration/  # trabaja aislado del root para no confundir configs
mkdir -p .supabase-staging && cd .supabase-staging
supabase init --workdir . || true

# CRÍTICO: pasar ref explícito
supabase link --project-ref "$TARGET_STAGING_PROJECT_REF" \
  --password "$SUPABASE_DB_PASSWORD"

# Validar
SUPABASE_PROJECT_REF="$(supabase status | awk '/API URL/ {print $NF}' | sed -E 's|https?://([^.]+).*|\1|')"
export SUPABASE_PROJECT_REF

# Guards
test "$SUPABASE_PROJECT_REF" = "$TARGET_STAGING_PROJECT_REF" || {
  echo "ABORT: linked to $SUPABASE_PROJECT_REF (expected $TARGET_STAGING_PROJECT_REF)"; exit 1;
}
test "$SUPABASE_PROJECT_REF" != "diqdpygummlrajsugotv" || {
  echo "ABORT: linked to PROD"; exit 1;
}
echo "OK: linked to staging $SUPABASE_PROJECT_REF"
```

---

## 4. Extensiones

```bash
# RUN — guards on
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -f ../01-schema/00_extensions.sql

# Verificar
psql "$STAGING_DB_URL" -c "SELECT extname FROM pg_extension ORDER BY 1;"
```

Debe listar al menos: `pgcrypto`, `pg_net`, `pg_cron`, `pgjwt`, `uuid-ossp`.
Si `pg_cron` no está: subir plan del proyecto y reintentar.

---

## 5. Aplicación de migraciones

Orden estricto (no alterar):

```bash
# RUN — guards on
SCHEMA_DIR="../01-schema"
ROLES_DIR="../02-role-model-migration"

# Fase Schema
for f in 01_enums.sql 02_tables.sql 03_functions.sql 04_triggers.sql \
         05_indexes.sql 06_rls_policies.sql 07_grants.sql \
         08_storage_buckets_and_policies.sql 09_foreign_keys.sql 10_constraints.sql; do
  echo "→ Applying $SCHEMA_DIR/$f"
  psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_DIR/$f"
done

# Fase Roles Etapa A (crear v2 sin destruir)
for f in 10_new_role_enums.sql 11_new_role_tables.sql 12_authz_functions.sql; do
  echo "→ Applying $ROLES_DIR/$f"
  psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f "$ROLES_DIR/$f"
done

# Validar Etapa A (via orchestrator)
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -f ../02-role-model-migration/stage_a_validate.sql
```

Si algún `psql` sale con código != 0, **detente**. No sigas a la Etapa B.

---

## 6. Fixtures (seed exclusivo staging)

```bash
# RUN — guards on
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -f ../07-cutover/fixtures/staging-seed.sql

# Verificar conteos esperados
psql "$STAGING_DB_URL" -f ../07-cutover/fixtures/staging-seed-verify.sql
```

Los fixtures usan correos `@staging.yokto.test` y NUNCA datos reales.

---

## 7. Etapa B — Backfill con conteos

```bash
# RUN — guards on
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -f ../02-role-model-migration/13_role_data_backfill.sql \
  2>&1 | tee ../07-cutover/reports/logs/stage_b_backfill_$(date -u +%Y%m%dT%H%M%SZ).log

# Ejecutar validaciones (aborta si algún criterio falla)
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -f ../02-role-model-migration/stage_b_validate.sql
```

Criterios (automatizados en `stage_b_validate.sql`):

- `unmapped_org_role = 0`
- `users_without_role = 0`
- `users_without_membership = 0`
- `duplicate_internal_active = 0`
- `count(v2 user_roles) == count(legacy user_roles)`

---

## 8. Etapa C — RLS reescritura

```bash
# RUN — guards on
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -f ../02-role-model-migration/14_new_rls_policies.sql \
  2>&1 | tee ../07-cutover/reports/logs/stage_c_rls_$(date -u +%Y%m%dT%H%M%SZ).log

# Validación por tabla
psql "$STAGING_DB_URL" -c "
  SELECT tablename, count(*) AS policies
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
  ORDER BY tablename;
" > ../07-cutover/reports/logs/rls_policy_count.txt
```

Toda tabla del set oficial debe tener al menos 1 policy. Cero policies = fallar.

---

## 9. Despliegue de Edge Functions (staging)

```bash
# RUN — guards on
# Configurar secretos ANTES del deploy
supabase secrets set --env-file ../.env.staging.secrets

# Deploy uno por uno (permite ver logs individuales)
FUNCTIONS=(
  # completar tras function-migration-matrix.md categoría A
)
for fn in "${FUNCTIONS[@]}"; do
  echo "→ Deploying $fn"
  supabase functions deploy "$fn" --project-ref "$TARGET_STAGING_PROJECT_REF"
done

# Verificar
supabase functions list --project-ref "$TARGET_STAGING_PROJECT_REF"
```

Ver `migration/05-edge-functions/function-migration-matrix.md` para
categoría A (migrables), B, C (blocker), D (obsoletas).

---

## 10. Configuración de secretos (Vault + Function Secrets)

Nunca commitear valores. Usar plantilla:

```bash
# LOCAL
cp migration/07-cutover/.env.staging.secrets.template .env.staging.secrets
# Editar y llenar con credenciales SANDBOX
```

Aplicar:

```bash
# RUN — guards on
supabase secrets set --env-file .env.staging.secrets \
  --project-ref "$TARGET_STAGING_PROJECT_REF"

# Verificar (no expone valores)
supabase secrets list --project-ref "$TARGET_STAGING_PROJECT_REF"
```

Secretos esperados: `NUBARIUM_USER`, `NUBARIUM_PASSWORD`,
`VERIFICAMEX_API_KEY`, `VERIFICAMEX_WEBHOOK_TOKEN`, `COPOMEX_TOKEN`,
`STRIPE_SECRET_KEY` (test), `STRIPE_WEBHOOK_SECRET`, `BANK_ACCOUNT_HASH_SECRET`,
`LOVABLE_API_KEY` (sólo si aún se usa AI Gateway — categoría C potencial),
`APP_URL` = URL frontend staging.

---

## 11. Configuración de Auth

Dashboard → Auth → Providers → **Google**:
- Client ID / Secret: valores del cliente OAuth **staging** (no productivo).
- Callback URL: `https://<TARGET_STAGING_URL>/auth/v1/callback`.

Dashboard → Auth → URL Configuration:
- Site URL: URL del frontend staging (ej. `https://staging-yokto.vercel.app`).
- Redirect URLs allow-list:
  - `https://staging-yokto.vercel.app/**`
  - `http://localhost:8080/**` (si se prueba local)

Dashboard → Auth → Email → **Templates**: cargar templates YOKTO en español.
Dashboard → Auth → Providers → Email: `Confirm email` = ON, `HIBP check` = ON.
Dashboard → Auth → MFA: TOTP = ON.

---

## 12. Buckets y policies de Storage

```bash
# RUN — guards on
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -f ../01-schema/08_storage_buckets_and_policies.sql

# Verificar
psql "$STAGING_DB_URL" -c "SELECT id, public FROM storage.buckets ORDER BY id;"
```

Debe listar los 6 buckets con `public = false`.

Mirror de fixtures a Storage (archivos ficticios pequeños):

```bash
# LOCAL (files bajo migration/07-cutover/fixtures/storage/)
for bucket in kyc-documents dispute-evidence verification-evidence \
              biometric-captures transaction-documents support-attachments; do
  mc mirror --overwrite \
    "migration/07-cutover/fixtures/storage/$bucket/" \
    "supabase-staging/$bucket/"
done
```

---

## 13. Pruebas RLS

```bash
# RUN — guards on
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -f ../07-cutover/rls-tests.sql \
  2>&1 | tee ../07-cutover/reports/logs/rls_basic.log

psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -f ../07-cutover/rls-tests-extended.sql \
  2>&1 | tee ../07-cutover/reports/logs/rls_extended.log
```

Las pruebas usan JWT de rol real (no service_role). Ver
`migration/07-cutover/rls-matrix.md` para la matriz exhaustiva.

---

## 14. Pruebas funcionales E2E (frontend staging)

En rama `chore/staging-cutover-dryrun` (ver §16), con `.env.staging` apuntando
al proyecto staging:

```bash
# LOCAL — desde el checkout del frontend
git checkout chore/staging-cutover-dryrun
cp .env.staging.template .env.staging
# Editar .env.staging con VITE_SUPABASE_URL del staging
bun install
bun run build   # debe compilar
bun run dev
```

Ejecutar la lista de escenarios en `07-cutover/dry-run-plan.md`
(Auth, autorización, storage, edge functions, webhooks, auditoría,
realtime, pagos test) y llenar los reportes en
`migration/07-cutover/reports/`.

---

## 15. Conciliación

```bash
# RUN — guards on
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -f ../07-cutover/verification-suite.sql \
  > ../07-cutover/reports/logs/verification_suite.txt

# Storage
bash ../04-storage-migration/reconcile.sh \
  > ../07-cutover/reports/logs/storage_reconcile.txt
```

Comparar con contrapartes en Cloud actual **usando SOLO lecturas**:
- Conteos de `auth.users`, `public.transactions`, etc.
- Tamaño total de storage por bucket.
- Nunca ejecutar `pg_dump`/`INSERT`/`UPDATE`/`DELETE` sobre Cloud.

---

## 16. Etapa D — Rename final (SOLO en staging para probar el procedimiento)

Ejecutar **solamente** tras conciliación satisfactoria y confirmación explícita:

```bash
# RUN — guards on
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -f ../02-role-model-migration/15_finalize_role_rename.sql \
  2>&1 | tee ../07-cutover/reports/logs/stage_d_rename.log
```

En staging esto valida el procedimiento. **NUNCA en producción hasta Fase 1
autorizada.**

---

## 17. Rollback (probar en staging)

Simular en staging una condición de rollback:

```bash
# RUN — guards on
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -f ../07-cutover/rollback-drill.sql \
  2>&1 | tee ../07-cutover/reports/logs/rollback.log
```

Verifica:

- Tablas `*_legacy_YYYYMMDD` restauradas al nombre canónico.
- Enums renombrados al canónico.
- Policies vuelven a apuntar a estructuras originales.
- Aplicación (rama `main`) sigue funcionando contra el esquema restaurado.

Registrar el resultado en `reports/rollback-test-report.md`.

---

## 18. Recolección de resultados

Después de cada bloque `# RUN`, guardar el output completo en
`migration/07-cutover/reports/logs/` con timestamp UTC.

Al finalizar el dry run, completar cada reporte de
`migration/07-cutover/reports/` con estados:

- `PASS`
- `PASS WITH OBSERVATIONS`
- `FAIL`
- `BLOCKER`
- `NOT TESTED`

Consolidar en `phase-1-readiness-report.md` la decisión GO / NO-GO.

---

## Reglas absolutas

- Cero comandos contra `diqdpygummlrajsugotv` durante toda la Fase 0.
- Cero valores productivos en el runbook, en `.env.staging`, en fixtures
  ni en reportes.
- Cero `service_role` compartida con el proyecto Lovable actual.
- Rama frontend staging no se mergea a `main` ni se publica.
- Sin datos reales de usuarios, ID oficiales, biometría, e.firma,
  CLABE, RFC, CURP o tokens.
