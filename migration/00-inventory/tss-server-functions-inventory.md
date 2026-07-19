# TSS Server Functions — Inventario y decisión de migración

**TSS = TanStack Start server functions**: RPCs tipadas creadas con `createServerFn` de `@tanstack/react-start`. Se compilan como parte del bundle SSR del frontend TanStack (Cloudflare Workers vía Lovable Hosting), NO son Supabase Edge Functions ni funciones de Lovable Cloud.

## Aclaración crítica

Las TSS server functions **no se ejecutan dentro de Lovable Cloud**. Lovable Cloud = Supabase gestionado (Auth, DB, Storage). El SSR de TanStack corre en el hosting del frontend (Cloudflare Workers). Por eso el checklist de corte las trata como "capa frontend/BFF" y no como "backend Lovable Cloud".

Aun así, este documento evalúa función por función si permanecerán como TSS o si deben portarse a `supabase/functions/` del proyecto externo, conforme al criterio del cliente: **toda lógica de negocio, autenticación, autorización, pagos, webhooks, documentos, notificaciones o acceso privilegiado a datos migra preferentemente a Edge Functions Deno**.

## Runtime, endpoint, autenticación (común)

| Atributo | Valor |
| --- | --- |
| Runtime | Cloudflare Workers (nodejs_compat) vía TanStack Start SSR |
| Endpoint interno | `/_serverFn/<hash>` (RPC serializada, no HTTP JSON) |
| Autenticación | `requireSupabaseAuth` middleware → bearer JWT del cliente Supabase externo |
| Autorización | `has_role`, `has_org_role`, `has_platform_role` (RLS + funciones SECURITY DEFINER) |
| Cliente DB | `context.supabase` (bearer del usuario, RLS aplica) o `supabaseAdmin` (service_role, sólo dentro del handler) |
| Invocador | Únicamente el frontend YOKTO (mismo origen). No expuesto a terceros. |

## Inventario detallado

