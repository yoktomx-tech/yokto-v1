import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ClipboardCheck, RefreshCw, Download, BookOpen, Search, Filter,
  ChevronRight, X, CheckCircle2, AlertTriangle, XCircle, MessageSquareWarning,
  FileText, Image as ImageIcon, MapPin, Clock, ExternalLink, Info, Lock,
  Circle, ShieldAlert,
} from "lucide-react";
import { useViewRole } from "@/hooks/use-view-role";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import {
  MOCK_APPROVALS, STATUS_CFG, SECTOR_CFG, formatMoney, daysUntil,
  type Approval, type ApprovalStatus,
} from "@/lib/approvals-mock";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({ meta: [{ title: "Aprobaciones — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: ApprovalsPage,
});

type TabKey = "ALL" | ApprovalStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "Todos" },
  { key: "PENDING", label: "Pendientes" },
  { key: "DUE_SOON", label: "Por vencer" },
  { key: "IN_REVIEW", label: "En revisión" },
  { key: "CORRECTION_REQUESTED", label: "Corrección solicitada" },
  { key: "APPROVED", label: "Aprobados" },
  { key: "REJECTED", label: "Rechazados" },
  { key: "DISPUTED", label: "En disputa" },
];

type DecisionKind = "APPROVE" | "CORRECT" | "REJECT" | "DISPUTE";

