import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Banknote, Copy, Download, ExternalLink, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { PaymentStatusBadge } from "@/components/payments/ui/payment-status-badge";
import { MoneyCell } from "@/components/payments/ui/money-cell";
import { NoCustodyBanner } from "@/components/payments/ui/no-custody-banner";
import { derivePaymentStatus, type UiPaymentStatus } from "@/lib/payments-catalog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payments/$id")({
  head: () => ({ meta: [{ title: "Detalle de pago — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: PaymentDetailPage,
});

type PI = {
  id: string;
  transaction_id: string;
  provider: string | null;
  provider_ref: string | null;
  method: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  clabe: string | null;
  reference_code: string | null;
  created_at: string;
  updated_at: string | null;
  paid_at: string | null;
};

type Tx = {
  id: string;
  numero: string | null;
  title: string | null;
  status: string;
  amount_cents: number;
  currency: string;
  buyer_id: string;
  seller_id: string;
  beneficiario_nombre: string | null;
  counterparty_email: string | null;
  created_at: string;
};

type Payout = {
  id: string;
  transaction_id: string;
  gross_cents: number | null;
  net_cents: number | null;
  status: string;
  created_at: string;
};

type TabId = "resumen" | "movimientos" | "documentos" | "conciliacion" | "auditoria";

function fmtMoney(cents: number, currency = "MXN") {
  return (cents / 100).toLocaleString("es-MX", { style: "currency", currency });
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function PaymentDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [pi, setPi] = useState<PI | null>(null);
  const [tx, setTx] = useState<Tx | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("resumen");
  const [releasing, setReleasing] = useState(false);
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data: piData } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (cancel) return;
      if (!piData) { setLoading(false); return; }
      setPi(piData as PI);
      const [{ data: txData }, { data: poData }] = await Promise.all([
        supabase.from("transactions").select("id,numero,title,status,amount_cents,currency,buyer_id,seller_id,beneficiario_nombre,counterparty_email,created_at").eq("id", piData.transaction_id).maybeSingle(),
        supabase.from("payouts").select("id,transaction_id,gross_cents,net_cents,status,created_at").eq("transaction_id", piData.transaction_id).order("created_at", { ascending: false }),
      ]);
      if (cancel) return;
      setTx(txData as Tx);
      setPayouts((poData ?? []) as Payout[]);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [id]);

  const releasedCents = useMemo(
    () => payouts.filter(p => ["paid","released","confirmed"].includes(p.status)).reduce((s,p) => s + (p.net_cents ?? p.gross_cents ?? 0), 0),
    [payouts],
  );

  const status: UiPaymentStatus | null = useMemo(() => {
    if (!pi || !tx) return null;
    return derivePaymentStatus({
      intentStatus: pi.status,
      txStatus: tx.status,
      amountCents: pi.amount_cents,
      releasedCents,
      refundedCents: 0,
      hasDispute: false,
    });
  }, [pi, tx, releasedCents]);

  const copy = (v: string | null | undefined, label: string) => {
    if (!v) return;
    navigator.clipboard.writeText(v);
    toast.success(`${label} copiado`);
  };

  const simulateRelease = async () => {
    if (!pi || !tx) return;
    setReleasing(true);
    try {
      const remaining = pi.amount_cents - releasedCents;
      if (remaining <= 0) { toast.info("No hay fondos por liberar"); return; }
      const { error } = await supabase.from("payouts").insert({
        transaction_id: tx.id,
        gross_cents: remaining,
        net_cents: remaining,
        status: "released",
        provider: pi.provider ?? "mock",
      });
      if (error) throw error;
      toast.success("Liberación registrada");
      const { data: poData } = await supabase.from("payouts").select("id,transaction_id,gross_cents,net_cents,status,created_at").eq("transaction_id", tx.id).order("created_at", { ascending: false });
      setPayouts((poData ?? []) as Payout[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al liberar");
    } finally {
      setReleasing(false);
    }
  };

  const simulateRefund = async () => {
    if (!pi || !tx) return;
    setRefunding(true);
    try {
      const { error } = await supabase.from("payment_intents").update({ status: "refunded" }).eq("id", pi.id);
      if (error) throw error;
      toast.success("Reembolso registrado");
      setPi({ ...pi, status: "refunded" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al reembolsar");
    } finally {
      setRefunding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-yo-t2">
        <Loader2 className="size-5 animate-spin mr-2" /> Cargando pago…
      </div>
    );
  }
  if (!pi || !tx) {
    return (
      <div className="rounded-xl border border-yo-border bg-yo-card p-10 text-center">
        <p className="text-sm text-yo-t2">Pago no encontrado.</p>
        <button onClick={() => navigate({ to: "/payments" })} className="mt-4 text-yo-ac text-sm hover:underline">Volver al Centro de Pagos</button>
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "movimientos", label: "Movimientos" },
    { id: "documentos", label: "Documentos" },
    { id: "conciliacion", label: "Conciliación" },
    { id: "auditoria", label: "Auditoría" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Banknote}
        title={`Pago ${tx.numero ?? tx.id.slice(0, 8)}`}
        subtitle={tx.title ?? "Detalle del pago procesado por la pasarela."}
        actions={
          <button onClick={() => navigate({ to: "/payments" })} className="inline-flex items-center gap-1.5 px-3 py-2 border border-yo-border text-sm rounded-md text-yo-t2 hover:bg-yo-bg2">
            <ArrowLeft className="size-4" /> Volver
          </button>
        }
      />

      <NoCustodyBanner />

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* 70% */}
        <div className="lg:col-span-7 space-y-4">
          {/* Tabs */}
          <div className="border-b border-yo-border flex gap-1 overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? "border-yo-ac text-yo-t1" : "border-transparent text-yo-t2 hover:text-yo-t1"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "resumen" && (
            <div className="rounded-xl border border-yo-border bg-yo-card p-6 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Monto total" value={<MoneyCell amountCents={pi.amount_cents} currency={pi.currency} />} />
                <Field label="Liberado" value={<span className="font-mono text-yo-t1">{fmtMoney(releasedCents, pi.currency)}</span>} />
                <Field label="Pendiente" value={<span className="font-mono text-yo-t1">{fmtMoney(pi.amount_cents - releasedCents, pi.currency)}</span>} />
                <Field label="Pasarela" value={<span className="text-yo-t1">{pi.provider ?? "—"}</span>} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-yo-border">
                <Field label="Método" value={<span className="text-yo-t1 capitalize">{pi.method ?? "—"}</span>} />
                <Field label="Referencia" value={
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-yo-t1">{pi.reference_code ?? "—"}</span>
                    {pi.reference_code && <button onClick={() => copy(pi.reference_code, "Referencia")} className="text-yo-t2 hover:text-yo-t1"><Copy className="size-3.5" /></button>}
                  </div>
                } />
                <Field label="CLABE virtual" value={
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-yo-t1">{pi.clabe ?? "—"}</span>
                    {pi.clabe && <button onClick={() => copy(pi.clabe, "CLABE")} className="text-yo-t2 hover:text-yo-t1"><Copy className="size-3.5" /></button>}
                  </div>
                } />
                <Field label="Creado" value={<span className="text-yo-t1">{fmtDate(pi.created_at)}</span>} />
                <Field label="Pagado" value={<span className="text-yo-t1">{fmtDate(pi.paid_at)}</span>} />
                <Field label="Actualizado" value={<span className="text-yo-t1">{fmtDate(pi.updated_at)}</span>} />
              </div>
            </div>
          )}

          {tab === "movimientos" && (
            <div className="rounded-xl border border-yo-border bg-yo-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-yo-bg2 text-left text-[11px] uppercase text-yo-t2">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Fecha</th>
                    <th className="px-4 py-2.5 font-semibold">Tipo</th>
                    <th className="px-4 py-2.5 font-semibold">Estado</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-yo-border">
                  <tr>
                    <td className="px-4 py-2.5 text-yo-t2">{fmtDate(pi.created_at)}</td>
                    <td className="px-4 py-2.5 text-yo-t1">Intent de pago</td>
                    <td className="px-4 py-2.5 text-yo-t2 capitalize">{pi.status}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(pi.amount_cents, pi.currency)}</td>
                  </tr>
                  {payouts.map(p => (
                    <tr key={p.id}>
                      <td className="px-4 py-2.5 text-yo-t2">{fmtDate(p.created_at)}</td>
                      <td className="px-4 py-2.5 text-yo-t1">Liberación</td>
                      <td className="px-4 py-2.5 text-yo-t2 capitalize">{p.status}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(p.net_cents ?? p.gross_cents ?? 0, pi.currency)}</td>
                    </tr>
                  ))}
                  {payouts.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-yo-t2 text-sm">Sin liberaciones aún.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "documentos" && (
            <div className="rounded-xl border border-yo-border bg-yo-card p-10 text-center text-sm text-yo-t2">
              Los CFDIs y REPs se muestran en el detalle de la transacción.
              <div className="mt-3">
                <Link to="/transactions/$id" params={{ id: tx.id }} className="text-yo-ac hover:underline inline-flex items-center gap-1">
                  Ir a documentos fiscales <ExternalLink className="size-3.5" />
                </Link>
              </div>
            </div>
          )}

          {tab === "conciliacion" && (
            <div className="rounded-xl border border-yo-border bg-yo-card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yo-t1">Total en pasarela</p>
                  <p className="font-mono text-lg text-yo-t1">{fmtMoney(pi.amount_cents, pi.currency)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-yo-t1">Total liberado + pendiente</p>
                  <p className="font-mono text-lg text-yo-t1">{fmtMoney(releasedCents + (pi.amount_cents - releasedCents), pi.currency)}</p>
                </div>
              </div>
              <div className="border-t border-yo-border pt-3 flex items-center gap-2 text-sm">
                <span className="inline-flex items-center rounded-md bg-emerald-500/10 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">Conciliado</span>
                <span className="text-yo-t2">Los movimientos coinciden con el intent.</span>
              </div>
            </div>
          )}

          {tab === "auditoria" && (
            <div className="rounded-xl border border-yo-border bg-yo-card p-6 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-yo-t2">Payment Intent creado</span><span className="text-yo-t1">{fmtDate(pi.created_at)}</span></div>
              {pi.paid_at && <div className="flex justify-between"><span className="text-yo-t2">Pago confirmado</span><span className="text-yo-t1">{fmtDate(pi.paid_at)}</span></div>}
              {payouts.map(p => (
                <div key={p.id} className="flex justify-between"><span className="text-yo-t2">Liberación ({p.status})</span><span className="text-yo-t1">{fmtDate(p.created_at)}</span></div>
              ))}
            </div>
          )}
        </div>

        {/* 30% */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="rounded-xl border border-yo-border bg-yo-card p-5 space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-yo-t2 font-medium">Estatus</p>
              <div className="mt-1.5">{status && <PaymentStatusBadge status={status} />}</div>
            </div>
            <div className="pt-3 border-t border-yo-border">
              <p className="text-[11px] uppercase tracking-wide text-yo-t2 font-medium">Transacción</p>
              <Link to="/transactions/$id" params={{ id: tx.id }} className="mt-1 flex items-center gap-1 text-sm text-yo-ac hover:underline">
                {tx.numero ?? tx.id.slice(0,8)} <ExternalLink className="size-3.5" />
              </Link>
            </div>
            <div className="pt-3 border-t border-yo-border">
              <p className="text-[11px] uppercase tracking-wide text-yo-t2 font-medium">Contraparte</p>
              <p className="mt-1 text-sm text-yo-t1">{tx.beneficiario_nombre ?? tx.counterparty_email ?? "—"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-yo-border bg-yo-card p-5 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-yo-t2 font-medium mb-1">Acciones</p>
            <button
              onClick={simulateRelease}
              disabled={releasing || pi.amount_cents - releasedCents <= 0}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-yo-ac text-white text-sm font-medium rounded-md hover:bg-yo-ac-h disabled:opacity-40"
            >
              {releasing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Liberar fondos
            </button>
            <button
              onClick={simulateRefund}
              disabled={refunding || pi.status === "refunded"}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 border border-yo-border text-sm font-medium rounded-md text-yo-t2 hover:bg-yo-bg2 disabled:opacity-40"
            >
              {refunding ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
              Reembolsar
            </button>
            <p className="text-[11px] text-yo-t2 pt-1">
              YOKTO no custodia fondos. Todas las operaciones ocurren en la pasarela.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-yo-t2 font-medium">{label}</p>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
