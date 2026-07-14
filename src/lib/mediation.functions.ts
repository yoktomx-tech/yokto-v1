// Panel de mediación / resolución (Fase 3 — Disputas)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiJsonCall } from "@/lib/ai-gateway.server";

const uuid = z.string().uuid();

async function assertMediator(context: { supabase: unknown; userId: string }) {
  const sb = context.supabase as {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" | "mediator" },
    ) => PromiseLike<{ data: boolean | null; error: { message: string } | null }>;
  };
  const [{ data: isAdmin }, { data: isMediator }] = await Promise.all([
    sb.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    sb.rpc("has_role", { _user_id: context.userId, _role: "mediator" }),
  ]);
  if (!isAdmin && !isMediator) throw new Error("Solo mediadores o administradores");
  return { isAdmin: !!isAdmin, isMediator: !!isMediator };
}

export const isCurrentUserMediator = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: isAdmin }, { data: isMediator }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "mediator" }),
    ]);
    return { allowed: !!isAdmin || !!isMediator, isAdmin: !!isAdmin, isMediator: !!isMediator };
  });

// ---------- LIST ----------
export const listMediatorDisputes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d?: { status?: string; assignedToMe?: boolean }) =>
      z
        .object({
          status: z.string().optional(),
          assignedToMe: z.boolean().optional(),
        })
        .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertMediator(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("disputes")
      .select(
        "id, numero, status, reason_code, reason_description, amount_disputed_cents, deposit_cents, opened_by, opened_role, mediator_id, activated_at, counterparty_response_due_at, evidence_due_at, resolution_due_at, created_at, transaction_id, transactions:transaction_id(numero, title, amount_cents, currency, buyer_id, seller_id)",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.assignedToMe) q = q.eq("mediator_id", context.userId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- DETAIL (admin view) ----------
export const getDisputeAdminView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { disputeId: string }) => z.object({ disputeId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMediator(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: dispute }, { data: messages }, { data: evidence }, { data: events }] =
      await Promise.all([
        supabaseAdmin
          .from("disputes")
          .select(
            "*, transactions:transaction_id(id, numero, title, amount_cents, currency, buyer_id, seller_id, status, sector)",
          )
          .eq("id", data.disputeId)
          .maybeSingle(),
        supabaseAdmin
          .from("dispute_messages")
          .select("*")
          .eq("dispute_id", data.disputeId)
          .order("created_at", { ascending: true }),
        supabaseAdmin
          .from("dispute_evidence")
          .select("*")
          .eq("dispute_id", data.disputeId)
          .order("created_at", { ascending: true }),
        supabaseAdmin
          .from("transaction_events")
          .select("id, event_type, actor_id, metadata, created_at")
          .eq(
            "transaction_id",
            (
              await supabaseAdmin
                .from("disputes")
                .select("transaction_id")
                .eq("id", data.disputeId)
                .maybeSingle()
            ).data?.transaction_id ?? "00000000-0000-0000-0000-000000000000",
          )
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

    if (!dispute) throw new Error("Disputa no encontrada");

    const uids = new Set<string>();
    (dispute as { opened_by?: string; mediator_id?: string }).opened_by &&
      uids.add((dispute as { opened_by: string }).opened_by);
    (dispute as { mediator_id?: string }).mediator_id &&
      uids.add((dispute as { mediator_id: string }).mediator_id);
    const tx = (dispute as { transactions: { buyer_id: string; seller_id: string | null } }).transactions;
    if (tx?.buyer_id) uids.add(tx.buyer_id);
    if (tx?.seller_id) uids.add(tx.seller_id);
    (messages ?? []).forEach((m) => m.author_id && uids.add(m.author_id));

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", Array.from(uids));

    return {
      dispute,
      messages: messages ?? [],
      evidence: evidence ?? [],
      events: events ?? [],
      profiles: profiles ?? [],
    };
  });

// ---------- ASSIGN mediator ----------
export const assignMediator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { disputeId: string; mediatorId?: string | null }) =>
    z.object({ disputeId: uuid, mediatorId: uuid.nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMediator(context);
    const target = data.mediatorId === undefined ? context.userId : data.mediatorId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select("id, transaction_id, status, numero")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!dispute) throw new Error("Disputa no encontrada");

    const newStatus =
      dispute.status === "awaiting_response" || dispute.status === "open"
        ? "in_review"
        : dispute.status;

    await supabaseAdmin
      .from("disputes")
      .update({ mediator_id: target, status: newStatus })
      .eq("id", data.disputeId);

    await supabaseAdmin.from("dispute_messages").insert({
      dispute_id: data.disputeId,
      author_id: context.userId,
      author_role: "system",
      message_type: "system",
      body: target
        ? `👤 Mediador asignado a la disputa ${dispute.numero}.`
        : `👤 Mediador removido de la disputa ${dispute.numero}.`,
      visible_to: "all",
    });

    await supabaseAdmin.from("transaction_events").insert({
      transaction_id: dispute.transaction_id,
      actor_id: context.userId,
      event_type: "dispute.mediator_assigned",
      metadata: { dispute_id: data.disputeId, mediator_id: target } as never,
    });

    return { ok: true };
  });

