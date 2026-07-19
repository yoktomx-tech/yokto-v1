-- =============================================================================
-- YOKTO — Suite de verificación post-migración
-- Ejecutar en el proyecto DESTINO después de correr 01..14.
-- Cada bloque devuelve `ok`/`FAIL` para trazabilidad.
-- =============================================================================

\echo '── 1) Extensiones requeridas ──'
SELECT extname, CASE WHEN extname IS NOT NULL THEN 'ok' ELSE 'FAIL' END AS status
FROM pg_extension WHERE extname IN ('pgcrypto','pg_net','pg_cron');

\echo '── 2) Tipos oficiales presentes ──'
SELECT typname, CASE WHEN typname IN ('app_role','org_role','internal_role') THEN 'ok' ELSE 'unexpected' END
FROM pg_type WHERE typnamespace = 'public'::regnamespace
  AND typname IN ('app_role','org_role','internal_role','app_role_v2','org_role_v2','internal_role_v2');

\echo '── 3) Conteo de tablas (esperado: 51 en Cloud actual) ──'
SELECT count(*) AS public_tables FROM pg_tables WHERE schemaname='public';

\echo '── 4) RLS habilitado en cada tabla de public ──'
SELECT relname, relrowsecurity AS rls_on
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND relkind='r' AND relrowsecurity=false;
-- Debe devolver 0 filas.

\echo '── 5) Tablas sin al menos una policy ──'
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname=t.schemaname AND p.tablename=t.tablename
WHERE t.schemaname='public'
GROUP BY t.tablename HAVING count(p.policyname)=0;
-- Debe devolver 0 filas.

\echo '── 6) Funciones authz creadas ──'
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'has_app_role','has_any_app_role','has_org_role','is_active_org_member',
    'has_internal_role','has_any_internal_role','can_access_backoffice',
    'can_manage_transaction','can_fund_transaction','can_approve_release',
    'can_upload_evidence','can_manage_members','can_manage_bank_account',
    'can_review_kyc','can_review_documents','can_manage_disputes','can_manage_finance_ops'
  )
ORDER BY proname;
-- Deben aparecer 17 filas.

\echo '── 7) Conteo de datos por tabla (comparar con origen) ──'
SELECT tablename, (xpath('/row/c/text()',
       query_to_xml(format('SELECT count(*) AS c FROM public.%I', tablename), true, false, '')))[1]::text::int AS n
FROM pg_tables WHERE schemaname='public'
ORDER BY tablename;

\echo '── 8) Buckets de storage ──'
SELECT name, public FROM storage.buckets ORDER BY name;
-- Esperado: 6 buckets, todos public=false.

\echo '── 9) Trigger on_auth_user_created activo ──'
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'on_auth_user_created';

\echo '── 10) Sequences con valor > 0 (numeración de folios) ──'
SELECT sequence_name, last_value
FROM information_schema.sequences s
JOIN pg_sequences ps ON ps.sequencename = s.sequence_name
WHERE s.sequence_schema='public'
  AND s.sequence_name IN ('dispute_numero_seq','transaction_numero_seq','support_ticket_numero_seq');

\echo '── 11) Realtime publications ──'
SELECT schemaname, tablename FROM pg_publication_tables
WHERE pubname='supabase_realtime' ORDER BY schemaname, tablename;

\echo '── 12) Índice único activo en internal_role_assignments ──'
SELECT indexname FROM pg_indexes
WHERE schemaname='public' AND indexname='internal_role_assignments_one_active_per_user';

\echo 'Verificación completa.'
