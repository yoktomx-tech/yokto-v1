// Helper server-only para bitacorar todas las consultas externas del onboarding.
// Registra proveedor, endpoint, tipo de cuenta, estado (success/failed/incomplete),
// código HTTP, resumen de la petición/respuesta y duración.

import { getRequestHeader } from "@tanstack/react-start/server";

type Provider = "nubarium" | "copomex" | "renapo" | "sat" | "hibp" | "internal";
type Status = "success" | "failed" | "incomplete";
type AccountType = "persona_fisica" | "persona_moral" | null | undefined;

export type OnboardingLogInput = {
  user_id?: string | null;
  provider: Provider;
  endpoint: string;
  account_type?: AccountType;
  step?: string | null;
  status: Status;
  http_status?: number | null;
  duration_ms?: number | null;
  request_summary?: Record<string, unknown> | null;
  response_summary?: Record<string, unknown> | null;
  error_message?: string | null;
};

// Redacta secretos comunes en resúmenes.
function redact<T>(input: T): T {
  if (!input || typeof input !== "object") return input;
  const clone: Record<string, unknown> = Array.isArray(input) ? [...(input as unknown[])] as never : { ...(input as Record<string, unknown>) };
  const sensitive = ["password","pass","token","authorization","auth","secret","key","file_base64","cer_base64","documento","key_base64"];
  for (const k of Object.keys(clone)) {
    if (sensitive.some((s) => k.toLowerCase().includes(s))) {
      clone[k] = "[REDACTED]";
    } else if (typeof clone[k] === "string" && (clone[k] as string).length > 500) {
      clone[k] = `[STR:${(clone[k] as string).length}b]`;
    } else if (typeof clone[k] === "object" && clone[k] !== null) {
      clone[k] = redact(clone[k]);
    }
  }
  return clone as T;
}

export async function logOnboardingApi(input: OnboardingLogInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      ip = getRequestHeader("x-forwarded-for") ?? getRequestHeader("cf-connecting-ip") ?? null;
      ua = getRequestHeader("user-agent") ?? null;
    } catch { /* fuera de contexto de request */ }
    await supabaseAdmin.from("onboarding_api_logs").insert({
      user_id: input.user_id ?? null,
      provider: input.provider,
      endpoint: input.endpoint,
      account_type: input.account_type ?? null,
      step: input.step ?? null,
      status: input.status,
      http_status: input.http_status ?? null,
      duration_ms: input.duration_ms ?? null,
      request_summary: input.request_summary ? (redact(input.request_summary) as never) : null,
      response_summary: input.response_summary ? (redact(input.response_summary) as never) : null,
      error_message: input.error_message ?? null,
      ip_address: ip,
      user_agent: ua,
    });
  } catch { /* best-effort, nunca romper el flujo */ }
}
