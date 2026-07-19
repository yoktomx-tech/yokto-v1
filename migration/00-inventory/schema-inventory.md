# Inventario de esquema — snapshot Lovable Cloud

Generado desde el proyecto Cloud actual. Este documento es la fotografía del estado del backend a migrar.

## Enums (public) — 30 tipos
```
public.account_type = [persona_fisica, persona_moral]
public.app_role = [buyer, seller, admin, verifier, mediator]
public.clabe_nivel = [algoritmica, penny_test, documental]
public.clabe_status = [pending, verifying, verified, failed]
public.commission_payer = [buyer, seller, split]
public.condition_status = [pending, met, rejected]
public.incident_severity = [minor, major, critical]
public.incident_status = [investigating, identified, monitoring, resolved]
public.industry_sector = [autotransporte, construccion, inmobiliario, vehiculos, servicios_profesionales, comercio, manufactura, otro]
public.internal_role = [YOKTO_SUPER_ADMIN, ANALISTA_KYC, ANALISTA_DOCUMENTAL, OFICIAL_CUMPLIMIENTO, AGENTE_ESCROW, AGENTE_SOPORTE, ANALISTA_FINANCIERO]
public.kyb_status = [not_started, in_review, approved, rejected]
public.kyc_document_type = [ine, passport, proof_of_address, acta_constitutiva, constancia_fiscal, poder_notarial, other, ine_frente, ine_reverso, selfie_con_id, cedula_fiscal]
public.kyc_nivel = [basico, intermedio, avanzado]
public.kyc_status = [pending, in_review, approved, rejected]
public.membership_status = [active, invited, suspended, removed]
public.org_plan = [free, pro, enterprise]
public.org_role = [owner, buyer_admin, buyer_user, seller_admin, seller_user, auditor]
public.org_type = [individual, business]
public.payment_method = [spei, card]
public.platform_role = [compliance, dispute_manager, support, platform_admin]
public.pld_alert_severity = [info, baja, media, alta, critica]
public.pld_alert_status = [abierta, en_revision, resuelta, descartada, escalada]
public.pld_profile_status = [borrador, vigente, en_revision, vencido, bloqueado]
public.pld_risk_level = [bajo, medio, alto, inaceptable]
public.pld_screening_list = [pep_nacional, pep_internacional, ofac, onu, ue, adverse_media, interpol, sat_69b]
public.pld_screening_status = [limpio, coincidencia_debil, coincidencia_fuerte, error]
public.support_escalation_type = [none, conflict, pld_ft, financial, technical]
public.support_ticket_priority = [low, normal, high, urgent]
public.support_ticket_status = [open, pending_user, in_progress, escalated, resolved, closed, reopened]
public.transaction_status = [draft, awaiting_funding, funded, in_progress, conditions_met, released, disputed, cancelled, refunded, pending_signature, partial_release, en_verificacion]
```

## Tablas y RLS — 51
| Tabla | RLS habilitado |
|---|---|
| api_clients | t |
| audit_events | t |
| audit_log | t |
| bank_account_penny_tests | t |
| bank_accounts | t |
| biometric_api_logs | t |
| biometric_enrollments | t |
| clabe_verifications | t |
| connected_accounts | t |
| contract_signatures | t |
| curp_verifications | t |
| dispute_evidence | t |
| dispute_messages | t |
| disputes | t |
| document_review_queue | t |
| fiscal_documents | t |
| help_articles | t |
| help_categories | t |
| internal_access_log | t |
| internal_action_log | t |
| internal_role_assignments | t |
| invitations | t |
| kyc_documents | t |
| memberships | t |
| notifications | t |
| organizations | t |
| payment_intents | t |
| payouts | t |
| platform_incidents | t |
| platform_roles | t |
| pld_alerts | t |
| pld_questionnaires | t |
| pld_risk_factors | t |
| pld_risk_profiles | t |
| pld_screening_results | t |
| postal_code_lookups | t |
| profiles | t |
| reports_ledger | t |
| stripe_webhook_events | t |
| support_attachment_downloads | t |
| support_attachments | t |
| support_messages | t |
| support_tickets | t |
| transaction_conditions | t |
| transaction_contracts | t |
| transaction_documents | t |
| transaction_events | t |
| transaction_hitos | t |
| transactions | t |
| user_roles | t |
| verification_evidence | t |

