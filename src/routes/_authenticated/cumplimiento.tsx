import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  PackageCheck, ClipboardList, LoaderCircle, AlertTriangle, CircleDollarSign, ShieldCheck,
  UploadCloud, FileDown, ChevronDown, ChevronRight, FileCheck2, Camera, MapPin, History,
  ReceiptText, Clock, X, CheckCircle2, XCircle, Circle, CircleDashed, Search, Filter,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useViewRole } from "@/hooks/use-view-role";
import { cn } from "@/lib/utils";
import {
  MOCK_OPS, HITO_STATUS_CFG, DOC_STATUS_CFG, TONE_BADGE, TONE_ACCENT, formatMXN,
  type Operation, type Hito, type HitoStatus,
} from "@/lib/cumplimiento-mock";

export const Route = createFileRoute("/_authenticated/cumplimiento")({
  head: () => ({ meta: [
    { title: "Cumplimiento de operación — YOKTO" },
    { name: "robots", content: "noindex" },
  ]}),
  component: CumplimientoPage,
});

const TABS: { key: "ALL" | HitoStatus; label: string }[] = [
  { key: "ALL", label: "Todos" },
  { key: "PENDIENTE", label: "Pendientes" },
  { key: "EN_CARGA", label: "En carga" },
  { key: "LISTO_REVISION", label: "Listos para revisión" },
  { key: "EN_REVISION", label: "En revisión" },
  { key: "APROBADO", label: "Aprobados" },
  { key: "RECHAZADO", label: "Rechazados" },
  { key: "VENCIDO", label: "Vencidos" },
];

