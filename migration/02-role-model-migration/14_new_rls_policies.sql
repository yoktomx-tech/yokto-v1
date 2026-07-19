-- =============================================================================
-- YOKTO — Reescritura RLS con modelo oficial de roles
-- =============================================================================
-- Se ejecuta DESPUÉS de 10..13. Usa exclusivamente las funciones can_*/has_*
-- definidas en 12_authz_functions.sql. Todas las policies legacy son
-- reemplazadas — este archivo primero DROPea y luego CREA.
--
-- Convención por tabla:
--   SELECT: quien pueda leer según matriz (org member + backoffice scoping).
--   INSERT/UPDATE/DELETE: quien pueda gestionar según matriz.
--   Todo `service_role` bypass sigue funcionando (bypass RLS integrado).
--
-- CRÍTICO: se asume que el modelo v2 ya se instaló y todas las tablas
-- de dominio (transactions, disputes, etc.) tienen columna `org_id` o equivalente
-- que enlaza al recurso. Si no la tienen (recursos globales/públicos) se marca
-- explícitamente.
-- =============================================================================

-- Helper para dropear todas las policies de una tabla (idempotente).
CREATE OR REPLACE FUNCTION public._migration_drop_all_policies(_table regclass)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = split_part(_table::text, '.', 1)
             AND tablename  = split_part(_table::text, '.', 2)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', r.policyname, _table::text);
  END LOOP;
END $$;

-- =============================================================================
-- CATÁLOGOS PÚBLICOS (lectura anónima permitida)
-- =============================================================================

SELECT public._migration_drop_all_policies('public.help_articles');
CREATE POLICY help_articles_public_read ON public.help_articles
  FOR SELECT TO anon, authenticated
  USING (is_published = true);
CREATE POLICY help_articles_backoffice_manage ON public.help_articles
  FOR ALL TO authenticated
  USING (public.has_any_internal_role(ARRAY['super_admin','support_agent']::public.internal_role_v2[]))
  WITH CHECK (public.has_any_internal_role(ARRAY['super_admin','support_agent']::public.internal_role_v2[]));

SELECT public._migration_drop_all_policies('public.help_categories');
CREATE POLICY help_categories_public_read ON public.help_categories
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY help_categories_backoffice_manage ON public.help_categories
  FOR ALL TO authenticated
  USING (public.has_any_internal_role(ARRAY['super_admin','support_agent']::public.internal_role_v2[]))
  WITH CHECK (public.has_any_internal_role(ARRAY['super_admin','support_agent']::public.internal_role_v2[]));

SELECT public._migration_drop_all_policies('public.postal_code_lookups');
CREATE POLICY postal_code_lookups_read ON public.postal_code_lookups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY postal_code_lookups_write_service ON public.postal_code_lookups
  FOR INSERT TO authenticated WITH CHECK (true); -- cache inserts vía server fn

-- =============================================================================
-- PERFIL Y ROLES DEL USUARIO
-- =============================================================================

SELECT public._migration_drop_all_policies('public.profiles');
CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.can_review_kyc()
    OR public.can_access_backoffice()
  );
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_insert_self ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_backoffice_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.can_review_kyc())
  WITH CHECK (public.can_review_kyc());

-- user_roles: policies ya definidas en 11_new_role_tables.sql

-- platform_roles y legacy: se retiran en finalize (15_)
SELECT public._migration_drop_all_policies('public.platform_roles');
CREATE POLICY platform_roles_readonly ON public.platform_roles
  FOR SELECT TO authenticated
  USING (public.has_internal_role('super_admin'));

-- =============================================================================
-- ORGANIZACIONES Y MEMBRESÍAS
-- =============================================================================

SELECT public._migration_drop_all_policies('public.organizations');
CREATE POLICY organizations_select_members ON public.organizations
  FOR SELECT TO authenticated
  USING (
    public.is_active_org_member(id)
    OR public.can_access_backoffice()
  );
