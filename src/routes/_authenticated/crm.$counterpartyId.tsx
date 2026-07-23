import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft, Building2, User, Star, EyeOff, MoreHorizontal, Briefcase, FileText,
  MessageSquare, Receipt, Banknote, AlertTriangle, ClipboardCheck, ShieldCheck,
  Plus, Send, FileWarning, ExternalLink, Clock, CheckCircle2, XCircle, Info,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { InfoBox } from "@/components/tx/ui/info-box";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getCounterparty, getInteractionsFor, getDocRequestsFor,
  SECTOR_CFG, STATUS_CFG, TRUST_CFG, formatMoney, formatDate, relativeTime,
  type Counterparty, type Interaction, type DocumentRequest,
} from "@/lib/relationships-mock";

export const Route = createFileRoute("/_authenticated/crm/$counterpartyId")({
  loader: ({ params }) => {
    const c = getCounterparty(params.counterpartyId);
    if (!c) throw notFound();
    return { counterparty: c };
  },
  notFoundComponent: NotFoundView,
  component: CounterpartyDetailPage,
});

function NotFoundView() {
  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="bg-white border border-yo-border rounded-lg p-8 text-center">
        <h2 className="text-lg font-semibold text-yo-txt">Contraparte no disponible</h2>
        <p className="text-sm text-yo-txt-2 mt-1">Puede haber sido ocultada o no tienes permisos para verla.</p>
        <Link to="/crm" className="mt-4 inline-flex h-9 px-3 rounded-md bg-[#4F46E5] text-white text-sm font-medium">Volver al CRM</Link>
      </div>
    </div>
  );
}

type TabKey = "RESUMEN" | "OPERACIONES" | "INTERACCIONES" | "DOCUMENTOS" | "FISCAL" | "PAGOS" | "DISPUTAS" | "AUDITORIA";
const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "RESUMEN",       label: "Resumen",       icon: Info },
  { key: "OPERACIONES",   label: "Operaciones",   icon: Briefcase },
  { key: "INTERACCIONES", label: "Interacciones", icon: MessageSquare },
  { key: "DOCUMENTOS",    label: "Documentos",    icon: FileText },
  { key: "FISCAL",        label: "Fiscal CFDI/REP", icon: Receipt },
  { key: "PAGOS",         label: "Pagos",         icon: Banknote },
  { key: "DISPUTAS",      label: "Disputas",      icon: AlertTriangle },
  { key: "AUDITORIA",     label: "Auditoría",     icon: ClipboardCheck },
];

function CounterpartyDetailPage() {
  const { counterparty } = Route.useLoaderData();
  const [tab, setTab] = useState<TabKey>("RESUMEN");
  const [showRequestDoc, setShowRequestDoc] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const interactions = useMemo(() => getInteractionsFor(counterparty.id), [counterparty.id]);
  const docs = useMemo(() => getDocRequestsFor(counterparty.id), [counterparty.id]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link to="/crm" className="h-8 w-8 grid place-items-center rounded-md border border-yo-border bg-white hover:bg-yo-raised text-yo-txt-2">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="text-[11px] text-yo-txt-3 flex items-center gap-1 font-mono">
          <Link to="/crm" className="hover:text-yo-txt">CRM</Link>
          <span>/</span>
          <span className="text-yo-txt">{counterparty.yoktoId}</span>
        </div>
      </div>

      <CounterpartyHeader
        c={counterparty}
        onRequestDoc={() => setShowRequestDoc(true)}
        onActions={() => setShowActions((s) => !s)}
        actionsOpen={showActions}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Main column */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="border-b border-yo-border overflow-x-auto">
            <nav className="flex gap-1 min-w-max">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "px-3 h-10 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-2",
                      active ? "border-[#4F46E5] text-[#4338CA]" : "border-transparent text-yo-txt-2 hover:text-yo-txt",
                    )}
                  >
                    <Icon className="size-4" />
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div>
            {tab === "RESUMEN"       && <TabResumen c={counterparty} interactions={interactions} />}
            {tab === "OPERACIONES"   && <TabOperaciones c={counterparty} />}
            {tab === "INTERACCIONES" && <TabInteracciones interactions={interactions} />}
            {tab === "DOCUMENTOS"    && <TabDocumentos docs={docs} onRequest={() => setShowRequestDoc(true)} />}
            {tab === "FISCAL"        && <TabFiscal c={counterparty} />}
            {tab === "PAGOS"         && <TabPagos c={counterparty} />}
            {tab === "DISPUTAS"      && <TabDisputas c={counterparty} />}
            {tab === "AUDITORIA"     && <TabAuditoria interactions={interactions} />}
          </div>
        </div>

        {/* Right rail: Trust panel */}
        <aside className="flex flex-col gap-4">
          <TrustPanel c={counterparty} />
          <QuickActions c={counterparty} onRequestDoc={() => setShowRequestDoc(true)} />
        </aside>
      </div>

      {showRequestDoc && <RequestDocumentDialog c={counterparty} onClose={() => setShowRequestDoc(false)} />}
    </div>
  );
}

