-- =============================================================================
-- YOKTO — Validación Etapa A (estructuras v2 creadas, aún sin backfill)
-- =============================================================================
-- Ejecutar tras 10_new_role_enums + 11_new_role_tables + 12_authz_functions.
-- Aborta con ROLLBACK si alguna precondición falla.
-- =============================================================================
BEGIN;

DO $$
DECLARE
  missing_enums   int;
  missing_tables  int;
  missing_funcs   int;
BEGIN
  SELECT count(*) INTO missing_enums FROM (VALUES
    ('app_role_v2'), ('org_role_v2'), ('internal_role_v2')
  ) AS req(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = req.name
  );
  IF missing_enums > 0 THEN
    RAISE EXCEPTION 'ABORT Stage A: missing % v2 enum(s)', missing_enums;
  END IF;

  SELECT count(*) INTO missing_tables FROM (VALUES
    ('user_roles'), ('memberships_v2'), ('internal_role_assignments')
  ) AS req(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = req.name AND c.relkind = 'r'
  );
  IF missing_tables > 0 THEN
    RAISE EXCEPTION 'ABORT Stage A: missing % v2 table(s)', missing_tables;
  END IF;

  SELECT count(*) INTO missing_funcs FROM (VALUES
    ('has_role'), ('has_org_role'), ('has_platform_role'),
    ('is_org_member'), ('is_org_owner'), ('get_active_internal_role')
  ) AS req(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = req.name
  );
  IF missing_funcs > 0 THEN
    RAISE EXCEPTION 'ABORT Stage A: missing % SECURITY DEFINER function(s)', missing_funcs;
  END IF;

  RAISE NOTICE 'Stage A validation: PASS';
END $$;

COMMIT;
