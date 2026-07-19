# Matriz RLS — 51 tablas × 16 roles × operaciones aplicables

Complementa `rls-tests-extended.sql`. Este documento es la referencia
autoritativa de qué debe permitirse y denegarse por rol; el SQL sólo
automatiza los casos críticos por límite de tiempo de ejecución.

## Leyenda

- **A** = ALLOW (esperado permitido)
- **D** = DENY (esperado denegado)
- **N/A** = operación no aplica a esa tabla o rol
- **OWN** = permitido sólo sobre filas propias / de la organización del actor
- **ORG** = permitido sólo dentro de la organización del actor

Roles evaluados (columna → rol):

- `anon` — sin autenticar
- `no_mb` — autenticado sin membership
- `buyer`, `seller`, `admin` (app_role legacy)
- `owner`, `org_admin`, `finance`, `operator`, `viewer`, `auditor`
- `super_admin`, `compliance`, `kyc_rev`, `doc_rev`, `disp_mgr`, `fin_ops`, `support`

Operaciones: `S` (SELECT), `I` (INSERT), `U` (UPDATE), `D` (DELETE).

---

## Tablas operativas por dominio

### Dominio: Cuenta y organización

| Tabla | Op | anon | no_mb | buyer | seller | owner | org_admin | finance | operator | viewer | auditor | super_admin | compliance | others (internal) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| profiles | S | D | OWN | OWN | OWN | ORG | ORG | ORG | ORG | ORG | ORG | A | A | OWN |
| profiles | U | D | OWN | OWN | OWN | ORG | ORG | OWN | OWN | OWN | OWN | A | D | OWN |
| organizations | S | D | D | OWN | OWN | OWN | OWN | OWN | OWN | OWN | OWN | A | A | D |
| organizations | U | D | D | D | D | A | A | D | D | D | D | A | D | D |
| memberships | S | D | D | OWN | OWN | ORG | ORG | ORG | ORG | ORG | ORG | A | A | D |
| memberships | I | D | D | D | D | A (ORG) | A (ORG) | D | D | D | D | A | D | D |
| memberships | U | D | D | D | D | A (ORG) | A (ORG) | D | D | D | D | A | D | D |
| memberships | D | D | D | D | D | A (ORG) | D | D | D | D | D | A | D | D |
| invitations | S | D | D | OWN | OWN | ORG | ORG | D | D | D | D | A | D | D |
| invitations | I | D | D | D | D | A (ORG) | A (ORG) | D | D | D | D | A | D | D |
| invitations | U | D | D | OWN (accept) | OWN (accept) | A (ORG) | D | D | D | D | D | A | D | D |
| user_roles | S | D | D | OWN | OWN | ORG (miembros) | ORG | D | D | D | D | A | A | D |
| user_roles | I/U/D | D | D | D | D | D | D | D | D | D | D | A | D | D |

### Dominio: Operaciones (transactions)

| Tabla | Op | anon | no_mb | buyer | seller | owner | org_admin | finance | operator | viewer | auditor | super_admin | disp_mgr | fin_ops | support |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| transactions | S | D | D | OWN | OWN | ORG | ORG | ORG | ORG | ORG | ORG | A | A | A | A |
| transactions | I | D | D | A | A | A (ORG) | A (ORG) | D | A (ORG) | D | D | A | D | D | D |
| transactions | U | D | D | OWN | OWN | A (ORG) | A (ORG) | D | A (ORG) | D | D | A | A | D | D |
| transactions | D | D | D | D | D | A (ORG, draft) | D | D | D | D | D | A | D | D | D |
| transaction_hitos | S | D | D | OWN tx | OWN tx | ORG | ORG | ORG | ORG | ORG | ORG | A | A | A | A |
| transaction_hitos | U | D | D | OWN tx | OWN tx | A (ORG) | A (ORG) | D | A (ORG) | D | D | A | A | D | D |
| transaction_documents | S | D | D | OWN tx | OWN tx | ORG | ORG | ORG | ORG | ORG | ORG | A | A | A | A |
| transaction_documents | I | D | D | OWN tx | OWN tx | A (ORG) | A (ORG) | D | A (ORG) | D | D | A | A | D | D |
| transaction_events | S | D | D | OWN tx | OWN tx | ORG | ORG | ORG | ORG | ORG | ORG | A | A | A | A |
| transaction_events | I | D | D | OWN tx | OWN tx | A (ORG) | A (ORG) | D | A (ORG) | D | D | A | A | D | D |
| transaction_conditions | S/U | D | D | OWN tx | OWN tx | ORG | ORG | D | A (ORG) | D | D | A | A | D | D |
| transaction_contracts | S/U | D | D | OWN tx | OWN tx | ORG | ORG | D | A (ORG) | D | D | A | A | D | D |
| contract_signatures | S | D | D | OWN | OWN | ORG | ORG | ORG | ORG | ORG | ORG | A | A | A | A |
| contract_signatures | I | D | D | OWN | OWN | A (ORG) | A (ORG) | D | A (ORG) | D | D | A | D | D | D |