// ---------- STATUS transitions (in_review / in_mediation / escalated) ----------
export const setDisputeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      disputeId: string;
      status: "in_review" | "in_mediation" | "escalated";
      note?: string;
      arbitrationEntity?: string;
      arbitrationCaseNumber?: string;
    }) =>
      z
        .object({
          disputeId: uuid,
          status: z.enum(["in_review", "in_mediation", "escalated"]),
          note: z.string().max(2000).optional(),
          arbitrationEntity: z.string().max(200).optional(),
          arbitrationCaseNumber: z.string().max(120).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMediator(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select("id, transaction_id, numero")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!dispute) throw new Error("Disputa no encontrada");

    const patch: {
      status: "in_review" | "in_mediation" | "escalated";
      arbitration_entity?: string;
      arbitration_case_number?: string;
    } = { status: data.status };
    if (data.status === "escalated") {
      if (data.arbitrationEntity) patch.arbitration_entity = data.arbitrationEntity;
      if (data.arbitrationCaseNumber) patch.arbitration_case_number = data.arbitrationCaseNumber;
    }
    await supabaseAdmin.from("disputes").update(patch).eq("id", data.disputeId);

    const label =
      data.status === "in_review"
        ? "🔎 Disputa en revisión por mediador."
        : data.status === "in_mediation"
        ? "🤝 Mediación activa iniciada."
        : "⚖️ Disputa escalada a arbitraje externo.";

    await supabaseAdmin.from("dispute_messages").insert({
      dispute_id: data.disputeId,
      author_id: context.userId,
      author_role: "system",
      message_type: "system",
      body: data.note ? `${label} ${data.note}` : label,
      visible_to: "all",
    });

    await supabaseAdmin.from("transaction_events").insert({
      transaction_id: dispute.transaction_id,
      actor_id: context.userId,
      event_type: `dispute.${data.status}`,
      metadata: { dispute_id: data.disputeId, note: data.note ?? null } as never,
    });

    return { ok: true };
  });

// ---------- AI SUMMARY ----------
type AiVerdict = "buyer_favor" | "seller_favor" | "split" | "no_resolution";
interface AiSummaryResult {
  resumen: string;
  puntos_clave_comprador: string[];
  puntos_clave_vendedor: string[];
  evidencias_faltantes: string[];
  riesgos: string[];
  recomendacion: AiVerdict;
  reparto_sugerido: { comprador_pct: number; vendedor_pct: number };
  confianza: number;
}