## Row counts (para conciliación) — 51
| Tabla | Filas |
|---|---|
| api_clients | 0 |
| audit_events | 0 |
| audit_log | 0 |
| bank_account_penny_tests | 0 |
| bank_accounts | 0 |
| biometric_api_logs | 3 |
| biometric_enrollments | 1 |
| clabe_verifications | 0 |
| connected_accounts | 0 |
| contract_signatures | 0 |
| curp_verifications | 1 |
| dispute_evidence | 0 |
| dispute_messages | 0 |
| disputes | 0 |
| document_review_queue | 0 |
| fiscal_documents | 0 |
| help_articles | 0 |
| help_categories | 0 |
| internal_access_log | 0 |
| internal_action_log | 0 |
| internal_role_assignments | 0 |
| invitations | 0 |
| kyc_documents | 0 |
| memberships | 1 |
| notifications | 0 |
| organizations | 1 |
| payment_intents | 0 |
| payouts | 0 |
| platform_incidents | 0 |
| platform_roles | 0 |
| pld_alerts | 0 |
| pld_questionnaires | 0 |
| pld_risk_factors | 0 |
| pld_risk_profiles | 0 |
| pld_screening_results | 0 |
| postal_code_lookups | 1 |
| profiles | 1 |
| reports_ledger | 0 |
| stripe_webhook_events | 0 |
| support_attachment_downloads | 0 |
| support_attachments | 0 |
| support_messages | 0 |
| support_tickets | 0 |
| transaction_conditions | 0 |
| transaction_contracts | 0 |
| transaction_documents | 0 |
| transaction_events | 0 |
| transaction_hitos | 0 |
| transactions | 0 |
| user_roles | 1 |
| verification_evidence | 0 |

