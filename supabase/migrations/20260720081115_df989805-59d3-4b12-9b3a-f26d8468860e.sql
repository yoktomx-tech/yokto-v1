
ALTER TABLE public.biometric_enrollments
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS start_ip text,
  ADD COLUMN IF NOT EXISTS start_user_agent text,
  ADD COLUMN IF NOT EXISTS start_geo jsonb,
  ADD COLUMN IF NOT EXISTS complete_ip text,
  ADD COLUMN IF NOT EXISTS complete_user_agent text,
  ADD COLUMN IF NOT EXISTS complete_geo jsonb;
