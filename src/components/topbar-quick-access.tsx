import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Search, MessageSquare, LifeBuoy, Activity, HelpCircle,
} from "lucide-react";
import { getQuickAccessContext } from "@/lib/support.functions";
import { useViewRole } from "@/hooks/use-view-role";
import { cn } from "@/lib/utils";

export function TopbarQuickAccess() {
  const [open, setOpen] = useState(false);
  const { role } = useViewRole();
  const fn = useServerFn(getQuickAccessContext);
  const { data } = useQuery({ queryKey: ["qa-context"], queryFn: () => fn(), staleTime: 30_000 });

  const critical = !!data?.criticalIncident;
  const hasOpenTickets = !!data?.openTickets;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Centro de ayuda y soporte"
        title="Centro de ayuda y soporte"
        className="relative size-8 grid place-items-center rounded-md text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised transition"
      >
        <HelpCircle className="size-4" />
        {(hasOpenTickets || critical) && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-yo-surface",
            critical ? "bg-yo-err" : "bg-[#7C3AED]",
          )} />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[340px] z-50 rounded-xl border border-yo-border bg-yo-surface shadow-xl overflow-hidden">
            <div className="p-3 border-b border-yo-border bg-[#F5F3FF]">
              <div className="flex items-center gap-2">
                <div className="size-8 grid place-items-center rounded-lg bg-[#7C3AED] text-white">
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
                  className="w-full h-9 pl-8 pr-14 rounded-lg bg-yo-bg border border-yo-border text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
                />
                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded border border-yo-border text-yo-txt-3 bg-yo-surface">⌘K</kbd>
              </div>
            </div>

            <div className="p-2">
              <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold">Soporte</p>
              <QaItem to="/help" icon={HelpCircle} label="Centro de Ayuda" onClick={() => setOpen(false)} />
              <QaItem to="/support/tickets/new" icon={LifeBuoy} label="Crear ticket" onClick={() => setOpen(false)} />
              <QaItem to="/support/tickets" icon={MessageSquare} label="Mis tickets" onClick={() => setOpen(false)} />
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
