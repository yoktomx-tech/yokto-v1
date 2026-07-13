// Cliente ligero para Lovable AI Gateway (Gemini / GPT).
// Uso desde createServerFn — nunca importar en el bundle cliente.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AiProvider = "gemini" | "openai";

export const AI_MODELS: Record<AiProvider, string> = {
  gemini: "google/gemini-3-flash-preview",
  openai: "openai/gpt-5-mini",
};

export interface AiMessagePart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string | AiMessagePart[];
}

export interface AiJsonCallOpts {
  provider?: AiProvider;
  model?: string;
  messages: AiMessage[];
  temperature?: number;
}

export async function aiJsonCall<T = unknown>(opts: AiJsonCallOpts): Promise<T> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY no configurada");
  const provider = opts.provider ?? "gemini";
  const model = opts.model ?? AI_MODELS[provider];

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      response_format: { type: "json_object" },
      temperature: opts.temperature ?? 0.2,
    }),
  });

  if (res.status === 429) throw new Error("Límite de uso IA alcanzado. Intenta de nuevo en unos minutos.");
  if (res.status === 402) throw new Error("Créditos IA agotados en el workspace.");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI Gateway ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("Respuesta IA vacía");
  try {
    return JSON.parse(raw) as T;
  } catch {
    // fallback: extraer primer bloque {...}
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("La IA no devolvió JSON válido");
    return JSON.parse(m[0]) as T;
  }
}
