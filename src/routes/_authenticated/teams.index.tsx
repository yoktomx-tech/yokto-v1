import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Briefcase, Banknote, ClipboardCheck, TrendingUp, AlertTriangle, ReceiptText,
  Activity, ShieldAlert, ArrowUpRight, ArrowDownRight, ExternalLink,
} from "lucide-react";
import { TEAM, MOCK_MEMBERS, MOCK_APPROVAL_INSTANCES, PLAN_TONE, formatMoney } from "@/lib/teams-mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teams/")({
  component: TeamsPanel,
});

type Metric = {
  label: string; value: string; sub?: string; delta?: number;
  icon: typeof Briefcase; tone?: "default" | "warn";
};

const METRICS: Metric[] = [
  { label: "Operaciones activas", value: "34", sub: "vs. periodo anterior", delta: 12, icon: Briefcase },
  { label: "Fondos en retención",  value: formatMoney(4_820_000), sub: "Procesado por pasarela certificada", icon: Banknote },
  { label: "Aprobaciones pendientes", value: "7", sub: "3 con SLA por vencer hoy", icon: ClipboardCheck, tone: "warn" },
  { label: "Volumen operado (mes)", value: formatMoney(18_940_000), sub: "vs. mes anterior", delta: 8, icon: TrendingUp },
  { label: "Disputas abiertas",    value: "2", sub: formatMoney(180_000) + " en riesgo", icon: AlertTriangle, tone: "warn" },
  { label: "Cumplimiento fiscal",  value: "1", sub: "CFDI/REP pendiente", icon: ReceiptText, tone: "warn" },
];