/* ─────────────── Header + Actions Menu ─────────────── */
function CounterpartyHeader({
  c, onRequestDoc, onActions, actionsOpen,
}: { c: Counterparty; onRequestDoc: () => void; onActions: () => void; actionsOpen: boolean }) {
  const status = STATUS_CFG[c.status];
  const Icon = c.personType === "PM" ? Building2 : User;

  return (
    <header className="bg-white border border-yo-border rounded-lg p-5 flex flex-col md:flex-row gap-4 md:items-center relative">
      <div className="size-14 rounded-xl bg-[#EEF2FF] text-[#4338CA] grid place-items-center shrink-0">
        <Icon className="size-7" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {c.starred && <Star className="size-4 text-[#F59E0B] fill-[#F59E0B]" />}
          <h1 className="text-[22px] font-bold text-yo-txt tracking-tight truncate">{c.displayName}</h1>
          <span className="text-[11px] font-medium px-2 py-1 rounded-full inline-flex items-center gap-1" style={{ background: status.bg, color: status.txt }}>
            <span className="size-1.5 rounded-full" style={{ background: status.dot }} />
            {status.label}
          </span>
          {c.kycVerified && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center gap-1">
              <ShieldCheck className="size-3" /> KYC verificado
            </span>
          )}
        </div>
        {c.legalName && <div className="text-[13px] text-yo-txt-2 mt-0.5">{c.legalName}</div>}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-yo-txt-2 font-mono">
          <span><span className="text-yo-txt-3">Cumplex ID:</span> {c.yoktoId}</span>
          <span><span className="text-yo-txt-3">RFC:</span> {c.rfc}</span>
          {c.curp && <span><span className="text-yo-txt-3">CURP:</span> {c.curp}</span>}
          <span className="font-sans"><span className="text-yo-txt-3">Email:</span> {c.email}</span>
          {c.phone && <span className="font-sans"><span className="text-yo-txt-3">Tel:</span> {c.phone}</span>}
          {c.city && <span className="font-sans"><span className="text-yo-txt-3">Ubicación:</span> {c.city}, {c.state}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to="/transactions/new"
          search={{ counterparty: c.id } as never}
          className="h-9 px-3 rounded-md bg-[#4F46E5] text-white text-sm font-semibold hover:bg-[#4338CA] inline-flex items-center gap-2"
        >
          <Plus className="size-4" /> Nueva operación
        </Link>
        <button
          onClick={onRequestDoc}
          className="h-9 px-3 rounded-md border border-yo-border bg-white text-sm font-medium text-yo-txt hover:bg-yo-raised inline-flex items-center gap-2"
        >
          <FileWarning className="size-4" /> Solicitar documento
        </button>
        <div className="relative">
          <button
            onClick={onActions}
            aria-label="Más acciones"
            className="h-9 w-9 grid place-items-center rounded-md border border-yo-border bg-white text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {actionsOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-white border border-yo-border rounded-md shadow-lg py-1 text-sm">
              <MenuItem icon={<Star className="size-4" />} label={c.starred ? "Quitar de frecuentes" : "Marcar frecuente"} onClick={() => toast.success("Actualizado")} />
              <MenuItem icon={<Send className="size-4" />} label="Solicitar CFDI" onClick={() => toast.success("Solicitud de CFDI enviada")} />
              <MenuItem icon={<Send className="size-4" />} label="Solicitar REP" onClick={() => toast.success("Solicitud de REP enviada")} />
              <MenuItem icon={<EyeOff className="size-4" />} label="Ocultar de lista principal" onClick={() => toast("Contraparte oculta")} />
              <MenuItem icon={<XCircle className="size-4" />} label="Bloquear contraparte" tone="danger" onClick={() => toast.error("Contraparte bloqueada")} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({ icon, label, onClick, tone }: { icon: React.ReactNode; label: string; onClick: () => void; tone?: "danger" }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2 inline-flex items-center gap-2 hover:bg-yo-raised",
        tone === "danger" && "text-[#B91C1C]",
      )}
    >
      {icon} {label}
    </button>
  );
}

