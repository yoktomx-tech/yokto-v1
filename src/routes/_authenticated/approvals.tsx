import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ClipboardCheck, RefreshCw, Download, BookOpen, Search, Filter,
  ChevronRight, X, CheckCircle2, AlertTriangle, XCircle, MessageSquareWarning,
  FileText, Image as ImageIcon, MapPin, Clock, ExternalLink, Info, Lock,
  Circle, ShieldAlert, FileSignature, ReceiptText, PackageCheck, LayoutList,
  History, Minus,
} from "lucide-react";
import { useViewRole } from "@/hooks/use-view-role";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import {
  MOCK_APPROVALS, STATUS_CFG, SECTOR_CFG, formatMoney, daysUntil,
  CHECKLIST_LABELS, CHECK_CFG, CONTRACT_STATUS_LABEL, FISCAL_STATUS_LABEL,
  LOCK_LABEL, SECTOR_REQ_TONE, computeReleaseImpact,
  type Approval, type ApprovalStatus, type ApprovalChecklist, type CheckState,
  type ApprovalLock, type REPInfo, type SectorRequirement,
} from "@/lib/approvals-mock";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({ meta: [{ title: "Aprobaciones — Cumplex" }, { name: "robots", content: "noindex" }] }),
  component: ApprovalsPage,
});

type TabKey =
  | "POR_REVISAR"
  | "LISTAS"
  | "BLOQUEADAS"
  | "CORRECCIONES"
  | "FISCAL"
  | "CONTRATOS"
  | "SECTORIALES"
  | "HISTORIAL";

const TABS: { key: TabKey; label: string }[] = [
  { key: "POR_REVISAR",  label: "Por revisar" },
  { key: "LISTAS",       label: "Listas para liberar" },
  { key: "BLOQUEADAS",   label: "Bloqueadas" },
  { key: "CORRECCIONES", label: "Correcciones solicitadas" },
  { key: "FISCAL",       label: "Fiscal CFDI/REP" },
  { key: "CONTRATOS",    label: "Contratos y firmas" },
  { key: "SECTORIALES",  label: "Sectoriales" },
  { key: "HISTORIAL",    label: "Historial" },
];

type DecisionKind = "APPROVE" | "CORRECT" | "REJECT" | "DISPUTE";
type FiscalDecision = { kind: "CFDI_ACCEPT" | "CFDI_REJECT" | "REP_ACCEPT" | "REP_REJECT"; approvalId: string; repId?: string };