function TeamsPanel() {
  const plan = PLAN_TONE[TEAM.plan];
  const pendingApprovals = MOCK_APPROVAL_INSTANCES.filter(a => a.estado === "PENDIENTE" || a.estado === "EN_PROGRESO");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
      {/* Main */}
      <div className="space-y-5 min-w-0">
        {/* Metrics grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {METRICS.map((m) => {
            const Icon = m.icon;
            const up = (m.delta ?? 0) >= 0;
            return (
              <div key={m.label} className="relative rounded-lg bg-yo-surface border border-yo-border p-3.5 shadow-sm overflow-hidden">
                <div className={cn("absolute top-0 inset-x-0 h-0.5", m.tone === "warn" ? "bg-amber-500" : "bg-yo-ac")} />
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold leading-tight">{m.label}</span>
                  <Icon className={cn("size-4 shrink-0", m.tone === "warn" ? "text-amber-500" : "text-yo-txt-3")} />
                </div>
                <div className="font-mono text-[22px] font-bold text-yo-txt leading-none tabular-nums">{m.value}</div>
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-yo-txt-3">
                  {m.delta !== undefined && (
                    <span className={cn("inline-flex items-center gap-0.5 font-semibold", up ? "text-emerald-600" : "text-red-600")}>
                      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                      {up ? "+" : ""}{m.delta}%
                    </span>
                  )}
                  {m.sub && <span className="truncate">{m.sub}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Salud operativa */}
        <section className="rounded-lg bg-yo-surface border border-yo-border p-5 shadow-sm">
          <header className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-yo-txt">Salud operativa</h2>
              <p className="text-[12px] text-yo-txt-3">Indicadores consolidados del equipo en el periodo actual.</p>
            </div>
            <Link to="/analytics" className="text-[12px] text-yo-ac hover:underline inline-flex items-center gap-1">
              Ver analytics <ExternalLink className="size-3" />
            </Link>
          </header>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { l: "Hitos a tiempo",         v: 92, tone: "ok" },
              { l: "Documentos aprobados",   v: 87, tone: "ok" },
              { l: "Aprobaciones SLA",       v: 96, tone: "ok" },
              { l: "Disputas",               v: 2.1, tone: "warn", suffix: "%" },
            ].map((k) => (
              <div key={k.l}>
                <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold">{k.l}</div>
                <div className="mt-1 font-mono text-[24px] font-bold text-yo-txt tabular-nums">
                  {k.v}<span className="text-[13px] text-yo-txt-3 font-medium">{k.suffix ?? "%"}</span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-yo-border overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", k.tone === "warn" ? "bg-amber-500" : "bg-emerald-500")}
                    style={{ width: `${Math.min(100, k.v)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Actividad reciente */}
        <section className="rounded-lg bg-yo-surface border border-yo-border shadow-sm">
          <header className="px-5 py-4 border-b border-yo-border flex items-center gap-2">
            <Activity className="size-4 text-yo-ac" />
            <h2 className="text-[15px] font-semibold text-yo-txt">Actividad reciente</h2>
          </header>
          <ul className="divide-y divide-yo-border">
            {[
              { who: "María García", what: "creó operación", target: "OP2607210001", when: "hace 12 min" },
              { who: "Ana Ruiz",     what: "aprobó hito por", target: formatMoney(240_000), when: "hace 1 h" },
              { who: "Sistema",      what: "validó REP parcialidad 2/4 en", target: "OP2607190002", when: "hace 2 h" },
              { who: "Juan P. Mora", what: "subió contrato firmado en", target: "OP2607180001", when: "hace 3 h" },
              { who: "Luis A.",      what: "editó workflow", target: "Liberaciones generales", when: "ayer" },
            ].map((e, i) => (
              <li key={i} className="px-5 py-3 flex items-center gap-3 text-[13px]">
                <div className="size-7 rounded-full bg-yo-ac-bg text-yo-ac-txt grid place-items-center text-[11px] font-semibold shrink-0">
                  {e.who.split(" ").map(w => w[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0 text-yo-txt-2">
                  <span className="font-medium text-yo-txt">{e.who}</span> {e.what}{" "}
                  <span className="font-mono text-yo-txt">{e.target}</span>
                </div>
                <span className="text-[11px] text-yo-txt-3 shrink-0">{e.when}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Side panel */}
      <aside className="space-y-5">
        {/* Plan */}
        <div className="rounded-lg bg-yo-surface border border-yo-border p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold">Plan actual</div>
              <div className="mt-0.5 text-[15px] font-semibold text-yo-txt">{plan.label}</div>
            </div>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", plan.bg, plan.text)}>
              Activo
            </span>
          </div>
          <dl className="space-y-2 text-[12px]">
            {[
              ["Miembros", `${MOCK_MEMBERS.filter(m => m.estado === "ACTIVO").length} / ${TEAM.max_miembros}`],
              ["Workflows", "3 activos"],
              ["API Keys", "3 · Enterprise gate"],
              ["Requiere MFA", TEAM.require_mfa ? "Sí" : "No"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-yo-border pb-1.5 last:border-0">
                <dt className="text-yo-txt-3">{k}</dt>
                <dd className="font-medium text-yo-txt">{v}</dd>
              </div>
            ))}
          </dl>
          <button className="mt-3 w-full h-9 rounded-md bg-yo-ac text-white text-[12.5px] font-semibold hover:bg-yo-ac-h">
            Actualizar plan
          </button>
        </div>

        {/* Alertas */}
        <div className="rounded-lg bg-yo-surface border border-yo-border shadow-sm">
          <header className="px-4 py-3 border-b border-yo-border flex items-center gap-2">
            <ShieldAlert className="size-4 text-amber-500" />
            <h3 className="text-[13px] font-semibold text-yo-txt">Alertas</h3>
          </header>
          <ul className="p-4 space-y-2.5 text-[12.5px] text-yo-txt-2">
            <li className="flex gap-2"><span className="text-amber-500">⚠</span> 3 aprobaciones vencen hoy</li>
            <li className="flex gap-2"><span className="text-red-500">⚠</span> 1 CFDI rechazado requiere corrección</li>
            <li className="flex gap-2"><span className="text-amber-500">⚠</span> 2 miembros no han activado MFA</li>
            <li className="flex gap-2"><span className="text-amber-500">⚠</span> 1 workflow con SLA vencido</li>
          </ul>
          <div className="px-4 pb-4">
            <Link to="/teams/approvals" className="text-[12px] text-yo-ac hover:underline">Revisar alertas →</Link>
          </div>
        </div>

        {/* Aprobaciones pendientes rápidas */}
        <div className="rounded-lg bg-yo-surface border border-yo-border shadow-sm">
          <header className="px-4 py-3 border-b border-yo-border">
            <h3 className="text-[13px] font-semibold text-yo-txt">Aprobaciones a tu cargo</h3>
          </header>
          <ul className="divide-y divide-yo-border">
            {pendingApprovals.slice(0, 3).map(a => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-yo-txt truncate">{a.action_label}</div>
                    <div className="text-[11px] text-yo-txt-3 font-mono truncate">{a.operacion_numero}</div>
                  </div>
                  <span className="font-mono text-[12px] font-semibold text-yo-txt shrink-0">{formatMoney(a.monto_mxn)}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="px-4 py-3 border-t border-yo-border">
            <Link to="/teams/approvals" className="text-[12px] text-yo-ac hover:underline">Ver todas →</Link>
          </div>
        </div>

        <p className="text-[11px] text-yo-txt-3 leading-relaxed px-1">
          Los fondos son procesados y retenidos por la pasarela certificada. Cumplex no custodia recursos.
        </p>
      </aside>
    </div>
  );
}
