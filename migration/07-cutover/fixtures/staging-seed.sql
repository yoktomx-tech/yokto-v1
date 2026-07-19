-- =============================================================================
-- YOKTO — Seed exclusivo staging
-- =============================================================================
-- USO: sólo en el proyecto Supabase staging. NUNCA en producción.
-- Guardas al inicio abortan si el DB parece producción.
--
-- Contiene datos completamente ficticios:
-- - Correos @staging.yokto.test (dominio inexistente, reservado por RFC 6761).
-- - CURP, RFC, CLABE, teléfonos con formato válido pero valores no reales.
-- - Documentos referenciados con paths ficticios.
-- - Montos pequeños en centavos.
--
-- PROHIBIDO editar este archivo para insertar datos reales.
-- =============================================================================

-- Guard de entorno
DO $$
BEGIN
  IF current_database() NOT ILIKE '%postgres%' THEN
    RAISE EXCEPTION 'ABORT: unexpected database %', current_database();
  END IF;
  -- Verificar que no haya usuarios productivos reales (proxy heurístico)
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE email NOT LIKE '%@staging.yokto.test'
      AND email NOT LIKE '%@example.com'
      AND created_at < now() - interval '1 day'
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'ABORT: real-looking users detected. This seed is for a clean staging project only.';
  END IF;
END $$;

BEGIN;

-- =============================================================================
-- Organizaciones ficticias
-- =============================================================================
INSERT INTO public.organizations (id, name, type, owner_user_id)
VALUES
  ('11111111-1111-1111-1111-000000000001', 'ORG-ALPHA-STAGING', 'business', NULL),
  ('11111111-1111-1111-1111-000000000002', 'ORG-BETA-STAGING',  'business', NULL),
  ('11111111-1111-1111-1111-000000000003', 'ORG-GAMMA-STAGING', 'individual', NULL)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Usuarios ficticios (auth.users) — se crean con contraseña por defecto
-- 'StagingPass!2026' cifrada. NO es una contraseña productiva.
-- =============================================================================
DO $$
DECLARE
  users_spec text[][] := ARRAY[
    -- app_role
    ARRAY['20000000-0000-0000-0000-000000000001', 'buyer@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000002', 'seller@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000003', 'app-admin@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000004', 'buyer-and-seller@staging.yokto.test'],
    -- org_role (todos en ORG-ALPHA excepto donde se indique)
    ARRAY['20000000-0000-0000-0000-000000000010', 'owner@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000011', 'org-admin@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000012', 'finance@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000013', 'operator@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000014', 'viewer@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000015', 'auditor@staging.yokto.test'],
    -- internal_role
    ARRAY['20000000-0000-0000-0000-000000000020', 'super-admin@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000021', 'compliance@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000022', 'kyc-reviewer@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000023', 'doc-reviewer@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000024', 'dispute-mgr@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000025', 'finance-ops@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000026', 'support-agent@staging.yokto.test'],
    -- casos negativos
    ARRAY['20000000-0000-0000-0000-000000000090', 'no-membership@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000091', 'inactive-membership@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000092', 'revoked-internal@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000093', 'multi-org@staging.yokto.test'],
    ARRAY['20000000-0000-0000-0000-000000000094', 'double-internal@staging.yokto.test']
  ];
  spec text[];
