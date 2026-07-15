import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon, LucideProps } from "lucide-react";
import type { ReactNode, ComponentType } from "react";
import {
  BarChart3, Briefcase, PackageCheck, Banknote, FileText, FileSignature,
  AlertTriangle, ClipboardCheck, Layers, Star, Users, Download, Sparkles, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PERIOD_LABEL, type Period, hasFeature, type AnalyticsFeature, CURRENT_PLAN,
} from "@/lib/analytics-mock";

// ============ Layout wrapper ============
export function AnalyticsShell({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      <AnalyticsTabs />
      {children}
    </div>
  );
}

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/analytics", label: "Resumen", icon: BarChart3 },
  { to: "/analytics/operaciones", label: "Operaciones", icon: Briefcase },
  { to: "/analytics/cumplimiento", label: "Cumplimiento", icon: PackageCheck },
  { to: "/analytics/pagos", label: "Pagos", icon: Banknote },
  { to: "/analytics/fiscal", label: "Fiscal", icon: FileText },
  { to: "/analytics/contratos", label: "Contratos", icon: FileSignature },
  { to: "/analytics/disputas", label: "Disputas", icon: AlertTriangle },
  { to: "/analytics/aprobaciones", label: "Aprobaciones", icon: ClipboardCheck },
  { to: "/analytics/sectores", label: "Sectores", icon: Layers },
  { to: "/analytics/perfil-cumplimiento", label: "Perfil", icon: Star },
  { to: "/analytics/equipo", label: "Equipo", icon: Users },
  { to: "/analytics/exportaciones", label: "Exportaciones", icon: Download },
  { to: "/analytics/custom", label: "Custom", icon: Sparkles },
];

