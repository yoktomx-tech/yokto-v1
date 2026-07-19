# Function Migration Matrix — TSS server functions → Supabase externo

Documento autoritativo. Complementa `05-edge-functions/migration-plan.md`.

## Aclaración terminológica — ¿qué es una "TSS server function"?

**TSS = TanStack Start**. Es el framework del frontend YOKTO (React 19 +
Vite 7 sobre Cloudflare Workers). Una "server function" en TSS
(`createServerFn` importado de `@tanstack/react-start`) es un RPC
tipado que:

1. Se **declara** en un archivo `*.functions.ts` del repo del frontend.
2. Se **empaqueta** durante el build junto al frontend.
3. Se **ejecuta** en el runtime serverless del hosting del frontend
   (Cloudflare Workers cuando el sitio se publica en Lovable, o
   equivalente en Vercel/Cloudflare/Netlify si se aloja aparte).
4. Se llama desde el navegador con `useServerFn(fn)` y del server con
   la función directa.

Contrasta con:

- **Server routes** (`createFileRoute` con bloque `server`): rutas HTTP
  raw servidas por el mismo runtime del frontend (`src/routes/api/`).
  Se usan para webhooks y APIs públicas.
- **Supabase Edge Functions** (Deno): funciones que corren en la
  infraestructura de Supabase, cerca de la base de datos, con acceso
  al Vault del proyecto y a la conexión Postgres.

## ¿Por qué las TSS server functions no se movieron inicialmente a Edge Functions?

Al construir YOKTO en Lovable Cloud, el patrón nativo era
`createServerFn` porque:

- Compartía el mismo runtime y tipado que el frontend.
- Los generadores de Lovable Cloud producen automáticamente el
  `auth-attacher` y el `auth-middleware` que hacen que
  `requireSupabaseAuth` funcione sin CORS ni bearer manual.
- Evitaba mantener dos deploys (frontend + Supabase functions).

Al migrar Cloud → Supabase externo, la pregunta se replantea:

- Si el hosting del frontend **sigue siendo Lovable/Cloudflare**, las
  TSS server functions siguen corriendo ahí. **Esto por sí solo NO es
  una dependencia de Lovable Cloud como backend** — Lovable Cloud es el
  proyecto Supabase; Lovable como hosting del frontend es un servicio
  separado. Una TSS server function que llama a
  `SUPABASE_SERVICE_ROLE_KEY` del proyecto externo cumple la
  independencia backend.
- Si por política se exige que TODA la lógica backend viva **dentro**
  del proyecto Supabase (Vault, logs, RLS, cercanía a la DB), entonces
  las TSS server functions deben portarse a Supabase Edge Functions.

Según las condiciones autorizadas: "No será aceptable considerar la
migración completa si permanece lógica backend operativa en Lovable
Cloud." Interpretación estricta: **cualquier función que consuma
secretos, escriba con service_role, o llame a proveedores externos con
credenciales debe residir en Supabase Edge Functions del proyecto
externo**. TSS server functions permanecen aceptables solo si actúan
como thin proxies autenticados (`requireSupabaseAuth` + query directa
al proyecto externo bajo RLS) sin secretos ni service_role.

## Categorías

- **A** — Lista para portarse a Supabase Edge Function del proyecto externo.
- **B** — Servicio externo deliberado e independiente (queda en TSS o
  externalizado a otro backend, sin dependencia de Cloud).
- **C** — Dependencia de Lovable Cloud pendiente de eliminación. **BLOCKER**
  para autorizar la Fase 1.
- **D** — Obsoleta o candidata a eliminación durante la migración.

## Matriz completa

