
-- 1. Explicit deny INSERT/UPDATE/DELETE to authenticated on audit tables (writes only via service_role/security definer)
DROP POLICY IF EXISTS "authenticated cannot insert audit_events" ON public.audit_events;
CREATE POLICY "authenticated cannot insert audit_events" ON public.audit_events
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "authenticated cannot modify audit_events" ON public.audit_events;
CREATE POLICY "authenticated cannot modify audit_events" ON public.audit_events
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "authenticated cannot delete audit_events" ON public.audit_events;
CREATE POLICY "authenticated cannot delete audit_events" ON public.audit_events
  AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS "authenticated cannot insert transaction_events" ON public.transaction_events;
CREATE POLICY "authenticated cannot insert transaction_events" ON public.transaction_events
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "authenticated cannot modify transaction_events" ON public.transaction_events;
CREATE POLICY "authenticated cannot modify transaction_events" ON public.transaction_events
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "authenticated cannot delete transaction_events" ON public.transaction_events;
CREATE POLICY "authenticated cannot delete transaction_events" ON public.transaction_events
  AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- 2. Deny authenticated writes on penny tests (writes only via service_role from webhook / server functions)
DROP POLICY IF EXISTS "authenticated cannot insert penny_tests" ON public.bank_account_penny_tests;
CREATE POLICY "authenticated cannot insert penny_tests" ON public.bank_account_penny_tests
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "authenticated cannot update penny_tests" ON public.bank_account_penny_tests;
CREATE POLICY "authenticated cannot update penny_tests" ON public.bank_account_penny_tests
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "authenticated cannot delete penny_tests" ON public.bank_account_penny_tests;
CREATE POLICY "authenticated cannot delete penny_tests" ON public.bank_account_penny_tests
  AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- Platform admins can view penny tests for support/audit
DROP POLICY IF EXISTS "platform admins view penny_tests" ON public.bank_account_penny_tests;
CREATE POLICY "platform admins view penny_tests" ON public.bank_account_penny_tests
  FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'platform_admin'));

-- 3. Restrict CURP verifications policy to authenticated (not public)
DROP POLICY IF EXISTS "Users can view their own CURP verifications" ON public.curp_verifications;
CREATE POLICY "Users can view their own CURP verifications" ON public.curp_verifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
