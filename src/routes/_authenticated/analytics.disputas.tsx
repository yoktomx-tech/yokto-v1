import { createFileRoute } from "@tanstack/react-router";
import {
  MetricCard, ChartCard, DotBadge, ExportCsvButton, AnalyticsLegalNote,
} from "@/components/analytics/analytics-shell";
import { disputesList, SECTOR_CFG, fmtMoneyFull } from "@/lib/analytics-mock";

export const Route = createFileRoute("/_authenticated/analytics/disputas")({
  head: () => ({ meta: [{ title: "Disputas — Analytics — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: DisputesReport,
});

const D_CFG = {
  ABIERTA: { label: "Abierta", tone: "err" as const },
  MEDIACION: { label: "En mediación", tone: "warn" as const },
  RESUELTA_COMPRADOR: { label: "A favor comprador", tone: "info" as const },
  RESUELTA_VENDEDOR: { label: "A favor vendedor", tone: "info" as const },
  RESUELTA_DIVIDIDA: { label: "Dividida", tone: "accent" as const },
  CANCELADA: { label: "Cancelada", tone: "neutral" as const },
};

function DisputesReport() {
  const rows = disputesList();
  const kpis = {
    abiertas: rows.filter(r => r.estado === "ABIERTA" || r.estado === "MEDIACION").length,
    resueltas: rows.filter(r => r.estado.startsWith("RESUELTA")).length,
    monto: rows.filter(r => r.estado === "ABIERTA" || r.estado === "MEDIACION").reduce((a, r) => a + r.monto, 0),
    tasaDisputa: "2.1%",
    tiempoProm: "42h",
    comprador: rows.filter(r => r.estado === "RESUELTA_COMPRADOR").length,
    vendedor: rows.filter(r => r.estado === "RESUELTA_VENDEDOR").length,
    dividida: rows.filter(r => r.estado === "RESUELTA_DIVIDIDA").length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Disputas abiertas" value={String(kpis.abiertas)} accent="err" />
        <MetricCard label="Resueltas" value={String(kpis.resueltas)} accent="ok" />
        <MetricCard label="Tasa de disputa" value={kpis.tasaDisputa} accent="warn" />
        <MetricCard label="Monto en disputa" value={fmtMoneyFull(kpis.monto)} accent="err" />
        <MetricCard label="Tiempo promedio resolución" value={kpis.tiempoProm} />
        <MetricCard label="A favor comprador" value={String(kpis.comprador)} accent="info" />
        <MetricCard label="A favor vendedor" value={String(kpis.vendedor)} accent="info" />
        <MetricCard label="Divididas" value={String(kpis.dividida)} accent="accent" />
      </div>

      <div className="rounded-lg border border-yo-warn bg-[#FFFBEB] p-3">
        <p className="text-[12px] text-[#92400E]">
          Recordatorio: <b>YOKTO no ordena movimientos financieros</b>. La resolución de disputas produce instrucciones que son ejecutadas por la pasarela certificada.
        </p>
      </div>

      <ChartCard
        title="Disputas"
        action={<ExportCsvButton rows={rows.map(r => ({
          folio: r.folio, operacion: r.operacion, sector: r.sector, iniciada_por: r.iniciadaPor,
          motivo: r.motivo, monto: r.monto, estado: D_CFG[r.estado].label, sla: r.sla, resultado: r.resultado ?? "",
        }))} filename="yokto-disputas.csv" />}
      >
        <div className="rounded-lg border border-yo-border overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-yo-raised text-yo-txt-2">
              <tr>{["Folio", "Operación", "Sector", "Iniciada por", "Motivo", "Monto", "Estado", "SLA", "Resultado"].map(h =>
                <th key={h} className="text-left px-3 py-2 font-semibold uppercase text-[11px]">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-yo-border hover:bg-yo-raised/40">
                  <td className="px-3 py-2 font-mono">{r.folio}</td>
                  <td className="px-3 py-2 font-mono">{r.operacion}</td>
                  <td className="px-3 py-2">{SECTOR_CFG[r.sector].emoji} {SECTOR_CFG[r.sector].label}</td>
                  <td className="px-3 py-2">{r.iniciadaPor === "buyer" ? "Comprador" : "Vendedor"}</td>
                  <td className="px-3 py-2">{r.motivo}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoneyFull(r.monto)}</td>
                  <td className="px-3 py-2"><DotBadge tone={D_CFG[r.estado].tone}>{D_CFG[r.estado].label}</DotBadge></td>
                  <td className="px-3 py-2 text-[11.5px] text-yo-txt-3">{r.sla}</td>
                  <td className="px-3 py-2 text-[11.5px]">{r.resultado ?? "—"}</td>
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
