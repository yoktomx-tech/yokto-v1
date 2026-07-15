import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  PackageCheck, ClipboardList, LoaderCircle, AlertTriangle, CircleDollarSign, ShieldCheck,
  UploadCloud, FileDown, ChevronDown, ChevronRight, FileCheck2, Camera, MapPin, History,
  ReceiptText, Clock, X, CheckCircle2, XCircle, Circle, CircleDashed, Search, Filter,
  LayoutGrid, Table as TableIcon, BellRing, Lock, Info,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useViewRole } from "@/hooks/use-view-role";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  MOCK_OPS, HITO_STATUS_CFG, DOC_STATUS_CFG, TONE_BADGE, TONE_ACCENT, formatMXN,
  withComputedDueStatus, daysUntil, CONTRACT_STATUS_LABEL, FISCAL_STATUS_LABEL,
  type Operation, type Hito, type HitoStatus, type Document as HitoDoc, type Observation,
  type ContractInfo, type FiscalInfo, type SectorRequirement, type ComplianceLock, type REPInfo,
} from "@/lib/cumplimiento-mock";
import { NoCustodyBanner } from "@/components/payments/ui/no-custody-banner";
import { InfoBox } from "@/components/tx/ui/info-box";

export const Route = createFileRoute("/_authenticated/cumplimiento")({
  head: () => ({ meta: [
    { title: "Cumplimiento de operación — YOKTO" },
    { name: "robots", content: "noindex" },
  ]}),
  component: CumplimientoPage,
});

type TabKey =
  | "ALL" | "PENDIENTE" | "EN_REVISION" | "OBSERVACIONES"
  | "CONTRATOS" | "FISCAL" | "SECTORIALES" | "APROBADO";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "Todos" },
  { key: "PENDIENTE", label: "Pendientes" },
  { key: "EN_REVISION", label: "En revisión" },
  { key: "OBSERVACIONES", label: "Con observaciones" },
  { key: "CONTRATOS", label: "Contratos y firmas" },
  { key: "FISCAL", label: "Fiscal CFDI/REP" },
  { key: "SECTORIALES", label: "Sectoriales" },
  { key: "APROBADO", label: "Aprobados" },
];

type QuickFilter = "atencion" | "vence7d" | "conPago" | "docsRechazados" | null;

type AdvFilters = {
  sector: string;
  contraparte: string;
  priority: "" | "ALTA" | "MEDIA" | "BAJA";
  dueBefore: string;
  hasPayment: boolean;
  hasObservations: boolean;
};

const EMPTY_ADV: AdvFilters = {
  sector: "", contraparte: "", priority: "", dueBefore: "", hasPayment: false, hasObservations: false,
};