CREATE POLICY organizations_insert_authenticated ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY organizations_update_owner_admin ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(id, ARRAY['owner','admin']::public.org_role_v2[]))
  WITH CHECK (public.has_org_role(id, ARRAY['owner','admin']::public.org_role_v2[]));
CREATE POLICY organizations_delete_owner ON public.organizations
  FOR DELETE TO authenticated
  USING (public.has_org_role(id, ARRAY['owner']::public.org_role_v2[]));

-- memberships legacy (se elimina en 15_): sin nuevas policies aquí.
-- memberships_v2: policies ya definidas en 11_.

SELECT public._migration_drop_all_policies('public.invitations');
CREATE POLICY invitations_select_admin_or_invitee ON public.invitations
  FOR SELECT TO authenticated
  USING (
    public.can_manage_members(org_id)
    OR email = auth.email()
    OR public.can_access_backoffice()
  );
CREATE POLICY invitations_insert_admin ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_members(org_id));
CREATE POLICY invitations_delete_admin ON public.invitations
  FOR DELETE TO authenticated
  USING (public.can_manage_members(org_id));
CREATE POLICY invitations_update_admin ON public.invitations
  FOR UPDATE TO authenticated
  USING (public.can_manage_members(org_id))
  WITH CHECK (public.can_manage_members(org_id));
CREATE POLICY invitations_update_invitee_accept ON public.invitations
  FOR UPDATE TO authenticated
  USING (email = auth.email() AND accepted_at IS NULL)
  WITH CHECK (email = auth.email() AND accepted_by = auth.uid());

-- =============================================================================
-- KYC, VERIFICACIONES, BIOMETRÍA
-- =============================================================================

SELECT public._migration_drop_all_policies('public.kyc_documents');
CREATE POLICY kyc_documents_select_own_or_reviewer ON public.kyc_documents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_review_kyc());
CREATE POLICY kyc_documents_insert_self ON public.kyc_documents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY kyc_documents_update_reviewer ON public.kyc_documents
  FOR UPDATE TO authenticated
  USING (public.can_review_kyc()) WITH CHECK (public.can_review_kyc());
CREATE POLICY kyc_documents_delete_reviewer ON public.kyc_documents
  FOR DELETE TO authenticated USING (public.can_review_kyc());

SELECT public._migration_drop_all_policies('public.curp_verifications');
CREATE POLICY curp_verifications_own ON public.curp_verifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_review_kyc());
CREATE POLICY curp_verifications_insert_own ON public.curp_verifications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

SELECT public._migration_drop_all_policies('public.clabe_verifications');
CREATE POLICY clabe_verifications_own ON public.clabe_verifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_finance_ops()
    OR public.can_review_kyc()
  );
CREATE POLICY clabe_verifications_insert_own ON public.clabe_verifications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY clabe_verifications_update_ops ON public.clabe_verifications
  FOR UPDATE TO authenticated
  USING (public.can_manage_finance_ops()) WITH CHECK (public.can_manage_finance_ops());

SELECT public._migration_drop_all_policies('public.biometric_enrollments');
CREATE POLICY biometric_enrollments_own ON public.biometric_enrollments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_review_kyc());
CREATE POLICY biometric_enrollments_insert_own ON public.biometric_enrollments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY biometric_enrollments_update_reviewer ON public.biometric_enrollments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_review_kyc())
  WITH CHECK (user_id = auth.uid() OR public.can_review_kyc());
CREATE POLICY biometric_enrollments_delete_reviewer ON public.biometric_enrollments
  FOR DELETE TO authenticated USING (public.can_review_kyc());

SELECT public._migration_drop_all_policies('public.biometric_api_logs');
CREATE POLICY biometric_api_logs_backoffice_read ON public.biometric_api_logs
  FOR SELECT TO authenticated USING (public.can_review_kyc());

SELECT public._migration_drop_all_policies('public.verification_evidence');
CREATE POLICY verification_evidence_read ON public.verification_evidence
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_review_kyc()
    OR public.can_review_documents()
  );
