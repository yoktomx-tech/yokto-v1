import type { PaymentRow } from "@/lib/payments-catalog";
import { UI_PAYMENT_STATUS } from "@/lib/payments-catalog";

function escape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function money(cents: number, currency = "MXN"): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export function exportPaymentsCsv(rows: PaymentRow[], filename = "yokto-pagos.csv") {
  const headers = [
    "numero", "titulo", "sector", "comprador", "vendedor",
    "monto", "liberado", "reembolsado", "moneda",
    "pasarela", "referencia", "clabe", "metodo",
    "estado", "hito", "actualizado", "creado",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      r.numero, r.title, r.sector, r.buyerName, r.sellerName,
      money(r.amountCents, r.currency), money(r.releasedCents, r.currency), money(r.refundedCents, r.currency),
      r.currency, r.provider, r.reference, r.clabe, r.method,
      UI_PAYMENT_STATUS[r.status].label, r.hitoLabel,
      r.updatedAt, r.createdAt,
    ].map(escape).join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
