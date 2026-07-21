-- 1) Verificación en profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Backfill: usuarios cuyo correo ya fue confirmado por Supabase Auth
UPDATE public.profiles p
SET email_verified_at = u.email_confirmed_at
FROM auth.users u
WHERE p.id = u.id
  AND u.email_confirmed_at IS NOT NULL
  AND p.email_verified_at IS NULL;

-- 2) Tabla de OTPs
CREATE TABLE IF NOT EXISTS public.email_verification_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'email_verification',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_otps_user_active
  ON public.email_verification_otps (user_id, consumed_at, expires_at DESC);

GRANT SELECT ON public.email_verification_otps TO authenticated;
GRANT ALL ON public.email_verification_otps TO service_role;

ALTER TABLE public.email_verification_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own otps"
  ON public.email_verification_otps
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Las inserciones/updates las hace el server con service role; ninguna policy para authenticated.

-- 3) Log de eventos de verificación (envíos, éxitos, fallos)
CREATE TABLE IF NOT EXISTS public.email_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  event TEXT NOT NULL, -- 'otp_sent' | 'otp_verified' | 'otp_failed' | 'otp_expired' | 'otp_resent'
  detail JSONB DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verif_log_user_created
  ON public.email_verification_log (user_id, created_at DESC);

GRANT SELECT ON public.email_verification_log TO authenticated;
GRANT ALL ON public.email_verification_log TO service_role;

ALTER TABLE public.email_verification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own verif log"
  ON public.email_verification_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
