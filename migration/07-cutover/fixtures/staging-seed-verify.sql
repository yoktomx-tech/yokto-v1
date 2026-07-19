-- =============================================================================
-- Verifica conteos esperados tras aplicar staging-seed.sql
-- =============================================================================
DO $$
DECLARE
  users_count int;
  orgs_count int;
  mb_count int;
  ir_count int;
BEGIN
  SELECT count(*) INTO users_count FROM auth.users
    WHERE email LIKE '%@staging.yokto.test';
  SELECT count(*) INTO orgs_count FROM public.organizations
    WHERE name LIKE '%-STAGING';
  SELECT count(*) INTO mb_count FROM public.memberships_v2
    WHERE user_id::text LIKE '20000000-%';
  SELECT count(*) INTO ir_count FROM public.internal_role_assignments
    WHERE user_id::text LIKE '20000000-%' AND activo = true;

  RAISE NOTICE 'staging_users=%',  users_count;
  RAISE NOTICE 'staging_orgs=%',   orgs_count;
  RAISE NOTICE 'staging_memberships=%', mb_count;
  RAISE NOTICE 'staging_internal_active=%', ir_count;

  IF users_count < 20 THEN
    RAISE EXCEPTION 'Seed verification FAIL: expected >= 20 users, got %', users_count;
  END IF;
  IF orgs_count < 3 THEN
    RAISE EXCEPTION 'Seed verification FAIL: expected >= 3 orgs, got %', orgs_count;
  END IF;
  IF ir_count < 7 THEN
    RAISE EXCEPTION 'Seed verification FAIL: expected 7 active internal roles, got %', ir_count;
  END IF;
  RAISE NOTICE 'Seed verification: PASS';
END $$;
