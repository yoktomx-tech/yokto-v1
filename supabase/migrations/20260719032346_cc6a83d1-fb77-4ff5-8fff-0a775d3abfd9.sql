
-- Restrict invitees to only accepting the invite; owners keep full control.
DROP POLICY IF EXISTS "owner or verified invitee can update invitations" ON public.invitations;

CREATE POLICY "owner can update invitations"
ON public.invitations
FOR UPDATE
TO authenticated
USING (public.is_org_owner(org_id, auth.uid()))
WITH CHECK (public.is_org_owner(org_id, auth.uid()));

-- Invitee accepting: locked to their confirmed email; cannot change org_id, org_role, email, or token.
CREATE POLICY "verified invitee can accept invitation"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  lower(email) = lower(((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))::text)
  AND (SELECT u.email_confirmed_at FROM auth.users u WHERE u.id = auth.uid()) IS NOT NULL
)
WITH CHECK (
  lower(email) = lower(((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))::text)
  AND (SELECT u.email_confirmed_at FROM auth.users u WHERE u.id = auth.uid()) IS NOT NULL
  AND org_id = (SELECT i.org_id FROM public.invitations i WHERE i.id = invitations.id)
  AND org_role = (SELECT i.org_role FROM public.invitations i WHERE i.id = invitations.id)
  AND email = (SELECT i.email FROM public.invitations i WHERE i.id = invitations.id)
  AND token = (SELECT i.token FROM public.invitations i WHERE i.id = invitations.id)
);
