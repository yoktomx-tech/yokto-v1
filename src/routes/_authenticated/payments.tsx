import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import {
  ensureConnectedAccount,
  simulateAccountVerified,
  listPaymentMovements,
  getPaymentsSummary,
  refundTransaction,
  getOnboardingLink,
} from "@/lib/payments.functions";
import { FundsRetentionWidget } from "@/components/payments/funds-retention-widget";
import { StripeConnectOnboarding } from "@/components/payments/stripe-connect-onboarding";
import { PaymentHistory } from "@/components/payments/payment-history";
import { RefundDialog } from "@/components/payments/refund-dialog";

type Acct = {
  provider: string;
  provider_account_id: string | null;
  status: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requirements: { onboarding_url?: string | null } | null;
};

type Movement = Awaited<ReturnType<typeof listPaymentMovements>>[number];
type Summary = Awaited<ReturnType<typeof getPaymentsSummary>>;

type RefundableTx = { id: string; numero: string; amount_cents: number; currency: string; status: string };

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Pagos — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { user } = Route.useRouteContext();
  const [acct, setAcct] = useState<Acct | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [refundable, setRefundable] = useState<RefundableTx[]>([]);
  const [filter, setFilter] = useState<"all" | Movement["kind"]>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refundTx, setRefundTx] = useState<RefundableTx | null>(null);

  const ensureFn = useServerFn(ensureConnectedAccount);
  const verifyFn = useServerFn(simulateAccountVerified);
  const listFn = useServerFn(listPaymentMovements);
  const sumFn = useServerFn(getPaymentsSummary);
  const refundFn = useServerFn(refundTransaction);
  const onboardingFn = useServerFn(getOnboardingLink);

  const load = useCallback(async () => {
    const [{ data: a }, m, s, { data: r }] = await Promise.all([
      supabase.from("connected_accounts").select("*").eq("user_id", user.id).maybeSingle(),
      listFn(),
      sumFn(),
      supabase
        .from("transactions")
        .select("id, numero, amount_cents, currency, status")
        .eq("buyer_id", user.id)
        .in("status", ["funded", "in_progress", "en_verificacion", "conditions_met", "disputed"]),
    ]);
    setAcct((a as Acct) ?? null);
    setMovements(m);
    setSummary(s);
    setRefundable((r as RefundableTx[]) ?? []);
  }, [user.id, listFn, sumFn]);

  useEffect(() => { load().catch((e) => setError((e as Error).message)); }, [load]);

  async function handleCreate() {
    setBusy(true); setError(null);
    try { await ensureFn(); await load(); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }
  async function handleVerify() {
    setBusy(true); setError(null);
    try { await verifyFn(); await load(); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }
  async function handleOnboarding() {
    setBusy(true); setError(null);
    try {
      const { url } = await onboardingFn();
      window.open(url, "_blank", "noreferrer");
      await load();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }
  async function handleRefund(reason: string, percentage: number) {
    if (!refundTx) return;
    await refundFn({ data: { transactionId: refundTx.id, reason, percentage } });
    await load();
  }

  function exportCSV() {
    const rows = [
      ["Fecha", "Tipo", "Descripción", "Transacción", "Monto (MXN)", "Estado", "Referencia"],
      ...movements.map((m) => [
        new Date(m.created_at).toISOString(),
        m.kind,
        m.description,
        m.transaction_numero ?? "",
        (m.amount_cents / 100).toFixed(2),
        m.status,
        m.provider_ref ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos-yokto-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stripeReal = acct?.provider === "stripe";
  const filtered = filter === "all" ? movements : movements.filter((m) => m.kind === filter);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader email={user.email} userId={user.id} section="Pagos" />
      <main className="flex-1">
        <div className="container-editorial py-10 max-w-6xl space-y-8">
          <header>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Módulo D · Escrow · Stripe Connect</p>
            <h1 className="mt-1 font-display text-5xl tracking-wide">Pagos y payouts</h1>
            <p className="mt-3 text-muted-foreground max-w-2xl">
              Retención de fondos vía Stripe (SPEI + tarjeta) con liberación condicionada al cumplimiento de hitos.
              Todos los movimientos quedan trazados y son idempotentes vía webhooks Stripe.
            </p>
          </header>

          {error && <div role="alert" className="border border-[#FF3B3B] bg-[#FF3B3B]/10 text-[#FF3B3B] p-3 text-sm">{error}</div>}

          {summary && (
            <section>
              <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-3">Resumen financiero</h2>
              <FundsRetentionWidget
                retenidoCents={summary.retenidoCents}
                porRecibirCents={summary.porRecibirCents}
                depositadoMesCents={summary.depositadoMesCents}
                recibidoMesCents={summary.recibidoMesCents}
                currency={summary.currency}
              />
            </section>
          )}

          <section>
            <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-3">Cuenta conectada</h2>
            <StripeConnectOnboarding
              status={acct?.status ?? "pending"}
              chargesEnabled={acct?.charges_enabled ?? false}
              payoutsEnabled={acct?.payouts_enabled ?? false}
              onboardingUrl={acct?.requirements?.onboarding_url ?? null}
              stripeReal={stripeReal}
              busy={busy}
              onCreate={handleCreate}
              onVerify={stripeReal ? undefined : handleVerify}
            />
            {acct && stripeReal && acct.status !== "verified" && (
              <button onClick={handleOnboarding} disabled={busy} className="mt-3 text-[11px] uppercase tracking-[0.14em] underline underline-offset-4">
                Regenerar link de onboarding Stripe
              </button>
            )}
          </section>

          {refundable.length > 0 && (
            <section>
              <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-3">
                Transacciones con fondos retenidos ({refundable.length})
              </h2>
              <div className="border border-yo-border">
                <ul className="divide-y divide-yo-border">
                  {refundable.map((t) => (
                    <li key={t.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-mono text-sm">{t.numero}</p>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t.status}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm">
                          {new Intl.NumberFormat("es-MX", { style: "currency", currency: t.currency }).format(t.amount_cents / 100)}
                        </span>
                        <button onClick={() => setRefundTx(t)} className="px-3 py-1.5 border border-[#FF3B3B] text-[#FF3B3B] text-[11px] uppercase tracking-[0.14em]">
                          Devolver
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Historial de movimientos</h2>
              <div className="flex gap-2 text-[11px] uppercase tracking-[0.14em]">
                {(["all", "deposito", "liberacion", "comision", "devolucion"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    className={`px-2 py-1 border ${filter === k ? "bg-yo-ac text-white border-yo-ac" : "border-yo-border"}`}
                  >
                    {k === "all" ? "Todos" : k}
                  </button>
                ))}
              </div>
            </div>
            <PaymentHistory movements={filtered} onExport={exportCSV} />
          </section>
        </div>
      </main>

      {refundTx && (
        <RefundDialog
          transactionNumero={refundTx.numero}
          maxAmountCents={refundTx.amount_cents}
          currency={refundTx.currency}
          onConfirm={handleRefund}
          onClose={() => setRefundTx(null)}
        />
      )}
    </div>
  );
}
