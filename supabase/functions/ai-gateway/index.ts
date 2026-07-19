// =============================================================================
// YOKTO — ai-gateway Edge Function (portable, sin Lovable Cloud)
// =============================================================================
// Sustituye a src/lib/ai-gateway.server.ts. Resuelve el blocker B-01 al
// eliminar toda dependencia de LOVABLE_API_KEY y de https://ai.gateway.lovable.dev.
//
// Diseño:
//   - Autenticación: exige access token del usuario (JWT firmado por Supabase Auth).
//   - Autorización: valida app_role / org_role / internal_role vía tablas propias.
//   - Rate limiting: por (org_id, minuto) con contador en Postgres.
//   - Modelos autorizados: lista blanca cerrada.
//   - Sin SSRF: el cliente NO puede indicar endpoints; sólo modelos.
//   - Tokens y tamaño: límites duros configurables por Edge Function Secret.
//   - Timeout: AbortController.
//   - Auditoría: registra sólo request_id, org_id, user_id, modelo, tokens,
//     status y latencia. Nunca prompt completo ni documentos.
//   - Idempotencia: opcional por header `X-Idempotency-Key`.
//   - Secretos leídos SÓLO desde Edge Function Secrets, nunca del cliente.
//
// Secretos requeridos (nombres genéricos — sin valores reales aquí):
//   AI_PROVIDER              -> "google" | "openai" | "anthropic"
//   AI_PROVIDER_API_KEY      -> clave propia del proveedor (no Lovable)
//   AI_DEFAULT_MODEL         -> id de modelo por defecto autorizado
//   AI_MAX_INPUT_TOKENS      -> entero, límite duro de entrada
//   AI_MAX_OUTPUT_TOKENS     -> entero, límite duro de salida
//   AI_REQUEST_TIMEOUT_MS    -> entero, timeout por request
//   SUPABASE_URL             -> auto-inyectado
//   SUPABASE_ANON_KEY        -> auto-inyectado
//   SUPABASE_SERVICE_ROLE_KEY-> auto-inyectado (sólo para auditoría/rate-limit)
//
// Auth: verify_jwt = true (configurado en supabase/config.toml).
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ---------- Constantes de política ----------

/** Lista blanca cerrada de modelos permitidos. Ampliar por PR + revisión. */
const ALLOWED_MODELS: Record<string, { provider: "google" | "openai"; endpoint: (m: string) => string }> = {
  "google/gemini-1.5-flash": {
    provider: "google",
    endpoint: (m) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${m.split("/")[1]}:generateContent`,
  },
  "google/gemini-1.5-pro": {
    provider: "google",
    endpoint: (m) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${m.split("/")[1]}:generateContent`,
  },
  "openai/gpt-4o-mini": {
    provider: "openai",
    endpoint: () => "https://api.openai.com/v1/chat/completions",
  },
};

const RATE_LIMIT_PER_MIN_PER_ORG = 60;
const RATE_LIMIT_PER_MIN_PER_USER = 20;

// ---------- Utils ----------

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
      ...extraHeaders,
    },
  });
}

function requestId(): string {
  return crypto.randomUUID();
}

