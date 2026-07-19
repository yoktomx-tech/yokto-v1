-- =============================================================================
-- YOKTO — Validación Etapa B (backfill legacy → v2 completo y consistente)
-- =============================================================================
-- Ejecutar DESPUÉS de 13_role_data_backfill.sql.
-- Aborta con RAISE EXCEPTION si algún criterio falla.
-- Preserva UUID (verificado por FK a auth.users).
-- =============================================================================
BEGIN;

CREATE TEMP TABLE _validation_result (
  metric text PRIMARY KEY,
  value  bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('PASS','FAIL'))
);

-- 1. Conteos legacy vs v2 (deben coincidir)
DO $$
DECLARE
  legacy_ur bigint; v2_ur bigint;
  legacy_mb bigint; v2_mb bigint;
BEGIN
  -- Legacy user_roles (nombre real depende de si ya se renombró)
  BEGIN
    EXECUTE 'SELECT count(*) FROM public.user_roles_legacy' INTO legacy_ur;
  EXCEPTION WHEN undefined_table THEN
    EXECUTE 'SELECT count(*) FROM public.user_roles' INTO legacy_ur;
  END;
  SELECT count(*) INTO v2_ur FROM public.user_roles;

  BEGIN
    EXECUTE 'SELECT count(*) FROM public.memberships_legacy' INTO legacy_mb;
  EXCEPTION WHEN undefined_table THEN
    EXECUTE 'SELECT count(*) FROM public.memberships' INTO legacy_mb;
  END;
  SELECT count(*) INTO v2_mb FROM public.memberships_v2;

  INSERT INTO _validation_result VALUES
    ('legacy_user_roles', legacy_ur, 'PASS'),
    ('v2_user_roles',     v2_ur,     CASE WHEN v2_ur = legacy_ur THEN 'PASS' ELSE 'FAIL' END),
    ('legacy_memberships', legacy_mb, 'PASS'),
    ('v2_memberships',    v2_mb,     CASE WHEN v2_mb = legacy_mb THEN 'PASS' ELSE 'FAIL' END);
END $$;

-- 2. Usuarios sin rol (debe ser 0)
INSERT INTO _validation_result
SELECT 'users_without_role', count(*),
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id);

-- 3. Usuarios sin membership (debe ser 0)
INSERT INTO _validation_result
SELECT 'users_without_membership', count(*),
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.memberships_v2 m WHERE m.user_id = u.id);

-- 4. Duplicados de rol interno activo (debe ser 0)
INSERT INTO _validation_result
SELECT 'duplicate_internal_active', COALESCE(sum(cnt - 1), 0),
       CASE WHEN COALESCE(sum(cnt - 1), 0) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM (
  SELECT user_id, count(*) AS cnt
  FROM public.internal_role_assignments
  WHERE activo = true AND (expira_at IS NULL OR expira_at > now())
  GROUP BY user_id HAVING count(*) > 1
) t;

-- 5. Roles internos generados por backfill (debe ser 0 — se asignan manualmente)
INSERT INTO _validation_result
SELECT 'internal_roles_from_backfill', count(*),
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.internal_role_assignments
WHERE created_at >= (SELECT max(created_at) - interval '1 hour'
                     FROM public.user_roles);

-- 6. Memberships huérfanos (org_id sin organizations)
INSERT INTO _validation_result
SELECT 'orphan_memberships', count(*),
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.memberships_v2 m
WHERE NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = m.org_id);

-- 7. UUID preservados (FK integrity — ya la garantiza la FK, pero verificamos)
INSERT INTO _validation_result
SELECT 'user_roles_orphan_user', count(*),
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.user_roles r
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.user_id);

-- 8. Reporte
DO $$
DECLARE r record; fail_count int := 0;
BEGIN
  RAISE NOTICE '--- Stage B backfill validation ---';
  FOR r IN SELECT * FROM _validation_result ORDER BY metric LOOP
    RAISE NOTICE '  %  =  %  [%]', rpad(r.metric, 32), r.value, r.status;
    IF r.status = 'FAIL' THEN fail_count := fail_count + 1; END IF;
  END LOOP;
  IF fail_count > 0 THEN
    RAISE EXCEPTION 'ABORT Stage B: % validation(s) failed', fail_count;
  END IF;
  RAISE NOTICE 'Stage B validation: PASS';
END $$;

DROP TABLE _validation_result;
COMMIT;