function ApprovalsPage() {
  const { role } = useViewRole();
  const [tab, setTab] = useState<TabKey>("POR_REVISAR");
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState<string>("ALL");
  const [risk, setRisk] = useState<string>("ALL");
  const [selected, setSelected] = useState<Approval | null>(null);
  const [decision, setDecision] = useState<{ kind: DecisionKind; a: Approval } | null>(null);
  const [fiscalDecision, setFiscalDecision] = useState<FiscalDecision | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>(MOCK_APPROVALS);

  if (role !== "buyer") return <SellerBlock />;

  const filtered = useMemo(() => {
    return approvals.filter((a) => {
      // Tab filters
      if (tab === "POR_REVISAR" && a.status !== "POR_REVISAR") return false;
      if (tab === "LISTAS" && a.status !== "LISTO") return false;
      if (tab === "BLOQUEADAS" && a.status !== "BLOQUEADO") return false;
      if (tab === "CORRECCIONES" && a.status !== "CORRECCION_SOLICITADA") return false;
      if (tab === "HISTORIAL" && !["APROBADO", "RECHAZADO", "DISPUTA"].includes(a.status)) return false;
      if (tab === "FISCAL") {
        const cfdiPending = a.fiscal.cfdi.status === "CFDI_EN_REVISION";
        const repPending = a.fiscal.reps.some((r) => r.status === "REP_EN_REVISION" || r.status === "REP_PENDIENTE");
        if (!cfdiPending && !repPending) return false;
      }
      if (tab === "CONTRATOS" && a.contract.status === "FIRMADO_COMPLETO") return false;
      if (tab === "SECTORIALES" && a.sector_requirements.every((s) => s.status === "COMPLETO")) return false;

      if (sector !== "ALL" && a.sector !== sector) return false;
      if (risk !== "ALL" && a.risk_level !== risk) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!(
          a.transaction_folio.toLowerCase().includes(q) ||
          a.transaction_title.toLowerCase().includes(q) ||
          a.seller_name.toLowerCase().includes(q) ||
          a.milestone_title.toLowerCase().includes(q) ||
          a.approval_folio.toLowerCase().includes(q) ||
          a.seller_rfc.toLowerCase().includes(q) ||
          (a.fiscal.cfdi.uuid ?? "").toLowerCase().includes(q)
        )) return false;
      }
      return true;
    });
  }, [approvals, tab, sector, risk, query]);

  const metrics = useMemo(() => {
    const porRevisar = approvals.filter((a) => a.status === "POR_REVISAR").length;
    const listas = approvals.filter((a) => a.status === "LISTO");
    const bloqueadas = approvals.filter((a) => a.status === "BLOQUEADO").length;
    const conRiesgo = approvals.filter((a) => a.risk_level === "ALTO" || a.risk_level === "CRITICO").length;
    const vencidas = approvals.filter((a) => daysUntil(a.due_at) < 0 && !["APROBADO", "RECHAZADO"].includes(a.status)).length;
    const montoPendiente = approvals
      .filter((a) => ["POR_REVISAR", "LISTO", "BLOQUEADO"].includes(a.status))
      .reduce((s, a) => s + a.associated_amount, 0);
    const montoListo = listas.reduce((s, a) => s + a.associated_amount, 0);
    return { porRevisar, listasCount: listas.length, montoListo, bloqueadas, conRiesgo, vencidas, montoPendiente };
  }, [approvals]);

  const applyDecision = (kind: DecisionKind, a: Approval) => {
    const nextStatus: ApprovalStatus =
      kind === "APPROVE" ? "APROBADO" :
      kind === "CORRECT" ? "CORRECCION_SOLICITADA" :
      kind === "REJECT" ? "RECHAZADO" :
      "DISPUTA";
    setApprovals((prev) => prev.map((x) => x.id === a.id ? { ...x, status: nextStatus } : x));
    setSelected((s) => s && s.id === a.id ? { ...s, status: nextStatus } : s);
    setDecision(null);
    if (kind === "APPROVE") {
      toast.success(`${a.approval_folio}: aprobado. Orden de liberación enviada a la pasarela.`);
    } else {
      toast.success(`${a.approval_folio}: ${STATUS_CFG[nextStatus].label.toLowerCase()}`);
    }
  };

  const applyFiscalDecision = (fd: FiscalDecision) => {
    setApprovals((prev) => prev.map((x) => {
      if (x.id !== fd.approvalId) return x;
      const next = { ...x, fiscal: { ...x.fiscal } };
      if (fd.kind === "CFDI_ACCEPT") {
        next.fiscal.cfdi = { ...next.fiscal.cfdi, status: "CFDI_ACEPTADO" };
      } else if (fd.kind === "CFDI_REJECT") {
        next.fiscal.cfdi = { ...next.fiscal.cfdi, status: "CFDI_RECHAZADO" };
      } else if (fd.kind === "REP_ACCEPT" || fd.kind === "REP_REJECT") {
        next.fiscal.reps = next.fiscal.reps.map((r) =>
          r.id === fd.repId ? { ...r, status: fd.kind === "REP_ACCEPT" ? "REP_ACEPTADO" : "REP_RECHAZADO" } : r
        );
      }
      return next;
    }));
    setSelected((s) => {
      if (!s || s.id !== fd.approvalId) return s;
      const next = { ...s, fiscal: { ...s.fiscal } };
      if (fd.kind === "CFDI_ACCEPT") next.fiscal.cfdi = { ...next.fiscal.cfdi, status: "CFDI_ACEPTADO" };
      if (fd.kind === "CFDI_REJECT") next.fiscal.cfdi = { ...next.fiscal.cfdi, status: "CFDI_RECHAZADO" };
      if (fd.kind === "REP_ACCEPT" || fd.kind === "REP_REJECT") {
        next.fiscal.reps = next.fiscal.reps.map((r) =>
          r.id === fd.repId ? { ...r, status: fd.kind === "REP_ACCEPT" ? "REP_ACEPTADO" : "REP_RECHAZADO" } : r
        );
      }
      return next;
    });
    setFiscalDecision(null);
    toast.success(fd.kind.startsWith("CFDI") ? "CFDI actualizado" : "REP actualizado");
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <PageHeader
          icon={ClipboardCheck}
          title="Aprobaciones"
          subtitle="Revisa los requisitos cumplidos por el vendedor antes de aprobar hitos y ordenar liberaciones."
          actions={
            <>
              <BtnSecondary icon={RefreshCw} onClick={() => toast.info("Bandeja actualizada")}>Actualizar</BtnSecondary>
            </>
          }
        />


        {/* Metrics */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard title="Por revisar"        value={metrics.porRevisar}                     hint="Hitos enviados por vendedor" accent="#4F46E5" />
          <MetricCard title="Listas para liberar" value={metrics.listasCount}                    hint={`${formatMoney(metrics.montoListo)} asociados`} accent="#059669" />
          <MetricCard title="Bloqueadas"         value={metrics.bloqueadas}                     hint="Falta contrato, CFDI, evidencia o sector" accent="#D97706" />
          <MetricCard title="Con riesgo alto"    value={metrics.conRiesgo}                      hint="Requieren revisión reforzada" accent="#DC2626" />
          <MetricCard title="Vencidas"           value={metrics.vencidas}                       hint="SLA vencido" accent="#DC2626" />
          <MetricCard title="Monto pendiente"    value={formatMoney(metrics.montoPendiente)}    hint="Asociado a aprobaciones abiertas" accent="#52525B" mono />
        </section>

        {/* Tabs */}
        <div className="overflow-x-auto">
          <div className="inline-flex bg-yo-surface border border-yo-border rounded-lg p-1 gap-0.5">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn("px-3 py-1.5 rounded-md text-[12.5px] font-medium whitespace-nowrap transition",
                  tab === t.key ? "bg-yo-ac-bg text-yo-ac-txt" : "text-yo-txt-2 hover:bg-yo-raised")}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="size-4 text-yo-txt-3 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por operación, vendedor, RFC, hito, folio o UUID..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-yo-border bg-yo-raised text-[13px] text-yo-txt placeholder:text-yo-txt-3 focus:outline-none focus:border-yo-ac focus:bg-yo-surface" />
          </div>
          <Select value={sector} onChange={setSector}
            options={[{ v: "ALL", l: "Todos los sectores" }, ...Object.entries(SECTOR_CFG).map(([k, v]) => ({ v: k, l: v.label }))]} />
          <Select value={risk} onChange={setRisk}
            options={[{ v: "ALL", l: "Riesgo (todos)" }, { v: "BAJO", l: "Bajo" }, { v: "MEDIO", l: "Medio" }, { v: "ALTO", l: "Alto" }, { v: "CRITICO", l: "Crítico" }]} />
          <BtnSecondary icon={Filter}>Más filtros</BtnSecondary>
        </div>

        {/* Cards list */}
        {filtered.length === 0 ? (
          <EmptyState tab={tab} onClear={() => { setQuery(""); setSector("ALL"); setRisk("ALL"); setTab("POR_REVISAR"); }} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((a) => (
              <ApprovalCard key={a.id} a={a} onOpen={() => setSelected(a)} />
            ))}
          </div>
        )}

        <p className="text-[11px] text-yo-txt-3">
          Cumplex no custodia fondos. Cuando apruebas un hito, la orden de liberación se envía a la pasarela de pagos configurada.
        </p>
      </div>

      {selected && (
        <ApprovalDrawer
          a={selected}
          onClose={() => setSelected(null)}
          onDecision={(kind) => setDecision({ kind, a: selected })}
          onFiscalDecision={(fd) => setFiscalDecision(fd)}
        />
      )}

      {decision && (
        <DecisionModal
          kind={decision.kind} a={decision.a}
          onClose={() => setDecision(null)}
          onConfirm={() => applyDecision(decision.kind, decision.a)}
        />
      )}

      {fiscalDecision && (
        <FiscalRejectModal
          fd={fiscalDecision}
          onClose={() => setFiscalDecision(null)}
          onConfirm={() => applyFiscalDecision(fiscalDecision)}
        />
      )}
    </>
  );
}

/* ─────────────── Card ─────────────── */