function CumplimientoPage() {
  const { role } = useViewRole();
  const { currentOrg, can } = useCurrentOrg();

  // Hooks always run in same order (fix hooks-order bug).
  const [tab, setTab] = useState<TabKey>("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ opId: string; hitoId?: string } | null>(null);
  const [uploadFor, setUploadFor] = useState<{ opId: string; hitoId?: string } | null>(null);
  const [markReadyFor, setMarkReadyFor] = useState<{ op: Operation; hito: Hito } | null>(null);
  const [fixObsFor, setFixObsFor] = useState<{ op: Operation; hito: Hito; obs: Observation } | null>(null);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [quick, setQuick] = useState<QuickFilter>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [adv, setAdv] = useState<AdvFilters>(EMPTY_ADV);
  const [profileMissing, setProfileMissing] = useState<string[]>([]);
  const [rtBump, setRtBump] = useState(0);

  // Auto-computed VENCIDO status.
  const ops = useMemo<Operation[]>(() => MOCK_OPS.map(withComputedDueStatus), [rtBump]);

  // Realtime: bump ops when hitos/documents change for this org.
  useEffect(() => {
    if (!currentOrg?.id) return;
    const ch = supabase
      .channel("cumplimiento:" + currentOrg.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "transaction_hitos" }, () => setRtBump((n) => n + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "transaction_documents" }, () => setRtBump((n) => n + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentOrg?.id]);

  // Profile pending docs sanity-check (KYC status on profile).
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles").select("kyc_status, onboarding_completed").eq("id", user.id).maybeSingle();
      const miss: string[] = [];
      if (data && data.kyc_status !== "approved") miss.push("KYC pendiente de aprobación");
      if (data && !data.onboarding_completed) miss.push("Onboarding incompleto");
      setProfileMissing(miss);
    })().catch(() => {});
  }, []);

  const sectors = useMemo(() => Array.from(new Set(ops.map((o) => o.sector))).sort(), [ops]);

  const metrics = useMemo(() => {
    const allHitos = ops.flatMap((o) => o.hitos);
    return {
      pendientes: allHitos.filter((h) => ["PENDIENTE", "EN_CARGA", "NO_INICIADO"].includes(h.status)).length,
      enRevision: allHitos.filter((h) => ["EN_REVISION", "LISTO_REVISION"].includes(h.status)).length,
      porCorregir: allHitos.filter((h) => h.status === "RECHAZADO").length,
      listosLiberar: allHitos.filter((h) => h.status === "APROBADO").reduce((s, h) => s + h.amountLinked, 0),
      vencidos: allHitos.filter((h) => h.status === "VENCIDO").length,
      score: 86,
    };
  }, [ops]);

  const filteredOps = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Op-level tabs keep the whole operation
    const opLevelTabs: TabKey[] = ["CONTRATOS", "FISCAL", "SECTORIALES"];
    const isOpLevel = opLevelTabs.includes(tab);
    return ops
      .filter((op) => {
        if (adv.sector && op.sector !== adv.sector) return false;
        if (adv.contraparte && !op.buyer.toLowerCase().includes(adv.contraparte.toLowerCase())) return false;
        if (tab === "CONTRATOS" && op.contract.status === "FIRMADO_COMPLETO") return false;
        if (tab === "FISCAL" && op.fiscal.cfdi.status === "CFDI_ACEPTADO" && op.fiscal.reps.every((r) => r.status === "REP_ACEPTADO")) return false;
        if (tab === "SECTORIALES" && op.sectorRequirements.every((s) => s.status === "COMPLETO")) return false;
        return true;
      })
      .map((op) => {
        const hitos = op.hitos.filter((h) => {
          if (!isOpLevel) {
            if (tab === "PENDIENTE" && !["PENDIENTE", "EN_CARGA", "NO_INICIADO"].includes(h.status)) return false;
            if (tab === "EN_REVISION" && !["EN_REVISION", "LISTO_REVISION"].includes(h.status)) return false;
            if (tab === "OBSERVACIONES" && h.observationsOpen === 0 && h.status !== "RECHAZADO") return false;
            if (tab === "APROBADO" && h.status !== "APROBADO") return false;
          }
          if (q) {
            const hay = [op.id, op.name, op.buyer, h.name, h.id].join(" ").toLowerCase();
            if (!hay.includes(q)) return false;
          }
          if (adv.priority && h.priority !== adv.priority) return false;
          if (adv.dueBefore && new Date(h.dueDate) > new Date(adv.dueBefore)) return false;
          if (adv.hasPayment && !h.hasPendingPayment) return false;
          if (adv.hasObservations && h.observationsOpen === 0) return false;
          if (quick === "atencion" && !(h.status === "RECHAZADO" || h.observationsOpen > 0 || h.status === "VENCIDO")) return false;
          if (quick === "vence7d") { const d = daysUntil(h.dueDate); if (d < 0 || d > 7) return false; }
          if (quick === "conPago" && !h.hasPendingPayment) return false;
          if (quick === "docsRechazados" && !h.documents.some((d) => d.status === "RECHAZADO")) return false;
          return true;
        });
        return { ...op, hitos };
      })
      .filter((op) => isOpLevel || op.hitos.length > 0);
  }, [ops, tab, query, adv, quick]);


  const selectedOp = selected ? ops.find((o) => o.id === selected.opId) ?? null : null;
  const selectedHito = selectedOp && selected?.hitoId
    ? selectedOp.hitos.find((h) => h.id === selected.hitoId) ?? null
    : null;

  const canMarkReady = can("transaction.write"); // seller_admin+
  const canUpload = can("fiscal.upload");

  const exportCsv = () => {
    const rows = [["Operacion", "Comprador", "Sector", "Hito", "Estado", "Vence", "Monto", "Prioridad", "Obs abiertas", "Docs"]];
    for (const op of filteredOps) for (const h of op.hitos) {
      rows.push([
        op.id, op.buyer, op.sector, h.name, HITO_STATUS_CFG[h.status].label, h.dueDate,
        String(h.amountLinked), h.priority, String(h.observationsOpen), String(h.documents.length),
      ]);
    }
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cumplimiento_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (role !== "seller") return <RoleGate />;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PackageCheck}
        title="Cumplimiento de operación"
        subtitle="Gestiona los hitos, documentos y evidencias requeridas para validar el cumplimiento de tus operaciones activas."
        actions={
          <>
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-yo-txt text-sm hover:border-yo-border-s">
              <FileDown className="size-4" /> Exportar CSV
            </button>
            {canUpload && (
              <button
                onClick={() => setUploadFor({ opId: ops[0]?.id })}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium hover:bg-yo-ac-h"
              >
                <UploadCloud className="size-4" /> Subir evidencia
              </button>
            )}
          </>
        }
      />

      <NoCustodyBanner
        message="Este panel es tu bandeja operativa como vendedor. YOKTO valida las evidencias que subas y, cuando el comprador aprueba, ordena la liberación a la pasarela. YOKTO no custodia fondos."
      />

      <InfoBox tone="info" title="Cómo funciona el cumplimiento">
        Cada operación tiene hitos, documentos, contratos y comprobantes fiscales requeridos. Un candado activo
        (contrato sin firma, CFDI faltante, requisito sectorial) bloquea la aprobación y la liberación del pago
        hasta que quede subsanado.
      </InfoBox>

      {profileMissing.length > 0 && (
        <div className="rounded-lg border border-[#FEF3C7] bg-[#FFFBEB] px-4 py-3 flex items-start gap-3">
          <BellRing className="size-4 mt-0.5 text-[#D97706]" />
          <div className="flex-1 text-[12.5px] text-[#92400E]">
            <div className="font-medium">Tu perfil tiene requisitos pendientes</div>
            <div className="mt-0.5">{profileMissing.join(" · ")}. Complétalos para evitar bloqueos en la liberación de fondos.</div>
          </div>
          <a href="/onboarding" className="h-8 px-3 rounded-md bg-white border border-[#F5D08A] text-xs font-medium text-[#92400E] hover:bg-[#FEF3C7] inline-flex items-center">Ir al perfil</a>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard title="Hitos pendientes" value={metrics.pendientes} tone="ac" icon={ClipboardList} hint="Requieren entrega o evidencia" />
        <MetricCard title="En revisión" value={metrics.enRevision} tone="info" icon={LoaderCircle} hint="Esperando validación" />
        <MetricCard title="Por corregir" value={metrics.porCorregir} tone="err" icon={AlertTriangle} hint="Atención requerida" />
        <MetricCard title="Vencidos" value={metrics.vencidos} tone="warn" icon={Clock} hint="Requieren acción inmediata" />
        <MetricCard title="Listos para liberar" value={formatMXN(metrics.listosLiberar)} tone="ok" icon={CircleDollarSign} hint="Hitos aprobados" mono />
        <MetricCard title="Score operativo" value={metrics.score} tone="ac" icon={ShieldCheck} hint="Cumplimiento de operaciones" />
      </div>

      {/* Tabs */}
      <div className="border-b border-yo-border overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn("px-3 h-9 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap",
                  active ? "border-yo-ac text-yo-ac" : "border-transparent text-yo-txt-2 hover:text-yo-txt")}>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search + filters + view toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[280px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-yo-txt-3" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por operación, hito, folio, RFC o contraparte..."
            className="w-full pl-9 pr-3 h-9 rounded-md border border-yo-border bg-yo-surface text-sm text-yo-txt hover:border-yo-border-s focus:border-yo-ac focus:ring-2 focus:ring-indigo-100 outline-none" />
        </div>
        <button onClick={() => setShowFilters((v) => !v)}
          className={cn("inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm",
            showFilters ? "border-yo-ac text-yo-ac bg-yo-ac-bg" : "border-yo-border bg-yo-surface text-yo-txt-2 hover:border-yo-border-s")}>
          <Filter className="size-4" /> Filtros{Object.values(adv).some(Boolean) && <span className="ml-1 text-[10px] rounded-full bg-yo-ac text-white px-1.5 py-0.5">•</span>}
        </button>
        {([
          ["atencion", "Requiere mi atención"],
          ["vence7d", "Vence esta semana"],
          ["conPago", "Con pago pendiente"],
          ["docsRechazados", "Docs rechazados"],
        ] as [QuickFilter, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setQuick(quick === k ? null : k)}
            className={cn("h-9 px-3 rounded-full border text-xs font-medium",
              quick === k ? "border-yo-ac bg-yo-ac-bg text-yo-ac" : "border-yo-border bg-yo-surface text-yo-txt-2 hover:border-yo-ac hover:text-yo-ac")}>
            {label}
          </button>
        ))}
        <div className="ml-auto inline-flex rounded-md border border-yo-border bg-yo-surface p-0.5">
          <button onClick={() => setView("cards")}
            className={cn("h-8 px-2.5 rounded text-xs inline-flex items-center gap-1.5", view === "cards" ? "bg-yo-raised text-yo-txt" : "text-yo-txt-2")}>
            <LayoutGrid className="size-3.5" /> Tarjetas
          </button>
          <button onClick={() => setView("table")}
            className={cn("h-8 px-2.5 rounded text-xs inline-flex items-center gap-1.5", view === "table" ? "bg-yo-raised text-yo-txt" : "text-yo-txt-2")}>
            <TableIcon className="size-3.5" /> Tabla
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="rounded-lg border border-yo-border bg-yo-surface p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <label className="text-[11px] text-yo-txt-2">Sector
            <select value={adv.sector} onChange={(e) => setAdv({ ...adv, sector: e.target.value })}
              className="mt-1 w-full h-9 px-2 rounded-md border border-yo-border bg-yo-raised text-sm">
              <option value="">Todos</option>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-yo-txt-2">Contraparte
            <input value={adv.contraparte} onChange={(e) => setAdv({ ...adv, contraparte: e.target.value })} placeholder="Nombre o RFC"
              className="mt-1 w-full h-9 px-2 rounded-md border border-yo-border bg-yo-raised text-sm" />
          </label>
          <label className="text-[11px] text-yo-txt-2">Prioridad
            <select value={adv.priority} onChange={(e) => setAdv({ ...adv, priority: e.target.value as AdvFilters["priority"] })}
              className="mt-1 w-full h-9 px-2 rounded-md border border-yo-border bg-yo-raised text-sm">
              <option value="">Cualquiera</option><option value="ALTA">Alta</option><option value="MEDIA">Media</option><option value="BAJA">Baja</option>
            </select>
          </label>
          <label className="text-[11px] text-yo-txt-2">Vence antes de
            <input type="date" value={adv.dueBefore} onChange={(e) => setAdv({ ...adv, dueBefore: e.target.value })}
              className="mt-1 w-full h-9 px-2 rounded-md border border-yo-border bg-yo-raised text-sm" />
          </label>
          <label className="inline-flex items-center gap-2 text-[12px] text-yo-txt-2 mt-4">
            <input type="checkbox" checked={adv.hasPayment} onChange={(e) => setAdv({ ...adv, hasPayment: e.target.checked })} /> Con pago
          </label>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-[12px] text-yo-txt-2 mt-4">
              <input type="checkbox" checked={adv.hasObservations} onChange={(e) => setAdv({ ...adv, hasObservations: e.target.checked })} /> Con obs.
            </label>
            <button onClick={() => setAdv(EMPTY_ADV)} className="ml-auto mt-4 h-8 px-2.5 rounded-md text-[11px] font-medium text-yo-txt-2 hover:text-yo-txt">Limpiar</button>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <div className="space-y-4">
          {filteredOps.length === 0 ? (
            <EmptyState />
          ) : view === "cards" ? (
            filteredOps.map((op) => (
              <OperationCard key={op.id} op={op}
                onOpenHito={(hitoId) => setSelected({ opId: op.id, hitoId })}
                onOpenOp={() => setSelected({ opId: op.id })}
                onUpload={(hitoId) => setUploadFor({ opId: op.id, hitoId })}
                onMarkReady={canMarkReady ? (h) => setMarkReadyFor({ op, hito: h }) : undefined}
                highlight={selected?.opId === op.id ? selected?.hitoId : undefined} />
            ))
          ) : (
            <TableView ops={filteredOps} onOpen={(o, h) => setSelected({ opId: o, hitoId: h })} onUpload={(o, h) => setUploadFor({ opId: o, hitoId: h })} />
          )}
        </div>

        <aside className="xl:sticky xl:top-4 h-fit">
          {selectedOp ? (
            <DetailPanel op={selectedOp} hito={selectedHito}
              canMarkReady={canMarkReady}
              onClose={() => setSelected(null)}
              onUpload={(hitoId) => setUploadFor({ opId: selectedOp.id, hitoId })}
              onMarkReady={() => selectedHito && setMarkReadyFor({ op: selectedOp, hito: selectedHito })}
              onFixObs={(obs) => selectedHito && setFixObsFor({ op: selectedOp, hito: selectedHito, obs })} />
          ) : (
            <ContextEmpty />
          )}
        </aside>
      </div>

      {uploadFor && (
        <UploadModal op={ops.find((o) => o.id === uploadFor.opId) ?? null} hitoId={uploadFor.hitoId} onClose={() => setUploadFor(null)} />
      )}
      {markReadyFor && (
        <MarkReadyModal op={markReadyFor.op} hito={markReadyFor.hito} onClose={() => setMarkReadyFor(null)} />
      )}
      {fixObsFor && (
        <FixObservationModal op={fixObsFor.op} hito={fixObsFor.hito} obs={fixObsFor.obs} onClose={() => setFixObsFor(null)} />
      )}
    </div>
  );
}