| # | Función / Ruta | Ubicación actual | Propósito | Categoría | JWT | Roles autorizados | Tablas | Secretos | Proveedor | Endpoint | CORS | Idempotencia | Webhook | Prueba requerida | Rollback |
|---|----------------|------------------|-----------|-----------|-----|-------------------|--------|----------|-----------|----------|------|--------------|---------|------------------|----------|
| 1 | `onboarding.functions` | `src/lib/onboarding.functions.ts` | Guardar avance de onboarding, KYC PF | **A** | `requireSupabaseAuth` | buyer/seller (owner PF/PM) | profiles, kyc_documents, organizations | NUBARIUM_USER, NUBARIUM_PASSWORD | Nubarium | `/onboarding/*` | same-origin | idempotente por `user_id + step` | — | Flujo completo PF hasta Step 7 en staging | Restaurar categoría B si Edge Function falla y usar server fn temporal |
| 2 | `biometric.functions` | `src/lib/biometric.functions.ts` | Crear token biométrico, subir capturas, comparar con Nubarium Antifraude | **A** | `requireSupabaseAuth` | owner del enrolment | biometric_enrollments, biometric_api_logs | NUBARIUM_USER, NUBARIUM_PASSWORD | Nubarium Antifraude | `/biometric/*` | same-origin | UUID token por enrolment | — | Enroll completo con archivos ficticios | Idem 1 |
| 3 | `bank-verification.functions` | `src/lib/bank-verification.functions.ts` | Iniciar penny test CLABE, consultar status | **A** | `requireSupabaseAuth` | finance, owner | bank_accounts, bank_account_penny_tests, clabe_verifications | VERIFICAMEX_API_KEY, VERIFICAMEX_WEBHOOK_TOKEN, BANK_ACCOUNT_HASH_SECRET | Verificamex | `/bank-verification/*` | same-origin | por `bank_account_id + intento` | `hooks/verificamex-penny-test.ts` (server route → portar a Edge Function) | Alta cuenta bancaria staging + webhook simulado | Idem 1 |
| 4 | `fiscal/fiscal.functions` | `src/lib/fiscal/fiscal.functions.ts` | Parsear CFDI XML, validar SAT | **A** | `requireSupabaseAuth` | operator, finance | fiscal_documents | — (pesa por CPU, no por secretos) | SAT catálogos locales | `/fiscal/*` | same-origin | por `uuid_cfdi` | — | Carga CFDI ficticio, validación coherencia | — |
| 5 | `disputes.functions` | `src/lib/disputes.functions.ts` | CRUD disputas, deposit ganador-pierde | **A** | `requireSupabaseAuth` | buyer/seller parte, dispute_manager | disputes, dispute_messages, dispute_evidence, ledger | STRIPE_SECRET_KEY | Stripe | `/disputes/*` | same-origin | por `dispute_id + action` | `hooks/dispute-deadlines.ts` (cron) | Abrir, mensajear, resolver disputa en staging | — |
| 6 | `mediation.functions` | `src/lib/mediation.functions.ts` | Escalado a mediador, resolución | **A** | `requireSupabaseAuth` | dispute_manager, super_admin | disputes | — | — | `/mediation/*` | same-origin | por `dispute_id` | — | Escalar disputa staging | — |
| 7 | `funding.functions` | `src/lib/funding.functions.ts` | Crear PaymentIntent (SPEI/Card), confirmar fondeo | **A** | `requireSupabaseAuth` | buyer, finance, owner | payment_intents, transactions, transaction_events | STRIPE_SECRET_KEY | Stripe (o mock) | `/funding/*` | same-origin | por `transaction_id + method` | `api/public/stripe.webhook.ts` (webhook → portar a Edge Function) | Fondeo Stripe test end-to-end | — |
| 8 | `payments.functions` | `src/lib/payments.functions.ts` | Liberar fondos al seller, reembolsar | **A** | `requireSupabaseAuth` | finance, finance_ops, super_admin | payouts, ledger, transactions | STRIPE_SECRET_KEY | Stripe Connect | `/payments/*` | same-origin | por `transaction_id + release_id` | — | Liberación/reembolso test | — |
| 9 | `payments-list.functions` | `src/lib/payments-list.functions.ts` | Listar/filtrar pagos por org | **A** | `requireSupabaseAuth` | finance, viewer, auditor, owner | payments, payouts | — | — | `/payments-list/*` | same-origin | GET puro | — | Consulta org ajena → DENY | — |
| 10 | `ledger.functions` | `src/lib/ledger.functions.ts` | Consultar ledger unificado | **A** | `requireSupabaseAuth` | finance, viewer, auditor | reports_ledger, transactions, payouts | — | — | `/ledger/*` | same-origin | GET puro | — | Consulta cross-org | — |
| 11 | `reports.functions` | `src/lib/reports.functions.ts` | Generar reportes (CSV/PDF) | **A** | `requireSupabaseAuth` | auditor, super_admin | audit_events, transactions | — | — | `/reports/*` | same-origin | por `report_id` | — | Exportar CSV ficticio | — |
| 12 | `verification.functions` | `src/lib/verification.functions.ts` | Verificar identidad (Nubarium, CURP, RFC) | **A** | `requireSupabaseAuth` | kyc_reviewer, compliance | curp_verifications, verification_evidence | NUBARIUM_USER, NUBARIUM_PASSWORD | Nubarium | `/verification/*` | same-origin | por `user_id + tipo` | — | Prueba CURP ficticio | — |
| 13 | `pld.functions` | `src/lib/pld.functions.ts` | Cuestionario PLD, screening, cálculo de riesgo | **A** | `requireSupabaseAuth` | compliance, super_admin | pld_* | — | Listas OFAC/PEP (embed) | `/pld/*` | same-origin | por `profile_id + version` | — | Screening usuario ficticio | — |
| 14 | `orgs.functions` | `src/lib/orgs.functions.ts` | Crear/editar organizaciones, invitar miembros | **A** | `requireSupabaseAuth` | owner, org_admin | organizations, memberships, invitations | — | Resend (para email de invitación) | `/orgs/*` | same-origin | por `invitation_token` | — | Invitación + aceptación en staging | — |
| 15 | `admin/admin.functions` | `src/lib/admin/admin.functions.ts` | Backoffice general (métricas, incidents) | **A** | `requireSupabaseAuth` | super_admin | platform_incidents, organizations | — | — | `/admin/*` | same-origin | GET puro | — | Acceso con super_admin | — |
| 16 | `admin/audit.functions` | `src/lib/admin/audit.functions.ts` | Consultar internal_action_log y audit_events | **A** | `requireSupabaseAuth` | super_admin, compliance | internal_action_log, audit_events | — | — | `/admin/audit/*` | same-origin | GET puro | — | Consulta audit backoffice | — |
| 17 | `admin/support.functions` | `src/lib/admin/support.functions.ts` | Gestionar tickets desde backoffice, cerrar con MFA | **A** | `requireSupabaseAuth` (+ AAL2 para sensibles) | support_agent, dispute_manager, super_admin | support_tickets, support_messages, internal_action_log | — | Resend | `/admin/support/*` | same-origin | por `ticket_id + close_reason` | `hooks/support-sla.ts` (cron) | Cierre ticket escalado con MFA | — |
| 18 | `support.functions` | `src/lib/support.functions.ts` | Cliente crea/lista sus tickets | **A** | `requireSupabaseAuth` | cualquier autenticado | support_tickets, support_messages, support_attachments | — | Resend | `/support/*` | same-origin | por `ticket_id + message_ord` | — | Crear ticket con adjunto | — |
| 19 | `tx-documents.functions` | `src/lib/tx-documents.functions.ts` | Subir/firmar documentos de transacción | **A** | `requireSupabaseAuth` | operator, owner, finance | transaction_documents, contract_signatures | BANK_ACCOUNT_HASH_SECRET (para hash de contrato) | — | `/tx-documents/*` | same-origin | por `document_id` | — | Upload + firma en staging | — |
| 20 | `transactions.functions` | `src/lib/transactions.functions.ts` | Crear/editar operaciones, hitos | **A** | `requireSupabaseAuth` | buyer, seller, operator, owner | transactions, transaction_hitos, transaction_events | — | — | `/transactions/*` | same-origin | por `transaction_id + numero` | — | Wizard completo staging | — |
| 21 | `api-clients.functions` | `src/lib/api-clients.functions.ts` | Gestión API keys B2B | **A** | `requireSupabaseAuth` | owner, super_admin | api_clients | — | — | `/api-clients/*` | same-origin | por `api_client_id` | — | Alta/rotación key staging | — |
| 22 | `admin.functions` (legacy top-level) | `src/lib/admin.functions.ts` | Wrapper hacia `admin/*` | **D** | — | — | — | — | — | — | — | — | — | Verificar que no lo consume nadie y eliminar | — |
| 23 | `global-search.functions` | `src/lib/global-search.functions.ts` | Búsqueda unificada de transacciones/disputas/tickets/artículos | **A** | `requireSupabaseAuth` | cualquier autenticado | múltiples (via RLS) | — | — | `/global-search/*` | same-origin | GET puro | — | Búsqueda cross-role con RLS filtrando | — |
| 24 | `ai-gateway.server` | `src/lib/ai-gateway.server.ts` | Wrapper de Lovable AI Gateway para Gemini | **C** ⚠ | server-only | invocada por funciones internas | — | LOVABLE_API_KEY (Cloud managed) | Lovable AI Gateway → Gemini | — | — | por prompt hash | — | Reemplazar por llamada directa a Google Gemini con `GEMINI_API_KEY` propio | **BLOCKER** hasta migrar |
| 25 | `lovable-error-reporting.ts` | `src/lib/lovable-error-reporting.ts` | Reporte de errores a Lovable | **D** | — | — | — | — | Lovable telemetry | — | — | — | — | Eliminar en la rama staging | — |
| 26 | `api/public/hooks/dispute-deadlines.ts` | `src/routes/api/public/hooks/` | Cron: procesar vencimientos de disputa | **A** | `--no-verify-jwt` + secret query param | — | disputes, notifications | CRON_SECRET | — | `/hooks/dispute-deadlines` | público | idempotente por `deadline_id` | — | Cron `pg_cron` en staging | — |
| 27 | `api/public/hooks/support-sla.ts` | idem | Cron: SLA soporte + notificar | **A** | idem | — | support_tickets, notifications | CRON_SECRET, RESEND_API_KEY (o email nativo Supabase) | Resend | `/hooks/support-sla` | público | idempotente por `ticket_id + breach_kind` | — | Cron en staging | — |
| 28 | `api/public/hooks/verificamex-penny-test.ts` | idem | Webhook Verificamex confirmando penny test | **A** | verifica firma HMAC | — | bank_account_penny_tests | VERIFICAMEX_WEBHOOK_TOKEN | Verificamex | `/hooks/verificamex-penny-test` | público | por `event_id` | — | Webhook simulado con firma | — |
| 29 | `api/public/stripe.webhook.ts` | idem | Webhook Stripe (payment_intent, charge, transfer) | **A** | verifica firma Stripe | — | stripe_webhook_events, payment_intents, payouts | STRIPE_WEBHOOK_SECRET | Stripe | `/stripe.webhook` | público | por `event_id` UNIQUE | — | Stripe CLI trigger contra staging | — |
| 30 | `api/public/v1.transactions.ts` | idem | API pública B2B para consultar transacciones | **A** | verifica API key en `api_clients` | api_clients activos | transactions | — | — | `/v1/transactions` | público (con auth) | GET puro | — | Cliente API con key staging | — |

