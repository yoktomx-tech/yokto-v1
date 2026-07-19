# Inventario de lógica de servidor

YOKTO usa **TanStack Start server functions** (`createServerFn`) + **server routes** (`createFileRoute` con bloque `server`) sobre el runtime de Lovable Cloud. NO existen Supabase Edge Functions clásicas (`supabase/functions/*/index.ts`).

En la migración a Supabase externo hay dos rutas viables por tipo de lógica:

| Tipo | Ubicación actual | En Supabase externo |
|---|---|---|
| Lógica app-internal (leer/escribir con la sesión del usuario) | `src/lib/*.functions.ts` (`requireSupabaseAuth`) | **Se queda en el frontend**: TanStack Start se despliega en Vercel/Cloudflare Pages y sigue llamando a Supabase con la sesión del usuario (RLS). No requiere Edge Function. |
| Endpoints HTTP públicos (webhooks, crons, API v1) | `src/routes/api/public/*.ts` | **Portar a Supabase Edge Functions** (Deno) o dejar en el frontend host si expone rutas HTTP. Recomendado: Edge Functions para independencia del frontend. |

## Server routes públicos actuales (a portar)

| Ruta | Propósito | Secreto/firma |
|---|---|---|
| `POST /api/public/stripe/webhook` | Recibe eventos Stripe (payment_intent, checkout, refund, payout, account.updated) | `STRIPE_WEBHOOK_SECRET` (HMAC SHA-256) |
| `POST /api/public/hooks/dispute-deadlines` | Cron: vencimientos de disputas | Secret compartido |
| `POST /api/public/hooks/support-sla` | Cron: SLA de tickets + notificaciones email | Secret compartido |
| `POST /api/public/hooks/verificamex-penny-test` | Webhook Verificamex penny-test | Token en query/header |
| `GET/POST /api/public/v1/transactions` | API v1 pública para clientes con API key | Auth por `api_clients` |

## Migración recomendada

1. Para **cada ruta pública actual**, crear `supabase/functions/<slug>/index.ts` con la misma lógica (Deno + `supabase-js`).
2. Verificar firma / API key **antes** de cualquier operación privilegiada.
3. Registrar en tabla `webhook_events` (nueva, ver 02-role-model) para idempotencia.
4. Actualizar en Stripe/Nubarium/Verificamex/pg_cron los URLs a `https://<project-ref>.supabase.co/functions/v1/<slug>`.

## Server functions app-internal (no requieren Edge Function)

`src/lib/*.functions.ts` — 25+ módulos con `createServerFn().middleware([requireSupabaseAuth])`. Estos se ejecutan en el runtime de TanStack Start (Vercel/Cloudflare Pages/Node) contra `SUPABASE_URL` externa. **No se migran a Edge Functions.**

Contadores:
```
admin/admin.functions.ts
admin/audit.functions.ts
admin/support.functions.ts
api-clients.functions.ts
bank-verification.functions.ts
biometric.functions.ts
disputes.functions.ts
fiscal/fiscal.functions.ts
funding.functions.ts
global-search.functions.ts
ledger.functions.ts
mediation.functions.ts
onboarding.functions.ts
orgs.functions.ts
payments-list.functions.ts
payments.functions.ts
pld.functions.ts
reports.functions.ts
support.functions.ts
transactions.functions.ts
tx-documents.functions.ts
verification.functions.ts
```

Cada una usa `context.supabase` (cliente con bearer token del usuario, RLS activa) o `supabaseAdmin` (service role, solo dentro del `.handler()` con `await import(...)`).

## Migraciones SQL ya versionadas

El directorio `supabase/migrations/` ya contiene **45 migraciones cronológicas** que reproducen el estado actual desde cero. Éstas SON portables tal cual — `supabase db push` contra el proyecto externo las aplica en orden.

Sin embargo, para claridad y auditabilidad de esta migración, en `migration/01-schema/` proveemos un **dump consolidado** del estado final actual (idempotente, `IF NOT EXISTS`, etc.). Puedes elegir:

- **Opción A**: usar las 45 migraciones existentes (`cp -r supabase/migrations/ nuevo-proyecto/supabase/migrations/`) + `supabase db push`. Historia completa preservada.
- **Opción B**: partir del dump consolidado (`migration/01-schema/*.sql` renombrado a una migración inicial única). Cronología comprimida.

Recomendado: **Opción A** para preservar historia y facilitar rollback puntual.
