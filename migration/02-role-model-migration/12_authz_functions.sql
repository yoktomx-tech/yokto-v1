-- =============================================================================
-- YOKTO — Funciones de autorización (SECURITY DEFINER, search_path fijo)
-- =============================================================================
-- Todas evitan recursión (nunca consultan la tabla protegida por la policy
-- que las usa). Todas son STABLE, se pueden usar en RLS sin performance hit.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- has_app_role: ¿tiene el usuario actual (o el especificado) este rol global?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_app_role(
  _role    public.app_role_v2,
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ---------------------------------------------------------------------------
-- has_any_app_role: ¿tiene alguno de estos roles globales?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_any_app_role(
  _roles   public.app_role_v2[],
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- is_active_org_member: ¿es miembro activo de la organización?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_org_member(
  _org_id  uuid,
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships_v2
    WHERE organization_id = _org_id
      AND user_id = _user_id
      AND status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- has_org_role: ¿tiene alguno de estos roles en la organización?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_org_role(
  _org_id  uuid,
  _roles   public.org_role_v2[],
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships_v2
    WHERE organization_id = _org_id
      AND user_id = _user_id
      AND status = 'active'
      AND role = ANY(_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- has_internal_role: ¿tiene una asignación interna activa con este rol?
-- Fuente ÚNICA para acceso al backoffice. Rechaza silenciosamente cualquier
-- app_role='admin' o org_role='owner' — esos NO conceden acceso interno.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_internal_role(
  _role    public.internal_role_v2,
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_role_assignments
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
  );
$$;

-- ---------------------------------------------------------------------------
-- has_any_internal_role: ¿tiene asignación interna activa con alguno de estos?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_any_internal_role(
  _roles   public.internal_role_v2[],
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_role_assignments
    WHERE user_id = _user_id
      AND role = ANY(_roles)
      AND is_active = true
  );
$$;

-- ---------------------------------------------------------------------------
-- can_access_backoffice: gate único del backoffice (/backoffice/*)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_backoffice(
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_role_assignments
    WHERE user_id = _user_id AND is_active = true
  );
$$;

-- ---------------------------------------------------------------------------
-- Helpers de dominio (composición)
-- ---------------------------------------------------------------------------

-- ¿Puede crear operaciones en la org? owner/admin/operator.
CREATE OR REPLACE FUNCTION public.can_manage_transaction(
  _org_id  uuid,
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_org_role(_org_id,
    ARRAY['owner','admin','operator']::public.org_role_v2[],
    _user_id);
$$;

-- ¿Puede fondear? Comprador con rol org owner/admin/finance/operator.
CREATE OR REPLACE FUNCTION public.can_fund_transaction(
  _org_id  uuid,
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_app_role('buyer', _user_id)
     AND public.has_org_role(_org_id,
           ARRAY['owner','admin','finance','operator']::public.org_role_v2[],
           _user_id);
$$;

-- ¿Puede aprobar liberaciones? owner/admin (siempre requiere reautenticación en app).
CREATE OR REPLACE FUNCTION public.can_approve_release(
  _org_id  uuid,
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_org_role(_org_id,
    ARRAY['owner','admin']::public.org_role_v2[],
    _user_id);
$$;

-- ¿Puede subir evidencia? owner/admin/operator.
CREATE OR REPLACE FUNCTION public.can_upload_evidence(
  _org_id  uuid,
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_org_role(_org_id,
    ARRAY['owner','admin','operator']::public.org_role_v2[],
    _user_id);
$$;

-- ¿Puede gestionar miembros? owner + admin (con límites de escalamiento
-- verificados a nivel de aplicación: admin no puede promover a owner).
CREATE OR REPLACE FUNCTION public.can_manage_members(
  _org_id  uuid,
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_org_role(_org_id,
    ARRAY['owner','admin']::public.org_role_v2[],
    _user_id);
$$;

-- ¿Puede gestionar cuentas bancarias? owner + finance.
CREATE OR REPLACE FUNCTION public.can_manage_bank_account(
  _org_id  uuid,
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_org_role(_org_id,
    ARRAY['owner','finance']::public.org_role_v2[],
    _user_id);
$$;

-- Backoffice específicos
CREATE OR REPLACE FUNCTION public.can_review_kyc(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_internal_role(
    ARRAY['super_admin','kyc_reviewer','compliance_officer']::public.internal_role_v2[],
    _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_review_documents(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_internal_role(
    ARRAY['super_admin','document_reviewer','compliance_officer']::public.internal_role_v2[],
    _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_disputes(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_internal_role(
    ARRAY['super_admin','dispute_manager']::public.internal_role_v2[],
    _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_finance_ops(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_internal_role(
    ARRAY['super_admin','finance_ops']::public.internal_role_v2[],
    _user_id);
$$;

-- ---------------------------------------------------------------------------
-- Trigger handle_new_user_v2: al crear auth.users, crea profile + rol buyer.
-- IDEMPOTENTE. Reemplaza el trigger legacy handle_new_user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_v2()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- 1) Profile
  INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url)
  VALUES (
    NEW.id, NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2) Rol global 'buyer' por defecto
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ligar el trigger a auth.users (reemplaza el anterior handle_new_user).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_v2();
