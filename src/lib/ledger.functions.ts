import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ledger contable derivado de payment_intents + payouts.
 * No custodia: cada asiento describe un movimiento procesado por la pasarela.
 *
 * Convención (perspectiva YOKTO como registro contable):
 *  - FONDEO           → débito (entra a la retención de la pasarela)
 *  - LIBERACION       → crédito (sale de la retención al vendedor)
 *  - COMISION_YOKTO   → crédito (sale de la retención a YOKTO)
 *  - REEMBOLSO        → crédito (sale de la retención al comprador)
 */

export type LedgerEntryKind =
  | "FONDEO"
  | "LIBERACION"
  | "COMISION_YOKTO"
  | "REEMBOLSO";

export type LedgerEntry = {
  id: string;
  kind: LedgerEntryKind;
  date: string;
  txId: string;
  txNumero: string | null;
  txTitle: string | null;
  counterparty: string | null;
  provider: string | null;
  reference: string | null;
  debitCents: number;
  creditCents: number;
  currency: string;
};

export const listLedgerEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: txs, error: txErr } = await supabase
      .from("transactions")
      .select("id, numero, title, buyer_id, seller_id, currency, beneficiario_nombre, counterparty_email")
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .limit(500);
    if (txErr) throw new Error(txErr.message);
    if (!txs?.length) return [] as LedgerEntry[];

    const txIds = txs.map((t) => t.id);
    const txMap = new Map(txs.map((t) => [t.id, t]));

    const [{ data: pis }, { data: pos }] = await Promise.all([
      supabase
        .from("payment_intents")
        .select("id, transaction_id, provider, provider_ref, reference_code, amount_cents, currency, status, paid_at, created_at")
        .in("transaction_id", txIds),
      supabase
        .from("payouts")
        .select("id, transaction_id, provider, provider_ref, gross_cents, commission_cents, net_cents, currency, status, paid_at, created_at")
        .in("transaction_id", txIds),
    ]);

    const entries: LedgerEntry[] = [];

    for (const pi of pis ?? []) {
      const tx = txMap.get(pi.transaction_id);
      if (!tx) continue;
      const paid = pi.status === "succeeded" || pi.status === "held" || pi.status === "processing";
      if (!paid) continue;
      entries.push({
        id: `pi-${pi.id}`,
        kind: "FONDEO",
        date: pi.paid_at ?? pi.created_at,
        txId: tx.id,
        txNumero: tx.numero,
        txTitle: tx.title,
        counterparty: tx.beneficiario_nombre ?? tx.counterparty_email,
        provider: pi.provider,
        reference: pi.reference_code ?? pi.provider_ref,
        debitCents: pi.amount_cents ?? 0,
        creditCents: 0,
        currency: pi.currency ?? tx.currency ?? "MXN",
      });
    }

    for (const po of pos ?? []) {
      const tx = txMap.get(po.transaction_id);
      if (!tx) continue;
      const settled = po.status === "paid" || po.status === "released" || po.status === "confirmed";
      if (!settled) continue;
      const gross = po.gross_cents ?? 0;
      const commission = po.commission_cents ?? 0;
      const net = po.net_cents ?? gross - commission;
      // Liberación neta al vendedor
      entries.push({
        id: `po-${po.id}-net`,
        kind: "LIBERACION",
        date: po.paid_at ?? po.created_at,
        txId: tx.id,
        txNumero: tx.numero,
        txTitle: tx.title,
        counterparty: tx.beneficiario_nombre ?? tx.counterparty_email,
        provider: po.provider,
        reference: po.provider_ref,
        debitCents: 0,
        creditCents: net,
        currency: po.currency ?? tx.currency ?? "MXN",
      });
      if (commission > 0) {
        entries.push({
          id: `po-${po.id}-fee`,
          kind: "COMISION_YOKTO",
          date: po.paid_at ?? po.created_at,
          txId: tx.id,
          txNumero: tx.numero,
          txTitle: tx.title,
          counterparty: "YOKTO",
          provider: po.provider,
          reference: po.provider_ref,
          debitCents: 0,
          creditCents: commission,
          currency: po.currency ?? tx.currency ?? "MXN",
        });
      }
    }

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return entries;
  });

// ---- Documentos fiscales (globales del usuario) ----

export type FiscalDocRow = {
  id: string;
  tipo: string | null;
  serie: string | null;
  folio: string | null;
  uuidFiscal: string | null;
  rfcEmisor: string | null;
  rfcReceptor: string | null;
  total: number | null;
  moneda: string | null;
  fechaEmision: string | null;
  estado: string | null;
  estadoSat: string | null;
  txId: string;
  txNumero: string | null;
  txTitle: string | null;
};

export const listFiscalDocsForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: txs } = await supabase
      .from("transactions")
      .select("id, numero, title")
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .limit(500);
    const txIds = (txs ?? []).map((t) => t.id);
    if (!txIds.length) return [] as FiscalDocRow[];
    const txMap = new Map((txs ?? []).map((t) => [t.id, t]));

    const { data: docs } = await supabase
      .from("fiscal_documents")
      .select("id, transaction_id, tipo, serie, folio, uuid_fiscal, rfc_emisor, rfc_receptor, total, moneda, fecha_emision, estado, estado_sat")
      .in("transaction_id", txIds)
      .order("fecha_emision", { ascending: false });

    return (docs ?? []).map((d): FiscalDocRow => {
      const tx = txMap.get(d.transaction_id);
      return {
        id: d.id,
        tipo: d.tipo,
        serie: d.serie,
        folio: d.folio,
        uuidFiscal: d.uuid_fiscal,
        rfcEmisor: d.rfc_emisor,
        rfcReceptor: d.rfc_receptor,
        total: d.total !== null ? Number(d.total) : null,
        moneda: d.moneda,
        fechaEmision: d.fecha_emision,
        estado: d.estado,
        estadoSat: d.estado_sat,
        txId: d.transaction_id,
        txNumero: tx?.numero ?? null,
        txTitle: tx?.title ?? null,
      };
    });
  });