### Dominio: Pagos y ledger

| Tabla | Op | anon | no_mb | buyer | seller | owner | org_admin | finance | operator | viewer | auditor | super_admin | fin_ops | support | disp_mgr |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| payment_intents | S | D | D | OWN tx | OWN tx | ORG | ORG | ORG | ORG | ORG | ORG | A | A | A | A |
| payment_intents | I | D | D | A (own tx) | D | A (ORG) | A (ORG) | A (ORG) | D | D | D | A | A | D | D |
| payment_intents | U | D | D | D | D | A (ORG) | A (ORG) | A (ORG) | D | D | D | A | A | D | D |
| payouts | S | D | D | OWN tx | OWN tx | ORG | ORG | ORG | ORG | ORG | ORG | A | A | A | A |
| payouts | I | D | D | D | D | D | D | A (ORG) | D | D | D | A | A | D | D |
| payouts | U | D | D | D | D | D | D | A (ORG) | D | D | D | A | A | D | D |
| bank_accounts | S | D | D | OWN | OWN | ORG | ORG | ORG | D | D | ORG | A | A | D | D |
| bank_accounts | I | D | D | D | D | A (ORG) | A (ORG) | A (ORG) | **D** | D | D | A | A | D | D |
| bank_accounts | U | D | D | D | D | A (ORG) | A (ORG) | A (ORG) | **D** | D | D | A | A | D | D |
| bank_account_penny_tests | S | D | D | OWN | OWN | ORG | ORG | ORG | D | D | ORG | A | A | D | D |
| bank_account_penny_tests | I | D | D | D | D | A (ORG) | A (ORG) | A (ORG) | D | D | D | A | A | D | D |
| clabe_verifications | S | D | D | OWN | OWN | ORG | ORG | ORG | D | D | ORG | A | A | D | D |
| connected_accounts | S | D | D | OWN | OWN | ORG | ORG | ORG | D | D | ORG | A | A | D | D |
| reports_ledger | S | D | D | D | D | ORG | ORG | ORG | D | D | ORG | A | A | D | D |
| stripe_webhook_events | S/I/U/D | D | D | D | D | D | D | D | D | D | D | A | A | D | D |

### Dominio: Disputas

| Tabla | Op | anon | no_mb | buyer | seller | owner | finance | operator | disp_mgr | super_admin | others |
|---|---|---|---|---|---|---|---|---|---|---|---|
| disputes | S | D | D | OWN (parte) | OWN (parte) | ORG (parte) | ORG (parte) | ORG (parte) | A | A | D |
| disputes | I | D | D | A (parte) | A (parte) | A (ORG) | D | A (ORG) | A | A | D |
| disputes | U | D | D | OWN (parte, campos limitados) | OWN (parte, campos limitados) | D | **D** | D | A | A | D |
| dispute_messages | S | D | D | OWN (parte) | OWN (parte) | ORG (parte) | ORG (parte) | ORG (parte) | A | A | D |
| dispute_messages | I | D | D | A (parte) | A (parte) | A (ORG) | D | A (ORG) | A | A | D |
| dispute_evidence | S | D | D | OWN (parte) | OWN (parte) | ORG (parte) | ORG (parte) | ORG (parte) | A | A | D |
| dispute_evidence | I | D | D | A (parte) | A (parte) | A (ORG) | D | A (ORG) | A | A | D |

### Dominio: KYC / Documentos / Compliance

