# Edge Functions y Webhooks — inventario completo y plan de migración

Todas las funciones y webhooks operativos deben apuntar al proyecto Supabase externo antes de autorizar el corte. Este documento es la lista maestra.

## Categorías

1. **TSS server functions** (`createServerFn`) — ver `../00-inventory/tss-server-functions-inventory.md`. Correr como Edge Function Deno.
2. **Server routes públicas** (`src/routes/api/public/*`) — endpoints HTTP externos.
3. **Database webhooks** — hoy ninguno.
4. **pg_cron jobs** — 3 activos.
5. **Webhooks entrantes de proveedores** — Stripe, Verificamex.
6. **Callbacks de correo/notificaciones** — SLA soporte, disputas.

## Tabla maestra

| # | Tipo | Nombre | Endpoint anterior (Cloud) | Endpoint nuevo (destino) | Secretos | JWT verify | Autenticación | Autorización | CORS | Idempotencia | Timeout | Proveedor externo | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Edge Fn (TSS→Deno) | `admin-*` | TSS interno | `functions/v1/backoffice-admin` | `SUPABASE_SERVICE_ROLE_KEY` | Sí | Bearer usuario | `has_platform_role` / `internal_role_assignments` | Same-origin | `internal_action_log.request_id` | 30s | — | Revertir a TSS |
| 2 | Edge Fn | `api-clients` | TSS interno | `functions/v1/api-clients` | `SUPABASE_SERVICE_ROLE_KEY` | Sí | Bearer usuario | `platform_admin` | Same-origin | UUID request | 15s | — | Revertir |
| 3 | Edge Fn | `bank-verification` | TSS interno | `functions/v1/bank-verification` | `VERIFICAMEX_API_KEY`, `BANK_ACCOUNT_HASH_SECRET` | Sí | Bearer | RLS `bank_accounts` | Same-origin | Hash CLABE + user | 30s | Verificamex | Revertir |
| 4 | Edge Fn | `biometric` | TSS interno | `functions/v1/biometric` | `NUBARIUM_USER`, `NUBARIUM_PASSWORD` | Sí | Bearer | RLS `biometric_enrollments` | Same-origin | `biometric_enrollments.id` | 60s | Nubarium | Revertir |
| 5 | Edge Fn | `disputes` | TSS interno | `functions/v1/disputes` | service_role | Sí | Bearer | Parte disputa / `dispute_manager` | Same-origin | `disputes.numero` | 15s | — | Revertir |
| 6 | Edge Fn | `fiscal` | TSS interno | `functions/v1/fiscal` | `GEMINI_API_KEY` | Sí | Bearer | `has_org_role` | Same-origin | Hash SHA CFDI | 60s | Gemini | Revertir |
| 7 | Edge Fn | `funding` | TSS interno | `functions/v1/funding` | `STRIPE_SECRET_KEY` | Sí | Bearer | `has_org_role finance/owner` | Same-origin | `payment_intents.provider_ref` | 30s | Stripe | Revertir |
| 8 | Edge Fn | `ledger` | TSS interno | `functions/v1/ledger` | service_role | Sí | Bearer | `finance_ops` / owner | Same-origin | — (read) | 15s | — | Revertir |
| 9 | Edge Fn | `mediation` | TSS interno | `functions/v1/mediation` | service_role | Sí | Bearer | `dispute_manager` | Same-origin | Message id | 15s | — | Revertir |
| 10 | Edge Fn | `onboarding` | TSS interno | `functions/v1/onboarding` | `NUBARIUM_*`, `COPOMEX_TOKEN` | Sí | Bearer | Self | Same-origin | `profiles.id` + step | 60s | Nubarium, Copomex | Revertir |
| 11 | Edge Fn | `orgs` | TSS interno | `functions/v1/orgs` | service_role (ownership) | Sí | Bearer | Owner / `admin` | Same-origin | Token invitación | 15s | — | Revertir |
| 12 | Edge Fn | `payments` | TSS interno | `functions/v1/payments` | Stripe | Sí | Bearer | RLS | Same-origin | `provider_ref` | 15s | Stripe | Revertir |
| 13 | Edge Fn | `pld` | TSS interno | `functions/v1/pld` | Listas AML | Sí | Bearer | `compliance_officer` | Same-origin | `pld_screening_results.id` | 60s | Proveedor listas | Revertir |
| 14 | Edge Fn | `reports` | TSS interno | `functions/v1/reports` | service_role | Sí | Bearer | `compliance_officer` / `finance_ops` | Same-origin | Rango fechas + tipo | 60s | — | Revertir |
| 15 | Edge Fn | `support` | TSS interno | `functions/v1/support` | service_role | Sí | Bearer | Parte ticket / `support_agent` | Same-origin | `support_tickets.numero` | 15s | — | Revertir |
| 16 | Edge Fn | `transactions` | TSS interno | `functions/v1/transactions` | service_role | Sí | Bearer | `has_org_role` | Same-origin | `transactions.numero` | 30s | — | Revertir |
| 17 | Edge Fn | `tx-documents` | TSS interno | `functions/v1/tx-documents` | service_role | Sí | Bearer | Parte transacción | Same-origin | SHA-256 doc | 30s | — | Revertir |
| 18 | Edge Fn | `verification` | TSS interno | `functions/v1/verification` | service_role | Sí | Bearer | `document_reviewer` | Same-origin | Queue id | 30s | — | Revertir |
| 19 | Server Route (webhook) | `stripe-webhook` | `<preview>/api/public/stripe.webhook` | `functions/v1/stripe-webhook` (config `--no-verify-jwt`) | `STRIPE_WEBHOOK_SECRET` | No (firma HMAC Stripe) | Firma `stripe-signature` | Whitelist eventos | `*` con validación | `stripe_webhook_events.event_id` (dedupe) | 30s | Stripe | Mantener old URL 48h |
| 20 | Server Route (API pública) | `api-v1-transactions` | `<preview>/api/public/v1.transactions` | `functions/v1/api-v1-transactions` | Bearer API-client | No | `api_clients.hashed_secret` | Scopes | Config cliente | `Idempotency-Key` header | 30s | Terceros B2B | Redirect 302 desde old |
| 21 | Server Route (webhook) | `verificamex-webhook` | `<preview>/api/public/hooks/verificamex-penny-test` | `functions/v1/verificamex-webhook` | `VERIFICAMEX_WEBHOOK_TOKEN` | No (token compartido) | Header token | — | `*` con validación | `bank_account_penny_tests.provider_ref` | 15s | Verificamex | Mantener old 48h |
| 22 | Cron | `dispute-deadlines` | pg_cron → old URL | pg_cron → `functions/v1/cron-dispute-deadlines` | `app.settings.cron_secret` HMAC | No | HMAC header | — | Same-origin | `disputes.id` visitado | 60s | — | Desactivar cron nuevo, reactivar viejo |
| 23 | Cron | `support-sla` | pg_cron → old URL | pg_cron → `functions/v1/cron-support-sla` | HMAC + `RESEND_API_KEY` | No | HMAC header | — | Same-origin | `support_tickets.id + tick` | 60s | Resend (email) | Idem |
| 24 | Cron SQL puro | `cleanup-abandoned-onboarding` | pg_cron → función SQL | pg_cron → función SQL (idéntico) | — | N/A | — | SECURITY DEFINER | N/A | — | 10s | — | Reactivar viejo |

