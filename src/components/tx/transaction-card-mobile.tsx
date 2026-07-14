import { Link } from "@tanstack/react-router";
import { StatusBadge, SectorBadge, MoneyDisplay, ProgressBar, NextActionPill } from "@/components/tx/ui";
import type { TxRow } from "./transactions-table";
import type { ViewRole } from "@/hooks/use-view-role";

type Props = {
  row: TxRow;
  role: ViewRole;
  currentUserId: string;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

export function TransactionCardMobile({ row: r, role, currentUserId }: Props) {
  const isBuyer = r.buyer_id === currentUserId;
  const counterparty = isBuyer
    ? r.beneficiario_nombre ?? r.counterparty_email ?? "—"
    : "Comprador";
  const total = r.milestones_total ?? 0;
  const done = r.milestones_done ?? 0;
  const highlightAmount = role === "buyer" ? r.held_cents ?? 0 : r.releasable_cents ?? 0;
  const highlightLabel = role === "buyer" ? "Retenido" : "Por liberar";

  return (
    <Link
      to="/transactions/$id"
      params={{ id: r.id }}
      className="surface-card p-4 flex flex-col gap-3 hover:border-yo-border-s transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="tx-id font-mono text-[11px] text-yo-ac">
          {r.numero ?? r.id.slice(0, 8).toUpperCase()}
        </span>
        <StatusBadge status={r.status} size="sm" />
      </div>

      <div>
        <div className="text-sm font-semibold text-yo-txt line-clamp-2">{r.title}</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-yo-txt-2">
          <SectorBadge sector={r.sector} size="sm" showLabel={false} />
          <span className="truncate">{counterparty}</span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-yo-txt-3">{highlightLabel}</div>
          <MoneyDisplay amount={highlightAmount / 100} size="lg" showCurrency={false} />
        </div>
        {total > 0 && (
          <div className="min-w-[110px]">
            <ProgressBar value={done} max={total} right={<span>{done}/{total}</span>} tone={done === total ? "ok" : "accent"} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-yo-border">
        {r.next_action ? (
          <NextActionPill tone={r.next_action.tone}>{r.next_action.label}</NextActionPill>
        ) : (
          <span className="text-yo-txt-3">Sin acciones</span>
        )}
        <span className="text-yo-txt-2">{fmtDate(r.delivery_deadline ?? r.funding_deadline)}</span>
      </div>
    </Link>
  );
}
