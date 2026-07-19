-- =============================================================================
-- YOKTO — Rollback drill (SOLO staging)
-- =============================================================================
-- Simula un rollback tras la Etapa D (rename final). Revierte los renames y
-- deja el esquema con las estructuras legacy operando de nuevo, verificando
-- que la aplicación puede volver a funcionar contra ellas.
--
-- IMPORTANTE: este script ASUME que 15_finalize_role_rename.sql ya se corrió
-- en staging y renombró user_roles → user_roles_legacy_YYYYMMDD, etc.
-- Ajusta las fechas antes de ejecutar.
-- =============================================================================

\set legacy_stamp 'legacy_YYYYMMDD'   -- reemplazar por el sufijo real

BEGIN;

-- Verificar precondición: las tablas legacy con sufijo deben existir
DO $$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing FROM (VALUES
    ('user_roles_' || :'legacy_stamp'),
    ('memberships_' || :'legacy_stamp')
  ) AS req(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = req.name
  );
  IF missing > 0 THEN
    RAISE EXCEPTION 'ABORT rollback drill: % legacy backup table(s) missing', missing;
  END IF;
END $$;

-- Renombrar v2 (actualmente con nombre canónico) de vuelta a _v2
ALTER TABLE public.user_roles  RENAME TO user_roles_v2_restored;
ALTER TABLE public.memberships RENAME TO memberships_v2_restored;

-- Restaurar legacy al nombre canónico
EXECUTE format('ALTER TABLE public.user_roles_%s RENAME TO user_roles', :'legacy_stamp');
EXECUTE format('ALTER TABLE public.memberships_%s RENAME TO memberships', :'legacy_stamp');

-- Enums (mismo procedimiento inverso)
ALTER TYPE public.app_role      RENAME TO app_role_v2_restored;
ALTER TYPE public.org_role      RENAME TO org_role_v2_restored;
ALTER TYPE public.internal_role RENAME TO internal_role_v2_restored;

EXECUTE format('ALTER TYPE public.app_role_%s      RENAME TO app_role',      :'legacy_stamp');
EXECUTE format('ALTER TYPE public.org_role_%s      RENAME TO org_role',      :'legacy_stamp');
EXECUTE format('ALTER TYPE public.internal_role_%s RENAME TO internal_role', :'legacy_stamp');

-- Validar
DO $$
BEGIN
  PERFORM 1 FROM public.user_roles LIMIT 1;
  PERFORM 1 FROM public.memberships LIMIT 1;
  RAISE NOTICE 'Rollback drill: legacy tables restored to canonical names';
END $$;

COMMIT;

-- Post-condición manual: reejecutar smoke test de la aplicación contra el
-- esquema legacy restaurado. Registrar resultado en
-- reports/rollback-test-report.md.