BEGIN
  FOREACH spec SLICE 1 IN ARRAY users_spec LOOP
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      aud, role
    )
    VALUES (
      spec[1]::uuid, '00000000-0000-0000-0000-000000000000',
      spec[2],
      crypt('StagingPass!2026', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('staging', true, 'seed_version', '1'),
      'authenticated', 'authenticated'
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- =============================================================================
-- app_role assignments
-- =============================================================================
INSERT INTO public.user_roles (user_id, role) VALUES
  ('20000000-0000-0000-0000-000000000001'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'seller'),
  ('20000000-0000-0000-0000-000000000003'::uuid, 'admin'),
  -- coexistencia buyer + seller
  ('20000000-0000-0000-0000-000000000004'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000004'::uuid, 'seller'),
  -- roles org (todos requieren app_role básico para operar como usuarios)
  ('20000000-0000-0000-0000-000000000010'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000011'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000012'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000013'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000014'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000015'::uuid, 'buyer'),
  -- internos también son 'buyer' por default (para poder tener perfil)
  ('20000000-0000-0000-0000-000000000020'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000021'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000022'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000023'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000024'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000025'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000026'::uuid, 'buyer'),
  -- casos negativos: sí tienen buyer para probar RLS
  ('20000000-0000-0000-0000-000000000090'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000091'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000092'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000093'::uuid, 'buyer'),
  ('20000000-0000-0000-0000-000000000094'::uuid, 'buyer')
ON CONFLICT (user_id, role) DO NOTHING;

-- =============================================================================
-- Memberships (org_role) — usa nombre v2 durante la fase A/B
-- =============================================================================
-- Ajustar el nombre de tabla según etapa:
-- Etapa A/B: public.memberships_v2
-- Etapa D:   public.memberships
-- Aquí usamos memberships_v2 asumiendo Etapa A/B.

INSERT INTO public.memberships_v2 (org_id, user_id, org_role, status) VALUES
  ('11111111-1111-1111-1111-000000000001', '20000000-0000-0000-0000-000000000010', 'owner',    'active'),
  ('11111111-1111-1111-1111-000000000001', '20000000-0000-0000-0000-000000000011', 'admin',    'active'),
  ('11111111-1111-1111-1111-000000000001', '20000000-0000-0000-0000-000000000012', 'finance',  'active'),
  ('11111111-1111-1111-1111-000000000001', '20000000-0000-0000-0000-000000000013', 'operator', 'active'),
  ('11111111-1111-1111-1111-000000000001', '20000000-0000-0000-0000-000000000014', 'viewer',   'active'),
  ('11111111-1111-1111-1111-000000000001', '20000000-0000-0000-0000-000000000015', 'auditor',  'active'),
  -- buyer y seller también miembros de sus orgs personales (creadas por trigger)
  ('11111111-1111-1111-1111-000000000001', '20000000-0000-0000-0000-000000000001', 'operator', 'active'),
  ('11111111-1111-1111-1111-000000000002', '20000000-0000-0000-0000-000000000002', 'owner',    'active'),
  -- multi-org
  ('11111111-1111-1111-1111-000000000001', '20000000-0000-0000-0000-000000000093', 'operator', 'active'),
  ('11111111-1111-1111-1111-000000000002', '20000000-0000-0000-0000-000000000093', 'viewer',   'active'),
  -- membership inactiva (para caso negativo)
  ('11111111-1111-1111-1111-000000000001', '20000000-0000-0000-0000-000000000091', 'operator', 'suspended')
ON CONFLICT (org_id, user_id) DO NOTHING;

-- =============================================================================
-- internal_role_assignments
-- =============================================================================
INSERT INTO public.internal_role_assignments
  (user_id, rol, activo, granted_by, expira_at)
VALUES
  ('20000000-0000-0000-0000-000000000020', 'super_admin',       true,  NULL, NULL),
  ('20000000-0000-0000-0000-000000000021', 'compliance_officer', true, NULL, NULL),
  ('20000000-0000-0000-0000-000000000022', 'kyc_reviewer',      true,  NULL, NULL),
  ('20000000-0000-0000-0000-000000000023', 'document_reviewer', true,  NULL, NULL),
  ('20000000-0000-0000-0000-000000000024', 'dispute_manager',   true,  NULL, NULL),
  ('20000000-0000-0000-0000-000000000025', 'finance_ops',       true,  NULL, NULL),
  ('20000000-0000-0000-0000-000000000026', 'support_agent',     true,  NULL, NULL),
  -- caso negativo: internal revocado
  ('20000000-0000-0000-0000-000000000092', 'support_agent',     false, NULL, NULL);
-- Nota: double-internal (20000000-...-94) NO se pobla por seed porque debe
-- fallar el UNIQUE INDEX. Se prueba manualmente en el reporte.

-- =============================================================================
-- Transacciones ficticias
-- =============================================================================
INSERT INTO public.transactions
  (id, numero, buyer_org_id, seller_org_id, buyer_user_id, seller_user_id,
   amount_cents, currency, status, sector, description)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'YOKTO-STAGING-00001',
   '11111111-1111-1111-1111-000000000001', '11111111-1111-1111-1111-000000000002',
   '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
   100000, 'MXN', 'draft', 'servicios_profesionales',
   'Operación de prueba staging — servicios ficticios'),
  ('30000000-0000-0000-0000-000000000002', 'YOKTO-STAGING-00002',
   '11111111-1111-1111-1111-000000000001', '11111111-1111-1111-1111-000000000002',
   '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
   250000, 'MXN', 'funded', 'comercio',
   'Operación de prueba staging — fondeada')
ON CONFLICT (id) DO NOTHING;

-- Documentos ficticios
INSERT INTO public.kyc_documents
  (user_id, doc_type, status, storage_path)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'ine_frente',   'pending',  'kyc-documents/staging/fake-ine-frente.pdf'),
  ('20000000-0000-0000-0000-000000000001', 'ine_reverso',  'pending',  'kyc-documents/staging/fake-ine-reverso.pdf'),
  ('20000000-0000-0000-0000-000000000002', 'ine_frente',   'approved', 'kyc-documents/staging/fake-ine-seller.pdf')
ON CONFLICT DO NOTHING;

-- Disputa ficticia
INSERT INTO public.disputes
  (id, transaction_id, opened_by, opener_side, status, reason)
VALUES
  ('40000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000001', 'buyer', 'open',
   'Prueba staging — condiciones no cumplidas')
ON CONFLICT (id) DO NOTHING;

-- Ticket ficticio
INSERT INTO public.support_tickets
  (id, requester_user_id, org_id, subject, status, priority)
VALUES
  ('50000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-000000000001',
   'Prueba staging — consulta genérica', 'open', 'normal')
ON CONFLICT (id) DO NOTHING;

COMMIT;

RAISE NOTICE 'Staging seed applied.';
