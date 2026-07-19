ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_account_penny_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clabe_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pld_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pld_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pld_risk_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pld_risk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pld_screening_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postal_code_lookups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_attachment_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_hitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_insert_clients ON public.api_clients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY owner_or_admin_delete_clients ON public.api_clients AS PERMISSIVE FOR DELETE TO authenticated USING (((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY owner_or_admin_read_clients ON public.api_clients AS PERMISSIVE FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY owner_or_admin_update_clients ON public.api_clients AS PERMISSIVE FOR UPDATE TO authenticated USING (((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "authenticated cannot delete audit_events" ON public.audit_events AS RESTRICTIVE FOR DELETE TO authenticated USING (false);
CREATE POLICY "authenticated cannot insert audit_events" ON public.audit_events AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "authenticated cannot modify audit_events" ON public.audit_events AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "org members can view audit" ON public.audit_events AS PERMISSIVE FOR SELECT TO authenticated USING ((((org_id IS NOT NULL) AND is_org_member(org_id, auth.uid())) OR (actor_user_id = auth.uid()) OR has_platform_role(auth.uid(), 'platform_admin'::platform_role)));
CREATE POLICY audit_select_admin ON public.audit_log AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "authenticated cannot delete penny_tests" ON public.bank_account_penny_tests AS RESTRICTIVE FOR DELETE TO authenticated USING (false);
CREATE POLICY "authenticated cannot insert penny_tests" ON public.bank_account_penny_tests AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "authenticated cannot update penny_tests" ON public.bank_account_penny_tests AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY penny_tests_select_owner ON public.bank_account_penny_tests AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (bank_account_id IN ( SELECT bank_accounts.id
   FROM bank_accounts
  WHERE ((bank_accounts.owner_user_id = auth.uid()) OR ((bank_accounts.owner_org_id IS NOT NULL) AND is_org_member(bank_accounts.owner_org_id, auth.uid())))))));
CREATE POLICY "platform admins view penny_tests" ON public.bank_account_penny_tests AS PERMISSIVE FOR SELECT TO authenticated USING (has_platform_role(auth.uid(), 'platform_admin'::platform_role));
CREATE POLICY bank_accounts_insert_owner ON public.bank_accounts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) AND (((owner_user_id = auth.uid()) AND (owner_org_id IS NULL)) OR ((owner_org_id IS NOT NULL) AND (has_org_role(owner_org_id, auth.uid(), 'owner'::org_role) OR has_org_role(owner_org_id, auth.uid(), 'buyer_admin'::org_role) OR has_org_role(owner_org_id, auth.uid(), 'seller_admin'::org_role))))));
CREATE POLICY bank_accounts_select_owner ON public.bank_accounts AS PERMISSIVE FOR SELECT TO authenticated USING (((owner_user_id = auth.uid()) OR ((owner_org_id IS NOT NULL) AND is_org_member(owner_org_id, auth.uid()))));
CREATE POLICY bank_accounts_update_owner ON public.bank_accounts AS PERMISSIVE FOR UPDATE TO authenticated USING (((owner_user_id = auth.uid()) OR ((owner_org_id IS NOT NULL) AND (has_org_role(owner_org_id, auth.uid(), 'owner'::org_role) OR has_org_role(owner_org_id, auth.uid(), 'buyer_admin'::org_role) OR has_org_role(owner_org_id, auth.uid(), 'seller_admin'::org_role)))));
CREATE POLICY admins_read_biometric_logs ON public.biometric_api_logs AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY admin_delete_enrollments ON public.biometric_enrollments AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY own_enrollments_read ON public.biometric_enrollments AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY own_enrollments_update ON public.biometric_enrollments AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY own_enrollments_write ON public.biometric_enrollments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY clabe_admin_all ON public.clabe_verifications AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY clabe_own_insert ON public.clabe_verifications AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY clabe_own_select ON public.clabe_verifications AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY clabe_own_update ON public.clabe_verifications AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY own_insert ON public.connected_accounts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY own_or_admin_select ON public.connected_accounts AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'verifier'::app_role)));
CREATE POLICY own_update ON public.connected_accounts AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY signatures_admin_manage ON public.contract_signatures AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY signatures_via_transaction_insert ON public.contract_signatures AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((signer_user_id = auth.uid()) AND (transaction_id IN ( SELECT transactions.id
   FROM transactions
  WHERE ((transactions.buyer_id = auth.uid()) OR (transactions.seller_id = auth.uid()) OR (transactions.creado_por = auth.uid()))))));
