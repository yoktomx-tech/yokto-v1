-- =============================================================================
-- YOKTO — Modelo OFICIAL de roles (reemplaza los enums legacy)
-- =============================================================================
-- app_role: buyer, seller, admin
-- org_role: owner, admin, finance, operator, viewer, auditor
-- internal_role: super_admin, compliance_officer, kyc_reviewer,
--                document_reviewer, dispute_manager, finance_ops, support_agent
--
-- Los tres niveles son INDEPENDIENTES y ACUMULABLES. Ningún rol de un nivel
-- concede automáticamente permisos de otro. El acceso al backoffice requiere
-- OBLIGATORIAMENTE un registro activo en internal_role_assignments.
-- =============================================================================

-- app_role oficial (buyer, seller, admin)
DO $$ BEGIN
  CREATE TYPE public.app_role_v2 AS ENUM ('buyer', 'seller', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- org_role oficial (owner, admin, finance, operator, viewer, auditor)
-- Reemplaza legacy: owner, buyer_admin, buyer_user, seller_admin, seller_user, auditor
DO $$ BEGIN
  CREATE TYPE public.org_role_v2 AS ENUM (
    'owner',
    'admin',
    'finance',
    'operator',
    'viewer',
    'auditor'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- internal_role oficial (7 valores)
-- Reemplaza legacy: YOKTO_SUPER_ADMIN, ANALISTA_KYC, ANALISTA_DOCUMENTAL,
--                   OFICIAL_CUMPLIMIENTO, AGENTE_ESCROW, AGENTE_SOPORTE,
--                   ANALISTA_FINANCIERO
DO $$ BEGIN
  CREATE TYPE public.internal_role_v2 AS ENUM (
    'super_admin',
    'compliance_officer',
    'kyc_reviewer',
    'document_reviewer',
    'dispute_manager',
    'finance_ops',
    'support_agent'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- NOTA: creamos los enums con sufijo `_v2` para poder coexistir con los legacy
-- durante la migración. El script 13_role_data_backfill.sql migra los datos
-- y el script 15_finalize_role_rename.sql renombra los tipos al final.