function CumplimientoPage() {
  const { role } = useViewRole();
  if (role !== "seller") {
    return <RoleGate />;
  }

  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ opId: string; hitoId?: string } | null>(null);
  const [uploadFor, setUploadFor] = useState<{ opId: string; hitoId?: string } | null>(null);

  const ops = MOCK_OPS;

  // Aggregate metrics from hitos
  const metrics = useMemo(() => {
    const allHitos = ops.flatMap((o) => o.hitos);
    return {
      pendientes: allHitos.filter((h) => h.status === "PENDIENTE" || h.status === "EN_CARGA" || h.status === "NO_INICIADO").length,
      enRevision: allHitos.filter((h) => h.status === "EN_REVISION" || h.status === "LISTO_REVISION").length,
      porCorregir: allHitos.filter((h) => h.status === "RECHAZADO").length,
      listosLiberar: allHitos.filter((h) => h.status === "APROBADO").reduce((s, h) => s + h.amountLinked, 0),
      score: 86,
    };
  }, [ops]);

  const filteredOps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ops
      .map((op) => {
        const hitos = op.hitos.filter((h) => {
          if (tab !== "ALL" && h.status !== tab) return false;
          if (q) {
            const hay = [op.id, op.name, op.buyer, h.name, h.id].join(" ").toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        return { ...op, hitos };
      })
      .filter((op) => op.hitos.length > 0);
  }, [ops, tab, query]);

  const selectedOp = selected ? ops.find((o) => o.id === selected.opId) ?? null : null;
  const selectedHito = selectedOp && selected?.hitoId
    ? selectedOp.hitos.find((h) => h.id === selected.hitoId) ?? null
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PackageCheck}
        title="Cumplimiento de operación"
        subtitle="Gestiona los hitos, documentos y evidencias requeridas para validar el cumplimiento de tus operaciones activas."
        actions={
          <>
            <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-yo-txt text-sm hover:border-yo-border-s">
              <FileDown className="size-4" /> Exportar reporte
            </button>
            <button
              onClick={() => setUploadFor({ opId: ops[0]?.id })}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium hover:bg-yo-ac-h"
            >
              <UploadCloud className="size-4" /> Subir evidencia
            </button>
          </>
        }
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <MetricCard title="Hitos pendientes" value={metrics.pendientes} tone="ac" icon={ClipboardList} hint="Requieren entrega o evidencia" />
        <MetricCard title="En revisión" value={metrics.enRevision} tone="info" icon={LoaderCircle} hint="Esperando validación" />
        <MetricCard title="Por corregir" value={metrics.porCorregir} tone="err" icon={AlertTriangle} hint="Atención requerida" />
        <MetricCard title="Listos para liberar" value={formatMXN(metrics.listosLiberar)} tone="ok" icon={CircleDollarSign} hint="Hitos aprobados" mono />
        <MetricCard title="Score operativo" value={metrics.score} tone="ac" icon={ShieldCheck} hint="Cumplimiento de operaciones activas" />
      </div>

      {/* Tabs */}
      <div className="border-b border-yo-border overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 h-9 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap",
                  active ? "border-yo-ac text-yo-ac" : "border-transparent text-yo-txt-2 hover:text-yo-txt"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[280px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-yo-txt-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por operación, hito, documento, folio, RFC o contraparte..."
            className="w-full pl-9 pr-3 h-9 rounded-md border border-yo-border bg-yo-surface text-sm text-yo-txt hover:border-yo-border-s focus:border-yo-ac focus:ring-2 focus:ring-indigo-100 outline-none"
          />
        </div>
        <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-yo-txt-2 text-sm hover:border-yo-border-s">
          <Filter className="size-4" /> Filtros
        </button>
        {["Requiere mi atención", "Vence esta semana", "Con pago pendiente", "Docs rechazados"].map((f) => (
          <button key={f} className="h-9 px-3 rounded-full border border-yo-border bg-yo-surface text-xs font-medium text-yo-txt-2 hover:border-yo-ac hover:text-yo-ac">
            {f}
          </button>
        ))}
      </div>

      {/* Main layout 70/30 */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <div className="space-y-4">
          {filteredOps.length === 0 ? (
            <EmptyState />
          ) : (
            filteredOps.map((op) => (
              <OperationCard
                key={op.id}
                op={op}
                onOpenHito={(hitoId) => setSelected({ opId: op.id, hitoId })}
                onOpenOp={() => setSelected({ opId: op.id })}
                onUpload={(hitoId) => setUploadFor({ opId: op.id, hitoId })}
                highlight={selected?.opId === op.id ? selected?.hitoId : undefined}
              />
            ))
          )}
        </div>

        <aside className="xl:sticky xl:top-4 h-fit">
          {selectedOp ? (
            <DetailPanel op={selectedOp} hito={selectedHito} onClose={() => setSelected(null)} onUpload={(hitoId) => setUploadFor({ opId: selectedOp.id, hitoId })} />
          ) : (
            <ContextEmpty />
          )}
        </aside>
      </div>

      {uploadFor && (
        <UploadModal
          op={ops.find((o) => o.id === uploadFor.opId) ?? null}
          hitoId={uploadFor.hitoId}
          onClose={() => setUploadFor(null)}
        />
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
      <Navigate to="/dashboard" />
    </div>
  );
}

function MetricCard({
  title, value, tone, icon: Icon, hint, mono,
}: { title: string; value: string | number; tone: keyof typeof TONE_ACCENT; icon: any; hint: string; mono?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-yo-border bg-yo-surface p-4 shadow-sm">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: TONE_ACCENT[tone] }} />
      <div className="flex items-center justify-between text-yo-txt-2">
        <span className="text-[11px] uppercase tracking-wider font-medium">{title}</span>
        <Icon className="size-4 text-yo-txt-3" />
      </div>
      <div className={cn("mt-2 text-2xl font-semibold leading-none text-yo-txt", mono && "font-mono tabular-nums")}>
        {value}
      </div>
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
  op, onOpenHito, onOpenOp, onUpload, highlight,
}: {
  op: Operation;
  onOpenHito: (hitoId: string) => void;
  onOpenOp: () => void;
  onUpload: (hitoId: string) => void;
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
              <span className={cn(
                "font-medium",
                op.risk === "BAJO" && "text-[#059669]",
                op.risk === "MEDIO" && "text-[#D97706]",
                op.risk === "ALTO" && "text-[#DC2626]",
              )}>{op.risk}</span>
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

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={onOpenOp} className="h-8 px-3 rounded-md border border-yo-border bg-yo-surface text-xs font-medium text-yo-txt hover:border-yo-border-s">
            Ver detalle
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="h-8 px-3 rounded-md text-xs font-medium text-yo-ac hover:bg-yo-ac-bg inline-flex items-center gap-1"
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {open ? "Ocultar hitos" : `Ver ${op.hitos.length} hitos`}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-yo-border divide-y divide-yo-border">
          {op.hitos.map((h) => (
            <HitoRow
              key={h.id}
              hito={h}
              highlighted={highlight === h.id}
              onOpen={() => onOpenHito(h.id)}
              onUpload={() => onUpload(h.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HitoRow({ hito, onOpen, onUpload, highlighted }: { hito: Hito; onOpen: () => void; onUpload: () => void; highlighted?: boolean }) {
  const pct = Math.round((hito.requirementsCompleted / hito.requirementsTotal) * 100) || 0;
  return (
    <div className={cn("p-4 flex flex-wrap items-start justify-between gap-3 hover:bg-yo-raised/60 transition", highlighted && "bg-yo-ac-bg/40")}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-yo-txt-3">{hito.id}</span>
          <span className="font-medium text-yo-txt">{hito.name}</span>
          <StatusBadge status={hito.status} />
          {hito.observationsOpen > 0 && (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#DC2626] bg-[#FEF2F2] rounded-full px-2 py-0.5">
              <AlertTriangle className="size-3" /> {hito.observationsOpen} obs.
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-yo-txt-2 truncate">{hito.description}</p>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-yo-txt-3">
          <span className="inline-flex items-center gap-1"><Clock className="size-3" /> Vence {hito.dueDate}</span>
          <span className="inline-flex items-center gap-1"><CircleDollarSign className="size-3" /> <span className="font-mono text-yo-txt-2">{formatMXN(hito.amountLinked)}</span></span>
          <span>Requisitos {hito.requirementsCompleted}/{hito.requirementsTotal}</span>
        </div>
        <div className="mt-1.5 h-1 w-40 max-w-full rounded-full bg-yo-raised overflow-hidden">
          <div className="h-full bg-yo-ac rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 shrink-0">
        <HitoActions status={hito.status} onOpen={onOpen} onUpload={onUpload} />
      </div>
    </div>
  );
}

function HitoActions({ status, onOpen, onUpload }: { status: HitoStatus; onOpen: () => void; onUpload: () => void }) {
  const btn = "h-8 px-3 rounded-md text-xs font-medium";
  const primary = `${btn} bg-yo-ac text-white hover:bg-yo-ac-h`;
  const secondary = `${btn} border border-yo-border bg-yo-surface text-yo-txt hover:border-yo-border-s`;
  const danger = `${btn} bg-[#FEF2F2] text-[#DC2626] hover:border-[#DC2626] border border-transparent`;
  switch (status) {
    case "RECHAZADO":
      return (<><button className={danger} onClick={onOpen}>Ver observaciones</button><button className={secondary} onClick={onUpload}>Enviar corrección</button></>);
    case "APROBADO":
      return (<><button className={secondary} onClick={onOpen}>Ver aprobación</button></>);
    case "EN_REVISION":
    case "LISTO_REVISION":
      return (<><button className={secondary} onClick={onOpen}>Ver estado</button></>);
    case "EN_CARGA":
      return (<><button className={secondary} onClick={onUpload}>Continuar carga</button><button className={primary} onClick={onOpen}>Marcar listo</button></>);
    case "EN_DISPUTA":
      return (<><button className={secondary} onClick={onOpen}>Ver disputa</button></>);
    default:
      return (<><button className={secondary} onClick={onUpload}>Subir evidencia</button><button className={secondary} onClick={onOpen}>Ver detalle</button></>);
  }
}

function DetailPanel({ op, hito, onClose, onUpload }: { op: Operation; hito: Hito | null; onClose: () => void; onUpload: (hitoId?: string) => void }) {
  const [tab, setTab] = useState<"resumen" | "docs" | "evid" | "obs" | "timeline">("resumen");

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

      {/* Payment box */}
      <div className="p-4 border-b border-yo-border bg-yo-raised/40">
        <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold">Pago asociado</div>
        <div className="mt-1 font-mono tabular-nums text-lg text-yo-txt font-semibold">
          {formatMXN(hito?.amountLinked ?? op.heldAmount, op.currency)}
        </div>
        <p className="mt-1 text-[11px] text-yo-txt-3">
          La liberación depende de la aprobación de este hito y de las reglas pactadas en la operación.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-yo-border flex overflow-x-auto">
        {([
          { k: "resumen",  l: "Resumen" },
          { k: "docs",     l: "Documentos" },
          { k: "evid",     l: "Evidencias" },
          { k: "obs",      l: "Observaciones" },
          { k: "timeline", l: "Timeline" },
        ] as const).map((t) => {
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={cn(
                "px-3 h-9 text-[12.5px] font-medium border-b-2 -mb-px whitespace-nowrap",
                active ? "border-yo-ac text-yo-ac" : "border-transparent text-yo-txt-2 hover:text-yo-txt"
              )}
            >
              {t.l}
            </button>
          );
        })}
      </div>

      <div className="p-4">
        {tab === "resumen" && <ResumenTab op={op} hito={hito} />}
        {tab === "docs" && <DocsTab hito={hito} />}
        {tab === "evid" && <EvidTab hito={hito} />}
        {tab === "obs" && <ObsTab hito={hito} />}
        {tab === "timeline" && <TimelineTab />}
      </div>

      <div className="p-3 border-t border-yo-border flex flex-wrap gap-2">
        <button
          onClick={() => onUpload(hito?.id)}
          className="flex-1 h-9 rounded-md bg-yo-ac text-white text-xs font-medium hover:bg-yo-ac-h inline-flex items-center justify-center gap-1.5"
        >
          <UploadCloud className="size-3.5" /> Subir evidencia
        </button>
        <button className="flex-1 h-9 rounded-md border border-yo-border bg-yo-surface text-xs font-medium text-yo-txt hover:border-yo-border-s inline-flex items-center justify-center gap-1.5">
          <FileCheck2 className="size-3.5" /> Marcar hito listo
        </button>
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
        <div className="mt-1 h-1.5 rounded-full bg-yo-raised overflow-hidden">
          <div className="h-full bg-yo-ac" style={{ width: `${op.progress}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <Kv k="Documental" v="78%" />
          <Kv k="Evidencia" v="65%" />
          <Kv k="Hitos" v={`${op.hitos.filter(h=>h.status==="APROBADO").length}/${op.hitos.length}`} />
          <Kv k="Obs. abiertas" v={String(op.hitos.reduce((s,h)=>s+h.observationsOpen,0))} />
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
  if (!hito) return <NoHito />;
  if (hito.documents.length === 0) return <Empty text="Sin documentos cargados en este hito." />;
  return (
    <table className="w-full text-[12px]">
      <thead className="text-left text-yo-txt-3">
        <tr>
          <th className="pb-2 font-medium">Documento</th>
          <th className="pb-2 font-medium">Ver.</th>
          <th className="pb-2 font-medium">Estado</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-yo-border">
        {hito.documents.map((d) => (
          <tr key={d.id}>
            <td className="py-2">
              <div className="text-yo-txt font-medium flex items-center gap-1.5"><ReceiptText className="size-3.5 text-yo-txt-3" />{d.name}</div>
              <div className="font-mono text-[10.5px] text-yo-txt-3 truncate max-w-[220px]">{d.hash}</div>
              {d.observation && <div className="mt-1 text-[11px] text-[#DC2626]">{d.observation}</div>}
            </td>
            <td className="py-2 font-mono text-[11px] text-yo-txt-2">{d.version}</td>
            <td className="py-2"><DocStatusBadge status={d.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
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
              <div className="text-[11px] text-yo-txt-3 mt-0.5">
                {e.type} · Cap. {e.capturedAt}{e.hasGps && <> · <MapPin className="inline size-3" /> GPS</>}
              </div>
            </div>
            <DocStatusBadge status={e.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ObsTab({ hito }: { hito: Hito | null }) {
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
            <button className="h-7 px-2.5 rounded-md bg-yo-ac text-white text-[11px] font-medium">Enviar corrección</button>
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

function NoHito() { return <Empty text="Selecciona un hito específico para ver este contenido." />; }
function Empty({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-yo-border p-6 text-center text-xs text-yo-txt-3">{text}</div>;
}

function ContextEmpty() {
  return (
    <div className="rounded-xl border border-dashed border-yo-border bg-yo-surface p-6 text-center">
      <PackageCheck className="size-8 text-yo-txt-3 mx-auto mb-2" />
      <div className="text-sm font-medium text-yo-txt">Selecciona una operación</div>
      <p className="mt-1 text-xs text-yo-txt-3">
        Verás el resumen de cumplimiento, documentos, evidencias, observaciones y timeline.
      </p>
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

function UploadModal({ op, hitoId, onClose }: { op: Operation | null; hitoId?: string; onClose: () => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-yo-surface border border-yo-border shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-yo-border flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-yo-txt">Subir evidencia / documento</h3>
            <p className="text-xs text-yo-txt-3 mt-0.5">
              {op ? <>Operación <span className="font-mono">{op.id}</span></> : "Selecciona una operación"}
              {hitoId && <> · Hito <span className="font-mono">{hitoId}</span></>}
            </p>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-md hover:bg-yo-raised" aria-label="Cerrar">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-yo-txt-2">
              Tipo
              <select className="mt-1 w-full h-9 px-2 rounded-md border border-yo-border bg-yo-raised text-sm">
                <option>CFDI ingreso</option><option>Checklist</option><option>Fotografía</option><option>Contrato</option><option>Otro</option>
              </select>
            </label>
            <label className="text-[11px] text-yo-txt-2">
              Hito
              <select className="mt-1 w-full h-9 px-2 rounded-md border border-yo-border bg-yo-raised text-sm" defaultValue={hitoId}>
                {op?.hitos.map((h) => <option key={h.id} value={h.id}>{h.id} · {h.name}</option>)}
              </select>
            </label>
          </div>
          <label className="text-[11px] text-yo-txt-2 block">
            Descripción
            <textarea rows={2} className="mt-1 w-full px-2 py-1.5 rounded-md border border-yo-border bg-yo-raised text-sm" placeholder="Notas para el revisor" />
          </label>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); }}
            className={cn(
              "rounded-xl border-2 border-dashed p-6 text-center transition",
              dragging ? "border-yo-ac bg-yo-ac-bg/50" : "border-yo-border-s bg-yo-raised",
            )}
          >
            <UploadCloud className="size-8 mx-auto text-yo-txt-3 mb-2" />
            <div className="text-sm text-yo-txt">Arrastra tus archivos aquí o selecciónalos desde tu equipo.</div>
            <p className="mt-1 text-[11px] text-yo-txt-3">
              Formatos permitidos: PDF, XML, JPG, PNG, MP4. Máx 25 MB por archivo.
            </p>
            <button className="mt-3 h-8 px-3 rounded-md border border-yo-border bg-yo-surface text-xs font-medium text-yo-txt hover:border-yo-border-s">
              Seleccionar archivo
            </button>
          </div>
        </div>

        <div className="p-3 border-t border-yo-border flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-3 rounded-md border border-yo-border text-sm text-yo-txt">Cancelar</button>
          <button className="h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-sm text-yo-txt hover:border-yo-border-s">Guardar borrador</button>
          <button className="h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium hover:bg-yo-ac-h">Enviar a revisión</button>
        </div>
      </div>
    </div>
  );
}