/* ─────────────── Trust Panel ─────────────── */
function TrustPanel({ c }: { c: Counterparty }) {
  const trust = TRUST_CFG[c.trustLevel];
  return (
    <div className="bg-white border border-yo-border rounded-lg p-4 flex flex-col gap-3">
      <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold">Panel de confianza</div>
      <div className="text-center py-2">
        <div className="text-[44px] font-bold font-mono text-yo-txt leading-none">{c.trustScore}</div>
        <div className="text-[11px] text-yo-txt-3 mt-1">score interno /100</div>
        <span className="mt-2 inline-block text-[11px] px-2 py-0.5 rounded-full" style={{ background: trust.bg, color: trust.txt }}>
          Trust {c.trustLevel} · {trust.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TrustStat label="Ops totales"   value={String(c.metrics.totalOps)} />
        <TrustStat label="A tiempo"      value={`${Math.round(c.metrics.onTimeRate * 100)}%`} />
        <TrustStat label="Cumplimiento"  value={`${Math.round(c.metrics.complianceRate * 100)}%`} />
        <TrustStat label="Disputas"      value={String(c.metrics.disputedOps)} />
      </div>
      <div className="text-[11px] text-yo-txt-3 border-t border-yo-border pt-2">
        Vinculada {relativeTime(c.linkedAt)} vía {c.source === "OPERATION" ? "operación" : c.source === "SEARCH" ? "búsqueda" : "invitación"}.
      </div>
    </div>
  );
}
function TrustStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-yo-bg border border-yo-border rounded-md p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-yo-txt-3">{label}</div>
      <div className="text-[14px] font-semibold text-yo-txt font-mono">{value}</div>
    </div>
  );
}

function QuickActions({ c, onRequestDoc }: { c: Counterparty; onRequestDoc: () => void }) {
  return (
    <div className="bg-white border border-yo-border rounded-lg p-4 flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold">Acciones rápidas</div>
      <QA icon={<Plus className="size-4" />} label="Nueva operación prellenada" to="/transactions/new" />
      <QA icon={<FileWarning className="size-4" />} label="Solicitar documento" onClick={onRequestDoc} />
      <QA icon={<Briefcase className="size-4" />} label="Ver operaciones activas" to="/transactions" />
      <QA icon={<ClipboardCheck className="size-4" />} label="Ver aprobaciones" to="/approvals" />
      <QA icon={<AlertTriangle className="size-4" />} label="Historial de disputas" to="/disputes" />
      <QA icon={<Banknote className="size-4" />} label="Pagos y liberaciones" to="/payments" />
      <div className="text-[11px] text-yo-txt-3 pt-1">Contraparte: <span className="font-mono">{c.yoktoId}</span></div>
    </div>
  );
}
function QA({ icon, label, to, onClick }: { icon: React.ReactNode; label: string; to?: string; onClick?: () => void }) {
  const cls = "w-full h-9 px-3 rounded-md border border-yo-border text-sm text-yo-txt-2 hover:text-[#4F46E5] hover:border-[#4F46E5] inline-flex items-center gap-2 text-left";
  if (to) return <Link to={to} className={cls}>{icon}<span className="truncate">{label}</span></Link>;
  return <button onClick={onClick} className={cls}>{icon}<span className="truncate">{label}</span></button>;
}

