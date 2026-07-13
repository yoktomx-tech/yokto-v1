import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

async function notify(userIds: (string | null | undefined)[], payload: {
  type: string; title: string; body?: string; link?: string; metadata?: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rows = userIds.filter((u): u is string => !!u).map((user_id) => ({
    user_id,
    type: payload.type,
    title: payload.title,
    body: payload.body ?? null,
    link: payload.link ?? null,
    metadata: (payload.metadata ?? {}) as never,
  }));
  if (rows.length) await supabaseAdmin.from("notifications").insert(rows);
}

// ---------- OPEN DISPUTE ----------
export const openDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    transactionId: string;
    reasonCode: "not_delivered" | "not_as_described" | "quality" | "delay" | "fraud" | "other";
    reasonDescription: string;
    amountDisputedCents?: number;
  }) =>
    z.object({
      transactionId: uuid,
      reasonCode: z.enum(["not_delivered", "not_as_described", "quality", "delay", "fraud", "other"]),
      reasonDescription: z.string().min(20, "Describe la disputa con al menos 20 caracteres").max(2000),
      amountDisputedCents: z.number().int().positive().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tx } = await supabase
      .from("transactions")
      .select("id, buyer_id, seller_id, amount_cents, status, title")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("Transacción no encontrada");
    if (!["funded", "in_progress", "conditions_met"].includes(tx.status))
      throw new Error("Solo se pueden abrir disputas en transacciones fondeadas o en curso");
    const isBuyer = tx.buyer_id === userId;
    const isSeller = tx.seller_id === userId;
    if (!isBuyer && !isSeller) throw new Error("No autorizado");

    const { data: existing } = await supabase.from("disputes").select("id").eq("transaction_id", tx.id).maybeSingle();
    if (existing) throw new Error("Ya existe una disputa para esta transacción");

    const { data: dispute, error } = await supabase.from("disputes").insert({
      transaction_id: tx.id,
      opened_by: userId,
      opened_role: isBuyer ? "buyer" : "seller",
      reason_code: data.reasonCode,
      reason_description: data.reasonDescription,
      amount_disputed_cents: data.amountDisputedCents ?? tx.amount_cents,
    }).select("id").single();
    if (error) throw new Error(error.message);

    await supabase.from("transactions").update({ status: "disputed" }).eq("id", tx.id);
    await supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: userId,
      event_type: "dispute.opened",
      metadata: { dispute_id: dispute.id, reason: data.reasonCode } as never,
    });

    // Notify counterparty + mediators (system)
    await notify([isBuyer ? tx.seller_id : tx.buyer_id], {
      type: "dispute.opened",
      title: "Se abrió una disputa",
      body: `Transacción: ${tx.title}`,
      link: `/disputes/${dispute.id}`,
      metadata: { dispute_id: dispute.id, tx_id: tx.id },
    });

    return dispute;
  });

// ---------- ADD MESSAGE ----------
export const addDisputeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { disputeId: string; body: string; evidenceUrls?: string[] }) =>
    z.object({
      disputeId: uuid,
      body: z.string().trim().min(1).max(4000),
      evidenceUrls: z.array(z.string()).max(10).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: dispute } = await supabase
      .from("disputes")
      .select("id, transaction_id, transactions:transaction_id(buyer_id, seller_id, title)")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!dispute) throw new Error("Disputa no encontrada");
    const tx = (dispute as unknown as { transactions: { buyer_id: string; seller_id: string | null; title: string } }).transactions;
    const isBuyer = tx.buyer_id === userId;
    const isSeller = tx.seller_id === userId;
    const { data: isMediator } = await supabase.rpc("has_role", { _user_id: userId, _role: "mediator" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const role = isBuyer ? "buyer" : isSeller ? "seller" : isAdmin ? "admin" : isMediator ? "mediator" : null;
    if (!role) throw new Error("No autorizado");

    const { error } = await supabase.from("dispute_messages").insert({
      dispute_id: data.disputeId,
      author_id: userId,
      author_role: role,
      body: data.body,
      evidence_urls: data.evidenceUrls ?? [],
    });
    if (error) throw new Error(error.message);

    // Notify parties other than the author
    const targets = [tx.buyer_id, tx.seller_id].filter((u) => u && u !== userId);
    await notify(targets, {
      type: "dispute.message",
      title: "Nuevo mensaje en la disputa",
      body: data.body.slice(0, 140),
      link: `/disputes/${data.disputeId}`,
    });

    return { ok: true };
  });

// ---------- RESOLVE (mediator/admin only) ----------
export const resolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    disputeId: string;
    resolution: "buyer_favor" | "seller_favor" | "split" | "no_resolution";
    buyerShareCents: number;
    sellerShareCents: number;
    loserPays: "buyer" | "seller" | "split" | "none";
    notes: string;
  }) =>
    z.object({
      disputeId: uuid,
      resolution: z.enum(["buyer_favor", "seller_favor", "split", "no_resolution"]),
      buyerShareCents: z.number().int().min(0),
      sellerShareCents: z.number().int().min(0),
      loserPays: z.enum(["buyer", "seller", "split", "none"]),
      notes: z.string().min(10).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isMediator } = await supabase.rpc("has_role", { _user_id: userId, _role: "mediator" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isMediator && !isAdmin) throw new Error("Solo mediadores o administradores pueden resolver");

    const { data: dispute } = await supabase
      .from("disputes")
      .select("id, transaction_id, amount_disputed_cents, status, transactions:transaction_id(buyer_id, seller_id, amount_cents, title)")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!dispute) throw new Error("Disputa no encontrada");
    if (dispute.status === "resolved" || dispute.status === "closed") throw new Error("La disputa ya está resuelta");

    const tx = (dispute as unknown as { transactions: { buyer_id: string; seller_id: string | null; amount_cents: number; title: string } }).transactions;
    if (data.buyerShareCents + data.sellerShareCents > tx.amount_cents)
      throw new Error("La suma de partes excede el monto retenido");

    const nowIso = new Date().toISOString();
    const { error: upErr } = await supabase.from("disputes").update({
      status: "resolved",
      resolution: data.resolution,
      resolution_notes: data.notes,
      buyer_share_cents: data.buyerShareCents,
      seller_share_cents: data.sellerShareCents,
      loser_pays: data.loserPays,
      mediator_id: userId,
      resolved_at: nowIso,
    }).eq("id", data.disputeId);
    if (upErr) throw new Error(upErr.message);

    // Mark the transaction as refunded (buyer favor / split with refund) or released (seller favor)
    const newStatus = data.resolution === "seller_favor" ? "released" : "refunded";
    await supabase.from("transactions").update({
      status: newStatus,
      released_at: data.resolution === "seller_favor" ? nowIso : null,
    }).eq("id", dispute.transaction_id);

    await supabase.from("transaction_events").insert({
      transaction_id: dispute.transaction_id,
      actor_id: userId,
      event_type: "dispute.resolved",
      metadata: { resolution: data.resolution, buyer_share: data.buyerShareCents, seller_share: data.sellerShareCents } as never,
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
