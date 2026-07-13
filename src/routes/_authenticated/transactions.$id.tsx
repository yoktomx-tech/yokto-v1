import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { STATUS_LABEL, STATUS_ACCENT, formatMoney, commissionAmount, type TxStatus } from "@/lib/tx";
import {
  createFundingIntent,
  simulateFundingReceived,
  releaseFunds,
} from "@/lib/payments.functions";
import { openDispute } from "@/lib/disputes.functions";

type Tx = {
  id: string;
  buyer_id: string;
  seller_id: string | null;
  counterparty_email: string | null;
  title: string;
  description: string | null;
  sector: string | null;
  amount_cents: number;
  currency: string;
  payment_method: "spei" | "card";
  commission_bps: number;
  commission_payer: "buyer" | "seller" | "split";
  status: TxStatus;
  funding_deadline: string | null;
  delivery_deadline: string | null;
  funded_at: string | null;
  released_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};
type Cond = { id: string; description: string; status: "pending" | "met" | "rejected"; met_at: string | null; position: number };
type Evt = { id: string; event_type: string; metadata: unknown; created_at: string; actor_id: string | null };
type PaymentIntent = {
  id: string;
  provider: string;
  provider_ref: string | null;
  method: "spei" | "card";
  status: string;
  clabe: string | null;
  reference_code: string | null;
  expires_at: string | null;
  paid_at: string | null;
  metadata: { hosted_url?: string | null; beneficiary?: string | null; bank?: string | null } | null;
};
type Payout = {
  id: string;
  provider_ref: string | null;
  gross_cents: number;
  commission_cents: number;
  net_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
};

