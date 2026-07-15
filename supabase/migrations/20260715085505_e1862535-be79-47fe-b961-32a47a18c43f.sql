
-- 1) audit_events: remove authenticated INSERT (only service_role/triggers)
DROP POLICY IF EXISTS "authenticated can insert audit" ON public.audit_events;

-- 2) audit_log: remove authenticated INSERT
DROP POLICY IF EXISTS "audit_insert_any_auth" ON public.audit_log;

-- 3) transaction_events: remove authenticated INSERT
DROP POLICY IF EXISTS "parties insert events" ON public.transaction_events;

-- 4) invitations: require verified email for invitee access
DROP POLICY IF EXISTS "owner can view org invitations" ON public.invitations;
DROP POLICY IF EXISTS "owner or invitee can update invitation" ON public.invitations;

CREATE POLICY "owner or verified invitee can view invitations"
ON public.invitations FOR SELECT
TO authenticated
USING (
  is_org_owner(org_id, auth.uid())
  OR (
    lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid())::text)
    AND (SELECT u.email_confirmed_at FROM auth.users u WHERE u.id = auth.uid()) IS NOT NULL
  )
);

CREATE POLICY "owner or verified invitee can update invitations"
ON public.invitations FOR UPDATE
TO authenticated
USING (
  is_org_owner(org_id, auth.uid())
  OR (
    lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid())::text)
    AND (SELECT u.email_confirmed_at FROM auth.users u WHERE u.id = auth.uid()) IS NOT NULL
  )
)
WITH CHECK (
  is_org_owner(org_id, auth.uid())
  OR (
    lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid())::text)
    AND (SELECT u.email_confirmed_at FROM auth.users u WHERE u.id = auth.uid()) IS NOT NULL
  )
);

-- 5) memberships: prevent self-assign owner unless actually owning the organization
DROP POLICY IF EXISTS "owner can insert memberships" ON public.memberships;

CREATE POLICY "owner insert memberships"
ON public.memberships FOR INSERT
TO authenticated
WITH CHECK (
  is_org_owner(org_id, auth.uid())
  OR (
    user_id = auth.uid()
    AND org_role = 'owner'::org_role
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = memberships.org_id AND o.owner_user_id = auth.uid()
    )
  )
);

-- 6) transactions buyer draft update — enforce status='draft' in WITH CHECK
DROP POLICY IF EXISTS "buyer updates draft" ON public.transactions;

CREATE POLICY "buyer updates draft"
ON public.transactions FOR UPDATE
TO authenticated
USING (
  ((auth.uid() = buyer_id) AND (status = 'draft'::transaction_status))
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  ((auth.uid() = buyer_id) AND (status = 'draft'::transaction_status))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 7) SECURITY DEFINER functions — restrict execution
-- Admin/system-only functions: no public execute at all
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_abandoned_onboarding() FROM PUBLIC, anon, authenticated;

-- Helper functions used inside RLS policies: revoke from anon/public, keep authenticated
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, org_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_platform_role(uuid, platform_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_owner(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_platform_role(uuid, platform_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) TO authenticated;
