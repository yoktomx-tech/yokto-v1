import { createFileRoute } from "@tanstack/react-router";
import {
  MetricCard, ChartCard, DotBadge, ExportCsvButton, AnalyticsLegalNote,
} from "@/components/analytics/analytics-shell";
import { contractsList, CONTRACT_CFG } from "@/lib/analytics-mock";

export const Route = createFileRoute("/_authenticated/analytics/contratos")({
  head: () => ({ meta: [{ title: "Contratos — Analytics — CUMPLEX" }, { name: "robots", content: "noindex" }] }),
  component: ContractsReport,
});

const METHOD_LABEL = { EFIRMA: "e.firma SAT", AUTOGRAFA: "Autógrafa+biometría", MIXTO: "Mixto", PENDIENTE: "Pendiente" };

function ContractsReport() {
  const rows = contractsList();
  const kpis = {
    total: rows.length,
    pdf: rows.filter(r => r.origen === "PDF").length,
    signed: rows.filter(r => r.estado === "SIGNED").length,
    pending: rows.filter(r => r.estado === "PENDING_BUYER" || r.estado === "PENDING_SELLER").length,
    efirma: rows.filter(r => r.metodo === "EFIRMA" || r.metodo === "MIXTO").length,
    autografa: rows.filter(r => r.metodo === "AUTOGRAFA" || r.metodo === "MIXTO").length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Contratos" value={String(kpis.total)} />
        <MetricCard label="Firmados" value={String(kpis.signed)} accent="ok" />
        <MetricCard label="Pendientes" value={String(kpis.pending)} accent="warn" />
        <MetricCard label="Subidos PDF" value={String(kpis.pdf)} />
        <MetricCard label="e.firma SAT" value={String(kpis.efirma)} accent="indigo" />
        <MetricCard label="Autógrafa" value={String(kpis.autografa)} accent="info" />
      </div>

      <ChartCard
        title="Contratos y firmas"
        description="Origen, método de firma y hash SHA-256 por operación."
        action={<ExportCsvButton rows={rows.map(r => ({
          operacion: r.operacion, tipo: r.tipo, origen: r.origen,
          estado: CONTRACT_CFG[r.estado].label, comprador: r.comprador, vendedor: r.vendedor,
          metodo: METHOD_LABEL[r.metodo], hash: r.hash, ultima_firma: r.ultimaFirma ?? "",
        }))} filename="yokto-contratos.csv" />}
      >
        <div className="rounded-lg border border-yo-border overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-yo-raised text-yo-txt-2">
              <tr>
                {["Operación", "Tipo", "Origen", "Estado", "Comprador", "Vendedor", "Método", "Hash", "Última firma"].map(h =>
                  <th key={h} className="text-left px-3 py-2 font-semibold uppercase text-[11px]">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-yo-border hover:bg-yo-raised/40">
                  <td className="px-3 py-2 font-mono">{r.operacion}</td>
                  <td className="px-3 py-2">{r.tipo}</td>
                  <td className="px-3 py-2">
                    <DotBadge tone={r.origen === "PDF" ? "info" : "accent"}>{r.origen === "GENERADO" ? "Generado" : r.origen === "PDF" ? "PDF" : "Reemplazado"}</DotBadge>
                  </td>
                  <td className="px-3 py-2"><DotBadge tone={CONTRACT_CFG[r.estado].tone}>{CONTRACT_CFG[r.estado].label}</DotBadge></td>
                  <td className="px-3 py-2 text-[12px]">{r.comprador === "Firmado" ? <span className="text-yo-ok">✓ {r.comprador}</span> : <span className="text-yo-warn">⏳ {r.comprador}</span>}</td>
                  <td className="px-3 py-2 text-[12px]">{r.vendedor === "Firmado" ? <span className="text-yo-ok">✓ {r.vendedor}</span> : <span className="text-yo-warn">⏳ {r.vendedor}</span>}</td>
                  <td className="px-3 py-2 text-[11.5px]">{METHOD_LABEL[r.metodo]}</td>
                  <td className="px-3 py-2 font-mono text-[10.5px] text-yo-txt-3">sha256: {r.hash}...</td>
                  <td className="px-3 py-2 text-[11.5px] text-yo-txt-3">{r.ultimaFirma ?? "—"}</td>
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
