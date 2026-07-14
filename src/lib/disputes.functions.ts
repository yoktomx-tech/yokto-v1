import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularDepositoSeriedad } from "@/lib/disputes/deposit";

const uuid = z.string().uuid();

const REASON_CODES = [
  "incumplimiento_hito",
  "documentos_invalidos",
  "mercancia_incompleta",
  "calidad_insuficiente",
  "plazo_vencido",
  "fraude_sospechado",
  "condiciones_no_acordadas",
  "otro",
] as const;
type ReasonCode = (typeof REASON_CODES)[number];

// Días hábiles → suma calendarizada aproximada (fin de semana +2)
function addBusinessDays(base: Date, days: number): Date {
  const d = new Date(base);
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) remaining -= 1;
  }
  return d;
}

async function notify(
  userIds: (string | null | undefined)[],
  payload: { type: string; title: string; body?: string; link?: string; metadata?: Record<string, unknown> },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rows = userIds
    .filter((u): u is string => !!u)
    .map((user_id) => ({
      user_id,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      link: payload.link ?? null,
      metadata: (payload.metadata ?? {}) as never,
    }));
  if (rows.length) await supabaseAdmin.from("notifications").insert(rows);
}

// ---------- OPEN DISPUTE (crea disputa en pending_deposit y devuelve intent del depósito) ----------
export const openDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      transactionId: string;
      reasonCode: ReasonCode;
      reasonDescription: string;
      hitoId?: string | null;
      amountDisputedCents?: number;
    }) =>
      z
        .object({
          transactionId: uuid,
          reasonCode: z.enum(REASON_CODES),
          reasonDescription: z
            .string()
            .trim()
            .min(100, "Describe la disputa con al menos 100 caracteres")
            .max(4000),
          hitoId: uuid.nullable().optional(),
          amountDisputedCents: z.number().int().positive().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tx } = await supabase
      .from("transactions")
      .select("id, buyer_id, seller_id, amount_cents, currency, status, title, numero")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("Transacción no encontrada");
    if (!["funded", "in_progress", "conditions_met", "en_verificacion", "partial_release"].includes(tx.status))
      throw new Error("Solo se pueden abrir disputas en transacciones fondeadas o en curso");

    const isBuyer = tx.buyer_id === userId;
    const isSeller = tx.seller_id === userId;
    if (!isBuyer && !isSeller) throw new Error("No autorizado");

    const { data: existing } = await supabase
      .from("disputes")
      .select("id, status")
      .eq("transaction_id", tx.id)
      .maybeSingle();
    if (existing && !["withdrawn", "cancelled", "closed", "resolved"].includes(existing.status))
      throw new Error("Ya existe una disputa activa para esta transacción");

    // Monto en disputa: total del hito si aplica, si no el que el usuario indique, si no el total de la tx.
    let hitoMontoCents: number | null = null;
    if (data.hitoId) {
      const { data: h } = await supabase
        .from("transaction_hitos")
        .select("id, monto_cents, monto_porcentaje, transaction_id")
        .eq("id", data.hitoId)
        .maybeSingle();
      if (!h || h.transaction_id !== tx.id) throw new Error("Hito inválido");
      hitoMontoCents =
        h.monto_cents ?? Math.round((tx.amount_cents * (h.monto_porcentaje ?? 0)) / 100);
    }
    const amountDisputed = data.amountDisputedCents ?? hitoMontoCents ?? tx.amount_cents;
    const deposito = calcularDepositoSeriedad(tx.amount_cents, hitoMontoCents ?? undefined);

    // Crea la disputa en pending_deposit
    const { data: dispute, error } = await supabase
      .from("disputes")
      .insert({
        transaction_id: tx.id,
        opened_by: userId,
        opened_role: isBuyer ? "buyer" : "seller",
        reason_code: data.reasonCode,
        reason_description: data.reasonDescription,
        amount_disputed_cents: amountDisputed,
        hito_id: data.hitoId ?? null,
        deposit_cents: deposito.monto_cents,
        status: "pending_deposit",
      })
      .select("id, numero, deposit_cents")
      .single();
    if (error) throw new Error(error.message);

    // Genera intent de pago del depósito (separado del PI de la transacción)
    const { getPaymentProvider } = await import("@/lib/payments");
    const provider = getPaymentProvider();
    const buyerEmail = context.claims?.email ?? null;
    const intent = await provider.createFundingIntent({
      transactionId: `dispute:${dispute.id}`,
      amountCents: deposito.monto_cents,
      currency: tx.currency,
      method: "card",
      buyerEmail,
      metadata: {
        kind: "dispute_deposit",
        dispute_id: dispute.id,
        transaction_id: tx.id,
      },
    });

    await supabase
      .from("disputes")
      .update({ deposit_provider_ref: intent.providerRef })
      .eq("id", dispute.id);

    await supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: userId,
      event_type: "dispute.draft",
      metadata: { dispute_id: dispute.id, deposit_cents: deposito.monto_cents, reason: data.reasonCode } as never,
    });

    return {
      disputeId: dispute.id,
      numero: dispute.numero,
      depositCents: deposito.monto_cents,
      hostedUrl: intent.hostedUrl ?? null,
      providerRef: intent.providerRef,
      provider: intent.provider,
    };
  });

