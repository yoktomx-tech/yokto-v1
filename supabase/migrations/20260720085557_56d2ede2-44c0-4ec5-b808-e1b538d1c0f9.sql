
-- Extend invitations for invitee-onboarding module
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS curp_rfc TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS nubarium_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS second_last_name TEXT;

-- Force 48h vigencia for new invitations
ALTER TABLE public.invitations
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '48 hours');

-- Public read of invitation by token (needed for guest onboarding page).
-- Only exposes rows queried by exact token (no listing) via server functions.
DROP POLICY IF EXISTS "public can read invitation by token" ON public.invitations;
CREATE POLICY "public can read invitation by token"
  ON public.invitations
  FOR SELECT
  TO anon
  USING (true);

GRANT SELECT ON public.invitations TO anon;
