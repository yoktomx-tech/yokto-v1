# ai-gateway — Edge Function portable

Reemplazo definitivo de `src/lib/ai-gateway.server.ts`. Resuelve el blocker
**B-01** eliminando toda dependencia de `LOVABLE_API_KEY` y de
`https://ai.gateway.lovable.dev`.

## Estado

- Diseño: **A — Lista para Supabase Edge Functions externo** (portable).
- Pruebas: **NOT TESTED** — se desplegará y probará durante la ejecución
  externa del runbook por el operador.
- No incluye claves reales; todos los secretos se leen desde Edge Function
  Secrets.

## Contrato

- `verify_jwt = true`.
- Requiere `Authorization: Bearer <access_token>` del usuario.
- Body:
  ```json
  {
    "org_id": "uuid",
    "model": "google/gemini-1.5-flash",
    "messages": [{ "role": "user", "content": "..." }],
    "max_output_tokens": 1024,
    "temperature": 0.2,
    "json": false
  }
  ```
- Respuesta:
  ```json
  {
    "request_id": "uuid",
    "model": "google/gemini-1.5-flash",
    "content": "...",
    "input_tokens": 123,
    "output_tokens": 456,
    "latency_ms": 789
  }
  ```

## Controles implementados

| Control | Cómo |
| --- | --- |
| Autenticación | `supabase.auth.getUser(userToken)` |
| Autorización | `memberships.user_id + org_id + status = active` |
| Rate limit | Contadores por `(org_id, min)` y `(user_id, min)` en `ai_gateway_usage` |
| Modelos | Lista blanca cerrada `ALLOWED_MODELS` |
| Anti-SSRF | Endpoint derivado del modelo, nunca del cliente |
| Timeout | `AbortController` con `AI_REQUEST_TIMEOUT_MS` |
| Tamaño de entrada | `AI_MAX_INPUT_TOKENS` |
| Tamaño de salida | `AI_MAX_OUTPUT_TOKENS` |
| Auditoría | Insert en `ai_gateway_usage` sólo metadatos (sin prompt ni contenido) |
| Error handling | `request_id` en toda respuesta; mapeo de status HTTP |

## Secretos requeridos (Edge Function Secrets)

Nombres genéricos, sin valores reales:

- `AI_PROVIDER`
- `AI_PROVIDER_API_KEY`
- `AI_DEFAULT_MODEL`
- `AI_MAX_INPUT_TOKENS`
- `AI_MAX_OUTPUT_TOKENS`
- `AI_REQUEST_TIMEOUT_MS`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (auto-inyectados)

## Tabla de auditoría necesaria

Antes de desplegar la función el operador debe aplicar en staging:

```sql
CREATE TABLE IF NOT EXISTS public.ai_gateway_usage (
  id            BIGSERIAL PRIMARY KEY,
  request_id    UUID NOT NULL,
  user_id       UUID NOT NULL,
  org_id        UUID NOT NULL,
  provider      TEXT NOT NULL,
  model         TEXT NOT NULL,
  input_tokens  INT  NOT NULL DEFAULT 0,
  output_tokens INT  NOT NULL DEFAULT 0,
  status        INT  NOT NULL DEFAULT 0,
  error         TEXT,
  latency_ms    INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT, SELECT ON public.ai_gateway_usage TO service_role;
GRANT SELECT ON public.ai_gateway_usage TO authenticated;
ALTER TABLE public.ai_gateway_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage read own org" ON public.ai_gateway_usage
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));
CREATE INDEX IF NOT EXISTS ai_gateway_usage_org_time_idx
  ON public.ai_gateway_usage (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_gateway_usage_user_time_idx
  ON public.ai_gateway_usage (user_id, created_at DESC);
```

## Prohibiciones

- No leer `LOVABLE_API_KEY`.
- No llamar a `ai.gateway.lovable.dev`.
- No aceptar endpoints externos desde el body.
- No registrar `messages`, documentos, ni datos personales/financieros en la tabla de auditoría.
- No desplegar en el proyecto Cloud actual (`diqdpygummlrajsugotv`).
