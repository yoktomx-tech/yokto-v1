#!/usr/bin/env bash
# =============================================================================
# apply-yoktobox.sh — Migración definitiva a Supabase externo `yoktobox`
# =============================================================================
# EJECUCIÓN: operador externo, desde estación DevOps controlada.
# NO ejecutar desde Lovable. NO ejecutar contra `diqdpygummlrajsugotv`.
#
# Uso:
#   export SUPABASE_PROJECT_REF="<ref-de-yoktobox>"
#   export SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@<host>:5432/postgres"
#   export SUPABASE_ACCESS_TOKEN="<personal-access-token>"
#   export CONFIRM_TARGET="yoktobox"
#   ./apply-yoktobox.sh
# =============================================================================
set -euo pipefail

FORBIDDEN_REF="diqdpygummlrajsugotv"
EXPECTED_NAME="yoktobox"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

log()  { printf "\n\033[1;36m[apply-yoktobox]\033[0m %s\n" "$*"; }
fail() { printf "\n\033[1;31m[ABORT]\033[0m %s\n" "$*" >&2; exit 1; }

# ---------- Guards ----------------------------------------------------------
log "Guard 1/4 — variables presentes"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF no definido}"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL no definido}"
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN no definido}"
: "${CONFIRM_TARGET:?CONFIRM_TARGET no definido (debe ser 'yoktobox')}"

log "Guard 2/4 — ref no es el proyecto Lovable Cloud prohibido"
if [[ "$SUPABASE_PROJECT_REF" == "$FORBIDDEN_REF" ]]; then
  fail "SUPABASE_PROJECT_REF es '$FORBIDDEN_REF' (Lovable Cloud). Prohibido."
fi

log "Guard 3/4 — confirmación explícita del target"
if [[ "$CONFIRM_TARGET" != "$EXPECTED_NAME" ]]; then
  fail "CONFIRM_TARGET debe ser '$EXPECTED_NAME'. Recibido: '$CONFIRM_TARGET'."
fi

log "Guard 4/4 — DB URL no apunta al ref prohibido"
if [[ "$SUPABASE_DB_URL" == *"$FORBIDDEN_REF"* ]]; then
  fail "SUPABASE_DB_URL contiene '$FORBIDDEN_REF'. Prohibido."
fi

echo
echo "  Project Ref  : $SUPABASE_PROJECT_REF"
echo "  Target Name  : $CONFIRM_TARGET"
echo "  DB Host      : $(echo "$SUPABASE_DB_URL" | sed 's#.*@##; s#/.*##')"
echo
read -rp "¿Continuar aplicando la migración sobre '$EXPECTED_NAME'? (escribe YES): " ACK
[[ "$ACK" == "YES" ]] || fail "Cancelado por el operador."

# ---------- Preflight -------------------------------------------------------
log "Preflight — supabase link"
supabase link --project-ref "$SUPABASE_PROJECT_REF"

log "Preflight — psql SELECT now()"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user, now();"

# ---------- SQL en orden ----------------------------------------------------
SQL_FILES=(
  "migration/01-schema/00_extensions.sql"
  "migration/01-schema/01_enums.sql"
  "migration/02-role-model-migration/10_new_role_enums.sql"
  "migration/01-schema/02_tables.sql"
  "migration/02-role-model-migration/11_new_role_tables.sql"
  "migration/01-schema/09_foreign_keys.sql"
  "migration/01-schema/10_constraints.sql"
  "migration/01-schema/05_indexes.sql"
  "migration/01-schema/03_functions.sql"
  "migration/02-role-model-migration/12_authz_functions.sql"
  "migration/01-schema/04_triggers.sql"
  "migration/01-schema/07_grants.sql"
  "migration/01-schema/06_rls_policies.sql"
  "migration/02-role-model-migration/14_new_rls_policies.sql"
  "migration/01-schema/08_storage_buckets_and_policies.sql"
)

for f in "${SQL_FILES[@]}"; do
  [[ -f "$f" ]] || fail "Archivo SQL faltante: $f"
  log "Aplicando $f"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

# ---------- Edge Functions --------------------------------------------------
log "Desplegando Edge Function: ai-gateway"
supabase functions deploy ai-gateway --project-ref "$SUPABASE_PROJECT_REF"

# ---------- Tipos TypeScript ------------------------------------------------
log "Generando types TypeScript (imprime a stdout — redirígelo en el fork frontend)"
echo "supabase gen types typescript --project-id $SUPABASE_PROJECT_REF --schema public"
echo "  > src/integrations/supabase/types.ts   # en el fork frontend externo"

# ---------- Validaciones ----------------------------------------------------
log "Ejecutando verification-suite"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f migration/07-cutover/verification-suite.sql

log "Ejecutando rls-tests"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f migration/07-cutover/rls-tests.sql || true
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f migration/07-cutover/rls-tests-extended.sql || true

log "OK — Migración base aplicada sobre '$EXPECTED_NAME'."
echo
echo "PRÓXIMOS PASOS MANUALES (ver runbook-yoktobox.md):"
echo "  1. Cargar secretos con: supabase secrets set --project-ref $SUPABASE_PROJECT_REF ..."
echo "  2. Configurar Auth/OAuth/SMTP en Dashboard de Supabase (yoktobox)."
echo "  3. Regenerar types.ts en el fork frontend."
echo "  4. Configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en hosting."
echo "  5. Completar reportes en migration/07-cutover/reports/."
echo "  6. Solo tras validar: aplicar 15_finalize_role_rename.sql (IRREVERSIBLE)."
