-- =============================================================================
-- YOKTO — Matriz RLS extendida (51 tablas × 16 roles × 4 operaciones)
-- =============================================================================
-- Se ejecuta SOLO en staging con fixtures cargados. Cada bloque hace SET
-- ROLE a un usuario representativo (JWT vía set_config o supabase.auth) y
-- valida allow/deny.
--
-- Reglas:
-- - NO se usa service_role (bypassa RLS).
-- - Cada bloque termina con INSERT en _rls_test_result.
-- - El script imprime el resumen y aborta si hay FAIL.
--
-- Fixtures esperados (staging-seed.sql):
--   u_buyer,           u_seller,     u_buyer_and_seller,
--   u_owner,           u_org_admin,  u_finance,   u_operator,
--   u_viewer,          u_auditor,
--   u_super_admin,     u_compliance, u_kyc_reviewer,
--   u_doc_reviewer,    u_dispute_mgr, u_finance_ops, u_support_agent,
--   u_no_membership,   u_inactive_membership, u_revoked_internal,
--   org_alpha, org_beta,  -- dos organizaciones separadas
--   tx_alpha_1, tx_beta_1
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _rls_test_result (
  id serial PRIMARY KEY,
  table_name text NOT NULL,
  op text NOT NULL,
  role_label text NOT NULL,
  expected text NOT NULL,
  actual text NOT NULL,
  status text NOT NULL CHECK (status IN ('PASS','FAIL'))
);