## Reglas por función

- **JWT verify**: Edge Functions deben registrarse con `verify_jwt = true` (default) en `supabase/functions/<name>/deno.json` salvo webhooks entrantes de terceros, que se despliegan con `--no-verify-jwt` y validan firma/HMAC manualmente.
- **service_role**: sólo dentro del handler tras validar el rol del caller (`has_platform_role` u otro) — NUNCA exponer al bundle del cliente.
- **CORS**: same-origin para funciones invocadas por el frontend; whitelist explícita para webhooks/API públicas.
- **Idempotencia**: obligatoria en cualquier función que escriba (webhooks, transacciones, disputas). Mecanismo estándar: tabla `*_events` o campo `provider_ref` con `UNIQUE`.
- **Timeout**: default 60s del plan de Supabase. Cualquier proceso > 60s se documenta como servicio externo (ninguno hoy).
- **Rollback**: durante 48 h tras el corte, mantener las URLs anteriores respondiendo 302 → nuevas, para tolerar caches de proveedores.

## Actualización de URLs en proveedores externos

Ejecutar durante la ventana T-0 +15 min (ver `07-cutover/cutover-checklist.md`):

| Proveedor | Dashboard | URL nueva |
| --- | --- | --- |
| Stripe | Developers → Webhooks | `https://<ref>.functions.supabase.co/stripe-webhook` |
| Verificamex | Configuración de callbacks | `https://<ref>.functions.supabase.co/verificamex-webhook` |
| API clients B2B | Comunicado por email + panel | `https://<ref>.functions.supabase.co/api-v1-transactions` |

Guardar el ACK de cada proveedor en `07-cutover/webhook-ack.md`.

## Servicios externos formales (post-corte)

Si al llegar el corte algún proceso requiere permanecer fuera de Supabase por límites técnicos, documentarlo aquí como **servicio externo YOKTO** con:

- justificación (timeout, cola, dependencia binaria);
- host (nunca Lovable Cloud);
- forma de autenticación contra Supabase externo (service_role o bearer app-user);
- monitoreo y logging.

Hoy no hay ningún servicio externo formal; la meta es cero al momento del corte.
