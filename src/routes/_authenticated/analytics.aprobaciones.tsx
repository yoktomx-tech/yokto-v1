import { createFileRoute } from "@tanstack/react-router";
import {
  MetricCard, ChartCard, DotBadge, ExportCsvButton, AnalyticsLegalNote,
} from "@/components/analytics/analytics-shell";
import { approvalsList, fmtMoneyFull } from "@/lib/analytics-mock";

export const Route = createFileRoute("/_authenticated/analytics/aprobaciones")({
  head: () => ({ meta: [{ title: "Aprobaciones — Analytics — Cumplex" }, { name: "robots", content: "noindex" }] }),
  component: ApprovalsReport,
});

const A_CFG = {
  PENDIENTE: { label: "Pendiente", tone: "warn" as const },
  APROBADO: { label: "Aprobado", tone: "ok" as const },
  CORRECCION: { label: "Corrección", tone: "info" as const },
  RECHAZADO: { label: "Rechazado", tone: "err" as const },
  DISPUTA: { label: "Disputa", tone: "err" as const },
};

function ApprovalsReport() {
  const rows = approvalsList();
  const kpis = {
    total: rows.length,
    aprobados: rows.filter(r => r.estado === "APROBADO").length,
    correccion: rows.filter(r => r.estado === "CORRECCION").length,
    rechazados: rows.filter(r => r.estado === "RECHAZADO").length,
    monto: rows.filter(r => r.estado === "APROBADO").reduce((a, r) => a + r.monto, 0),
    pendiente: rows.filter(r => r.estado === "PENDIENTE").reduce((a, r) => a + r.monto, 0),
    tiempo: "2h 45m",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Hitos revisados" value={String(kpis.total)} />
        <MetricCard label="Aprobados" value={String(kpis.aprobados)} accent="ok" />
        <MetricCard label="Correcciones" value={String(kpis.correccion)} accent="info" />
        <MetricCard label="Rechazados" value={String(kpis.rechazados)} accent="err" />
        <MetricCard label="Monto aprobado" value={fmtMoneyFull(kpis.monto)} accent="indigo" />
        <MetricCard label="Monto pendiente" value={fmtMoneyFull(kpis.pendiente)} accent="warn" />
        <MetricCard label="Tiempo promedio aprobación" value={kpis.tiempo} />
        <MetricCard label="Liberaciones autorizadas" value={String(kpis.aprobados)} accent="ok" />
      </div>

      <ChartCard
        title="Historial de aprobaciones"
        action={<ExportCsvButton rows={rows.map(r => ({
          fecha: r.fecha, operacion: r.operacion, hito: r.hito, vendedor: r.vendedor,
          monto: r.monto, estado: A_CFG[r.estado].label, decision: r.decision ?? "",
          tiempo: r.tiempo ?? "", impacto_pago: r.impacto,
        }))} filename="yokto-aprobaciones.csv" />}
      >
        <div className="rounded-lg border border-yo-border overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-yo-raised text-yo-txt-2">
              <tr>{["Fecha", "Operación", "Hito", "Vendedor", "Monto hito", "Decisión", "Tiempo", "Impacto", "Estado"].map(h =>
                <th key={h} className="text-left px-3 py-2 font-semibold uppercase text-[11px]">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-yo-border hover:bg-yo-raised/40">
                  <td className="px-3 py-2 font-mono">{r.fecha}</td>
                  <td className="px-3 py-2 font-mono">{r.operacion}</td>
                  <td className="px-3 py-2">{r.hito}</td>
                  <td className="px-3 py-2">{r.vendedor}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoneyFull(r.monto)}</td>
                  <td className="px-3 py-2 text-[12px] text-yo-txt-2">{r.decision ?? "—"}</td>
                  <td className="px-3 py-2 text-[11.5px] text-yo-txt-3">{r.tiempo ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-[11.5px]">{fmtMoneyFull(r.impacto)}</td>
                  <td className="px-3 py-2"><DotBadge tone={A_CFG[r.estado].tone}>{A_CFG[r.estado].label}</DotBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <AnalyticsLegalNote />
    </div>
  );
}