| Tabla | Op | anon | no_mb | buyer | seller | owner | org_admin | operator | viewer | auditor | kyc_rev | doc_rev | compliance | super_admin | others |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| kyc_documents | S | D | D | OWN | OWN | ORG | ORG | ORG | ORG | ORG | A | D | A | A | D |
| kyc_documents | I | D | D | OWN | OWN | A (ORG) | A (ORG) | A (ORG) | D | D | D | D | D | A | D |
| kyc_documents | U | D | D | D | D | D | D | D | D | D | A | D | A | A | D |
| curp_verifications | S | D | D | OWN | OWN | ORG | ORG | D | D | ORG | A | D | A | A | D |
| biometric_enrollments | S | D | D | OWN | OWN | ORG | D | D | D | ORG | A | D | A | A | D |
| verification_evidence | S | D | D | OWN | OWN | ORG | D | D | D | ORG | A | A | A | A | D |
| document_review_queue | S | D | D | D | D | D | D | D | D | D | A | A | A | A | D |
| document_review_queue | U | D | D | D | D | D | D | D | D | D | A | A | D | A | D |
| fiscal_documents | S | D | D | OWN | OWN | ORG | ORG | ORG | ORG | ORG | D | A | A | A | D |
| fiscal_documents | I | D | D | OWN | OWN | A (ORG) | A (ORG) | A (ORG) | D | D | D | D | D | A | D |
| fiscal_documents | U | D | D | D | D | D | D | D | D | D | D | A | A | A | D |
| pld_questionnaires | S | D | D | OWN | OWN | ORG | ORG | D | D | ORG | D | D | A | A | D |
| pld_alerts | S | D | D | D | D | D | D | D | D | D | D | D | A | A | D |
| pld_risk_profiles | S | D | D | OWN | OWN | ORG | ORG | D | D | ORG | D | D | A | A | D |
| pld_screening_results | S | D | D | D | D | D | D | D | D | D | D | D | A | A | D |
| pld_risk_factors | S | D | D | D | D | D | D | D | D | D | D | D | A | A | D |

### Dominio: Soporte

| Tabla | Op | anon | no_mb | buyer | seller | owner | org_admin | others_org | support | dispute_mgr | super_admin | others_internal |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| support_tickets | S | D | D | OWN | OWN | ORG | ORG | ORG | A | A (escalados) | A | D |
| support_tickets | I | D | D | A | A | A (ORG) | A (ORG) | A (ORG) | A | D | A | D |
| support_tickets | U | D | D | OWN (reply) | OWN (reply) | ORG | ORG | D | A | A (escalados) | A | D |
| support_messages | S | D | D | OWN ticket | OWN ticket | ORG | ORG | ORG | A | A | A | D |
| support_messages | I | D | D | OWN ticket | OWN ticket | A (ORG) | A (ORG) | A (ORG) | A | A | A | D |
| support_attachments | S | D | D | OWN ticket | OWN ticket | ORG | ORG | ORG | A | A | A | D |
| support_attachments | I | D | D | OWN ticket | OWN ticket | A (ORG) | A (ORG) | A (ORG) | A | A | A | D |
| support_attachment_downloads | I | D | D | OWN | OWN | ORG | ORG | ORG | A | A | A | D |
| help_articles | S | D (drafts) | A (published) | A (published) | A (published) | A (published) | A (published) | A (published) | A | A | A | A |
| help_articles | I/U/D | D | D | D | D | D | D | D | A | D | A | D |
| help_categories | S | A | A | A | A | A | A | A | A | A | A | A |

### Dominio: Notificaciones y auditoría

| Tabla | Op | anon | no_mb | buyer | seller | owner | finance | operator | viewer | auditor | super_admin | compliance | others |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| notifications | S | D | D | OWN | OWN | OWN | OWN | OWN | OWN | OWN | A | A | OWN |
| notifications | U (read) | D | D | OWN | OWN | OWN | OWN | OWN | OWN | OWN | A | D | OWN |
| audit_events | S | D | D | OWN | OWN | ORG | ORG | ORG | ORG | ORG | A | A | D |
| audit_log | S | D | D | D | D | D | D | D | D | ORG | A | A | D |
| internal_action_log | S | D | D | **D** | **D** | **D** | D | D | D | D | A | A | A |
| internal_access_log | S | D | D | D | D | D | D | D | D | D | A | A | A |
| platform_incidents | S | A (public status page) | A | A | A | A | A | A | A | A | A | A | A |
| platform_incidents | I/U | D | D | D | D | D | D | D | D | D | A | D | D |