CREATE POLICY signatures_via_transaction_select ON public.contract_signatures AS PERMISSIVE FOR SELECT TO authenticated USING (((transaction_id IN ( SELECT transactions.id
   FROM transactions
  WHERE ((transactions.buyer_id = auth.uid()) OR (transactions.seller_id = auth.uid()) OR (transactions.creado_por = auth.uid())))) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Users can view their own CURP verifications" ON public.curp_verifications AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY parties_or_staff_insert_evidence ON public.dispute_evidence AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((uploaded_by = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM (disputes d
     JOIN transactions t ON ((t.id = d.transaction_id)))
  WHERE ((d.id = dispute_evidence.dispute_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role))));
CREATE POLICY parties_or_staff_select_evidence ON public.dispute_evidence AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM (disputes d
     JOIN transactions t ON ((t.id = d.transaction_id)))
  WHERE ((d.id = dispute_evidence.dispute_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role)));
CREATE POLICY uploader_or_staff_delete_evidence ON public.dispute_evidence AS PERMISSIVE FOR DELETE TO authenticated USING (((uploaded_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role)));
CREATE POLICY parties_or_staff_insert ON public.dispute_messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((author_id = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM (disputes d
     JOIN transactions t ON ((t.id = d.transaction_id)))
  WHERE ((d.id = dispute_messages.dispute_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role))));
CREATE POLICY parties_or_staff_select ON public.dispute_messages AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM (disputes d
     JOIN transactions t ON ((t.id = d.transaction_id)))
  WHERE ((d.id = dispute_messages.dispute_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role)));
CREATE POLICY disputes_restrict_party_delete ON public.disputes AS RESTRICTIVE FOR DELETE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role)));
CREATE POLICY disputes_restrict_party_update ON public.disputes AS RESTRICTIVE FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role))) WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role)));
CREATE POLICY mediator_update ON public.disputes AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role)));
CREATE POLICY parties_or_staff_select ON public.disputes AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = disputes.transaction_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role)));
CREATE POLICY party_insert ON public.disputes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((opened_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = disputes.transaction_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) AND (status = 'open'::text) AND (resolution IS NULL) AND (COALESCE(deposit_paid, false) = false)));
CREATE POLICY "Admins delete fiscal docs" ON public.fiscal_documents AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Parties can update fiscal docs" ON public.fiscal_documents AS PERMISSIVE FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = fiscal_documents.transaction_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Parties can view fiscal docs" ON public.fiscal_documents AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = fiscal_documents.transaction_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Seller can insert fiscal docs" ON public.fiscal_documents AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((uploaded_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = fiscal_documents.transaction_id) AND ((t.seller_id = auth.uid()) OR (t.buyer_id = auth.uid())))))));
CREATE POLICY "help_articles public read published" ON public.help_articles AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((is_published = true));
CREATE POLICY "help_categories public read" ON public.help_categories AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff sees own assignment" ON public.internal_role_assignments AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "owner can create invitations" ON public.invitations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_org_owner(org_id, auth.uid()));
CREATE POLICY "owner can delete invitations" ON public.invitations AS PERMISSIVE FOR DELETE TO authenticated USING (is_org_owner(org_id, auth.uid()));
CREATE POLICY "owner can update invitations" ON public.invitations AS PERMISSIVE FOR UPDATE TO authenticated USING (is_org_owner(org_id, auth.uid())) WITH CHECK (is_org_owner(org_id, auth.uid()));
CREATE POLICY "owner or verified invitee can view invitations" ON public.invitations AS PERMISSIVE FOR SELECT TO authenticated USING ((is_org_owner(org_id, auth.uid()) OR ((lower(email) = lower((( SELECT u.email
   FROM auth.users u
  WHERE (u.id = auth.uid())))::text)) AND (( SELECT u.email_confirmed_at
   FROM auth.users u
  WHERE (u.id = auth.uid())) IS NOT NULL))));
