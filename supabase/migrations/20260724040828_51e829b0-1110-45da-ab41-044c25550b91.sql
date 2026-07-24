UPDATE public.invitations
SET expires_at = now() + interval '48 hours', accepted_at = NULL
WHERE email = 'luishb.mzt@gmail.com';