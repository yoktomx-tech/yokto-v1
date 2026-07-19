// =============================================================================
// YOKTO — ai-gateway handler puro y testeable
// =============================================================================
// Extracción del handler de `index.ts` para permitir pruebas unitarias locales
// sin conexión a Supabase externo ni a proveedores reales de IA.
//
// El contrato externo (rutas, request/response JSON, secretos, statuses) NO
// cambia. `index.ts` sigue siendo el entrypoint; ahora sólo delega en
// `createHandler(deps)` con dependencias reales.
//
// Dependencias inyectables (todas mockeables en tests):
//   - env(name):       lectura de Deno.env
//   - fetchImpl:       fetch del proveedor de IA (mockeable)
//   - now():           timestamp actual (mockeable para latencia)
//   - randomId():      request_id (mockeable para snapshots)
//   - authClient:      cliente que dado un bearer devuelve { userId } o error
//   - dbClient:        cliente service-role abstracto (membership, counts, insert)
// =============================================================================

// ---------- Tipos públicos ----------

export type Provider = "google" | "openai";

export interface ModelSpec {
  provider: Provider;
  endpoint: (model: string) => string;
}

export const ALLOWED_MODELS: Record<string, ModelSpec> = {
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

export const DEFAULT_RATE_LIMIT_PER_MIN_PER_ORG = 60;
export const DEFAULT_RATE_LIMIT_PER_MIN_PER_USER = 20;

export interface AuthResult {
  userId: string | null;
  error?: "missing_bearer" | "invalid_session";
}

export interface DbClient {
  isActiveMember(userId: string, orgId: string): Promise<boolean>;
  countUsageSince(
    scope: { userId?: string; orgId?: string },
    sinceIso: string,
  ): Promise<number>;
  insertUsage(row: {
    request_id: string;
    user_id: string;
    org_id: string;
    provider: Provider;
    model: string;
    input_tokens: number;
    output_tokens: number;
    status: number;
    error: string | null;
    latency_ms: number;
  }): Promise<void>;
}

export interface HandlerDeps {
  env: (name: string) => string | undefined;
  fetchImpl: typeof fetch;
  now: () => number;
  randomId: () => string;
  auth: (bearer: string | null) => Promise<AuthResult>;
  db: DbClient;
  rateLimits?: { perOrg?: number; perUser?: number };
}

// ---------- Utils puros (exportados para tests) ----------

export function safeNum(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Aproximación conservadora: 1 token ≈ 4 chars UTF-8. */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function jsonResponse(
  status: number,
  body: unknown,
  extra: Record<string, string> = {},
): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers":
        "authorization, x-client-info, apikey, content-type, x-idempotency-key",
      ...extra,
    },
  });
}

