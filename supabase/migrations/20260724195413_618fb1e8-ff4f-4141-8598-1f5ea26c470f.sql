
REVOKE EXECUTE ON FUNCTION public.assign_transaction_numero() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_verified_email() FROM PUBLIC, anon;

DROP POLICY IF EXISTS "owner or verified invitee can view invitations" ON public.invitations;
CREATE POLICY "owner or verified invitee can view invitations"
ON public.invitations
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  public.is_org_owner(org_id, auth.uid())
  OR (
    lower(email) = public.current_user_verified_email()
    AND accepted_at IS NULL
    AND expires_at > now()
  )
);

DROP POLICY IF EXISTS "Verifiers view profiles for KYC" ON public.profiles;
CREATE POLICY "Verifiers view profiles for KYC"
ON public.profiles
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'verifier'::app_role)
  AND kyc_status IN ('pending','in_review')
);