function ApprovalsPage() {
  const { role } = useViewRole();
  const [tab, setTab] = useState<TabKey>("ALL");
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState<string>("ALL");
  const [risk, setRisk] = useState<string>("ALL");
  const [selected, setSelected] = useState<Approval | null>(null);
  const [decision, setDecision] = useState<{ kind: DecisionKind; a: Approval } | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>(MOCK_APPROVALS);

  if (role !== "buyer") {
    return <SellerBlock />;
  }

  const filtered = useMemo(() => {
    return approvals.filter((a) => {
      if (tab !== "ALL" && a.status !== tab) return false;
      if (sector !== "ALL" && a.sector !== sector) return false;
      if (risk !== "ALL" && a.risk_level !== risk) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!(
          a.transaction_folio.toLowerCase().includes(q) ||
          a.transaction_title.toLowerCase().includes(q) ||
          a.seller_name.toLowerCase().includes(q) ||
          a.milestone_title.toLowerCase().includes(q) ||
          a.approval_folio.toLowerCase().includes(q)
        )) return false;
      }
      return true;
    });
  }, [approvals, tab, sector, risk, query]);

  const metrics = useMemo(() => {
    const pending = approvals.filter((a) => a.status === "PENDING").length;
    const dueSoon = approvals.filter((a) => a.status === "DUE_SOON").length;
    const corrections = approvals.filter((a) => a.status === "CORRECTION_REQUESTED").length;
    const releasable = approvals
      .filter((a) => ["PENDING", "DUE_SOON", "IN_REVIEW"].includes(a.status))
      .reduce((s, a) => s + a.associated_amount, 0);
    const disputes = approvals.filter((a) => ["REJECTED", "DISPUTED"].includes(a.status)).length;
    return { pending, dueSoon, corrections, releasable, disputes };
  }, [approvals]);

  const applyDecision = (kind: DecisionKind, a: Approval) => {
    const nextStatus: ApprovalStatus =
      kind === "APPROVE" ? "APPROVED" :
      kind === "CORRECT" ? "CORRECTION_REQUESTED" :
      kind === "REJECT" ? "REJECTED" :
      "DISPUTED";
    setApprovals((prev) => prev.map((x) => x.id === a.id ? { ...x, status: nextStatus } : x));
    setSelected((s) => s && s.id === a.id ? { ...s, status: nextStatus } : s);
    setDecision(null);
    const label = STATUS_CFG[nextStatus].label;
    toast.success(`${a.approval_folio}: ${label.toLowerCase()}`);
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <PageHeader
          icon={ClipboardCheck}
          title="Aprobaciones"
          subtitle="Revisa entregables, evidencia y condiciones antes de liberar fondos."
          actions={
            <>
              <BtnSecondary icon={RefreshCw} onClick={() => toast.info("Actualizado")}>Actualizar</BtnSecondary>
              <BtnSecondary icon={Download} onClick={() => toast.success("Expediente exportado")}>Exportar</BtnSecondary>
              <BtnPrimary icon={BookOpen}>Ver reglas</BtnPrimary>
            </>
          }
        />

        {/* Metrics */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          <MetricCard title="Pendientes" value={metrics.pending} hint="Hitos listos para revisar" accent="#4F46E5" />
          <MetricCard title="Vencen hoy" value={metrics.dueSoon} hint="SLA crítico" accent="#D97706" />
          <MetricCard title="Correcciones" value={metrics.corrections} hint="Devueltos al vendedor" accent="#0284C7" />
          <MetricCard title="Monto por liberar" value={formatMoney(metrics.releasable)} hint="Asociado a aprobables" accent="#059669" mono />
          <MetricCard title="En disputa" value={metrics.disputes} hint="Rechazos y disputas" accent="#DC2626" />
        </section>

        {/* Tabs */}
        <div className="mb-4 overflow-x-auto">
          <div className="inline-flex bg-yo-surface border border-yo-border rounded-lg p-1 gap-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[12.5px] font-medium whitespace-nowrap transition",
                  tab === t.key ? "bg-yo-ac-bg text-yo-ac-txt" : "text-yo-txt-2 hover:bg-yo-raised",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="size-4 text-yo-txt-3 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por operación, vendedor, hito o folio..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-yo-border bg-yo-raised text-[13px] text-yo-txt placeholder:text-yo-txt-3 focus:outline-none focus:border-yo-ac focus:bg-yo-surface"
            />
          </div>
          <Select value={sector} onChange={setSector}
            options={[{ v: "ALL", l: "Todos los sectores" }, ...Object.entries(SECTOR_CFG).map(([k, v]) => ({ v: k, l: v.label }))]} />
          <Select value={risk} onChange={setRisk}
            options={[{ v: "ALL", l: "Riesgo (todos)" }, { v: "LOW", l: "Bajo" }, { v: "MEDIUM", l: "Medio" }, { v: "HIGH", l: "Alto" }]} />
          <BtnSecondary icon={Filter}>Más filtros</BtnSecondary>
        </div>

        {/* Table + Cards */}
        {filtered.length === 0 ? (
          <EmptyState onClear={() => { setQuery(""); setSector("ALL"); setRisk("ALL"); setTab("ALL"); }} />
        ) : (
          <>
            <div className="hidden md:block bg-yo-surface border border-yo-border rounded-lg overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-yo-raised text-yo-txt-3 text-[11px] uppercase tracking-[.06em]">
                  <tr>
                    <Th>Operación</Th>
                    <Th>Vendedor · Sector</Th>
                    <Th>Hito</Th>
                    <Th className="text-right">Monto</Th>
                    <Th>Evidencia</Th>
                    <Th>Riesgo</Th>
                    <Th>Vence</Th>
                    <Th>Estado</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-t border-yo-border hover:bg-yo-raised transition">
                      <Td>
                        <div className="font-mono text-[12px] text-yo-txt-2">{a.transaction_folio}</div>
                        <div className="font-medium text-yo-txt truncate max-w-[220px]">{a.transaction_title}</div>
                      </Td>
                      <Td>
                        <div className="text-yo-txt">{a.seller_name}</div>
                        <SectorPill sector={a.sector} />
                      </Td>
                      <Td><span className="text-yo-txt">{a.milestone_title}</span></Td>
                      <Td className="text-right">
                        <span className="font-mono tabular-nums font-semibold text-yo-txt">
                          {formatMoney(a.associated_amount, a.currency)}
                        </span>
                        <div className="text-[11px] text-yo-txt-3">{a.currency}</div>
                      </Td>
                      <Td>
                        <EvidenceBar count={a.evidence_count} req={a.required_evidence_count} status={a.evidence_status} />
                      </Td>
                      <Td><RiskBadge level={a.risk_level} /></Td>
                      <Td>
                        <DueCell iso={a.due_at} />
                      </Td>
                      <Td><StatusBadge status={a.status} /></Td>
                      <Td>
                        <button
                          onClick={() => setSelected(a)}
                          className="inline-flex items-center gap-1 text-yo-ac hover:text-yo-ac-h text-[12.5px] font-medium"
                        >
                          Revisar <ChevronRight className="size-3.5" />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {filtered.map((a) => (
                <ApprovalCard key={a.id} a={a} onOpen={() => setSelected(a)} />
              ))}
            </div>
          </>
        )}

        <p className="mt-4 text-[11px] text-yo-txt-3">
          Yokto no custodia fondos. La liberación se ordena a través de la pasarela de pagos configurada.
        </p>
      </div>

      {/* Drawer */}
      {selected && (
        <ApprovalDrawer
          a={selected}
          onClose={() => setSelected(null)}
          onDecision={(kind) => setDecision({ kind, a: selected })}
        />
      )}

      {/* Modal */}
      {decision && (
        <DecisionModal
          kind={decision.kind}
          a={decision.a}
          onClose={() => setDecision(null)}
          onConfirm={() => applyDecision(decision.kind, decision.a)}
        />
      )}
    </>
  );
}

