import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { listMediatorDisputes, isCurrentUserMediator } from "@/lib/mediation.functions";
import { formatMoney } from "@/lib/tx";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/admin/disputes")({
  head: () => ({ meta: [{ title: "Panel de disputas — YOKTO" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    try {
      const r = await isCurrentUserMediator();
      if (!r.allowed) throw redirect({ to: "/dashboard" });
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminDisputesList,
});

type Row = Awaited<ReturnType<typeof listMediatorDisputes>>[number];

const STATUS_ES: Record<string, string> = {
  pending_deposit: "Pendiente depósito",
  open: "Abierta",
  awaiting_response: "Esperando contraparte",
  in_review: "En revisión",
  in_mediation: "En mediación",
  resolved: "Resuelta",
  escalated: "Escalada",
  withdrawn: "Retirada",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

const STATUS_TONE: Record<string, string> = {
  pending_deposit: "bg-amber-50 text-amber-800 border-amber-200",
  open: "bg-red-50 text-red-800 border-red-200",
  awaiting_response: "bg-red-50 text-red-800 border-red-200",
  in_review: "bg-blue-50 text-blue-800 border-blue-200",
  in_mediation: "bg-indigo-50 text-indigo-800 border-indigo-200",
  resolved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  escalated: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
  withdrawn: "bg-slate-100 text-slate-700 border-slate-200",
  closed: "bg-slate-100 text-slate-700 border-slate-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

function AdminDisputesList() {
  const { user } = Route.useRouteContext();
  const listFn = useServerFn(listMediatorDisputes);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("open_group");
  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const status =
          statusFilter === "open_group" || statusFilter === "all" ? undefined : statusFilter;
        const data = await listFn({ data: { status, assignedToMe: onlyMine } });
        setRows(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [listFn, statusFilter, onlyMine]);

  const filtered = useMemo(() => {
    if (statusFilter !== "open_group") return rows;
    const open = new Set(["open", "awaiting_response", "in_review", "in_mediation", "escalated"]);
    return rows.filter((r) => open.has(r.status));
  }, [rows, statusFilter]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={AlertTriangle}
        title="Panel de disputas"
        subtitle="Mediación, resolución y escalado. Solo mediadores y administradores."
        actions={
          <Link to="/admin" className="text-sm text-yo-txt-3 hover:text-yo-txt underline">
            ← Panel general
          </Link>
        }
      />

        <div className="flex items-center gap-2 flex-wrap">
          {[
            ["open_group", "Activas"],
            ["awaiting_response", "Esperando contraparte"],
            ["in_review", "En revisión"],
            ["in_mediation", "En mediación"],
            ["escalated", "Escaladas"],
            ["resolved", "Resueltas"],
            ["all", "Todas"],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setStatusFilter(k)}
              className={`h-8 px-3 rounded-full text-xs font-medium border ${
                statusFilter === k
                  ? "bg-yo-txt text-yo-surface border-yo-txt"
                  : "bg-yo-surface text-yo-txt border-yo-border hover:bg-background"
              }`}
            >
              {label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-yo-txt-3">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              className="accent-yo-ac"
            />
            Solo asignadas a mí
          </label>
        </div>

        <div className="rounded-lg border border-yo-border bg-yo-surface overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-background/50">
              <tr>
                {["Número", "Transacción", "Motivo", "Monto", "Estado", "Vence", ""].map((h) => (
                  <th
                    key={h}
                    className="p-3 text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-sm text-yo-txt-3">
                    Cargando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-sm text-yo-txt-3">
                    Sin disputas en este filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const tx = (d as unknown as { transactions: { numero: string; title: string; amount_cents: number; currency: string } | null }).transactions;
                  const due = d.resolution_due_at ?? d.evidence_due_at ?? d.counterparty_response_due_at;
                  return (
                    <tr key={d.id} className="border-t border-yo-border hover:bg-background/40">
                      <td className="p-3 text-xs font-mono text-yo-txt">{d.numero ?? d.id.slice(0, 8)}</td>
                      <td className="p-3 text-sm">
                        <div className="text-yo-txt truncate max-w-[240px]">{tx?.title ?? "—"}</div>
                        <div className="text-[11px] text-yo-txt-3 font-mono">{tx?.numero ?? ""}</div>
                      </td>
                      <td className="p-3 text-xs text-yo-txt">{d.reason_code}</td>
                      <td className="p-3 text-xs text-yo-txt">
                        {formatMoney(d.amount_disputed_cents ?? tx?.amount_cents ?? 0, tx?.currency ?? "MXN")}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center h-6 px-2 rounded-full border text-[11px] font-medium ${
                            STATUS_TONE[d.status] ?? "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {STATUS_ES[d.status] ?? d.status}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-yo-txt-3">
                        {due ? new Date(due).toLocaleDateString("es-MX") : "—"}
                      </td>
                      <td className="p-3 text-xs text-right">
                        <Link
                          to="/admin/disputes/$id"
                          params={{ id: d.id }}
                          className="inline-flex items-center h-8 px-3 rounded-md bg-yo-txt text-yo-surface font-medium hover:opacity-90"
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
}