// ---------- Handler factory ----------

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const perOrg = deps.rateLimits?.perOrg ?? DEFAULT_RATE_LIMIT_PER_MIN_PER_ORG;
  const perUser = deps.rateLimits?.perUser ?? DEFAULT_RATE_LIMIT_PER_MIN_PER_USER;

  return async (req: Request): Promise<Response> => {
    const rid = deps.randomId();

    if (req.method === "OPTIONS") return jsonResponse(204, null);
    if (req.method !== "POST") {
      return jsonResponse(405, { error: "method_not_allowed", request_id: rid });
    }

    const provider = deps.env("AI_PROVIDER");
    const providerKey = deps.env("AI_PROVIDER_API_KEY");
    const defaultModel = deps.env("AI_DEFAULT_MODEL");
    const maxIn = safeNum(deps.env("AI_MAX_INPUT_TOKENS"), 8000);
    const maxOut = safeNum(deps.env("AI_MAX_OUTPUT_TOKENS"), 2000);
    const timeoutMs = safeNum(deps.env("AI_REQUEST_TIMEOUT_MS"), 30000);

    if (!provider || !providerKey || !defaultModel) {
      return jsonResponse(500, { error: "server_misconfigured", request_id: rid });
    }

    // --- Auth ---
    const bearer = req.headers.get("authorization");
    const authRes = await deps.auth(bearer);
    if (authRes.error || !authRes.userId) {
      const err = authRes.error ?? "invalid_session";
      return jsonResponse(err === "missing_bearer" ? 401 : 401, {
        error: err,
        request_id: rid,
      });
    }
    const userId = authRes.userId;

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
      return jsonResponse(400, { error: "invalid_json", request_id: rid });
    }

    const orgId = body.org_id;
    const model = body.model ?? defaultModel;
    const messages = body.messages ?? [];
    const wantJson = body.json === true;

    if (!orgId || typeof orgId !== "string") {
      return jsonResponse(400, { error: "org_id_required", request_id: rid });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse(400, { error: "messages_required", request_id: rid });
    }
    const modelSpec = ALLOWED_MODELS[model];
    if (!modelSpec) {
      return jsonResponse(400, { error: "model_not_allowed", request_id: rid });
    }
    if (modelSpec.provider !== provider) {
      return jsonResponse(400, { error: "provider_mismatch", request_id: rid });
    }

    // --- Membership ---
    const active = await deps.db.isActiveMember(userId, orgId);
    if (!active) {
      return jsonResponse(403, { error: "not_a_member", request_id: rid });
    }

    // --- Input size ---
    const inputText = messages.map((m) => m.content ?? "").join("\n");
    const inputTokens = approxTokens(inputText);
    if (inputTokens > maxIn) {
      return jsonResponse(413, {
        error: "input_too_large",
        input_tokens: inputTokens,
        max: maxIn,
        request_id: rid,
      });
    }
    const requestedOut = Math.min(body.max_output_tokens ?? maxOut, maxOut);

    // --- Rate limits ---
    const sinceIso = new Date(deps.now() - 60_000).toISOString();
    const orgCount = await deps.db.countUsageSince({ orgId }, sinceIso);
    if (orgCount >= perOrg) {
      return jsonResponse(429, { error: "rate_limited_org", request_id: rid });
    }
    const userCount = await deps.db.countUsageSince({ userId }, sinceIso);
    if (userCount >= perUser) {
      return jsonResponse(429, { error: "rate_limited_user", request_id: rid });
    }

    // --- Provider call (with timeout) ---
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const started = deps.now();

    let status = 0;
    let outputTokens = 0;
    let providerError: string | null = null;
    let content = "";

    try {
      if (modelSpec.provider === "google") {
        const url = `${modelSpec.endpoint(model)}?key=${encodeURIComponent(providerKey)}`;
        const res = await deps.fetchImpl(url, {
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
        const j = await res.json().catch(() => ({} as Record<string, unknown>));
        // deno-lint-ignore no-explicit-any
        content = (j as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        outputTokens = approxTokens(content);
        // deno-lint-ignore no-explicit-any
        if (!res.ok) providerError = (j as any)?.error?.message ?? "provider_error";
      } else {
        const res = await deps.fetchImpl(modelSpec.endpoint(model), {
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
        const j = await res.json().catch(() => ({} as Record<string, unknown>));
        // deno-lint-ignore no-explicit-any
        content = (j as any)?.choices?.[0]?.message?.content ?? "";
        outputTokens =
          // deno-lint-ignore no-explicit-any
          (j as any)?.usage?.completion_tokens ?? approxTokens(content);
        // deno-lint-ignore no-explicit-any
        if (!res.ok) providerError = (j as any)?.error?.message ?? "provider_error";
      }
    } catch (e) {
      providerError = (e as Error).name === "AbortError" ? "timeout" : "provider_exception";
      status = 504;
    } finally {
      clearTimeout(t);
    }

    const latencyMs = Math.max(0, deps.now() - started);

    // --- Audit (metadata-only) ---
    await deps.db.insertUsage({
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
      const httpStatus =
        status === 504 ? 504 : status >= 400 && status < 600 ? status : 502;
      return jsonResponse(httpStatus, { error: providerError, request_id: rid });
    }

    return jsonResponse(200, {
      request_id: rid,
      model,
      content,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      latency_ms: latencyMs,
    });
  };
}