function AnalyticsTabs() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <div className="flex items-center gap-1 bg-yo-surface border border-yo-border rounded-lg p-1 overflow-x-auto scrollbar-hide">
      {TABS.map((t) => {
        const active = pathname === t.to;
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-md transition font-medium",
              active
                ? "bg-yo-ac-bg text-yo-ac-txt"
                : "text-yo-txt-2 hover:bg-yo-raised hover:text-yo-txt",
            )}
          >
            <Icon className={cn("size-3.5", active ? "text-yo-ac" : "text-yo-txt-3")} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

// ============ Period selector ============
const PERIODS: Period[] = ["7d", "30d", "90d", "12m", "ytd", "custom"];
export function PeriodSelector({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  return (
    <div className="inline-flex bg-yo-surface border border-yo-border rounded-lg p-1">
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "px-3 py-1.5 text-[11.5px] rounded-md transition font-medium whitespace-nowrap",
            value === p ? "bg-yo-ac text-white" : "text-yo-txt-2 hover:bg-yo-raised",
          )}
        >
          {PERIOD_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

// ============ Metric card ============
type MetricProps = {
  label: string; value: string; delta?: number; positive?: boolean;
  icon?: LucideIcon; accent?: "indigo" | "ok" | "err" | "warn" | "info";
};
const ACCENT_LINE: Record<NonNullable<MetricProps["accent"]>, string> = {
  indigo: "bg-yo-ac", ok: "bg-yo-ok", err: "bg-yo-err", warn: "bg-yo-warn", info: "bg-[#0284C7]",
};
export function MetricCard({ label, value, delta, positive, icon: Icon, accent = "indigo" }: MetricProps) {
  const hasDelta = typeof delta === "number";
  const good = positive ?? (hasDelta && delta! >= 0);
  return (
    <div className="relative rounded-xl border border-yo-border bg-yo-surface p-4 overflow-hidden">
      <div className={cn("absolute top-0 left-0 h-0.5 w-full", ACCENT_LINE[accent])} />
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-yo-txt-3">{label}</span>
        {Icon && <Icon className="size-3.5 text-yo-txt-4" />}
      </div>
      <div className="text-2xl font-bold text-yo-txt font-mono tabular-nums">{value}</div>
      {hasDelta && (
        <div className={cn("mt-1 text-[11px] font-medium", good ? "text-yo-ok" : "text-yo-err")}>
          {delta! >= 0 ? "↑" : "↓"} {Math.abs(delta!).toFixed(1)}% vs anterior
        </div>
      )}
      {!hasDelta && <div className="mt-1 text-[11px] text-yo-txt-3">—</div>}
    </div>
  );
}

// ============ Chart card ============
export function ChartCard({
  title, description, action, empty, emptyTitle = "Sin datos suficientes",
  emptyDescription = "Aún no tenemos suficiente información para mostrar esta métrica.",
  children,
}: {
  title: string; description?: string; action?: ReactNode;
  empty?: boolean; emptyTitle?: string; emptyDescription?: string; children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-yo-border bg-yo-surface p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[14px] font-semibold text-yo-txt">{title}</h3>
          {description && <p className="text-[12px] text-yo-txt-3 mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      {empty ? <EmptyState title={emptyTitle} description={emptyDescription} /> : children}
    </div>
  );
}

// ============ Empty state ============
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="mx-auto size-10 rounded-full bg-yo-raised grid place-items-center mb-3">
        <BarChart3 className="size-4 text-yo-txt-3" />
      </div>
      <p className="text-[13px] font-medium text-yo-txt">{title}</p>
      {description && <p className="text-[12px] text-yo-txt-3 mt-1 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ============ Badge (dot) ============
type Tone = "neutral" | "info" | "accent" | "ok" | "warn" | "err";
const TONE_CFG: Record<Tone, { bg: string; text: string; dot: string }> = {
  neutral: { bg: "bg-yo-raised", text: "text-yo-txt-2", dot: "bg-yo-txt-3" },
  info:    { bg: "bg-[#F0F9FF]", text: "text-[#0284C7]", dot: "bg-[#0284C7]" },
  accent:  { bg: "bg-yo-ac-bg", text: "text-yo-ac-txt", dot: "bg-yo-ac" },
  ok:      { bg: "bg-[#ECFDF5]", text: "text-[#065F46]", dot: "bg-yo-ok" },
  warn:    { bg: "bg-[#FFFBEB]", text: "text-[#92400E]", dot: "bg-yo-warn" },
  err:     { bg: "bg-[#FEF2F2]", text: "text-[#991B1B]", dot: "bg-yo-err" },
};
export function DotBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const c = TONE_CFG[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold", c.bg, c.text)}>
      <span className={cn("size-1.5 rounded-full", c.dot)} />
      {children}
    </span>
  );
}

// ============ Export button (mock CSV) ============
export function ExportCsvButton<T extends Record<string, unknown>>({
  rows, filename, label = "Exportar CSV",
}: { rows: T[]; filename: string; label?: string }) {
  const enabled = hasFeature("EXPORT_CSV");
  function handle() {
    if (!enabled || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => {
        const v = r[h];
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return /[,\n"]/.test(s) ? `"${s}"` : s;
      }).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    // Registro auditoría (mock)
    console.info("[audit] ANALYTICS_EXPORT_COMPLETED", { filename, rows: rows.length });
  }
  return (
    <button
      type="button"
      onClick={handle}
      disabled={!enabled}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12px] font-medium transition",
        enabled
          ? "border-yo-border bg-yo-surface hover:bg-yo-raised text-yo-txt"
          : "border-yo-border bg-yo-raised text-yo-txt-3 cursor-not-allowed",
      )}
      title={enabled ? "Exportar" : "No disponible en tu plan"}
    >
      <Download className="size-3.5" />
      {label}
    </button>
  );
}

// ============ Upgrade gate ============
export function UpgradeGate({
  feature, children, title = "Función no disponible en tu plan",
  description = "Actualiza a un plan superior para acceder a este reporte.",
}: {
  feature: AnalyticsFeature; children: ReactNode; title?: string; description?: string;
}) {
  if (hasFeature(feature)) return <>{children}</>;
  return (
    <div className="rounded-xl border border-yo-border bg-yo-surface p-10 text-center">
      <div className="mx-auto size-10 rounded-full bg-yo-ac-bg grid place-items-center mb-3">
        <Shield className="size-4 text-yo-ac" />
      </div>
      <h3 className="text-[15px] font-semibold text-yo-txt">{title}</h3>
      <p className="text-[12.5px] text-yo-txt-2 mt-1 max-w-md mx-auto">{description}</p>
      <div className="mt-1 text-[10.5px] text-yo-txt-3">Plan actual: <span className="font-medium">{CURRENT_PLAN}</span></div>
      <button
        type="button"
        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-[12.5px] font-medium"
      >
        Ver planes disponibles
      </button>
    </div>
  );
}

// ============ Legal footer ============
export function AnalyticsLegalNote({ short = false }: { short?: boolean }) {
  if (short) {
    return (
      <p className="text-[11px] text-yo-txt-3 leading-relaxed">
        YOKTO no custodia fondos ni emite CFDI/REP. Los movimientos son procesados por pasarelas certificadas
        y los documentos fiscales provienen de comprobantes emitidos por los propios usuarios.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-yo-border bg-yo-raised p-3">
      <p className="text-[11.5px] text-yo-txt-2 leading-relaxed">
        <span className="font-semibold text-yo-txt">Nota:</span>{" "}
        YOKTO actúa como tercero tecnológico neutral para el seguimiento de cumplimiento. No custodia fondos
        ni emite comprobantes fiscales. Los recursos son procesados por la pasarela de pago integrada y la
        información fiscal proviene de CFDI y REP emitidos por los propios usuarios y cargados en la plataforma
        para validación documental.
      </p>
    </div>
  );
}

// ============ Section title ============
export function SectionTitle({ icon: Icon, title, action }: { icon?: ComponentType<LucideProps>; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-yo-txt-3" />}
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-yo-txt-2">{title}</h2>
      </div>
      {action}
    </div>
  );
}