// ---------- CONFIRM DEPOSIT + ACTIVATE ----------
export const confirmDisputeDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { disputeId: string }) => z.object({ disputeId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: dispute } = await supabase
      .from("disputes")
      .select(
        "id, opened_by, status, deposit_provider_ref, deposit_paid, transaction_id, numero",
      )
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!dispute) throw new Error("Disputa no encontrada");
    if (dispute.opened_by !== userId) throw new Error("Solo el activador puede confirmar el depósito");
    if (dispute.status !== "pending_deposit") throw new Error("La disputa ya fue activada");
    if (!dispute.deposit_provider_ref) throw new Error("Sin referencia de pago");

    const { getPaymentProvider } = await import("@/lib/payments");
    const provider = getPaymentProvider();
    const conf = await provider.confirmFunding(dispute.deposit_provider_ref);
    if (conf.status !== "succeeded") {
      return { ok: false, status: conf.status };
    }

    const now = new Date();
    const respDue = addBusinessDays(now, 5);
    const evDue = addBusinessDays(now, 10);
    const resDue = addBusinessDays(now, 20);

    await supabase
      .from("disputes")
      .update({
        status: "awaiting_response",
        deposit_paid: true,
        deposit_paid_at: conf.paidAt ?? now.toISOString(),
        activated_at: now.toISOString(),
        counterparty_response_due_at: respDue.toISOString(),
        evidence_due_at: evDue.toISOString(),
        resolution_due_at: resDue.toISOString(),
      })
      .eq("id", dispute.id);

    // Bloquea la transacción
    await supabase.from("transactions").update({ status: "disputed" }).eq("id", dispute.transaction_id);

    // Mensaje de sistema en el chat
    await supabase.from("dispute_messages").insert({
      dispute_id: dispute.id,
      author_id: userId,
      author_role: "system",
      message_type: "system",
      body: `🔔 Disputa ${dispute.numero} activada. La contraparte tiene hasta ${respDue.toLocaleDateString("es-MX")} para responder.`,
      visible_to: "all",
    });

    await supabase.from("transaction_events").insert({
      transaction_id: dispute.transaction_id,
      actor_id: userId,
      event_type: "dispute.opened",
      metadata: { dispute_id: dispute.id } as never,
    });

    // Notifica a la contraparte
    const { data: tx } = await supabase
      .from("transactions")
      .select("buyer_id, seller_id, title")
      .eq("id", dispute.transaction_id)
      .single();
    const counterparty = tx?.buyer_id === userId ? tx?.seller_id : tx?.buyer_id;
    await notify([counterparty], {
      type: "dispute.opened",
      title: `Se abrió una disputa (${dispute.numero})`,
      body: `Transacción: ${tx?.title ?? ""} — tienes 5 días hábiles para responder.`,
      link: `/disputes/${dispute.id}`,
      metadata: { dispute_id: dispute.id, tx_id: dispute.transaction_id },
    });

    return { ok: true, status: "activated" as const };
  });

