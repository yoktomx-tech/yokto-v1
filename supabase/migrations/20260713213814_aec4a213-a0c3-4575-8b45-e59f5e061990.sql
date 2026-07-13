
-- Ampliar enum de documentos KYC (aditivo, no rompe datos existentes)
ALTER TYPE public.kyc_document_type ADD VALUE IF NOT EXISTS 'ine_frente';
ALTER TYPE public.kyc_document_type ADD VALUE IF NOT EXISTS 'ine_reverso';
ALTER TYPE public.kyc_document_type ADD VALUE IF NOT EXISTS 'selfie_con_id';
ALTER TYPE public.kyc_document_type ADD VALUE IF NOT EXISTS 'cedula_fiscal';

-- Nivel de KYC
DO $$ BEGIN
  CREATE TYPE public.kyc_nivel AS ENUM ('basico','intermedio','avanzado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nivel de verificación CLABE
DO $$ BEGIN
  CREATE TYPE public.clabe_nivel AS ENUM ('algoritmica','penny_test','documental');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.clabe_status AS ENUM ('pending','verifying','verified','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ampliar profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS second_last_name       TEXT,
  ADD COLUMN IF NOT EXISTS curp                   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS birth_date             DATE,
  ADD COLUMN IF NOT EXISTS trade_name             TEXT,
  ADD COLUMN IF NOT EXISTS incorporation_date     DATE,
  ADD COLUMN IF NOT EXISTS fiscal_street          TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_ext_number      TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_int_number      TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_colonia         TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_municipio       TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_estado          TEXT,
  ADD COLUMN IF NOT EXISTS uso_cfdi_default       TEXT,
  ADD COLUMN IF NOT EXISTS legal_rep              JSONB,
  ADD COLUMN IF NOT EXISTS kyc_nivel              public.kyc_nivel NOT NULL DEFAULT 'basico',
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason   TEXT,
  ADD COLUMN IF NOT EXISTS kyc_approved_at        TIMESTAMPTZ;

-- CLABE verifications
CREATE TABLE IF NOT EXISTS public.clabe_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clabe TEXT NOT NULL,
  banco TEXT,
  nivel public.clabe_nivel NOT NULL DEFAULT 'algoritmica',
  status public.clabe_status NOT NULL DEFAULT 'pending',
  penny_test_code TEXT,
  penny_test_amount_cents INTEGER DEFAULT 1,
  penny_test_ref TEXT,
  penny_test_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clabe_verifications TO authenticated;
GRANT ALL ON public.clabe_verifications TO service_role;

ALTER TABLE public.clabe_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clabe_own_select" ON public.clabe_verifications;
CREATE POLICY "clabe_own_select" ON public.clabe_verifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "clabe_own_insert" ON public.clabe_verifications;
CREATE POLICY "clabe_own_insert" ON public.clabe_verifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "clabe_own_update" ON public.clabe_verifications;
CREATE POLICY "clabe_own_update" ON public.clabe_verifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "clabe_admin_all" ON public.clabe_verifications;
CREATE POLICY "clabe_admin_all" ON public.clabe_verifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS clabe_verifications_set_updated_at ON public.clabe_verifications;
CREATE TRIGGER clabe_verifications_set_updated_at
  BEFORE UPDATE ON public.clabe_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS clabe_verifications_user_idx ON public.clabe_verifications(user_id);

-- Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.audit_log TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_insert_any_auth" ON public.audit_log;
CREATE POLICY "audit_insert_any_auth" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "audit_select_admin" ON public.audit_log;
CREATE POLICY "audit_select_admin" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON public.audit_log(user_id);