export const generateDisputeAiSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { disputeId: string }) => z.object({ disputeId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMediator(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select(
        "id, numero, reason_code, reason_description, amount_disputed_cents, opened_role, transactions:transaction_id(title, amount_cents, currency, sector, buyer_id, seller_id)",
      )
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!dispute) throw new Error("Disputa no encontrada");

    const { data: messages } = await supabaseAdmin
      .from("dispute_messages")
      .select("author_role, body, created_at, message_type, visible_to")
      .eq("dispute_id", data.disputeId)
      .in("visible_to", ["all"])
      .order("created_at", { ascending: true })
      .limit(300);

    const { data: evidence } = await supabaseAdmin
      .from("dispute_evidence")
      .select("uploader_role, description, storage_path, kind, mime_type, created_at")
      .eq("dispute_id", data.disputeId)
      .order("created_at", { ascending: true })
      .limit(50);

    const tx = (dispute as { transactions: { title: string; amount_cents: number; currency: string; sector: string | null } }).transactions;

    const transcript = (messages ?? [])
      .filter((m) => m.message_type !== "system")
      .map((m) => `- [${m.author_role}] ${m.body}`)
      .join("\n")
      .slice(0, 6000);

    const evidenceList = (evidence ?? [])
      .map((e) => `- [${e.uploader_role}] ${e.file_name} — ${e.description ?? "sin descripción"}`)
      .join("\n")
      .slice(0, 2000);

    const prompt = `Eres mediador experto en escrow B2B/B2C en México. Analiza la disputa y devuelve JSON estricto.

TRANSACCIÓN:
- Título: ${tx?.title ?? ""}
- Sector: ${tx?.sector ?? "n/a"}
- Monto retenido: ${(tx?.amount_cents ?? 0) / 100} ${tx?.currency ?? "MXN"}
- Monto en disputa: ${(dispute.amount_disputed_cents ?? 0) / 100} ${tx?.currency ?? "MXN"}

DISPUTA:
- Número: ${dispute.numero}
- Motivo (código): ${dispute.reason_code}
- Abierta por rol: ${dispute.opened_role}
- Descripción: ${dispute.reason_description}

MENSAJES (${(messages ?? []).length}):
${transcript || "— sin mensajes de las partes —"}

EVIDENCIAS (${(evidence ?? []).length}):
${evidenceList || "— sin evidencias adjuntas —"}

Devuelve JSON con esta forma exacta:
{
  "resumen": "string 3-5 líneas neutrales",
  "puntos_clave_comprador": ["..."],
  "puntos_clave_vendedor": ["..."],
  "evidencias_faltantes": ["..."],
  "riesgos": ["..."],
  "recomendacion": "buyer_favor|seller_favor|split|no_resolution",
  "reparto_sugerido": { "comprador_pct": 0-100, "vendedor_pct": 0-100 },
  "confianza": 0-100
}`;

    const result = await aiJsonCall<AiSummaryResult>({
      provider: "gemini",
      messages: [
        {
          role: "system",
          content:
            "Eres un mediador imparcial. Nunca inventes hechos. Si no hay evidencia suficiente, recomienda 'no_resolution'. Responde ÚNICAMENTE con JSON válido.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.15,
    });

    // Formato humano del resumen para el panel
    const humanSummary = [
      result.resumen,
      "",
      "🟢 Comprador:",
      ...(result.puntos_clave_comprador ?? []).map((p) => `  • ${p}`),
      "",
      "🟠 Vendedor:",
      ...(result.puntos_clave_vendedor ?? []).map((p) => `  • ${p}`),
      "",
      result.evidencias_faltantes?.length
        ? `⚠️ Evidencias faltantes: ${result.evidencias_faltantes.join(", ")}`
        : "",
      result.riesgos?.length ? `🚨 Riesgos: ${result.riesgos.join(", ")}` : "",
      "",
      `👉 Recomendación: ${result.recomendacion} (confianza ${result.confianza}%)`,
      `Reparto sugerido — Comprador: ${result.reparto_sugerido?.comprador_pct ?? 0}% · Vendedor: ${result.reparto_sugerido?.vendedor_pct ?? 0}%`,
    ]
      .filter(Boolean)
      .join("\n");

    await supabaseAdmin
      .from("disputes")
      .update({
        summary_ai: humanSummary,
        summary_ai_generated_at: new Date().toISOString(),
      })
      .eq("id", data.disputeId);

    return { ok: true as const, summary: humanSummary, ai: result };
  });
