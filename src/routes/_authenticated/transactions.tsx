import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { STATUS_LABEL, STATUS_ACCENT, formatMoney, type TxStatus } from "@/lib/tx";

type Row = {
  id: string;
  title: string;
  amount_cents: number;
  currency: string;
  status: TxStatus;
  buyer_id: string;
  seller_id: string | null;
  counterparty_email: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transacciones — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: TransactionsList,
});

function TransactionsList() {
  const { user } = Route.useRouteContext();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "as_buyer" | "as_seller">("all");
  const [kycOk, setKycOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data }, { data: prof }] = await Promise.all([
        supabase
          .from("transactions")
          .select("id,title,amount_cents,currency,status,buyer_id,seller_id,counterparty_email,created_at")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("kyc_status").eq("id", user.id).maybeSingle(),
      ]);
      setRows((data ?? []) as Row[]);
      setKycOk(prof?.kyc_status === "approved");
      setLoading(false);
    })();
  }, [user.id]);

  const filtered = rows.filter((r) => {
    if (filter === "as_buyer") return r.buyer_id === user.id;
    if (filter === "as_seller") return r.seller_id === user.id;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader email={user.email} section="Transacciones" />
      <main className="flex-1">
        <div className="container-editorial py-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Módulo B</p>
              <h1 className="mt-1 font-display text-5xl tracking-wide text-foreground">Transacciones</h1>
              <p className="mt-2 text-sm text-muted-foreground max-w-xl">
                Historial de operaciones de pago contra cumplimiento en las que participas como comprador o vendedor.
              </p>
            </div>
            <div className="flex gap-3">
              {kycOk ? (
                <Link
                  to="/transactions/new"
                  className="inline-flex items-center px-5 py-2.5 bg-yokto-yellow text-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black hover:bg-yokto-black hover:text-yokto-yellow"
                >
                  Nueva transacción
                </Link>
              ) : (
                <Link
                  to="/kyc"
                  className="inline-flex items-center px-5 py-2.5 border border-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-yokto-black hover:text-yokto-cream"
                >
                  Completar KYC para operar
                </Link>
              )}
            </div>
          </div>

          <div className="mt-8 flex gap-2 text-[11px] uppercase tracking-[0.14em] font-semibold">
            {(["all", "as_buyer", "as_seller"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 border border-yokto-black ${
                  filter === f ? "bg-yokto-black text-yokto-cream" : "bg-background hover:bg-yokto-cream"
                }`}
              >
                {f === "all" ? "Todas" : f === "as_buyer" ? "Como comprador" : "Como vendedor"}
              </button>
            ))}
          </div>

          <div className="mt-6 border border-yokto-black bg-background">
            {loading ? (
              <div className="p-8 text-sm text-muted-foreground">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-display text-3xl text-foreground">Sin transacciones</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Aún no has creado ni participado en una operación YOKTO.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-yokto-cream border-b border-yokto-black text-left text-[11px] uppercase tracking-[0.14em]">
                  <tr>
                    <th className="px-4 py-3">Título</th>
                    <th className="px-4 py-3">Contraparte</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-yokto-black/20 hover:bg-yokto-cream/40">
                      <td className="px-4 py-3 font-medium text-foreground">{r.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.buyer_id === user.id
                          ? r.counterparty_email ?? "—"
                          : "Comprador"}
                      </td>
                      <td className="px-4 py-3 text-[11px] uppercase tracking-[0.14em]">
                        {r.buyer_id === user.id ? "Comprador" : "Vendedor"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(r.amount_cents, r.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 text-[10px] uppercase tracking-[0.14em] border ${STATUS_ACCENT[r.status]}`}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to="/transactions/$id"
                          params={{ id: r.id }}
                          className="text-[11px] uppercase tracking-[0.14em] font-semibold underline underline-offset-4"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
