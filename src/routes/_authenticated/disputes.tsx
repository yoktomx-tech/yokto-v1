import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/tx";

type Row = {
  id: string;
  transaction_id: string;
  reason_code: string;
  status: string;
  amount_disputed_cents: number;
  created_at: string;
  resolved_at: string | null;
  transactions: { title: string; currency: string; buyer_id: string; seller_id: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Abierta",
  in_mediation: "En mediación",
  resolved: "Resuelta",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

const REASON_LABEL: Record<string, string> = {
  not_delivered: "No entregado",
  not_as_described: "No como se describió",
  quality: "Calidad",
  delay: "Retraso",
  fraud: "Fraude",
  other: "Otro",
};

export const Route = createFileRoute("/_authenticated/disputes")({
  head: () => ({ meta: [{ title: "Disputas — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: DisputesList,
});

function DisputesList() {
  const { user } = Route.useRouteContext();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("disputes")
        .select("id, transaction_id, reason_code, status, amount_disputed_cents, created_at, resolved_at, transactions:transaction_id(title, currency, buyer_id, seller_id)")
        .order("created_at", { ascending: false });
      setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1">
        <div className="container-editorial py-10">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Módulo G</p>
          <h1 className="mt-1 font-display text-5xl tracking-wide">Disputas</h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">Canal formal cuando una transacción no puede resolverse entre las partes. Mediación por YOKTO con evidencia documentada.</p>

          <div className="mt-8 border border-yo-border bg-background">
            {loading && <p className="p-6 text-sm text-muted-foreground">Cargando…</p>}
            {!loading && rows.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">No tienes disputas abiertas.</p>
            )}
            <ul className="divide-y divide-yokto-black/20">
              {rows.map((r) => {
                const role = r.transactions?.buyer_id === user.id ? "Comprador" : r.transactions?.seller_id === user.id ? "Vendedor" : "Mediador";
                return (
                  <li key={r.id}>
                    <Link to="/disputes/$id" params={{ id: r.id }} className="block p-5 hover:bg-yo-bg/40">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{REASON_LABEL[r.reason_code]} · {role}</p>
                          <h3 className="mt-1 font-display text-2xl tracking-wide truncate">{r.transactions?.title ?? "Transacción"}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("es-MX")}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-block px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] border border-yo-border ${r.status === "resolved" ? "bg-yokto-yellow" : r.status === "open" ? "bg-[#FF3B3B] text-yokto-cream" : "bg-background"}`}>
                            {STATUS_LABEL[r.status]}
                          </span>
                          <p className="mt-2 font-mono text-sm">{formatMoney(r.amount_disputed_cents, r.transactions?.currency ?? "MXN")}</p>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
