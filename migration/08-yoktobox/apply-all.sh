#!/usr/bin/env bash
# =============================================================================
# apply-all.sh — Orquestador idempotente para migración completa a `yoktobox`
# =============================================================================
# EJECUCIÓN: operador externo, estación DevOps controlada.
# NO ejecutar desde Lovable. NO ejecutar contra `diqdpygummlrajsugotv`.
#
# Idempotente: cada etapa se marca en state/apply-all.state y no se repite
# a menos que se pase --force-stage <n> o --from-stage <n>.
#
# Rollback por etapas: --rollback-stage <n> revierte SOLO esa etapa donde es
# seguro hacerlo. Etapas irreversibles (finalize_role_rename) requieren
# --i-understand-irreversible para ejecutarse y NO tienen rollback automático.
#
# Uso:
#   export SUPABASE_PROJECT_REF="<ref-yoktobox>"
#   export SUPABASE_DB_URL="postgresql://..."
#   export SUPABASE_ACCESS_TOKEN="<pat>"
#   export CONFIRM_TARGET="yoktobox"
#   ./apply-all.sh                       # ejecuta todas las etapas pendientes
#   ./apply-all.sh --from-stage 5        # reanuda desde la etapa 5
#   ./apply-all.sh --only-stage 8        # ejecuta solo la etapa 8
#   ./apply-all.sh --status              # imprime estado de cada etapa
#   ./apply-all.sh --rollback-stage 15   # rollback (donde sea seguro)
# =============================================================================
set -euo pipefail

FORBIDDEN_REF="diqdpygummlrajsugotv"
EXPECTED_NAME="yoktobox"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

STATE_DIR="migration/08-yoktobox/state"
STATE_FILE="$STATE_DIR/apply-all.state"
LOG_DIR="$STATE_DIR/logs"
REPORTS_DIR="migration/07-cutover/reports"
mkdir -p "$STATE_DIR" "$LOG_DIR"
touch "$STATE_FILE"

log()  { printf "\n\033[1;36m[apply-all]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[warn]\033[0m %s\n" "$*"; }
fail() { printf "\n\033[1;31m[ABORT]\033[0m %s\n" "$*" >&2; exit 1; }

# ---------- Guards de entorno -----------------------------------------------
guard_env() {
  : "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF no definido}"
  : "${SUPABASE_DB_URL:?SUPABASE_DB_URL no definido}"
  : "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN no definido}"
  : "${CONFIRM_TARGET:?CONFIRM_TARGET no definido (debe ser 'yoktobox')}"
  [[ "$SUPABASE_PROJECT_REF" != "$FORBIDDEN_REF" ]] || fail "SUPABASE_PROJECT_REF es '$FORBIDDEN_REF'. Prohibido."
  [[ "$CONFIRM_TARGET" == "$EXPECTED_NAME" ]] || fail "CONFIRM_TARGET debe ser '$EXPECTED_NAME'."
  [[ "$SUPABASE_DB_URL" != *"$FORBIDDEN_REF"* ]] || fail "SUPABASE_DB_URL contiene '$FORBIDDEN_REF'."
}

