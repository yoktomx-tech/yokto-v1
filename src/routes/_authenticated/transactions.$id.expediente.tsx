import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Copy, ShieldAlert, Wallet, CheckCircle2, FileText,
  Camera, ScrollText, MessageSquare, Clock, AlertTriangle, Info,
  Building2, User, Calendar, Hash,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useViewRole } from "@/hooks/use-view-role";
import {
  StatusBadge, SectorBadge, MoneyDisplay, ProgressBar, EntityCard,
  MilestoneStatusBadge, EmptyState, InfoBox, MetricCard, NextActionPill,
} from "@/components/tx/ui";
import { toUiStatus, STATUS_CFG, LEGAL_COPY, getSectorUi } from "@/lib/tx-catalog";
import { commissionAmount } from "@/lib/tx";
import { findExample, type OperationExample } from "@/lib/operation-examples";
import { txHash } from "@/lib/tx-hash";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transactions/$id/expediente")({
  head: () => ({ meta: [{ title: "Expediente de operación — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: ExpedienteView,
});

type TabKey = "resumen" | "hitos" | "documentos" | "evidencia" | "pagos" | "disputa" | "auditoria";
const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "resumen",     label: "Resumen",     icon: Info },
  { key: "hitos",       label: "Hitos",       icon: CheckCircle2 },
  { key: "documentos",  label: "Documentos",  icon: FileText },
  { key: "evidencia",   label: "Evidencia",   icon: Camera },
  { key: "pagos",       label: "Pagos",       icon: Wallet },
  { key: "disputa",     label: "Disputa",     icon: MessageSquare },
  { key: "auditoria",   label: "Auditoría",   icon: ScrollText },
];

type UnifiedTx = {
  id: string;
  numero: string;
  title: string;
  description: string;
  sector: string;
  buyer_id: string;
  seller_id: string | null;
  counterparty_email: string | null;
  beneficiario_nombre: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  payment_method: "spei" | "card" | string;
  commission_bps: number;
  commission_payer: string;
  created_at: string;
  delivery_deadline: string | null;
  funding_deadline: string | null;
  hitos: Array<{
    id: string;
    orden: number;
    titulo: string;
    descripcion: string;
    monto_porcentaje: number;
    monto_cents: number;
    fecha_limite: string | null;
    tipo_verificacion: string;
    responsable: "PAGADOR" | "BENEFICIARIO";
    documentos_requeridos: string[];
    evidencia_requerida: string[];
    estado: string;
  }>;
  isDemo: boolean;
};

function demoStatusFor(id: string): { status: string; done: number } {
  const map: Record<string, { status: string; done: number }> = {
    "EJ-CONSTRUCCION":           { status: "in_progress",       done: 1 },
    "EJ-SERVICIOS-INDUSTRIALES": { status: "en_verificacion",   done: 1 },
    "EJ-CONSULTORIA":            { status: "released",          done: 1 },
    "EJ-AUTOTRANSPORTE":         { status: "funded",            done: 0 },
    "EJ-INMOBILIARIO":           { status: "awaiting_funding",  done: 0 },
    "EJ-VEHICULOS":              { status: "draft",             done: 0 },
  };
  const key = id.replace(/^demo-/, "");
  return map[key] ?? { status: "in_progress", done: 0 };
}