CREATE POLICY verification_evidence_insert_own ON public.verification_evidence
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY verification_evidence_update_reviewer ON public.verification_evidence
  FOR UPDATE TO authenticated
  USING (public.can_review_kyc() OR public.can_review_documents())
  WITH CHECK (public.can_review_kyc() OR public.can_review_documents());
CREATE POLICY verification_evidence_delete_reviewer ON public.verification_evidence
  FOR DELETE TO authenticated USING (public.can_review_kyc());

-- =============================================================================
-- CUENTAS BANCARIAS Y PENNY TESTS
-- =============================================================================

SELECT public._migration_drop_all_policies('public.bank_accounts');
CREATE POLICY bank_accounts_select_org ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (
    public.has_org_role(org_id,
      ARRAY['owner','admin','finance','auditor']::public.org_role_v2[])
    OR public.can_manage_finance_ops()
  );
CREATE POLICY bank_accounts_insert ON public.bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_bank_account(org_id));
CREATE POLICY bank_accounts_update ON public.bank_accounts
  FOR UPDATE TO authenticated
  USING (public.can_manage_bank_account(org_id) OR public.can_manage_finance_ops())
  WITH CHECK (public.can_manage_bank_account(org_id) OR public.can_manage_finance_ops());
CREATE POLICY bank_accounts_delete ON public.bank_accounts
  FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner']::public.org_role_v2[]));

SELECT public._migration_drop_all_policies('public.bank_account_penny_tests');
CREATE POLICY bank_penny_read ON public.bank_account_penny_tests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bank_accounts ba
      WHERE ba.id = bank_account_id
        AND (
          public.has_org_role(ba.org_id, ARRAY['owner','admin','finance']::public.org_role_v2[])
          OR public.can_manage_finance_ops()
        )
    )
  );
CREATE POLICY bank_penny_insert ON public.bank_account_penny_tests
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bank_accounts ba
      WHERE ba.id = bank_account_id
        AND public.can_manage_bank_account(ba.org_id)
    )
  );
CREATE POLICY bank_penny_update ON public.bank_account_penny_tests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bank_accounts ba
      WHERE ba.id = bank_account_id
        AND (public.can_manage_bank_account(ba.org_id) OR public.can_manage_finance_ops())
    )
  );

SELECT public._migration_drop_all_policies('public.connected_accounts');
CREATE POLICY connected_accounts_read ON public.connected_accounts
  FOR SELECT TO authenticated
  USING (
    public.has_org_role(org_id, ARRAY['owner','admin','finance','auditor']::public.org_role_v2[])
    OR public.can_manage_finance_ops()
  );
CREATE POLICY connected_accounts_manage ON public.connected_accounts
  FOR ALL TO authenticated
  USING (public.can_manage_bank_account(org_id) OR public.can_manage_finance_ops())
  WITH CHECK (public.can_manage_bank_account(org_id) OR public.can_manage_finance_ops());

-- =============================================================================
-- TRANSACCIONES (dominio central)
-- =============================================================================

SELECT public._migration_drop_all_policies('public.transactions');
CREATE POLICY transactions_select_parties ON public.transactions
  FOR SELECT TO authenticated
  USING (
    public.is_active_org_member(buyer_org_id)
    OR public.is_active_org_member(seller_org_id)
    OR public.can_manage_disputes()
    OR public.can_manage_finance_ops()
    OR public.has_internal_role('compliance_officer')
    OR public.has_internal_role('super_admin')
  );
CREATE POLICY transactions_insert_buyer ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_transaction(buyer_org_id));
CREATE POLICY transactions_update_parties ON public.transactions
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_transaction(buyer_org_id)
    OR public.can_manage_transaction(seller_org_id)
    OR public.can_manage_disputes()
    OR public.can_manage_finance_ops()
  )
  WITH CHECK (
    public.can_manage_transaction(buyer_org_id)
    OR public.can_manage_transaction(seller_org_id)
    OR public.can_manage_disputes()
    OR public.can_manage_finance_ops()
  );

