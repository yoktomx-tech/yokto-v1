-- =============================================================================
-- YOKTO — Backfill de roles legacy → modelo oficial
-- =============================================================================
-- Se ejecuta DESPUÉS de crear:
--   10_new_role_enums.sql
--   11_new_role_tables.sql
--   12_authz_functions.sql
-- Y ANTES de reescribir RLS (14_new_rls_policies.sql).
--
-- IMPORTANTE: se apoya en las tablas legacy `user_roles` (con app_role viejo)
-- y `memberships` (con org_role viejo). Éstas se preservan durante la
-- migración; el script 15_finalize_role_rename.sql las elimina/renombra al
-- final del corte.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Backfill user_roles (app_role legacy → app_role_v2)
-- Actual legacy: 'buyer', 'seller', 'admin' — coinciden 1:1.
-- ---------------------------------------------------------------------------
INSERT INTO public.user_roles (id, user_id, role, created_at)
SELECT ur.id, ur.user_id, ur.role::text::public.app_role_v2, ur.created_at
FROM public.user_roles_legacy ur  -- ver 15_finalize_role_rename.sql
ON CONFLICT (user_id, role) DO NOTHING;

-- Si la tabla legacy aún se llama user_roles (antes del rename):
-- Alternativa idempotente por si backfill se corre con el nombre viejo:
--   INSERT INTO public.user_roles_v2 (user_id, role, created_at)
--   SELECT user_id, role::text::public.app_role_v2, created_at
--   FROM public.user_roles ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Backfill memberships (org_role legacy → org_role_v2)
-- Mapeo:
--   owner        → owner
--   buyer_admin  → admin
--   buyer_user   → operator
--   seller_admin → admin
--   seller_user  → operator
--   auditor      → auditor
-- (Notas: buyer/seller distinción se pierde a nivel org — se mantiene a
--  nivel app_role global; los nuevos roles finance y viewer se asignan
--  manualmente después del corte según necesidad.)
-- ---------------------------------------------------------------------------
INSERT INTO public.memberships_v2 (
  id, organization_id, user_id, role, status, invited_by, joined_at, created_at, updated_at
)
SELECT
  m.id,
  m.org_id,
  m.user_id,
  CASE m.org_role::text
    WHEN 'owner'        THEN 'owner'::public.org_role_v2
    WHEN 'buyer_admin'  THEN 'admin'::public.org_role_v2
    WHEN 'seller_admin' THEN 'admin'::public.org_role_v2
    WHEN 'buyer_user'   THEN 'operator'::public.org_role_v2
    WHEN 'seller_user'  THEN 'operator'::public.org_role_v2
    WHEN 'auditor'      THEN 'auditor'::public.org_role_v2
    ELSE 'viewer'::public.org_role_v2   -- fallback defensivo
  END,
  COALESCE(m.status::text, 'active'),
  m.invited_by,
  m.joined_at,
  m.created_at,
  m.updated_at
FROM public.memberships_legacy m  -- ver 15_finalize_role_rename.sql
ON CONFLICT (organization_id, user_id, role) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Backfill internal_role_assignments (internal_role legacy → internal_role_v2)
-- Mapeo:
--   YOKTO_SUPER_ADMIN     → super_admin
--   OFICIAL_CUMPLIMIENTO  → compliance_officer
--   ANALISTA_KYC          → kyc_reviewer
--   ANALISTA_DOCUMENTAL   → document_reviewer
--   AGENTE_ESCROW         → dispute_manager
--   ANALISTA_FINANCIERO   → finance_ops
--   AGENTE_SOPORTE        → support_agent
-- Sólo se migra el registro activo (activo=true, no expirado); si un usuario
-- tuviera múltiples activos legacy, se conserva el más reciente para respetar
-- el índice único parcial.
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    ira.id,
    ira.user_id,
    CASE ira.rol::text
      WHEN 'YOKTO_SUPER_ADMIN'    THEN 'super_admin'
      WHEN 'OFICIAL_CUMPLIMIENTO' THEN 'compliance_officer'
      WHEN 'ANALISTA_KYC'         THEN 'kyc_reviewer'
      WHEN 'ANALISTA_DOCUMENTAL'  THEN 'document_reviewer'
      WHEN 'AGENTE_ESCROW'        THEN 'dispute_manager'
      WHEN 'ANALISTA_FINANCIERO'  THEN 'finance_ops'
      WHEN 'AGENTE_SOPORTE'       THEN 'support_agent'
      ELSE NULL
    END::public.internal_role_v2 AS new_role,
    ira.activo,
    ira.expira_at,
    ira.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY ira.user_id
      ORDER BY ira.created_at DESC
    ) AS rn
  FROM public.internal_role_assignments_legacy ira
  WHERE ira.activo = true
    AND (ira.expira_at IS NULL OR ira.expira_at > now())
)
INSERT INTO public.internal_role_assignments (
  id, user_id, role, is_active, assigned_at
)
SELECT id, user_id, new_role, true, created_at
FROM ranked
WHERE rn = 1 AND new_role IS NOT NULL
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sanity checks (para reporte de conciliación)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  legacy_users     integer;
  new_users        integer;
  legacy_mem       integer;
  new_mem          integer;
  legacy_internal  integer;
  new_internal     integer;
BEGIN
  SELECT count(DISTINCT user_id) INTO legacy_users FROM public.user_roles_legacy;
  SELECT count(DISTINCT user_id) INTO new_users    FROM public.user_roles;
  SELECT count(*) INTO legacy_mem  FROM public.memberships_legacy WHERE status = 'active';
  SELECT count(*) INTO new_mem     FROM public.memberships_v2     WHERE status = 'active';
  SELECT count(*) INTO legacy_internal FROM public.internal_role_assignments_legacy WHERE activo=true;
  SELECT count(*) INTO new_internal    FROM public.internal_role_assignments WHERE is_active=true;

  RAISE NOTICE 'Backfill conciliación:';
  RAISE NOTICE '  user_roles: legacy=% new=% (esperado igual o mayor por trigger buyer)', legacy_users, new_users;
  RAISE NOTICE '  memberships activas: legacy=% new=%', legacy_mem, new_mem;
  RAISE NOTICE '  internal roles activos: legacy=% new=%', legacy_internal, new_internal;
END $$;
