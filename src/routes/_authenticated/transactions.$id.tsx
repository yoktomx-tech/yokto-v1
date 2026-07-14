import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Calendar, ShieldAlert, Wallet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useViewRole } from "@/hooks/use-view-role";
import { toUiStatus, SECTOR_UI_CFG, STATUS_CFG, type SectorUiId } from "@/lib/tx-catalog";
import { formatMoney, commissionAmount, type TxStatus } from "@/lib/tx";
import {
  createFundingIntent,
  simulateFundingReceived,
  releaseFunds,
} from "@/lib/payments.functions";
import { openDispute } from "@/lib/disputes.functions";
import { VerificationPanel } from "@/components/verification-panel";
import { DocumentsPanel } from "@/components/documents-panel";
import { FiscalPanel } from "@/components/fiscal-panel";
import {
  StatusBadge, SectorBadge, MoneyDisplay, ProgressBar, EntityCard,
  EmptyState, MilestoneStatusBadge,
} from "@/components/tx/ui";
import { cn } from "@/lib/utils";

type Tx = {
  id: string;
  numero: string | null;
  buyer_id: string;
  seller_id: string | null;
  counterparty_email: string | null;
  beneficiario_nombre: string | null;
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

type TabKey = "resumen" | "hitos" | "documentos" | "evidencia" | "pagos" | "auditoria";
const TABS: { key: TabKey; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "hitos", label: "Hitos" },
  { key: "documentos", label: "Documentos" },
  { key: "evidencia", label: "Evidencia" },
  { key: "pagos", label: "Pagos" },
  { key: "auditoria", label: "Auditoría" },
];