CREATE POLICY "verified invitee can accept invitation" ON public.invitations AS PERMISSIVE FOR UPDATE TO authenticated USING (((lower(email) = lower((( SELECT u.email
   FROM auth.users u
  WHERE (u.id = auth.uid())))::text)) AND (( SELECT u.email_confirmed_at
   FROM auth.users u
  WHERE (u.id = auth.uid())) IS NOT NULL))) WITH CHECK (((lower(email) = lower((( SELECT u.email
   FROM auth.users u
  WHERE (u.id = auth.uid())))::text)) AND (( SELECT u.email_confirmed_at
   FROM auth.users u
  WHERE (u.id = auth.uid())) IS NOT NULL) AND (org_id = ( SELECT i.org_id
   FROM invitations i
  WHERE (i.id = invitations.id))) AND (org_role = ( SELECT i.org_role
   FROM invitations i
  WHERE (i.id = invitations.id))) AND (email = ( SELECT i.email
   FROM invitations i
  WHERE (i.id = invitations.id))) AND (token = ( SELECT i.token
   FROM invitations i
  WHERE (i.id = invitations.id)))));
CREATE POLICY "Users insert own kyc documents" ON public.kyc_documents AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users update own pending kyc documents" ON public.kyc_documents AS PERMISSIVE FOR UPDATE TO authenticated USING (((auth.uid() = user_id) AND (status = 'pending'::kyc_status))) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users view own kyc documents" ON public.kyc_documents AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Verifiers update kyc documents" ON public.kyc_documents AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'verifier'::app_role) OR has_role(auth.uid(), 'admin'::app_role))) WITH CHECK ((has_role(auth.uid(), 'verifier'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Verifiers view all kyc documents" ON public.kyc_documents AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'verifier'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "org members can view memberships" ON public.memberships AS PERMISSIVE FOR SELECT TO authenticated USING ((is_org_member(org_id, auth.uid()) OR (user_id = auth.uid()) OR has_platform_role(auth.uid(), 'platform_admin'::platform_role)));
CREATE POLICY "owner can update memberships" ON public.memberships AS PERMISSIVE FOR UPDATE TO authenticated USING (is_org_owner(org_id, auth.uid())) WITH CHECK (is_org_owner(org_id, auth.uid()));
CREATE POLICY "owner insert memberships" ON public.memberships AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_org_owner(org_id, auth.uid()) OR ((user_id = auth.uid()) AND (org_role = 'owner'::org_role) AND (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = memberships.org_id) AND (o.owner_user_id = auth.uid())))))));
CREATE POLICY "owner or self can delete membership" ON public.memberships AS PERMISSIVE FOR DELETE TO authenticated USING ((is_org_owner(org_id, auth.uid()) OR (user_id = auth.uid())));
CREATE POLICY own_select ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY own_update ON public.notifications AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "authenticated can create org" ON public.organizations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((owner_user_id = auth.uid()));
CREATE POLICY "org members can view" ON public.organizations AS PERMISSIVE FOR SELECT TO authenticated USING ((is_org_member(id, auth.uid()) OR has_platform_role(auth.uid(), 'platform_admin'::platform_role)));
CREATE POLICY "owner can delete org" ON public.organizations AS PERMISSIVE FOR DELETE TO authenticated USING (is_org_owner(id, auth.uid()));
CREATE POLICY "owner can update org" ON public.organizations AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_org_owner(id, auth.uid()) OR has_platform_role(auth.uid(), 'platform_admin'::platform_role))) WITH CHECK ((is_org_owner(id, auth.uid()) OR has_platform_role(auth.uid(), 'platform_admin'::platform_role)));
CREATE POLICY buyer_insert ON public.payment_intents AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = payment_intents.transaction_id) AND (t.buyer_id = auth.uid())))));
CREATE POLICY buyer_update ON public.payment_intents AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = payment_intents.transaction_id) AND (t.buyer_id = auth.uid())))));
CREATE POLICY parties_select ON public.payment_intents AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = payment_intents.transaction_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role)));
CREATE POLICY parties_select ON public.payouts AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = payouts.transaction_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role)));
CREATE POLICY "incidents public read" ON public.platform_incidents AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "platform_admin can manage" ON public.platform_roles AS PERMISSIVE FOR ALL TO authenticated USING (has_platform_role(auth.uid(), 'platform_admin'::platform_role)) WITH CHECK (has_platform_role(auth.uid(), 'platform_admin'::platform_role));
CREATE POLICY "platform_admin can view" ON public.platform_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((has_platform_role(auth.uid(), 'platform_admin'::platform_role) OR (user_id = auth.uid())));
CREATE POLICY "Deny user writes on alerts" ON public.pld_alerts AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Miembros ven alertas PLD de su org" ON public.pld_alerts AS PERMISSIVE FOR SELECT TO authenticated USING (is_org_member(org_id, auth.uid()));
CREATE POLICY "Miembros ven cuestionario de su org" ON public.pld_questionnaires AS PERMISSIVE FOR SELECT TO authenticated USING (is_org_member(org_id, auth.uid()));
CREATE POLICY "Owners y auditor actualizan cuestionario" ON public.pld_questionnaires AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_org_owner(org_id, auth.uid()) OR has_org_role(org_id, auth.uid(), 'auditor'::org_role))) WITH CHECK ((is_org_owner(org_id, auth.uid()) OR has_org_role(org_id, auth.uid(), 'auditor'::org_role)));
CREATE POLICY "Owners y auditor crean cuestionario" ON public.pld_questionnaires AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (is_org_owner(org_id, auth.uid()) OR has_org_role(org_id, auth.uid(), 'auditor'::org_role))));
CREATE POLICY "Deny user writes on risk factors" ON public.pld_risk_factors AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Miembros ven factores PLD de su org" ON public.pld_risk_factors AS PERMISSIVE FOR SELECT TO authenticated USING (is_org_member(org_id, auth.uid()));
CREATE POLICY "Deny user writes on risk profile" ON public.pld_risk_profiles AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Miembros ven perfil PLD de su org" ON public.pld_risk_profiles AS PERMISSIVE FOR SELECT TO authenticated USING (is_org_member(org_id, auth.uid()));
CREATE POLICY "Deny user writes on screening" ON public.pld_screening_results AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Miembros ven screening de su org" ON public.pld_screening_results AS PERMISSIVE FOR SELECT TO authenticated USING (is_org_member(org_id, auth.uid()));
CREATE POLICY "Users can insert their own postal code lookups" ON public.postal_code_lookups AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own postal code lookups" ON public.postal_code_lookups AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Admins view all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = id));
CREATE POLICY "Verifiers view profiles for KYC" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'verifier'::app_role));
CREATE POLICY owner_insert_reports ON public.reports_ledger AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY owner_or_admin_read_reports ON public.reports_ledger AS PERMISSIVE FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "service role only" ON public.stripe_webhook_events AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "No client writes on attachment download log" ON public.support_attachment_downloads AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Owners see own attachment download log" ON public.support_attachment_downloads AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "attachments insert by uploader" ON public.support_attachments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((uploaded_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_attachments.ticket_id) AND ((t.user_id = auth.uid()) OR ((t.org_id IS NOT NULL) AND (has_org_role(t.org_id, auth.uid(), 'owner'::org_role) OR has_org_role(t.org_id, auth.uid(), 'buyer_admin'::org_role) OR has_org_role(t.org_id, auth.uid(), 'seller_admin'::org_role)))))))));
CREATE POLICY "attachments select for ticket viewers" ON public.support_attachments AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_attachments.ticket_id) AND ((t.user_id = auth.uid()) OR ((t.org_id IS NOT NULL) AND (has_org_role(t.org_id, auth.uid(), 'owner'::org_role) OR has_org_role(t.org_id, auth.uid(), 'buyer_admin'::org_role) OR has_org_role(t.org_id, auth.uid(), 'seller_admin'::org_role) OR has_org_role(t.org_id, auth.uid(), 'auditor'::org_role))))))));
CREATE POLICY "messages insert by ticket owner or org admin" ON public.support_messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((author_id = auth.uid()) AND (author_kind = 'user'::text) AND (is_internal_note = false) AND (EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_messages.ticket_id) AND ((t.user_id = auth.uid()) OR ((t.org_id IS NOT NULL) AND (has_org_role(t.org_id, auth.uid(), 'owner'::org_role) OR has_org_role(t.org_id, auth.uid(), 'buyer_admin'::org_role) OR has_org_role(t.org_id, auth.uid(), 'seller_admin'::org_role)))))))));
CREATE POLICY "messages select for ticket viewers" ON public.support_messages AS PERMISSIVE FOR SELECT TO authenticated USING (((is_internal_note = false) AND (EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_messages.ticket_id) AND ((t.user_id = auth.uid()) OR ((t.org_id IS NOT NULL) AND (has_org_role(t.org_id, auth.uid(), 'owner'::org_role) OR has_org_role(t.org_id, auth.uid(), 'buyer_admin'::org_role) OR has_org_role(t.org_id, auth.uid(), 'seller_admin'::org_role) OR has_org_role(t.org_id, auth.uid(), 'auditor'::org_role)))))))));
CREATE POLICY "tickets insert own" ON public.support_tickets AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "tickets select own or org admin" ON public.support_tickets AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR ((org_id IS NOT NULL) AND (has_org_role(org_id, auth.uid(), 'owner'::org_role) OR has_org_role(org_id, auth.uid(), 'buyer_admin'::org_role) OR has_org_role(org_id, auth.uid(), 'seller_admin'::org_role) OR has_org_role(org_id, auth.uid(), 'auditor'::org_role)))));
CREATE POLICY "tickets update own" ON public.support_tickets AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "buyer manages draft conditions" ON public.transaction_conditions AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_conditions.transaction_id) AND (((auth.uid() = t.buyer_id) AND (t.status = 'draft'::transaction_status)) OR has_role(auth.uid(), 'admin'::app_role)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_conditions.transaction_id) AND (((auth.uid() = t.buyer_id) AND (t.status = 'draft'::transaction_status)) OR has_role(auth.uid(), 'admin'::app_role))))));
CREATE POLICY "parties view conditions" ON public.transaction_conditions AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_conditions.transaction_id) AND ((auth.uid() = t.buyer_id) OR (auth.uid() = t.seller_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role))))));
CREATE POLICY contracts_via_transaction_select ON public.transaction_contracts AS PERMISSIVE FOR SELECT TO authenticated USING (((transaction_id IN ( SELECT transactions.id
   FROM transactions
  WHERE ((transactions.buyer_id = auth.uid()) OR (transactions.seller_id = auth.uid()) OR (transactions.creado_por = auth.uid())))) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY contracts_via_transaction_write ON public.transaction_contracts AS PERMISSIVE FOR ALL TO authenticated USING (((transaction_id IN ( SELECT transactions.id
   FROM transactions
  WHERE ((transactions.buyer_id = auth.uid()) OR (transactions.seller_id = auth.uid()) OR (transactions.creado_por = auth.uid())))) OR has_role(auth.uid(), 'admin'::app_role))) WITH CHECK (((transaction_id IN ( SELECT transactions.id
   FROM transactions
  WHERE ((transactions.buyer_id = auth.uid()) OR (transactions.seller_id = auth.uid()) OR (transactions.creado_por = auth.uid())))) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY tx_docs_delete_uploader ON public.transaction_documents AS PERMISSIVE FOR DELETE TO authenticated USING (((uploaded_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY tx_docs_insert_parties ON public.transaction_documents AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((uploaded_by = auth.uid()) AND (transaction_id IN ( SELECT transactions.id
   FROM transactions
  WHERE ((transactions.buyer_id = auth.uid()) OR (transactions.seller_id = auth.uid()))))));
CREATE POLICY tx_docs_select_parties ON public.transaction_documents AS PERMISSIVE FOR SELECT TO authenticated USING ((transaction_id IN ( SELECT transactions.id
   FROM transactions
  WHERE ((transactions.buyer_id = auth.uid()) OR (transactions.seller_id = auth.uid())))));
CREATE POLICY tx_docs_update_uploader ON public.transaction_documents AS PERMISSIVE FOR UPDATE TO authenticated USING (((uploaded_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))) WITH CHECK (((uploaded_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "authenticated cannot delete transaction_events" ON public.transaction_events AS RESTRICTIVE FOR DELETE TO authenticated USING (false);
CREATE POLICY "authenticated cannot insert transaction_events" ON public.transaction_events AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "authenticated cannot modify transaction_events" ON public.transaction_events AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "parties view events" ON public.transaction_events AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_events.transaction_id) AND ((auth.uid() = t.buyer_id) OR (auth.uid() = t.seller_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role))))));
CREATE POLICY "hitos manage by buyer draft" ON public.transaction_hitos AS PERMISSIVE FOR ALL TO authenticated USING ((transaction_id IN ( SELECT transactions.id
   FROM transactions
  WHERE (((transactions.buyer_id = auth.uid()) AND (transactions.status = 'draft'::transaction_status)) OR has_role(auth.uid(), 'admin'::app_role))))) WITH CHECK ((transaction_id IN ( SELECT transactions.id
   FROM transactions
  WHERE (((transactions.buyer_id = auth.uid()) AND (transactions.status = 'draft'::transaction_status)) OR has_role(auth.uid(), 'admin'::app_role)))));
CREATE POLICY "hitos view via transaction" ON public.transaction_hitos AS PERMISSIVE FOR SELECT TO authenticated USING ((transaction_id IN ( SELECT transactions.id
   FROM transactions
  WHERE ((transactions.buyer_id = auth.uid()) OR (transactions.seller_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role)))));
CREATE POLICY "buyer creates transactions" ON public.transactions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = buyer_id));
CREATE POLICY "buyer deletes draft" ON public.transactions AS PERMISSIVE FOR DELETE TO authenticated USING ((((auth.uid() = buyer_id) AND (status = 'draft'::transaction_status)) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "buyer updates draft" ON public.transactions AS PERMISSIVE FOR UPDATE TO authenticated USING ((((auth.uid() = buyer_id) AND (status = 'draft'::transaction_status)) OR has_role(auth.uid(), 'admin'::app_role))) WITH CHECK ((((auth.uid() = buyer_id) AND (status = 'draft'::transaction_status)) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "parties view own transactions" ON public.transactions AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = buyer_id) OR (auth.uid() = seller_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role)));
CREATE POLICY "Admins delete roles" ON public.user_roles AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert roles" ON public.user_roles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update roles" ON public.user_roles AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view all roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY admin_update_evidence ON public.verification_evidence AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY party_insert_evidence ON public.verification_evidence AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((uploaded_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = verification_evidence.transaction_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid())))))));
CREATE POLICY party_or_admin_delete_evidence ON public.verification_evidence AS PERMISSIVE FOR DELETE TO authenticated USING (((uploaded_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY party_or_admin_read_evidence ON public.verification_evidence AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = verification_evidence.transaction_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid())))))));
CREATE POLICY "Support attachments — owner delete own" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'support-attachments'::text) AND (owner = auth.uid())));
CREATE POLICY "Support attachments — owner read" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'support-attachments'::text) AND (EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE (((t.id)::text = (storage.foldername(objects.name))[1]) AND ((t.user_id = auth.uid()) OR is_org_member(t.org_id, auth.uid())))))));
CREATE POLICY "Support attachments — owner upload" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'support-attachments'::text) AND (owner = auth.uid()) AND (EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE (((t.id)::text = (storage.foldername(objects.name))[1]) AND ((t.user_id = auth.uid()) OR is_org_member(t.org_id, auth.uid())))))));
CREATE POLICY "Users delete own kyc files" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'kyc-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users upload own kyc files" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'kyc-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users view own kyc files" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'kyc-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Verifiers view all kyc files" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'kyc-documents'::text) AND (has_role(auth.uid(), 'verifier'::app_role) OR has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY biometric_admin_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'biometric-captures'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY biometric_owner_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'biometric-captures'::text) AND (((auth.uid())::text = (storage.foldername(name))[1]) OR has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY biometric_owner_write ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'biometric-captures'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY dispute_evidence_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'dispute-evidence'::text) AND ((owner = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role))));
CREATE POLICY dispute_evidence_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'dispute-evidence'::text) AND ((EXISTS ( SELECT 1
   FROM (disputes d
     JOIN transactions t ON ((t.id = d.transaction_id)))
  WHERE (((d.id)::text = split_part(objects.name, '/'::text, 1)) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role))));
