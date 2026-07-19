-- =============================================================================
-- YOKTO — Tests automatizados de la matriz de permisos
-- =============================================================================
-- Se ejecutan en el proyecto DESTINO con un usuario de prueba (ver setup abajo).
-- Cada bloque simula un rol y verifica que las policies devuelvan lo esperado.
-- Usa `SET ROLE` + `SET LOCAL "request.jwt.claim.sub"` para simular auth.uid().
-- =============================================================================

-- Requiere superuser. En proyectos Supabase se corre desde el SQL Editor.

BEGIN;

-- ---- Setup: 3 orgs, 6 usuarios con distintos roles ----
INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
  ('11111111-1111-1111-1111-111111111111','owner@t.test', now()),
  ('22222222-2222-2222-2222-222222222222','admin@t.test', now()),
  ('33333333-3333-3333-3333-333333333333','operator@t.test', now()),
  ('44444444-4444-4444-4444-444444444444','viewer@t.test', now()),
  ('55555555-5555-5555-5555-555555555555','outsider@t.test', now()),
  ('66666666-6666-6666-6666-666666666666','internal@t.test', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (id, name, type, owner_user_id) VALUES
  ('aaaa1111-0000-0000-0000-000000000001','Test Buyer Org','individual','11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.memberships (organization_id, user_id, role, status) VALUES
  ('aaaa1111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','owner','active'),
  ('aaaa1111-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','admin','active'),
  ('aaaa1111-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','operator','active'),
  ('aaaa1111-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','viewer','active')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111','buyer'),
  ('22222222-2222-2222-2222-222222222222','buyer'),
  ('33333333-3333-3333-3333-333333333333','buyer'),
  ('44444444-4444-4444-4444-444444444444','buyer'),
  ('55555555-5555-5555-5555-555555555555','buyer'),
  ('66666666-6666-6666-6666-666666666666','buyer')
ON CONFLICT DO NOTHING;

INSERT INTO public.internal_role_assignments (user_id, role, is_active) VALUES
  ('66666666-6666-6666-6666-666666666666','super_admin', true)
ON CONFLICT DO NOTHING;

-- ---- Helpers para simular auth ----
CREATE OR REPLACE FUNCTION _test_as(_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid::text, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

-- ---- Test 1: owner ve su org ----
SELECT _test_as('11111111-1111-1111-1111-111111111111');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.organizations
          WHERE id='aaaa1111-0000-0000-0000-000000000001') = 1,
    'FAIL: owner no puede leer su org';
END $$;

-- ---- Test 2: outsider NO ve la org ----
SELECT _test_as('55555555-5555-5555-5555-555555555555');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.organizations
          WHERE id='aaaa1111-0000-0000-0000-000000000001') = 0,
    'FAIL: outsider puede leer org ajena';
END $$;

-- ---- Test 3: viewer NO puede insertar transacción ----
SELECT _test_as('44444444-4444-4444-4444-444444444444');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.transactions (buyer_org_id, seller_org_id, amount_mxn, status)
    VALUES ('aaaa1111-0000-0000-0000-000000000001',
            'aaaa1111-0000-0000-0000-000000000001', 100, 'PENDIENTE');
    RAISE EXCEPTION 'FAIL: viewer pudo insertar transacción';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    -- OK
  END;
END $$;

-- ---- Test 4: super_admin ve todo ----
SELECT _test_as('66666666-6666-6666-6666-666666666666');
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.organizations;
  ASSERT n >= 1, 'FAIL: super_admin no ve organizaciones';
END $$;

-- ---- Test 5: viewer NO puede promover un miembro ----
SELECT _test_as('44444444-4444-4444-4444-444444444444');
DO $$ BEGIN
  BEGIN
    UPDATE public.memberships SET role='owner'
    WHERE organization_id='aaaa1111-0000-0000-0000-000000000001'
      AND user_id='33333333-3333-3333-3333-333333333333';
    IF FOUND THEN RAISE EXCEPTION 'FAIL: viewer pudo cambiar rol'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    -- OK
  END;
END $$;

-- ---- Test 6: usuario común NO accede al backoffice ----
SELECT _test_as('11111111-1111-1111-1111-111111111111');
DO $$ BEGIN
  ASSERT NOT public.can_access_backoffice(), 'FAIL: owner con acceso backoffice';
  ASSERT NOT public.has_internal_role('super_admin'), 'FAIL: owner tiene rol interno';
END $$;

-- ---- Test 7: internal user SÍ accede al backoffice ----
SELECT _test_as('66666666-6666-6666-6666-666666666666');
DO $$ BEGIN
  ASSERT public.can_access_backoffice(), 'FAIL: internal sin acceso backoffice';
  ASSERT public.has_internal_role('super_admin'), 'FAIL: internal no tiene super_admin';
END $$;

RESET ROLE;
ROLLBACK;

\echo 'Todos los tests pasaron.'
