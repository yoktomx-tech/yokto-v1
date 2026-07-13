// Módulo L — Reportes CSV + stub CFDI 4.0
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const exportTransactionsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("transactions")
      .select("id, title, sector, amount_cents, currency, status, buyer_id, seller_id, funded_at, released_at, created_at")
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const headers = ["id", "titulo", "sector", "monto", "moneda", "estado", "rol", "fondeada_en", "liberada_en", "creada_en"];
    const lines = [headers.join(",")];
    for (const r of rows ?? []) {
      const rol = r.buyer_id === userId ? "comprador" : "vendedor";
      lines.push([
        r.id, r.title, r.sector ?? "", (r.amount_cents / 100).toFixed(2), r.currency,
        r.status, rol, r.funded_at ?? "", r.released_at ?? "", r.created_at,
      ].map(csvEscape).join(","));
    }
    const csv = lines.join("\n");

    await supabase.from("reports_ledger").insert({
      owner_id: userId, kind: "tx_csv",
      period_from: data.from ?? null, period_to: data.to ?? null,
      row_count: rows?.length ?? 0,
    });

    return {
      filename: `yokto-transacciones-${new Date().toISOString().slice(0, 10)}.csv`,
      mime: "text/csv;charset=utf-8",
      base64: btoa(unescape(encodeURIComponent(csv))),
      rows: rows?.length ?? 0,
    };
  });

export const generateCfdiStub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ transactionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tx, error } = await supabase
      .from("transactions")
      .select("id, title, amount_cents, currency, buyer_id, seller_id, sector, released_at")
      .eq("id", data.transactionId)
      .single();
    if (error || !tx) throw new Error("Transacción no encontrada");
    if (tx.buyer_id !== userId && tx.seller_id !== userId) throw new Error("Sin acceso");
    if (!tx.released_at) throw new Error("Solo se puede timbrar tras la liberación");

    const folio = `YOKTO-${tx.id.slice(0, 8).toUpperCase()}`;
    const uuidSat = crypto.randomUUID();
    const subtotal = tx.amount_cents / 100 / 1.16;
    const iva = tx.amount_cents / 100 - subtotal;

    const stub = {
      version: "4.0",
      folio,
      uuid_sat: uuidSat,
      fecha_timbrado: new Date().toISOString(),
      emisor: { rfc: "YKT250101ABC", razon_social: "YOKTO ESCROW SAPI DE CV", regimen: "601" },
      receptor: { rfc: "XAXX010101000", uso_cfdi: "G03" },
      conceptos: [{
        clave_prod_serv: "80101500", cantidad: 1, clave_unidad: "E48",
        descripcion: tx.title, valor_unitario: subtotal.toFixed(2), importe: subtotal.toFixed(2),
      }],
      subtotal: subtotal.toFixed(2),
      iva: iva.toFixed(2),
      total: (tx.amount_cents / 100).toFixed(2),
      moneda: tx.currency,
      metodo_pago: "PUE",
      forma_pago: "03",
      nota: "STUB — no válido fiscalmente. Requiere integración con PAC certificado.",
    };

    await supabase.from("reports_ledger").insert({
      owner_id: userId, kind: "cfdi_stub", transaction_id: tx.id,
      metadata: { folio, uuid_sat: uuidSat },
    });

    return stub;
  });

export const listRecentReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("reports_ledger")
      .select("id, kind, transaction_id, period_from, period_to, row_count, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });
