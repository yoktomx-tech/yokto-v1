# Inventario de secretos y variables de entorno

**Nunca se exponen valores** — solo nombres. Los valores debes copiarlos manualmente desde Lovable Cloud (Secrets) al proyecto Supabase externo (Project Settings → Edge Functions → Secrets) o al gestor de secretos del host del frontend (Vercel/Cloudflare env vars).

## Secretos de plataforma (auto-gestionados)

Estos existen en el runtime del Cloud actual y **deben recrearse en el Supabase externo con los valores del nuevo proyecto** (no copiar los del Cloud):

| Nombre | Origen del valor nuevo | Uso |
|---|---|---|
| `SUPABASE_URL` | Supabase externo → Project Settings → API | Server functions (TanStack) + Edge Functions |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase externo → Project Settings → API (anon key) | Server functions (cliente publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase externo → Project Settings → API (service_role) | Solo Edge Functions y server-side privileged (`supabaseAdmin`). **Jamás en frontend.** |
| `SUPABASE_DB_URL` | Supabase externo → Connect → Session pooler URI | Scripts admin/CI, no runtime |
| `SUPABASE_PROJECT_ID` | Supabase externo (ref del proyecto) | CLI, scripts |

Frontend (Vite build vars, expuestas al browser — es seguro, son publishable):

| Nombre | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Igual que `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | Ref |

## Secretos de integraciones (copiar valores actuales)

Estos secretos son **de proveedores externos** (Nubarium, Verificamex, Copomex, Stripe, Lovable AI). Los valores actuales sirven en el Supabase externo — solo hay que recrear los secretos con el mismo nombre y valor.

| Nombre | Proveedor | Usado por |
|---|---|---|
| `NUBARIUM_USER` | Nubarium | Validación CURP/RFC/e.firma (onboarding.functions) |
| `NUBARIUM_PASSWORD` | Nubarium | Idem |
| `VERIFICAMEX_API_KEY` | Verificamex | Penny-test bancario |
| `VERIFICAMEX_WEBHOOK_TOKEN` | Verificamex | Verificar firma del webhook |
| `COPOMEX_TOKEN` | Copomex | Autocomplete de códigos postales |
| `BANK_ACCOUNT_HASH_SECRET` | Interno (aleatorio) | Hash HMAC de números de cuenta bancaria en BD |
| `LOVABLE_API_KEY` | Lovable AI Gateway | Llamadas a Gemini/GPT (fiscal parsing, PLD) |

## Secretos a añadir para el nuevo backend (aún no configurados)

Requeridos por rutas actuales o por futuras Edge Functions:

| Nombre | Cuándo | Notas |
|---|---|---|
| `STRIPE_SECRET_KEY` | Cuando Stripe Connect esté activo en el nuevo entorno | `sk_live_...` / `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Al configurar el endpoint webhook nuevo | `whsec_...` — nuevo por proyecto |
| `STRIPE_CONNECT_CLIENT_ID` | Onboarding de sellers | `ca_...` |
| `SUPPORT_SLA_CRON_SECRET` | Para autenticar el cron externo | Generar con `openssl rand -hex 32` |
| `DISPUTE_DEADLINES_CRON_SECRET` | Idem | Idem |
| `RESEND_API_KEY` (o SMTP) | Envío de emails transaccionales (SLA, escalados) | Recomendado: Resend |

## Reemplazo de `LOVABLE_API_KEY`

Al salir de Lovable, el `LOVABLE_API_KEY` deja de funcionar (es el gateway de Lovable AI). Alternativas:

- **Google Gemini directo**: `GOOGLE_GENERATIVE_AI_API_KEY` — cambiar `src/lib/ai-gateway.server.ts` para usar `@google/generative-ai`.
- **OpenAI directo**: `OPENAI_API_KEY`.
- Mantener wrapper compatible en `ai-gateway.server.ts` para no tocar los consumidores (fiscal parser, PLD engine).

## Reglas obligatorias

- `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_DB_URL` **nunca** en frontend, `.env.*`, ni git.
- Frontend solo lee `VITE_*` — todo lo demás es server-side.
- Rotar todos los secretos de proveedores externos que se hayan expuesto durante la migración.
- Separar por entorno: prod / staging / dev tienen proyectos Supabase independientes y secretos independientes.