### Dominio: Backoffice / plataforma

| Tabla | Op | anon | app_role=admin | owner | org_admin | super_admin | otros internal |
|---|---|---|---|---|---|---|---|
| platform_roles | S | D | **D** | D | D | A | A |
| platform_roles | I/U/D | D | **D** | D | D | A | D |
| internal_role_assignments | S | D | **D** | D | D | A | OWN |
| internal_role_assignments | I/U/D | D | **D** | D | D | A | D |
| api_clients | S | D | D | ORG | ORG | A | A |
| api_clients | I/U | D | D | A (ORG) | A (ORG) | A | D |
| postal_code_lookups | S | A | A | A | A | A | A | A |

### Dominio: Otras (sin cambios)

- `dispute_numero_seq`, `support_ticket_numero_seq`, `transaction_numero_seq`:
  no aplican RLS a secuencias; sólo triggers `SECURITY DEFINER` las tocan.

---

## Invariantes globales (los que deben aparecer en el reporte final)

Estas afirmaciones **deben** validarse por prueba concreta:

1. **anon** obtiene DENY en toda operación de escritura y en toda tabla que
   no sea `help_articles (published)`, `help_categories`, `postal_code_lookups`,
   `platform_incidents`.
2. **authenticated_without_membership** obtiene DENY en toda tabla operativa;
   sólo puede leer/actualizar su propio `profiles` y consumir catálogos.
3. **buyer** puede escribir sólo sus propias operaciones y adjuntar CFDI/pagos
   de esas operaciones. Nunca ve datos de otra organización.
4. **seller** simétrico a buyer.
5. **buyer + seller** en el mismo usuario: acumula ambos permisos sin
   duplicación de policies. Se prueba creando un usuario con dos filas en
   `user_roles`.
6. **owner** administra su organización pero NO accede al backoffice.
7. **org_admin** = owner sin destructivo (no elimina memberships ni org).
8. **finance** ve/gestiona pagos, cuentas bancarias y ledger de su org;
   **NO** resuelve disputas.
9. **operator** crea/edita operaciones y sube documentos; **NO** administra
   cuentas bancarias, roles, ni firma contratos como owner.
10. **viewer** sólo SELECT dentro de su org; jamás UPDATE/INSERT/DELETE.
11. **auditor** SELECT amplio dentro de su org (incluye ledger, audit_events);
    jamás modifica.
12. **app_role='admin' (legacy)** NO concede acceso a `internal_*` ni a
    `platform_*`. Se prueba con SELECT sobre `internal_action_log`.
13. **super_admin (internal)** = acceso total al backoffice; no elimina
    fila propia de `internal_role_assignments` sin activar excepción.
14. **compliance_officer**: PLD, KYC, screening. No libera fondos.
15. **kyc_reviewer**: aprueba/rechaza KYC; NO ejecuta funciones de finance_ops
    (payouts, refunds).
16. **document_reviewer**: revisa documentos y CFDI; NO firma como owner.
17. **dispute_manager**: resuelve disputas; puede tocar `transactions` en
    contexto de disputa; NO administra `bank_accounts`.
18. **finance_ops**: emite payouts, gestiona ledger; NO cambia roles.
19. **support_agent**: cierra tickets (con MFA para escalados); NO libera
    fondos, NO reembolsa, NO cierra tickets sensibles sin `aal2`.
20. **membership inactiva** = DENY en todas las tablas de la org.
21. **internal_role revocado** (`activo=false` o `expira_at < now()`) =
    DENY en todas las tablas backoffice.
22. Un usuario con **rol interno** no obtiene automáticamente `membership`
    en ninguna org; y viceversa.

---

## Cobertura para el reporte

El `rls-tests-extended.sql` cubre los invariantes 1–5, 8, 9, 10, 12, 13, 19,
20, 21 mediante casos concretos. Para el resto el reporte debe indicar la
cobertura como PASS (con prueba adicional) o NOT TESTED con justificación.
