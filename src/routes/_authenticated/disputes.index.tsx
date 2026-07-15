import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle, LockKeyhole, Clock, CheckCircle2, Scale, MessageSquareWarning,
  Search, Filter, RefreshCw, Plus, ChevronRight, X, FileCheck,
} from "lucide-react";
import {
  MOCK_DISPUTES, STATUS_CFG, PRIORITY_CFG, SECTOR_CFG, REASON_LABEL,
  slaLabel, isResolved, canOpenDispute,
  type Dispute, type DisputeStatus, type DisputeReason, type SectorId,
} from "@/lib/disputes-mock";
import { useViewRole } from "@/hooks/use-view-role";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/disputes/")({
  head: () => ({ meta: [{ title: "Disputas — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: DisputesModule,
});

const money = (c: number, cur = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(c / 100);

type TabKey = "all" | "open" | "await" | "mediation" | "evidence" | "proposed" | "resolved" | "cancelled";
const TABS: { key: TabKey; label: string; match: (s: DisputeStatus) => boolean }[] = [
  { key: "all",       label: "Todas",                match: () => true },
  { key: "open",      label: "Abiertas",             match: (s) => s === "OPENED" },
  { key: "await",     label: "Respuesta pendiente",  match: (s) => s === "AWAITING_RESPONSE" },
  { key: "mediation", label: "En mediación",         match: (s) => s === "MEDIATION" || s === "UNDER_REVIEW" },
  { key: "evidence",  label: "Esperando evidencia",  match: (s) => s === "EVIDENCE_REQUESTED" },
  { key: "proposed",  label: "Resolución propuesta", match: (s) => s === "RESOLUTION_PROPOSED" },
  { key: "resolved",  label: "Resueltas",            match: (s) => isResolved(s) },
  { key: "cancelled", label: "Canceladas",           match: (s) => s === "CANCELLED" },
];

function DisputesModule() {
  const { role } = useViewRole();
  const isBuyer = role === "buyer";

  const [tab, setTab] = useState<TabKey>("all");
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sector, setSector] = useState<SectorId | "">("");
  const [reason, setReason] = useState<DisputeReason | "">("");
  const [priority, setPriority] = useState<"" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("");
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const list = useMemo(() => {
    return MOCK_DISPUTES.filter((d) => {
      if (!TABS.find((t) => t.key === tab)!.match(d.status)) return false;
      if (sector && d.sector !== sector) return false;
      if (reason && d.reason !== reason) return false;
      if (priority && d.priority !== priority) return false;
      if (q) {
        const s = q.toLowerCase();
        return (
          d.code.toLowerCase().includes(s) ||
          d.transaction_folio.toLowerCase().includes(s) ||
          d.transaction_title.toLowerCase().includes(s) ||
          d.buyer_name.toLowerCase().includes(s) ||
          d.seller_name.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [tab, sector, reason, priority, q]);

  const metrics = useMemo(() => {
    const m = MOCK_DISPUTES;
    if (isBuyer) {
      return [
        { k: "open",  label: "Disputas abiertas", value: m.filter((d) => !isResolved(d.status) && d.status !== "CANCELLED").length, icon: AlertTriangle, accent: "#D97706" },
        { k: "hold",  label: "Fondos pausados",   value: money(m.filter((d) => !isResolved(d.status)).reduce((a, d) => a + d.held_amount_cents, 0)), icon: LockKeyhole, accent: "#4F46E5" },
        { k: "rev",   label: "En revisión",       value: m.filter((d) => d.status === "UNDER_REVIEW" || d.status === "MEDIATION").length, icon: Clock, accent: "#0284C7" },
        { k: "done",  label: "Resueltas",         value: m.filter((d) => isResolved(d.status)).length, icon: CheckCircle2, accent: "#059669" },
      ];
    }
    return [
      { k: "recv", label: "Disputas recibidas",     value: m.filter((d) => d.against_role === "seller" && !isResolved(d.status)).length, icon: AlertTriangle, accent: "#D97706" },
      { k: "resp", label: "Respuesta pendiente",    value: m.filter((d) => d.status === "AWAITING_RESPONSE").length, icon: MessageSquareWarning, accent: "#DC2626" },
      { k: "ev",   label: "Evidencia enviada",      value: m.reduce((a, d) => a + d.evidence.filter((e) => e.uploaded_by_role === "seller").length, 0), icon: FileCheck, accent: "#0284C7" },
      { k: "fav",  label: "Resueltas favorables",   value: m.filter((d) => d.status === "RESOLVED_RELEASE" || d.status === "RESOLVED_PARTIAL").length, icon: Scale, accent: "#059669" },
    ];
  }, [isBuyer]);

  const active = drawerId ? MOCK_DISPUTES.find((d) => d.id === drawerId) ?? null : null;

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <PageHeader
          icon={AlertTriangle}
          title="Disputas"
          subtitle="Gestiona controversias vinculadas a operaciones, hitos, evidencia y pagos retenidos."
          actions={
            <>
              <button className="inline-flex items-center gap-2 rounded-[8px] border border-[#EBEBF0] bg-white px-3 py-2 text-sm text-[#52525B] hover:bg-[#F4F4F7]">
                <RefreshCw className="h-4 w-4" /> Actualizar
              </button>
              {canOpenDispute(isBuyer ? "buyer" : "seller") && (
                <Link
                  to="/disputes/new"
                  className="inline-flex items-center gap-2 rounded-[8px] bg-[#4F46E5] px-3 py-2 text-sm font-medium text-white hover:bg-[#4338CA]"
                >
                  <Plus className="h-4 w-4" /> Abrir disputa
                </Link>
              )}
            </>
          }
        />

        {/* Metrics */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.k} className="relative overflow-hidden rounded-[12px] border border-[#EBEBF0] bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/.04)]">
              <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: m.accent }} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#A1A1AA]">{m.label}</p>
                  <p className="mt-1.5 text-2xl font-semibold text-[#18181B]">{m.value}</p>
                </div>
                <div className="rounded-[8px] p-2" style={{ background: `${m.accent}14` }}>
                  <m.icon className="h-4 w-4" style={{ color: m.accent }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-1 rounded-[10px] border border-[#EBEBF0] bg-white p-1">
          {TABS.map((t) => {
            const count = MOCK_DISPUTES.filter((d) => t.match(d.status)).length;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-[6px] px-3 py-1.5 text-xs font-medium transition",
                  active ? "bg-[#EEF2FF] text-[#3730A3]" : "text-[#52525B] hover:bg-[#F4F4F7]"
                )}
              >
                {t.label} <span className="ml-1 text-[#A1A1AA]">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="mt-4 rounded-[12px] border border-[#EBEBF0] bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por ID, operación, contraparte..."
                className="w-full rounded-[8px] border border-[#EBEBF0] bg-[#F4F4F7] py-2 pl-9 pr-3 text-sm text-[#18181B] placeholder:text-[#A1A1AA] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15"
              />
            </div>
            <button onClick={() => setShowFilters((v) => !v)} className="inline-flex items-center gap-2 rounded-[8px] border border-[#EBEBF0] bg-white px-3 py-2 text-sm text-[#52525B] hover:bg-[#F4F4F7]">
              <Filter className="h-4 w-4" /> Filtros
            </button>
            {(sector || reason || priority) && (
              <button onClick={() => { setSector(""); setReason(""); setPriority(""); }} className="text-xs text-[#4F46E5] hover:underline">
                Limpiar
              </button>
            )}
          </div>
          {showFilters && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#EBEBF0] pt-3 md:grid-cols-3">
              <FilterSelect label="Sector" value={sector} onChange={(v) => setSector(v as SectorId | "")}
                options={[["", "Todos"], ...Object.entries(SECTOR_CFG).map(([k, v]) => [k, v.label] as [string, string])]} />
              <FilterSelect label="Motivo" value={reason} onChange={(v) => setReason(v as DisputeReason | "")}
                options={[["", "Todos"], ...Object.entries(REASON_LABEL) as [string, string][]]} />
              <FilterSelect label="Prioridad" value={priority} onChange={(v) => setPriority(v as "" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")}
                options={[["", "Todas"], ...Object.entries(PRIORITY_CFG).map(([k, v]) => [k, v.label] as [string, string])]} />
            </div>
          )}
        </div>

        {/* Table desktop */}
        <div className="mt-4 hidden overflow-hidden rounded-[12px] border border-[#EBEBF0] bg-white md:block">
          {list.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F4F4F7] text-left text-[11px] uppercase tracking-wide text-[#71717A]">
                  <th className="px-4 py-3 font-medium">Disputa</th>
                  <th className="px-4 py-3 font-medium">Operación</th>
                  <th className="px-4 py-3 font-medium">Contraparte</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Monto afectado</th>
                  <th className="px-4 py-3 font-medium">SLA</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <DisputeRow key={d.id} d={d} isBuyer={isBuyer} onClick={() => setDrawerId(d.id)} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Cards mobile */}
        <div className="mt-4 space-y-3 md:hidden">
          {list.length === 0 ? <EmptyState /> : list.map((d) => (
            <DisputeCard key={d.id} d={d} isBuyer={isBuyer} onClick={() => setDrawerId(d.id)} />
          ))}
        </div>
      </div>

      {/* Drawer */}
      {active && <QuickDrawer d={active} isBuyer={isBuyer} onClose={() => setDrawerId(null)} />}
      
    </>
  );
}

// ---------- Row / Card ----------
function StatusBadge({ s }: { s: DisputeStatus }) {
  const c = STATUS_CFG[s];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: c.bg, color: c.txt }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}
function SectorPill({ s }: { s: SectorId }) {
  const c = SECTOR_CFG[s];
  return (
    <span className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11px]" style={{ background: c.bg, color: c.txt }}>
      <span>{c.emoji}</span> {c.label}
    </span>
  );
}

function DisputeRow({ d, isBuyer, onClick }: { d: Dispute; isBuyer: boolean; onClick: () => void }) {
  const sla = slaLabel(d.sla_due_at);
  const counter = isBuyer ? d.seller_name : d.buyer_name;
  return (
    <tr onClick={onClick} className="cursor-pointer border-t border-[#EBEBF0] hover:bg-[#F4F4F7]">
      <td className="px-4 py-3">
        <div className="font-mono text-xs font-medium text-[#18181B]">{d.code}</div>
        <div className="mt-0.5 text-[11px] text-[#A1A1AA]">{new Date(d.created_at).toLocaleDateString("es-MX")}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-mono text-xs text-[#52525B]">{d.transaction_folio}</div>
        <div className="mt-0.5"><SectorPill s={d.sector} /></div>
      </td>
      <td className="px-4 py-3 text-[#18181B]">{counter}</td>
      <td className="px-4 py-3 text-[#52525B]">{REASON_LABEL[d.reason]}</td>
      <td className="px-4 py-3"><StatusBadge s={d.status} /></td>
      <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[#18181B]">{money(d.affected_amount_cents, d.currency)}</td>
      <td className="px-4 py-3">
        <span className={cn("text-xs font-medium", sla.tone === "err" && "text-[#DC2626]", sla.tone === "warn" && "text-[#D97706]", sla.tone === "ok" && "text-[#52525B]")}>
          {sla.text}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <ChevronRight className="inline h-4 w-4 text-[#A1A1AA]" />
      </td>
    </tr>
  );
}

function DisputeCard({ d, isBuyer, onClick }: { d: Dispute; isBuyer: boolean; onClick: () => void }) {
  const sla = slaLabel(d.sla_due_at);
  const counter = isBuyer ? d.seller_name : d.buyer_name;
  const c = STATUS_CFG[d.status];
  return (
    <button onClick={onClick} className="relative block w-full overflow-hidden rounded-[12px] border border-[#EBEBF0] bg-white p-4 text-left">
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: c.dot }} />
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-medium text-[#18181B]">{d.code}</span>
        <StatusBadge s={d.status} />
      </div>
      <div className="mt-2 text-sm font-medium text-[#18181B]">{d.transaction_title}</div>
      <div className="mt-0.5 text-xs text-[#52525B]">{d.transaction_folio} · {counter}</div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-[#52525B]">Motivo: {REASON_LABEL[d.reason]}</span>
        <span className="font-mono font-semibold text-[#18181B]">{money(d.affected_amount_cents, d.currency)}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#71717A]">
        <span>SLA: <span className={cn(sla.tone === "err" && "text-[#DC2626]", sla.tone === "warn" && "text-[#D97706]")}>{sla.text}</span></span>
        <span>{new Date(d.updated_at).toLocaleDateString("es-MX")}</span>
      </div>
    </button>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-[#71717A]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-[8px] border border-[#EBEBF0] bg-[#F4F4F7] px-3 py-2 text-sm text-[#18181B] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="rounded-full bg-[#EEF2FF] p-3"><AlertTriangle className="h-6 w-6 text-[#4F46E5]" /></div>
      <h3 className="mt-3 text-sm font-medium text-[#18181B]">No tienes disputas activas</h3>
      <p className="mt-1 max-w-sm text-xs text-[#52525B]">
        Cuando exista una controversia en una operación, aparecerá aquí con su evidencia, estado y acciones disponibles.
      </p>
      <Link to="/transactions" className="mt-3 text-xs font-medium text-[#4F46E5] hover:underline">Ver operaciones activas →</Link>
    </div>
  );
}

// ---------- Drawer ----------
function QuickDrawer({ d, isBuyer, onClose }: { d: Dispute; isBuyer: boolean; onClose: () => void }) {
  const sla = slaLabel(d.sla_due_at);
  const counter = isBuyer ? d.seller_name : d.buyer_name;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="flex h-full w-full flex-col overflow-y-auto bg-white shadow-2xl md:w-[480px]">
        <div className="sticky top-0 border-b border-[#EBEBF0] bg-white px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium text-[#18181B]">{d.code}</span>
                <StatusBadge s={d.status} />
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: PRIORITY_CFG[d.priority].bg, color: PRIORITY_CFG[d.priority].txt }}>
                  {PRIORITY_CFG[d.priority].label}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#71717A]">Abierta el {new Date(d.created_at).toLocaleDateString("es-MX")}</p>
            </div>
            <button onClick={onClose} className="rounded-[6px] p-1 hover:bg-[#F4F4F7]"><X className="h-4 w-4 text-[#52525B]" /></button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <Section title="Operación vinculada">
            <div className="text-sm font-medium text-[#18181B]">{d.transaction_title}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-[#52525B]">
              <span className="font-mono">{d.transaction_folio}</span> · <SectorPill s={d.sector} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <KV k="Monto total" v={money(d.total_amount_cents, d.currency)} mono />
              <KV k="Contraparte" v={counter} />
            </div>
          </Section>

          <Section title="Motivo">
            <div className="text-sm text-[#18181B]">{REASON_LABEL[d.reason]}</div>
            <p className="mt-1 text-xs text-[#52525B]">{d.description}</p>
          </Section>

          <Section title="Impacto en pago">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <KV k="Monto afectado" v={money(d.affected_amount_cents, d.currency)} mono />
              <KV k="Fondos pausados" v={money(d.held_amount_cents, d.currency)} mono />
            </div>
            <div className="mt-2 rounded-[8px] bg-[#FFFBEB] px-3 py-2 text-[11px] text-[#B45309]">
              <LockKeyhole className="mr-1 inline h-3 w-3" />
              Liberación pausada mientras la disputa esté activa.
            </div>
          </Section>

          <Section title="Hitos relacionados">
            <ul className="space-y-1.5">
              {d.milestones.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-[8px] border border-[#EBEBF0] bg-[#F4F4F7] px-3 py-2 text-xs">
                  <span className="text-[#18181B]">{m.label}</span>
                  <span className="font-mono text-[#52525B]">{money(m.affected_amount_cents, d.currency)}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Evidencia clave">
            {d.evidence.length === 0 ? (
              <p className="text-xs text-[#71717A]">Sin evidencia registrada.</p>
            ) : (
              <ul className="space-y-1.5">
                {d.evidence.slice(0, 3).map((e) => (
                  <li key={e.id} className="rounded-[8px] border border-[#EBEBF0] px-3 py-2 text-xs">
                    <div className="text-[#18181B]">{e.title}</div>
                    <div className="mt-0.5 text-[10px] text-[#A1A1AA]">{e.uploaded_by_name} · <span className="font-mono">{e.hash}</span></div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="SLA">
            <div className={cn("text-sm font-medium", sla.tone === "err" && "text-[#DC2626]", sla.tone === "warn" && "text-[#D97706]", sla.tone === "ok" && "text-[#059669]")}>{sla.text}</div>
          </Section>
        </div>

        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[#EBEBF0] bg-white p-4">
          <Link to="/disputes/$id" params={{ id: d.id }} className="rounded-[8px] bg-[#4F46E5] px-3 py-2 text-center text-sm font-medium text-white hover:bg-[#4338CA]">
            Ver expediente completo
          </Link>
          <button className="rounded-[8px] border border-[#EBEBF0] bg-white px-3 py-2 text-sm font-medium text-[#52525B] hover:bg-[#F4F4F7]">
            Agregar evidencia
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#71717A]">{title}</h4>
      {children}
    </div>
  );
}
function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rounded-[8px] bg-[#F4F4F7] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[#A1A1AA]">{k}</p>
      <p className={cn("mt-0.5 text-[#18181B]", mono && "font-mono font-semibold")}>{v}</p>
    </div>
  );
}

