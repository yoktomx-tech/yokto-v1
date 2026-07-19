-- =============================================================================
-- YOKTO — Tablas del modelo oficial de roles
-- =============================================================================

-- ---------------------------------------------------------------------------
-- user_roles: roles GLOBALES de plataforma (buyer, seller, admin)
-- Un usuario puede tener múltiples roles (buyer + seller convive).
-- Todo usuario nuevo recibe 'buyer' vía trigger handle_new_user.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role_v2 NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL    ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Un usuario ve sus propios roles.
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Solo service_role o super_admin insertan/actualizan/eliminan roles.
CREATE POLICY user_roles_admin_all ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_internal_role('super_admin'))
  WITH CHECK (public.has_internal_role('super_admin'));

CREATE INDEX IF NOT EXISTS ix_user_roles_user   ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS ix_user_roles_role   ON public.user_roles(role);


-- ---------------------------------------------------------------------------
-- memberships: pertenencia de usuarios a organizaciones + rol organizacional
-- Un usuario puede tener múltiples roles en la misma organización.
-- Roles: owner, admin, finance, operator, viewer, auditor.
-- ---------------------------------------------------------------------------
-- La tabla `organizations` ya existe en el esquema actual — se preserva.
-- La tabla `memberships` también existe pero con enum legacy; se recrea aquí
-- con el enum v2. El backfill (script 13) migra los datos.

CREATE TABLE IF NOT EXISTS public.memberships_v2 (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            public.org_role_v2 NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended','revoked')),
  invited_by      uuid REFERENCES auth.users(id),
  joined_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, role)
);

GRANT SELECT, INSERT, UPDATE ON public.memberships_v2 TO authenticated;
GRANT ALL ON public.memberships_v2 TO service_role;

ALTER TABLE public.memberships_v2 ENABLE ROW LEVEL SECURITY;

-- SELECT: veo mis membresías + membresías de orgs donde soy owner/admin.
CREATE POLICY memberships_v2_select ON public.memberships_v2
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role_v2[])
    OR public.has_internal_role('super_admin')
  );

-- INSERT: solo owner/admin de la org (o super_admin) invitan miembros.
CREATE POLICY memberships_v2_insert ON public.memberships_v2
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role_v2[])
    OR public.has_internal_role('super_admin')
  );

-- UPDATE: owner/admin puede cambiar rol/status; el propio usuario puede aceptar (status='active').
CREATE POLICY memberships_v2_update_admin ON public.memberships_v2
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role_v2[]) OR public.has_internal_role('super_admin'))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role_v2[]) OR public.has_internal_role('super_admin'));

CREATE POLICY memberships_v2_update_self_accept ON public.memberships_v2
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'invited')
  WITH CHECK (user_id = auth.uid() AND status = 'active');

-- DELETE: solo owner o super_admin.
CREATE POLICY memberships_v2_delete ON public.memberships_v2
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner']::public.org_role_v2[]) OR public.has_internal_role('super_admin'));

CREATE INDEX IF NOT EXISTS ix_memberships_v2_org  ON public.memberships_v2(organization_id);
CREATE INDEX IF NOT EXISTS ix_memberships_v2_user ON public.memberships_v2(user_id);
CREATE INDEX IF NOT EXISTS ix_memberships_v2_role ON public.memberships_v2(role);


-- ---------------------------------------------------------------------------
-- internal_role_assignments: acceso al backoffice YOKTO.
-- Máximo UNA asignación activa por usuario (índice único parcial).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_role_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         public.internal_role_v2 NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  assigned_by  uuid REFERENCES auth.users(id),
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  revoked_by   uuid REFERENCES auth.users(id),
  revoked_at   timestamptz,
  reason       text
);

GRANT SELECT ON public.internal_role_assignments TO authenticated;
GRANT ALL    ON public.internal_role_assignments TO service_role;

ALTER TABLE public.internal_role_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_role_assignments_select_own ON public.internal_role_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_internal_role('super_admin'));

CREATE POLICY internal_role_assignments_super_admin_manage ON public.internal_role_assignments
  FOR ALL TO authenticated
  USING (public.has_internal_role('super_admin'))
  WITH CHECK (public.has_internal_role('super_admin'));

-- CRÍTICO: máximo una asignación activa por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS internal_role_assignments_one_active_per_user
  ON public.internal_role_assignments (user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS ix_internal_role_assignments_role_active
  ON public.internal_role_assignments (role) WHERE is_active = true;
