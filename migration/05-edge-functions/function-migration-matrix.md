# Function Migration Matrix — TSS server functions → Supabase externo

Documento autoritativo. Complementa `05-edge-functions/migration-plan.md`.

## Aclaración terminológica

**TSS = TanStack Start**. Ver historial de secciones previas — `createServerFn`
se declara en `src/lib/*.functions.ts` y corre en el hosting del frontend.
**Server routes** (`createFileRoute` con bloque `server`) son rutas HTTP raw
del mismo runtime. **Supabase Edge Functions** (Deno) corren en la
infraestructura de Supabase.

Al migrar Cloud → Supabase externo, cualquier función que consuma secretos
sensibles, escriba con `service_role`, o llame a proveedores externos debe
residir en Supabase Edge Functions del proyecto externo. TSS server functions
permanecen aceptables sólo como thin proxies autenticados
(`requireSupabaseAuth` + query bajo RLS) sin secretos ni service_role.

## Categorías

- **A** — Lista para portarse a Supabase Edge Function del proyecto externo.
- **B** — Servicio externo deliberado (queda en TSS o backend independiente, sin Cloud).
- **C** — Dependencia de Lovable Cloud pendiente. **BLOCKER**.
- **D** — Obsoleta o candidata a eliminación.

## Contrato de autenticación por función

Toda función debe declarar los siguientes atributos. Ninguna se despliega
con `--no-verify-jwt` por defecto: el patrón de invocación se define
función-por-función.

| Campo | Valores permitidos |
| --- | --- |
| `invocation_type` | `user`, `provider_webhook`, `scheduled`, `internal` |
| `jwt_required` | `true` / `false` |
| `user_access_token_required` | `true` / `false` |
| `provider_signature_required` | `true` / `false` (HMAC, Stripe-Signature, etc.) |
| `internal_secret_required` | `true` / `false` (secreto compartido cron/hook) |
| `allowed_roles` | lista de `app_role` / `org_role` / `internal_role` autorizados |
| `allowed_origins` | dominios permitidos por CORS (`same-origin`, `public`, o lista) |
| `rate_limit` | ej. `60/min/org`, `20/min/user`, `n/a` |
| `idempotency_required` | `true` / `false` |

### Patrones canónicos

**Patrón A — usuario autenticado**: `invocation_type=user`,
`jwt_required=true`, `user_access_token_required=true`,
`provider_signature_required=false`, `internal_secret_required=false`. La
función debe validar sesión real, obtener usuario desde Auth, validar rol
(app/org/internal) y validar el recurso. No basta la anon key.

**Patrón B — webhook público de proveedor**: `invocation_type=provider_webhook`,
`jwt_required=false`, `user_access_token_required=false`,
`provider_signature_required=true`, `internal_secret_required=false`,
`allowed_roles=n/a`, `allowed_origins=public`, `idempotency_required=true`.
Debe usar cuerpo raw para validar firma, verificar timestamp cuando aplique,
registrar `provider_event_id`, y rechazar eventos inválidos. La API key
pública NO es control de seguridad.

**Patrón C — interna o programada**: `invocation_type=scheduled` o `internal`,
`jwt_required=false`, `internal_secret_required=true`, comparación segura del
secreto (constant-time), origen restringido. Vault sólo cuando el secreto
deba consultarse desde Postgres; Edge Function Secrets cuando lo consume la
función directamente. No exponer endpoints internos al frontend.

## Matriz completa

Columnas: `#`, `Función`, `Ubicación actual`, `Propósito`, `Categoría`,
`invocation_type`, `jwt_required`, `user_access_token_required`,
`provider_signature_required`, `internal_secret_required`, `allowed_roles`,
`allowed_origins`, `rate_limit`, `idempotency_required`, `Secretos`, `Proveedor`,
`Prueba requerida`.

