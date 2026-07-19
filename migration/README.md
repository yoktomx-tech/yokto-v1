# YOKTO — Migración a Supabase externo (Ruta A)

**Objetivo**: mover el backend completo (BD, Auth, Storage, funciones) de Lovable Cloud a un proyecto Supabase gestionado directamente en la cuenta del cliente. **Lovable sigue siendo el IDE** para el frontend; sólo cambia el backend al que apunta.

## Estructura de entregables

```
migration/
├── 00-inventory/                  ← Estado actual documentado
│   ├── schema-inventory.md
│   ├── storage-inventory.md
│   ├── edge-functions-inventory.md
│   ├── secrets-inventory.md
│   └── lovable-cloud-dependencies.md
│
├── 01-schema/                     ← DDL del proyecto actual (portable)
│   ├── 00_extensions.sql
│   ├── 01_enums.sql
│   ├── 02_tables.sql
│   ├── 03_functions.sql
│   ├── 04_triggers.sql
│   ├── 05_indexes.sql
│   ├── 06_rls_policies.sql
│   ├── 07_grants.sql
│   ├── 08_storage_buckets_and_policies.sql
│   ├── 09_foreign_keys.sql
│   └── 10_constraints.sql
│
├── 02-role-model-migration/       ← Modelo oficial de roles (NUEVO)
│   ├── 10_new_role_enums.sql
│   ├── 11_new_role_tables.sql
│   ├── 12_authz_functions.sql
│   ├── 13_role_data_backfill.sql
│   ├── 14_new_rls_policies.sql       (siguiente entrega)
│   ├── 15_finalize_role_rename.sql   (siguiente entrega)
│   └── permissions-matrix.md
│
├── 03-data-migration/             ← Extracción/carga de datos (siguiente)
├── 04-storage-migration/          ← Scripts rsync de buckets (siguiente)
├── 05-edge-functions/             ← Ports Deno de server routes (siguiente)
├── 06-frontend-portable/          ← Archivos supabase/* portables (siguiente)
└── 07-cutover/                    ← Checklist de corte y verificación
```

## Fases de ejecución

### Fase 0 — Preparación (SIN riesgo)
1. Crear proyecto Supabase externo (región `us-east-1` o la que el cliente decida).
2. Configurar Auth (Google OAuth, HIBP on, MFA obligatorio para admin).
3. Ejecutar `01-schema/*.sql` en orden.
4. Ejecutar `02-role-model-migration/10..12`.
5. Configurar buckets Storage vacíos con políticas.

### Fase 1 — Migración de datos (SIN corte)
6. Snapshot BD actual con `pg_dump` a filesystem local (fuera de Lovable).
7. `pg_restore` en el proyecto externo, seleccionando tablas y datos.
8. Ejecutar `02-role-model-migration/13_role_data_backfill.sql`.
9. Ejecutar `02-role-model-migration/14_new_rls_policies.sql` (reescritura de RLS con `can_*`).
10. Migrar Storage: `mc mirror` de bucket-por-bucket entre S3 origen y destino.
11. Deploy Edge Functions en el proyecto externo.

### Fase 2 — Verificación (SIN corte)
12. Correr `07-cutover/verification-suite.sql` (checks de conteo, integridad FK, RLS smoke).
13. Ejecutar `07-cutover/rls-tests.sql` (matriz de permisos automatizada).
14. Preview del frontend apuntando al nuevo backend (variables `.env.staging`).

### Fase 3 — Corte (VENTANA de mantenimiento ~30 min)
15. Poner Lovable Cloud en modo lectura (revocar `INSERT`/`UPDATE` a `authenticated`).
16. Delta incremental de datos con timestamp `> últimos_15min`.
17. Actualizar variables de entorno en Lovable → nuevo proyecto Supabase.
18. Ejecutar `02-role-model-migration/15_finalize_role_rename.sql` en el proyecto externo (drop legacy).
19. Regenerar `src/integrations/supabase/types.ts` (`supabase gen types`).
20. Smoke test en producción; comunicar corte a usuarios.

### Fase 4 — Post-corte
21. Monitorear 72h; mantener Lovable Cloud en cold-standby.
22. Ejecutar borrado seguro de Lovable Cloud pasadas 30 días.

## Reglas críticas

- **NUNCA** apagar Lovable Cloud sin haber corrido la fase de verificación completa.
- **NUNCA** ejecutar `15_finalize_role_rename.sql` antes del corte — elimina tablas legacy irreversiblemente.
- Cada script SQL es **idempotente y transaccional**; se puede reintentar.
- Cualquier valor `service_role` o `db password` del nuevo proyecto NO se comita nunca — se maneja como secreto de Lovable con `add_secret`.

## Estado actual

✅ **00-inventory**: 51 tablas, 30 enums, 274 RLS policies, 6 buckets, 11 secretos + `lovable-cloud-dependencies.md` (10 archivos a swap).
✅ **01-schema**: DDL portable extraída (11 archivos).
✅ **02-role-model-migration**: enums v2, tablas, 17 funciones `has_*/can_*`, backfill legacy→v2, matriz de permisos, RLS reescrita para las 51 tablas, script de rename final.
✅ **03-data-migration**: playbook `pg_dump/pg_restore` con delta incremental.
✅ **04-storage-migration**: playbook `mc mirror` bucket-a-bucket.
✅ **05-edge-functions**: decisión de arquitectura — TSS se queda, sólo webhooks/cron cambian URL en dashboards.
✅ **06-frontend-portable**: `client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `.env.template`.
✅ **07-cutover**: `verification-suite.sql`, `rls-tests.sql`, `cutover-checklist.md` con rollback.

**Todos los entregables listos.** El proyecto Lovable no se modificó; los artefactos viven bajo `migration/` sin tocar `src/`. Cuando se dispare el corte se aplican en el orden del checklist.
