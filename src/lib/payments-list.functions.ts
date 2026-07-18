import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { derivePaymentStatus, type PaymentRow } from "@/lib/payments-catalog";

/**
 * Lista adaptativa para el Centro de Pagos.
 * Devuelve una fila por payment_intent + agregados de payouts/refunds/disputas.
 * Filtra por buyer_id/seller_id del usuario (RLS aplica adicionalmente).
 */
export const listPaymentsForCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Transacciones donde participo
    const { data: txs, error: txErr } = await supabase
      .from("transactions")
      .select(
        "id, numero, title, sector, buyer_id, seller_id, amount_cents, currency, status, created_at, counterparty_email, beneficiario_nombre",
      )
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (txErr) throw new Error(txErr.message);
    if (!txs?.length) return [] as PaymentRow[];

    const txIds = txs.map((t) => t.id);

    const [{ data: pis }, { data: pos }, { data: disp }, { data: hitos }] = await Promise.all([
      supabase
        .from("payment_intents")
        .select("id, transaction_id, provider, provider_ref, method, amount_cents, currency, status, clabe, reference_code, created_at, updated_at, paid_at")
        .in("transaction_id", txIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("payouts")
        .select("transaction_id, net_cents, gross_cents, status, created_at")
        .in("transaction_id", txIds),
      supabase
        .from("disputes")
        .select("transaction_id, status")
        .in("transaction_id", txIds)
        .in("status", ["open", "in_review", "in_mediation", "escalated"]),
      supabase
        .from("transaction_hitos")
        .select("transaction_id, orden, estado")
        .in("transaction_id", txIds)
        .order("orden"),
    ]);

    const disputeSet = new Set((disp ?? []).map((d) => d.transaction_id));
    const releasedByTx = new Map<string, number>();
    for (const p of pos ?? []) {
      if (p.status === "paid" || p.status === "released" || p.status === "confirmed") {
        releasedByTx.set(p.transaction_id, (releasedByTx.get(p.transaction_id) ?? 0) + (p.net_cents ?? p.gross_cents ?? 0));
      }
    }

    const hitosByTx = new Map<string, { total: number; current: number }>();
    for (const h of hitos ?? []) {
      const cur = hitosByTx.get(h.transaction_id) ?? { total: 0, current: 0 };
      cur.total += 1;
      if (h.estado === "EN_CURSO" || h.estado === "EN_REVISION" || h.estado === "PENDIENTE") {
        if (cur.current === 0) cur.current = h.orden ?? cur.total;
      } else if (h.estado === "APROBADO") {
        cur.current = Math.max(cur.current, (h.orden ?? 0) + 1);
      }
      hitosByTx.set(h.transaction_id, cur);
    }

    const txMap = new Map(txs.map((t) => [t.id, t]));

    // 2. Construir filas: una por PI si existe; si no, una "sintética" para PENDING_FUNDING
    const rows: PaymentRow[] = [];
    const seenTx = new Set<string>();

    for (const pi of pis ?? []) {
      const tx = txMap.get(pi.transaction_id);
      if (!tx) continue;
      seenTx.add(tx.id);
      const released = releasedByTx.get(tx.id) ?? 0;
      const hasDispute = disputeSet.has(tx.id);
      const hito = hitosByTx.get(tx.id);
      const status = derivePaymentStatus({
        intentStatus: pi.status,
        txStatus: tx.status,
        amountCents: pi.amount_cents ?? tx.amount_cents,
        releasedCents: released,
        refundedCents: 0,
        hasDispute,
      });

      rows.push({
        id: pi.id,
        transactionId: tx.id,
        numero: tx.numero,
        title: tx.title,
        sector: tx.sector,
        buyerId: tx.buyer_id,
        sellerId: tx.seller_id,
        buyerName: null,
        sellerName: tx.beneficiario_nombre ?? tx.counterparty_email,
        amountCents: pi.amount_cents ?? tx.amount_cents,
        releasedCents: released,
        refundedCents: 0,
        currency: pi.currency ?? tx.currency,
        provider: pi.provider,
        providerRef: pi.provider_ref,
        method: pi.method,
        status,
        txStatus: tx.status,
        hasDispute,
        hitoLabel: hito ? `Hito ${Math.min(hito.current || 1, hito.total)}/${hito.total}` : null,
        createdAt: pi.created_at,
        updatedAt: pi.updated_at ?? pi.created_at,
        paidAt: pi.paid_at,
        reference: pi.reference_code,
        clabe: pi.clabe,
      });
    }

    // Transacciones sin PI → PENDING_FUNDING
    for (const tx of txs) {
      if (seenTx.has(tx.id)) continue;
      const hasDispute = disputeSet.has(tx.id);
      const hito = hitosByTx.get(tx.id);
      const status = derivePaymentStatus({
        intentStatus: null,
        txStatus: tx.status,
        amountCents: tx.amount_cents,
        releasedCents: 0,
        refundedCents: 0,
        hasDispute,
      });
      rows.push({
        id: `tx-${tx.id}`,
        transactionId: tx.id,
        numero: tx.numero,
        title: tx.title,
        sector: tx.sector,
        buyerId: tx.buyer_id,
        sellerId: tx.seller_id,
        buyerName: null,
        sellerName: tx.beneficiario_nombre ?? tx.counterparty_email,
        amountCents: tx.amount_cents,
        releasedCents: 0,
        refundedCents: 0,
        currency: tx.currency,
        provider: null,
        providerRef: null,
        method: null,
        status,
        txStatus: tx.status,
        hasDispute,
        hitoLabel: hito ? `Hito 1/${hito.total}` : null,
        createdAt: tx.created_at,
        updatedAt: tx.created_at,
        paidAt: null,
        reference: null,
        clabe: null,
      });
    }

    rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return rows;
  });