| # | Función | Ubicación actual | Propósito | Cat | invocation | jwt | user_tok | prov_sig | int_secret | allowed_roles | origins | rate_limit | idemp | Secretos | Proveedor | Prueba |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `onboarding.functions` | `src/lib/onboarding.functions.ts` | Onboarding PF/PM | A | user | true | true | false | false | buyer, seller (owner) | same-origin | 30/min/user | por `user_id+step` | NUBARIUM_USER, NUBARIUM_PASSWORD | Nubarium | Flujo PF Step 7 staging |
| 2 | `biometric.functions` | `src/lib/biometric.functions.ts` | Enrolamiento facial | A | user | true | true | false | false | owner del enrolment | same-origin | 20/min/user | por token | NUBARIUM_USER, NUBARIUM_PASSWORD | Nubarium | Enroll completo |
| 3 | `bank-verification.functions` | `src/lib/bank-verification.functions.ts` | Penny test CLABE | A | user | true | true | false | false | finance, owner | same-origin | 10/min/user | por cuenta+intento | VERIFICAMEX_API_KEY, BANK_ACCOUNT_HASH_SECRET | Verificamex | Alta cuenta + webhook simulado |
| 4 | `fiscal/fiscal.functions` | `src/lib/fiscal/fiscal.functions.ts` | Parseo CFDI | A | user | true | true | false | false | operator, finance | same-origin | 60/min/org | por `uuid_cfdi` | — | SAT local | Carga CFDI ficticio |
| 5 | `disputes.functions` | `src/lib/disputes.functions.ts` | CRUD disputas | A | user | true | true | false | false | buyer/seller parte, dispute_manager | same-origin | 60/min/org | por `dispute_id+action` | STRIPE_SECRET_KEY | Stripe | Ciclo disputa |
| 6 | `mediation.functions` | `src/lib/mediation.functions.ts` | Escalado mediación | A | user | true | true | false | false | dispute_manager, super_admin | same-origin | 20/min/user | por `dispute_id` | — | — | Escalar disputa |
| 7 | `funding.functions` | `src/lib/funding.functions.ts` | PaymentIntent SPEI/Card | A | user | true | true | false | false | buyer, finance, owner | same-origin | 30/min/org | por `tx_id+method` | STRIPE_SECRET_KEY | Stripe | Fondeo test E2E |
| 8 | `payments.functions` | `src/lib/payments.functions.ts` | Liberar/reembolsar | A | user | true | true | false | false | finance, finance_ops, super_admin | same-origin | 20/min/org | por `tx_id+release_id` | STRIPE_SECRET_KEY | Stripe Connect | Liberación test |
| 9 | `payments-list.functions` | idem | Listar pagos | A | user | true | true | false | false | finance, viewer, auditor, owner | same-origin | 120/min/org | n/a | — | — | Org ajena DENY |
| 10 | `ledger.functions` | idem | Ledger unificado | A | user | true | true | false | false | finance, viewer, auditor | same-origin | 120/min/org | n/a | — | — | Cross-org |
| 11 | `reports.functions` | idem | Reportes CSV/PDF | A | user | true | true | false | false | auditor, super_admin | same-origin | 10/min/user | por `report_id` | — | — | Export CSV |
| 12 | `verification.functions` | idem | CURP/RFC Nubarium | A | user | true | true | false | false | kyc_reviewer, compliance | same-origin | 30/min/user | por `user_id+tipo` | NUBARIUM_* | Nubarium | CURP ficticio |
| 13 | `pld.functions` | idem | PLD/screening | A | user | true | true | false | false | compliance, super_admin | same-origin | 30/min/user | por `profile+version` | — | OFAC/PEP embed | Screening ficticio |
| 14 | `orgs.functions` | idem | Orgs + invites | A | user | true | true | false | false | owner, org_admin | same-origin | 30/min/user | por `invitation_token` | RESEND_API_KEY | Resend | Invite+accept |
| 15 | `admin/admin.functions` | idem | Backoffice general | A | user | true | true | false | false | super_admin | same-origin | 60/min/user | n/a | — | — | Acceso super_admin |
| 16 | `admin/audit.functions` | idem | Consulta auditoría | A | user | true | true | false | false | super_admin, compliance | same-origin | 60/min/user | n/a | — | — | Consulta audit |
| 17 | `admin/support.functions` | idem | Soporte backoffice + MFA | A | user | true (AAL2 para sensibles) | true | false | false | support_agent, dispute_manager, super_admin | same-origin | 30/min/user | por `ticket_id+close` | RESEND_API_KEY | Resend | Cierre con MFA |
| 18 | `support.functions` | idem | Tickets del cliente | A | user | true | true | false | false | cualquier autenticado | same-origin | 30/min/user | por `ticket_id+ord` | RESEND_API_KEY | Resend | Ticket con adjunto |
| 19 | `tx-documents.functions` | idem | Documentos de transacción | A | user | true | true | false | false | operator, owner, finance | same-origin | 60/min/org | por `document_id` | BANK_ACCOUNT_HASH_SECRET | — | Upload+firma |
| 20 | `transactions.functions` | idem | Operaciones e hitos | A | user | true | true | false | false | buyer, seller, operator, owner | same-origin | 60/min/org | por `tx_id+numero` | — | — | Wizard completo |
| 21 | `api-clients.functions` | idem | API keys B2B | A | user | true | true | false | false | owner, super_admin | same-origin | 10/min/user | por `api_client_id` | — | — | Rotación key |
| 22 | `admin.functions` legacy | `src/lib/admin.functions.ts` | Wrapper | D | — | — | — | — | — | — | — | — | — | — | — | Eliminar |
| 23 | `global-search.functions` | idem | Búsqueda unificada | A | user | true | true | false | false | cualquier autenticado | same-origin | 120/min/user | n/a | — | — | Búsqueda RLS |
| 24 | `ai-gateway` (portable) | `supabase/functions/ai-gateway/` | Gateway IA propio | **A** ✅ | user | true | true | false | false | miembro activo de la org | same-origin | 60/min/org, 20/min/user | opcional `X-Idempotency-Key` | AI_PROVIDER, AI_PROVIDER_API_KEY, AI_DEFAULT_MODEL, AI_MAX_INPUT_TOKENS, AI_MAX_OUTPUT_TOKENS, AI_REQUEST_TIMEOUT_MS | Google / OpenAI (clave propia) | Prompt ficticio con org staging |
| 25 | `lovable-error-reporting.ts` | idem | Telemetría Lovable | D | — | — | — | — | — | — | — | — | — | — | — | Eliminar en staging |
| 26 | `hooks/dispute-deadlines.ts` | `src/routes/api/public/hooks/` | Cron disputa | A | scheduled | false | false | false | **true** (CRON_SECRET) | n/a | público | 1/min | por `deadline_id` | CRON_SECRET | — | pg_cron staging |
| 27 | `hooks/support-sla.ts` | idem | Cron SLA | A | scheduled | false | false | false | **true** (CRON_SECRET) | n/a | público | 1/min | por `ticket_id+breach` | CRON_SECRET, RESEND_API_KEY | Resend | pg_cron staging |
| 28 | `hooks/verificamex-penny-test.ts` | idem | Webhook Verificamex | A | provider_webhook | false | false | **true** (HMAC) | false | n/a | público | n/a | por `event_id` | VERIFICAMEX_WEBHOOK_TOKEN | Verificamex | Webhook firmado |
| 29 | `stripe.webhook.ts` | idem | Webhook Stripe | A | provider_webhook | false | false | **true** (Stripe-Signature + timestamp) | false | n/a | público | n/a | por `event_id` UNIQUE | STRIPE_WEBHOOK_SECRET | Stripe | `stripe trigger` |
| 30 | `v1.transactions.ts` | idem | API pública B2B | A | user | false (API key propia) | false | false | false (auth por `api_clients`) | api_clients activos | público (con auth) | por api_client | n/a | — | — | Cliente API con key |