/* ================= Sub-components ================= */

function RoleGate() {
  return (
    <div className="max-w-xl mx-auto mt-10 rounded-xl border border-yo-border bg-yo-surface p-8 text-center">
      <PackageCheck className="size-10 text-yo-txt-3 mx-auto mb-3" />
      <h2 className="text-lg font-semibold text-yo-txt">Módulo exclusivo del vendedor</h2>
      <p className="mt-2 text-sm text-yo-txt-2">
        El Cumplimiento de operación está disponible cuando participas como vendedor. Cambia tu vista a
        "Vendedor" desde el selector en la barra lateral para acceder.
      </p>
    </div>
  );
}

function MetricCard({ title, value, tone, icon: Icon, hint, mono }:
  { title: string; value: string | number; tone: keyof typeof TONE_ACCENT; icon: any; hint: string; mono?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-yo-border bg-yo-surface p-4 shadow-sm">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: TONE_ACCENT[tone] }} />
      <div className="flex items-center justify-between text-yo-txt-2">
        <span className="text-[11px] uppercase tracking-wider font-medium">{title}</span>
        <Icon className="size-4 text-yo-txt-3" />
      </div>
      <div className={cn("mt-2 text-2xl font-semibold leading-none text-yo-txt", mono && "font-mono tabular-nums")}>{value}</div>
      <p className="mt-2 text-[11px] text-yo-txt-3">{hint}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: HitoStatus }) {
  const cfg = HITO_STATUS_CFG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", TONE_BADGE[cfg.tone])}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  );
}

function DocStatusBadge({ status }: { status: keyof typeof DOC_STATUS_CFG }) {
  const cfg = DOC_STATUS_CFG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium", TONE_BADGE[cfg.tone])}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  );
}