/* ─────────────── Tabs ─────────────── */
function TabResumen({ c, interactions }: { c: Counterparty; interactions: Interaction[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Métricas comerciales">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Row label="Ops totales"   value={String(c.metrics.totalOps)} />
          <Row label="Ops activas"   value={String(c.metrics.activeOps)} />
          <Row label="Ops completadas" value={String(c.metrics.completedOps)} />
          <Row label="Ops disputadas" value={String(c.metrics.disputedOps)} />
          <Row label="Volumen total" value={formatMoney(c.metrics.totalVolumeMxn)} />
          <Row label="Ticket promedio" value={formatMoney(c.metrics.avgTicketMxn)} />
        </dl>
      </Card>
      <Card title="Perfil de cumplimiento">
        <div className="text-sm text-yo-txt-2 space-y-2">
          <div className="flex justify-between"><span>Cumplimiento a tiempo</span><span className="font-mono font-semibold text-yo-txt">{Math.round(c.metrics.onTimeRate * 100)}%</span></div>
          <div className="flex justify-between"><span>Cumplimiento documental</span><span className="font-mono font-semibold text-yo-txt">{Math.round(c.metrics.complianceRate * 100)}%</span></div>
          <div className="flex justify-between"><span>Tipo de persona</span><span className="font-semibold text-yo-txt">{c.personType}</span></div>
          <div className="flex justify-between"><span>Rol habitual</span><span className="font-semibold text-yo-txt">{c.role === "BOTH" ? "Comprador y vendedor" : c.role === "BUYER" ? "Comprador" : "Vendedor"}</span></div>
        </div>
      </Card>
      <Card title="Sectores en los que hemos operado" className="md:col-span-2">
        <div className="flex flex-wrap gap-2">
          {c.sectors.map((s) => {
            const cfg = SECTOR_CFG[s];
            return <span key={s} className="text-[12px] px-2 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.txt }}>{cfg.emoji} {cfg.label}</span>;
          })}
        </div>
      </Card>
      <Card title="Últimas interacciones" className="md:col-span-2">
        <MiniTimeline items={interactions.slice(0, 4)} />
      </Card>
    </div>
  );
}

function TabOperaciones({ c }: { c: Counterparty }) {
  const rows = [
    { id: "OP2607180005", status: "released",  amount: 520_000, at: "hace 3 días" },
    { id: "OP2607100003", status: "in_progress", amount: 740_000, at: "hace 12 días" },
    { id: "OP2606050007", status: "released",  amount: 305_000, at: "hace 45 días" },
  ].slice(0, Math.min(3, c.metrics.totalOps));
  if (rows.length === 0) return <EmptyBlock text="Aún no hay operaciones registradas con esta contraparte." />;
  return (
    <Card title="Operaciones vinculadas">
      <div className="divide-y divide-yo-border">
        {rows.map((r) => (
          <div key={r.id} className="py-3 flex items-center gap-4">
            <span className="font-mono text-[13px] text-yo-txt">{r.id}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#3730A3]">{r.status}</span>
            <span className="text-[13px] font-mono ml-auto">{formatMoney(r.amount)}</span>
            <span className="text-[11px] text-yo-txt-3">{r.at}</span>
            <Link to="/transactions" className="text-yo-txt-3 hover:text-[#4F46E5]"><ExternalLink className="size-4" /></Link>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TabInteracciones({ interactions }: { interactions: Interaction[] }) {
  if (interactions.length === 0) return <EmptyBlock text="Sin interacciones registradas." />;
  return <Card title="Línea de tiempo"><MiniTimeline items={interactions} /></Card>;
}

function TabDocumentos({ docs, onRequest }: { docs: DocumentRequest[]; onRequest: () => void }) {
  return (
    <Card
      title="Solicitudes de documentos"
      action={<button onClick={onRequest} className="text-[12px] text-[#4F46E5] font-semibold hover:underline">Solicitar documento</button>}
    >
      {docs.length === 0 ? <EmptyBlock text="Sin solicitudes registradas." /> : (
        <div className="divide-y divide-yo-border">
          {docs.map((d) => (
            <div key={d.id} className="py-3 flex items-center gap-3 text-sm">
              <FileText className="size-4 text-yo-txt-2" />
              <span className="font-medium text-yo-txt">{d.docType}</span>
              <StatusPill kind={d.status} />
              {d.note && <span className="text-[12px] text-yo-txt-2 truncate">{d.note}</span>}
              <span className="ml-auto text-[11px] text-yo-txt-3">Solicitado {relativeTime(d.requestedAt)}{d.dueAt ? ` · vence ${formatDate(d.dueAt)}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
function StatusPill({ kind }: { kind: DocumentRequest["status"] }) {
  const cfg =
    kind === "RECIBIDO"   ? { bg: "#ECFDF5", txt: "#047857", icon: <CheckCircle2 className="size-3" /> } :
    kind === "SOLICITADO" ? { bg: "#EEF2FF", txt: "#3730A3", icon: <Clock className="size-3" /> } :
    kind === "OBSERVADO"  ? { bg: "#FFFBEB", txt: "#B45309", icon: <AlertTriangle className="size-3" /> } :
                            { bg: "#FEF2F2", txt: "#B91C1C", icon: <XCircle className="size-3" /> };
  return <span className="text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: cfg.bg, color: cfg.txt }}>{cfg.icon} {kind}</span>;
}

function TabFiscal({ c }: { c: Counterparty }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="CFDI ingresados">
        <BigNumber value="24" hint="con esta contraparte" />
        <div className="text-[12px] text-yo-txt-2 mt-2">Validados contra SAT: <span className="font-mono">22</span> · Con observaciones: <span className="font-mono">2</span></div>
      </Card>
      <Card title="REP emitidos">
        <BigNumber value="18" hint="complementos de pago" />
        <div className="text-[12px] text-yo-txt-2 mt-2">Última recepción {relativeTime(c.lastInteractionAt)}</div>
      </Card>
      <div className="md:col-span-2">
        <InfoBox tone="info" title="Fiscalidad ligada a operaciones">
          Los CFDI y REP visibles aquí provienen exclusivamente de operaciones cerradas. Cumplex no expone comprobantes de otros escenarios.
        </InfoBox>
      </div>
    </div>
  );
}

function TabPagos({ c }: { c: Counterparty }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card title="Volumen pagado"><BigNumber value={formatMoney(c.metrics.totalVolumeMxn)} hint="histórico" /></Card>
      <Card title="Ticket promedio"><BigNumber value={formatMoney(c.metrics.avgTicketMxn)} hint={`sobre ${c.metrics.totalOps} ops`} /></Card>
      <Card title="Método preferido"><BigNumber value="SPEI" hint="86% de operaciones" /></Card>
    </div>
  );
}

function TabDisputas({ c }: { c: Counterparty }) {
  if (c.metrics.disputedOps === 0) {
    return <EmptyBlock text="Sin disputas registradas con esta contraparte." icon={<CheckCircle2 className="size-6 text-emerald-600" />} />;
  }
  return (
    <Card title="Historial de disputas">
      <div className="text-sm text-yo-txt-2">
        {c.metrics.disputedOps} disputa{c.metrics.disputedOps === 1 ? "" : "s"} registrada{c.metrics.disputedOps === 1 ? "" : "s"}. Consulta el módulo Disputas para el detalle.
      </div>
      <Link to="/disputes" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#4F46E5] hover:underline">
        Abrir módulo Disputas <ExternalLink className="size-3" />
      </Link>
    </Card>
  );
}

function TabAuditoria({ interactions }: { interactions: Interaction[] }) {
  return (
    <Card title="Bitácora de auditoría">
      <div className="text-[12px] text-yo-txt-2 mb-3">Todas las acciones sobre esta contraparte quedan registradas de forma inmutable.</div>
      <MiniTimeline items={interactions} showActor />
    </Card>
  );
}

/* ─────────────── Shared UI ─────────────── */
function Card({ title, action, className, children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("bg-white border border-yo-border rounded-lg p-4", className)}>
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-yo-txt">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between border-b border-dashed border-yo-border py-1"><span className="text-yo-txt-2">{label}</span><span className="font-mono font-semibold text-yo-txt">{value}</span></div>;
}
function BigNumber({ value, hint }: { value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[26px] font-bold font-mono text-yo-txt leading-none">{value}</div>
      {hint && <div className="text-[11px] text-yo-txt-3 mt-1">{hint}</div>}
    </div>
  );
}
function EmptyBlock({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white border border-dashed border-yo-border rounded-lg p-8 text-center">
      <div className="mx-auto size-10 rounded-full bg-yo-bg grid place-items-center text-yo-txt-3">{icon ?? <Info className="size-5" />}</div>
      <p className="mt-3 text-sm text-yo-txt-2">{text}</p>
    </div>
  );
}

function MiniTimeline({ items, showActor }: { items: Interaction[]; showActor?: boolean }) {
  if (items.length === 0) return <EmptyBlock text="Sin eventos registrados." />;
  return (
    <ol className="relative border-l border-yo-border pl-4 space-y-3">
      {items.map((i) => (
        <li key={i.id}>
          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full bg-white border-2 border-[#4F46E5]" />
          <div className="text-[12px] text-yo-txt-3">{relativeTime(i.at)} · {i.kind.replaceAll("_", " ")}</div>
          <div className="text-sm text-yo-txt">{i.detail}</div>
          {showActor && <div className="text-[11px] text-yo-txt-3 mt-0.5">Actor: {i.actor}{i.txId && <> · <span className="font-mono">{i.txId}</span></>}</div>}
        </li>
      ))}
    </ol>
  );
}

/* ─────────────── Request Document Dialog ─────────────── */
function RequestDocumentDialog({ c, onClose }: { c: Counterparty; onClose: () => void }) {
  const [type, setType] = useState<DocumentRequest["docType"]>("CFDI");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); toast.success(`Solicitud enviada a ${c.displayName}`); onClose(); }}
        className="bg-white border border-yo-border rounded-lg w-full max-w-md p-5 flex flex-col gap-4"
      >
        <div>
          <h3 className="text-base font-semibold text-yo-txt">Solicitar documento</h3>
          <p className="text-[12px] text-yo-txt-2">La contraparte recibirá una notificación y quedará auditado en su expediente.</p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-yo-txt-2 font-medium">Tipo de documento</span>
          <select value={type} onChange={(e) => setType(e.target.value as DocumentRequest["docType"])} className="h-10 px-3 rounded-md border border-yo-border text-sm bg-white focus:outline-none focus:border-[#4F46E5]">
            <option value="CFDI">CFDI</option>
            <option value="REP">Complemento de pago (REP)</option>
            <option value="CONTRATO">Contrato firmado</option>
            <option value="IDENT">Identificación oficial</option>
            <option value="COMPROBANTE_DOMICILIO">Comprobante de domicilio</option>
            <option value="CONSTANCIA_FISCAL">Constancia de situación fiscal</option>
            <option value="OTRO">Otro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-yo-txt-2 font-medium">Fecha límite (opcional)</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-10 px-3 rounded-md border border-yo-border text-sm focus:outline-none focus:border-[#4F46E5]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-yo-txt-2 font-medium">Nota (opcional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={400} className="px-3 py-2 rounded-md border border-yo-border text-sm resize-none focus:outline-none focus:border-[#4F46E5]" />
        </label>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-10 px-3 rounded-md border border-yo-border bg-white text-sm text-yo-txt-2 hover:text-yo-txt">Cancelar</button>
          <button type="submit" className="h-10 px-4 rounded-md bg-[#4F46E5] text-white text-sm font-semibold hover:bg-[#4338CA] inline-flex items-center gap-2">
            <Send className="size-4" /> Enviar solicitud
          </button>
        </div>
      </form>
    </div>
  );
}