## Resumen por categoría (actualizado)

- **A**: 28
- **B**: 0
- **C (BLOCKER)**: 0 → B-01 resuelto en diseño con la Edge Function portable
  `supabase/functions/ai-gateway/`. Permanece **NOT TESTED** hasta desplegar
  y validar en staging externo.
- **D**: 2 → `admin.functions.ts` legacy, `lovable-error-reporting.ts`.

## Blockers actualizados

- **B-01 AI Gateway portable**: **Resuelto en diseño** (categoría A). Pendiente
  de despliegue y prueba en staging. No se despliega desde este entorno.
- **B-02 Falta staging externo**: abierto.
- **B-05 Backfill Auth no probado**: abierto.
- **B-06 Rollback drill no ejecutado**: abierto.
- **B-07 Idempotencia webhooks no probada**: abierto.
- **B-08 Realtime cross-tenant no probado**: abierto.

## Regla de despliegue

No usar `--no-verify-jwt` como default. Cada función se despliega con el
patrón declarado en su fila:

- Patrón A → `verify_jwt = true` en `supabase/config.toml`.
- Patrón B → `verify_jwt = false` + validación de firma obligatoria en el handler.
- Patrón C → `verify_jwt = false` + comparación segura del secreto interno.

## Webhook URLs — reemplazo pendiente (Fase 1)

| Proveedor | URL staging | URL productiva |
|-----------|-------------|-----------------|
| Stripe    | `https://<staging-host>/functions/v1/stripe-webhook` | Cambiar en Fase 1 |
| Verificamex | `https://<staging-host>/functions/v1/verificamex-penny-test` | Idem |
| pg_cron dispute-deadlines | `https://<staging-host>/functions/v1/dispute-deadlines` | Idem |
| pg_cron support-sla | `https://<staging-host>/functions/v1/support-sla` | Idem |
