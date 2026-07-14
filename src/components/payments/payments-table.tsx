import { Link } from "@tanstack/react-router";
import type { PaymentRow } from "@/lib/payments-catalog";
import type { ViewRole } from "@/hooks/use-view-role";
import { PaymentStatusBadge } from "./ui/payment-status-badge";
import { MoneyCell } from "./ui/money-cell";
import { ExternalLink } from "lucide-react";

type Props = {
  rows: PaymentRow[];
  role: ViewRole;
  onOpen?: (r: PaymentRow) => void;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function PaymentsTable({ rows, role, onOpen }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-yo-border bg-yo-card p-10 text-center">
        <p className="text-sm text-yo-t2">No hay pagos que coincidan con los filtros.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-yo-border bg-yo-card">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wide text-yo-t2 bg-yo-bg2">
          <tr>
            <th className="px-4 py-3 font-semibold">Operación</th>
            <th className="px-4 py-3 font-semibold">Contraparte</th>
            <th className="px-4 py-3 font-semibold">Pasarela</th>
            <th className="px-4 py-3 font-semibold text-right">Monto</th>
            <th className="px-4 py-3 font-semibold">Estatus</th>
            <th className="px-4 py-3 font-semibold">{role === "buyer" ? "Próxima liberación" : "Próximo cobro"}</th>
            <th className="px-4 py-3 font-semibold">Actualizado</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-yo-border">
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onOpen?.(r)}
              className="hover:bg-yo-bg2 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3">
                <div className="font-mono text-[12px] text-yo-t1">{r.numero ?? r.transactionId.slice(0, 8)}</div>
                <div className="text-[12px] text-yo-t2 truncate max-w-[240px]">{r.title ?? "—"}</div>
              </td>
              <td className="px-4 py-3 text-yo-t1 truncate max-w-[200px]">{r.sellerName ?? r.buyerName ?? "—"}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-yo-bg2 px-2 py-0.5 text-[11px] font-medium text-yo-t2">
                  {r.provider ?? "—"}
                </span>
                {r.reference && <div className="mt-1 font-mono text-[11px] text-yo-t2">{r.reference}</div>}
              </td>
              <td className="px-4 py-3 text-right">
                <MoneyCell cents={r.amountCents} currency={r.currency} />
                {r.status === "PARTIALLY_RELEASED" && (
                  <div className="text-[11px] text-yo-t2 mt-0.5">
                    Liberado: {(r.releasedCents / 100).toLocaleString("es-MX", { style: "currency", currency: r.currency })}
                  </div>
                )}
              </td>
              <td className="px-4 py-3"><PaymentStatusBadge status={r.status} /></td>
              <td className="px-4 py-3 text-yo-t2">{r.hitoLabel ?? "—"}</td>
              <td className="px-4 py-3 text-yo-t2">{fmtDate(r.updatedAt)}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  to="/transactions/$id"
                  params={{ id: r.transactionId }}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-yo-ac hover:underline text-[12px] font-medium"
                >
                  Ver operación <ExternalLink className="size-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
