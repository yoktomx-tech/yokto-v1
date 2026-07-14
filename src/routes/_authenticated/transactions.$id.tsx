import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { STATUS_LABEL, STATUS_ACCENT, formatMoney, commissionAmount, type TxStatus } from "@/lib/tx";
import {
  createFundingIntent,
  simulateFundingReceived,
  releaseFunds,
} from "@/lib/payments.functions";
import { openDispute } from "@/lib/disputes.functions";
import { VerificationPanel } from "@/components/verification-panel";
import { DocumentsPanel } from "@/components/documents-panel";

type Tx = {
  id: string;
  numero: string | null;
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
type Hito = {
  id: string;
  orden: number;
  titulo: string;
  descripcion: string | null;
  monto_porcentaje: number;
  monto_cents: number | null;
  fecha_limite: string | null;
  tipo_verificacion: string;
  responsable: "PAGADOR" | "BENEFICIARIO";
  auto_release: boolean;
  estado: "PENDIENTE" | "EN_CURSO" | "EN_REVISION" | "APROBADO" | "RECHAZADO" | "CANCELADO";
  aprobado_at: string | null;
  notas_rechazo: string | null;
};
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

type TabKey = "resumen" | "hitos" | "documentos" | "evidencia" | "pagos" | "disputa" | "auditoria";
const TABS: { key: TabKey; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "hitos", label: "Hitos" },
  { key: "documentos", label: "Documentos" },
  { key: "evidencia", label: "Evidencia" },
  { key: "pagos", label: "Pagos" },
  { key: "disputa", label: "Disputa" },
  { key: "auditoria", label: "Auditoría" },
];

// Mini-timeline milestones (7 phases in order)
const TIMELINE: { key: TxStatus; label: string }[] = [
  { key: "draft", label: "Borrador" },
  { key: "pending_signature", label: "Firma" },
  { key: "awaiting_funding", label: "Fondeo" },
  { key: "funded", label: "Fondos" },
  { key: "in_progress", label: "En curso" },
  { key: "conditions_met", label: "Cumplido" },
  { key: "released", label: "Liberado" },
];

const TIMELINE_ORDER: TxStatus[] = TIMELINE.map((t) => t.key);

function timelineProgress(status: TxStatus): number {
  // Special states short-circuit
  if (status === "disputed") return TIMELINE_ORDER.indexOf("in_progress");
  if (status === "cancelled" || status === "refunded") return -1;
  if (status === "en_verificacion") return TIMELINE_ORDER.indexOf("in_progress");
  if (status === "partial_release") return TIMELINE_ORDER.indexOf("conditions_met");
  const idx = TIMELINE_ORDER.indexOf(status);
  return idx;
}

