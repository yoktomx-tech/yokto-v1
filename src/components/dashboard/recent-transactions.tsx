import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { formatMoney, STATUS_LABEL, type TxStatus } from "@/lib/tx";
import { cn } from "@/lib/utils";

export type TxRow = {
  id: string;
  title: string;
  counterparty_email: string | null;
  seller_id: string | null;
  buyer_id: string;
  amount_cents: number;
  status: TxStatus;
  sector: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<TxStatus, string> = {
  draft:             "bg-yo-raised text-yo-txt-2",
  pending_signature: "bg-yo-warn-bg text-yo-warn",
  awaiting_funding:  "bg-yo-warn-bg text-yo-warn",
  funded:            "bg-yo-ac-bg text-yo-ac-txt",
  in_progress:       "bg-yo-info-bg text-yo-info",
  en_verificacion:   "bg-yo-info-bg text-yo-info",
  conditions_met:    "bg-yo-ok-bg text-yo-ok",
  partial_release:   "bg-yo-ok-bg text-yo-ok",
  released:          "bg-yo-txt text-white",
  disputed:          "bg-yo-err-bg text-yo-err",
  cancelled:         "bg-yo-raised text-yo-txt-3",
  refunded:          "bg-yo-raised text-yo-txt-3",
};

type Filter = "all" | "active" | "needs_action" | "completed";

export function RecentTransactions({ rows, userId }: { rows: TxRow[]; userId: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (q) {
        const s = q.toLowerCase();
        if (!r.title.toLowerCase().includes(s) &&
            !(r.counterparty_email ?? "").toLowerCase().includes(s) &&
            !r.id.toLowerCase().includes(s)) return false;
      }
      if (filter === "active") return !["draft","cancelled","released","refunded"].includes(r.status);
      if (filter === "completed") return r.status === "released";
      if (filter === "needs_action") {
        return (r.buyer_id === userId && r.status === "awaiting_funding") ||
               (r.seller_id === userId && r.status === "conditions_met") ||
               r.status === "disputed";
      }
      return true;
    }).slice(0, pageSize);
  }, [rows, filter, q, pageSize, userId]);

  const FilterBtn = ({ id, children }: { id: Filter; children: React.ReactNode }) => (
    <button
      onClick={() => setFilter(id)}
      className={cn(
        "px-3 py-1.5 rounded-md text-xs font-semibold transition",
        filter === id ? "bg-yo-txt text-white" : "bg-yo-raised text-yo-txt-2 hover:bg-yo-border"
      )}
    >
      {children}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5">
          <FilterBtn id="all">Todas</FilterBtn>
          <FilterBtn id="active">Activas</FilterBtn>
          <FilterBtn id="needs_action">Requieren acción</FilterBtn>
          <FilterBtn id="completed">Completadas</FilterBtn>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-yo-txt-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, ID o contraparte"
            className="pl-8 pr-3 h-8 w-64 max-w-full rounded-md border border-yo-border bg-yo-surface text-sm focus:outline-none focus:border-yo-ac"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-yo-txt-3">Sin transacciones que coincidan.</div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-yo-border">
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-yo-txt-3">ID</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-yo-txt-3">Descripción</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-yo-txt-3">Contraparte</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-yo-txt-3 text-right">Monto</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-yo-txt-3">Estado</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-yo-txt-3">Fecha</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-yo-border">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-yo-raised/40 transition">
                  <td className="px-3 py-2.5 mono text-[11px] text-yo-txt-3">#{r.id.slice(0, 8)}</td>
                  <td className="px-3 py-2.5 font-medium text-yo-txt max-w-[280px] truncate">{r.title}</td>
                  <td className="px-3 py-2.5 text-yo-txt-2 max-w-[160px] truncate">{r.counterparty_email ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-yo-txt">{formatMoney(r.amount_cents)}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_STYLE[r.status])}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-yo-txt-3 text-xs">
                    {new Date(r.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      to="/transactions/$id"
                      params={{ id: r.id }}
                      className="inline-flex items-center justify-center size-7 rounded-md text-yo-txt-3 hover:bg-yo-ac-bg hover:text-yo-ac"
                      aria-label="Ver transacción"
                    >
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-yo-txt-3">
        <span>Mostrando {filtered.length} de {rows.length}</span>
        <div className="flex items-center gap-2">
          <span>Por página:</span>
          {[5, 10, 25].map((n) => (
            <button
              key={n}
              onClick={() => setPageSize(n)}
              className={cn("px-2 py-0.5 rounded", pageSize === n ? "bg-yo-txt text-white" : "hover:bg-yo-raised")}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
