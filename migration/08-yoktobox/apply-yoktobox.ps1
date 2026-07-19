# =============================================================================
# apply-yoktobox.ps1 — Migración definitiva a Supabase externo `yoktobox`
# =============================================================================
# EJECUCIÓN: operador externo, desde estación DevOps controlada (Windows PS 7+).
# NO ejecutar desde Lovable. NO ejecutar contra `diqdpygummlrajsugotv`.
#
# Uso (PowerShell 7+):
#   $env:SUPABASE_PROJECT_REF = "<ref-de-yoktobox>"
#   $env:SUPABASE_DB_URL      = "postgresql://postgres.<ref>:<password>@<host>:5432/postgres"
#   $env:SUPABASE_ACCESS_TOKEN = "<personal-access-token>"
#   $env:CONFIRM_TARGET       = "yoktobox"
#   ./apply-yoktobox.ps1
# =============================================================================
$ErrorActionPreference = "Stop"

$ForbiddenRef  = "diqdpygummlrajsugotv"
$ExpectedName  = "yoktobox"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $RepoRoot

function Log  ($msg) { Write-Host "`n[apply-yoktobox] $msg" -ForegroundColor Cyan }
function Fail ($msg) { Write-Host "`n[ABORT] $msg" -ForegroundColor Red; exit 1 }

# ---------- Guards ----------------------------------------------------------
Log "Guard 1/4 — variables presentes"
foreach ($v in @("SUPABASE_PROJECT_REF","SUPABASE_DB_URL","SUPABASE_ACCESS_TOKEN","CONFIRM_TARGET")) {
    if (-not (Get-Item -Path "Env:$v" -ErrorAction SilentlyContinue)) { Fail "$v no definido" }
}

Log "Guard 2/4 — ref no es el proyecto Lovable Cloud prohibido"
if ($env:SUPABASE_PROJECT_REF -eq $ForbiddenRef) {
    Fail "SUPABASE_PROJECT_REF es '$ForbiddenRef' (Lovable Cloud). Prohibido."
}

Log "Guard 3/4 — confirmación explícita del target"
if ($env:CONFIRM_TARGET -ne $ExpectedName) {
    Fail "CONFIRM_TARGET debe ser '$ExpectedName'. Recibido: '$($env:CONFIRM_TARGET)'."
}

Log "Guard 4/4 — DB URL no apunta al ref prohibido"
if ($env:SUPABASE_DB_URL -like "*$ForbiddenRef*") {
    Fail "SUPABASE_DB_URL contiene '$ForbiddenRef'. Prohibido."
}

Write-Host ""
Write-Host "  Project Ref  : $($env:SUPABASE_PROJECT_REF)"
Write-Host "  Target Name  : $($env:CONFIRM_TARGET)"
Write-Host ""
$ack = Read-Host "¿Continuar aplicando la migración sobre '$ExpectedName'? (escribe YES)"
if ($ack -ne "YES") { Fail "Cancelado por el operador." }

# ---------- Preflight -------------------------------------------------------
Log "Preflight — supabase link"
supabase link --project-ref $env:SUPABASE_PROJECT_REF
if ($LASTEXITCODE -ne 0) { Fail "supabase link falló" }

Log "Preflight — psql SELECT now()"
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user, now();"
if ($LASTEXITCODE -ne 0) { Fail "psql preflight falló" }

# ---------- SQL en orden ----------------------------------------------------
$SqlFiles = @(
  "migration/01-schema/00_extensions.sql",
  "migration/01-schema/01_enums.sql",
  "migration/02-role-model-migration/10_new_role_enums.sql",
  "migration/01-schema/02_tables.sql",
  "migration/02-role-model-migration/11_new_role_tables.sql",
  "migration/01-schema/09_foreign_keys.sql",
  "migration/01-schema/10_constraints.sql",
  "migration/01-schema/05_indexes.sql",
  "migration/01-schema/03_functions.sql",
  "migration/02-role-model-migration/12_authz_functions.sql",
  "migration/01-schema/04_triggers.sql",
  "migration/01-schema/07_grants.sql",
  "migration/01-schema/06_rls_policies.sql",
  "migration/02-role-model-migration/14_new_rls_policies.sql",
  "migration/01-schema/08_storage_buckets_and_policies.sql"
)

foreach ($f in $SqlFiles) {
    if (-not (Test-Path $f)) { Fail "Archivo SQL faltante: $f" }
    Log "Aplicando $f"
    psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f $f
    if ($LASTEXITCODE -ne 0) { Fail "Falló la aplicación de $f" }
}

# ---------- Edge Functions --------------------------------------------------
Log "Desplegando Edge Function: ai-gateway"
supabase functions deploy ai-gateway --project-ref $env:SUPABASE_PROJECT_REF
if ($LASTEXITCODE -ne 0) { Fail "Deploy de ai-gateway falló" }

# ---------- Tipos TypeScript ------------------------------------------------
Log "Comando para generar types TypeScript (ejecútalo en el fork frontend externo)"
Write-Host "  supabase gen types typescript --project-id $($env:SUPABASE_PROJECT_REF) --schema public"
Write-Host "    > src/integrations/supabase/types.ts"

# ---------- Validaciones ----------------------------------------------------
Log "Ejecutando verification-suite"
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f migration/07-cutover/verification-suite.sql

Log "Ejecutando rls-tests (no bloqueante)"
psql $env:SUPABASE_DB_URL -f migration/07-cutover/rls-tests.sql
psql $env:SUPABASE_DB_URL -f migration/07-cutover/rls-tests-extended.sql

Log "OK — Migración base aplicada sobre '$ExpectedName'."
Write-Host ""
Write-Host "PRÓXIMOS PASOS MANUALES (ver runbook-yoktobox.md):"
Write-Host "  1. Cargar secretos: supabase secrets set --project-ref $($env:SUPABASE_PROJECT_REF) ..."
Write-Host "  2. Configurar Auth/OAuth/SMTP en Dashboard de Supabase (yoktobox)."
Write-Host "  3. Regenerar types.ts en el fork frontend."
Write-Host "  4. Configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en hosting."
Write-Host "  5. Completar reportes en migration/07-cutover/reports/."
Write-Host "  6. Solo tras validar: aplicar 15_finalize_role_rename.sql (IRREVERSIBLE)."
