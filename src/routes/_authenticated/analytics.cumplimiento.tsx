import { createFileRoute } from "@tanstack/react-router";
import {
  MetricCard, ChartCard, DotBadge, AnalyticsLegalNote, ExportCsvButton, SectionTitle,
} from "@/components/analytics/analytics-shell";
import {
  operationsList, complianceHealth, complianceAlerts, SECTOR_CFG,
  FISCAL_CFG, CONTRACT_CFG, OP_STATUS_CFG,
} from "@/lib/analytics-mock";

export const Route = createFileRoute("/_authenticated/analytics/cumplimiento")({
  head: () => ({ meta: [{ title: "Cumplimiento — Analytics — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: ComplianceReport,
});

type Risk = "BAJO" | "MEDIO" | "ALTO" | "CRITICO";
const RISK_TONE: Record<Risk, "ok" | "info" | "warn" | "err"> = {
  BAJO: "ok", MEDIO: "info", ALTO: "warn", CRITICO: "err",
};
function riskOf(o: ReturnType<typeof operationsList>[number]): Risk {
  if (o.disputa || o.fiscal === "REJECTED") return "CRITICO";
  if (o.status === "COMPLIANCE" && o.cumplimiento < 40) return "ALTO";
  if (o.fiscal === "CFDI_PENDING" || o.fiscal === "REP_PENDING" || o.contrato !== "SIGNED") return "MEDIO";
  return "BAJO";
}

function ComplianceReport() {
  const ops = operationsList();
  const health = complianceHealth();
  const alerts = complianceAlerts();
  const scoreAvg = Math.round(ops.reduce((a, o) => a + o.cumplimiento, 0) / ops.length);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Score promedio" value={`${scoreAvg}`} accent="indigo" />
        <MetricCard label="Hitos vencidos" value="4" accent="err" />
        <MetricCard label="CFDIs aceptados" value="18" accent="ok" />
        <MetricCard label="REPs pendientes" value="3" accent="warn" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Salud de cumplimiento">
          <div className="space-y-3">
            {health.map((h) => (
              <div key={h.label}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="text-yo-txt-2">{h.label}</span>
                  <span className="font-mono tabular-nums text-yo-txt font-semibold">{h.pct}%</span>
                </div>
                <div className="h-1.5 bg-yo-raised rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${h.pct}%`, background: h.pct >= 90 ? "#059669" : h.pct >= 75 ? "#4F46E5" : "#D97706" }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Alertas activas">
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a} className="flex items-start gap-2 rounded-md border border-yo-border bg-yo-raised/60 p-2.5 text-[12.5px] text-yo-txt-2">
                <span className="mt-1 size-1.5 rounded-full bg-yo-warn shrink-0" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <ChartCard
        title="Cumplimiento por operación"
        description="Con score de riesgo derivado de hitos, documentos, fiscal y contrato."
        action={<ExportCsvButton rows={ops.map(o => ({
          operacion: o.numero, sector: o.sector, rol: o.rol, estado: OP_STATUS_CFG[o.status].label,
          cumplimiento: o.cumplimiento, fiscal: FISCAL_CFG[o.fiscal].label, contrato: CONTRACT_CFG[o.contrato].label,
          riesgo: riskOf(o),
        }))} filename="yokto-cumplimiento.csv" />}
      >
        <div className="rounded-lg border border-yo-border overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-yo-raised text-yo-txt-2">
              <tr>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[11px]">Operación</th>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[11px]">Sector</th>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[11px]">Cumplimiento</th>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[11px]">Fiscal</th>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[11px]">Contrato</th>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[11px]">Riesgo</th>
              </tr>
            </thead>
            <tbody>
              {ops.map((o) => {
                const r = riskOf(o);
                const s = SECTOR_CFG[o.sector];
                return (
                  <tr key={o.id} className="border-t border-yo-border hover:bg-yo-raised/40">
                    <td className="px-3 py-2 font-mono">{o.numero}</td>
                    <td className="px-3 py-2">{s.emoji} {s.label}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono w-8">{o.cumplimiento}%</span>
                        <div className="flex-1 h-1 bg-yo-raised rounded-full overflow-hidden max-w-[100px]">
                          <div className="h-full bg-yo-ac" style={{ width: `${o.cumplimiento}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2"><DotBadge tone={FISCAL_CFG[o.fiscal].tone}>{FISCAL_CFG[o.fiscal].label}</DotBadge></td>
                    <td className="px-3 py-2"><DotBadge tone={CONTRACT_CFG[o.contrato].tone}>{CONTRACT_CFG[o.contrato].label}</DotBadge></td>
                    <td className="px-3 py-2"><DotBadge tone={RISK_TONE[r]}>{r}</DotBadge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <SectionTitle title="Modelo de riesgo" />
        <p className="text-[11.5px] text-yo-txt-3 leading-relaxed">
          Bajo: contrato firmado + fiscal completo + evidencia + sin hitos vencidos. Medio: 1 documento pendiente.
          Alto: hito vencido, CFDI rechazado o contrato incompleto. Crítico: disputa activa o inconsistencia grave.
        </p>
      </ChartCard>

      <AnalyticsLegalNote />
    </div>
  );
}