## Foreign keys (96)
| Tabla | Columna | Referencia | Delete rule |
|---|---|---|---|
| api_clients | owner_id | auth.users(id) | CASCADE |
| audit_events | org_id | organizations(id) | SET NULL |
| audit_events | actor_user_id | auth.users(id) | SET NULL |
| audit_log | user_id | auth.users(id) | SET NULL |
| bank_account_penny_tests | bank_account_id | bank_accounts(id) | CASCADE |
| bank_account_penny_tests | user_id | auth.users(id) | NO ACTION |
| bank_accounts | reviewed_by | auth.users(id) | NO ACTION |
| bank_accounts | owner_org_id | organizations(id) | CASCADE |
| bank_accounts | owner_user_id | auth.users(id) | CASCADE |
| bank_accounts | created_by | auth.users(id) | NO ACTION |
| biometric_api_logs | enrollment_id | biometric_enrollments(id) | CASCADE |
| biometric_api_logs | user_id | auth.users(id) | SET NULL |
| biometric_enrollments | user_id | auth.users(id) | CASCADE |
| clabe_verifications | user_id | auth.users(id) | CASCADE |
| connected_accounts | user_id | auth.users(id) | CASCADE |
| contract_signatures | contract_id | transaction_contracts(id) | CASCADE |
| contract_signatures | transaction_id | transactions(id) | CASCADE |
| contract_signatures | signer_user_id | auth.users(id) | NO ACTION |
| curp_verifications | user_id | auth.users(id) | CASCADE |
| dispute_evidence | dispute_id | disputes(id) | CASCADE |
| dispute_evidence | uploaded_by | auth.users(id) | SET NULL |
| dispute_messages | dispute_id | disputes(id) | CASCADE |
| dispute_messages | author_id | auth.users(id) | SET NULL |
| disputes | opened_by | auth.users(id) | SET NULL |
| disputes | transaction_id | transactions(id) | CASCADE |
| disputes | mediator_id | auth.users(id) | SET NULL |
| disputes | hito_id | transaction_hitos(id) | SET NULL |
| document_review_queue | asignado_a | auth.users(id) | NO ACTION |
| document_review_queue | revisado_por | auth.users(id) | NO ACTION |
| document_review_queue | transaction_id | transactions(id) | CASCADE |
| fiscal_documents | uploaded_by | auth.users(id) | NO ACTION |
| fiscal_documents | aceptado_por | auth.users(id) | NO ACTION |
| fiscal_documents | rechazado_por | auth.users(id) | NO ACTION |
| fiscal_documents | transaction_id | transactions(id) | CASCADE |
| fiscal_documents | hito_id | transaction_hitos(id) | SET NULL |
| fiscal_documents | parent_cfdi_id | fiscal_documents(id) | SET NULL |
| help_articles | category_id | help_categories(id) | SET NULL |
| internal_access_log | user_id | auth.users(id) | NO ACTION |
| internal_action_log | user_id | auth.users(id) | NO ACTION |
| internal_role_assignments | revocado_por | auth.users(id) | NO ACTION |
| internal_role_assignments | asignado_por | auth.users(id) | NO ACTION |
| internal_role_assignments | user_id | auth.users(id) | CASCADE |
| invitations | invited_by | auth.users(id) | SET NULL |
| invitations | org_id | organizations(id) | CASCADE |
| invitations | accepted_by | auth.users(id) | SET NULL |
| kyc_documents | reviewed_by | auth.users(id) | NO ACTION |
| kyc_documents | user_id | auth.users(id) | CASCADE |
| memberships | user_id | auth.users(id) | CASCADE |
| memberships | org_id | organizations(id) | CASCADE |
| memberships | invited_by | auth.users(id) | SET NULL |
| notifications | user_id | auth.users(id) | CASCADE |
| organizations | owner_user_id | auth.users(id) | SET NULL |
| payment_intents | transaction_id | transactions(id) | CASCADE |
| payouts | seller_id | auth.users(id) | SET NULL |
| payouts | transaction_id | transactions(id) | CASCADE |
| platform_roles | user_id | auth.users(id) | CASCADE |
| platform_roles | granted_by | auth.users(id) | SET NULL |
| pld_alerts | transaction_id | transactions(id) | SET NULL |
| pld_alerts | org_id | organizations(id) | CASCADE |
| pld_alerts | resolved_by | auth.users(id) | NO ACTION |
| pld_questionnaires | user_id | auth.users(id) | CASCADE |
| pld_questionnaires | org_id | organizations(id) | CASCADE |
| pld_risk_factors | org_id | organizations(id) | CASCADE |
| pld_risk_factors | profile_id | pld_risk_profiles(id) | CASCADE |
| pld_risk_profiles | evaluated_by | auth.users(id) | NO ACTION |
| pld_risk_profiles | org_id | organizations(id) | CASCADE |
| pld_screening_results | org_id | organizations(id) | CASCADE |
| postal_code_lookups | user_id | auth.users(id) | CASCADE |
| profiles | id | auth.users(id) | CASCADE |
| reports_ledger | owner_id | auth.users(id) | CASCADE |
| reports_ledger | transaction_id | transactions(id) | SET NULL |
| support_attachment_downloads | attachment_id | support_attachments(id) | CASCADE |
| support_attachment_downloads | ticket_id | support_tickets(id) | CASCADE |
| support_attachment_downloads | user_id | auth.users(id) | CASCADE |
| support_attachments | uploaded_by | auth.users(id) | CASCADE |
| support_attachments | message_id | support_messages(id) | SET NULL |
| support_attachments | ticket_id | support_tickets(id) | CASCADE |
| support_messages | author_id | auth.users(id) | CASCADE |
| support_messages | ticket_id | support_tickets(id) | CASCADE |
| support_tickets | user_id | auth.users(id) | CASCADE |
| support_tickets | org_id | organizations(id) | SET NULL |
| transaction_conditions | verified_by | auth.users(id) | NO ACTION |
| transaction_conditions | transaction_id | transactions(id) | CASCADE |
| transaction_contracts | transaction_id | transactions(id) | CASCADE |
| transaction_contracts | created_by | auth.users(id) | NO ACTION |
| transaction_documents | transaction_id | transactions(id) | CASCADE |
| transaction_documents | uploaded_by | auth.users(id) | CASCADE |
| transaction_events | transaction_id | transactions(id) | CASCADE |
| transaction_events | actor_id | auth.users(id) | NO ACTION |
| transaction_hitos | transaction_id | transactions(id) | CASCADE |
| transactions | buyer_id | auth.users(id) | RESTRICT |
| transactions | creado_por | auth.users(id) | SET NULL |
| transactions | seller_id | auth.users(id) | RESTRICT |
| user_roles | user_id | auth.users(id) | CASCADE |
| verification_evidence | transaction_id | transactions(id) | CASCADE |
| verification_evidence | uploaded_by | auth.users(id) | CASCADE |

