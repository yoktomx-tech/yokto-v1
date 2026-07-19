-- =====================================================================
-- RLS tests: public.invitations
-- Verifies that the "verified invitee can accept invitation" policy
-- blocks changes to org_id, org_role, email, and token, while allowing
-- an invitee to update acceptance-only fields.
--
-- Run with:
--   psql "$PGURL" -v ON_ERROR_STOP=1 -f tests/rls/invitations.test.sql
--
-- The script is transactional and rolls back at the end, leaving no
-- residual data in the database.
-- =====================================================================

BEGIN;

-- Fixtures ------------------------------------------------------------
DO $$
DECLARE
  owner_id  uuid := '00000000-0000-0000-0000-000000000a01';
  invitee_id uuid := '00000000-0000-0000-0000-000000000a02';
  other_org uuid := gen_random_uuid();
  the_org   uuid;
  inv_id    uuid;
BEGIN
  -- Create two auth users (email_confirmed so verified-invitee policy applies)
  INSERT INTO auth.users (id, email, email_confirmed_at, aud, role)
  VALUES
    (owner_id,   'owner_rls_test@example.com',   now(), 'authenticated', 'authenticated'),
    (invitee_id, 'invitee_rls_test@example.com', now(), 'authenticated', 'authenticated');

  -- Owner's organization + membership
  INSERT INTO public.organizations (name, type, owner_user_id)
  VALUES ('RLS Test Org', 'individual', owner_id)
  RETURNING id INTO the_org;

  INSERT INTO public.memberships (org_id, user_id, org_role, status)
  VALUES (the_org, owner_id, 'owner', 'active');

  INSERT INTO public.organizations (name, type, owner_user_id)
  VALUES ('Other Org', 'individual', invitee_id)
  RETURNING id INTO other_org;

  -- Pending invitation for the invitee
  INSERT INTO public.invitations (org_id, email, org_role, token, status, invited_by)
  VALUES (the_org, 'invitee_rls_test@example.com', 'member',
          'test-token-original', 'pending', owner_id)
  RETURNING id INTO inv_id;

  -- Persist ids into a temp table so test blocks can read them
  CREATE TEMP TABLE _ctx (k text primary key, v uuid) ON COMMIT DROP;
  INSERT INTO _ctx VALUES
    ('owner', owner_id), ('invitee', invitee_id),
    ('org', the_org), ('other_org', other_org), ('inv', inv_id);
END $$;

-- Impersonate the invitee for RLS -------------------------------------
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

-- TEST 1: invitee cannot escalate org_role ----------------------------
DO $$
DECLARE affected int;
BEGIN
  UPDATE public.invitations
    SET org_role = 'owner'
    WHERE id = (SELECT v FROM _ctx WHERE k='inv');
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'FAIL: invitee was allowed to escalate org_role';
  RAISE NOTICE 'PASS: org_role escalation blocked';
END $$;

-- TEST 2: invitee cannot reassign org_id ------------------------------
DO $$
DECLARE affected int;
BEGIN
  UPDATE public.invitations
    SET org_id = (SELECT v FROM _ctx WHERE k='other_org')
    WHERE id = (SELECT v FROM _ctx WHERE k='inv');
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'FAIL: invitee was allowed to change org_id';
  RAISE NOTICE 'PASS: org_id reassignment blocked';
END $$;

-- TEST 3: invitee cannot change email ---------------------------------
DO $$
DECLARE affected int;
BEGIN
  UPDATE public.invitations
    SET email = 'attacker@example.com'
    WHERE id = (SELECT v FROM _ctx WHERE k='inv');
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'FAIL: invitee was allowed to change email';
  RAISE NOTICE 'PASS: email change blocked';
END $$;

-- TEST 4: invitee cannot rotate token ---------------------------------
DO $$
DECLARE affected int;
BEGIN
  UPDATE public.invitations
    SET token = 'attacker-rotated-token'
    WHERE id = (SELECT v FROM _ctx WHERE k='inv');
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'FAIL: invitee was allowed to rotate token';
  RAISE NOTICE 'PASS: token rotation blocked';
END $$;

-- TEST 5: verified invitee CAN accept the invitation ------------------
DO $$
DECLARE affected int;
BEGIN
  UPDATE public.invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = (SELECT v FROM _ctx WHERE k='inv');
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 1, 'FAIL: verified invitee could not accept invitation';
  RAISE NOTICE 'PASS: verified invitee accepted invitation';
END $$;

-- TEST 6: a different verified user cannot touch the invitation -------
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',   (SELECT v FROM _ctx WHERE k='owner'), -- reuse owner id as "other user" without membership context
    'email', 'someone_else@example.com',           -- email does NOT match invitation.email
    'role',  'authenticated'
  )::text,
  true
);
DO $$
DECLARE affected int;
BEGIN
  UPDATE public.invitations
    SET status = 'accepted'
    WHERE id = (SELECT v FROM _ctx WHERE k='inv');
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'FAIL: an unrelated user was allowed to update the invitation';
  RAISE NOTICE 'PASS: unrelated user cannot update invitation';
END $$;

ROLLBACK;
