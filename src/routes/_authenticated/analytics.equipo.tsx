import { createFileRoute } from "@tanstack/react-router";
import {
  MetricCard, ChartCard, ExportCsvButton, AnalyticsLegalNote,
} from "@/components/analytics/analytics-shell";
import { teamList, fmtMoneyFull } from "@/lib/analytics-mock";

export const Route = createFileRoute("/_authenticated/analytics/equipo")({
  head: () => ({ meta: [{ title: "Equipo — Analytics — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: TeamReport,
});

function TeamReport() {
  const rows = teamList();
  const totals = {
    miembros: rows.length,
    ops: rows.reduce((a, r) => a + r.operaciones, 0),
    monto: rows.reduce((a, r) => a + r.monto, 0),
    aprob: rows.reduce((a, r) => a + r.aprobaciones, 0),
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Miembros activos" value={String(totals.miembros)} />
        <MetricCard label="Operaciones gestionadas" value={String(totals.ops)} accent="indigo" />
        <MetricCard label="Monto gestionado" value={fmtMoneyFull(totals.monto)} accent="ok" />
        <MetricCard label="Aprobaciones realizadas" value={String(totals.aprob)} accent="info" />
      </div>

      <ChartCard
        title="Actividad por miembro del equipo"
        description="Restricciones por rol: Finanzas ve pagos/fiscal, Operador no ve comisiones."
        action={<ExportCsvButton rows={rows} filename="yokto-equipo.csv" />}
      >
        <div className="rounded-lg border border-yo-border overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-yo-raised text-yo-txt-2">
              <tr>{["Usuario", "Rol", "Ops", "Monto", "Aprob.", "Docs", "Fiscal", "Disputas", "Última"].map(h =>
                <th key={h} className="text-left px-3 py-2 font-semibold uppercase text-[11px]">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-yo-border hover:bg-yo-raised/40">
                  <td className="px-3 py-2 font-medium">{r.nombre}</td>
                  <td className="px-3 py-2 text-yo-txt-2">{r.rol}</td>
                  <td className="px-3 py-2 font-mono">{r.operaciones}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoneyFull(r.monto)}</td>
                  <td className="px-3 py-2 font-mono">{r.aprobaciones}</td>
                  <td className="px-3 py-2 font-mono">{r.documentos}</td>
                  <td className="px-3 py-2 font-mono">{r.fiscal}</td>
                  <td className="px-3 py-2 font-mono">{r.disputas}</td>
                  <td className="px-3 py-2 text-[11.5px] text-yo-txt-3">{r.ultima}</td>
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