| # | Nombre / archivo | Propósito | Secretos | Tablas | Decisión |
| --- | --- | --- | --- | --- | --- |
| 1 | `admin.functions.ts` / `admin/*.functions.ts` | Backoffice: KYC, cola documental, disputas, soporte, auditoría, gestión de roles | `SUPABASE_SERVICE_ROLE_KEY` | `internal_role_assignments`, `internal_action_log`, `kyc_documents`, `document_review_queue`, `disputes`, `support_tickets`, `audit_events` | **MIGRAR a Edge Function** `backoffice-*`: contiene lógica de autorización con service_role. |
| 2 | `api-clients.functions.ts` | Gestión de API clients para integraciones B2B | `SUPABASE_SERVICE_ROLE_KEY` | `api_clients` | **MIGRAR** — emite/rota credenciales. |
| 3 | `bank-verification.functions.ts` | Verifica CLABE, dispara Verificamex penny-test | `VERIFICAMEX_API_KEY`, `BANK_ACCOUNT_HASH_SECRET` | `bank_accounts`, `bank_account_penny_tests`, `clabe_verifications` | **MIGRAR** — usa secretos financieros y llama proveedor externo. |
| 4 | `biometric.functions.ts` | Sesión biométrica, comparación facial Nubarium | `NUBARIUM_USER`, `NUBARIUM_PASSWORD` | `biometric_enrollments`, `biometric_api_logs` | **MIGRAR** — datos biométricos privilegiados. |
| 5 | `disputes.functions.ts` | Alta/gestión de disputas, evidencia | `SUPABASE_SERVICE_ROLE_KEY` (para asignación) | `disputes`, `dispute_evidence`, `dispute_messages` | **MIGRAR** — lógica de negocio crítica. |
| 6 | `fiscal/fiscal.functions.ts` | Validación CFDI/PPD/REP, cotejo SAT | `LOVABLE_API_KEY` (Gemini) → reemplazar por `GEMINI_API_KEY` | `fiscal_documents` | **MIGRAR** — documentos fiscales. |
| 7 | `funding.functions.ts` | Fondeo de operaciones (intents SPEI/tarjeta) | Stripe (`STRIPE_SECRET_KEY` cuando aplique) | `payment_intents`, `transactions` | **MIGRAR** — pagos. |
| 8 | `global-search.functions.ts` | Búsqueda cross-tabla con RLS del usuario | Ninguno privilegiado | Múltiples (SELECT sólo con bearer del usuario) | **PUEDE permanecer como TSS** — sólo lectura con RLS, sin secretos ni webhooks. Justificación: latencia baja y necesidad de tipos compartidos con la UI. |
| 9 | `ledger.functions.ts` | Ledger financiero de una operación | `SUPABASE_SERVICE_ROLE_KEY` (agregados) | `reports_ledger`, `payouts`, `payment_intents` | **MIGRAR** — conciliación financiera. |
| 10 | `mediation.functions.ts` | Acciones de mediador en disputas | service_role para asignación | `disputes`, `dispute_messages` | **MIGRAR**. |
| 11 | `onboarding.functions.ts` | Nubarium CURP/RFC/e.firma, alta de perfil | `NUBARIUM_USER`, `NUBARIUM_PASSWORD`, `COPOMEX_TOKEN` | `profiles`, `curp_verifications`, `postal_code_lookups` | **MIGRAR** — datos KYC. |
| 12 | `orgs.functions.ts` | Alta de organizaciones, invitaciones, memberships | service_role para transferencias de ownership | `organizations`, `memberships`, `invitations` | **MIGRAR**. |
| 13 | `payments.functions.ts` / `payments-list.functions.ts` | Listado y detalle de pagos | Stripe | `payment_intents`, `payouts`, `transactions` | **MIGRAR**. |
| 14 | `pld.functions.ts` | Motor PLD/FT, screening PEP/OFAC | Listas AML (a integrar) | `pld_*` | **MIGRAR** — cumplimiento. |
| 15 | `reports.functions.ts` | Reportes regulatorios | service_role | `audit_events`, `reports_ledger` | **MIGRAR**. |
| 16 | `support.functions.ts` | Tickets, mensajes, adjuntos, SLA | service_role para escalamiento | `support_tickets`, `support_messages`, `support_attachments` | **MIGRAR**. |
| 17 | `transactions.functions.ts` | CRUD operaciones, wizard 6 pasos | service_role para asignar numero | `transactions`, `transaction_hitos`, `transaction_events` | **MIGRAR**. |
| 18 | `tx-documents.functions.ts` | Contratos y hashes SHA-256 | service_role | `transaction_documents`, `contract_signatures` | **MIGRAR**. |
| 19 | `verification.functions.ts` | Colas de verificación, decisión final | service_role | `verification_evidence`, `document_review_queue` | **MIGRAR**. |

## Rutas HTTP públicas (`src/routes/api/public/*`)

Son **server routes** de TanStack (no `createServerFn`) — sí son endpoints HTTP externos con contrato fijo. Todas deben portarse a Edge Functions Deno:

| Ruta | Proveedor invocador | Secreto | Migración |
| --- | --- | --- | --- |
| `stripe.webhook.ts` | Stripe | `STRIPE_WEBHOOK_SECRET` | `supabase/functions/stripe-webhook/` |
| `v1.transactions.ts` | API B2B pública | Bearer API-client | `supabase/functions/api-v1-transactions/` |
| `hooks/verificamex-penny-test.ts` | Verificamex | `VERIFICAMEX_WEBHOOK_TOKEN` | `supabase/functions/verificamex-webhook/` |
| `hooks/dispute-deadlines.ts` | pg_cron | `app.settings.cron_secret` | `supabase/functions/cron-dispute-deadlines/` |
| `hooks/support-sla.ts` | pg_cron | `app.settings.cron_secret` + email | `supabase/functions/cron-support-sla/` |

## Regla de corte

Al finalizar la Fase 1 (corte productivo) la única TSS server function que puede subsistir es `global-search.functions.ts`, y sólo si el equipo YOKTO confirma por escrito que:

1. no usa `supabaseAdmin`;
2. depende únicamente del bearer del usuario;
3. no llama proveedores externos;
4. su latencia justifica no salir del bundle SSR.

Todas las demás deben tener contraparte en `supabase/functions/` antes de autorizar el corte. Hasta entonces cada TSS se considera **backend operativo** y bloquea la aprobación final.
