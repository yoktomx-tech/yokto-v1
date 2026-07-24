
CREATE OR REPLACE FUNCTION public.current_user_verified_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT lower(u.email::text)
  FROM auth.users u
  WHERE u.id = auth.uid()
    AND u.email_confirmed_at IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.current_user_verified_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_verified_email() TO authenticated;

DROP POLICY IF EXISTS "owner or verified invitee can view invitations" ON public.invitations;
CREATE POLICY "owner or verified invitee can view invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  public.is_org_owner(org_id, auth.uid())
  OR lower(email) = public.current_user_verified_email()
);

DROP POLICY IF EXISTS "verified invitee can accept invitation" ON public.invitations;
CREATE POLICY "verified invitee can accept invitation"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  lower(email) = public.current_user_verified_email()
)
WITH CHECK (
  lower(email) = public.current_user_verified_email()
  AND org_id  = (SELECT i.org_id  FROM public.invitations i WHERE i.id = invitations.id)
  AND org_role = (SELECT i.org_role FROM public.invitations i WHERE i.id = invitations.id)
  AND email   = (SELECT i.email   FROM public.invitations i WHERE i.id = invitations.id)
  AND token   = (SELECT i.token   FROM public.invitations i WHERE i.id = invitations.id)
);