// ---------- WITHDRAW (el activador retira antes de resolver) ----------
export const withdrawDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { disputeId: string; reason: string }) =>
    z.object({ disputeId: uuid, reason: z.string().trim().min(10).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: dispute } = await supabase
      .from("disputes")
      .select("id, opened_by, status, transaction_id, numero")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!dispute) throw new Error("Disputa no encontrada");
    if (dispute.opened_by !== userId) throw new Error("Solo el activador puede retirar la disputa");
    if (!["pending_deposit", "open", "awaiting_response", "in_review", "in_mediation"].includes(dispute.status))
      throw new Error("La disputa ya no puede retirarse");

    await supabase
      .from("disputes")
      .update({ status: "withdrawn", resolution_notes: data.reason })
      .eq("id", dispute.id);

    // Devuelve la transacción al estado previo razonable (in_progress si estaba disputed)
    const { data: tx } = await supabase
      .from("transactions")
      .select("status, buyer_id, seller_id, title")
      .eq("id", dispute.transaction_id)
      .single();
    if (tx?.status === "disputed") {
      await supabase.from("transactions").update({ status: "in_progress" }).eq("id", dispute.transaction_id);
    }

    await supabase.from("dispute_messages").insert({
      dispute_id: dispute.id,
      author_id: userId,
      author_role: "system",
      message_type: "system",
      body: `↩️ Disputa ${dispute.numero} retirada por el activador. Motivo: ${data.reason}`,
      visible_to: "all",
    });

    await supabase.from("transaction_events").insert({
      transaction_id: dispute.transaction_id,
      actor_id: userId,
      event_type: "dispute.withdrawn",
      metadata: { dispute_id: dispute.id } as never,
    });

    const counterparty = tx?.buyer_id === userId ? tx?.seller_id : tx?.buyer_id;
    await notify([counterparty], {
      type: "dispute.withdrawn",
      title: `Disputa retirada (${dispute.numero})`,
      body: tx?.title ?? "",
      link: `/disputes/${dispute.id}`,
    });

    return { ok: true };
  });

// ---------- ADD MESSAGE ----------
export const addDisputeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      disputeId: string;
      body: string;
      evidenceUrls?: string[];
      visibleTo?: "all" | "mediator_only" | "buyer_and_mediator" | "seller_and_mediator";
    }) =>
      z
        .object({
          disputeId: uuid,
          body: z.string().trim().min(1).max(4000),
          evidenceUrls: z.array(z.string()).max(10).optional(),
          visibleTo: z
            .enum(["all", "mediator_only", "buyer_and_mediator", "seller_and_mediator"])
            .optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: dispute } = await supabase
      .from("disputes")
      .select("id, transaction_id, transactions:transaction_id(buyer_id, seller_id, title)")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!dispute) throw new Error("Disputa no encontrada");
    const tx = (dispute as unknown as { transactions: { buyer_id: string; seller_id: string | null; title: string } })
      .transactions;
    const isBuyer = tx.buyer_id === userId;
    const isSeller = tx.seller_id === userId;
    const { data: isMediator } = await supabase.rpc("has_role", { _user_id: userId, _role: "mediator" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const role: "buyer" | "seller" | "admin" | "mediator" | null = isBuyer
      ? "buyer"
      : isSeller
      ? "seller"
      : isAdmin
      ? "admin"
      : isMediator
      ? "mediator"
      : null;
    if (!role) throw new Error("No autorizado");

    // Solo el mediador/admin puede escribir mensajes con visibilidad restringida
    const visibleTo = data.visibleTo ?? "all";
    if (visibleTo !== "all" && role !== "mediator" && role !== "admin") {
      throw new Error("Solo el mediador puede enviar mensajes privados");
    }

    const { error } = await supabase.from("dispute_messages").insert({
      dispute_id: data.disputeId,
      author_id: userId,
      author_role: role,
      body: data.body,
      evidence_urls: data.evidenceUrls ?? [],
      visible_to: visibleTo,
    });
    if (error) throw new Error(error.message);

    // Notifica a las partes distintas al autor (solo si visibleTo = 'all')
    if (visibleTo === "all") {
      const targets = [tx.buyer_id, tx.seller_id].filter((u) => u && u !== userId);
      await notify(targets, {
        type: "dispute.message",
        title: "Nuevo mensaje en la disputa",
        body: data.body.slice(0, 140),
        link: `/disputes/${data.disputeId}`,
      });
    }

    return { ok: true };
  });