-- Hijas de transactions: acceso ligado a la transacción padre.
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'transaction_conditions',
    'transaction_contracts',
    'transaction_documents',
    'transaction_events',
    'transaction_hitos',
    'contract_signatures',
    'payment_intents',
    'payouts'
  ]
  LOOP
    EXECUTE format('SELECT public._migration_drop_all_policies(%L)', 'public.' || t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.transactions tx
            WHERE tx.id = transaction_id
              AND (
                public.is_active_org_member(tx.buyer_org_id)
                OR public.is_active_org_member(tx.seller_org_id)
                OR public.can_manage_disputes()
                OR public.can_manage_finance_ops()
                OR public.has_internal_role('super_admin')
              )
          )
        )
    $f$, t || '_select_parties', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR INSERT TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.transactions tx
            WHERE tx.id = transaction_id
              AND (
                public.can_manage_transaction(tx.buyer_org_id)
                OR public.can_manage_transaction(tx.seller_org_id)
                OR public.can_manage_finance_ops()
              )
          )
        )
    $f$, t || '_insert_parties', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR UPDATE TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.transactions tx
            WHERE tx.id = transaction_id
              AND (
                public.can_manage_transaction(tx.buyer_org_id)
                OR public.can_manage_transaction(tx.seller_org_id)
                OR public.can_manage_finance_ops()
                OR public.can_manage_disputes()
              )
          )
        )
    $f$, t || '_update_parties', t);
  END LOOP;
END $$;

-- =============================================================================
-- DISPUTAS
-- =============================================================================

SELECT public._migration_drop_all_policies('public.disputes');
CREATE POLICY disputes_select_parties ON public.disputes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions tx
      WHERE tx.id = transaction_id
        AND (public.is_active_org_member(tx.buyer_org_id)
             OR public.is_active_org_member(tx.seller_org_id))
    )
    OR public.can_manage_disputes()
    OR public.has_internal_role('compliance_officer')
  );
CREATE POLICY disputes_insert_parties ON public.disputes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions tx
      WHERE tx.id = transaction_id
        AND (public.can_manage_transaction(tx.buyer_org_id)
             OR public.can_manage_transaction(tx.seller_org_id))
    )
  );
CREATE POLICY disputes_update_parties_or_backoffice ON public.disputes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions tx
      WHERE tx.id = transaction_id
        AND (public.can_manage_transaction(tx.buyer_org_id)
             OR public.can_manage_transaction(tx.seller_org_id))
    )
    OR public.can_manage_disputes()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions tx
      WHERE tx.id = transaction_id
        AND (public.can_manage_transaction(tx.buyer_org_id)
             OR public.can_manage_transaction(tx.seller_org_id))
    )
    OR public.can_manage_disputes()
  );

SELECT public._migration_drop_all_policies('public.dispute_messages');
CREATE POLICY dispute_messages_select ON public.dispute_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.disputes d JOIN public.transactions tx ON tx.id = d.transaction_id
      WHERE d.id = dispute_id
        AND (public.is_active_org_member(tx.buyer_org_id)
             OR public.is_active_org_member(tx.seller_org_id)
             OR public.can_manage_disputes())
    )
  );
CREATE POLICY dispute_messages_insert ON public.dispute_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.disputes d JOIN public.transactions tx ON tx.id = d.transaction_id
      WHERE d.id = dispute_id
        AND (public.can_manage_transaction(tx.buyer_org_id)
             OR public.can_manage_transaction(tx.seller_org_id)
             OR public.can_manage_disputes())
    )
  );

SELECT public._migration_drop_all_policies('public.dispute_evidence');
CREATE POLICY dispute_evidence_select ON public.dispute_evidence
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.disputes d JOIN public.transactions tx ON tx.id = d.transaction_id
      WHERE d.id = dispute_id
        AND (public.is_active_org_member(tx.buyer_org_id)
             OR public.is_active_org_member(tx.seller_org_id)
             OR public.can_manage_disputes())
    )
  );
