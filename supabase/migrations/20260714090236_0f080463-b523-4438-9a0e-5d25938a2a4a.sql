
-- ============ ENUMS ============
CREATE TYPE public.org_type AS ENUM ('individual', 'business');
CREATE TYPE public.org_role AS ENUM ('owner', 'buyer_admin', 'buyer_user', 'seller_admin', 'seller_user', 'auditor');
CREATE TYPE public.platform_role AS ENUM ('compliance', 'dispute_manager', 'support', 'platform_admin');
CREATE TYPE public.membership_status AS ENUM ('active', 'invited', 'suspended', 'removed');
CREATE TYPE public.kyb_status AS ENUM ('not_started', 'in_review', 'approved', 'rejected');

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  type public.org_type NOT NULL DEFAULT 'individual',
  rfc TEXT,
  razon_social TEXT,
  regimen_fiscal TEXT,
  domicilio_fiscal JSONB,
  kyb_status public.kyb_status NOT NULL DEFAULT 'not_started',
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============ MEMBERSHIPS ============
CREATE TABLE public.memberships (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_role public.org_role NOT NULL,
  status public.membership_status NOT NULL DEFAULT 'active',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX idx_memberships_user ON public.memberships(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- ============ INVITATIONS ============
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  org_role public.org_role NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_email ON public.invitations(lower(email));
CREATE INDEX idx_invitations_org ON public.invitations(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- ============ PLATFORM ROLES (YOKTO staff) ============
CREATE TABLE public.platform_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.platform_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.platform_roles TO authenticated;
GRANT ALL ON public.platform_roles TO service_role;
ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;

-- ============ AUDIT EVENTS ============
CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org_created ON public.audit_events(org_id, created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_events(entity_type, entity_id);
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE org_id = _org_id AND user_id = _user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id UUID, _user_id UUID, _role public.org_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE org_id = _org_id AND user_id = _user_id AND status = 'active' AND org_role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_platform_role(_user_id UUID, _role public.platform_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_org_role(_org_id, _user_id, 'owner');
$$;

-- ============ RLS POLICIES ============

-- organizations
CREATE POLICY "org members can view" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()) OR public.has_platform_role(auth.uid(), 'platform_admin'));

CREATE POLICY "authenticated can create org" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "owner can update org" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_owner(id, auth.uid()) OR public.has_platform_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.is_org_owner(id, auth.uid()) OR public.has_platform_role(auth.uid(), 'platform_admin'));

CREATE POLICY "owner can delete org" ON public.organizations
  FOR DELETE TO authenticated
  USING (public.is_org_owner(id, auth.uid()));

-- memberships
CREATE POLICY "org members can view memberships" ON public.memberships
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()) OR user_id = auth.uid() OR public.has_platform_role(auth.uid(), 'platform_admin'));

CREATE POLICY "owner can insert memberships" ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_owner(org_id, auth.uid())
    OR (user_id = auth.uid() AND org_role = 'owner') -- self-create on org creation
  );

CREATE POLICY "owner can update memberships" ON public.memberships
  FOR UPDATE TO authenticated
  USING (public.is_org_owner(org_id, auth.uid()))
  WITH CHECK (public.is_org_owner(org_id, auth.uid()));

CREATE POLICY "owner or self can delete membership" ON public.memberships
  FOR DELETE TO authenticated
  USING (public.is_org_owner(org_id, auth.uid()) OR user_id = auth.uid());

-- invitations
CREATE POLICY "owner can view org invitations" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    public.is_org_owner(org_id, auth.uid())
    OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );

CREATE POLICY "owner can create invitations" ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner(org_id, auth.uid()));

CREATE POLICY "owner or invitee can update invitation" ON public.invitations
  FOR UPDATE TO authenticated
  USING (
    public.is_org_owner(org_id, auth.uid())
    OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );

CREATE POLICY "owner can delete invitations" ON public.invitations
  FOR DELETE TO authenticated
  USING (public.is_org_owner(org_id, auth.uid()));

-- platform_roles
CREATE POLICY "platform_admin can view" ON public.platform_roles
  FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'platform_admin') OR user_id = auth.uid());

CREATE POLICY "platform_admin can manage" ON public.platform_roles
  FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'platform_admin'));

-- audit_events
CREATE POLICY "org members can view audit" ON public.audit_events
  FOR SELECT TO authenticated
  USING (
    (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid()))
    OR actor_user_id = auth.uid()
    OR public.has_platform_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "authenticated can insert audit" ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

-- ============ TRIGGERS ============
CREATE TRIGGER trg_orgs_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_memberships_updated_at BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend handle_new_user to create personal org + owner membership
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  display_name TEXT;
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url)
  VALUES (
    NEW.id, NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;

  display_name := COALESCE(
    NULLIF(TRIM(CONCAT_WS(' ', NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'last_name')), ''),
    split_part(NEW.email, '@', 1),
    'Mi organización'
  );

  INSERT INTO public.organizations (name, type, owner_user_id)
  VALUES (display_name, 'individual', NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.memberships (org_id, user_id, org_role, status)
  VALUES (new_org_id, NEW.id, 'owner', 'active');

  RETURN NEW;
END;
$$;

-- ============ BACKFILL ============
-- Create personal org for every existing user without one
DO $$
DECLARE
  u RECORD;
  new_org_id UUID;
  display_name TEXT;
BEGIN
  FOR u IN
    SELECT au.id, au.email, p.first_name, p.last_name
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = au.id)
  LOOP
    display_name := COALESCE(
      NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
      split_part(u.email, '@', 1),
      'Mi organización'
    );
    INSERT INTO public.organizations (name, type, owner_user_id)
    VALUES (display_name, 'individual', u.id)
    RETURNING id INTO new_org_id;

    INSERT INTO public.memberships (org_id, user_id, org_role, status)
    VALUES (new_org_id, u.id, 'owner', 'active');
  END LOOP;
END $$;

-- Migrate existing admins to platform_admin
INSERT INTO public.platform_roles (user_id, role)
SELECT user_id, 'platform_admin'::public.platform_role
FROM public.user_roles WHERE role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;
