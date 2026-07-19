# Backfill y rename final — protecciones y etapas

## Principio

Nunca renombrar tablas antes de validar que la aplicación funciona contra las tablas `_v2`. Nunca eliminar tablas legacy durante el primer despliegue.

## Etapas obligatorias

### Etapa A — Crear estructuras v2 (no destructivo)

Aplicar en orden:

1. `10_new_role_enums.sql` — crea `app_role_v2`, `org_role_v2`, `internal_role_v2` sin tocar los legacy.
2. `11_new_role_tables.sql` — crea `user_roles` (nueva) / `memberships_v2` / `internal_role_assignments` conservando las legacy paralelas.
3. `12_authz_functions.sql` — funciones `has_role`, `has_org_role`, `has_platform_role`, `can_*` operando sobre las tablas v2.

**Rollback**: `DROP TABLE ... _v2` + `DROP TYPE ... _v2`. No afecta datos productivos.

### Etapa B — Backfill con conteos

`13_role_data_backfill.sql` debe imprimir **antes** y **después**:

```sql
-- ANTES
SELECT 'legacy_user_roles', count(*) FROM public.user_roles_legacy;
SELECT 'legacy_memberships', count(*) FROM public.memberships_legacy;

-- Mapeos
INSERT INTO public.memberships_v2 (...)
SELECT ...
FROM public.memberships_legacy
ON CONFLICT (org_id, user_id) DO NOTHING;

-- DESPUÉS + validaciones
SELECT 'v2_user_roles', count(*) FROM public.user_roles;
SELECT 'v2_memberships', count(*) FROM public.memberships_v2;

-- Detección de anomalías
SELECT 'unmapped_org_role', count(*) FROM public.memberships_legacy m
  WHERE NOT EXISTS (SELECT 1 FROM public.memberships_v2 v
                    WHERE v.org_id=m.org_id AND v.user_id=m.user_id);

SELECT 'duplicate_internal', user_id, count(*)
FROM public.internal_role_assignments
WHERE activo = true
GROUP BY user_id HAVING count(*) > 1;

SELECT 'users_without_role', count(*)
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id);

SELECT 'users_without_membership', count(*)
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.memberships_v2 m WHERE m.user_id = u.id);
```

Criterios de aceptación:

- `unmapped_org_role = 0`
- `duplicate_internal = 0` filas
- `users_without_role = 0`
- `users_without_membership = 0` (todos los usuarios deben pertenecer al menos a su organización personal)
- `count(v2) == count(legacy)` para user_roles y memberships

Si algún criterio falla → **abortar y regenerar mapeo**, no continuar.

### Etapa C — Aplicación apunta a v2

- Deploy del frontend con los helpers portables (`06-frontend-portable/*`) que ya usan las funciones v2.
- Ejecutar el dry run E2E (`07-cutover/dry-run-plan.md`).
- Mantener las tablas legacy en lectura para permitir consultas de conciliación.

### Etapa D — Rename final (`15_finalize_role_rename.sql`)

Sólo tras 100 % del dry run OK:

```sql
BEGIN;

-- Renombrar tablas legacy con sufijo _legacy_YYYYMMDD para conservarlas
ALTER TABLE public.user_roles   RENAME TO user_roles_legacy_20260119;
ALTER TABLE public.memberships  RENAME TO memberships_legacy_20260119;

-- Promover v2 al nombre oficial
ALTER TABLE public.user_roles_v2   RENAME TO user_roles;   -- si se usó sufijo
ALTER TABLE public.memberships_v2  RENAME TO memberships;

-- Enums
ALTER TYPE public.app_role       RENAME TO app_role_legacy_20260119;
ALTER TYPE public.app_role_v2    RENAME TO app_role;
ALTER TYPE public.org_role       RENAME TO org_role_legacy_20260119;
ALTER TYPE public.org_role_v2    RENAME TO org_role;
ALTER TYPE public.internal_role  RENAME TO internal_role_legacy_20260119;
ALTER TYPE public.internal_role_v2 RENAME TO internal_role;

COMMIT;
```

- Las tablas `*_legacy_YYYYMMDD` se conservan **como mínimo 30 días** (ventana de rollback).
- Al día 30, previo VoBo firmado del cliente: `DROP TABLE ... CASCADE`.

## Registro de cambios

Cada etapa deja rastro en `public.audit_events` con `event_type='role_migration'` y payload con conteos antes/después.

## Preservación de UUID

- `user_roles.user_id`, `memberships.user_id`, `internal_role_assignments.user_id` son FK a `auth.users(id)` → los UUID no cambian.
- `organizations.id` y `memberships.org_id` conservan valor porque se importan con `\COPY` sin regenerar `gen_random_uuid()`.

## Rollback (durante Etapa C o D)

1. Revertir deploy del frontend al commit anterior (helpers portables aún convivían con Cloud viejo).
2. `ALTER TABLE ... RENAME` inverso.
3. `ALTER TYPE ... RENAME` inverso.
4. Conservar `_v2` para nuevo intento.
5. Anunciar posposición del corte; conservar delta de auth y storage.

## Prohibido durante Fase 0

- Ejecutar el rename de Etapa D.
- `DROP TABLE` de estructuras legacy.
- Revocar policies legacy antes del rename.
- Recrear `handle_new_user` con dependencia hard a v2 antes del rename (usar helpers que soporten ambos nombres durante la coexistencia).
