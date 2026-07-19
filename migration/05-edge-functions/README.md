# Server functions / server routes → convivencia con Supabase externo

**Decisión de arquitectura**: en YOKTO NO se portea la lógica de servidor a Supabase Edge Functions (Deno). El backend de aplicación **se queda en TanStack Start** desplegado en Lovable (o cualquier hosting Node/Cloudflare Workers).

Motivo:
- Toda la lógica actual usa `createServerFn` de TanStack con `requireSupabaseAuth`. Traducir a Deno multiplicaría archivos y forzaría duplicar validaciones.
- Supabase Edge Functions añade latencia extra (cold starts) y no ofrece ventaja aquí — sólo hablan con Postgres/Storage, cosa que también hace TanStack Start.

**Excepción**: sólo se convierten a Edge Function los procesos que deben correr:
- En un cron externo a Lovable (pg_cron llamando directamente al endpoint).
- Con acceso al `service_role` sin exponer el frontend al Worker.

## Inventario y destino final

| Origen actual | Tipo | Destino post-migración | Motivo |
|---|---|---|---|
| `src/lib/*.functions.ts` (∼30) | `createServerFn` | **Se queda en TanStack Start** | Auth y RLS del usuario aplican; sin cambios |
| `src/routes/api/public/hooks/support-sla.ts` | TSS route | **Se queda en TanStack**; cambia origen del cron a `pg_cron` apuntando al URL público del hosting | Endpoint público, HMAC |
| `src/routes/api/public/webhooks/stripe.ts` | TSS route | **Se queda en TanStack**; actualizar Stripe Dashboard con nuevo URL | Verifica firma HMAC de Stripe |
| `src/routes/api/public/webhooks/verificamex.ts` | TSS route | **Se queda en TanStack**; actualizar Verificamex con nuevo URL | Verifica `VERIFICAMEX_WEBHOOK_TOKEN` |
| `src/routes/api/public/hooks/kyc-cleanup.ts` | TSS route | **Se queda en TanStack** | Cron por hosting |

## Qué cambia exactamente en cada archivo

Sólo la fuente de las variables de entorno. Los archivos ya usan `process.env.SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`; cuando Lovable inyecte los valores del **nuevo** proyecto, todo funciona sin refactor.

## URLs de webhooks a actualizar en proveedores externos

Post-corte, actualizar en cada dashboard:

| Proveedor | Setting | Nuevo URL |
|---|---|---|
| Stripe | Webhooks → Endpoint | `https://<hosting>/api/public/webhooks/stripe` |
| Verificamex | Callback URL | `https://<hosting>/api/public/webhooks/verificamex` |
| Nubarium | Callback URL (si aplica biometría async) | `https://<hosting>/api/public/webhooks/nubarium` |
| `pg_cron` en Supabase externo | Job HTTP | `https://<hosting>/api/public/hooks/support-sla` con header `Authorization: Bearer <CRON_SECRET>` |

## Crons a re-crear con `pg_cron` en el nuevo proyecto

```sql
SELECT cron.schedule(
  'support-sla-check',
  '*/15 * * * *',
  $$SELECT net.http_post(
      url:='https://<hosting>/api/public/hooks/support-sla',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
      )
    );$$
);

SELECT cron.schedule(
  'kyc-cleanup-abandoned',
  '0 3 * * *',
  $$SELECT net.http_post(
      url:='https://<hosting>/api/public/hooks/kyc-cleanup',
      headers:=jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
      )
    );$$
);
```

Habilitar extensiones en el proyecto destino:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
ALTER DATABASE postgres SET app.settings.cron_secret = '<mismo valor que la env var CRON_SECRET del hosting>';
```

## Qué NO se migra a Edge Functions

- **AI Gateway** (`src/lib/ai-gateway.server.ts`): se queda en TanStack. Al eliminar Lovable, hablar directo con Gemini/OpenAI usando `GOOGLE_GENERATIVE_AI_API_KEY`.
- **Emails**: se queda en TanStack. Reemplazar `https://email.lovable.dev` por Resend.
- **Nubarium / Verificamex / Copomex / SAT**: se quedan en TanStack como server functions.

## Si el cliente insistiera en Edge Functions

Aplica exclusivamente a lo público (`api/public/*`). Se convierte el handler TSS a `supabase/functions/<name>/index.ts` con:
- `Deno.env.get('SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY')`
- `import { createClient } from 'jsr:@supabase/supabase-js@2'`
- Verificación HMAC idéntica.
- `supabase functions deploy <name>` desde CI.

No es la ruta recomendada. Sólo se ejecuta si el cliente lo pide explícitamente después de leer este documento.