CREATE POLICY dispute_evidence_insert ON public.dispute_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.disputes d JOIN public.transactions tx ON tx.id = d.transaction_id
      WHERE d.id = dispute_id
        AND (public.can_upload_evidence(tx.buyer_org_id)
             OR public.can_upload_evidence(tx.seller_org_id))
    )
  );
CREATE POLICY dispute_evidence_delete ON public.dispute_evidence
  FOR DELETE TO authenticated
  USING (public.can_manage_disputes());

-- =============================================================================
-- FISCAL Y CUMPLIMIENTO
-- =============================================================================

SELECT public._migration_drop_all_policies('public.fiscal_documents');
CREATE POLICY fiscal_documents_select ON public.fiscal_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions tx
      WHERE tx.id = transaction_id
        AND (public.is_active_org_member(tx.buyer_org_id)
             OR public.is_active_org_member(tx.seller_org_id))
    )
    OR public.can_review_documents()
    OR public.has_internal_role('compliance_officer')
  );
CREATE POLICY fiscal_documents_insert ON public.fiscal_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions tx
      WHERE tx.id = transaction_id
        AND (public.can_manage_transaction(tx.buyer_org_id)
             OR public.can_manage_transaction(tx.seller_org_id))
    )
  );
CREATE POLICY fiscal_documents_update ON public.fiscal_documents
  FOR UPDATE TO authenticated
  USING (public.can_review_documents())
  WITH CHECK (public.can_review_documents());

SELECT public._migration_drop_all_policies('public.document_review_queue');
CREATE POLICY document_review_queue_backoffice ON public.document_review_queue
  FOR ALL TO authenticated
  USING (public.can_review_documents())
  WITH CHECK (public.can_review_documents());

-- =============================================================================
-- PLD / ANTI-LAVADO
-- =============================================================================

DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pld_alerts','pld_questionnaires','pld_risk_factors',
    'pld_risk_profiles','pld_screening_results'
  ]
  LOOP
    EXECUTE format('SELECT public._migration_drop_all_policies(%L)', 'public.' || t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR SELECT TO authenticated
        USING (
          public.has_internal_role('compliance_officer')
          OR public.has_internal_role('super_admin')
        )
    $f$, t || '_backoffice_read', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR ALL TO authenticated
        USING (public.has_internal_role('compliance_officer') OR public.has_internal_role('super_admin'))
        WITH CHECK (public.has_internal_role('compliance_officer') OR public.has_internal_role('super_admin'))
    $f$, t || '_backoffice_manage', t);
  END LOOP;
END $$;

-- pld_questionnaires: dueño del cuestionario también lee (opcional).
CREATE POLICY pld_questionnaires_select_own ON public.pld_questionnaires
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- NOTIFICACIONES Y AUDITORÍA
-- =============================================================================

SELECT public._migration_drop_all_policies('public.notifications');
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

SELECT public._migration_drop_all_policies('public.audit_events');
CREATE POLICY audit_events_backoffice_read ON public.audit_events
  FOR SELECT TO authenticated
  USING (
    public.has_any_internal_role(
      ARRAY['super_admin','compliance_officer','finance_ops']::public.internal_role_v2[])
  );
CREATE POLICY audit_events_owner_read ON public.audit_events
  FOR SELECT TO authenticated
  USING (actor_user_id = auth.uid() OR target_user_id = auth.uid());

SELECT public._migration_drop_all_policies('public.audit_log');
CREATE POLICY audit_log_backoffice_read ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.can_access_backoffice());

SELECT public._migration_drop_all_policies('public.internal_access_log');
CREATE POLICY internal_access_log_super_admin ON public.internal_access_log
  FOR SELECT TO authenticated USING (public.has_internal_role('super_admin'));

SELECT public._migration_drop_all_policies('public.internal_action_log');
CREATE POLICY internal_action_log_super_admin ON public.internal_action_log
  FOR SELECT TO authenticated USING (public.has_internal_role('super_admin'));

