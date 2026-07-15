import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, Copy, XCircle, ShieldAlert, FileText } from "lucide-react";
import { StatusBadge, SectorBadge, MoneyDisplay, ProgressBar, ActionMenu, NextActionPill, type ActionItem } from "@/components/tx/ui";
import { toUiStatus } from "@/lib/tx-catalog";
import { txHash } from "@/lib/tx-hash";
import type { ViewRole } from "@/hooks/use-view-role";

export type TxRow = {
  id: string;
  numero: string | null;
  title: string;
  sector: string | null;
  buyer_id: string;
  seller_id: string | null;
  counterparty_email: string | null;
  beneficiario_nombre: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  delivery_deadline: string | null;
  funding_deadline: string | null;
  // computados
  held_cents?: number;
  releasable_cents?: number;
  milestones_total?: number;
  milestones_done?: number;
  next_action?: { label: string; tone: "warn" | "info" | "err" | "ok" } | null;
};

type Props = {
  rows: TxRow[];
  role: ViewRole;
  currentUserId: string;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function TransactionsTable({ rows, role, currentUserId }: Props) {
  const navigate = useNavigate();
  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-yo-raised border-b border-yo-border text-left text-[11px] uppercase tracking-wider text-yo-txt-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">ID</th>
              <th className="px-4 py-2.5 font-medium">Operación</th>
              <th className="px-4 py-2.5 font-medium">Sector</th>
              <th className="px-4 py-2.5 font-medium">{role === "buyer" ? "Vendedor" : "Comprador"}</th>
              <th className="px-4 py-2.5 font-medium text-right">
                {role === "buyer" ? "Retenido" : "Por liberar"}
              </th>
              <th className="px-4 py-2.5 font-medium">Hitos</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium">Pendiente</th>
              <th className="px-4 py-2.5 font-medium">Vence</th>
              <th className="px-4 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isBuyer = r.buyer_id === currentUserId;
              const counterparty = isBuyer
                ? r.beneficiario_nombre ?? r.counterparty_email ?? "—"
                : "Comprador";
              const ui = toUiStatus(r.status);
              const total = r.milestones_total ?? 0;
              const done = r.milestones_done ?? 0;
              const highlightAmount = role === "buyer" ? r.held_cents ?? 0 : r.releasable_cents ?? 0;

              const overdue = r.delivery_deadline && new Date(r.delivery_deadline) < new Date() && ui !== "CLOSED" && ui !== "RELEASED";

              const hash = txHash(r.id);
              const goExpediente = () => navigate({ to: "/transactions/$id/expediente", params: { id: r.id } });

              const items: ActionItem[] = [
                { key: "view", label: "Ver expediente", icon: <Eye className="h-3.5 w-3.5" />, onSelect: goExpediente },
                {
                  key: "copy-hash",
                  label: "Copiar hash",
                  icon: <Copy className="h-3.5 w-3.5" />,
                  onSelect: () => {
                    navigator.clipboard?.writeText(hash);
                    toast.success("Hash copiado", { description: hash });
                  },
                },
                { key: "download", label: "Descargar resumen", icon: <FileText className="h-3.5 w-3.5" /> },
                { key: "duplicate", label: "Duplicar", icon: <Copy className="h-3.5 w-3.5" /> },
                {
                  key: "dispute",
                  label: "Abrir disputa",
                  icon: <ShieldAlert className="h-3.5 w-3.5" />,
                  divider: true,
                  onSelect: () => navigate({
                    to: "/disputes/new",
                    search: { tx: r.numero ?? r.id },
                  }),
                  disabled: !["FUNDED", "IN_PROGRESS", "IN_VERIFICATION", "READY_FOR_APPROVAL", "PARTIALLY_RELEASED"].includes(ui),
                },
                {
                  key: "cancel",
                  label: "Cancelar",
                  icon: <XCircle className="h-3.5 w-3.5" />,
                  tone: "destructive",
                  disabled: !["DRAFT", "INVITED", "ACCEPTED", "PENDING_FUNDING"].includes(ui),
                },
              ];

              return (
                <tr key={r.id} className="border-b border-yo-border last:border-b-0 hover:bg-yo-raised transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to="/transactions/$id/expediente"
                      params={{ id: r.id }}
                      className="tx-id font-mono text-[12px] text-yo-ac hover:underline block"
                    >
                      {r.numero ?? r.id.slice(0, 8).toUpperCase()}
                    </Link>
                    <span className="font-mono text-[10px] text-yo-txt-3 tracking-wider">{hash}</span>
                  </td>
                  <td className="px-4 py-3 max-w-[240px]">
                    <Link to="/transactions/$id/expediente" params={{ id: r.id }} className="font-medium text-yo-txt hover:text-yo-ac line-clamp-1">
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <SectorBadge sector={r.sector} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-yo-txt-2 max-w-[180px] truncate">{counterparty}</td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={highlightAmount / 100} size="sm" showCurrency={false} />
                  </td>
                  <td className="px-4 py-3 min-w-[110px]">
                    {total > 0 ? (
                      <ProgressBar
                        value={done}
                        max={total}
                        right={<span>{done}/{total}</span>}
                        tone={done === total ? "ok" : "accent"}
                      />
                    ) : (
                      <span className="text-[11px] text-yo-txt-3">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    {r.next_action ? (
                      <NextActionPill tone={r.next_action.tone}>{r.next_action.label}</NextActionPill>
                    ) : (
                      <span className="text-[11px] text-yo-txt-3">—</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-xs ${overdue ? "text-[color:var(--yo-err)] font-medium" : "text-yo-txt-2"}`}>
                    {fmtDate(r.delivery_deadline ?? r.funding_deadline)}
                  </td>
                  <td className="px-2 py-3">
                    <ActionMenu items={items} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