# ---------- Definición de etapas --------------------------------------------
# stage_id | descripción | tipo | archivo | postcondición SQL/CMD
STAGES=(
  "01|extensiones|sql|migration/01-schema/00_extensions.sql|SELECT count(*)=5 FROM pg_extension WHERE extname IN ('pgcrypto','uuid-ossp','pg_cron','pg_net','vault')"
  "02|enums-base|sql|migration/01-schema/01_enums.sql|SELECT count(*)>0 FROM pg_type WHERE typtype='e' AND typnamespace='public'::regnamespace"
  "03|enums-oficiales|sql|migration/02-role-model-migration/10_new_role_enums.sql|SELECT count(*)=3 FROM pg_type WHERE typname IN ('app_role_v2','org_role_v2','internal_role_v2')"
  "04|tablas-base|sql|migration/01-schema/02_tables.sql|SELECT count(*)>=45 FROM pg_tables WHERE schemaname='public'"
  "05|tablas-roles|sql|migration/02-role-model-migration/11_new_role_tables.sql|SELECT count(*)>=2 FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'memberships_v2%' OR tablename LIKE 'internal_role_assignments%')"
  "06|foreign-keys|sql|migration/01-schema/09_foreign_keys.sql|SELECT count(*)>0 FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public'"
  "07|constraints|sql|migration/01-schema/10_constraints.sql|SELECT count(*)>0 FROM information_schema.table_constraints WHERE constraint_type='CHECK' AND table_schema='public'"
  "08|indices|sql|migration/01-schema/05_indexes.sql|SELECT count(*)>10 FROM pg_indexes WHERE schemaname='public'"
  "09|funciones|sql|migration/01-schema/03_functions.sql|SELECT count(*)>0 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'"
  "10|authz-funcs|sql|migration/02-role-model-migration/12_authz_functions.sql|SELECT count(*)>=4 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('has_role','has_org_role','is_org_member','has_platform_role','get_active_internal_role')"
  "11|triggers|sql|migration/01-schema/04_triggers.sql|SELECT count(*)>0 FROM information_schema.triggers WHERE trigger_schema='public'"
  "12|grants|sql|migration/01-schema/07_grants.sql|SELECT count(*)>0 FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role')"
  "13|rls-legacy|sql|migration/01-schema/06_rls_policies.sql|SELECT count(*)>0 FROM pg_policies WHERE schemaname='public'"
  "14|rls-oficial|sql|migration/02-role-model-migration/14_new_rls_policies.sql|SELECT count(*)>10 FROM pg_policies WHERE schemaname='public'"
  "15|storage-buckets|sql|migration/01-schema/08_storage_buckets_and_policies.sql|SELECT count(*)=6 FROM storage.buckets WHERE id IN ('kyc-documents','dispute-evidence','verification-evidence','biometric-captures','transaction-documents','support-attachments')"
  "16|edge-ai-gateway|cmd|supabase functions deploy ai-gateway --project-ref \$SUPABASE_PROJECT_REF|"
  "17|verification-suite|sql|migration/07-cutover/verification-suite.sql|SELECT 1"
  "18|rls-tests|sql|migration/07-cutover/rls-tests.sql|SELECT 1"
  "19|rls-tests-extended|sql|migration/07-cutover/rls-tests-extended.sql|SELECT 1"
)

IRREVERSIBLE_STAGES=("99")  # finalize_role_rename opt-in aparte

# ---------- Helpers de estado -----------------------------------------------
stage_status() {  # $1=id → PASS|NOT_TESTED|FAILED
  local id="$1"
  grep -E "^${id}\|" "$STATE_FILE" 2>/dev/null | tail -n1 | awk -F'|' '{print $2}' || echo "NOT_TESTED"
}

mark_stage() {  # $1=id $2=status $3=timestamp
  local id="$1" st="$2" ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  grep -vE "^${id}\|" "$STATE_FILE" > "$STATE_FILE.tmp" 2>/dev/null || true
  mv "$STATE_FILE.tmp" "$STATE_FILE"
  echo "${id}|${st}|${ts}|ref=${SUPABASE_PROJECT_REF}" >> "$STATE_FILE"
}

print_status() {
  echo
  printf "%-4s  %-24s  %-10s  %s\n" "ID" "DESCRIPCIÓN" "ESTADO" "TIMESTAMP"
  printf "%-4s  %-24s  %-10s  %s\n" "----" "------------------------" "----------" "--------------------"
  for row in "${STAGES[@]}"; do
    IFS='|' read -r id desc _typ _src _post <<<"$row"
    local line status ts
    line="$(grep -E "^${id}\|" "$STATE_FILE" 2>/dev/null | tail -n1 || true)"
    status="$(echo "$line" | awk -F'|' '{print $2}')"
    ts="$(echo "$line" | awk -F'|' '{print $3}')"
    [[ -z "$status" ]] && status="NOT_TESTED"
    [[ -z "$ts" ]] && ts="-"
    printf "%-4s  %-24s  %-10s  %s\n" "$id" "$desc" "$status" "$ts"
  done
  echo
}

# ---------- Ejecución de una etapa ------------------------------------------
run_stage() {
  local row="$1"
  IFS='|' read -r id desc typ src post <<<"$row"
  local logf="$LOG_DIR/stage-${id}.log"

  log "Etapa $id · $desc"
  case "$typ" in
    sql)
      [[ -f "$src" ]] || { mark_stage "$id" "FAILED"; fail "SQL faltante: $src"; }
      if psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$src" > "$logf" 2>&1; then
        :
      else
        mark_stage "$id" "FAILED"
        fail "Falló SQL de etapa $id. Ver $logf"
      fi
      ;;
    cmd)
      local cmd="${src//\$SUPABASE_PROJECT_REF/$SUPABASE_PROJECT_REF}"
      if bash -c "$cmd" > "$logf" 2>&1; then
        :
      else
        mark_stage "$id" "FAILED"
        fail "Falló CMD de etapa $id. Ver $logf"
      fi
      ;;
  esac

  # Postcondición
  if [[ -n "$post" && "$post" != "SELECT 1" ]]; then
    local check
    check="$(psql "$SUPABASE_DB_URL" -tA -c "SELECT ($post)::text;" 2>&1 || echo "postcheck-error")"
    if [[ "$check" != "t" && "$check" != "true" ]]; then
      mark_stage "$id" "FAILED"
      fail "Postcondición etapa $id falló: $post → $check"
    fi
  fi

  mark_stage "$id" "PASS"
  log "Etapa $id · PASS"
}