export const Route = createFileRoute("/_authenticated/transactions/$id")({
  head: () => ({ meta: [{ title: "Transacción — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: TxDetail,
});

function TxDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [tx, setTx] = useState<Tx | null>(null);
  const [conds, setConds] = useState<Cond[]>([]);
  const [events, setEvents] = useState<Evt[]>([]);
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState<"not_delivered" | "not_as_described" | "quality" | "delay" | "fraud" | "other">("not_delivered");
  const [disputeDesc, setDisputeDesc] = useState("");

  const createIntentFn = useServerFn(createFundingIntent);
  const simulateFundingFn = useServerFn(simulateFundingReceived);
  const releaseFundsFn = useServerFn(releaseFunds);
  const openDisputeFn = useServerFn(openDispute);

  async function load() {
    const [{ data: t }, { data: c }, { data: e }, { data: pi }, { data: po }] = await Promise.all([
      supabase.from("transactions").select("*").eq("id", id).maybeSingle(),
      supabase.from("transaction_conditions").select("*").eq("transaction_id", id).order("position"),
      supabase.from("transaction_events").select("*").eq("transaction_id", id).order("created_at", { ascending: false }),
      supabase.from("payment_intents").select("*").eq("transaction_id", id).order("created_at", { ascending: false }),
      supabase.from("payouts").select("*").eq("transaction_id", id).order("created_at", { ascending: false }),
    ]);
    setTx((t as Tx) ?? null);
    setConds((c ?? []) as Cond[]);
    setEvents((e ?? []) as Evt[]);
    setIntents((pi ?? []) as PaymentIntent[]);
    setPayouts((po ?? []) as Payout[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function logEvent(event_type: string, metadata: Record<string, unknown> = {}) {
    await supabase.from("transaction_events").insert({ transaction_id: id, actor_id: user.id, event_type, metadata: metadata as never });
  }

  async function updateStatus(status: TxStatus, extra: Partial<Tx> = {}) {
    setBusy(true); setError(null);
    const { error: err } = await supabase.from("transactions").update({ status, ...extra }).eq("id", id);
    if (err) setError(err.message); else await logEvent(`transaction.${status}`);
    await load();
    setBusy(false);
  }

  async function toggleCondition(cond: Cond) {
    setBusy(true);
    const next = cond.status === "met" ? "pending" : "met";
    await supabase
      .from("transaction_conditions")
      .update({ status: next, met_at: next === "met" ? new Date().toISOString() : null, verified_by: next === "met" ? user.id : null })
      .eq("id", cond.id);
    await logEvent(next === "met" ? "condition.met" : "condition.reopened", { condition_id: cond.id });
    await load();
    setBusy(false);
  }

  async function handleCreateIntent(method: "spei" | "card") {
    setBusy(true); setError(null);
    try {
      await createIntentFn({ data: { transactionId: id, method } });
      await load();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function handleSimulateFunding(piId: string) {
    setBusy(true); setError(null);
    try {
      await simulateFundingFn({ data: { paymentIntentId: piId } });
      await load();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function handleRelease() {
    setBusy(true); setError(null);
    try {
      await releaseFundsFn({ data: { transactionId: id } });
      await load();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <AppHeader email={user.email} section="Transacción" />
        <div className="container-editorial py-16 text-sm text-muted-foreground">Cargando…</div>
      </div>
    );
  }
  if (!tx) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <AppHeader email={user.email} section="Transacción" />
        <div className="container-editorial py-16">
          <h1 className="font-display text-4xl">Transacción no encontrada</h1>
          <Link to="/transactions" className="mt-4 inline-block underline underline-offset-4">Volver</Link>
        </div>
      </div>
    );
  }

  const isBuyer = tx.buyer_id === user.id;
  const isSeller = tx.seller_id === user.id;
  const commission = commissionAmount(tx.amount_cents, tx.commission_bps);
  const allMet = conds.length > 0 && conds.every((c) => c.status === "met");
  const activeIntent = intents.find((i) => i.status === "requires_payment" || i.status === "processing");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader email={user.email} section="Transacción" />
      <main className="flex-1">
        <div className="container-editorial py-10 max-w-5xl">
          <div className="flex items-center justify-between gap-4 mb-6">
            <Link to="/transactions" className="text-[11px] uppercase tracking-[0.14em] font-semibold underline underline-offset-4">← Todas las transacciones</Link>
            <span className={`inline-block px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] border ${STATUS_ACCENT[tx.status]}`}>
              {STATUS_LABEL[tx.status]}
            </span>
          </div>

          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{tx.sector ?? "Operación"}</p>
          <h1 className="mt-1 font-display text-5xl tracking-wide text-foreground">{tx.title}</h1>
          {tx.description && <p className="mt-3 text-muted-foreground max-w-2xl">{tx.description}</p>}

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Cell label="Monto retenido" value={formatMoney(tx.amount_cents, tx.currency)} big />
            <Cell label={`Comisión YOKTO (${(tx.commission_bps / 100).toFixed(2)}%)`} value={formatMoney(commission, tx.currency)} />
            <Cell label="Método de fondeo" value={tx.payment_method.toUpperCase()} />
            <Cell label="Rol" value={isBuyer ? "Comprador" : isSeller ? "Vendedor" : "Observador"} />
            <Cell label="Contraparte" value={isBuyer ? tx.counterparty_email ?? "—" : "Comprador"} />
            <Cell label="Fecha límite entrega" value={tx.delivery_deadline ? new Date(tx.delivery_deadline).toLocaleString("es-MX") : "—"} />
          </div>

          {error && (
            <div role="alert" className="mt-6 border border-[#FF3B3B] bg-[#FF3B3B]/10 text-[#FF3B3B] p-3 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 border border-yokto-black bg-yokto-cream/40 p-5 flex flex-wrap gap-3">
            {tx.status === "draft" && isBuyer && (
              <>
                <button disabled={busy} onClick={() => updateStatus("awaiting_funding")} className={btnPrimary}>Publicar y solicitar fondeo</button>
                <button disabled={busy} onClick={() => updateStatus("cancelled", { cancelled_at: new Date().toISOString() })} className={btnGhost}>Cancelar borrador</button>
              </>
            )}
            {tx.status === "awaiting_funding" && isBuyer && !activeIntent && (
              <>
                <button disabled={busy} onClick={() => handleCreateIntent("spei")} className={btnPrimary}>Generar CLABE SPEI</button>
                <button disabled={busy} onClick={() => handleCreateIntent("card")} className={btnGhost}>Pagar con tarjeta (mock)</button>
                <button disabled={busy} onClick={() => updateStatus("cancelled", { cancelled_at: new Date().toISOString() })} className={btnGhost}>Cancelar</button>
              </>
            )}
            {tx.status === "funded" && (
              <button disabled={busy} onClick={() => updateStatus("in_progress")} className={btnPrimary}>Iniciar operación</button>
            )}
            {(tx.status === "in_progress" || tx.status === "conditions_met") && (
              <>
                {allMet && tx.status !== "conditions_met" && (
                  <button disabled={busy} onClick={() => updateStatus("conditions_met")} className={btnPrimary}>Marcar condiciones cumplidas</button>
                )}
                {isBuyer && tx.status === "conditions_met" && (
                  <button disabled={busy} onClick={handleRelease} className={btnPrimary}>
                    Liberar fondos al vendedor
                  </button>
                )}
                <button disabled={busy} onClick={() => setDisputeOpen(true)} className={btnDanger}>Abrir disputa</button>
              </>
            )}
            {tx.status === "disputed" && (
              <Link to="/disputes" className={btnGhost}>Ir a la disputa</Link>
            )}
          </div>

          {/* Funding panel */}
          {activeIntent && (
            <section className="mt-10">
              <h2 className="font-display text-3xl tracking-wide">Instrucciones de fondeo</h2>
              <div className="mt-4 border border-yokto-black bg-background p-5 space-y-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-[11px] uppercase tracking-[0.14em] bg-yokto-yellow border border-yokto-black px-2 py-1">{activeIntent.method.toUpperCase()}</span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Proveedor: {activeIntent.provider}</span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Ref: {activeIntent.provider_ref}</span>
                </div>
                {activeIntent.method === "spei" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Cell label="CLABE" value={activeIntent.clabe ?? "—"} />
                    <Cell label="Referencia" value={activeIntent.reference_code ?? "—"} />
                    <Cell label="Beneficiario" value={activeIntent.metadata?.beneficiary ?? "YOKTO"} />
                    <Cell label="Banco" value={activeIntent.metadata?.bank ?? "STP"} />
                    <Cell label="Monto" value={formatMoney(tx.amount_cents, tx.currency)} />
                    <Cell label="Expira" value={activeIntent.expires_at ? new Date(activeIntent.expires_at).toLocaleString("es-MX") : "—"} />
                  </div>
                )}
                {activeIntent.method === "card" && (
                  <p className="text-sm text-muted-foreground">Checkout simulado — cuando se conecte Stripe, aquí se abrirá el hosted checkout.</p>
                )}
                {isBuyer && (
                  <div className="flex gap-2 pt-2">
                    <button disabled={busy} onClick={() => handleSimulateFunding(activeIntent.id)} className={btnPrimary}>
                      Simular fondeo recibido
                    </button>
                  </div>
                )}
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Modo simulación. Los datos son ficticios y no procesan transferencias reales.
                </p>
              </div>
            </section>
          )}

          {/* Payouts */}
          {payouts.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-3xl tracking-wide">Liberación de fondos</h2>
              <div className="mt-4 border border-yokto-black bg-background divide-y divide-yokto-black/20">
                {payouts.map((p) => (
                  <div key={p.id} className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div><p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Bruto</p><p>{formatMoney(p.gross_cents, p.currency)}</p></div>
                    <div><p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Comisión</p><p>{formatMoney(p.commission_cents, p.currency)}</p></div>
                    <div><p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Neto</p><p className="font-semibold">{formatMoney(p.net_cents, p.currency)}</p></div>
                    <div><p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Estado</p><p>{p.status}</p></div>
                    <div><p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Ref</p><p className="font-mono text-[11px]">{p.provider_ref}</p></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Conditions */}
          <section className="mt-10">
            <h2 className="font-display text-3xl tracking-wide">Condiciones de liberación</h2>
            <div className="mt-4 border border-yokto-black bg-background divide-y divide-yokto-black/20">
              {conds.length === 0 && <p className="p-5 text-sm text-muted-foreground">Sin condiciones registradas.</p>}
              {conds.map((c) => (
                <div key={c.id} className="p-4 flex items-start gap-4">
                  <button
                    disabled={busy || !(isBuyer || isSeller) || tx.status === "released" || tx.status === "cancelled" || tx.status === "refunded"}
                    onClick={() => toggleCondition(c)}
                    className={`mt-0.5 size-6 border border-yokto-black grid place-items-center ${c.status === "met" ? "bg-yokto-yellow" : "bg-background"} disabled:opacity-50`}
                    aria-label="Marcar condición"
                  >
                    {c.status === "met" && <span className="font-mono text-sm">✓</span>}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm ${c.status === "met" ? "text-muted-foreground line-through" : "text-foreground"}`}>{c.description}</p>
                    {c.met_at && <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Cumplida · {new Date(c.met_at).toLocaleString("es-MX")}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Timeline */}
          <section className="mt-10">
            <h2 className="font-display text-3xl tracking-wide">Bitácora</h2>
            <div className="mt-4 border border-yokto-black bg-background">
              {events.length === 0 && <p className="p-5 text-sm text-muted-foreground">Sin eventos.</p>}
              <ul className="divide-y divide-yokto-black/20">
                {events.map((e) => (
                  <li key={e.id} className="p-4 flex justify-between gap-4 text-sm">
                    <span className="font-mono text-foreground">{e.event_type}</span>
                    <span className="text-muted-foreground text-[11px] uppercase tracking-[0.14em]">
                      {new Date(e.created_at).toLocaleString("es-MX")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

const btnPrimary = "px-5 py-2.5 bg-yokto-yellow text-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black hover:bg-yokto-black hover:text-yokto-yellow disabled:opacity-50";
const btnGhost = "px-5 py-2.5 border border-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-yokto-black hover:text-yokto-cream disabled:opacity-50";
const btnDanger = "px-5 py-2.5 border border-[#FF3B3B] text-[#FF3B3B] text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-[#FF3B3B] hover:text-yokto-cream disabled:opacity-50";

function Cell({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="border border-yokto-black p-4 bg-background">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display tracking-wide text-foreground break-all ${big ? "text-3xl" : "text-xl"}`}>{value}</p>
    </div>
  );
}