function OperationCard({
  op, onOpenHito, onOpenOp, onUpload, onMarkReady, highlight,
}: {
  op: Operation;
  onOpenHito: (hitoId: string) => void;
  onOpenOp: () => void;
  onUpload: (hitoId: string) => void;
  onMarkReady?: (h: Hito) => void;
  highlight?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-yo-border bg-yo-surface shadow-sm overflow-hidden">
      <span className="block h-0.5 bg-yo-ac" aria-hidden />
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[12px] text-yo-ac-txt bg-yo-ac-bg px-1.5 py-0.5 rounded">{op.id}</span>
              <h3 className="text-[15px] font-semibold text-yo-txt truncate">{op.name}</h3>
            </div>
            <p className="mt-0.5 text-xs text-yo-txt-2">
              Comprador: <span className="text-yo-txt">{op.buyer}</span> · Sector: {op.sector} · Riesgo{" "}
              <span className={cn("font-medium",
                op.risk === "BAJO" && "text-[#059669]",
                op.risk === "MEDIO" && "text-[#D97706]",
                op.risk === "ALTO" && "text-[#DC2626]")}>{op.risk}</span>
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-yo-txt-3">Retenido</div>
            <div className="font-mono tabular-nums text-yo-txt font-semibold">{formatMXN(op.heldAmount, op.currency)}</div>
            <div className="text-[11px] text-yo-txt-3">Vence próx: {op.nextDueDate}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-yo-txt-2 mb-1">
            <span>Cumplimiento</span>
            <span className="font-medium text-yo-txt">{op.progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-yo-raised overflow-hidden">
            <div className="h-full bg-yo-ac rounded-full" style={{ width: `${op.progress}%` }} />
          </div>
        </div>

        {op.locks.length > 0 && (
          <button onClick={onOpenOp} className="mt-3 w-full text-left rounded-md border border-[#FEF3C7] bg-[#FFFBEB] px-3 py-2 flex items-center justify-between gap-2 hover:border-[#FDE68A]">
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="size-3.5 text-[#D97706] shrink-0" />
              <span className="text-[11.5px] text-[#92400E] truncate">
                {op.locks.length} {op.locks.length === 1 ? "candado activo" : "candados activos"}: {op.locks.slice(0, 2).map((l) => l.label).join(" · ")}
                {op.locks.length > 2 && ` +${op.locks.length - 2}`}
              </span>
            </div>
            <ChevronRight className="size-3.5 text-[#92400E] shrink-0" />
          </button>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={onOpenOp} className="h-8 px-3 rounded-md border border-yo-border bg-yo-surface text-xs font-medium text-yo-txt hover:border-yo-border-s">Ver detalle</button>
          <button onClick={() => setOpen((v) => !v)} className="h-8 px-3 rounded-md text-xs font-medium text-yo-ac hover:bg-yo-ac-bg inline-flex items-center gap-1">
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {open ? "Ocultar hitos" : `Ver ${op.hitos.length} hitos`}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-yo-border divide-y divide-yo-border">
          {op.hitos.map((h) => (
            <HitoRow key={h.id} hito={h} highlighted={highlight === h.id}
              onOpen={() => onOpenHito(h.id)}
              onUpload={() => onUpload(h.id)}
              onMarkReady={onMarkReady ? () => onMarkReady(h) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function HitoRow({ hito, onOpen, onUpload, onMarkReady, highlighted }:
  { hito: Hito; onOpen: () => void; onUpload: () => void; onMarkReady?: () => void; highlighted?: boolean }) {
  const pct = Math.round((hito.requirementsCompleted / hito.requirementsTotal) * 100) || 0;
  const dd = daysUntil(hito.dueDate);
  return (
    <div className={cn("p-4 flex flex-wrap items-start justify-between gap-3 hover:bg-yo-raised/60 transition", highlighted && "bg-yo-ac-bg/40")}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-yo-txt-3">{hito.id}</span>
          <span className="font-medium text-yo-txt">{hito.name}</span>
          <StatusBadge status={hito.status} />
          {hito.priority === "ALTA" && (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#DC2626] bg-[#FEF2F2] rounded-full px-2 py-0.5">Prioridad alta</span>
          )}
          {hito.observationsOpen > 0 && (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#DC2626] bg-[#FEF2F2] rounded-full px-2 py-0.5">
              <AlertTriangle className="size-3" /> {hito.observationsOpen} obs.
            </span>
          )}
          {dd >= 0 && dd <= 3 && hito.status !== "APROBADO" && (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#D97706] bg-[#FFFBEB] rounded-full px-2 py-0.5">Vence en {dd}d</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-yo-txt-2 truncate">{hito.description}</p>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-yo-txt-3 flex-wrap">
          <span className="inline-flex items-center gap-1"><Clock className="size-3" /> Vence {hito.dueDate}</span>
          <span className="inline-flex items-center gap-1"><CircleDollarSign className="size-3" /> <span className="font-mono text-yo-txt-2">{formatMXN(hito.amountLinked)}</span></span>
          <span>Requisitos {hito.requirementsCompleted}/{hito.requirementsTotal}</span>
        </div>
        <div className="mt-1.5 h-1 w-40 max-w-full rounded-full bg-yo-raised overflow-hidden">
          <div className="h-full bg-yo-ac rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 shrink-0">
        <HitoActions status={hito.status} onOpen={onOpen} onUpload={onUpload} onMarkReady={onMarkReady} />
      </div>
    </div>
  );
}

function HitoActions({ status, onOpen, onUpload, onMarkReady }:
  { status: HitoStatus; onOpen: () => void; onUpload: () => void; onMarkReady?: () => void }) {
  const btn = "h-8 px-3 rounded-md text-xs font-medium";
  const primary = `${btn} bg-yo-ac text-white hover:bg-yo-ac-h`;
  const secondary = `${btn} border border-yo-border bg-yo-surface text-yo-txt hover:border-yo-border-s`;
  const danger = `${btn} bg-[#FEF2F2] text-[#DC2626] hover:border-[#DC2626] border border-transparent`;
  switch (status) {
    case "RECHAZADO":
      return (<><button className={danger} onClick={onOpen}>Ver observaciones</button><button className={secondary} onClick={onUpload}>Enviar corrección</button></>);
    case "APROBADO":
      return (<button className={secondary} onClick={onOpen}>Ver aprobación</button>);
    case "EN_REVISION":
    case "LISTO_REVISION":
      return (<button className={secondary} onClick={onOpen}>Ver estado</button>);
    case "EN_CARGA":
      return (<>
        <button className={secondary} onClick={onUpload}>Continuar carga</button>
        {onMarkReady ? (
          <button className={primary} onClick={onMarkReady}>Marcar listo</button>
        ) : (
          <button className={cn(primary, "opacity-50 cursor-not-allowed")} title="Requiere rol seller_admin" disabled><Lock className="inline size-3 mr-1" />Marcar listo</button>
        )}
      </>);
    case "EN_DISPUTA":
      return (<button className={secondary} onClick={onOpen}>Ver disputa</button>);
    case "VENCIDO":
      return (<><button className={danger} onClick={onUpload}>Subir urgente</button><button className={secondary} onClick={onOpen}>Ver detalle</button></>);
    default:
      return (<><button className={secondary} onClick={onUpload}>Subir evidencia</button><button className={secondary} onClick={onOpen}>Ver detalle</button></>);
  }
}

/* ============= Table view ============= */
function TableView({ ops, onOpen, onUpload }: { ops: Operation[]; onOpen: (op: string, h: string) => void; onUpload: (op: string, h: string) => void }) {
  return (
    <div className="rounded-xl border border-yo-border bg-yo-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="bg-yo-raised text-left text-yo-txt-3">
            <tr>
              <th className="px-3 py-2 font-medium">Operación</th>
              <th className="px-3 py-2 font-medium">Hito</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Vence</th>
              <th className="px-3 py-2 font-medium text-right">Monto</th>
              <th className="px-3 py-2 font-medium">Prioridad</th>
              <th className="px-3 py-2 font-medium">Obs.</th>
              <th className="px-3 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-yo-border">
            {ops.flatMap((op) =>
              op.hitos.map((h) => (
                <tr key={op.id + h.id} className="hover:bg-yo-raised/60">
                  <td className="px-3 py-2">
                    <div className="font-mono text-[11px] text-yo-ac-txt">{op.id}</div>
                    <div className="text-yo-txt truncate max-w-[220px]">{op.name}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono text-[11px] text-yo-txt-3">{h.id}</div>
                    <div className="text-yo-txt truncate max-w-[220px]">{h.name}</div>
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={h.status} /></td>
                  <td className="px-3 py-2 whitespace-nowrap text-yo-txt-2">{h.dueDate}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-yo-txt">{formatMXN(h.amountLinked)}</td>
                  <td className="px-3 py-2">{h.priority}</td>
                  <td className="px-3 py-2">{h.observationsOpen || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => onOpen(op.id, h.id)} className="h-7 px-2 rounded-md border border-yo-border text-[11px]">Ver</button>
                      <button onClick={() => onUpload(op.id, h.id)} className="h-7 px-2 rounded-md bg-yo-ac text-white text-[11px]">Subir</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============= Detail panel ============= */

function DetailPanel({ op, hito, canMarkReady, onClose, onUpload, onMarkReady, onFixObs }:
  { op: Operation; hito: Hito | null; canMarkReady: boolean; onClose: () => void; onUpload: (hitoId?: string) => void; onMarkReady: () => void; onFixObs: (o: Observation) => void }) {
  const [tab, setTab] = useState<"resumen" | "contrato" | "fiscal" | "sectorial" | "candados" | "docs" | "evid" | "obs" | "timeline">("resumen");

  return (
    <div className="rounded-xl border border-yo-border bg-yo-surface shadow-sm overflow-hidden">
      <span className="block h-0.5 bg-yo-ac" aria-hidden />
      <div className="p-4 border-b border-yo-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-[11px] text-yo-txt-3">{op.id}</div>
            <div className="text-[15px] font-semibold text-yo-txt truncate">{op.name}</div>
            <div className="text-xs text-yo-txt-2 truncate">{op.buyer}</div>
          </div>
          <button onClick={onClose} className="size-7 grid place-items-center rounded-md hover:bg-yo-raised" aria-label="Cerrar">
            <X className="size-4 text-yo-txt-3" />
          </button>
        </div>
        {hito && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-yo-txt-2">Hito:</span>
            <span className="text-xs font-medium text-yo-txt">{hito.name}</span>
            <StatusBadge status={hito.status} />
          </div>
        )}
      </div>

      <div className="p-4 border-b border-yo-border bg-yo-raised/40">
        <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold">Pago asociado</div>
        <div className="mt-1 font-mono tabular-nums text-lg text-yo-txt font-semibold">{formatMXN(hito?.amountLinked ?? op.heldAmount, op.currency)}</div>
        <p className="mt-1 text-[11px] text-yo-txt-3">La liberación depende de la aprobación de este hito y de las reglas pactadas.</p>
      </div>

      <div className="border-b border-yo-border flex overflow-x-auto">
        {([
          { k: "resumen", l: "Resumen" },
          { k: "candados", l: `Candados${op.locks.length ? ` (${op.locks.length})` : ""}` },
          { k: "contrato", l: "Contrato" },
          { k: "fiscal", l: "Fiscal CFDI/REP" },
          { k: "sectorial", l: "Sectoriales" },
          { k: "docs", l: "Documentos" },
          { k: "evid", l: "Evidencias" },
          { k: "obs", l: "Observaciones" },
          { k: "timeline", l: "Timeline" },
        ] as const).map((t) => {
          const active = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={cn("px-3 h-9 text-[12.5px] font-medium border-b-2 -mb-px whitespace-nowrap",
                active ? "border-yo-ac text-yo-ac" : "border-transparent text-yo-txt-2 hover:text-yo-txt")}>
              {t.l}
            </button>
          );
        })}
      </div>

      <div className="p-4">
        {tab === "resumen" && <ResumenTab op={op} hito={hito} />}
        {tab === "candados" && <CandadosTab op={op} />}
        {tab === "contrato" && <ContratoTab op={op} />}
        {tab === "fiscal" && <FiscalTab op={op} />}
        {tab === "sectorial" && <SectorialTab op={op} />}
        {tab === "docs" && <DocsTab hito={hito} />}
        {tab === "evid" && <EvidTab hito={hito} />}
        {tab === "obs" && <ObsTab hito={hito} onFix={onFixObs} />}
        {tab === "timeline" && <TimelineTab />}
      </div>

      <div className="p-3 border-t border-yo-border flex flex-wrap gap-2">
        <button onClick={() => onUpload(hito?.id)}
          className="flex-1 h-9 rounded-md bg-yo-ac text-white text-xs font-medium hover:bg-yo-ac-h inline-flex items-center justify-center gap-1.5">
          <UploadCloud className="size-3.5" /> Subir evidencia
        </button>
        {canMarkReady ? (
          <button onClick={onMarkReady} disabled={!hito}
            className="flex-1 h-9 rounded-md border border-yo-border bg-yo-surface text-xs font-medium text-yo-txt hover:border-yo-border-s disabled:opacity-40 inline-flex items-center justify-center gap-1.5">
            <FileCheck2 className="size-3.5" /> Marcar hito listo
          </button>
        ) : (
          <div className="flex-1 h-9 rounded-md border border-yo-border bg-yo-raised text-xs font-medium text-yo-txt-3 inline-flex items-center justify-center gap-1.5" title="Requiere rol seller_admin">
            <Lock className="size-3.5" /> Marcar listo (admin)
          </div>
        )}
      </div>
    </div>
  );
}

function ResumenTab({ op, hito }: { op: Operation; hito: Hito | null }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2">Cumplimiento de esta operación</div>
        <div className="text-2xl font-semibold text-yo-txt">{op.progress}%</div>
        <div className="mt-1 h-1.5 rounded-full bg-yo-raised overflow-hidden"><div className="h-full bg-yo-ac" style={{ width: `${op.progress}%` }} /></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <Kv k="Documental" v="78%" />
          <Kv k="Evidencia" v="65%" />
          <Kv k="Hitos" v={`${op.hitos.filter((h) => h.status === "APROBADO").length}/${op.hitos.length}`} />
          <Kv k="Obs. abiertas" v={String(op.hitos.reduce((s, h) => s + h.observationsOpen, 0))} />
        </div>
      </div>

      {hito && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2">Checklist del hito</div>
          <ul className="space-y-1.5">
            {hito.checklist.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px]">
                {c.state === "ok" && <CheckCircle2 className="size-4 text-[#059669] mt-0.5" />}
                {c.state === "pending" && <CircleDashed className="size-4 text-[#D97706] mt-0.5" />}
                {c.state === "reject" && <XCircle className="size-4 text-[#DC2626] mt-0.5" />}
                {c.state === "opt" && <Circle className="size-4 text-yo-txt-3 mt-0.5" />}
                <span className={cn("text-yo-txt-2", c.state === "reject" && "text-yo-txt")}>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-md border border-yo-border bg-yo-raised/50 p-3 text-[11.5px] text-yo-txt-2">
        Cada archivo cargado genera trazabilidad: fecha, usuario, versión y hash documental.
      </div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-yo-border bg-yo-surface p-2">
      <div className="text-[10px] uppercase tracking-wider text-yo-txt-3">{k}</div>
      <div className="text-sm font-semibold text-yo-txt">{v}</div>
    </div>
  );
}

function DocsTab({ hito }: { hito: Hito | null }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!hito) return <NoHito />;
  if (hito.documents.length === 0) return <Empty text="Sin documentos cargados en este hito." />;
  return (
    <div className="space-y-2">
      {hito.documents.map((d: HitoDoc) => (
        <div key={d.id} className="rounded-md border border-yo-border">
          <div className="p-2.5 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-yo-txt font-medium text-[12.5px] flex items-center gap-1.5"><ReceiptText className="size-3.5 text-yo-txt-3" />{d.name}</div>
              <div className="font-mono text-[10.5px] text-yo-txt-3 truncate max-w-[260px]">{d.hash}</div>
              <div className="mt-1 text-[11px] text-yo-txt-2">Versión actual <span className="font-mono">{d.version}</span>{d.uploadedAt && <> · Cargado {d.uploadedAt}</>}</div>
              {d.observation && <div className="mt-1 text-[11px] text-[#DC2626]">{d.observation}</div>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <DocStatusBadge status={d.status} />
              {d.history && d.history.length > 0 && (
                <button onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                  className="h-7 px-2 rounded-md text-[11px] text-yo-ac hover:bg-yo-ac-bg inline-flex items-center gap-1">
                  <History className="size-3" /> {d.history.length} versiones
                </button>
              )}
            </div>
          </div>
          {expanded === d.id && d.history && (
            <div className="border-t border-yo-border bg-yo-raised/40 p-2.5 space-y-1.5">
              {d.history.map((v) => (
                <div key={v.version} className="flex items-start justify-between gap-2 text-[11.5px]">
                  <div className="min-w-0">
                    <div><span className="font-mono text-yo-txt">{v.version}</span> · {v.uploadedBy} · {v.uploadedAt}</div>
                    <div className="font-mono text-[10.5px] text-yo-txt-3 truncate max-w-[240px]">{v.hash}</div>
                    {v.note && <div className="text-yo-txt-2">{v.note}</div>}
                  </div>
                  <DocStatusBadge status={v.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EvidTab({ hito }: { hito: Hito | null }) {
  if (!hito) return <NoHito />;
  if (hito.evidences.length === 0) return <Empty text="Sin evidencias cargadas." />;
  return (
    <ul className="space-y-2">
      {hito.evidences.map((e) => (
        <li key={e.id} className="rounded-md border border-yo-border p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-yo-txt">
                {e.type === "Fotografía" && <Camera className="size-3.5 text-yo-txt-3" />}
                {e.type === "Video" && <History className="size-3.5 text-yo-txt-3" />}
                {e.type === "GPS" && <MapPin className="size-3.5 text-yo-txt-3" />}
                {e.title}
              </div>
              <div className="text-[11px] text-yo-txt-3 mt-0.5">{e.type} · Cap. {e.capturedAt}{e.hasGps && <> · <MapPin className="inline size-3" /> GPS</>}</div>
            </div>
            <DocStatusBadge status={e.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ObsTab({ hito, onFix }: { hito: Hito | null; onFix: (o: Observation) => void }) {
  if (!hito) return <NoHito />;
  if (hito.observations.length === 0) return <Empty text="Sin observaciones abiertas." />;
  return (
    <ul className="space-y-2">
      {hito.observations.map((o) => (
        <li key={o.id} className="rounded-md border border-[#FEF2F2] bg-[#FEF2F2]/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#DC2626] bg-white rounded-full px-2 py-0.5">
              <AlertTriangle className="size-3" /> {o.severity}
            </span>
            <span className="text-[10.5px] text-yo-txt-3">{o.date}</span>
          </div>
          <div className="mt-1.5 text-[12px] text-yo-txt">{o.message}</div>
          <div className="mt-1 text-[11px] text-yo-txt-3">Sobre: {o.targetLabel} · {o.author}</div>
          <div className="mt-2 flex gap-1.5">
            <button onClick={() => onFix(o)} className="h-7 px-2.5 rounded-md bg-yo-ac text-white text-[11px] font-medium">Enviar corrección</button>
            <button className="h-7 px-2.5 rounded-md border border-yo-border text-[11px] font-medium text-yo-txt">Solicitar aclaración</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TimelineTab() {
  const events = [
    { d: "2026-07-14 10:20", who: "Verificador Yokto", a: "Emitió observación", o: "DOC-8831 · CFDI entrega parcial" },
    { d: "2026-07-14 09:12", who: "Tú", a: "Cargó evidencia", o: "EV-3312 · Video recorrido zona B" },
    { d: "2026-07-14 09:10", who: "Tú", a: "Cargó evidencia", o: "EV-3311 · Fotos avance zona A" },
    { d: "2026-06-21 14:03", who: "Backoffice", a: "Aprobó hito", o: "MILE-001 · Anticipo documental" },
  ];
  return (
    <ol className="relative border-l border-yo-border ml-2 space-y-3">
      {events.map((e, i) => (
        <li key={i} className="pl-3">
          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full bg-yo-ac" />
          <div className="text-[10.5px] text-yo-txt-3 font-mono">{e.d}</div>
          <div className="text-[12.5px] text-yo-txt"><span className="font-medium">{e.who}</span> — {e.a}</div>
          <div className="text-[11px] text-yo-txt-2">{e.o}</div>
        </li>
      ))}
    </ol>
  );
}

/* ============= New: Candados / Contrato / Fiscal / Sectorial tabs ============= */

function CandadosTab({ op }: { op: Operation }) {
  if (op.locks.length === 0) {
    return (
      <div className="rounded-md border border-[#DCFCE7] bg-[#F0FDF4] p-4 text-[12.5px] text-[#166534]">
        <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4" /> Sin candados activos</div>
        <p className="mt-1 text-[11.5px] text-[#166534]/80">Esta operación no tiene bloqueos de cumplimiento pendientes.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-[#FEF3C7] bg-[#FFFBEB] p-3 text-[12px] text-[#92400E] flex gap-2">
        <Lock className="size-4 mt-0.5" />
        <div>Estos candados impiden que el hito pueda enviarse a revisión o que YOKTO ordene liberaciones a la pasarela.</div>
      </div>
      {op.locks.map((lk, i) => (
        <div key={i} className="rounded-md border border-yo-border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-yo-txt flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-[#D97706]" /> {lk.label}
              </div>
              <p className="mt-0.5 text-[11.5px] text-yo-txt-2">{lk.detail}</p>
              <div className="mt-1.5 flex gap-1.5 flex-wrap">
                {lk.blocksApproval && <span className="text-[10px] font-medium bg-[#FEF2F2] text-[#DC2626] rounded-full px-2 py-0.5">Bloquea aprobación</span>}
                {lk.blocksRelease && <span className="text-[10px] font-medium bg-[#FFFBEB] text-[#D97706] rounded-full px-2 py-0.5">Bloquea liberación</span>}
              </div>
            </div>
            {lk.actionLabel && (
              <button className="h-7 px-2.5 rounded-md bg-yo-ac text-white text-[11px] font-medium hover:bg-yo-ac-h shrink-0">{lk.actionLabel}</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContratoTab({ op }: { op: Operation }) {
  const c: ContractInfo = op.contract;
  const badgeTone = c.status === "FIRMADO_COMPLETO" ? "ok"
    : c.status === "RECHAZADO" ? "err"
    : c.status === "EN_FIRMA" || c.status === "FIRMADO_PARCIAL" ? "info"
    : "neutral";
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-yo-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold">Contrato de la operación</div>
            <div className="mt-0.5 text-[13px] font-semibold text-yo-txt">
              {c.method === "GENERADO_AUTOMATICO" ? "Generado automáticamente" : "PDF subido"} · {c.templateName ?? "—"}
            </div>
            <div className="mt-1 text-[11.5px] text-yo-txt-2">
              Versión <span className="font-mono">{c.version}</span> · Hash <span className="font-mono text-yo-txt-3">{c.hash}</span>
            </div>
          </div>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", TONE_BADGE[badgeTone])}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {CONTRACT_STATUS_LABEL[c.status]}
          </span>
        </div>
      </div>

      <div className="rounded-md border border-yo-border">
        <div className="px-3 py-2 border-b border-yo-border bg-yo-raised/40 text-[11px] font-medium text-yo-txt-2">Firmas</div>
        <ul className="divide-y divide-yo-border">
          {c.signatures.map((s, i) => (
            <li key={i} className="p-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-yo-txt">
                  {s.party === "COMPRADOR" ? "Comprador" : "Vendedor"} — {s.name}
                </div>
                <div className="text-[11px] text-yo-txt-3 mt-0.5">
                  {s.method === "EFIRMA_SAT" ? "e.firma SAT" : s.method === "AUTOGRAFA_DIGITAL_BIOMETRICA" ? "Firma autógrafa + biometría" : "Método por definir"}
                  {s.signedAt && <> · {s.signedAt}</>}
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
        <button className="h-8 px-3 rounded-md border border-yo-border bg-yo-surface text-xs font-medium text-yo-txt hover:border-yo-border-s">Ver contrato</button>
        <button className="h-8 px-3 rounded-md border border-yo-border bg-yo-surface text-xs font-medium text-yo-txt hover:border-yo-border-s">Descargar PDF</button>
        {c.signatures.some((s) => s.party === "VENDEDOR" && !s.signed) && (
          <button className="h-8 px-3 rounded-md bg-yo-ac text-white text-xs font-medium hover:bg-yo-ac-h">Firmar ahora</button>
        )}
        {c.status === "RECHAZADO" && (
          <button className="h-8 px-3 rounded-md border border-yo-border bg-yo-surface text-xs font-medium text-yo-txt hover:border-yo-border-s">Subir nueva versión</button>
        )}
      </div>

      <div className="rounded-md border border-yo-border bg-yo-raised/40 p-3 text-[11.5px] text-yo-txt-2">
        El contrato firmado forma parte del expediente. Si falta alguna firma requerida, no podrás enviar hitos a revisión.
      </div>
    </div>
  );
}

function FiscalTab({ op }: { op: Operation }) {
  const [showData, setShowData] = useState<"cfdi" | REPInfo | null>(null);
  const f: FiscalInfo = op.fiscal;
  const cfdiTone = f.cfdi.status === "CFDI_ACEPTADO" ? "ok"
    : f.cfdi.status === "CFDI_RECHAZADO" ? "err"
    : f.cfdi.status === "SIN_CFDI" ? "warn" : "info";
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-[#FEF3C7] bg-[#FFFBEB] p-3 text-[12px] text-[#92400E] flex gap-2">
        <Info className="size-4 mt-0.5" />
        <div>YOKTO no emite CFDI ni REP. Debes generarlos en tu PAC o sistema contable y subir el XML timbrado.</div>
      </div>

      <div className="rounded-md border border-yo-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold">CFDI PPD inicial</div>
            <div className="mt-0.5 text-[13px] font-semibold text-yo-txt">
              {f.cfdi.uuid ? <span className="font-mono text-[12px]">{f.cfdi.uuid}</span> : "Aún no subido"}
            </div>
            <div className="mt-1 text-[11.5px] text-yo-txt-2">
              Emisor <span className="font-mono">{f.emisorRfc}</span> · Receptor <span className="font-mono">{f.receptorRfc}</span> · Uso {f.usoCfdi}
            </div>
            {f.cfdi.observacion && <div className="mt-1 text-[11.5px] text-[#DC2626]">{f.cfdi.observacion}</div>}
          </div>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", TONE_BADGE[cfdiTone])}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {FISCAL_STATUS_LABEL[f.cfdi.status]}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button onClick={() => setShowData("cfdi")} className="h-7 px-2.5 rounded-md border border-yo-border text-[11px] font-medium text-yo-txt">Ver datos para CFDI</button>
          {f.cfdi.status === "SIN_CFDI" && (
            <button className="h-7 px-2.5 rounded-md bg-yo-ac text-white text-[11px] font-medium hover:bg-yo-ac-h">Subir XML</button>
          )}
        </div>
      </div>

      <div className="rounded-md border border-yo-border">
        <div className="px-3 py-2 border-b border-yo-border bg-yo-raised/40 text-[11px] font-medium text-yo-txt-2">
          REPs por parcialidad — {f.reps.length === 0 ? "sin parcialidades registradas" : `${f.reps.filter((r) => r.status === "REP_ACEPTADO").length}/${f.reps.length} aceptados`}
        </div>
        {f.reps.length === 0 ? (
          <div className="p-4 text-[11.5px] text-yo-txt-3">Los REPs se habilitan cuando exista un CFDI PPD aceptado y se liberen parcialidades.</div>
        ) : (
          <ul className="divide-y divide-yo-border">
            {f.reps.map((r) => {
              const tone = r.status === "REP_ACEPTADO" ? "ok" : r.status === "REP_RECHAZADO" ? "err" : "warn";
              return (
                <li key={r.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium text-yo-txt">Parcialidad {r.numParcialidad}</div>
                      <div className="text-[11px] text-yo-txt-3 font-mono">
                        Saldo ant {formatMXN(r.impSaldoAnt)} · Pagado {formatMXN(r.impPagado)} · Saldo insoluto {formatMXN(r.impSaldoInsoluto)}
                      </div>
                      {r.observacion && <div className="text-[11px] text-[#DC2626] mt-0.5">{r.observacion}</div>}
                    </div>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium", TONE_BADGE[tone])}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {FISCAL_STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <button onClick={() => setShowData(r)} className="h-7 px-2.5 rounded-md border border-yo-border text-[11px] font-medium text-yo-txt">Ver datos REP</button>
                    {(r.status === "REP_PENDIENTE" || r.status === "REP_RECHAZADO") && (
                      <button className="h-7 px-2.5 rounded-md bg-yo-ac text-white text-[11px] font-medium hover:bg-yo-ac-h">Subir REP XML</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showData && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setShowData(null)}>
          <div className="w-full max-w-md rounded-xl bg-yo-surface border border-yo-border shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-yo-border flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-yo-txt">
                  {showData === "cfdi" ? "Datos para emitir tu CFDI PPD" : `Datos para REP parcialidad ${showData.numParcialidad}`}
                </h3>
                <p className="text-[11px] text-yo-txt-3">Cópialos en tu sistema contable o PAC.</p>
              </div>
              <button onClick={() => setShowData(null)} className="size-7 grid place-items-center rounded-md hover:bg-yo-raised"><X className="size-4" /></button>
            </div>
            <div className="p-4 text-[12px] font-mono space-y-1.5 text-yo-txt bg-yo-raised/40">
              {showData === "cfdi" ? (
                <>
                  <div>RFC emisor: {f.emisorRfc}</div>
                  <div>RFC receptor: {f.receptorRfc}</div>
                  <div>Método de pago: PPD</div>
                  <div>Forma de pago: 99 — Por definir</div>
                  <div>Uso CFDI: {f.usoCfdi}</div>
                  <div>CP receptor: {f.cpReceptor}</div>
                  <div>Total: {formatMXN(f.totalOperacion)}</div>
                  <div>Concepto: {f.conceptoSugerido}</div>
                </>
              ) : (
                <>
                  <div>UUID CFDI origen: {f.cfdi.uuid ?? "—"}</div>
                  <div>NumParcialidad: {showData.numParcialidad}</div>
                  <div>ImpSaldoAnt: {formatMXN(showData.impSaldoAnt)}</div>
                  <div>ImpPagado: {formatMXN(showData.impPagado)}</div>
                  <div>ImpSaldoInsoluto: {formatMXN(showData.impSaldoInsoluto)}</div>
                  <div>FormaDePagoP: {showData.formaDePagoP ?? "03 — SPEI"}</div>
                </>
              )}
            </div>
            <div className="p-3 border-t border-yo-border flex justify-end">
              <button onClick={() => setShowData(null)} className="h-9 px-3 rounded-md bg-yo-ac text-white text-sm font-medium">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectorialTab({ op }: { op: Operation }) {
  const reqs = op.sectorRequirements;
  if (reqs.length === 0) return <Empty text="Este sector no tiene requisitos adicionales configurados." />;
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-yo-border bg-yo-raised/40 p-3 text-[11.5px] text-yo-txt-2">
        Sector: <span className="font-medium text-yo-txt">{op.sector}</span>. Los requisitos cambian según lo pactado en la operación.
      </div>
      <ul className="divide-y divide-yo-border rounded-md border border-yo-border overflow-hidden">
        {reqs.map((r: SectorRequirement) => {
          const tone = r.status === "COMPLETO" ? "ok"
            : r.status === "RECHAZADO" ? "err"
            : r.status === "EN_PROCESO" ? "info" : "neutral";
          return (
            <li key={r.id} className="p-3 flex items-start justify-between gap-2 bg-yo-surface">
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-yo-txt">{r.label}</div>
                <div className="text-[10.5px] text-yo-txt-3 mt-0.5">{r.type}{r.hint && ` · ${r.hint}`}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium", TONE_BADGE[tone])}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {r.status}
                </span>
                {r.status !== "COMPLETO" && (
                  <button className="h-7 px-2.5 rounded-md bg-yo-ac text-white text-[11px] font-medium hover:bg-yo-ac-h">
                    {r.type === "EVIDENCIA" ? "Subir" : r.type === "CHECKLIST" ? "Completar" : "Cargar"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NoHito() { return <Empty text="Selecciona un hito específico para ver este contenido." />; }
function Empty({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-yo-border p-6 text-center text-xs text-yo-txt-3">{text}</div>;
}

function ContextEmpty() {
  return (
    <div className="rounded-xl border border-dashed border-yo-border bg-yo-surface p-6 text-center">
      <PackageCheck className="size-8 text-yo-txt-3 mx-auto mb-2" />
      <div className="text-sm font-medium text-yo-txt">Selecciona una operación</div>
      <p className="mt-1 text-xs text-yo-txt-3">Verás el resumen de cumplimiento, documentos, evidencias, observaciones y timeline.</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-yo-border bg-yo-surface p-10 text-center">
      <PackageCheck className="size-10 text-yo-txt-3 mx-auto mb-3" />
      <h3 className="text-base font-semibold text-yo-txt">No tienes entregables en este estado</h3>
      <p className="mt-1 text-sm text-yo-txt-2">Ajusta los filtros o cambia de pestaña para ver otras operaciones activas.</p>
    </div>
  );
}

/* ============= Modals ============= */

function ModalShell({ title, subtitle, onClose, children, footer }:
  { title: string; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-yo-surface border border-yo-border shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-yo-border flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-yo-txt">{title}</h3>
            {subtitle && <p className="text-xs text-yo-txt-3 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-md hover:bg-yo-raised" aria-label="Cerrar"><X className="size-4" /></button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
        <div className="p-3 border-t border-yo-border flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

function UploadModal({ op, hitoId, onClose }: { op: Operation | null; hitoId?: string; onClose: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const onFiles = (fs: FileList | null) => { if (fs) setFiles(Array.from(fs)); };
  return (
    <ModalShell
      title="Subir evidencia / documento"
      subtitle={<>{op ? <>Operación <span className="font-mono">{op.id}</span></> : "Selecciona una operación"}{hitoId && <> · Hito <span className="font-mono">{hitoId}</span></>}</>}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="h-9 px-3 rounded-md border border-yo-border text-sm text-yo-txt">Cancelar</button>
        <button className="h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-sm text-yo-txt hover:border-yo-border-s">Guardar borrador</button>
        <button onClick={onClose} className="h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium hover:bg-yo-ac-h">Enviar a revisión</button>
      </>}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-yo-txt-2">Tipo
          <select className="mt-1 w-full h-9 px-2 rounded-md border border-yo-border bg-yo-raised text-sm">
            <option>CFDI ingreso</option><option>Checklist</option><option>Fotografía</option><option>Contrato</option><option>Otro</option>
          </select>
        </label>
        <label className="text-[11px] text-yo-txt-2">Hito
          <select defaultValue={hitoId} className="mt-1 w-full h-9 px-2 rounded-md border border-yo-border bg-yo-raised text-sm">
            {op?.hitos.map((h) => <option key={h.id} value={h.id}>{h.id} · {h.name}</option>)}
          </select>
        </label>
      </div>
      <label className="text-[11px] text-yo-txt-2 block">Descripción
        <textarea rows={2} className="mt-1 w-full px-2 py-1.5 rounded-md border border-yo-border bg-yo-raised text-sm" placeholder="Notas para el revisor" />
      </label>
      <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
        className={cn("rounded-xl border-2 border-dashed p-6 text-center transition", dragging ? "border-yo-ac bg-yo-ac-bg/50" : "border-yo-border-s bg-yo-raised")}>
        <UploadCloud className="size-8 mx-auto text-yo-txt-3 mb-2" />
        <div className="text-sm text-yo-txt">Arrastra tus archivos aquí o selecciónalos desde tu equipo.</div>
        <p className="mt-1 text-[11px] text-yo-txt-3">Formatos permitidos: PDF, XML, JPG, PNG, MP4. Máx 25 MB por archivo.</p>
        <label className="mt-3 inline-block h-8 px-3 rounded-md border border-yo-border bg-yo-surface text-xs font-medium text-yo-txt hover:border-yo-border-s cursor-pointer">
          Seleccionar archivo
          <input type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        </label>
        {files.length > 0 && (
          <ul className="mt-3 text-left text-[11.5px] space-y-1 max-h-24 overflow-auto">
            {files.map((f, i) => <li key={i} className="text-yo-txt-2 truncate">• {f.name} <span className="text-yo-txt-3">({Math.round(f.size / 1024)} KB)</span></li>)}
          </ul>
        )}
      </div>
    </ModalShell>
  );
}

function MarkReadyModal({ op, hito, onClose }: { op: Operation; hito: Hito; onClose: () => void }) {
  const initial = useMemo(() => {
    const map: Record<number, boolean> = {};
    hito.checklist.forEach((c, i) => { map[i] = c.state === "ok"; });
    return map;
  }, [hito]);
  const [checks, setChecks] = useState<Record<number, boolean>>(initial);
  const [comment, setComment] = useState("");
  const allOk = hito.checklist.every((c, i) => c.state === "opt" || checks[i]);
  return (
    <ModalShell
      title="Marcar hito como listo"
      subtitle={<>Operación <span className="font-mono">{op.id}</span> · Hito <span className="font-mono">{hito.id}</span></>}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="h-9 px-3 rounded-md border border-yo-border text-sm text-yo-txt">Cancelar</button>
        <button disabled={!allOk} onClick={onClose}
          className={cn("h-9 px-4 rounded-md text-sm font-medium inline-flex items-center gap-1.5",
            allOk ? "bg-yo-ac text-white hover:bg-yo-ac-h" : "bg-yo-raised text-yo-txt-3 cursor-not-allowed")}>
          <FileCheck2 className="size-3.5" /> Enviar a revisión
        </button>
      </>}
    >
      <div className="rounded-md border border-yo-border bg-yo-raised/40 p-3 text-[12px] text-yo-txt-2 flex gap-2">
        <Info className="size-4 mt-0.5 text-yo-ac" />
        <div>Confirma que cada requisito está cargado y correcto. Una vez enviado, el verificador Yokto tendrá 48h para dictaminar.</div>
      </div>
      <ul className="space-y-1.5">
        {hito.checklist.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-[12.5px]">
            <input type="checkbox" checked={!!checks[i]} onChange={(e) => setChecks({ ...checks, [i]: e.target.checked })}
              className="mt-1 accent-[#4F46E5]" disabled={c.state === "opt"} />
            <div className="min-w-0">
              <div className="text-yo-txt">{c.label} {c.state === "opt" && <span className="text-yo-txt-3">(opcional)</span>}</div>
              {c.state === "reject" && <div className="text-[11px] text-[#DC2626]">Requiere corrección previa.</div>}
            </div>
          </li>
        ))}
      </ul>
      <label className="text-[11px] text-yo-txt-2 block">Comentario para el revisor (opcional)
        <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
          className="mt-1 w-full px-2 py-1.5 rounded-md border border-yo-border bg-yo-raised text-sm" placeholder="Detalles relevantes del cumplimiento" />
      </label>
    </ModalShell>
  );
}

function FixObservationModal({ op, hito, obs, onClose }: { op: Operation; hito: Hito; obs: Observation; onClose: () => void }) {
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  return (
    <ModalShell
      title="Corregir observación"
      subtitle={<>Operación <span className="font-mono">{op.id}</span> · Hito <span className="font-mono">{hito.id}</span></>}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="h-9 px-3 rounded-md border border-yo-border text-sm text-yo-txt">Cancelar</button>
        <button disabled={!comment.trim() && files.length === 0} onClick={onClose}
          className={cn("h-9 px-4 rounded-md text-sm font-medium",
            comment.trim() || files.length ? "bg-yo-ac text-white hover:bg-yo-ac-h" : "bg-yo-raised text-yo-txt-3 cursor-not-allowed")}>
          Enviar corrección
        </button>
      </>}
    >
      <div className="rounded-md border border-[#FEF2F2] bg-[#FEF2F2]/50 p-3 text-[12px] text-[#7F1D1D]">
        <div className="font-medium">{obs.severity}</div>
        <div className="mt-1">{obs.message}</div>
        <div className="mt-1 text-[11px] text-yo-txt-3">Sobre: {obs.targetLabel} · {obs.author} · {obs.date}</div>
      </div>
      <label className="text-[11px] text-yo-txt-2 block">Explicación de la corrección
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
          className="mt-1 w-full px-2 py-1.5 rounded-md border border-yo-border bg-yo-raised text-sm" placeholder="Describe qué corregiste y cómo se resuelve la observación" />
      </label>
      <label className="text-[11px] text-yo-txt-2 block">Adjuntar nuevo documento / evidencia
        <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="mt-1 block w-full text-[12px] file:mr-3 file:h-8 file:px-3 file:rounded-md file:border file:border-yo-border file:bg-yo-surface file:text-yo-txt hover:file:border-yo-border-s" />
        {files.length > 0 && <div className="mt-1.5 text-[11px] text-yo-txt-3">{files.length} archivo(s) seleccionado(s)</div>}
      </label>
    </ModalShell>
  );
}