function ApprovalCard({ a, onOpen }: { a: Approval; onOpen: () => void }) {
  const c = SECTOR_CFG[a.sector];
  const okCount = (Object.values(a.checklist) as CheckState[]).filter((s) => s === "OK" || s === "NOT_REQUIRED").length;
  const isReady = a.status === "LISTO";
  return (
    <div className="relative bg-yo-surface border border-yo-border rounded-lg overflow-hidden">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: isReady ? "#059669" : c.color }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px]">{c.emoji}</span>
              <span className="font-mono text-[11px] text-yo-txt-3">{a.transaction_folio}</span>
              <StatusBadge status={a.status} />
            </div>
            <h3 className="mt-1 text-[14px] font-semibold text-yo-txt truncate">
              Hito {a.milestone_order}: {a.milestone_title}
            </h3>
            <p className="text-[12px] text-yo-txt-2 mt-0.5 truncate">
              Vendedor: <span className="text-yo-txt">{a.seller_name}</span> · <span className="font-mono">{a.seller_rfc}</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-yo-txt-3">
              {isReady ? "Monto a liberar" : "Monto asociado"}
            </div>
            <div className="font-mono tabular-nums text-yo-txt font-semibold">{formatMoney(a.associated_amount, a.currency)}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-[11.5px] text-yo-txt-2 flex-wrap">
          <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3.5 text-[#059669]" />Checklist {okCount}/9</span>
          <RiskBadge level={a.risk_level} />
          <DueChip iso={a.due_at} />
        </div>

        {a.locks.length > 0 ? (
          <div className="mt-3 rounded-md border border-[#FEF3C7] bg-[#FFFBEB] px-3 py-2 flex items-start gap-2">
            <Lock className="size-3.5 text-[#D97706] shrink-0 mt-0.5" />
            <div className="text-[11.5px] text-[#92400E] min-w-0">
              <div className="font-medium">{a.locks.length} candado{a.locks.length > 1 ? "s" : ""} activo{a.locks.length > 1 ? "s" : ""}</div>
              <div className="truncate">{a.locks.slice(0, 2).map((l) => LOCK_LABEL[l.type]).join(" · ")}{a.locks.length > 2 && ` +${a.locks.length - 2}`}</div>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-[#DCFCE7] bg-[#F0FDF4] px-3 py-2 text-[11.5px] text-[#166534] flex items-center gap-2">
            <CheckCircle2 className="size-3.5" />
            Todo el cumplimiento requerido está completo.
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {isReady ? (
            <button onClick={onOpen} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-[13px] font-semibold">
              <CheckCircle2 className="size-4" /> Aprobar y ordenar liberación
            </button>
          ) : (
            <button onClick={onOpen} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-[13px] font-semibold">
              Revisar aprobación <ChevronRight className="size-4" />
            </button>
          )}
          <Link to="/transactions"
            className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-yo-border bg-yo-surface hover:bg-yo-raised text-yo-txt text-[12.5px] font-medium">
            Ver operación
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Drawer ─────────────── */

type DrawerTab = "resumen" | "checklist" | "contrato" | "fiscal" | "docs" | "evidencia" | "sectorial" | "candados" | "observaciones";

function ApprovalDrawer({
  a, onClose, onDecision, onFiscalDecision,
}: {
  a: Approval;
  onClose: () => void;
  onDecision: (k: DecisionKind) => void;
  onFiscalDecision: (fd: FiscalDecision) => void;
}) {
  const [dtab, setDtab] = useState<DrawerTab>("resumen");
  const criticalLocks = a.locks.filter((l) => l.blocksApproval);
  const canApprove = criticalLocks.length === 0 && !["APROBADO", "RECHAZADO", "DISPUTA"].includes(a.status);
  const isFinal = ["APROBADO", "RECHAZADO"].includes(a.status);
  const impact = computeReleaseImpact(a);

  const TABS_D: { k: DrawerTab; l: string; badge?: number }[] = [
    { k: "resumen",       l: "Resumen" },
    { k: "checklist",     l: "Checklist" },
    { k: "candados",      l: `Candados${a.locks.length ? ` (${a.locks.length})` : ""}` },
    { k: "contrato",      l: "Contrato y firmas" },
    { k: "fiscal",        l: "Fiscal CFDI/REP" },
    { k: "sectorial",     l: "Sectoriales" },
    { k: "docs",          l: "Documentos" },
    { k: "evidencia",     l: "Evidencia" },
    { k: "observaciones", l: "Bitácora" },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 w-full lg:w-[920px] bg-yo-surface border-l border-yo-border shadow-xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-yo-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] text-yo-txt-3">{a.approval_folio}</span>
                <StatusBadge status={a.status} />
                <RiskBadge level={a.risk_level} />
              </div>
              <h2 className="text-lg font-semibold text-yo-txt mt-1 truncate">
                Hito {a.milestone_order}: {a.milestone_title}
              </h2>
              <div className="text-[12px] text-yo-txt-2 mt-0.5">
                <span className="font-mono">{a.transaction_folio}</span> · {a.transaction_title} · {a.seller_name} <span className="font-mono">({a.seller_rfc})</span>
              </div>
              <div className="mt-1.5"><SectorPill sector={a.sector} /></div>
            </div>
            <button onClick={onClose} className="size-8 rounded-md hover:bg-yo-raised grid place-items-center shrink-0">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 border-b border-yo-border overflow-x-auto">
          <div className="flex gap-1 py-2">
            {TABS_D.map((t) => (
              <button key={t.k} onClick={() => setDtab(t.k)}
                className={cn("px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition",
                  dtab === t.k ? "bg-yo-ac-bg text-yo-ac-txt" : "text-yo-txt-2 hover:bg-yo-raised")}>
                {t.l}
              </button>
            ))}
          </div>
        </div>

        {/* Body 70/30 */}
        <div className="flex-1 overflow-hidden flex">
          {/* Main 70% */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 min-w-0">
            {dtab === "resumen" &&    <ResumenSection a={a} />}
            {dtab === "checklist" &&  <ChecklistSection cl={a.checklist} />}
            {dtab === "candados" &&   <CandadosSection locks={a.locks} />}
            {dtab === "contrato" &&   <ContratoSection a={a} />}
            {dtab === "fiscal" &&     <FiscalSection a={a} onDecide={onFiscalDecision} />}
            {dtab === "sectorial" &&  <SectorialSection a={a} />}
            {dtab === "docs" &&       <DocsSection a={a} />}
            {dtab === "evidencia" &&  <EvidenciaSection a={a} />}
            {dtab === "observaciones" && <BitacoraSection a={a} />}
          </div>

          {/* Right side 30% (sticky panel) */}
          <div className="hidden lg:flex w-[300px] border-l border-yo-border bg-yo-raised/40 flex-col">
            <div className="p-4 overflow-y-auto space-y-4 text-[12.5px]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold">Impacto de esta aprobación</div>
                <div className="mt-2 space-y-1.5 font-mono tabular-nums">
                  <Row k="Monto del hito"       v={formatMoney(impact.gross, a.currency)} strong />
                  <Row k="Comisión"             v={formatMoney(impact.commission, a.currency)} />
                  <Row k="IVA comisión"         v={formatMoney(impact.vat, a.currency)} />
                  <div className="h-px bg-yo-border my-1" />
                  <Row k="Neto al vendedor"     v={formatMoney(impact.net, a.currency)} strong ok />
                  <Row k="Saldo retenido rest." v={formatMoney(impact.heldAfter, a.currency)} />
                </div>
              </div>

              <div className="rounded-md border border-yo-border bg-yo-surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-1.5">Estado fiscal</div>
                <div className="text-[11.5px] text-yo-txt-2">CFDI PPD: <span className="font-medium text-yo-txt">{FISCAL_STATUS_LABEL[a.fiscal.cfdi.status]}</span></div>
                <div className="text-[11.5px] text-yo-txt-2">REPs: <span className="font-medium text-yo-txt">{a.fiscal.reps.filter((r) => r.status === "REP_ACEPTADO").length}/{a.fiscal.reps.length} aceptados</span></div>
              </div>

              <div className="rounded-md border border-yo-border bg-yo-surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-1.5">Contrato</div>
                <div className="text-[11.5px] text-yo-txt-2">{CONTRACT_STATUS_LABEL[a.contract.status]} · v{a.contract.version}</div>
              </div>

              <div className="rounded-md border border-yo-border bg-yo-surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-1.5">Candados</div>
                {a.locks.length === 0 ? (
                  <div className="text-[11.5px] text-[#059669] flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Sin candados activos</div>
                ) : (
                  <ul className="space-y-1 text-[11.5px] text-[#92400E]">
                    {a.locks.map((l, i) => <li key={i} className="flex gap-1"><span>•</span><span>{LOCK_LABEL[l.type]}</span></li>)}
                  </ul>
                )}
              </div>

              <p className="text-[10.5px] text-yo-txt-3 leading-relaxed">
                La liberación será procesada por la pasarela de pago configurada. Cumplex no custodia fondos.
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-yo-border bg-yo-raised/60 space-y-2">
          {isFinal ? (
            <div className="text-[12px] text-yo-txt-2 text-center">Esta aprobación ya tiene decisión final.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={!canApprove} onClick={() => onDecision("APPROVE")}
                  className={cn("inline-flex items-center justify-center gap-1.5 h-10 rounded-md text-[13px] font-semibold text-white transition",
                    canApprove ? "bg-yo-ac hover:bg-yo-ac-h" : "bg-[#A1A1AA] cursor-not-allowed")}
                  title={canApprove ? "" : "No puedes aprobar con candados activos"}>
                  {canApprove ? <CheckCircle2 className="size-4" /> : <Lock className="size-4" />}
                  {canApprove ? "Aprobar y ordenar liberación" : "No se puede aprobar todavía"}
                </button>
                <button onClick={() => onDecision("CORRECT")}
                  className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md text-[13px] font-semibold border transition"
                  style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A", color: "#B45309" }}>
                  <MessageSquareWarning className="size-4" /> Solicitar corrección
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onDecision("REJECT")}
                  className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md text-[13px] font-semibold border transition"
                  style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA", color: "#B91C1C" }}>
                  <XCircle className="size-4" /> Rechazar hito
                </button>
                <button onClick={() => onDecision("DISPUTE")}
                  className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md text-[13px] font-semibold border border-yo-border bg-yo-surface hover:bg-yo-raised text-yo-txt transition">
                  <ShieldAlert className="size-4" /> Abrir disputa
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

/* ─────────────── Drawer sections ─────────────── */

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: any }) {
  return (
    <h3 className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2 flex items-center gap-1.5">
      {Icon && <Icon className="size-3.5" />} {children}
    </h3>
  );
}

function ResumenSection({ a }: { a: Approval }) {
  return (
    <>
      <div className="rounded-md border p-3 flex gap-2.5" style={{ backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" }}>
        <Info className="size-4 shrink-0 mt-0.5" style={{ color: "#0284C7" }} />
        <div className="text-[12.5px] space-y-1" style={{ color: "#075985" }}>
          <p><strong>Antes de aprobar:</strong> revisa contrato firmado, evidencias del hito, CFDI/REP y requisitos sectoriales. Los candados en rojo bloquean la aprobación hasta ser resueltos; los amarillos son advertencias que puedes aprobar dejando constancia del motivo.</p>
          <p>Al aprobar, Cumplex ordena a la pasarela liberar la parte correspondiente del pago retenido. Cumplex no custodia fondos: la pasarela ejecuta la liberación conforme a las reglas de la operación.</p>
        </div>
      </div>
      <section>
        <SectionTitle icon={LayoutList}>Resumen del hito</SectionTitle>
        <div className="rounded-md border border-yo-border p-3 space-y-1.5 text-[12.5px]">
          <Row k="Operación" v={a.transaction_folio} mono />
          <Row k="Título" v={a.transaction_title} />
          <Row k="Hito" v={`${a.milestone_order} — ${a.milestone_title}`} />
          <Row k="Sector" v={SECTOR_CFG[a.sector].label} />
          <Row k="Vendedor" v={`${a.seller_name} (${a.seller_rfc})`} />
          <Row k="Fecha límite" v={new Date(a.due_at).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })} />
          <Row k="Enviado a revisión" v={new Date(a.submitted_at).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })} />
          <Row k="Cumplimiento" v={`${a.compliance_percent}%`} />
        </div>
      </section>
      {a.seller_comment && (
        <section>
          <SectionTitle>Comentario del vendedor</SectionTitle>
          <div className="text-[13px] text-yo-txt-2 bg-yo-raised p-3 rounded-md">{a.seller_comment}</div>
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        <Link to="/transactions" className="inline-flex items-center gap-1 text-[12.5px] text-yo-ac hover:text-yo-ac-h font-medium">
          <ExternalLink className="size-3.5" /> Ver operación completa
        </Link>
        <Link to="/payments" className="inline-flex items-center gap-1 text-[12.5px] text-yo-ac hover:text-yo-ac-h font-medium">
          <ExternalLink className="size-3.5" /> Ver pago asociado
        </Link>
      </div>
    </>
  );
}

function ChecklistSection({ cl }: { cl: ApprovalChecklist }) {
  const entries = Object.entries(cl) as [keyof ApprovalChecklist, CheckState][];
  return (
    <section>
      <SectionTitle icon={CheckCircle2}>Checklist para aprobar</SectionTitle>
      <ul className="divide-y divide-yo-border rounded-md border border-yo-border overflow-hidden bg-yo-surface">
        {entries.map(([k, state]) => {
          const cfg = CHECK_CFG[state];
          return (
            <li key={k} className="p-3 flex items-center gap-3">
              <CheckIcon state={state} />
              <div className="flex-1 text-[13px] text-yo-txt">{CHECKLIST_LABELS[k]}</div>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                {cfg.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CheckIcon({ state }: { state: CheckState }) {
  const cfg = CHECK_CFG[state];
  if (cfg.icon === "ok") return <CheckCircle2 className="size-4 shrink-0" style={{ color: cfg.color }} />;
  if (cfg.icon === "warn") return <AlertTriangle className="size-4 shrink-0" style={{ color: cfg.color }} />;
  if (cfg.icon === "err") return <XCircle className="size-4 shrink-0" style={{ color: cfg.color }} />;
  if (cfg.icon === "pending") return <Circle className="size-4 shrink-0" style={{ color: cfg.color }} />;
  return <Minus className="size-4 shrink-0" style={{ color: cfg.color }} />;
}

function CandadosSection({ locks }: { locks: ApprovalLock[] }) {
  if (locks.length === 0) {
    return (
      <div className="rounded-md border border-[#DCFCE7] bg-[#F0FDF4] p-4 text-[12.5px] text-[#166534]">
        <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4" /> Sin candados activos</div>
        <p className="mt-1 text-[11.5px] text-[#166534]/80">Puedes aprobar este hito y ordenar la liberación.</p>
      </div>
    );
  }
  return (
    <section>
      <div className="rounded-md border border-[#FEF3C7] bg-[#FFFBEB] p-3 text-[12px] text-[#92400E] flex gap-2 mb-3">
        <Lock className="size-4 mt-0.5" />
        <div>Este hito no puede aprobarse todavía. Resuelve los candados o solicita corrección al vendedor.</div>
      </div>
      <ul className="space-y-2">
        {locks.map((l, i) => (
          <li key={i} className="rounded-md border border-yo-border p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" style={{ color: "#D97706" }} />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-yo-txt">{LOCK_LABEL[l.type]}</div>
                {l.detail && <div className="text-[11.5px] text-yo-txt-2 mt-0.5">{l.detail}</div>}
                <div className="mt-1.5 flex gap-1.5 flex-wrap">
                  {l.blocksApproval && <span className="text-[10.5px] font-medium bg-[#FEF2F2] text-[#DC2626] rounded-full px-2 py-0.5">Bloquea aprobación</span>}
                  {l.blocksRelease && <span className="text-[10.5px] font-medium bg-[#FFFBEB] text-[#D97706] rounded-full px-2 py-0.5">Bloquea liberación</span>}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ContratoSection({ a }: { a: Approval }) {
  const c = a.contract;
  const tone = c.status === "FIRMADO_COMPLETO" ? { bg: "#ECFDF5", txt: "#047857" } :
    c.status === "RECHAZADO" ? { bg: "#FEF2F2", txt: "#B91C1C" } :
    c.status === "EN_FIRMA" || c.status === "FIRMADO_PARCIAL" ? { bg: "#F0F9FF", txt: "#075985" } :
    { bg: "#F4F4F5", txt: "#52525B" };
  return (
    <section className="space-y-3">
      <div className="rounded-md border border-yo-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold">Contrato de la operación</div>
            <div className="mt-0.5 text-[13px] font-semibold text-yo-txt">
              {c.method === "GENERADO_AUTOMATICO" ? "Generado automáticamente" : "PDF subido"} · {c.templateName ?? "—"}
            </div>
            <div className="mt-1 text-[11.5px] text-yo-txt-2">
              Versión <span className="font-mono">v{c.version}</span> · Hash SHA-256 <span className="font-mono text-yo-txt-3">{c.hash}</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: tone.bg, color: tone.txt }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" /> {CONTRACT_STATUS_LABEL[c.status]}
          </span>
        </div>
      </div>

      <div className="rounded-md border border-yo-border overflow-hidden">
        <div className="px-3 py-2 border-b border-yo-border bg-yo-raised/40 text-[11px] font-medium text-yo-txt-2">Firmas</div>
        <ul className="divide-y divide-yo-border">
          {c.signatures.map((s, i) => (
            <li key={i} className="p-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-yo-txt">
                  {s.party === "COMPRADOR" ? "Comprador" : "Vendedor"} — {s.name}
                </div>
                <div className="text-[11px] text-yo-txt-3 mt-0.5">
                  {s.method === "EFIRMA_SAT" ? `e.firma SAT${s.rfc ? ` · RFC ${s.rfc}` : ""}` :
                   s.method === "AUTOGRAFA_DIGITAL_BIOMETRICA" ? `Autógrafa digital + biometría${s.faceMatch ? ` · Face match ${s.faceMatch}%` : ""}` :
                   "Método por definir"}
                  {s.signedAt && <> · {new Date(s.signedAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</>}
                </div>
              </div>
              {s.signed ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#059669] bg-[#ECFDF5] rounded-full px-2 py-0.5">
                  <CheckCircle2 className="size-3" /> Firmado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#D97706] bg-[#FFFBEB] rounded-full px-2 py-0.5">
                  <Clock className="size-3" /> Pendiente
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="h-8 px-3 rounded-md border border-yo-border bg-yo-surface text-xs font-medium text-yo-txt hover:border-yo-border-s">
          <FileSignature className="inline size-3.5 mr-1" /> Ver contrato
        </button>
        <button className="h-8 px-3 rounded-md border border-yo-border bg-yo-surface text-xs font-medium text-yo-txt hover:border-yo-border-s">
          <Download className="inline size-3.5 mr-1" /> Descargar PDF
        </button>
        <button className="h-8 px-3 rounded-md border border-yo-border bg-yo-surface text-xs font-medium text-yo-txt hover:border-yo-border-s">
          Ver evidencia de firma
        </button>
        {c.signatures.some((s) => s.party === "VENDEDOR" && !s.signed) && (
          <button className="h-8 px-3 rounded-md border border-[#FDE68A] bg-[#FFFBEB] text-xs font-medium text-[#B45309]">
            Recordar firma al vendedor
          </button>
        )}
      </div>

      <div className="rounded-md border border-yo-border bg-yo-raised/40 p-3 text-[11.5px] text-yo-txt-2">
        El contrato firmado forma parte del expediente. Si existe una nueva versión, las firmas previas pueden dejar de ser suficientes.
      </div>
    </section>
  );
}

function FiscalSection({ a, onDecide }: { a: Approval; onDecide: (fd: FiscalDecision) => void }) {
  const f = a.fiscal;
  const cfdiTone = f.cfdi.status === "CFDI_ACEPTADO" ? { bg: "#ECFDF5", txt: "#047857" }
    : f.cfdi.status === "CFDI_RECHAZADO" ? { bg: "#FEF2F2", txt: "#B91C1C" }
    : f.cfdi.status === "SIN_CFDI" ? { bg: "#F4F4F5", txt: "#52525B" }
    : { bg: "#F0F9FF", txt: "#075985" };

  return (
    <section className="space-y-3">
      <div className="rounded-md border border-[#FEF3C7] bg-[#FFFBEB] p-3 text-[12px] text-[#92400E] flex gap-2">
        <Info className="size-4 mt-0.5" />
        <div>Cumplex valida CFDI/REP subidos por el vendedor, pero no los emite ni sustituye al PAC del proveedor.</div>
      </div>

      {/* CFDI PPD */}
      <div className="rounded-md border border-yo-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold">CFDI PPD inicial</div>
            <div className="mt-0.5 text-[13px] font-semibold text-yo-txt">
              {f.cfdi.uuid ? <span className="font-mono text-[12px]">{f.cfdi.uuid}</span> : "Aún no subido"}
            </div>
            <div className="mt-1 text-[11.5px] text-yo-txt-2">
              Emisor <span className="font-mono">{f.emisorRfc}</span> · Receptor <span className="font-mono">{f.receptorRfc}</span>
            </div>
            <div className="text-[11.5px] text-yo-txt-2 mt-0.5">
              Total <span className="font-mono">{formatMoney(f.totalOperacion)}</span> · Método <span className="font-mono">{f.cfdi.metodoPago ?? "PPD"}</span> · Forma <span className="font-mono">{f.cfdi.formaPago ?? "99"}</span> · Uso <span className="font-mono">{f.usoCfdi}</span>
            </div>
            {f.cfdi.estadoSAT && <div className="text-[11.5px] text-yo-txt-2 mt-0.5">Estado SAT: <span className="text-yo-txt font-medium">{f.cfdi.estadoSAT}</span> · Coherencia {f.cfdi.coherenceScore}/100</div>}
            {f.cfdi.observacion && <div className="mt-1 text-[11.5px] text-[#B45309]">{f.cfdi.observacion}</div>}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap" style={{ backgroundColor: cfdiTone.bg, color: cfdiTone.txt }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" /> {FISCAL_STATUS_LABEL[f.cfdi.status]}
          </span>
        </div>

        {f.cfdi.checks.length > 0 && (
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11.5px]">
            {f.cfdi.checks.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-yo-txt-2">
                <CheckIcon state={c.state} /> {c.label}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button className="h-8 px-3 rounded-md border border-yo-border text-[11.5px] font-medium text-yo-txt">Ver XML</button>
          <button className="h-8 px-3 rounded-md border border-yo-border text-[11.5px] font-medium text-yo-txt">Ver PDF</button>
          {f.cfdi.status === "CFDI_EN_REVISION" && (
            <>
              <button onClick={() => onDecide({ kind: "CFDI_ACCEPT", approvalId: a.id })} className="h-8 px-3 rounded-md bg-[#059669] text-white text-[11.5px] font-semibold">
                Aceptar CFDI
              </button>
              <button onClick={() => onDecide({ kind: "CFDI_REJECT", approvalId: a.id })} className="h-8 px-3 rounded-md border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] text-[11.5px] font-semibold">
                Rechazar CFDI
              </button>
            </>
          )}
        </div>
      </div>

      {/* REPs */}
      <div className="rounded-md border border-yo-border overflow-hidden">
        <div className="px-3 py-2 border-b border-yo-border bg-yo-raised/40 text-[11px] font-medium text-yo-txt-2">
          REPs por parcialidad — {f.reps.length === 0 ? "sin parcialidades" : `${f.reps.filter((r) => r.status === "REP_ACEPTADO").length}/${f.reps.length} aceptados`}
        </div>
        {f.reps.length === 0 ? (
          <div className="p-4 text-[11.5px] text-yo-txt-3">Los REPs se habilitan cuando exista un CFDI PPD aceptado y se liberen parcialidades.</div>
        ) : (
          <ul className="divide-y divide-yo-border">
            {f.reps.map((r) => <REPRow key={r.id} r={r} approvalId={a.id} onDecide={onDecide} />)}
          </ul>
        )}
      </div>
    </section>
  );
}

function REPRow({ r, approvalId, onDecide }: { r: REPInfo; approvalId: string; onDecide: (fd: FiscalDecision) => void }) {
  const tone = r.status === "REP_ACEPTADO" ? { bg: "#ECFDF5", txt: "#047857" }
    : r.status === "REP_RECHAZADO" ? { bg: "#FEF2F2", txt: "#B91C1C" }
    : r.status === "REP_EN_REVISION" ? { bg: "#F0F9FF", txt: "#075985" }
    : { bg: "#FFFBEB", txt: "#B45309" };
  return (
    <li className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium text-yo-txt">Parcialidad {r.numParcialidad}/{r.totalParcialidades}</div>
          <div className="text-[11px] text-yo-txt-3 font-mono">
            {r.uuidRep ? `UUID REP: ${r.uuidRep} · ` : ""}CFDI origen: {r.uuidCfdiOrigen ?? "—"}
          </div>
          <div className="text-[11px] text-yo-txt-3 font-mono mt-0.5">
            SaldoAnt {formatMoney(r.impSaldoAnt)} · Pagado {formatMoney(r.impPagado)} · Insoluto {formatMoney(r.impSaldoInsoluto)} · Forma {r.formaDePagoP ?? "—"}
          </div>
          {r.observacion && <div className="text-[11px] text-[#B45309] mt-0.5">{r.observacion}</div>}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap" style={{ backgroundColor: tone.bg, color: tone.txt }}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" /> {FISCAL_STATUS_LABEL[r.status]}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button className="h-7 px-2.5 rounded-md border border-yo-border text-[11px] font-medium text-yo-txt">Ver XML</button>
        {r.status === "REP_EN_REVISION" && (
          <>
            <button onClick={() => onDecide({ kind: "REP_ACCEPT", approvalId, repId: r.id })} className="h-7 px-2.5 rounded-md bg-[#059669] text-white text-[11px] font-semibold">
              Aceptar REP
            </button>
            <button onClick={() => onDecide({ kind: "REP_REJECT", approvalId, repId: r.id })} className="h-7 px-2.5 rounded-md border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] text-[11px] font-semibold">
              Rechazar REP
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function SectorialSection({ a }: { a: Approval }) {
  const reqs = a.sector_requirements;
  return (
    <section className="space-y-2">
      <div className="rounded-md border border-yo-border bg-yo-raised/40 p-3 text-[11.5px] text-yo-txt-2">
        Sector: <span className="font-medium text-yo-txt">{SECTOR_CFG[a.sector].label}</span>. Los requisitos cambian según el sector y las condiciones pactadas.
      </div>
      {reqs.length === 0 ? (
        <div className="text-[12px] text-yo-txt-3 italic p-3 bg-yo-raised rounded-md">Este sector no tiene requisitos adicionales configurados.</div>
      ) : (
        <ul className="divide-y divide-yo-border rounded-md border border-yo-border overflow-hidden bg-yo-surface">
          {reqs.map((r) => <SectorReqRow key={r.id} r={r} />)}
        </ul>
      )}
    </section>
  );
}

function SectorReqRow({ r }: { r: SectorRequirement }) {
  const tone = SECTOR_REQ_TONE[r.status];
  return (
    <li className="p-3 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-yo-txt">{r.label}</div>
        <div className="text-[10.5px] text-yo-txt-3 mt-0.5">{r.type}{r.detail && ` · ${r.detail}`}</div>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium shrink-0" style={{ backgroundColor: tone.bg, color: tone.txt }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tone.dot }} /> {r.status}
      </span>
    </li>
  );
}

function DocsSection({ a }: { a: Approval }) {
  const docs = a.evidence.filter((e) => e.kind === "DOCUMENT");
  return (
    <section className="space-y-2">
      <SectionTitle icon={FileText}>Documentos requeridos</SectionTitle>
      {docs.length === 0 ? (
        <div className="text-[12px] text-yo-txt-3 italic p-3 bg-yo-raised rounded-md">Sin documentos cargados por el vendedor.</div>
      ) : docs.map((e) => <EvidenceItemRow key={e.id} e={e} />)}
    </section>
  );
}

function EvidenciaSection({ a }: { a: Approval }) {
  const evs = a.evidence.filter((e) => e.kind !== "DOCUMENT");
  return (
    <section className="space-y-2">
      <SectionTitle icon={PackageCheck}>Evidencia operativa</SectionTitle>
      {evs.length === 0 ? (
        <div className="text-[12px] text-yo-txt-3 italic p-3 bg-yo-raised rounded-md">Aún no se ha cargado evidencia operativa.</div>
      ) : evs.map((e) => <EvidenceItemRow key={e.id} e={e} />)}
    </section>
  );
}

function EvidenceItemRow({ e }: { e: Approval["evidence"][number] }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-yo-border bg-yo-surface p-3">
      <div className="size-9 rounded-md bg-yo-raised grid place-items-center shrink-0">
        {e.kind === "IMAGE" ? <ImageIcon className="size-4 text-yo-txt-3" /> :
         e.kind === "GPS" ? <MapPin className="size-4 text-yo-txt-3" /> :
         <FileText className="size-4 text-yo-txt-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-yo-txt truncate">{e.title}</div>
        <div className="text-[11px] text-yo-txt-3 mt-0.5">{e.meta}</div>
      </div>
      {e.ok
        ? <CheckCircle2 className="size-4 shrink-0" style={{ color: "#059669" }} />
        : <AlertTriangle className="size-4 shrink-0" style={{ color: "#D97706" }} />}
    </div>
  );
}

function BitacoraSection({ a }: { a: Approval }) {
  return (
    <section>
      <SectionTitle icon={History}>Observaciones e historial</SectionTitle>
      {a.timeline.length === 0 ? (
        <div className="text-[12px] text-yo-txt-3 italic p-3 bg-yo-raised rounded-md">Sin eventos registrados.</div>
      ) : (
        <ol className="relative border-l border-yo-border ml-2 space-y-3">
          {a.timeline.map((t, i) => (
            <li key={i} className="pl-4 relative">
              <span className="absolute -left-[5px] top-1 size-2 rounded-full bg-yo-ac" />
              <div className="text-[12px] text-yo-txt-2 flex items-center gap-2">
                <Clock className="size-3 text-yo-txt-3" />
                {new Date(t.at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="text-[13px] text-yo-txt"><span className="font-medium">{t.actor}</span> · {t.action}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ─────────────── Small UI helpers ─────────────── */

function SellerBlock() {
  return (
    <div className="max-w-2xl mx-auto mt-16 rounded-lg border border-yo-border bg-yo-surface p-8 text-center">
      <div className="size-12 mx-auto mb-4 rounded-full bg-yo-raised grid place-items-center">
        <ShieldAlert className="size-6 text-yo-txt-3" />
      </div>
      <h1 className="text-lg font-semibold text-yo-txt mb-1">Aprobaciones no disponible</h1>
      <p className="text-sm text-yo-txt-2">
        Este módulo es exclusivo para el rol Comprador. Cambia la vista actual desde la barra lateral.
      </p>
    </div>
  );
}

function MetricCard({ title, value, hint, accent, mono }: { title: string; value: string | number; hint: string; accent: string; mono?: boolean }) {
  return (
    <div className="relative overflow-hidden bg-yo-surface border border-yo-border rounded-lg p-4">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: accent }} />
      <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-medium mb-2">{title}</div>
      <div className={cn("text-[22px] font-semibold text-yo-txt leading-none", mono && "font-mono tabular-nums")}>{value}</div>
      <div className="text-[11px] text-yo-txt-3 mt-2">{hint}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const c = STATUS_CFG[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.txt }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {c.label}
    </span>
  );
}

function SectorPill({ sector }: { sector: keyof typeof SECTOR_CFG }) {
  const c = SECTOR_CFG[sector];
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: c.bg, color: c.txt }}>
      <span>{c.emoji}</span> {c.label}
    </span>
  );
}

function RiskBadge({ level }: { level: "BAJO" | "MEDIO" | "ALTO" | "CRITICO" }) {
  const cfg = {
    BAJO:    { bg: "#ECFDF5", txt: "#047857", label: "Riesgo bajo" },
    MEDIO:   { bg: "#FFFBEB", txt: "#B45309", label: "Riesgo medio" },
    ALTO:    { bg: "#FEF2F2", txt: "#B91C1C", label: "Riesgo alto" },
    CRITICO: { bg: "#FEF2F2", txt: "#B91C1C", label: "Riesgo crítico" },
  }[level];
  return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: cfg.bg, color: cfg.txt }}>{cfg.label}</span>;
}

function DueChip({ iso }: { iso: string }) {
  const d = daysUntil(iso);
  const color = d < 0 ? "#DC2626" : d <= 1 ? "#D97706" : "#52525B";
  const label = d < 0 ? `Vencido ${-d}d` : d === 0 ? "Vence hoy" : d === 1 ? "Vence mañana" : `Vence en ${d}d`;
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color }}><Clock className="size-3" />{label}</span>;
}

function BtnPrimary({ children, icon: Icon, onClick }: { children: React.ReactNode; icon?: any; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-[13px] font-medium transition">
      {Icon && <Icon className="size-4" />}{children}
    </button>
  );
}
function BtnSecondary({ children, icon: Icon, onClick }: { children: React.ReactNode; icon?: any; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md border border-yo-border bg-yo-surface hover:bg-yo-raised text-yo-txt text-[13px] font-medium transition">
      {Icon && <Icon className="size-4 text-yo-txt-3" />}{children}
    </button>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-[13px] text-yo-txt focus:outline-none focus:border-yo-ac">
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function Row({ k, v, mono, strong, ok }: { k: string; v: string; mono?: boolean; strong?: boolean; ok?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-yo-txt-3">{k}</span>
      <span className={cn(mono && "font-mono tabular-nums", strong && "font-semibold", ok ? "text-[#047857]" : "text-yo-txt")}>{v}</span>
    </div>
  );
}

function EmptyState({ tab, onClear }: { tab: TabKey; onClear: () => void }) {
  const copy: Record<TabKey, { t: string; s: string }> = {
    POR_REVISAR:  { t: "No tienes hitos por aprobar", s: "Cuando un vendedor envíe un hito a revisión, aparecerá aquí con su evidencia, contrato, fiscal y requisitos sectoriales." },
    LISTAS:       { t: "No hay aprobaciones listas para liberar", s: "Algunos hitos tienen requisitos pendientes. Revisa los candados y solicita correcciones al vendedor." },
    BLOQUEADAS:   { t: "Sin hitos bloqueados", s: "Los hitos con candados críticos aparecerán aquí." },
    CORRECCIONES: { t: "Sin correcciones pendientes", s: "Aquí verás los hitos que devolviste al vendedor para subsanar." },
    FISCAL:       { t: "No hay CFDI/REP pendientes de revisión", s: "Cuando el vendedor suba documentos fiscales, podrás aceptarlos o rechazarlos desde esta sección." },
    CONTRATOS:    { t: "Sin contratos pendientes de firma", s: "Los hitos cuyo contrato requiera firma o revisión aparecerán aquí." },
    SECTORIALES:  { t: "Sin requisitos sectoriales pendientes", s: "Los hitos con checklist sectorial incompleto aparecerán aquí." },
    HISTORIAL:    { t: "Sin decisiones anteriores", s: "El historial de aprobaciones, rechazos y disputas aparecerá aquí." },
  };
  const c = copy[tab];
  return (
    <div className="rounded-lg border border-dashed border-yo-border bg-yo-surface p-10 text-center">
      <div className="size-12 mx-auto mb-3 rounded-full bg-yo-raised grid place-items-center">
        <ClipboardCheck className="size-6 text-yo-txt-3" />
      </div>
      <p className="text-yo-txt font-medium">{c.t}</p>
      <p className="text-yo-txt-2 text-sm mt-1 max-w-md mx-auto">{c.s}</p>
      <button onClick={onClear} className="mt-4 inline-flex items-center gap-1 text-yo-ac hover:text-yo-ac-h text-[13px] font-medium">
        Ver todo por revisar
      </button>
    </div>
  );
}

/* ─────────────── Decision Modal ─────────────── */

function DecisionModal({ kind, a, onClose, onConfirm }: { kind: DecisionKind; a: Approval; onClose: () => void; onConfirm: () => void }) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [ackReview, setAckReview] = useState(false);
  const [ackImpact, setAckImpact] = useState(false);
  const impact = computeReleaseImpact(a);

  const cfg = {
    APPROVE: {
      title: "Aprobar hito y ordenar liberación",
      desc: "Confirma que revisaste la evidencia y autorizas la liberación conforme a las condiciones pactadas.",
      cta: "Confirmar aprobación", ctaBg: "#4F46E5",
      reasonRequired: false,
    },
    CORRECT: {
      title: "Solicitar corrección al vendedor",
      desc: "El hito permanecerá retenido hasta que el vendedor subsane las observaciones.",
      cta: "Enviar corrección", ctaBg: "#D97706",
      reasonRequired: true,
    },
    REJECT: {
      title: "Rechazar hito",
      desc: "Rechazar este hito puede bloquear la liberación de fondos y habilitar una disputa.",
      cta: "Rechazar hito", ctaBg: "#DC2626",
      reasonRequired: true,
    },
    DISPUTE: {
      title: "Abrir disputa",
      desc: "Al abrir disputa, la liberación asociada quedará congelada hasta resolución.",
      cta: "Abrir disputa", ctaBg: "#DC2626",
      reasonRequired: true,
    },
  }[kind];

  const reasonsByKind: Record<DecisionKind, string[]> = {
    APPROVE: [],
    CORRECT: ["Documento incorrecto", "Evidencia insuficiente", "CFDI/REP con error", "Contrato pendiente/incompleto", "Requisito sectorial incompleto", "Otro"],
    REJECT: ["Incumplimiento crítico", "Evidencia insuficiente o inconsistente", "Documento fiscal incorrecto", "Servicio/producto no conforme", "Retraso irrecuperable", "Otro"],
    DISPUTE: ["Incumplimiento de entrega", "Evidencia insuficiente o alterada", "Documento fiscal incorrecto", "Mercancía/servicio no conforme", "Retraso crítico", "Otro"],
  };

  const canSubmit =
    (!cfg.reasonRequired || (reason.trim().length > 0 && comment.trim().length >= 30)) &&
    (kind !== "APPROVE" || (ackReview && ackImpact));

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-yo-surface rounded-xl border border-yo-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-yo-border flex items-start justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-yo-txt">{cfg.title}</h3>
            <p className="text-[13px] text-yo-txt-2 mt-1">{cfg.desc}</p>
          </div>
          <button onClick={onClose} className="size-8 rounded-md hover:bg-yo-raised grid place-items-center"><X className="size-4" /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="rounded-md border border-yo-border bg-yo-raised p-3 space-y-1 text-[12.5px]">
            <Row k="Operación" v={a.transaction_folio} mono />
            <Row k="Hito" v={`${a.milestone_order} — ${a.milestone_title}`} />
            <Row k="Vendedor" v={a.seller_name} />
            <Row k="Monto asociado" v={formatMoney(a.associated_amount, a.currency)} mono strong />
            {kind === "APPROVE" && (
              <>
                <div className="h-px bg-yo-border my-1" />
                <Row k="Comisión" v={formatMoney(impact.commission, a.currency)} mono />
                <Row k="IVA comisión" v={formatMoney(impact.vat, a.currency)} mono />
                <Row k="Neto al vendedor" v={formatMoney(impact.net, a.currency)} mono strong ok />
              </>
            )}
          </div>

          {kind === "APPROVE" && (
            <div className="rounded-md border p-3 flex gap-2" style={{ backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" }}>
              <Info className="size-4 shrink-0 mt-0.5" style={{ color: "#0284C7" }} />
              <div className="text-[12px]" style={{ color: "#075985" }}>
                La liberación será procesada por la pasarela de pago configurada. Cumplex no custodia fondos.
              </div>
            </div>
          )}

          {cfg.reasonRequired && (
            <>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-1.5">
                  Motivo <span className="text-[#DC2626]">*</span>
                </label>
                <select value={reason} onChange={(e) => setReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-yo-border bg-yo-surface text-[13px] focus:outline-none focus:border-yo-ac">
                  <option value="">Selecciona un motivo</option>
                  {reasonsByKind[kind].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-1.5">
                  Descripción detallada <span className="text-[#DC2626]">*</span>
                </label>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4}
                  placeholder="Describe qué debe corregir el vendedor y por qué…"
                  className="w-full px-3 py-2 rounded-md border border-yo-border bg-yo-surface text-[13px] focus:outline-none focus:border-yo-ac" />
                <div className="text-[11px] text-yo-txt-3 mt-1">Mínimo 30 caracteres.</div>
              </div>
            </>
          )}

          {kind === "APPROVE" && (
            <>
              <label className="flex items-start gap-2 text-[12.5px] text-yo-txt-2">
                <input type="checkbox" checked={ackReview} onChange={(e) => setAckReview(e.target.checked)} className="mt-0.5" />
                Confirmo que revisé contrato, fiscal, documentos, evidencia y requisitos sectoriales asociados a este hito.
              </label>
              <label className="flex items-start gap-2 text-[12.5px] text-yo-txt-2">
                <input type="checkbox" checked={ackImpact} onChange={(e) => setAckImpact(e.target.checked)} className="mt-0.5" />
                Autorizo que se envíe la orden de liberación a la pasarela y entiendo su carácter irreversible.
              </label>
            </>
          )}

          <div className="text-[11px] text-yo-txt-3 flex items-center gap-1.5">
            <Info className="size-3.5" /> Esta acción quedará registrada con IP, timestamp y snapshot del checklist en la bitácora de auditoría.
          </div>
        </div>

        <div className="p-4 border-t border-yo-border flex justify-end gap-2 bg-yo-raised/50">
          <button onClick={onClose} className="h-9 px-4 rounded-md border border-yo-border bg-yo-surface hover:bg-yo-raised text-[13px] font-medium text-yo-txt">Cancelar</button>
          <button disabled={!canSubmit} onClick={onConfirm}
            className="h-9 px-4 rounded-md text-white text-[13px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: cfg.ctaBg }}>
            {cfg.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Fiscal Reject Modal ─────────────── */

function FiscalRejectModal({ fd, onClose, onConfirm }: { fd: FiscalDecision; onClose: () => void; onConfirm: () => void }) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const isReject = fd.kind === "CFDI_REJECT" || fd.kind === "REP_REJECT";
  const isCfdi = fd.kind.startsWith("CFDI");

  if (!isReject) {
    // Accept is instant confirmation
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
        <div className="w-full max-w-md bg-yo-surface rounded-xl border border-yo-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="p-5">
            <h3 className="text-[16px] font-semibold text-yo-txt">Aceptar {isCfdi ? "CFDI PPD" : "REP"}</h3>
            <p className="text-[13px] text-yo-txt-2 mt-1">
              Al aceptar, el documento fiscal se marca como válido para la operación y se retiran los candados fiscales asociados.
            </p>
            <div className="mt-4 rounded-md border border-yo-border bg-yo-raised p-3 text-[12px] text-yo-txt-2 flex gap-2">
              <ReceiptText className="size-4 mt-0.5 shrink-0" />
              Se registrará tu aceptación con timestamp e IP en la bitácora.
            </div>
          </div>
          <div className="p-4 border-t border-yo-border flex justify-end gap-2 bg-yo-raised/50">
            <button onClick={onClose} className="h-9 px-4 rounded-md border border-yo-border bg-yo-surface text-[13px] font-medium text-yo-txt">Cancelar</button>
            <button onClick={onConfirm} className="h-9 px-4 rounded-md bg-[#059669] text-white text-[13px] font-semibold">
              Confirmar aceptación
            </button>
          </div>
        </div>
      </div>
    );
  }

  const reasons = isCfdi
    ? ["RFC no coincide", "Monto incorrecto", "Método/Forma de pago incorrectos", "CFDI cancelado o no vigente", "Concepto no corresponde", "Otro"]
    : ["UUID CFDI origen incorrecto", "NumParcialidad incorrecto", "ImpSaldoAnt incorrecto", "ImpPagado incorrecto", "ImpSaldoInsoluto incorrecto", "FormaDePagoP incorrecta", "Otro"];
  const canSubmit = reason.length > 0 && comment.trim().length >= 10;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-yo-surface rounded-xl border border-yo-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-yo-border flex items-start justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-yo-txt">Rechazar {isCfdi ? "CFDI PPD" : "REP"}</h3>
            <p className="text-[13px] text-yo-txt-2 mt-1">Indica el motivo. El vendedor deberá subir un documento corregido.</p>
          </div>
          <button onClick={onClose} className="size-8 rounded-md hover:bg-yo-raised grid place-items-center"><X className="size-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-1.5">
              Motivo <span className="text-[#DC2626]">*</span>
            </label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-yo-border bg-yo-surface text-[13px] focus:outline-none focus:border-yo-ac">
              <option value="">Selecciona un motivo</option>
              {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-1.5">
              Comentario <span className="text-[#DC2626]">*</span>
            </label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4}
              className="w-full px-3 py-2 rounded-md border border-yo-border bg-yo-surface text-[13px] focus:outline-none focus:border-yo-ac"
              placeholder="Explica el error para que el vendedor pueda corregirlo…" />
            <div className="text-[11px] text-yo-txt-3 mt-1">Mínimo 10 caracteres.</div>
          </div>
        </div>
        <div className="p-4 border-t border-yo-border flex justify-end gap-2 bg-yo-raised/50">
          <button onClick={onClose} className="h-9 px-4 rounded-md border border-yo-border bg-yo-surface text-[13px] font-medium text-yo-txt">Cancelar</button>
          <button disabled={!canSubmit} onClick={onConfirm}
            className="h-9 px-4 rounded-md bg-[#DC2626] text-white text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
            Rechazar {isCfdi ? "CFDI" : "REP"}
          </button>
        </div>
      </div>
    </div>
  );
}
