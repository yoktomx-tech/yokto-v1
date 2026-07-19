-- =====================================================================
-- RLS tests: public.invitations
-- Verifies that the "verified invitee can accept invitation" policy
-- blocks changes to org_id, org_role, email, and token, while allowing
-- an invitee to update acceptance-only fields (accepted_at / accepted_by).
--
-- Run against the project's admin connection (service-role / postgres),
-- because it inserts fixture rows in auth.users:
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f tests/rls/invitations.test.sql
--
-- The script is fully transactional and rolls back at the end.
-- =====================================================================

BEGIN;

-- Fixtures ------------------------------------------------------------
CREATE TEMP TABLE _ctx (k text primary key, v uuid) ON COMMIT DROP;

DO $$
DECLARE
  owner_id   uuid := gen_random_uuid();
  invitee_id uuid := gen_random_uuid();
  other_uid  uuid := gen_random_uuid();
  the_org    uuid;
  other_org  uuid;
  inv_id     uuid;
BEGIN
  INSERT INTO auth.users (id, instance_id, email, email_confirmed_at, aud, role,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (owner_id,   '00000000-0000-0000-0000-000000000000',
     'owner_rls_test@example.com',   now(), 'authenticated', 'authenticated',
     '{}'::jsonb, '{}'::jsonb, now(), now()),
    (invitee_id, '00000000-0000-0000-0000-000000000000',
     'invitee_rls_test@example.com', now(), 'authenticated', 'authenticated',
     '{}'::jsonb, '{}'::jsonb, now(), now()),
    (other_uid,  '00000000-0000-0000-0000-000000000000',
     'other_rls_test@example.com',   now(), 'authenticated', 'authenticated',
     '{}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.organizations (name, type, owner_user_id)
  VALUES ('RLS Test Org', 'individual', owner_id)
  RETURNING id INTO the_org;

  INSERT INTO public.memberships (org_id, user_id, org_role, status)
  VALUES (the_org, owner_id, 'owner', 'active');

  INSERT INTO public.organizations (name, type, owner_user_id)
  VALUES ('RLS Other Org', 'individual', other_uid)
  RETURNING id INTO other_org;

  INSERT INTO public.invitations (org_id, email, org_role, token, invited_by)
  VALUES (the_org, 'invitee_rls_test@example.com', 'member',
          'rls-test-token-original', owner_id)
  RETURNING id INTO inv_id;

  INSERT INTO _ctx VALUES
    ('owner', owner_id), ('invitee', invitee_id), ('other', other_uid),
    ('org', the_org), ('other_org', other_org), ('inv', inv_id);
END $$;

-- Impersonate the invitee (verified, matching email) ------------------
SET LOCAL role authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',   (SELECT v FROM _ctx WHERE k='invitee'),
    'email', 'invitee_rls_test@example.com',
    'role',  'authenticated'
  )::text,
  true
);

-- TEST 1: cannot escalate org_role ------------------------------------
DO $$
DECLARE affected int; BEGIN
  UPDATE public.invitations SET org_role = 'owner'
    WHERE id = (SELECT v FROM _ctx WHERE k='inv');
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'FAIL: invitee escalated org_role';
  RAISE NOTICE 'PASS 1/6: org_role escalation blocked';
END $$;

-- TEST 2: cannot reassign org_id --------------------------------------
DO $$
DECLARE affected int; BEGIN
  UPDATE public.invitations SET org_id = (SELECT v FROM _ctx WHERE k='other_org')
    WHERE id = (SELECT v FROM _ctx WHERE k='inv');
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'FAIL: invitee reassigned org_id';
  RAISE NOTICE 'PASS 2/6: org_id reassignment blocked';
END $$;

-- TEST 3: cannot change email -----------------------------------------
DO $$
DECLARE affected int; BEGIN
  UPDATE public.invitations SET email = 'attacker@example.com'
    WHERE id = (SELECT v FROM _ctx WHERE k='inv');
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'FAIL: invitee changed email';
  RAISE NOTICE 'PASS 3/6: email change blocked';
END $$;

-- TEST 4: cannot rotate token -----------------------------------------
DO $$
DECLARE affected int; BEGIN
  UPDATE public.invitations SET token = 'attacker-rotated-token'
    WHERE id = (SELECT v FROM _ctx WHERE k='inv');
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'FAIL: invitee rotated token';
  RAISE NOTICE 'PASS 4/6: token rotation blocked';
END $$;

-- TEST 5: verified invitee CAN accept the invitation ------------------
DO $$
DECLARE affected int; BEGIN
  UPDATE public.invitations
    SET accepted_at = now(),
        accepted_by = (SELECT v FROM _ctx WHERE k='invitee')
    WHERE id = (SELECT v FROM _ctx WHERE k='inv');
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 1, 'FAIL: verified invitee could not accept invitation';
  RAISE NOTICE 'PASS 5/6: verified invitee accepted invitation';
END $$;

-- TEST 6: unrelated user cannot touch the invitation ------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',   (SELECT v FROM _ctx WHERE k='other'),
    'email', 'other_rls_test@example.com',
    'role',  'authenticated'
  )::text,
  true
);
DO $$
DECLARE affected int; BEGIN
  UPDATE public.invitations SET accepted_at = now()
    WHERE id = (SELECT v FROM _ctx WHERE k='inv');
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'FAIL: unrelated user updated invitation';
  RAISE NOTICE 'PASS 6/6: unrelated user cannot update invitation';
END $$;

ROLLBACK;