# ---------- Rollback --------------------------------------------------------
rollback_stage() {
  local id="$1"
  case "$id" in
    15) # storage buckets — inseguro dropear si tienen objetos
        warn "Rollback etapa 15 (buckets): revisa manualmente storage.objects antes de dropear."
        ;;
    13|14) # RLS policies
        warn "Rollback RLS: usar DROP POLICY manual sobre las policies creadas. Ver logs."
        ;;
    *)
        warn "No hay rollback automático seguro para la etapa $id. Restaurar desde backup PITR si es necesario."
        ;;
  esac
  mark_stage "$id" "ROLLED_BACK"
}

# ---------- Generación de reportes ------------------------------------------
generate_reports() {
  local ts; ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local summary="$REPORTS_DIR/apply-all-summary.md"
  {
    echo "# Reporte apply-all — yoktobox"
    echo
    echo "- Timestamp UTC: $ts"
    echo "- Project Ref: **[SANITIZED]**"
    echo "- Target: $EXPECTED_NAME"
    echo
    echo "## Estado por etapa"
    echo
    echo "| ID | Etapa | Estado | Timestamp |"
    echo "|---|---|---|---|"
    for row in "${STAGES[@]}"; do
      IFS='|' read -r id desc _t _s _p <<<"$row"
      local line status tstamp
      line="$(grep -E "^${id}\|" "$STATE_FILE" 2>/dev/null | tail -n1 || true)"
      status="$(echo "$line" | awk -F'|' '{print $2}')"
      tstamp="$(echo "$line" | awk -F'|' '{print $3}')"
      [[ -z "$status" ]] && status="NOT_TESTED"
      [[ -z "$tstamp" ]] && tstamp="-"
      echo "| $id | $desc | $status | $tstamp |"
    done
    echo
    echo "## Notas"
    echo
    echo "- Etapas con estado \`NOT_TESTED\` no se ejecutaron en esta corrida."
    echo "- Etapas con estado \`FAILED\` requieren investigación antes de reanudar."
    echo "- Ref del proyecto está sanitizado en este reporte."
  } > "$summary"
  log "Reporte generado: $summary"
}

# ---------- CLI -------------------------------------------------------------
FROM_STAGE=""
ONLY_STAGE=""
ROLLBACK_STAGE=""
STATUS_ONLY=false
ALLOW_IRREVERSIBLE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-stage) FROM_STAGE="$2"; shift 2 ;;
    --only-stage) ONLY_STAGE="$2"; shift 2 ;;
    --rollback-stage) ROLLBACK_STAGE="$2"; shift 2 ;;
    --status) STATUS_ONLY=true; shift ;;
    --i-understand-irreversible) ALLOW_IRREVERSIBLE=true; shift ;;
    -h|--help) sed -n '1,40p' "$0"; exit 0 ;;
    *) fail "Flag desconocido: $1" ;;
  esac
done

if $STATUS_ONLY; then
  print_status
  exit 0
fi

guard_env

if [[ -n "$ROLLBACK_STAGE" ]]; then
  rollback_stage "$ROLLBACK_STAGE"
  generate_reports
  exit 0
fi

# Confirmación una sola vez
echo
echo "  Project Ref  : $SUPABASE_PROJECT_REF"
echo "  Target Name  : $CONFIRM_TARGET"
echo
read -rp "¿Continuar apply-all sobre '$EXPECTED_NAME'? (YES): " ACK
[[ "$ACK" == "YES" ]] || fail "Cancelado por operador."

# Ejecutar etapas
for row in "${STAGES[@]}"; do
  IFS='|' read -r id _d _t _s _p <<<"$row"
  if [[ -n "$ONLY_STAGE" && "$id" != "$ONLY_STAGE" ]]; then continue; fi
  if [[ -n "$FROM_STAGE" && "$id" < "$FROM_STAGE" ]]; then continue; fi

  local_status="$(stage_status "$id")"
  if [[ "$local_status" == "PASS" && -z "$ONLY_STAGE" ]]; then
    log "Etapa $id ya en PASS — skip (idempotente)"
    continue
  fi
  run_stage "$row"
done

generate_reports
print_status
log "apply-all finalizado."
