
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('buyer', 'seller', 'admin', 'verifier', 'mediator');
CREATE TYPE public.account_type AS ENUM ('persona_fisica', 'persona_moral');
CREATE TYPE public.kyc_status AS ENUM ('pending', 'in_review', 'approved', 'rejected');
CREATE TYPE public.kyc_document_type AS ENUM ('ine', 'passport', 'proof_of_address', 'acta_constitutiva', 'constancia_fiscal', 'poder_notarial', 'other');
CREATE TYPE public.industry_sector AS ENUM ('autotransporte', 'construccion', 'inmobiliario', 'vehiculos', 'servicios_profesionales', 'comercio', 'manufactura', 'otro');

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  account_type public.account_type,
  industry_sector public.industry_sector,
  -- Datos fiscales MX
  legal_name TEXT,
  rfc TEXT,
  regimen_fiscal TEXT,
  uso_cfdi TEXT,
  fiscal_address TEXT,
  fiscal_postal_code TEXT,
  -- KYC
  kyc_status public.kyc_status NOT NULL DEFAULT 'pending',
  kyc_completed_at TIMESTAMPTZ,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- USER_ROLES
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =========================================
-- KYC_DOCUMENTS
-- =========================================
CREATE TABLE public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type public.kyc_document_type NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_documents TO authenticated;
GRANT ALL ON public.kyc_documents TO service_role;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

-- =========================================
-- RLS POLICIES — profiles
-- =========================================
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Verifiers view profiles for KYC"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'verifier'));

-- =========================================
-- RLS POLICIES — user_roles
-- =========================================
CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- RLS POLICIES — kyc_documents
-- =========================================
CREATE POLICY "Users view own kyc documents"
  ON public.kyc_documents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own kyc documents"
  ON public.kyc_documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own pending kyc documents"
  ON public.kyc_documents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Verifiers view all kyc documents"
  ON public.kyc_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'verifier') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Verifiers update kyc documents"
  ON public.kyc_documents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'verifier') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'verifier') OR public.has_role(auth.uid(), 'admin'));

-- =========================================
-- TRIGGERS: updated_at
-- =========================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER kyc_documents_set_updated_at
  BEFORE UPDATE ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- TRIGGER: auto-create profile + default 'buyer' role on signup
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