export const Route = createFileRoute("/_authenticated/transactions/$id")({
  head: () => ({ meta: [{ title: "Transacción — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: TxDetail,
});

function TxDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [tx, setTx] = useState<Tx | null>(null);
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [events, setEvents] = useState<Evt[]>([]);
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("resumen");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState<
    | "incumplimiento_hito"
    | "documentos_invalidos"
    | "mercancia_incompleta"
    | "calidad_insuficiente"
    | "plazo_vencido"
    | "fraude_sospechado"
    | "condiciones_no_acordadas"
    | "otro"
  >("incumplimiento_hito");
  const [disputeDesc, setDisputeDesc] = useState("");

  const createIntentFn = useServerFn(createFundingIntent);
  const simulateFundingFn = useServerFn(simulateFundingReceived);
  const releaseFundsFn = useServerFn(releaseFunds);
  const openDisputeFn = useServerFn(openDispute);

  async function load() {
    const [{ data: t }, { data: h }, { data: e }, { data: pi }, { data: po }] = await Promise.all([
      supabase.from("transactions").select("*").eq("id", id).maybeSingle(),
      supabase.from("transaction_hitos").select("*").eq("transaction_id", id).order("orden"),
      supabase.from("transaction_events").select("*").eq("transaction_id", id).order("created_at", { ascending: false }),
      supabase.from("payment_intents").select("*").eq("transaction_id", id).order("created_at", { ascending: false }),
      supabase.from("payouts").select("*").eq("transaction_id", id).order("created_at", { ascending: false }),
    ]);
    setTx((t as Tx) ?? null);
    setHitos((h ?? []) as Hito[]);
    setEvents((e ?? []) as Evt[]);
    setIntents((pi ?? []) as PaymentIntent[]);
    setPayouts((po ?? []) as Payout[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  // Realtime: react to changes on tx, hitos, events, payment_intents, payouts
  useEffect(() => {
    const ch = supabase
      .channel(`tx-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "transaction_hitos", filter: `transaction_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "transaction_events", filter: `transaction_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_intents", filter: `transaction_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "payouts", filter: `transaction_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id]);

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

  async function toggleHito(h: Hito) {
    if (h.estado === "APROBADO") return;
    setBusy(true);
    const next: Hito["estado"] = "APROBADO";
    await supabase
      .from("transaction_hitos")
      .update({ estado: next, aprobado_at: new Date().toISOString(), aprobado_por: user.id })
      .eq("id", h.id);
    await logEvent("hito.approved", { hito_id: h.id });

    // Auto-release cascade: fetch latest hitos and evaluate
    const { data: fresh } = await supabase
      .from("transaction_hitos").select("estado,auto_release").eq("transaction_id", id);
    const allApproved = (fresh ?? []).length > 0 && (fresh ?? []).every((x) => x.estado === "APROBADO");
    const allAuto = (fresh ?? []).every((x) => x.auto_release);
    if (allApproved && tx && ["funded", "in_progress", "en_verificacion"].includes(tx.status)) {
      await supabase.from("transactions").update({ status: "conditions_met" }).eq("id", id);
      await logEvent("transaction.conditions_met", { auto: true });
      if (allAuto && isBuyer) {
        try { await releaseFundsFn({ data: { transactionId: id } }); await logEvent("transaction.released", { auto: true }); }
        catch (e) { setError((e as Error).message); }
      }
    }
    setBusy(false);
  }

  function exportAuditCSV() {
    const rows = [["timestamp", "event_type", "actor_id", "metadata"]];
    for (const ev of events) {
      rows.push([
        new Date(ev.created_at).toISOString(),
        ev.event_type,
        ev.actor_id ?? "",
        JSON.stringify(ev.metadata ?? {}),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-${tx?.numero ?? id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCreateIntent(method: "spei" | "card") {
    setBusy(true); setError(null);
    try { await createIntentFn({ data: { transactionId: id, method } }); await load(); }
    catch (e) { setError((e as Error).message); }
    setBusy(false);
  }
  async function handleSimulateFunding(piId: string) {
    setBusy(true); setError(null);
    try { await simulateFundingFn({ data: { paymentIntentId: piId } }); await load(); }
    catch (e) { setError((e as Error).message); }
    setBusy(false);
  }
  async function handleRelease() {
    setBusy(true); setError(null);
    try { await releaseFundsFn({ data: { transactionId: id } }); await load(); }
    catch (e) { setError((e as Error).message); }
    setBusy(false);
  }
  async function submitDispute() {
    setBusy(true); setError(null);
    try {
      const res = await openDisputeFn({ data: {
        transactionId: id,
        reasonCode: disputeReason,
        reasonDescription: disputeDesc.trim(),
      }});
      setDisputeOpen(false);
      navigate({ to: "/disputes/$id", params: { id: res.disputeId } });
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  const isBuyer = tx?.buyer_id === user.id;
  const isSeller = tx?.seller_id === user.id;
  const commission = tx ? commissionAmount(tx.amount_cents, tx.commission_bps) : 0;
  const allMet = hitos.length > 0 && hitos.every((h) => h.estado === "APROBADO");
  const activeIntent = intents.find((i) => i.status === "requires_payment" || i.status === "processing");
  const progress = tx ? timelineProgress(tx.status) : -1;

  const dot = useMemo(() => ({
    inactive: "size-2 bg-yo-border rounded-full",
    active: "size-2.5 bg-yo-ac rounded-full ring-2 ring-yo-ac/30",
    done: "size-2 bg-yo-ac rounded-full",
  }), []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <AppHeader email={user.email} userId={user.id} section="Transacción" />
        <div className="container-editorial py-16 text-sm text-muted-foreground">Cargando…</div>
      </div>
    );
  }
  if (!tx) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <AppHeader email={user.email} userId={user.id} section="Transacción" />
        <div className="container-editorial py-16">
          <h1 className="font-display text-4xl">Transacción no encontrada</h1>
          <Link to="/transactions" className="mt-4 inline-block underline underline-offset-4">Volver</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader email={user.email} userId={user.id} section="Transacción" />

      {/* STICKY HEADER */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-yo-border">
        <div className="container-editorial max-w-6xl py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <Link to="/transactions" className="underline underline-offset-4">← Transacciones</Link>
                {tx.numero && <span className="font-mono">{tx.numero}</span>}
                <span>{tx.sector ?? "Operación"}</span>
              </div>
              <h1 className="mt-1 font-display text-2xl md:text-3xl tracking-wide text-foreground truncate">{tx.title}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-block px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] border ${STATUS_ACCENT[tx.status]}`}>
                {STATUS_LABEL[tx.status]}
              </span>
              <span className="font-display text-xl">{formatMoney(tx.amount_cents, tx.currency)}</span>
            </div>
          </div>

          {/* Mini-timeline */}
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
            {TIMELINE.map((step, i) => {
              const state = progress < 0 ? "inactive" : i < progress ? "done" : i === progress ? "active" : "inactive";
              return (
                <div key={step.key} className="flex items-center gap-2 shrink-0">
                  <span className={dot[state]} />
                  <span className={`text-[10px] uppercase tracking-[0.14em] ${state === "active" ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                  {i < TIMELINE.length - 1 && <span className="w-6 h-px bg-yo-border" />}
                </div>
              );
            })}
            {tx.status === "disputed" && <span className="ml-3 text-[10px] uppercase tracking-[0.14em] text-[#FF3B3B]">● En disputa</span>}
            {tx.status === "cancelled" && <span className="ml-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">● Cancelada</span>}
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 overflow-x-auto -mb-px">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-[11px] uppercase tracking-[0.14em] border-b-2 -mb-px shrink-0 ${
                  tab === t.key
                    ? "border-yo-ac text-foreground font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1">
        <div className="container-editorial py-8 max-w-6xl">
          {error && (
            <div role="alert" className="mb-6 border border-[#FF3B3B] bg-[#FF3B3B]/10 text-[#FF3B3B] p-3 text-sm">
              {error}
            </div>
          )}

          {/* ACTION BAR (always visible) */}
          <div className="mb-6 border border-yo-border bg-yo-bg/40 p-4 flex flex-wrap gap-3">
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
            {(tx.status === "in_progress" || tx.status === "en_verificacion" || tx.status === "conditions_met") && (
              <>
                {allMet && tx.status !== "conditions_met" && (
                  <button disabled={busy} onClick={() => updateStatus("conditions_met")} className={btnPrimary}>Marcar condiciones cumplidas</button>
                )}
                {isBuyer && tx.status === "conditions_met" && (
                  <button disabled={busy} onClick={handleRelease} className={btnPrimary}>Liberar fondos al vendedor</button>
                )}
                <button disabled={busy} onClick={() => setDisputeOpen(true)} className={btnDanger}>Abrir disputa</button>
              </>
            )}
            {tx.status === "disputed" && <Link to="/disputes" className={btnGhost}>Ir a la disputa</Link>}
          </div>

          {/* TAB CONTENT */}
          {tab === "resumen" && (
            <section className="space-y-6">
              {tx.description && <p className="text-muted-foreground max-w-3xl">{tx.description}</p>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Cell label="Monto retenido" value={formatMoney(tx.amount_cents, tx.currency)} big />
                <Cell label={`Comisión YOKTO (${(tx.commission_bps / 100).toFixed(2)}%)`} value={formatMoney(commission, tx.currency)} />
                <Cell label="Método de fondeo" value={tx.payment_method.toUpperCase()} />
                <Cell label="Rol" value={isBuyer ? "Comprador" : isSeller ? "Vendedor" : "Observador"} />
                <Cell label="Contraparte" value={isBuyer ? tx.counterparty_email ?? "—" : "Comprador"} />
                <Cell label="Fecha límite entrega" value={tx.delivery_deadline ? new Date(tx.delivery_deadline).toLocaleString("es-MX") : "—"} />
              </div>
            </section>
          )}

          {tab === "hitos" && (
            <section>
              <div className="border border-yo-border bg-background divide-y divide-yokto-black/20">
                {hitos.length === 0 && <p className="p-5 text-sm text-muted-foreground">Sin hitos registrados.</p>}
                {hitos.map((h) => (
                  <div key={h.id} className="p-4 flex items-start gap-4">
                    <button
                      disabled={busy || !(isBuyer || isSeller) || h.estado === "APROBADO" || ["released","cancelled","refunded"].includes(tx.status)}
                      onClick={() => toggleHito(h)}
                      className={`mt-0.5 size-6 border border-yo-border grid place-items-center ${h.estado === "APROBADO" ? "bg-yokto-yellow" : "bg-background"} disabled:opacity-50`}
                      aria-label="Aprobar hito"
                    >
                      {h.estado === "APROBADO" && <span className="font-mono text-sm">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Hito {h.orden}</span>
                        <span className="text-[11px] uppercase tracking-[0.14em] border border-yo-border px-1.5 py-0.5">{h.tipo_verificacion}</span>
                        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{h.responsable}</span>
                        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{h.monto_porcentaje}%</span>
                        <span className={`text-[11px] uppercase tracking-[0.14em] px-1.5 py-0.5 border ${
                          h.estado === "APROBADO" ? "bg-yo-ac text-yokto-cream border-yo-ac" :
                          h.estado === "RECHAZADO" ? "bg-[#FF3B3B]/10 text-[#FF3B3B] border-[#FF3B3B]" :
                          "border-yo-border text-foreground"
                        }`}>{h.estado}</span>
                      </div>
                      <p className={`mt-1 text-sm ${h.estado === "APROBADO" ? "text-muted-foreground line-through" : "text-foreground"}`}>{h.titulo}</p>
                      {h.descripcion && <p className="mt-1 text-xs text-muted-foreground">{h.descripcion}</p>}
                      {h.fecha_limite && <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Vence · {new Date(h.fecha_limite).toLocaleDateString("es-MX")}</p>}
                      {h.aprobado_at && <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Aprobado · {new Date(h.aprobado_at).toLocaleString("es-MX")}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "documentos" && (
            <DocumentsPanel transactionId={id} canUpload={isBuyer || isSeller} userId={user.id} />
          )}

          {tab === "evidencia" && (
            <VerificationPanel transactionId={id} canUpload={isBuyer || isSeller} />
          )}

          {tab === "pagos" && (
            <section className="space-y-8">
              {activeIntent && (
                <div>
                  <h3 className="font-display text-2xl tracking-wide mb-3">Instrucciones de fondeo</h3>
                  <div className="border border-yo-border bg-background p-5 space-y-4">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-[11px] uppercase tracking-[0.14em] bg-yokto-yellow border border-yo-border px-2 py-1">{activeIntent.method.toUpperCase()}</span>
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
                    {isBuyer && (
                      <button disabled={busy} onClick={() => handleSimulateFunding(activeIntent.id)} className={btnPrimary}>
                        Simular fondeo recibido
                      </button>
                    )}
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Modo simulación. Los datos son ficticios.
                    </p>
                  </div>
                </div>
              )}
              <div>
                <h3 className="font-display text-2xl tracking-wide mb-3">Liberaciones</h3>
                <div className="border border-yo-border bg-background">
                  {payouts.length === 0 && <p className="p-5 text-sm text-muted-foreground">Sin liberaciones.</p>}
                  {payouts.map((p) => (
                    <div key={p.id} className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm border-t border-yokto-black/20 first:border-t-0">
                      <div><p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Bruto</p><p>{formatMoney(p.gross_cents, p.currency)}</p></div>
                      <div><p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Comisión</p><p>{formatMoney(p.commission_cents, p.currency)}</p></div>
                      <div><p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Neto</p><p className="font-semibold">{formatMoney(p.net_cents, p.currency)}</p></div>
                      <div><p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Estado</p><p>{p.status}</p></div>
                      <div><p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Ref</p><p className="font-mono text-[11px]">{p.provider_ref}</p></div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-display text-2xl tracking-wide mb-3">Intents históricos</h3>
                <div className="border border-yo-border bg-background">
                  {intents.length === 0 && <p className="p-5 text-sm text-muted-foreground">Sin intents.</p>}
                  {intents.map((i) => (
                    <div key={i.id} className="p-4 flex justify-between text-sm border-t border-yokto-black/20 first:border-t-0">
                      <span className="font-mono text-xs">{i.provider_ref ?? i.id}</span>
                      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{i.method} · {i.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === "disputa" && (
            <section className="border border-yo-border bg-background p-6">
              {tx.status === "disputed" ? (
                <div className="space-y-3">
                  <p className="text-sm">Esta transacción está en disputa.</p>
                  <Link to="/disputes" className={btnPrimary}>Ver disputa</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">No hay disputas activas.</p>
                  {(tx.status === "in_progress" || tx.status === "en_verificacion" || tx.status === "conditions_met") && (
                    <button onClick={() => setDisputeOpen(true)} className={btnDanger}>Abrir disputa</button>
                  )}
                </div>
              )}
            </section>
          )}

          {tab === "auditoria" && (
            <section>
              <div className="mb-3 flex justify-end">
                <button onClick={exportAuditCSV} disabled={events.length === 0} className={btnGhost}>
                  Exportar CSV
                </button>
              </div>
              <div className="border border-yo-border bg-background">
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
          )}
        </div>
      </main>

      {disputeOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setDisputeOpen(false)}>
          <div className="w-full max-w-lg border border-yo-border bg-background p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-3xl tracking-wide">Abrir disputa</h3>
            <p className="mt-1 text-sm text-muted-foreground">Detalla el problema con evidencia clara. Un mediador de YOKTO revisará el caso.</p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm">
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Motivo</span>
                <select value={disputeReason} onChange={(e) => setDisputeReason(e.target.value as never)} className="input-editorial w-full mt-1">
                  <option value="not_delivered">No entregado</option>
                  <option value="not_as_described">No como se describió</option>
                  <option value="quality">Problemas de calidad</option>
                  <option value="delay">Retraso significativo</option>
                  <option value="fraud">Fraude</option>
                  <option value="other">Otro</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Descripción (mín. 20 caracteres)</span>
                <textarea rows={5} value={disputeDesc} onChange={(e) => setDisputeDesc(e.target.value)} className="input-editorial w-full mt-1" placeholder="Explica qué pasó, cuándo y qué esperas como resolución" />
              </label>
              {error && <div role="alert" className="border border-[#FF3B3B] bg-[#FF3B3B]/10 text-[#FF3B3B] p-3 text-sm">{error}</div>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setDisputeOpen(false)} className={btnGhost}>Cancelar</button>
                <button disabled={busy || disputeDesc.trim().length < 20} onClick={submitDispute} className={btnDanger}>Abrir disputa</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnPrimary = "px-5 py-2.5 bg-yo-ac text-white text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border hover:bg-yo-ac-h disabled:opacity-50";
const btnGhost = "px-5 py-2.5 border border-yo-border text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-yo-ac-h hover:text-white disabled:opacity-50";
const btnDanger = "px-5 py-2.5 border border-[#FF3B3B] text-[#FF3B3B] text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-[#FF3B3B] hover:text-white disabled:opacity-50";

function Cell({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="border border-yo-border p-4 bg-background">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display tracking-wide text-foreground break-all ${big ? "text-3xl" : "text-xl"}`}>{value}</p>
    </div>
  );
}