SELECT public._migration_drop_all_policies('public.platform_incidents');
CREATE POLICY platform_incidents_backoffice ON public.platform_incidents
  FOR ALL TO authenticated
  USING (public.has_any_internal_role(ARRAY['super_admin','finance_ops']::public.internal_role_v2[]))
  WITH CHECK (public.has_any_internal_role(ARRAY['super_admin','finance_ops']::public.internal_role_v2[]));

-- =============================================================================
-- SOPORTE
-- =============================================================================

SELECT public._migration_drop_all_policies('public.support_tickets');
CREATE POLICY support_tickets_own ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_any_internal_role(ARRAY['super_admin','support_agent']::public.internal_role_v2[])
  );
CREATE POLICY support_tickets_insert_self ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY support_tickets_update_agent ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (
    (created_by = auth.uid() AND status = 'open')
    OR public.has_any_internal_role(ARRAY['super_admin','support_agent']::public.internal_role_v2[])
  )
  WITH CHECK (
    (created_by = auth.uid())
    OR public.has_any_internal_role(ARRAY['super_admin','support_agent']::public.internal_role_v2[])
  );

SELECT public._migration_drop_all_policies('public.support_messages');
CREATE POLICY support_messages_select ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (t.created_by = auth.uid()
             OR public.has_any_internal_role(ARRAY['super_admin','support_agent']::public.internal_role_v2[]))
    )
  );
CREATE POLICY support_messages_insert ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (t.created_by = auth.uid()
             OR public.has_any_internal_role(ARRAY['super_admin','support_agent']::public.internal_role_v2[]))
    )
  );

SELECT public._migration_drop_all_policies('public.support_attachments');
CREATE POLICY support_attachments_select ON public.support_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (t.created_by = auth.uid()
             OR public.has_any_internal_role(ARRAY['super_admin','support_agent']::public.internal_role_v2[]))
    )
  );
CREATE POLICY support_attachments_insert ON public.support_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (t.created_by = auth.uid()
             OR public.has_any_internal_role(ARRAY['super_admin','support_agent']::public.internal_role_v2[]))
    )
  );

SELECT public._migration_drop_all_policies('public.support_attachment_downloads');
CREATE POLICY support_attachment_downloads_agent_read ON public.support_attachment_downloads
  FOR SELECT TO authenticated
  USING (public.has_any_internal_role(ARRAY['super_admin','support_agent']::public.internal_role_v2[]));
CREATE POLICY support_attachment_downloads_insert ON public.support_attachment_downloads
  FOR INSERT TO authenticated WITH CHECK (downloaded_by = auth.uid());

-- =============================================================================
-- STRIPE, WEBHOOKS Y APIS
-- =============================================================================

SELECT public._migration_drop_all_policies('public.stripe_webhook_events');
CREATE POLICY stripe_webhook_events_backoffice ON public.stripe_webhook_events
  FOR SELECT TO authenticated
  USING (public.can_manage_finance_ops());

SELECT public._migration_drop_all_policies('public.api_clients');
CREATE POLICY api_clients_select ON public.api_clients
  FOR SELECT TO authenticated
  USING (
    public.has_org_role(org_id, ARRAY['owner','admin']::public.org_role_v2[])
    OR public.has_internal_role('super_admin')
  );
CREATE POLICY api_clients_manage ON public.api_clients
  FOR ALL TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_role_v2[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_role_v2[]));

SELECT public._migration_drop_all_policies('public.reports_ledger');
CREATE POLICY reports_ledger_select ON public.reports_ledger
  FOR SELECT TO authenticated
  USING (
    public.is_active_org_member(org_id)
    OR public.can_manage_finance_ops()
  );
CREATE POLICY reports_ledger_insert ON public.reports_ledger
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finance_ops());

-- =============================================================================
-- FIN: eliminar helper temporal
-- =============================================================================
DROP FUNCTION public._migration_drop_all_policies(regclass);

-- Recomendación post-migración: correr `supabase--linter` y `07-cutover/rls-tests.sql`.