export const Route = createFileRoute("/_authenticated/transactions/$id")({
  head: () => ({ meta: [{ title: "Transacción — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: TxDetail,
});

function TxDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const { role } = useViewRole();
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
    | "incumplimiento_hito" | "documentos_invalidos" | "mercancia_incompleta"
    | "calidad_insuficiente" | "plazo_vencido" | "fraude_sospechado"
    | "condiciones_no_acordadas" | "otro"
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
    await supabase
      .from("transaction_hitos")
      .update({ estado: "APROBADO", aprobado_at: new Date().toISOString(), aprobado_por: user.id })
      .eq("id", h.id);
    await logEvent("hito.approved", { hito_id: h.id });

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
    try { await createIntentFn({ data: { transactionId: id, method } }); toast.success(method === "spei" ? "Instrucciones SPEI generadas" : "Intento de pago creado"); await load(); }
    catch (e) { const msg = (e as Error).message; setError(msg); toast.error("No se pudo crear el intento", { description: msg }); }
    setBusy(false);
  }
  async function handleSimulateFunding(piId: string) {
    setBusy(true); setError(null);
    try { await simulateFundingFn({ data: { paymentIntentId: piId } }); toast.success("Fondeo recibido — recursos en custodia"); await load(); }
    catch (e) { const msg = (e as Error).message; setError(msg); toast.error("No se pudo simular el fondeo", { description: msg }); }
    setBusy(false);
  }
  async function handleRelease() {
    setBusy(true); setError(null);
    try { await releaseFundsFn({ data: { transactionId: id } }); toast.success("Fondos liberados al beneficiario"); await load(); }
    catch (e) { const msg = (e as Error).message; setError(msg); toast.error("No se pudo liberar el pago", { description: msg }); }
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
      toast.success("Disputa abierta", { description: "Se notificó a la contraparte." });
      navigate({ to: "/disputes/$id", params: { id: res.disputeId } });
    } catch (e) { const msg = (e as Error).message; setError(msg); toast.error("No se pudo abrir la disputa", { description: msg }); setBusy(false); }
  }

  const isBuyer = tx?.buyer_id === user.id;
  const isSeller = tx?.seller_id === user.id;
  const commission = tx ? commissionAmount(tx.amount_cents, tx.commission_bps) : 0;
  const allMet = hitos.length > 0 && hitos.every((h) => h.estado === "APROBADO");
  const activeIntent = intents.find((i) => i.status === "requires_payment" || i.status === "processing");
  const approvedCount = hitos.filter((h) => h.estado === "APROBADO").length;
  const progressPct = hitos.length > 0 ? Math.round((approvedCount / hitos.length) * 100) : 0;

  const sectorCfg = tx?.sector ? SECTOR_UI_CFG[tx.sector as SectorUiId] : null;

  if (loading) {
    return (
      <AppShell>
        <main className="p-6 text-sm text-yo-txt-2">Cargando…</main>
      </AppShell>
    );
  }
  if (!tx) {
    return (
      <AppShell>
        <main className="p-6">
          <EmptyState
            title="Transacción no encontrada"
            description="El enlace puede haber expirado o ya no tienes acceso."
            action={<Link to="/transactions" className="text-yo-ac hover:underline text-sm font-medium">← Volver</Link>}
          />
        </main>
      </AppShell>
    );
  }

  const uiStatus = toUiStatus(tx.status);

  return (
    <AppShell>
      <main className="flex-1 min-w-0">
        <div className="max-w-[1400px] mx-auto p-4 md:p-6 flex flex-col gap-4">
          {/* Breadcrumb + title */}
          <div className="flex flex-col gap-3">
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1.5 text-xs text-yo-txt-2 hover:text-yo-txt w-fit"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Transacciones
            </Link>

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {tx.numero && <span className="font-mono text-[11px] text-yo-txt-3">{tx.numero}</span>}
                  <StatusBadge status={tx.status} size="sm" />
                  {sectorCfg && <SectorBadge sector={tx.sector} size="sm" />}
                </div>
                <h1 className="mt-1.5 text-xl md:text-2xl font-semibold text-yo-txt truncate">{tx.title}</h1>
                {tx.description && (
                  <p className="mt-1 text-sm text-yo-txt-2 max-w-2xl line-clamp-2">{tx.description}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">Monto retenido</div>
                <MoneyDisplay amount={tx.amount_cents / 100} size="xl" />
              </div>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 text-red-800 p-3 text-sm">
              {error}
            </div>
          )}

          {/* 70/30 grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
            {/* MAIN 70 */}
            <div className="min-w-0 flex flex-col gap-4">
              {/* Tabs */}
              <div className="surface-card p-1 flex gap-0.5 overflow-x-auto">
                {TABS.map((t) => {
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={cn(
                        "shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                        active
                          ? "bg-yo-ac-bg text-yo-ac-txt"
                          : "text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised",
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {tab === "resumen" && (
                <section className="flex flex-col gap-4">
                  <div className="surface-card p-4">
                    <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium mb-2">Progreso de hitos</div>
                    <ProgressBar value={progressPct} />
                    <div className="mt-2 text-xs text-yo-txt-2">
                      {approvedCount} de {hitos.length} hitos aprobados
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Fact label="Comisión YOKTO" value={`${formatMoney(commission, tx.currency)} (${(tx.commission_bps / 100).toFixed(2)}%)`} />
                    <Fact label="Método de fondeo" value={tx.payment_method.toUpperCase()} />
                    <Fact label="Comisión a cargo de" value={tx.commission_payer === "buyer" ? "Comprador" : tx.commission_payer === "seller" ? "Vendedor" : "Dividido"} />
                    <Fact label="Fecha límite entrega" value={tx.delivery_deadline ? new Date(tx.delivery_deadline).toLocaleDateString("es-MX") : "—"} />
                  </div>

                  {tx.description && (
                    <div className="surface-card p-4">
                      <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium mb-2">Descripción</div>
                      <p className="text-sm text-yo-txt whitespace-pre-wrap">{tx.description}</p>
                    </div>
                  )}
                </section>
              )}

              {tab === "hitos" && (
                <section className="surface-card divide-y divide-yo-border">
                  {hitos.length === 0 && <p className="p-5 text-sm text-yo-txt-2">Sin hitos registrados.</p>}
                  {hitos.map((h) => (
                    <div key={h.id} className="p-4 flex items-start gap-4">
                      <button
                        disabled={busy || !(isBuyer || isSeller) || h.estado === "APROBADO" || ["released","cancelled","refunded"].includes(tx.status)}
                        onClick={() => toggleHito(h)}
                        className={cn(
                          "mt-0.5 size-6 rounded border border-yo-border grid place-items-center transition",
                          h.estado === "APROBADO" ? "bg-yo-ac text-white border-yo-ac" : "bg-yo-surface hover:bg-yo-raised",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                        )}
                        aria-label="Aprobar hito"
                      >
                        {h.estado === "APROBADO" && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">Hito {h.orden}</span>
                          <MilestoneStatusBadge status={h.estado} />
                          <span className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">{h.responsable}</span>
                          <span className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">{h.monto_porcentaje}%</span>
                        </div>
                        <p className={cn(
                          "mt-1 text-sm font-medium",
                          h.estado === "APROBADO" ? "text-yo-txt-2 line-through" : "text-yo-txt",
                        )}>{h.titulo}</p>
                        {h.descripcion && <p className="mt-1 text-xs text-yo-txt-2">{h.descripcion}</p>}
                        {h.fecha_limite && (
                          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-yo-txt-3">
                            <Calendar className="h-3 w-3" /> Vence · {new Date(h.fecha_limite).toLocaleDateString("es-MX")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {tab === "documentos" && (
                <div className="flex flex-col gap-4">
                  <DocumentsPanel transactionId={id} canUpload={isBuyer || isSeller} userId={user.id} />
                  <FiscalPanel transactionId={id} canUpload={isBuyer || isSeller} userId={user.id} />
                </div>
              )}

              {tab === "evidencia" && (
                <VerificationPanel transactionId={id} canUpload={isBuyer || isSeller} />
              )}

              {tab === "pagos" && (
                <section className="flex flex-col gap-4">
                  {activeIntent && (
                    <div className="surface-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-yo-txt">Instrucciones de fondeo</h3>
                        <span className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">
                          {activeIntent.method.toUpperCase()} · {activeIntent.provider}
                        </span>
                      </div>
                      {activeIntent.method === "spei" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Fact label="CLABE" value={activeIntent.clabe ?? "—"} mono />
                          <Fact label="Referencia" value={activeIntent.reference_code ?? "—"} mono />
                          <Fact label="Beneficiario" value={activeIntent.metadata?.beneficiary ?? "YOKTO"} />
                          <Fact label="Banco" value={activeIntent.metadata?.bank ?? "STP"} />
                          <Fact label="Monto" value={formatMoney(tx.amount_cents, tx.currency)} />
                          <Fact label="Expira" value={activeIntent.expires_at ? new Date(activeIntent.expires_at).toLocaleString("es-MX") : "—"} />
                        </div>
                      )}
                      {isBuyer && (
                        <button
                          disabled={busy}
                          onClick={() => handleSimulateFunding(activeIntent.id)}
                          className="mt-3 px-4 py-2 bg-yo-ac text-white text-sm font-medium rounded-md hover:bg-yo-ac-h disabled:opacity-50"
                        >
                          Simular fondeo recibido
                        </button>
                      )}
                      <p className="mt-2 text-[10px] uppercase tracking-wider text-yo-txt-3">Modo simulación. Datos ficticios.</p>
                    </div>
                  )}

                  <div className="surface-card">
                    <div className="p-4 border-b border-yo-border">
                      <h3 className="text-sm font-semibold text-yo-txt">Liberaciones</h3>
                    </div>
                    {payouts.length === 0 ? (
                      <p className="p-4 text-sm text-yo-txt-2">Sin liberaciones.</p>
                    ) : (
                      <div className="divide-y divide-yo-border">
                        {payouts.map((p) => (
                          <div key={p.id} className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                            <div><p className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">Bruto</p><p className="font-mono">{formatMoney(p.gross_cents, p.currency)}</p></div>
                            <div><p className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">Comisión</p><p className="font-mono">{formatMoney(p.commission_cents, p.currency)}</p></div>
                            <div><p className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">Neto</p><p className="font-mono font-semibold">{formatMoney(p.net_cents, p.currency)}</p></div>
                            <div><p className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">Estado</p><p>{p.status}</p></div>
                            <div><p className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">Ref</p><p className="font-mono text-[11px] truncate">{p.provider_ref}</p></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="surface-card">
                    <div className="p-4 border-b border-yo-border">
                      <h3 className="text-sm font-semibold text-yo-txt">Intents históricos</h3>
                    </div>
                    {intents.length === 0 ? (
                      <p className="p-4 text-sm text-yo-txt-2">Sin intents.</p>
                    ) : (
                      <div className="divide-y divide-yo-border">
                        {intents.map((i) => (
                          <div key={i.id} className="p-3 flex justify-between text-sm">
                            <span className="font-mono text-xs text-yo-txt-2 truncate">{i.provider_ref ?? i.id}</span>
                            <span className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">{i.method} · {i.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {tab === "auditoria" && (
                <section className="surface-card">
                  <div className="p-4 border-b border-yo-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-yo-txt">Bitácora de eventos</h3>
                    <button
                      onClick={exportAuditCSV}
                      disabled={events.length === 0}
                      className="px-3 py-1.5 text-xs font-medium border border-yo-border rounded-md hover:bg-yo-raised disabled:opacity-50"
                    >
                      Exportar CSV
                    </button>
                  </div>
                  {events.length === 0 ? (
                    <p className="p-4 text-sm text-yo-txt-2">Sin eventos.</p>
                  ) : (
                    <ul className="divide-y divide-yo-border">
                      {events.map((e) => (
                        <li key={e.id} className="p-3 flex justify-between gap-4 text-sm">
                          <span className="font-mono text-xs text-yo-txt">{e.event_type}</span>
                          <span className="text-[11px] text-yo-txt-3">{new Date(e.created_at).toLocaleString("es-MX")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>

            {/* SIDE 30 */}
            <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
              {/* Actions */}
              <div className="surface-card p-4">
                <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium mb-3">Acciones</div>
                <div className="flex flex-col gap-2">
                  {tx.status === "draft" && isBuyer && (
                    <>
                      <button disabled={busy} onClick={() => updateStatus("awaiting_funding")} className={btnPrimary}>Publicar y solicitar fondeo</button>
                      <button disabled={busy} onClick={() => updateStatus("cancelled", { cancelled_at: new Date().toISOString() })} className={btnGhost}>Cancelar borrador</button>
                    </>
                  )}
                  {tx.status === "awaiting_funding" && isBuyer && !activeIntent && (
                    <>
                      <button disabled={busy} onClick={() => handleCreateIntent("spei")} className={btnPrimary}>Generar CLABE SPEI</button>
                      <button disabled={busy} onClick={() => handleCreateIntent("card")} className={btnGhost}>Pagar con tarjeta</button>
                    </>
                  )}
                  {tx.status === "funded" && (
                    <button disabled={busy} onClick={() => updateStatus("in_progress")} className={btnPrimary}>Iniciar operación</button>
                  )}
                  {(tx.status === "in_progress" || tx.status === "en_verificacion" || tx.status === "conditions_met") && (
                    <>
                      {allMet && tx.status !== "conditions_met" && (
                        <button disabled={busy} onClick={() => updateStatus("conditions_met")} className={btnPrimary}>Marcar cumplidas</button>
                      )}
                      {isBuyer && tx.status === "conditions_met" && (
                        <button disabled={busy} onClick={handleRelease} className={btnPrimary}>
                          <Wallet className="h-4 w-4 mr-1.5 inline" /> Liberar fondos
                        </button>
                      )}
                      <button disabled={busy} onClick={() => setDisputeOpen(true)} className={btnDanger}>
                        <ShieldAlert className="h-4 w-4 mr-1.5 inline" /> Abrir disputa
                      </button>
                    </>
                  )}
                  {tx.status === "disputed" && (
                    <Link to="/disputes" className={btnGhost}>Ir a la disputa</Link>
                  )}
                  {["released", "cancelled", "refunded"].includes(tx.status) && (
                    <p className="text-xs text-yo-txt-2">Sin acciones disponibles.</p>
                  )}
                </div>
              </div>

              {/* Parties */}
              <div className="flex flex-col gap-2">
                <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium px-1">Partes</div>
                <EntityCard
                  title={isBuyer ? "Tú" : "Comprador"}
                  role="COMPRADOR"
                  subtitle={isBuyer ? user.email ?? undefined : undefined}
                />
                <EntityCard
                  title={tx.beneficiario_nombre || tx.counterparty_email || "Vendedor"}
                  role="VENDEDOR"
                 
                  subtitle={!isBuyer ? "Tú" : tx.counterparty_email ?? undefined}
                />
              </div>

              {/* Financial breakdown */}
              <div className="surface-card p-4">
                <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium mb-3">Desglose</div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-yo-txt-2">Monto operación</dt>
                    <dd className="font-mono text-yo-txt">{formatMoney(tx.amount_cents, tx.currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-yo-txt-2">Comisión YOKTO</dt>
                    <dd className="font-mono text-yo-txt">{formatMoney(commission, tx.currency)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-yo-border pt-2">
                    <dt className="text-yo-txt-2 font-medium">Neto al vendedor</dt>
                    <dd className="font-mono font-semibold text-yo-txt">{formatMoney(tx.amount_cents - (tx.commission_payer === "seller" ? commission : 0), tx.currency)}</dd>
                  </div>
                </dl>
              </div>

              {/* Deadlines */}
              {(tx.funding_deadline || tx.delivery_deadline) && (
                <div className="surface-card p-4">
                  <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium mb-3">Fechas clave</div>
                  <ul className="space-y-2 text-xs">
                    {tx.funding_deadline && (
                      <li className="flex justify-between">
                        <span className="text-yo-txt-2">Fondeo</span>
                        <span className="text-yo-txt">{new Date(tx.funding_deadline).toLocaleDateString("es-MX")}</span>
                      </li>
                    )}
                    {tx.delivery_deadline && (
                      <li className="flex justify-between">
                        <span className="text-yo-txt-2">Entrega</span>
                        <span className="text-yo-txt">{new Date(tx.delivery_deadline).toLocaleDateString("es-MX")}</span>
                      </li>
                    )}
                    <li className="flex justify-between">
                      <span className="text-yo-txt-2">Creada</span>
                      <span className="text-yo-txt">{new Date(tx.created_at).toLocaleDateString("es-MX")}</span>
                    </li>
                  </ul>
                </div>
              )}

              <div className="text-[10px] text-yo-txt-3 px-1">
                Vista {role === "buyer" ? "de comprador" : "de vendedor"} · Estado: {uiStatus}
              </div>
            </aside>
          </div>
        </div>
      </main>

      {disputeOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setDisputeOpen(false)}>
          <div className="w-full max-w-lg surface-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-yo-txt">Abrir disputa</h3>
            <p className="mt-1 text-sm text-yo-txt-2">Detalla el problema con evidencia clara. Un mediador de YOKTO revisará el caso.</p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm">
                <span className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">Motivo</span>
                <select value={disputeReason} onChange={(e) => setDisputeReason(e.target.value as never)} className="mt-1 w-full h-9 px-2 rounded-md border border-yo-border bg-yo-surface text-sm">
                  <option value="incumplimiento_hito">Incumplimiento de hito</option>
                  <option value="documentos_invalidos">Documentos inválidos</option>
                  <option value="mercancia_incompleta">Mercancía incompleta</option>
                  <option value="calidad_insuficiente">Calidad insuficiente</option>
                  <option value="plazo_vencido">Plazo vencido</option>
                  <option value="fraude_sospechado">Fraude sospechado</option>
                  <option value="condiciones_no_acordadas">Condiciones no acordadas</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">Descripción (mín. 100 caracteres)</span>
                <textarea rows={5} value={disputeDesc} onChange={(e) => setDisputeDesc(e.target.value)} className="mt-1 w-full px-2 py-2 rounded-md border border-yo-border bg-yo-surface text-sm" placeholder="Explica qué pasó, cuándo y qué esperas como resolución." />
                <span className="text-[11px] text-yo-txt-3 mt-1 block">{disputeDesc.trim().length}/100</span>
              </label>
              {error && <div role="alert" className="rounded-md border border-red-300 bg-red-50 text-red-800 p-2 text-xs">{error}</div>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setDisputeOpen(false)} className={btnGhost}>Cancelar</button>
                <button disabled={busy || disputeDesc.trim().length < 100} onClick={submitDispute} className={btnDanger}>Continuar al depósito</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

const btnPrimary = "w-full inline-flex items-center justify-center px-3 py-2 bg-yo-ac text-white text-sm font-medium rounded-md hover:bg-yo-ac-h disabled:opacity-50 transition";
const btnGhost = "w-full inline-flex items-center justify-center px-3 py-2 border border-yo-border text-yo-txt text-sm font-medium rounded-md hover:bg-yo-raised disabled:opacity-50 transition";
const btnDanger = "w-full inline-flex items-center justify-center px-3 py-2 border border-red-300 text-red-700 text-sm font-medium rounded-md hover:bg-red-50 disabled:opacity-50 transition";

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="surface-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">{label}</p>
      <p className={"mt-1 text-sm text-yo-txt break-all " + (mono ? "font-mono" : "font-medium")}>{value}</p>
    </div>
  );
}
