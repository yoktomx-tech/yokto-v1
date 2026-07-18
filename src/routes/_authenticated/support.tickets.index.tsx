import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { LifeBuoy, Plus } from "lucide-react";
import { listMyTickets } from "@/lib/support.functions";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/hooks/use-current-org";

export const Route = createFileRoute("/_authenticated/support/tickets/")({
  component: TicketsIndex,
});

const STATUS_LABEL: Record<string, string> = {
  open: "Abierto", pending_user: "Espera respuesta", in_progress: "En proceso",
  escalated: "Escalado", resolved: "Resuelto", closed: "Cerrado", reopened: "Reabierto",
};
const PRIO_CLS: Record<string, string> = {
  urgent: "bg-red-50 text-red-700", high: "bg-amber-50 text-amber-700",
  normal: "bg-slate-50 text-slate-700", low: "bg-slate-50 text-slate-500",
};

function TicketsIndex() {
  const fn = useServerFn(listMyTickets);
  const { data } = useQuery({ queryKey: ["my-tickets"], queryFn: () => fn(), staleTime: 15_000 });
  const { currentOrg } = useCurrentOrg();
  const isAuditor = currentOrg?.org_role === "auditor";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LifeBuoy}
        title="Mis tickets"
        subtitle="Tickets de soporte que has abierto o que ves como administrador."
        actions={!isAuditor && (
          <Link to="/support/tickets/new"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#18181B] text-white text-sm font-semibold hover:bg-black">
            <Plus className="size-4" /> Nuevo ticket
          </Link>
        )}
      />

      <div className="rounded-xl border border-yo-border bg-yo-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-yo-bg text-[11px] uppercase tracking-wider text-yo-txt-3">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Número</th>
              <th className="text-left px-4 py-2 font-medium">Asunto</th>
              <th className="text-left px-4 py-2 font-medium">Módulo</th>
              <th className="text-left px-4 py-2 font-medium">Prioridad</th>
              <th className="text-left px-4 py-2 font-medium">Estado</th>
              <th className="text-left px-4 py-2 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-yo-border">
            {(data ?? []).map((t) => (
              <tr key={t.id} className="hover:bg-yo-raised/40">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link to="/support/tickets/$id" params={{ id: t.id }} className="text-[#7C3AED] hover:underline">{t.numero}</Link>
                </td>
                <td className="px-4 py-2">{t.subject}</td>
                <td className="px-4 py-2 text-yo-txt-3">{t.module ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${PRIO_CLS[t.priority] ?? "bg-slate-50 text-slate-700"}`}>{t.priority}</span>
                </td>
                <td className="px-4 py-2 text-yo-txt-2">{STATUS_LABEL[t.status] ?? t.status}</td>
                <td className="px-4 py-2 text-xs text-yo-txt-3 font-mono">{new Date(t.created_at).toLocaleDateString("es-MX")}</td>
              </tr>
            ))}
            {!data?.length && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-yo-txt-3">Aún no tienes tickets.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
