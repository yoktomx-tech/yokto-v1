# Reportes automáticos — apply-all y verificación

`apply-all.sh` genera automáticamente reportes **sanitizados** de cada
etapa. El operador puede subirlos al repo sin filtrar credenciales.

## Reglas de sanitización

Todo reporte generado automáticamente por `apply-all.sh` o los scripts de
verificación cumple:

- ❌ Nunca imprimir `SUPABASE_PROJECT_REF` en claro — se sustituye por `[SANITIZED]`.
- ❌ Nunca imprimir `SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`.
- ❌ Nunca incluir valores de secretos (`AI_PROVIDER_API_KEY`, `NUBARIUM_*`, etc.).
- ✅ Sí incluir: timestamps UTC, IDs de etapa, descripción, estado (`PASS`/`FAILED`/`NOT_TESTED`/`ROLLED_BACK`), y postcondiciones (queries genéricas sin datos).
- ✅ El nombre lógico `yoktobox` sí puede aparecer (no es secreto).

## Estados válidos por etapa

| Estado | Cuándo se asigna |
|---|---|
| `PASS` | La etapa se ejecutó y su postcondición devolvió `true`. |
| `FAILED` | La etapa se ejecutó pero SQL/CMD o la postcondición fallaron. |
| `NOT_TESTED` | La etapa nunca se corrió en el estado actual. **Default**. |
| `ROLLED_BACK` | Se ejecutó `--rollback-stage <n>`. |

**Regla dura:** ninguna etapa puede marcarse `PASS` sin evidencia de
postcondición cumplida. Los scripts fuerzan esto — no editar manualmente
`state/apply-all.state` para forzar un PASS.

## Postcondiciones por etapa (resumen)

| Etapa | Postcondición |
|---|---|
| 01 extensiones | 5 extensiones instaladas |
| 02 enums base | ≥1 enum en `public` |
| 03 enums oficiales | 3 enums v2 presentes |
| 04 tablas base | ≥45 tablas en `public` |
| 05 tablas roles | Tablas v2 presentes |
| 06 FKs | ≥1 FK en `public` |
| 07 constraints | ≥1 CHECK en `public` |
| 08 índices | >10 índices en `public` |
| 09 funciones | ≥1 función en `public` |
| 10 authz funcs | ≥4 funciones authz clave |
| 11 triggers | ≥1 trigger en `public` |
| 12 grants | ≥1 grant a anon/authenticated/service_role |
| 13 RLS legacy | ≥1 policy en `public` |
| 14 RLS oficial | >10 policies en `public` |
| 15 storage buckets | 6 buckets esperados presentes |
| 16 edge ai-gateway | Deploy exitoso (exit code CLI) |
| 17 verification-suite | SQL corre sin error |
| 18 rls-tests | SQL corre |
| 19 rls-tests-extended | SQL corre |

## Reportes generados

- `migration/07-cutover/reports/apply-all-summary.md` — tabla resumen por
  etapa. Se regenera en cada corrida.
- `migration/08-yoktobox/state/apply-all.state` — estado interno (una línea
  por etapa: `id|status|ts|ref=…`). Persistente entre corridas.
- `migration/08-yoktobox/state/logs/stage-<id>.log` — output crudo por etapa.

## Plantillas manuales por completar

Los siguientes reportes requieren juicio humano y se llenan a mano tras la
ejecución (plantillas ya presentes en `migration/07-cutover/reports/`):

- `auth-reconciliation-report.md` — configuración de Auth en Dashboard.
- `webhook-test-report.md` — Stripe, Verificamex, dispute-deadlines, support-sla.
- `payments-test-report.md` — sandbox Stripe end-to-end.
- `frontend-portable-test-report.md` — signup, login, RLS, OAuth desde hosting.
- `rollback-test-report.md` — ejercicio de rollback drill.
- `phase-1-readiness-report.md` — gate final antes de cutover productivo.
- `backend-verification-report.md` — comprobaciones de sección 8 de `backend-verification.md`.

Cada plantilla debe marcarse con uno de los estados válidos, con timestamp
UTC y evidencia mínima (query result count, screenshot ID, log line).

## Post-condición por entorno

`apply-all.sh` corre postcondiciones contra `SUPABASE_DB_URL` — es decir,
contra el proyecto realmente enlazado. Si el operador enlaza por error el
proyecto equivocado, los guards abortan **antes** de aplicar cualquier SQL:

- Guard 1: variables presentes.
- Guard 2: `SUPABASE_PROJECT_REF != diqdpygummlrajsugotv`.
- Guard 3: `CONFIRM_TARGET == yoktobox`.
- Guard 4: `SUPABASE_DB_URL` no contiene el ref prohibido.
- Confirmación interactiva `YES`.

Los reportes generados incluyen el hash SHA-256 del ref (no el ref) como
correlator entre corridas sin filtrarlo.