## Resumen por categoría

- **A (migrar a Edge Functions externo o mantener como TSS con backend externo)**: 27
- **B (externo deliberado)**: 0
- **C (BLOCKER — dependencia de Cloud)**: 1 → `ai-gateway.server.ts` con `LOVABLE_API_KEY`.
- **D (obsoleto — eliminar)**: 2 → `admin.functions.ts` legacy, `lovable-error-reporting.ts`.

## Decisión pendiente sobre categoría A

Al final del dry run, cada función en A debe declararse como:

- **A.1 — Portada a Supabase Edge Function** (Deno) del proyecto externo.
  Requerida para funciones que usan `service_role` o secretos backend
  críticos.
- **A.2 — Permanece como TSS server function** llamando al proyecto
  Supabase externo con `requireSupabaseAuth` (RLS aplicada) o
  service_role leído de las variables de entorno del hosting del
  frontend, no de Lovable Cloud.

La decisión se registra por función en
`reports/edge-functions-inventory-final.md`.

## Blockers para Fase 1

1. **`ai-gateway.server.ts`**: reemplazar `LOVABLE_API_KEY` +
   `https://ai-gateway.lovable.dev` por llamada directa a
   `https://generativelanguage.googleapis.com/...` con `GEMINI_API_KEY`
   propio en el Vault del Supabase externo. Sin esto, sigue habiendo
   dependencia Cloud para la funcionalidad AI (verificación documental).
2. Cualquier función categoría A cuya portación a Edge Function no
   supere las pruebas del dry run se marca como blocker temporal hasta
   que pase.

## Webhook URLs — reemplazo pendiente

Sólo se actualizan en Fase 1 (corte productivo). Durante staging usar
endpoints del proyecto staging:

| Proveedor | URL staging | URL productiva (Fase 1) |
|-----------|-------------|-------------------------|
| Stripe    | `https://<staging-host>/stripe.webhook` | Mantener actual, cambiar en Fase 1 |
| Verificamex | `https://<staging-host>/hooks/verificamex-penny-test` | Idem |
| pg_cron dispute-deadlines | `https://<staging-host>/hooks/dispute-deadlines` | Idem |
| pg_cron support-sla | `https://<staging-host>/hooks/support-sla` | Idem |
