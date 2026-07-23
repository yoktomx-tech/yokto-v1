// Módulo I — Verificación IA de cumplimiento.
// Sube evidencia y ejecuta análisis con Gemini o GPT (Lovable AI Gateway).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiJsonCall, AI_MODELS, type AiProvider, type AiMessagePart } from "./ai-gateway.server";

const AnalyzeInput = z.object({
  evidenceId: z.string().uuid(),
  provider: z.enum(["gemini", "openai"]).default("gemini"),
});

interface Verdict {
  verdict: "approve" | "review" | "reject";
  score: number;
  summary: string;
  concerns?: string[];
  positives?: string[];
}

export const analyzeEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AnalyzeInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ev, error: evErr } = await supabase
      .from("verification_evidence")
      .select("id, transaction_id, file_path, file_name, mime_type, note")
      .eq("id", data.evidenceId)
      .single();
    if (evErr || !ev) throw new Error("Evidencia no encontrada");

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, buyer_id, seller_id, title, description, amount_cents, currency, sector")
      .eq("id", ev.transaction_id)
      .single();
    if (txErr || !tx) throw new Error("Transacción no encontrada");
    if (tx.buyer_id !== userId && tx.seller_id !== userId) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!isAdmin) throw new Error("Sin acceso");
    }

    const { data: conds } = await supabase
      .from("transaction_conditions")
      .select("description, status")
      .eq("transaction_id", ev.transaction_id)
      .order("position");

    // URL firmada 10 min para que la IA pueda leer imagen/PDF
    const { data: signed } = await supabase.storage
      .from("verification-evidence")
      .createSignedUrl(ev.file_path, 600);

    const isImage = (ev.mime_type ?? "").startsWith("image/");
    const provider = data.provider;
    const model = AI_MODELS[provider as AiProvider];

    const system =
      "Eres un verificador de cumplimiento de escrow (CUMPLEX México). Analiza si la evidencia entregada por el vendedor demuestra que se cumplieron las condiciones pactadas. " +
      "Responde SOLO en JSON con este esquema exacto: " +
      '{ "verdict": "approve"|"review"|"reject", "score": 0-100, "summary": string (máx 400 chars, en español), "concerns": string[], "positives": string[] }. ' +
      "Sé estricto: 'approve' solo si la evidencia es clara e inequívoca. 'reject' si hay indicios de fraude, inconsistencia o incumplimiento. 'review' cuando falte información.";

    const context_txt =
      `TRANSACCIÓN\n` +
      `Título: ${tx.title}\n` +
      `Sector: ${tx.sector ?? "n/d"}\n` +
      `Monto: ${(tx.amount_cents / 100).toFixed(2)} ${tx.currency}\n` +
      `Descripción: ${tx.description ?? "n/d"}\n\n` +
      `CONDICIONES PACTADAS:\n` +
      ((conds ?? []).map((c, i) => `${i + 1}. [${c.status}] ${c.description}`).join("\n") || "(sin condiciones)") +
      `\n\nEVIDENCIA\nArchivo: ${ev.file_name} (${ev.mime_type ?? "?"})\n` +
      `Nota del vendedor: ${ev.note ?? "(sin nota)"}\n`;

    const userParts: AiMessagePart[] = [{ type: "text", text: context_txt }];
    if (isImage && signed?.signedUrl) {
      userParts.push({ type: "image_url", image_url: { url: signed.signedUrl } });
    } else if (signed?.signedUrl) {
      userParts.push({ type: "text", text: `\nEnlace al documento (no puedes descargarlo, considera solo el nombre y nota): ${ev.file_name}` });
    }

    const result = await aiJsonCall<Verdict>({
      provider: provider as AiProvider,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userParts },
      ],
    });

    const verdict = ["approve", "review", "reject"].includes(result.verdict) ? result.verdict : "review";
    const score = Math.max(0, Math.min(100, Math.round(Number(result.score) || 0)));

    // Persistir (bypass RLS: parte de la transacción puede escribir su propia evidencia,
    // pero el análisis vive en el registro que ya existe → usar admin client dentro del handler)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updErr } = await supabaseAdmin
      .from("verification_evidence")
      .update({
        ai_provider: provider,
        ai_model: model,
        ai_verdict: verdict,
        ai_score: score,
        ai_summary: result.summary?.slice(0, 500) ?? null,
        ai_raw: JSON.parse(JSON.stringify(result)),
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", ev.id);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("transaction_events").insert({
      transaction_id: ev.transaction_id,
      actor_id: userId,
      event_type: "ai_verification",
      metadata: { evidence_id: ev.id, provider, model, verdict, score },
    });

    return { verdict, score, summary: result.summary, provider, model };
  });