/* ─────────────── Sub-componentes ─────────────── */

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
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium mt-0.5"
      style={{ backgroundColor: c.bg, color: c.txt }}>
      <span>{c.emoji}</span> {c.label}
    </span>
  );
}

function RiskBadge({ level }: { level: "LOW" | "MEDIUM" | "HIGH" }) {
  const cfg = { LOW: { bg: "#ECFDF5", txt: "#047857", label: "Bajo" }, MEDIUM: { bg: "#FFFBEB", txt: "#B45309", label: "Medio" }, HIGH: { bg: "#FEF2F2", txt: "#B91C1C", label: "Alto" } }[level];
  return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: cfg.bg, color: cfg.txt }}>{cfg.label}</span>;
}

function EvidenceBar({ count, req, status }: { count: number; req: number; status: string }) {
  const pct = req > 0 ? Math.round((count / req) * 100) : 0;
  const color = status === "COMPLETE" ? "#059669" : status === "OBSERVED" ? "#DC2626" : "#D97706";
  return (
    <div className="w-[110px]">
      <div className="flex justify-between text-[11px] text-yo-txt-3 mb-1"><span>{count}/{req}</span><span>{pct}%</span></div>
      <div className="h-1.5 rounded-full bg-yo-border overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function DueCell({ iso }: { iso: string }) {
  const d = daysUntil(iso);
  const color = d < 0 ? "#DC2626" : d <= 1 ? "#D97706" : "#52525B";
  const label = d < 0 ? `Vencido ${-d}d` : d === 0 ? "Hoy" : d === 1 ? "Mañana" : `En ${d}d`;
  return (
    <div>
      <div className="text-yo-txt-2 text-[12px]">{new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</div>
      <div className="text-[11px] font-medium" style={{ color }}>{label}</div>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("text-left font-medium px-3 py-2.5", className)}>{children}</th>;
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-3 align-top", className)}>{children}</td>;
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

function ApprovalCard({ a, onOpen }: { a: Approval; onOpen: () => void }) {
  const c = SECTOR_CFG[a.sector];
  return (
    <div className="relative bg-yo-surface border border-yo-border rounded-lg p-4 overflow-hidden">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: c.color }} />
      <div className="flex justify-between items-start gap-2 mb-2">
        <div>
          <div className="font-mono text-[11px] text-yo-txt-3">{a.transaction_folio}</div>
          <div className="font-medium text-yo-txt text-[14px]">{a.milestone_title}</div>
        </div>
        <StatusBadge status={a.status} />
      </div>
      <div className="text-[12px] text-yo-txt-2">{a.seller_name} · {c.label}</div>
      <div className="mt-2 font-mono tabular-nums text-[15px] font-semibold text-yo-txt">{formatMoney(a.associated_amount, a.currency)}</div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-yo-txt-3">
        <span>Evidencia {a.evidence_count}/{a.required_evidence_count}</span>
        <span>Cumplimiento {a.compliance_percent}%</span>
        <DueCell iso={a.due_at} />
      </div>
      <div className="mt-3 flex gap-2">
        <BtnPrimary onClick={onOpen}>Revisar</BtnPrimary>
      </div>
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-yo-border bg-yo-surface p-10 text-center">
      <div className="size-12 mx-auto mb-3 rounded-full bg-yo-raised grid place-items-center">
        <ClipboardCheck className="size-6 text-yo-txt-3" />
      </div>
      <p className="text-yo-txt font-medium">No encontramos aprobaciones con estos filtros</p>
      <p className="text-yo-txt-2 text-sm mt-1">Ajusta la búsqueda o limpia los filtros para ver más resultados.</p>
      <button onClick={onClear} className="mt-4 inline-flex items-center gap-1 text-yo-ac hover:text-yo-ac-h text-[13px] font-medium">
        Limpiar filtros
      </button>
    </div>
  );
}

/* ─────────────── Drawer ─────────────── */

function ApprovalDrawer({ a, onClose, onDecision }: { a: Approval; onClose: () => void; onDecision: (k: DecisionKind) => void }) {
  const c = SECTOR_CFG[a.sector];
  const missingRequired = a.conditions.filter((x) => x.required && x.status !== "FULFILLED" && x.status !== "NOT_REQUIRED").length;
  const canApprove = missingRequired === 0 && !["APPROVED", "REJECTED", "DISPUTED"].includes(a.status);
  const isFinal = ["APPROVED", "REJECTED", "DISPUTED"].includes(a.status);

  const impactCopy: Record<string, string> = {
    NO_RELEASE: "Aprobar este hito no libera fondos todavía. La liberación depende de otros hitos pendientes.",
    PARTIAL_RELEASE: `Aprobar este hito ordenará la liberación parcial de ${formatMoney(a.associated_amount, a.currency)} a través de la pasarela.`,
    FULL_RELEASE: `Aprobar este hito ordenará la liberación total de ${formatMoney(a.associated_amount, a.currency)} a través de la pasarela.`,
    INTERNAL_REVIEW: "Aprobar este hito enviará la solicitud a revisión interna antes de liberar fondos.",
    BLOCKED: "Existe un bloqueo operativo. Consulta al backoffice antes de decidir.",
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[560px] bg-yo-surface border-l border-yo-border shadow-xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-yo-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] text-yo-txt-3">{a.approval_folio}</div>
              <h2 className="text-lg font-semibold text-yo-txt mt-0.5">{a.milestone_title}</h2>
              <div className="text-[12px] text-yo-txt-2 mt-1">
                <span className="font-mono">{a.transaction_folio}</span> · {a.seller_name}
              </div>
              <div className="mt-1.5"><SectorPill sector={a.sector} /></div>
            </div>
            <button onClick={onClose} className="size-8 rounded-md hover:bg-yo-raised grid place-items-center"><X className="size-4" /></button>
          </div>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <StatusBadge status={a.status} />
            <RiskBadge level={a.risk_level} />
            <div className="ml-auto font-mono tabular-nums text-lg font-semibold text-yo-txt">
              {formatMoney(a.associated_amount, a.currency)}
              <span className="ml-1 text-[10px] text-yo-txt-3 font-sans">{a.currency}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Info impact box */}
          <div className="rounded-md border p-3 flex gap-2.5" style={{ backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" }}>
            <Info className="size-4 shrink-0 mt-0.5" style={{ color: "#0284C7" }} />
            <div className="text-[12.5px]" style={{ color: "#075985" }}>
              {impactCopy[a.payment_impact]}
            </div>
          </div>

          {/* Checklist */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2">Condiciones</h3>
            <div className="rounded-md border border-yo-border bg-yo-surface divide-y divide-yo-border">
              {a.conditions.length === 0 && (
                <div className="p-3 text-[12px] text-yo-txt-3">Sin condiciones definidas.</div>
              )}
              {a.conditions.map((c) => (
                <div key={c.id} className="p-3 flex items-start gap-2.5">
                  <ConditionIcon status={c.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-yo-txt">{c.label}</div>
                    <div className="text-[11px] text-yo-txt-3 mt-0.5">
                      {c.type} · {c.required ? "Requerido" : "Opcional"}
                      {c.validated_by && ` · Validado por ${c.validated_by.toLowerCase()}`}
                    </div>
                    {c.comment && <div className="text-[11px] mt-1 text-[#B45309]">{c.comment}</div>}
                  </div>
                </div>
              ))}
            </div>
            {missingRequired > 0 && (
              <div className="mt-2 flex items-center gap-2 text-[12px]" style={{ color: "#B45309" }}>
                <AlertTriangle className="size-3.5" /> {missingRequired} condición(es) requerida(s) sin cumplir.
              </div>
            )}
          </section>

          {/* Evidence */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2">Evidencia vinculada</h3>
            <div className="space-y-2">
              {a.evidence.length === 0 && (
                <div className="text-[12px] text-yo-txt-3 italic p-3 bg-yo-raised rounded-md">Aún no se ha cargado evidencia.</div>
              )}
              {a.evidence.map((e) => (
                <div key={e.id} className="flex items-start gap-3 rounded-md border border-yo-border bg-yo-surface p-3">
                  <div className="size-9 rounded-md bg-yo-raised grid place-items-center shrink-0">
                    {e.kind === "IMAGE" ? <ImageIcon className="size-4 text-yo-txt-3" /> :
                     e.kind === "GPS" ? <MapPin className="size-4 text-yo-txt-3" /> :
                     <FileText className="size-4 text-yo-txt-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-yo-txt truncate">{e.title}</div>
                    <div className="text-[11px] text-yo-txt-3 mt-0.5">{e.meta}</div>
                  </div>
                  {e.ok ? (
                    <CheckCircle2 className="size-4 shrink-0" style={{ color: "#059669" }} />
                  ) : (
                    <AlertTriangle className="size-4 shrink-0" style={{ color: "#D97706" }} />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Seller comment */}
          {a.seller_comment && (
            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2">Comentario del vendedor</h3>
              <div className="text-[13px] text-yo-txt-2 bg-yo-raised p-3 rounded-md">{a.seller_comment}</div>
            </section>
          )}

          {/* Timeline */}
          {a.timeline.length > 0 && (
            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2">Bitácora</h3>
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
            </section>
          )}

          {/* Payment panel */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2">Pago asociado</h3>
            <div className="rounded-md border border-yo-border p-3 space-y-2 text-[12.5px]">
              <Row k="Monto retenido" v={formatMoney(a.associated_amount, a.currency)} mono />
              <Row k="Tipo de liberación" v={a.payment_impact.replace("_", " ").toLowerCase()} />
              <Row k="Estado pasarela" v="Retenido" />
              <Row k="Cumplimiento" v={`${a.compliance_percent}%`} />
            </div>
          </section>

          {/* External links */}
          <div className="flex flex-wrap gap-2">
            <Link to="/transactions" className="inline-flex items-center gap-1 text-[12.5px] text-yo-ac hover:text-yo-ac-h font-medium">
              <ExternalLink className="size-3.5" /> Ver operación
            </Link>
            <Link to="/payments" className="inline-flex items-center gap-1 text-[12.5px] text-yo-ac hover:text-yo-ac-h font-medium">
              <ExternalLink className="size-3.5" /> Ver pago asociado
            </Link>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-yo-border bg-yo-raised/50 space-y-2">
          {isFinal ? (
            <div className="text-[12px] text-yo-txt-2 text-center">Esta aprobación ya tiene decisión final.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={!canApprove}
                  onClick={() => onDecision("APPROVE")}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 h-10 rounded-md text-[13px] font-semibold text-white transition",
                    canApprove ? "bg-yo-ac hover:bg-yo-ac-h" : "bg-yo-txt-4 cursor-not-allowed"
                  )}
                  title={canApprove ? "" : "Faltan condiciones requeridas"}
                >
                  {canApprove ? <CheckCircle2 className="size-4" /> : <Lock className="size-4" />}
                  Aprobar hito
                </button>
                <button
                  onClick={() => onDecision("CORRECT")}
                  className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md text-[13px] font-semibold border transition"
                  style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A", color: "#B45309" }}
                >
                  <MessageSquareWarning className="size-4" /> Solicitar corrección
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onDecision("REJECT")}
                  className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md text-[13px] font-semibold border transition"
                  style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA", color: "#B91C1C" }}
                >
                  <XCircle className="size-4" /> Rechazar hito
                </button>
                <button
                  onClick={() => onDecision("DISPUTE")}
                  className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md text-[13px] font-semibold border border-yo-border bg-yo-surface hover:bg-yo-raised text-yo-txt transition"
                >
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

function ConditionIcon({ status }: { status: string }) {
  if (status === "FULFILLED") return <CheckCircle2 className="size-4 shrink-0 mt-0.5" style={{ color: "#059669" }} />;
  if (status === "OBSERVED") return <AlertTriangle className="size-4 shrink-0 mt-0.5" style={{ color: "#DC2626" }} />;
  if (status === "PENDING") return <Circle className="size-4 shrink-0 mt-0.5" style={{ color: "#D97706" }} />;
  return <Circle className="size-4 shrink-0 mt-0.5 text-yo-txt-4" />;
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-yo-txt-3">{k}</span>
      <span className={cn("text-yo-txt", mono && "font-mono tabular-nums font-medium")}>{v}</span>
    </div>
  );
}

/* ─────────────── Decision Modal ─────────────── */

function DecisionModal({ kind, a, onClose, onConfirm }: { kind: DecisionKind; a: Approval; onClose: () => void; onConfirm: () => void }) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [ackReview, setAckReview] = useState(false);
  const [ackImpact, setAckImpact] = useState(false);

  const cfg = {
    APPROVE: {
      title: "Aprobar hito",
      desc: "Confirma que revisaste la evidencia y que el hito cumple con las condiciones pactadas.",
      cta: "Aprobar hito", ctaBg: "#4F46E5", ctaHover: "#4338CA",
      reasonRequired: false,
    },
    CORRECT: {
      title: "Solicitar corrección",
      desc: "El hito permanecerá retenido hasta que el vendedor subsane las observaciones.",
      cta: "Enviar solicitud", ctaBg: "#D97706", ctaHover: "#B45309",
      reasonRequired: true,
    },
    REJECT: {
      title: "Rechazar hito",
      desc: "Rechazar este hito puede bloquear la liberación de fondos y habilitar una disputa.",
      cta: "Rechazar hito", ctaBg: "#DC2626", ctaHover: "#B91C1C",
      reasonRequired: true,
    },
    DISPUTE: {
      title: "Abrir disputa",
      desc: "Al abrir disputa, la liberación asociada quedará congelada hasta resolución.",
      cta: "Abrir disputa", ctaBg: "#DC2626", ctaHover: "#B91C1C",
      reasonRequired: true,
    },
  }[kind];

  const reasonsByKind: Record<DecisionKind, string[]> = {
    APPROVE: [],
    CORRECT: ["Documento ilegible", "Documento incorrecto", "Evidencia incompleta", "CFDI no coincide", "Falta firma/acuse", "GPS no coincide", "Monto no coincide", "Fecha fuera de rango", "Otro"],
    REJECT: ["Incumplimiento crítico", "Evidencia falsa", "Documento fraudulento", "Servicio no conforme", "Retraso irrecuperable", "Otro"],
    DISPUTE: ["Incumplimiento de entrega", "Evidencia falsa o insuficiente", "Documento fiscal incorrecto", "Mercancía/servicio no conforme", "Retraso crítico", "Otro"],
  };

  const canSubmit =
    (!cfg.reasonRequired || (reason.trim().length > 0 && comment.trim().length >= 8)) &&
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
          {/* Resumen */}
          <div className="rounded-md border border-yo-border bg-yo-raised p-3 space-y-1 text-[12.5px]">
            <Row k="Operación" v={a.transaction_folio} mono />
            <Row k="Hito" v={a.milestone_title} />
            <Row k="Monto asociado" v={formatMoney(a.associated_amount, a.currency)} mono />
            <Row k="Impacto" v={a.payment_impact.replace("_", " ").toLowerCase()} />
          </div>

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
                  placeholder="Agrega una observación clara para justificar tu decisión..."
                  className="w-full px-3 py-2 rounded-md border border-yo-border bg-yo-surface text-[13px] focus:outline-none focus:border-yo-ac" />
                <div className="text-[11px] text-yo-txt-3 mt-1">Mínimo 8 caracteres.</div>
              </div>
            </>
          )}

          {kind === "APPROVE" && (
            <>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-1.5">
                  Comentario (opcional)
                </label>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
                  className="w-full px-3 py-2 rounded-md border border-yo-border bg-yo-surface text-[13px] focus:outline-none focus:border-yo-ac" />
              </div>
              <label className="flex items-start gap-2 text-[12.5px] text-yo-txt-2">
                <input type="checkbox" checked={ackReview} onChange={(e) => setAckReview(e.target.checked)} className="mt-0.5" />
                Confirmo que revisé los documentos y la evidencia asociados a este hito.
              </label>
              <label className="flex items-start gap-2 text-[12.5px] text-yo-txt-2">
                <input type="checkbox" checked={ackImpact} onChange={(e) => setAckImpact(e.target.checked)} className="mt-0.5" />
                Entiendo el impacto de liberación de fondos y su carácter irreversible.
              </label>
            </>
          )}

          <div className="text-[11px] text-yo-txt-3 flex items-center gap-1.5">
            <Info className="size-3.5" /> Esta acción quedará registrada en la bitácora de auditoría.
          </div>
        </div>

        <div className="p-4 border-t border-yo-border flex justify-end gap-2 bg-yo-raised/50">
          <button onClick={onClose} className="h-9 px-4 rounded-md border border-yo-border bg-yo-surface hover:bg-yo-raised text-[13px] font-medium text-yo-txt">Cancelar</button>
          <button
            disabled={!canSubmit}
            onClick={onConfirm}
            className="h-9 px-4 rounded-md text-white text-[13px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: cfg.ctaBg }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = cfg.ctaHover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = cfg.ctaBg)}
          >
            {cfg.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
