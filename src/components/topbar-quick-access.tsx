import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Search, MessageSquare, LifeBuoy, Activity, HelpCircle, Inbox, Building2, User, Clock,
} from "lucide-react";

function formatExpiresIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Vencida";
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `Vence en ${h}h`;
  const d = Math.floor(h / 24);
  return `Vence en ${d}d`;
}
import { getQuickAccessContext, listMyTickets } from "@/lib/support.functions";
import { listMyPendingInvitations } from "@/lib/orgs.functions";
import { useViewRole } from "@/hooks/use-view-role";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  owner: "Propietario",
  buyer_admin: "Admin comprador",
  buyer_user: "Comprador",
  seller_admin: "Admin vendedor",
  seller_user: "Vendedor",
  auditor: "Auditor",
};

export function TopbarQuickAccess() {
  const [open, setOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const { role } = useViewRole();
  const fn = useServerFn(getQuickAccessContext);
  const ticketsFn = useServerFn(listMyTickets);
  const invFn = useServerFn(listMyPendingInvitations);
  const { data } = useQuery({ queryKey: ["qa-context"], queryFn: () => fn(), staleTime: 30_000 });
  const { data: tickets } = useQuery({
    queryKey: ["qa-open-tickets"],
    queryFn: () => ticketsFn(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const { data: invitations } = useQuery({
    queryKey: ["qa-pending-invitations"],
    queryFn: () => invFn(),
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
  const openCount = (tickets ?? []).filter(
    (t: any) => !["resolved", "closed", "cancelled"].includes(String(t.status))
  ).length;
  const sortedInvitations = [...(invitations ?? [])].sort((a: any, b: any) => {
    const now = Date.now();
    const aMs = new Date(a.expires_at).getTime() - now;
    const bMs = new Date(b.expires_at).getTime() - now;
    const aExpired = aMs <= 0;
    const bExpired = bMs <= 0;
    // Expired go last; among non-expired, soonest first; among expired, most recently expired first
    if (aExpired !== bExpired) return aExpired ? 1 : -1;
    return aMs - bMs;
  });
  const invCount = sortedInvitations.length;

  const critical = !!data?.criticalIncident;
  const hasOpenTickets = openCount > 0;

  return (
    <div className="relative flex items-center gap-1">
      {invCount > 0 && (
        <div className="relative">
          <button
            onClick={() => { setInvOpen((o) => !o); setOpen(false); }}
            aria-label="Invitaciones pendientes"
            title="Invitaciones pendientes"
            className="relative size-8 grid place-items-center rounded-md text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised transition"
          >
            <Inbox className="size-4" aria-hidden />
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-yo-err text-white text-[9px] font-bold grid place-items-center">
              {invCount > 9 ? "9+" : invCount}
            </span>
          </button>
          {invOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setInvOpen(false)} />
              <div className="absolute right-0 mt-2 w-[360px] max-h-[70vh] overflow-auto z-50 rounded-xl border border-yo-border bg-yo-surface shadow-xl">
                <div className="p-3 border-b border-yo-border bg-yo-ac-bg">
                  <div className="flex items-center gap-2">
                    <div className="size-8 grid place-items-center rounded-lg bg-yo-ac text-white">
                      <Inbox className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-yo-txt">Invitaciones pendientes</p>
                      <p className="text-[11px] text-yo-txt-3">
                        {invCount} sin responder
                      </p>
                    </div>
                  </div>
                </div>
                <ul className="divide-y divide-yo-border">
                  {sortedInvitations.map((inv: any) => {
                    const Icon = inv.org_type === "individual" ? User : Building2;
                    const expiresLabel = formatExpiresIn(inv.expires_at);
                    const expired = expiresLabel === "Vencida";
                    const roleLabel = ROLE_LABEL[inv.org_role] ?? inv.org_role;
                    const folio = inv.transaction_numero ?? inv.folio ?? "Operación pendiente";
                    const sector = inv.sector ?? inv.org_name;
                    const amount = inv.amount_label ?? null;
                    return (
                      <li key={inv.id} className="p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yo-warn/15 text-yo-warn text-[10px] font-semibold uppercase tracking-wide">
                            <span className="size-1.5 rounded-full bg-yo-warn" />
                            Pendiente de aprobación
                          </span>
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-medium tabular-nums",
                            expired ? "text-yo-err" : "text-yo-txt-3",
                          )}>
                            <Clock className="size-3" />
                            {expiresLabel}
                          </span>
                        </div>
                        <Link
                          to="/invite/$token"
                          params={{ token: inv.token }}
                          onClick={() => setInvOpen(false)}
                          className="block group"
                        >
                          <p className="text-[13px] font-semibold text-yo-txt leading-snug group-hover:text-yo-ac transition">
                            Revisa esta operación antes de fondear / entregar
                          </p>
                        </Link>
                        <p className="mt-1 text-[11px] text-yo-txt-3 tabular-nums truncate">
                          <span className="font-mono font-semibold text-yo-txt-2">{folio}</span>
                          {sector && <> · <span>{sector}</span></>}
                          {amount && <> · <span className="text-yo-txt-2 font-semibold">{amount}</span></>}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-yo-txt-3">
                          <Icon className="size-3.5 text-yo-ac shrink-0" />
                          <span className="truncate">{inv.org_name}</span>
                          <span>·</span>
                          <span className="truncate">Rol invitado: {roleLabel}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 mt-3">
                          <Link
                            to="/invite/$token"
                            params={{ token: inv.token }}
                            onClick={() => setInvOpen(false)}
                            className="h-8 grid place-items-center rounded-md border border-yo-border text-[11px] font-medium text-yo-txt hover:bg-yo-raised transition"
                          >
                            Ver detalle
                          </Link>
                          <Link
                            to="/invitations/$token"
                            params={{ token: inv.token }}
                            search={{ action: "accept" } as any}
                            onClick={() => setInvOpen(false)}
                            className="h-8 grid place-items-center rounded-md bg-yo-ac text-white text-[11px] font-semibold hover:bg-yo-ac/90 transition"
                          >
                            Aceptar operación
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}

        </div>
      )}


      <button
        onClick={() => { setOpen((o) => !o); setInvOpen(false); }}
        aria-label="Centro de ayuda y soporte"
        title="Centro de ayuda y soporte"
        className="relative size-8 grid place-items-center rounded-md text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised transition"
      >
        <HelpCircle className="size-4" />
        {(hasOpenTickets || critical) && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-yo-surface",
            critical ? "bg-yo-err" : "bg-yo-ac",
          )} />
        )}
      </button>

      {invOpen && invCount > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setInvOpen(false)} />
          <div className="absolute right-0 mt-2 w-[360px] max-h-[70vh] overflow-auto z-50 rounded-xl border border-yo-border bg-yo-surface shadow-xl">
            <div className="p-3 border-b border-yo-border bg-yo-ac-bg">
              <div className="flex items-center gap-2">
                <div className="size-8 grid place-items-center rounded-lg bg-yo-ac text-white">
                  <Inbox className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-yo-txt">Invitaciones pendientes</p>
                  <p className="text-[11px] text-yo-txt-3">
                    {invCount} {invCount === 1 ? "sin responder" : "sin responder"}
                  </p>
                </div>
              </div>
            </div>
            <ul className="divide-y divide-yo-border">
              {sortedInvitations.map((inv: any) => {
                const Icon = inv.org_type === "individual" ? User : Building2;
                const expiresLabel = formatExpiresIn(inv.expires_at);
                const expired = expiresLabel === "Vencida";
                const roleLabel = ROLE_LABEL[inv.org_role] ?? inv.org_role;
                const folio = inv.transaction_numero ?? inv.folio ?? "Operación pendiente";
                const sector = inv.sector ?? inv.org_name;
                const amount = inv.amount_label ?? null;
                return (
                  <li key={inv.id} className="p-3">
                    {/* Header row: badge + expiration */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yo-warn/15 text-yo-warn text-[10px] font-semibold uppercase tracking-wide">
                        <span className="size-1.5 rounded-full bg-yo-warn" />
                        Pendiente de aprobación
                      </span>
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-medium tabular-nums",
                        expired ? "text-yo-err" : "text-yo-txt-3",
                      )}>
                        <Clock className="size-3" />
                        {expiresLabel}
                      </span>
                    </div>

                    {/* Title */}
                    <Link
                      to="/invite/$token"
                      params={{ token: inv.token }}
                      onClick={() => setInvOpen(false)}
                      className="block group"
                    >
                      <p className="text-[13px] font-semibold text-yo-txt leading-snug group-hover:text-yo-ac transition">
                        Revisa esta operación antes de fondear / entregar
                      </p>
                    </Link>

                    {/* Operation line: folio · sector · amount */}
                    <p className="mt-1 text-[11px] text-yo-txt-3 tabular-nums truncate">
                      <span className="font-mono font-semibold text-yo-txt-2">{folio}</span>
                      {sector && <> · <span>{sector}</span></>}
                      {amount && <> · <span className="text-yo-txt-2 font-semibold">{amount}</span></>}
                    </p>

                    {/* Context: org + invited role */}
                    <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-yo-txt-3">
                      <Icon className="size-3.5 text-yo-ac shrink-0" />
                      <span className="truncate">{inv.org_name}</span>
                      <span>·</span>
                      <span className="truncate">Rol invitado: {roleLabel}</span>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-1.5 mt-3">
                      <Link
                        to="/invite/$token"
                        params={{ token: inv.token }}
                        onClick={() => setInvOpen(false)}
                        className="h-8 grid place-items-center rounded-md border border-yo-border text-[11px] font-medium text-yo-txt hover:bg-yo-raised transition"
                      >
                        Ver detalle
                      </Link>
                      <Link
                        to="/invitations/$token"
                        params={{ token: inv.token }}
                        search={{ action: "accept" } as any}
                        onClick={() => setInvOpen(false)}
                        className="h-8 grid place-items-center rounded-md bg-yo-ac text-white text-[11px] font-semibold hover:bg-yo-ac/90 transition"
                      >
                        Aceptar operación
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}



      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[340px] z-50 rounded-xl border border-yo-border bg-yo-surface shadow-xl overflow-hidden">
            <div className="p-3 border-b border-yo-border bg-yo-ac-bg">
              <div className="flex items-center gap-2">
                <div className="size-8 grid place-items-center rounded-lg bg-yo-ac text-white">
                  <HelpCircle className="size-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-yo-txt">Centro de ayuda y soporte</p>
                  <p className="text-[11px] text-yo-txt-3">Vista {role === "buyer" ? "Comprador" : "Vendedor"}</p>
                </div>
              </div>
            </div>

            <div className="p-3 border-b border-yo-border">
              <div className="relative">
                <Search className="size-3.5 text-yo-txt-3 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const q = (e.target as HTMLInputElement).value.trim();
                      if (q) window.location.href = `/help?q=${encodeURIComponent(q)}`;
                    }
                  }}
                  placeholder="Buscar en Centro de Ayuda…"
                  className="w-full h-9 pl-8 pr-14 rounded-lg bg-yo-bg border border-yo-border text-sm focus:outline-none focus:ring-2 focus:ring-yo-ac/30"
                />
                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded border border-yo-border text-yo-txt-3 bg-yo-surface">⌘K</kbd>
              </div>
            </div>

            <div className="p-2">
              <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold">Soporte</p>
              <QaItem to="/help" icon={HelpCircle} label="Centro de Ayuda" onClick={() => setOpen(false)} />
              <QaItem to="/support/tickets/new" icon={LifeBuoy} label="Crear ticket" onClick={() => setOpen(false)} />
              <QaItem to="/support/tickets" icon={MessageSquare} label="Mis tickets" onClick={() => setOpen(false)}
                right={openCount > 0 ? (
                  <span className="min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-yo-ac text-white text-[10px] font-semibold tabular-nums">{openCount}</span>
                ) : null} />

              <QaItem to="/support/status" icon={Activity} label="Estado de plataforma" onClick={() => setOpen(false)}
                right={critical ? <span className="size-2 rounded-full bg-yo-err" /> : null} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function QaItem({ to, icon: Icon, label, onClick, right }: {
  to: string; icon: typeof HelpCircle; label: string; onClick?: () => void; right?: React.ReactNode;
}) {
  return (
    <Link to={to} onClick={onClick}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt hover:bg-yo-raised transition">
      <Icon className="size-4 text-yo-txt-3" />
      <span className="flex-1 truncate">{label}</span>
      {right}
    </Link>
  );
}
