# Dependencias de Lovable Cloud a eliminar/sustituir

Inventario de referencias a Lovable Cloud, Lovable AI Gateway, Lovable auth SDK y URLs de Lovable en el código. Cada una debe reemplazarse por el equivalente estándar Supabase o por una integración directa con el proveedor.

## 1. Cliente Supabase auto-generado (sobrescribir)

| Archivo | Contenido a reemplazar | Sustituto |
|---|---|---|
| `src/integrations/supabase/client.ts` | Lee `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` con fallback a `process.env`, incluye `createSupabaseFetch` que valida claves formato `sb_publishable_*` | Ver `migration/06-frontend-portable/client.ts` — usa `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` estándar |
| `src/integrations/supabase/client.server.ts` | Cliente admin con service role, mismo wrapper `createSupabaseFetch` | Ver `migration/06-frontend-portable/client.server.ts` — igual, sin el wrapper de claves `sb_` |
| `src/integrations/supabase/auth-middleware.ts` | Middleware `requireSupabaseAuth` con validaciones específicas de Cloud | Ver `migration/06-frontend-portable/auth-middleware.ts` — mismo shape, sin dependencias Cloud |
| `src/integrations/supabase/auth-attacher.ts` | Attacher del bearer para `functionMiddleware` | Ver `migration/06-frontend-portable/auth-attacher.ts` — sin cambios estructurales |
| `src/integrations/supabase/types.ts` | Tipos generados por Lovable Cloud | Regenerar con `supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts` |

## 2. Lovable Auth SDK (eliminar)

| Archivo | Uso | Sustituto |
|---|---|---|
| `src/integrations/lovable/index.ts` | Exporta `lovable.auth.signInWithOAuth` (wrapper del broker de Lovable para Google/Apple/Microsoft) | Eliminar el archivo. Reemplazar todas las llamadas por `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: ... } })` |
| `package.json` → `@lovable.dev/cloud-auth-js` | Dependencia | `bun remove @lovable.dev/cloud-auth-js` |

**Callers de `lovable.auth.signInWithOAuth`** (verificar con `grep -rn "lovable.auth" src/`):
- `src/routes/auth.tsx`
- Botones Google en `src/routes/onboarding.tsx` (si aplica)

En el Supabase externo hay que **habilitar el proveedor Google** en Authentication → Providers y configurar Client ID/Secret propios (Google Cloud Console). Ver `07-cutover/cutover-checklist.md`.

## 3. Lovable AI Gateway (sustituir)

| Archivo | Uso | Sustituto |
|---|---|---|
| `src/lib/ai-gateway.server.ts` | Cliente para `https://ai.gateway.lovable.dev` usando `LOVABLE_API_KEY` para Gemini/GPT | Reescribir para hablar directamente con Gemini API (`GOOGLE_GENERATIVE_AI_API_KEY`) u OpenAI. Ver `migration/06-frontend-portable/ai-gateway.server.ts` |
| `src/routes/api/public/hooks/support-sla.ts` (líneas 183-186) | Llama a `https://email.lovable.dev/v1/messages` con `LOVABLE_API_KEY` para enviar email | Reemplazar por Resend (`RESEND_API_KEY`) o SMTP directo |
| `src/lib/verification.functions.ts` | Comentario menciona Lovable AI Gateway; usa `callAiGateway()` de arriba | Se resuelve al arreglar `ai-gateway.server.ts` |

## 4. Error reporting de Lovable (eliminar o adaptar)

| Archivo | Uso | Sustituto |
|---|---|---|
| `src/lib/lovable-error-reporting.ts` | Envía errores a `window.__lovableEvents.captureException` (inyectado por el runtime Lovable) | Reemplazar por Sentry (`@sentry/react`) o simplemente `console.error` + BD. En hosting externo el hook `__lovableEvents` no existe, es no-op y no rompe. |
| `src/routes/__root.tsx:13,46` | Llama a `reportLovableError` en el error boundary | Cambiar a `Sentry.captureException(error)` o dejar el archivo con no-op |

## 5. URLs hardcoded del preview Lovable

| Archivo | Línea | URL | Acción |
|---|---|---|---|
| `src/lib/bank-verification.functions.ts` | 115 | `https://secure-trust-mx.lovable.app` (fallback) | Cambiar default a URL de producción del nuevo hosting (Vercel/CF) o dejarlo tras `APP_URL` env var |
| `src/routes/api/public/hooks/support-sla.ts` | 162 | `https://secure-trust-mx.lovable.app/admin/support/...` | Idem, parametrizar con `APP_URL` |
| `src/routes/__root.tsx` | 105-106 | `og:image` en `pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/...lovable.app...` | Reemplazar por og:image alojada en Storage propio o en el hosting nuevo |

## 6. Variables de entorno con nombre Lovable

`.env` actual:
```
SUPABASE_PROJECT_ID=diqdpygummlrajsugotv
SUPABASE_PUBLISHABLE_KEY=eyJ...  # anon key del Cloud
SUPABASE_URL=https://diqdpygummlrajsugotv.supabase.co
VITE_SUPABASE_PROJECT_ID=diqdpygummlrajsugotv
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_SUPABASE_URL=https://diqdpygummlrajsugotv.supabase.co
```

En el hosting nuevo, reemplazar por (ver `06-frontend-portable/.env.template`):
```
VITE_SUPABASE_URL=<url del proyecto externo>
VITE_SUPABASE_ANON_KEY=<anon key del proyecto externo>
# server-only, no VITE_
SUPABASE_URL=<misma URL>
SUPABASE_SERVICE_ROLE_KEY=<service role del proyecto externo>
```

Nota: cambiar `SUPABASE_PUBLISHABLE_KEY` → `SUPABASE_ANON_KEY` y `VITE_SUPABASE_PUBLISHABLE_KEY` → `VITE_SUPABASE_ANON_KEY` requiere ajustar `client.ts` y `client.server.ts` (ya contemplado en las versiones portables).

## 7. `supabase/config.toml`

Actual:
```toml
project_id = "diqdpygummlrajsugotv"
```

En el nuevo proyecto:
```toml
project_id = "<nuevo project ref>"
```

## Resumen de eliminaciones

- **Archivos a borrar** en el corte final: `src/integrations/lovable/index.ts`, `src/lib/lovable-error-reporting.ts` (o convertir en shim vacío).
- **Paquetes npm a desinstalar**: `@lovable.dev/cloud-auth-js`.
- **Archivos a sobrescribir**: los 5 archivos auto-generados en `src/integrations/supabase/` (ver `06-frontend-portable/`).
- **Reemplazos de proveedor**: Lovable AI Gateway → Gemini/OpenAI directo; email de Lovable → Resend.
- **Variables**: renombrar `PUBLISHABLE_KEY` → `ANON_KEY` en frontend y backend.

Total de referencias a `lovable` en el código fuente: **~30 líneas** repartidas en **10 archivos**. Ninguna refactorización de lógica de negocio requerida — solo swap de infraestructura.