CREATE POLICY dispute_evidence_update ON storage.objects AS PERMISSIVE FOR UPDATE TO "-" USING (((bucket_id = 'dispute-evidence'::text) AND ((EXISTS ( SELECT 1
   FROM (disputes d
     JOIN transactions t ON ((t.id = d.transaction_id)))
  WHERE (((d.id)::text = split_part(objects.name, '/'::text, 1)) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role)))) WITH CHECK (((bucket_id = 'dispute-evidence'::text) AND ((EXISTS ( SELECT 1
   FROM (disputes d
     JOIN transactions t ON ((t.id = d.transaction_id)))
  WHERE (((d.id)::text = split_part(objects.name, '/'::text, 1)) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role))));
CREATE POLICY dispute_evidence_write ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'dispute-evidence'::text) AND ((EXISTS ( SELECT 1
   FROM (disputes d
     JOIN transactions t ON ((t.id = d.transaction_id)))
  WHERE (((d.id)::text = split_part(objects.name, '/'::text, 1)) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mediator'::app_role))));
CREATE POLICY owner_delete_verif_files ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'verification-evidence'::text) AND ((owner = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY party_read_verif_files ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'verification-evidence'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM transactions t
  WHERE (((t.id)::text = split_part(objects.name, '/'::text, 1)) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))))));
CREATE POLICY party_update_verif_files ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'verification-evidence'::text) AND (owner = auth.uid()))) WITH CHECK (((bucket_id = 'verification-evidence'::text) AND (owner = auth.uid())));
CREATE POLICY party_upload_verif_files ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'verification-evidence'::text) AND (EXISTS ( SELECT 1
   FROM transactions t
  WHERE (((t.id)::text = split_part(objects.name, '/'::text, 1)) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid())))))));
CREATE POLICY tx_docs_storage_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'transaction-documents'::text) AND (owner = auth.uid())));
CREATE POLICY tx_docs_storage_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'transaction-documents'::text) AND ((storage.foldername(name))[1] IN ( SELECT (transactions.id)::text AS id
   FROM transactions
  WHERE ((transactions.buyer_id = auth.uid()) OR (transactions.seller_id = auth.uid()))))));
CREATE POLICY tx_docs_storage_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'transaction-documents'::text) AND ((storage.foldername(name))[1] IN ( SELECT (transactions.id)::text AS id
   FROM transactions
  WHERE ((transactions.buyer_id = auth.uid()) OR (transactions.seller_id = auth.uid()))))));
CREATE POLICY tx_docs_storage_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'transaction-documents'::text) AND (owner = auth.uid()))) WITH CHECK (((bucket_id = 'transaction-documents'::text) AND (owner = auth.uid())));