## Índices (134)
Ver `migration/01-schema/05_indexes.sql` para DDL completo.

## Funciones PostgreSQL (14)
- `public.assign_dispute_numero`
- `public.assign_support_numero`
- `public.assign_transaction_numero`
- `public.cancel_my_onboarding`
- `public.cleanup_abandoned_onboarding`
- `public.get_active_internal_role`
- `public.handle_new_user`
- `public.has_org_role`
- `public.has_platform_role`
- `public.has_role`
- `public.is_org_member`
- `public.is_org_owner`
- `public.set_updated_at`
- `public.tg_touch_updated_at`

## Triggers (28)
| Tabla | Trigger | Evento | Momento |
|---|---|---|---|
| bank_account_penny_tests | trg_penny_tests_updated | UPDATE | BEFORE |
| bank_accounts | trg_bank_accounts_updated | UPDATE | BEFORE |
| biometric_enrollments | trg_biometric_enrollments_updated | UPDATE | BEFORE |
| clabe_verifications | clabe_verifications_set_updated_at | UPDATE | BEFORE |
| connected_accounts | connected_accounts_updated | UPDATE | BEFORE |
| curp_verifications | set_curp_verifications_updated_at | UPDATE | BEFORE |
| disputes | disputes_set_numero | INSERT | BEFORE |
| disputes | disputes_updated | UPDATE | BEFORE |
| document_review_queue | trg_drq_touch | UPDATE | BEFORE |
| fiscal_documents | fiscal_documents_updated_at | UPDATE | BEFORE |
| internal_role_assignments | trg_ira_touch | UPDATE | BEFORE |
| kyc_documents | kyc_documents_set_updated_at | UPDATE | BEFORE |
| memberships | trg_memberships_updated_at | UPDATE | BEFORE |
| organizations | trg_orgs_updated_at | UPDATE | BEFORE |
| payment_intents | payment_intents_updated | UPDATE | BEFORE |
| payouts | payouts_updated | UPDATE | BEFORE |
| pld_alerts | trg_pld_alerts_updated | UPDATE | BEFORE |
| pld_questionnaires | trg_pld_questionnaires_updated | UPDATE | BEFORE |
| pld_risk_profiles | trg_pld_risk_profiles_updated | UPDATE | BEFORE |
| profiles | profiles_set_updated_at | UPDATE | BEFORE |
| support_tickets | trg_support_ticket_numero | INSERT | BEFORE |
| support_tickets | trg_support_ticket_updated | UPDATE | BEFORE |
| transaction_conditions | trg_cond_updated_at | UPDATE | BEFORE |
| transaction_contracts | transaction_contracts_set_updated_at | UPDATE | BEFORE |
| transaction_documents | trg_tx_documents_updated_at | UPDATE | BEFORE |
| transaction_hitos | trg_hitos_updated_at | UPDATE | BEFORE |
| transactions | trg_tx_numero | INSERT | BEFORE |
| transactions | trg_tx_updated_at | UPDATE | BEFORE |

## Políticas RLS (274)
Ver `migration/01-schema/06_rls_policies.sql` para DDL completo.

## Vistas (0)
(ninguna)

## Secuencias (3)
- dispute_numero_seq
- support_ticket_numero_seq
- transaction_numero_seq