-- Helper: ejecuta un SQL como un usuario dado y captura si permite/deniega.
CREATE OR REPLACE FUNCTION _as_user(_uid uuid, _sql text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  result text;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    EXECUTE _sql;
    result := 'ALLOW';
  EXCEPTION
    WHEN insufficient_privilege THEN result := 'DENY';
    WHEN OTHERS THEN result := 'ERROR:' || SQLERRM;
  END;
  RESET role;
  PERFORM set_config('request.jwt.claims', NULL, true);
  RETURN result;
END $$;

-- Helper: registra resultado y compara
CREATE OR REPLACE FUNCTION _check(_table text, _op text, _label text,
                                  _expected text, _actual text)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO _rls_test_result(table_name, op, role_label, expected, actual, status)
  VALUES (_table, _op, _label, _expected,
    CASE WHEN _actual LIKE 'ERROR%' THEN _actual ELSE _actual END,
    CASE WHEN _actual = _expected THEN 'PASS' ELSE 'FAIL' END);
$$;

-- =============================================================================
-- CASOS CRÍTICOS (subset representativo — la matriz completa vive en
-- rls-matrix.md; este script cubre los invariantes que jamás deben fallar).
-- =============================================================================

-- --- transactions ---
DO $$
DECLARE
  u_buyer uuid   := (SELECT id FROM auth.users WHERE email = 'buyer@staging.yokto.test');
  u_seller uuid  := (SELECT id FROM auth.users WHERE email = 'seller@staging.yokto.test');
  u_admin uuid   := (SELECT id FROM auth.users WHERE email = 'app-admin@staging.yokto.test');
  u_super uuid   := (SELECT id FROM auth.users WHERE email = 'super-admin@staging.yokto.test');
  u_support uuid := (SELECT id FROM auth.users WHERE email = 'support-agent@staging.yokto.test');
  tx_alpha uuid  := (SELECT id FROM public.transactions WHERE numero = 'YOKTO-STAGING-00001');
BEGIN
  PERFORM _check('transactions','SELECT','buyer_own',       'ALLOW',
    _as_user(u_buyer,  format('PERFORM 1 FROM public.transactions WHERE id=%L', tx_alpha)));

  PERFORM _check('transactions','UPDATE','buyer_own',       'ALLOW',
    _as_user(u_buyer,  format('UPDATE public.transactions SET updated_at=now() WHERE id=%L', tx_alpha)));

  PERFORM _check('transactions','UPDATE','other_seller',    'DENY',
    _as_user(u_seller, format('UPDATE public.transactions SET updated_at=now() WHERE id=%L', tx_alpha)));

  -- app_role = admin NO da acceso a backoffice ni bypass
  PERFORM _check('internal_action_log','SELECT','app_admin', 'DENY',
    _as_user(u_admin, 'PERFORM 1 FROM public.internal_action_log'));

  -- internal super_admin sí
  PERFORM _check('internal_action_log','SELECT','super_admin','ALLOW',
    _as_user(u_super, 'PERFORM 1 FROM public.internal_action_log'));

  -- support_agent NO libera fondos
  PERFORM _check('payouts','INSERT','support_agent','DENY',
    _as_user(u_support,
      format($f$INSERT INTO public.payouts(transaction_id, amount_cents, status)
               VALUES (%L, 1000, 'pending')$f$, tx_alpha)));
END $$;

-- --- bank_accounts ---
DO $$
DECLARE
  u_operator uuid := (SELECT id FROM auth.users WHERE email = 'operator@staging.yokto.test');
  u_finance  uuid := (SELECT id FROM auth.users WHERE email = 'finance@staging.yokto.test');
  u_viewer   uuid := (SELECT id FROM auth.users WHERE email = 'viewer@staging.yokto.test');
  u_auditor  uuid := (SELECT id FROM auth.users WHERE email = 'auditor@staging.yokto.test');
  org_alpha  uuid := (SELECT id FROM public.organizations WHERE name = 'ORG-ALPHA-STAGING');
BEGIN
  -- operator no administra cuentas bancarias
  PERFORM _check('bank_accounts','INSERT','operator','DENY',
    _as_user(u_operator, format($f$INSERT INTO public.bank_accounts(org_id, clabe)
      VALUES (%L, '646180000000000000')$f$, org_alpha)));

  PERFORM _check('bank_accounts','INSERT','finance','ALLOW',
    _as_user(u_finance,  format($f$INSERT INTO public.bank_accounts(org_id, clabe)
      VALUES (%L, '646180000000000001')$f$, org_alpha)));

  -- viewer y auditor jamás modifican
  PERFORM _check('bank_accounts','UPDATE','viewer','DENY',
    _as_user(u_viewer,   format('UPDATE public.bank_accounts SET clabe=%L WHERE org_id=%L',
      '646180000000000099', org_alpha)));
  PERFORM _check('bank_accounts','UPDATE','auditor','DENY',
    _as_user(u_auditor,  format('UPDATE public.bank_accounts SET clabe=%L WHERE org_id=%L',
      '646180000000000099', org_alpha)));
END $$;

-- --- disputes ---
DO $$
DECLARE
  u_finance    uuid := (SELECT id FROM auth.users WHERE email = 'finance@staging.yokto.test');
  u_dispute    uuid := (SELECT id FROM auth.users WHERE email = 'dispute-mgr@staging.yokto.test');
  u_kyc        uuid := (SELECT id FROM auth.users WHERE email = 'kyc-reviewer@staging.yokto.test');
  d_alpha      uuid := (SELECT id FROM public.disputes LIMIT 1);
BEGIN
  -- finance no resuelve disputas
  PERFORM _check('disputes','UPDATE','finance','DENY',
    _as_user(u_finance,
      format('UPDATE public.disputes SET status=''resolved'' WHERE id=%L', d_alpha)));

  PERFORM _check('disputes','UPDATE','dispute_manager','ALLOW',
    _as_user(u_dispute,
      format('UPDATE public.disputes SET status=''resolved'' WHERE id=%L', d_alpha)));

  -- kyc_reviewer no realiza operaciones finance_ops
  PERFORM _check('payouts','SELECT','kyc_reviewer','DENY',
    _as_user(u_kyc, 'PERFORM 1 FROM public.payouts'));
END $$;

-- --- anonymous ---
DO $$
BEGIN
  PERFORM set_config('role', 'anon', true);
  BEGIN
    PERFORM 1 FROM public.transactions;
    PERFORM _check('transactions','SELECT','anonymous','DENY','ALLOW');
  EXCEPTION WHEN insufficient_privilege OR others THEN
    PERFORM _check('transactions','SELECT','anonymous','DENY','DENY');
  END;
  RESET role;
END $$;

-- --- authenticated sin membership ---
DO $$
DECLARE u_none uuid := (SELECT id FROM auth.users WHERE email = 'no-membership@staging.yokto.test');
BEGIN
  PERFORM _check('transactions','SELECT','no_membership','DENY',
    _as_user(u_none, 'PERFORM 1 FROM public.transactions'));
END $$;

-- --- membership inactiva ---
DO $$
DECLARE u_ina uuid := (SELECT id FROM auth.users WHERE email = 'inactive-membership@staging.yokto.test');
BEGIN
  PERFORM _check('transactions','SELECT','inactive_membership','DENY',
    _as_user(u_ina, 'PERFORM 1 FROM public.transactions'));
END $$;

-- --- internal_role revocado ---
DO $$
DECLARE u_rev uuid := (SELECT id FROM auth.users WHERE email = 'revoked-internal@staging.yokto.test');
BEGIN
  PERFORM _check('internal_action_log','SELECT','revoked_internal','DENY',
    _as_user(u_rev, 'PERFORM 1 FROM public.internal_action_log'));
END $$;

-- =============================================================================
-- REPORTE
-- =============================================================================
DO $$
DECLARE r record; fail_count int := 0; total int;
BEGIN
  SELECT count(*) INTO total FROM _rls_test_result;
  RAISE NOTICE '--- RLS extended test results (% cases) ---', total;
  FOR r IN SELECT * FROM _rls_test_result ORDER BY id LOOP
    RAISE NOTICE '  [%] %.% (%) expected=% actual=%',
      r.status, r.table_name, r.op, r.role_label, r.expected, r.actual;
    IF r.status = 'FAIL' THEN fail_count := fail_count + 1; END IF;
  END LOOP;
  RAISE NOTICE '=== FAIL=% / TOTAL=% ===', fail_count, total;
  IF fail_count > 0 THEN
    RAISE EXCEPTION 'RLS extended: % test(s) FAILED', fail_count;
  END IF;
END $$;

DROP FUNCTION _as_user(uuid, text);
DROP FUNCTION _check(text, text, text, text, text);
DROP TABLE _rls_test_result;

ROLLBACK;   -- todas las escrituras de prueba se descartan