function exampleToUnified(ex: OperationExample, id: string, currentUserId: string): UnifiedTx {
  const state = demoStatusFor(id);
  const isBuyer = ex.rol === "PAGADOR";
  const buyer_id = isBuyer ? currentUserId : `demo-buyer-${ex.id}`;
  const seller_id = isBuyer ? `demo-seller-${ex.id}` : currentUserId;
  const now = new Date();
  const start = new Date(now.getTime() - 15 * 86_400_000);
  const amount_cents = Math.round(ex.monto * 100);

  const hitos = ex.hitos.map((h, i) => {
    const fecha = new Date(start.getTime() + h.diasDesdeInicio * 86_400_000);
    const estado = i < state.done ? "APROBADO" : i === state.done && state.status === "en_verificacion" ? "EN_REVISION" : "PENDIENTE";
    return {
      id: `${id}-h${i + 1}`,
      orden: i + 1,
      titulo: h.titulo,
      descripcion: h.descripcion ?? "",
      monto_porcentaje: h.monto_porcentaje,
      monto_cents: Math.round(amount_cents * (h.monto_porcentaje / 100)),
      fecha_limite: fecha.toISOString(),
      tipo_verificacion: h.tipo_verificacion,
      responsable: h.responsable,
      documentos_requeridos: h.documentos_requeridos ?? [],
      evidencia_requerida: h.evidencia_requerida ?? [],
      estado,
    };
  });

  return {
    id,
    numero: `YOKTO-DEMO-${ex.id.replace("EJ-", "")}`,
    title: ex.label,
    description: ex.descripcion,
    sector: ex.sector,
    buyer_id,
    seller_id,
    counterparty_email: ex.contraparte.email,
    beneficiario_nombre: ex.contraparte.nombre,
    amount_cents,
    currency: "MXN",
    status: state.status,
    payment_method: ex.metodoPago.toLowerCase() as "spei",
    commission_bps: 250,
    commission_payer: ex.comisionPagadaPor.toLowerCase(),
    created_at: start.toISOString(),
    delivery_deadline: new Date(start.getTime() + ex.diasDuracion * 86_400_000).toISOString(),
    funding_deadline: state.status === "awaiting_funding" ? new Date(start.getTime() + 3 * 86_400_000).toISOString() : null,
    hitos,
    isDemo: true,
  };
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function ExpedienteView() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const { role } = useViewRole();
  const [tx, setTx] = useState<UnifiedTx | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("resumen");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      if (id.startsWith("demo-")) {
        const ex = findExample(id.replace(/^demo-/, ""));
        if (ex) setTx(exampleToUnified(ex, id, user.id));
        else setTx(null);
        setLoading(false);
        return;
      }
      const [{ data: t }, { data: h }] = await Promise.all([
        supabase.from("transactions").select("*").eq("id", id).maybeSingle(),
        supabase.from("transaction_hitos").select("*").eq("transaction_id", id).order("orden"),
      ]);
      if (cancelled) return;
      if (!t) { setTx(null); setLoading(false); return; }
      const hitos = (h ?? []).map((x) => ({
        id: x.id,
        orden: x.orden,
        titulo: x.titulo,
        descripcion: x.descripcion ?? "",
        monto_porcentaje: Number(x.monto_porcentaje),
        monto_cents: Number(x.monto_cents ?? 0),
        fecha_limite: x.fecha_limite,
        tipo_verificacion: x.tipo_verificacion,
        responsable: x.responsable as "PAGADOR" | "BENEFICIARIO",
        documentos_requeridos: (x.documentos_requeridos as string[]) ?? [],
        evidencia_requerida: (x.evidencia_requerida as string[]) ?? [],
        estado: x.estado,
      }));
      setTx({
        id: t.id,
        numero: t.numero ?? t.id.slice(0, 8).toUpperCase(),
        title: t.title,
        description: t.description ?? "",
        sector: t.sector ?? "SERVICIOS",
        buyer_id: t.buyer_id,
        seller_id: t.seller_id,
        counterparty_email: t.counterparty_email,
        beneficiario_nombre: t.beneficiario_nombre,
        amount_cents: t.amount_cents,
        currency: t.currency,
        status: t.status,
        payment_method: t.payment_method,
        commission_bps: t.commission_bps,
        commission_payer: t.commission_payer,
        created_at: t.created_at,
        delivery_deadline: t.delivery_deadline,
        funding_deadline: t.funding_deadline,
        hitos,
        isDemo: false,
      });
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [id, user.id]);

  const derived = useMemo(() => {
    if (!tx) return null;
    const ui = toUiStatus(tx.status);
    const isBuyer = tx.buyer_id === user.id;
    const commission = commissionAmount(tx.amount_cents, tx.commission_bps);
    const doneCount = tx.hitos.filter((h) => ["APROBADO", "APPROVED"].includes(h.estado)).length;
    const totalCount = tx.hitos.length;
    const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    const heldStates = ["FUNDED", "IN_PROGRESS", "IN_VERIFICATION", "READY_FOR_APPROVAL", "READY_TO_RELEASE", "DISPUTED", "PARTIALLY_RELEASED"];
    const held = heldStates.includes(ui) ? tx.amount_cents : 0;
    const released = ["RELEASED", "PARTIALLY_RELEASED"].includes(ui) ? tx.amount_cents : 0;
    const pending = tx.amount_cents - released - (ui === "REFUNDED" ? 0 : 0);
    return { ui, isBuyer, commission, doneCount, totalCount, progressPct, held, released, pending };
  }, [tx, user.id]);

  if (loading) {
    return <div className="p-6 text-sm text-yo-txt-2">Cargando expediente…</div>;
  }
  if (!tx || !derived) {
    return (
      <div className="p-6">
        <EmptyState
          title="Operación no encontrada"
          description="La operación solicitada no existe o fue removida."
        />
        <div className="mt-4">
          <Link to="/transactions" className="text-yo-ac text-sm hover:underline">← Volver al listado</Link>
        </div>
      </div>
    );
  }

  const { ui, isBuyer, commission, doneCount, totalCount, progressPct, held, released } = derived;
  const isSeller = tx.seller_id === user.id;
  const sectorCfg = getSectorUi(tx.sector);
  const hash = txHash(tx.id);

  // Contextual CTA
  let cta: { label: string; tone: "warn" | "info" | "err" | "ok"; disabled?: boolean } | null = null;
  if (isBuyer) {
    if (ui === "PENDING_FUNDING") cta = { label: "Fondear ahora", tone: "warn" };
    else if (ui === "READY_FOR_APPROVAL") cta = { label: "Aprobar hito", tone: "warn" };
    else if (ui === "READY_TO_RELEASE") cta = { label: "Liberar pago", tone: "ok" };
    else if (ui === "DISPUTED") cta = { label: "Responder disputa", tone: "err" };
  } else if (isSeller) {
    if (ui === "INVITED") cta = { label: "Aceptar invitación", tone: "info" };
    else if (["FUNDED", "IN_PROGRESS"].includes(ui)) cta = { label: "Subir evidencia", tone: "warn" };
    else if (ui === "IN_VERIFICATION") cta = { label: "En revisión", tone: "info", disabled: true };
    else if (ui === "DISPUTED") cta = { label: "Responder disputa", tone: "err" };
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-yo-bg/95 backdrop-blur border-b border-yo-border">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-xs text-yo-txt-2">
            <Link to="/transactions" className="inline-flex items-center gap-1 hover:text-yo-ac">
              <ArrowLeft className="h-3.5 w-3.5" /> Operaciones
            </Link>
            <span>/</span>
            <span className="font-mono">{tx.numero}</span>
            <button
              onClick={() => { navigator.clipboard?.writeText(hash); toast.success("Hash copiado", { description: hash }); }}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-yo-txt-3 hover:text-yo-ac"
              title="Copiar hash único"
            >
              <Hash className="h-3 w-3" /> {hash}
              <Copy className="h-3 w-3" />
            </button>
            {tx.isDemo && (
              <span className="ml-auto rounded-full bg-yo-warn-bg text-[color:var(--yo-warn)] px-2 py-0.5 text-[10px] uppercase tracking-wider">
                Ejemplo demo
              </span>
            )}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span aria-hidden className="text-lg">{sectorCfg.emoji}</span>
                <h1 className="text-lg md:text-2xl font-bold text-yo-txt truncate">{tx.title}</h1>
                <StatusBadge status={tx.status} size="sm" />
              </div>
              <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-yo-txt-2">
                <SectorBadge sector={tx.sector} size="sm" />
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Creada {fmtDate(tx.created_at)}</span>
                {tx.delivery_deadline && (
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Vence {fmtDate(tx.delivery_deadline)}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {cta && (
                <button
                  disabled={cta.disabled}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    cta.tone === "warn" && "bg-[color:var(--yo-warn)] text-white hover:opacity-90",
                    cta.tone === "info" && "bg-[color:var(--yo-info)] text-white hover:opacity-90",
                    cta.tone === "err" && "bg-[color:var(--yo-err)] text-white hover:opacity-90",
                    cta.tone === "ok" && "bg-[color:var(--yo-ok)] text-white hover:opacity-90",
                    cta.disabled && "opacity-50 cursor-not-allowed",
                  )}
                  onClick={() => toast.info("Acción contextual", { description: `${cta.label} — usa el expediente completo.` })}
                >
                  {cta.label}
                </button>
              )}
            </div>
          </div>

          {/* Financial snapshot bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="rounded-md bg-yo-raised px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-yo-txt-3">Monto</div>
              <MoneyDisplay amount={tx.amount_cents / 100} size="sm" />
            </div>
            <div className="rounded-md bg-yo-raised px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-yo-txt-3">Retenido</div>
              <MoneyDisplay amount={held / 100} size="sm" showCurrency={false} muted={held === 0} />
            </div>
            <div className="rounded-md bg-yo-raised px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-yo-txt-3">Liberado</div>
              <MoneyDisplay amount={released / 100} size="sm" showCurrency={false} muted={released === 0} />
            </div>
            <div className="rounded-md bg-yo-raised px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-yo-txt-3">Comisión</div>
              <MoneyDisplay amount={commission / 100} size="sm" showCurrency={false} muted />
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <Timeline uiStatus={ui} />

      {/* 70 / 30 layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        {/* Main content */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Tabs */}
          <div className="surface-card overflow-x-auto">
            <div className="flex border-b border-yo-border">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "px-4 py-3 text-sm inline-flex items-center gap-2 border-b-2 -mb-px whitespace-nowrap transition-colors",
                      active
                        ? "border-yo-ac text-yo-ac font-medium"
                        : "border-transparent text-yo-txt-2 hover:text-yo-txt",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="p-4 md:p-6">
              {tab === "resumen" && (
                <TabResumen tx={tx} />
              )}
              {tab === "hitos" && (
                <TabHitos tx={tx} role={role} />
              )}
              {tab === "documentos" && (
                <TabDocumentos tx={tx} />
              )}
              {tab === "evidencia" && (
                <TabEvidencia tx={tx} />
              )}
              {tab === "pagos" && (
                <TabPagos tx={tx} held={held} released={released} commission={commission} />
              )}
              {tab === "disputa" && (
                <TabDisputa uiStatus={ui} />
              )}
              {tab === "auditoria" && (
                <TabAuditoria tx={tx} />
              )}
            </div>
          </div>

          <InfoBox tone="info" title="Aviso legal">
            {LEGAL_COPY.fundsCustody}
          </InfoBox>
        </div>

        {/* Sticky side panel */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-[220px] lg:self-start">
          {cta && (
            <div className="surface-card p-4">
              <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 mb-1">Próxima acción</div>
              <NextActionPill tone={cta.tone}>{cta.label}</NextActionPill>
              <p className="mt-2 text-xs text-yo-txt-2">
                {isBuyer ? "Vista comprador" : isSeller ? "Vista vendedor" : "Vista backoffice"}.
              </p>
            </div>
          )}

          <MetricCard
            label="Cumplimiento"
            value={`${progressPct}%`}
            hint={`${doneCount} de ${totalCount} hitos aprobados`}
          />

          <div className="surface-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 mb-2">Resumen financiero</div>
            <ProgressBar value={released} max={tx.amount_cents || 1} tone="ok" right={<span>{Math.round((released / (tx.amount_cents || 1)) * 100)}%</span>} />
            <div className="mt-3 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-yo-txt-2">Total</span><MoneyDisplay amount={tx.amount_cents/100} size="xs" showCurrency={false} /></div>
              <div className="flex justify-between"><span className="text-yo-txt-2">Retenido</span><MoneyDisplay amount={held/100} size="xs" showCurrency={false} /></div>
              <div className="flex justify-between"><span className="text-yo-txt-2">Liberado</span><MoneyDisplay amount={released/100} size="xs" showCurrency={false} /></div>
              <div className="flex justify-between"><span className="text-yo-txt-2">Comisión ({(tx.commission_bps/100).toFixed(2)}%)</span><MoneyDisplay amount={commission/100} size="xs" showCurrency={false} /></div>
            </div>
          </div>

          <div className="surface-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 mb-2">Partes</div>
            <EntityCard
              icon={<User className="h-3.5 w-3.5" />}
              label="Comprador"
              value={isBuyer ? "Tú" : "Contraparte"}
              hint={isBuyer ? undefined : tx.counterparty_email ?? undefined}
            />
            <div className="h-2" />
            <EntityCard
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Vendedor"
              value={isSeller ? "Tú" : tx.beneficiario_nombre ?? "Contraparte"}
              hint={isSeller ? undefined : tx.counterparty_email ?? undefined}
            />
          </div>

          {ui === "DISPUTED" && (
            <InfoBox tone="err" title="Operación en disputa">
              {LEGAL_COPY.activeDispute}
            </InfoBox>
          )}
          {["PENDING_FUNDING", "IN_VERIFICATION"].includes(ui) && (
            <InfoBox tone="warn" title="Requiere atención">
              {ui === "PENDING_FUNDING" ? "El comprador debe fondear para iniciar." : "Yokto está verificando la evidencia."}
            </InfoBox>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Timeline ────────────────────────────────────────────────────────────────
function Timeline({ uiStatus }: { uiStatus: ReturnType<typeof toUiStatus> }) {
  const steps: { key: string; label: string }[] = [
    { key: "DRAFT",           label: "Borrador" },
    { key: "PENDING_FUNDING", label: "Por fondear" },
    { key: "FUNDED",          label: "Fondos retenidos" },
    { key: "IN_PROGRESS",     label: "En curso" },
    { key: "READY_TO_RELEASE",label: "Lista para liberar" },
    { key: "RELEASED",        label: "Liberada" },
  ];
  const order = steps.findIndex((s) => s.key === uiStatus);
  const currentIdx = order >= 0 ? order : (["IN_VERIFICATION", "READY_FOR_APPROVAL"].includes(uiStatus) ? 3 : ["PARTIALLY_RELEASED", "CLOSED", "REFUNDED"].includes(uiStatus) ? 5 : 2);
  return (
    <div className="surface-card p-3 md:p-4 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max">
        {steps.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs whitespace-nowrap",
                done ? "bg-yo-ok-bg text-[color:var(--yo-ok)]" : active ? "bg-yo-ac-bg text-yo-ac-txt font-medium" : "bg-yo-raised text-yo-txt-3",
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", done ? "bg-[color:var(--yo-ok)]" : active ? "bg-yo-ac" : "bg-yo-txt-3")} />
                {s.label}
              </div>
              {i < steps.length - 1 && <div className={cn("h-px w-6", done ? "bg-[color:var(--yo-ok)]" : "bg-yo-border")} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function TabResumen({ tx }: { tx: UnifiedTx }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section>
        <h3 className="text-sm font-semibold text-yo-txt mb-2">Descripción</h3>
        <p className="text-sm text-yo-txt-2 leading-relaxed">{tx.description || "Sin descripción."}</p>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-yo-txt mb-2">Condiciones</h3>
        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between"><dt className="text-yo-txt-2">Método de pago</dt><dd className="font-medium uppercase">{tx.payment_method}</dd></div>
          <div className="flex justify-between"><dt className="text-yo-txt-2">Comisión</dt><dd className="font-medium">{(tx.commission_bps/100).toFixed(2)}% ({tx.commission_payer})</dd></div>
          <div className="flex justify-between"><dt className="text-yo-txt-2">Sector</dt><dd className="font-medium">{tx.sector}</dd></div>
          <div className="flex justify-between"><dt className="text-yo-txt-2">Hitos</dt><dd className="font-medium">{tx.hitos.length}</dd></div>
          <div className="flex justify-between"><dt className="text-yo-txt-2">Entrega</dt><dd className="font-medium">{fmtDate(tx.delivery_deadline)}</dd></div>
        </dl>
      </section>
    </div>
  );
}

function TabHitos({ tx, role }: { tx: UnifiedTx; role: "buyer" | "seller" }) {
  if (tx.hitos.length === 0) return <EmptyState title="Sin hitos" description="Esta operación no tiene hitos configurados." />;
  return (
    <ol className="flex flex-col gap-3">
      {tx.hitos.map((h) => (
        <li key={h.id} className="surface-card p-4 border border-yo-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-mono">#{h.orden}</span>
                <h4 className="font-medium text-yo-txt">{h.titulo}</h4>
                <MilestoneStatusBadge status={mapMilestone(h.estado)} size="sm" />
              </div>
              {h.descripcion && <p className="mt-1 text-sm text-yo-txt-2">{h.descripcion}</p>}
              <div className="mt-2 flex items-center gap-3 text-[11px] text-yo-txt-3 flex-wrap">
                <span>Responsable: <strong className="text-yo-txt-2">{h.responsable}</strong></span>
                <span>Verificación: <strong className="text-yo-txt-2">{h.tipo_verificacion}</strong></span>
                <span>Vence: <strong className="text-yo-txt-2">{fmtDate(h.fecha_limite)}</strong></span>
              </div>
              {(h.documentos_requeridos.length > 0 || h.evidencia_requerida.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {h.documentos_requeridos.map((d) => (
                    <span key={d} className="rounded bg-yo-raised px-2 py-0.5 text-[10px] text-yo-txt-2">📄 {d}</span>
                  ))}
                  {h.evidencia_requerida.map((e) => (
                    <span key={e} className="rounded bg-yo-raised px-2 py-0.5 text-[10px] text-yo-txt-2">📸 {e}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <MoneyDisplay amount={h.monto_cents/100} size="sm" showCurrency={false} />
              <div className="text-[10px] text-yo-txt-3">{h.monto_porcentaje}% del total</div>
              {role === "seller" && h.estado === "PENDIENTE" && (
                <button className="mt-2 text-[11px] text-yo-ac hover:underline" onClick={() => toast.info("Subir evidencia (mock)")}>Marcar listo</button>
              )}
              {role === "buyer" && h.estado === "EN_REVISION" && (
                <button className="mt-2 text-[11px] text-yo-ac hover:underline" onClick={() => toast.info("Aprobar hito (mock)")}>Aprobar</button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function mapMilestone(estado: string): string {
  const m: Record<string, string> = {
    PENDIENTE: "PENDING",
    EN_CURSO: "IN_PROGRESS",
    EN_REVISION: "IN_REVIEW",
    APROBADO: "APPROVED",
    RECHAZADO: "REJECTED",
    CANCELADO: "REJECTED",
  };
  return m[estado] ?? estado;
}

function TabDocumentos({ tx }: { tx: UnifiedTx }) {
  const docs = tx.hitos.flatMap((h) => h.documentos_requeridos.map((d) => ({ hito: h.titulo, name: d, estado: h.estado })));
  if (docs.length === 0) return <EmptyState title="Sin documentos requeridos" description="Esta operación no exige documentos formales." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wider text-yo-txt-3 border-b border-yo-border">
          <tr><th className="py-2">Documento</th><th className="py-2">Hito</th><th className="py-2">Estado</th><th className="py-2 text-right">Acción</th></tr>
        </thead>
        <tbody>
          {docs.map((d, i) => (
            <tr key={i} className="border-b border-yo-border last:border-b-0">
              <td className="py-2.5 flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-yo-txt-3" /> {d.name}</td>
              <td className="py-2.5 text-yo-txt-2">{d.hito}</td>
              <td className="py-2.5"><MilestoneStatusBadge status={mapMilestone(d.estado)} size="sm" /></td>
              <td className="py-2.5 text-right"><button className="text-yo-ac text-xs hover:underline" onClick={() => toast.info("Abrir drawer del documento (mock)")}>Ver</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabEvidencia({ tx }: { tx: UnifiedTx }) {
  const evs = tx.hitos.flatMap((h) => h.evidencia_requerida.map((e) => ({ hito: h.titulo, name: e, estado: h.estado })));
  if (evs.length === 0) return <EmptyState title="Sin evidencia requerida" description="No se solicitó evidencia física para esta operación." />;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {evs.map((e, i) => (
        <div key={i} className="surface-card p-3 border border-yo-border">
          <div className="aspect-video rounded bg-yo-raised flex items-center justify-center text-yo-txt-3">
            <Camera className="h-6 w-6" />
          </div>
          <div className="mt-2 text-sm font-medium text-yo-txt">{e.name}</div>
          <div className="text-[11px] text-yo-txt-2">{e.hito}</div>
          <div className="mt-1"><MilestoneStatusBadge status={mapMilestone(e.estado)} size="sm" /></div>
        </div>
      ))}
    </div>
  );
}

function TabPagos({ tx, held, released, commission }: { tx: UnifiedTx; held: number; released: number; commission: number }) {
  const rows = [
    { concepto: "Fondeo del comprador", monto: held || tx.amount_cents, fecha: tx.created_at, estado: held > 0 ? "Retenido" : "Pendiente" },
    { concepto: "Liberación al vendedor", monto: released, fecha: released > 0 ? tx.delivery_deadline : null, estado: released > 0 ? "Liberado" : "Pendiente" },
    { concepto: "Comisión Yokto", monto: commission, fecha: released > 0 ? tx.delivery_deadline : null, estado: released > 0 ? "Cobrada" : "Pendiente" },
  ];
  return (
    <div>
      <InfoBox tone="info" title="Ledger interno">{LEGAL_COPY.ledgerNotice}</InfoBox>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-yo-txt-3 border-b border-yo-border">
            <tr><th className="py-2">Concepto</th><th className="py-2 text-right">Monto</th><th className="py-2">Fecha</th><th className="py-2">Estado</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-yo-border last:border-b-0">
                <td className="py-2.5">{r.concepto}</td>
                <td className="py-2.5 text-right"><MoneyDisplay amount={r.monto/100} size="sm" showCurrency={false} /></td>
                <td className="py-2.5 text-yo-txt-2">{fmtDate(r.fecha)}</td>
                <td className="py-2.5 text-yo-txt-2">{r.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabDisputa({ uiStatus }: { uiStatus: string }) {
  if (uiStatus !== "DISPUTED") {
    return (
      <div>
        <EmptyState
          title="Sin disputas activas"
          description="Puedes abrir una disputa si consideras que las condiciones no se cumplen."
          icon={<ShieldAlert className="h-8 w-8 text-yo-txt-3" />}
        />
        <div className="mt-3 text-center">
          <button className="inline-flex items-center gap-2 rounded-md border border-yo-border px-3 py-2 text-sm hover:bg-yo-raised" onClick={() => toast.info("Abrir disputa (mock)")}>
            <ShieldAlert className="h-4 w-4" /> Abrir disputa
          </button>
        </div>
      </div>
    );
  }
  return (
    <InfoBox tone="err" title="Disputa activa">{LEGAL_COPY.activeDispute}</InfoBox>
  );
}

function TabAuditoria({ tx }: { tx: UnifiedTx }) {
  const events = [
    { at: tx.created_at, label: "Operación creada", icon: FileText },
    ...(tx.hitos.filter(h => h.estado === "APROBADO").map((h) => ({ at: h.fecha_limite ?? tx.created_at, label: `Hito ${h.orden} aprobado: ${h.titulo}`, icon: CheckCircle2 }))),
  ];
  return (
    <ol className="relative border-l border-yo-border ml-2">
      {events.map((e, i) => (
        <li key={i} className="mb-4 ml-4">
          <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-yo-ac" />
          <div className="text-xs text-yo-txt-3 font-mono">{fmtDate(e.at)}</div>
          <div className="text-sm text-yo-txt flex items-center gap-2"><e.icon className="h-3.5 w-3.5 text-yo-txt-2" /> {e.label}</div>
        </li>
      ))}
    </ol>
  );
}
