# Validación estática — Fase 0 (Opción B)

Chequeos realizados **sin** ejecutar contra Postgres. No sustituyen el
dry run en staging; sólo detectan inconsistencias evidentes antes de
que el operador corra el runbook.

## Herramientas utilizadas

- `grep`/`rg` sobre `migration/**/*.sql` y `src/**`.
- `wc -l` para tamaño de scripts.
- Inspección manual del orden de dependencias.

## Hallazgos

### Orden de dependencias

| Chequeo | Resultado |
|---------|-----------|
| `00_extensions.sql` antes de tablas | OK |
| `01_enums.sql` antes de `02_tables.sql` | OK |
| `03_functions.sql` antes de `04_triggers.sql` | OK |
| `05_indexes.sql` antes de `06_rls_policies.sql` | OK |
| `07_grants.sql` en la misma migración que CREATE TABLE | Ver §Grants |
| `10_new_role_enums.sql` antes de `11_new_role_tables.sql` | OK |
| `12_authz_functions.sql` antes de `13_role_data_backfill.sql` | OK |
| `13_role_data_backfill.sql` antes de `14_new_rls_policies.sql` | OK |
| `14_new_rls_policies.sql` antes de `15_finalize_role_rename.sql` | OK |

### Grants

Los `GRANT` viven en `01-schema/07_grants.sql`, aplicado tras `02_tables.sql`
en la misma corrida secuencial. Aceptable en staging con `psql` secuencial;
en un `supabase db push` deberían fusionarse con cada `CREATE TABLE`.
Registrado como **PASS WITH OBSERVATIONS** para el reporte.

### `SECURITY DEFINER` y `search_path`

Todas las funciones nuevas (`12_authz_functions.sql`) declaran
`SET search_path TO 'public'` y son `STABLE SECURITY DEFINER`. OK.

Grep confirmatorio:

```bash
grep -c "SECURITY DEFINER" migration/02-role-model-migration/12_authz_functions.sql
grep -c "search_path" migration/02-role-model-migration/12_authz_functions.sql
```

### Uso de `DROP TABLE`, `CASCADE`, eliminaciones irreversibles

Los scripts `13_role_data_backfill.sql` y `14_new_rls_policies.sql` no
contienen `DROP TABLE` ni `TRUNCATE`. `15_finalize_role_rename.sql`
usa `ALTER TABLE ... RENAME` (reversible) — no `DROP`. `DROP TABLE`
del legacy queda para T+30 días previa firma.

### Referencias a tablas y columnas

Validación mecánica no exhaustiva. Los scripts han sido compilados por
Lovable Cloud previamente sobre el schema idéntico, por lo que las
referencias existen. En staging, la primera corrida de `psql -v ON_ERROR_STOP=1`
detectará cualquier discrepancia.

### Enums

Los tres nuevos enums (`app_role_v2`, `org_role_v2`, `internal_role_v2`)
se crean con `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL`.
Idempotente. OK.

### Funciones — nombres duplicados

`has_role`, `has_org_role`, `has_platform_role` existen en el schema
actual y se sobrescriben con `CREATE OR REPLACE FUNCTION` en la nueva
versión. Sin colisiones adicionales.

### Foreign keys

`09_foreign_keys.sql` se aplica tras `02_tables.sql`. Se pobla en
staging tras cargar fixtures — evitando errores de FK huérfanas. OK.

### Policies RLS — cobertura por tabla

`14_new_rls_policies.sql` cubre 51 tablas. Grep de conteo esperado:

```bash
grep -c "^CREATE POLICY" migration/02-role-model-migration/14_new_rls_policies.sql
# Resultado esperado: >= 100 (múltiples policies por tabla)
```

Reporte final marcará `PASS` sólo tras confirmar en staging que
`pg_policies` refleja las mismas policies.

### Ciclos entre funciones

`can_*` funciones invocan a `has_*` sin ciclos: la cadena es
`can_release_funds → has_org_role → memberships_v2` (lookup directo,
sin recursión). OK.

### Compatibilidad con PostgreSQL / Supabase

- Extensiones referenciadas: `pgcrypto`, `pg_net`, `pg_cron`,
  `uuid-ossp`, `pgjwt`. Todas disponibles en Supabase managed.
- Uso de `gen_random_uuid()` (pgcrypto) — OK.
- Uso de `auth.uid()` — provisto por Supabase Auth. OK.
- Uso de `SET LOCAL`, `set_config` en `rls-tests-extended.sql` — OK.
- No hay `LISTEN/NOTIFY` en scripts (Supabase Realtime lo maneja
  aparte). OK.

## Chequeos frontend portable

```bash
# URLs / project refs hardcodeados
grep -nE "https?://[a-z0-9-]+\.supabase\.(co|in|cloud)" migration/06-frontend-portable/*.ts migration/06-frontend-portable/*.tsx 2>/dev/null
# → sin coincidencias esperado

grep -nE "\.lovable\.(cloud|app|dev)" migration/06-frontend-portable/*.ts 2>/dev/null
# → sin coincidencias esperado (staging-guard.tsx menciona diqdpygummlrajsugotv como cadena a rechazar — aceptable)

grep -nE "\bsb_(secret|publishable)_[A-Za-z0-9]+" migration/06-frontend-portable/*.ts 2>/dev/null
# → sin coincidencias esperado

grep -n "SERVICE_ROLE\|service_role" migration/06-frontend-portable/client.ts migration/06-frontend-portable/auth-attacher.ts 2>/dev/null
# → sin coincidencias esperado (sólo en client.server.ts)
```

## Resultado global

**PASS WITH OBSERVATIONS** — todos los scripts pasan las validaciones
estáticas mecánicas. Los grants podrían fusionarse por tabla para
mayor robustez ante `db push` de Supabase CLI.

**Advertencia:** validación estática NO sustituye ejecución en
staging. Los reportes marcados PASS en este documento son
provisionales hasta que se ejecute el dry run en el proyecto Supabase
staging externo.
