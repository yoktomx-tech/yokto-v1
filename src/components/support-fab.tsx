import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LifeBuoy, X, HelpCircle, MessageSquare, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listHelpArticles } from "@/lib/support.functions";
import { useViewRole } from "@/hooks/use-view-role";
import { useCurrentOrg } from "@/hooks/use-current-org";

export function SupportFAB() {
  const [open, setOpen] = useState(false);
  const { role } = useViewRole();
  const { currentOrg } = useCurrentOrg();
  const isAuditor = currentOrg?.org_role === "auditor";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const moduleHint = pathname.split("/")[1] || null;

  const fn = useServerFn(listHelpArticles);
  const { data: articles } = useQuery({
    queryKey: ["help-suggestions", moduleHint, role],
    queryFn: () => fn({ data: { audience: role } }),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("yokto:open-support-fab", h);
    return () => window.removeEventListener("yokto:open-support-fab", h);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Soporte"
        className="fixed bottom-5 right-5 z-40 size-12 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-lg grid place-items-center transition"
      >
        <LifeBuoy className="size-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <aside className="fixed bottom-5 right-5 z-50 w-[360px] max-h-[80vh] rounded-xl bg-yo-surface border border-yo-border shadow-2xl flex flex-col overflow-hidden">
            <header className="p-4 bg-[#F5F3FF] border-b border-yo-border flex items-start justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#7C3AED] font-semibold">Soporte Cumplex</p>
                <h3 className="text-sm font-semibold text-yo-txt mt-0.5">¿En qué te ayudamos?</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-yo-txt-3 hover:text-yo-txt">
                <X className="size-4" />
              </button>
            </header>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold">Artículos sugeridos</p>
                {(articles ?? []).slice(0, 5).map((a) => (
                  <Link key={a.id} to="/help/$slug" params={{ slug: a.slug }} onClick={() => setOpen(false)}
                    className="block p-2.5 rounded-lg border border-yo-border hover:border-[#7C3AED]/40 hover:bg-[#F5F3FF] transition">
                    <p className="text-[13px] font-medium text-yo-txt">{a.title}</p>
                    {a.summary && <p className="text-[11px] text-yo-txt-3 mt-0.5 line-clamp-2">{a.summary}</p>}
                  </Link>
                ))}
                {!articles?.length && <p className="text-xs text-yo-txt-3">Sin sugerencias por ahora.</p>}
              </div>

              <div className="pt-2 border-t border-yo-border grid gap-2">
                <Link to="/help" onClick={() => setOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-lg text-[13px] font-medium text-yo-txt hover:bg-yo-raised">
                  <HelpCircle className="size-4 text-yo-txt-3" /> Ir al Centro de Ayuda
                </Link>
                <Link to="/support/tickets" onClick={() => setOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-lg text-[13px] font-medium text-yo-txt hover:bg-yo-raised">
                  <MessageSquare className="size-4 text-yo-txt-3" /> Mis tickets
                </Link>
                {!isAuditor && (
                  <Link to="/support/tickets/new" onClick={() => setOpen(false)}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-[#18181B] hover:bg-black text-white text-[13px] font-semibold">
                    <Sparkles className="size-4" /> Crear nuevo ticket
                  </Link>
                )}
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