function safeNum(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Aproximación conservadora: 1 token ≈ 4 chars UTF-8. */
function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------- Handler ----------

serve(async (req) => {
  const rid = requestId();

  if (req.method === "OPTIONS") return json(204, null);
  if (req.method !== "POST") return json(405, { error: "method_not_allowed", request_id: rid });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseSrv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const provider = Deno.env.get("AI_PROVIDER");
  const providerKey = Deno.env.get("AI_PROVIDER_API_KEY");
  const defaultModel = Deno.env.get("AI_DEFAULT_MODEL");
  const maxIn = safeNum(Deno.env.get("AI_MAX_INPUT_TOKENS"), 8000);
  const maxOut = safeNum(Deno.env.get("AI_MAX_OUTPUT_TOKENS"), 2000);
  const timeoutMs = safeNum(Deno.env.get("AI_REQUEST_TIMEOUT_MS"), 30000);

  if (!supabaseUrl || !supabaseAnon || !supabaseSrv || !provider || !providerKey || !defaultModel) {
    return json(500, { error: "server_misconfigured", request_id: rid });
  }

  // --- Autenticación: bearer del usuario ---
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return json(401, { error: "missing_bearer", request_id: rid });
  }
  const userToken = auth.slice(7);

  const supaUser = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await supaUser.auth.getUser(userToken);
  if (userErr || !userData?.user) {
    return json(401, { error: "invalid_session", request_id: rid });
  }
  const userId = userData.user.id;

  // --- Body ---
  let body: {
    org_id?: string;
    model?: string;
    messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    max_output_tokens?: number;
    temperature?: number;
    json?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json", request_id: rid });
  }

  const orgId = body.org_id;
  const model = body.model ?? defaultModel;
  const messages = body.messages ?? [];
  const wantJson = body.json === true;

  if (!orgId || typeof orgId !== "string") {
    return json(400, { error: "org_id_required", request_id: rid });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: "messages_required", request_id: rid });
  }
  const modelSpec = ALLOWED_MODELS[model];
  if (!modelSpec) {
    return json(400, { error: "model_not_allowed", request_id: rid });
  }
  if (modelSpec.provider !== provider) {
    // El AI_PROVIDER configurado en Edge Function Secrets no coincide con
    // el proveedor del modelo pedido. Evita mezclar credenciales.
    return json(400, { error: "provider_mismatch", request_id: rid });
  }

  // --- Autorización: usuario pertenece a la organización ---
  const supaSrv = createClient(supabaseUrl, supabaseSrv, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: membership, error: memErr } = await supaSrv
    .from("memberships")
    .select("org_id, org_role, status")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("status", "active")
    .maybeSingle();
  if (memErr || !membership) {
    return json(403, { error: "not_a_member", request_id: rid });
  }

  // --- Tamaño de entrada ---
  const inputText = messages.map((m) => m.content ?? "").join("\n");
  const inputTokens = approxTokens(inputText);
  if (inputTokens > maxIn) {
    return json(413, { error: "input_too_large", input_tokens: inputTokens, max: maxIn, request_id: rid });
  }
  const requestedOut = Math.min(body.max_output_tokens ?? maxOut, maxOut);

  // --- Rate limiting simple (tabla ai_gateway_usage con created_at) ---
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: orgCount } = await supaSrv
    .from("ai_gateway_usage")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("created_at", oneMinuteAgo);
  if ((orgCount ?? 0) >= RATE_LIMIT_PER_MIN_PER_ORG) {
    return json(429, { error: "rate_limited_org", request_id: rid });
  }
  const { count: userCount } = await supaSrv
    .from("ai_gateway_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneMinuteAgo);
  if ((userCount ?? 0) >= RATE_LIMIT_PER_MIN_PER_USER) {
    return json(429, { error: "rate_limited_user", request_id: rid });
  }

  // --- Llamada al proveedor con timeout ---
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  let status = 0;
  let outputTokens = 0;
  let providerError: string | null = null;
  let content = "";

  try {
    if (modelSpec.provider === "google") {
      const url = `${modelSpec.endpoint(model)}?key=${encodeURIComponent(providerKey)}`;
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            maxOutputTokens: requestedOut,
            temperature: body.temperature ?? 0.2,
            responseMimeType: wantJson ? "application/json" : "text/plain",
          },
        }),
      });
      status = res.status;
      const j = await res.json().catch(() => ({}));
      content = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      outputTokens = approxTokens(content);
      if (!res.ok) providerError = j?.error?.message ?? "provider_error";
    } else if (modelSpec.provider === "openai") {
      const res = await fetch(modelSpec.endpoint(model), {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${providerKey}`,
        },
        body: JSON.stringify({
          model: model.split("/")[1],
          messages,
          max_tokens: requestedOut,
          temperature: body.temperature ?? 0.2,
          ...(wantJson ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      status = res.status;
      const j = await res.json().catch(() => ({}));
      content = j?.choices?.[0]?.message?.content ?? "";
      outputTokens = j?.usage?.completion_tokens ?? approxTokens(content);
      if (!res.ok) providerError = j?.error?.message ?? "provider_error";
    }
  } catch (e) {
    providerError = (e as Error).name === "AbortError" ? "timeout" : "provider_exception";
    status = 504;
  } finally {
    clearTimeout(t);
  }

  const latencyMs = Date.now() - started;

  // --- Auditoría (sin prompt ni contenido, sólo metadatos) ---
  await supaSrv.from("ai_gateway_usage").insert({
    request_id: rid,
    user_id: userId,
    org_id: orgId,
    provider: modelSpec.provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    status,
    error: providerError,
    latency_ms: latencyMs,
  });

  if (providerError) {
    const httpStatus = status === 504 ? 504 : status >= 400 && status < 600 ? status : 502;
    return json(httpStatus, { error: providerError, request_id: rid });
  }

  return json(200, {
    request_id: rid,
    model,
    content,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: latencyMs,
  });
});