// ---------- RESOLVE (mediator/admin) ----------
export const resolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      disputeId: string;
      resolution: "buyer_favor" | "seller_favor" | "split" | "no_resolution";
      buyerShareCents: number;
      sellerShareCents: number;
      loserPays: "buyer" | "seller" | "split" | "none";
      notes: string;
    }) =>
      z
        .object({
          disputeId: uuid,
          resolution: z.enum(["buyer_favor", "seller_favor", "split", "no_resolution"]),
          buyerShareCents: z.number().int().min(0),
          sellerShareCents: z.number().int().min(0),
          loserPays: z.enum(["buyer", "seller", "split", "none"]),
          notes: z.string().min(10).max(2000),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isMediator } = await supabase.rpc("has_role", { _user_id: userId, _role: "mediator" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isMediator && !isAdmin) throw new Error("Solo mediadores o administradores pueden resolver");

    const { data: dispute } = await supabase
      .from("disputes")
      .select(
        "id, transaction_id, amount_disputed_cents, status, transactions:transaction_id(buyer_id, seller_id, amount_cents, title)",
      )
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!dispute) throw new Error("Disputa no encontrada");
    if (dispute.status === "resolved" || dispute.status === "closed")
      throw new Error("La disputa ya está resuelta");

    const tx = (dispute as unknown as {
      transactions: { buyer_id: string; seller_id: string | null; amount_cents: number; title: string };
    }).transactions;
    if (data.buyerShareCents + data.sellerShareCents > tx.amount_cents)
      throw new Error("La suma de partes excede el monto retenido");

    const nowIso = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("disputes")
      .update({
        status: "resolved",
        resolution: data.resolution,
        resolution_notes: data.notes,
        buyer_share_cents: data.buyerShareCents,
        seller_share_cents: data.sellerShareCents,
        loser_pays: data.loserPays,
        mediator_id: userId,
        resolved_at: nowIso,
      })
      .eq("id", data.disputeId);
    if (upErr) throw new Error(upErr.message);

    const newStatus = data.resolution === "seller_favor" ? "released" : "refunded";
    await supabase
      .from("transactions")
      .update({ status: newStatus, released_at: data.resolution === "seller_favor" ? nowIso : null })
      .eq("id", dispute.transaction_id);

    await supabase.from("transaction_events").insert({
      transaction_id: dispute.transaction_id,
      actor_id: userId,
      event_type: "dispute.resolved",
      metadata: {
        resolution: data.resolution,
        buyer_share: data.buyerShareCents,
        seller_share: data.sellerShareCents,
      } as never,
    });

    await notify([tx.buyer_id, tx.seller_id], {
      type: "dispute.resolved",
      title: "Disputa resuelta",
      body: `${tx.title} — resolución: ${data.resolution}`,
      link: `/disputes/${data.disputeId}`,
    });

    return { ok: true };
  });

// ---------- NOTIFICATIONS ----------
export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; all?: boolean }) =>
    z.object({ id: uuid.optional(), all: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId);
    if (data.all) await q.is("read_at", null);
    else if (data.id) await q.eq("id", data.id);
    return { ok: true };
  });
