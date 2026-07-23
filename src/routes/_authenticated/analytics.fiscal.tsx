import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  MetricCard, ChartCard, DotBadge, ExportCsvButton, AnalyticsLegalNote, UpgradeGate, EmptyState,
} from "@/components/analytics/analytics-shell";
import { fiscalList, fmtMoneyFull, type FiscalRow } from "@/lib/analytics-mock";

export const Route = createFileRoute("/_authenticated/analytics/fiscal")({
  head: () => ({ meta: [{ title: "Fiscal — Analytics — CUMPLEX" }, { name: "robots", content: "noindex" }] }),
  component: FiscalReport,
});

const SAT_CFG = {
  VIGENTE: { label: "Vigente", tone: "ok" as const },
  CANCELADO: { label: "Cancelado", tone: "err" as const },
  VALIDANDO: { label: "Validando", tone: "info" as const },
};
const YO_CFG = {
  ACEPTADO: { label: "Aceptado", tone: "ok" as const },
  PENDIENTE: { label: "Pendiente", tone: "warn" as const },
  RECHAZADO: { label: "Rechazado", tone: "err" as const },
  VALIDANDO: { label: "Validando", tone: "info" as const },
};

function FiscalReport() {
  return (
    <UpgradeGate feature="ANALYTICS_FISCAL">
      <FiscalBody />
    </UpgradeGate>
  );
}

function FiscalBody() {
  const all = fiscalList();
  const [tipo, setTipo] = useState<"" | "CFDI" | "REP">("");
  const [estado, setEstado] = useState<FiscalRow["estado"] | "">("");
  const [detail, setDetail] = useState<FiscalRow | null>(null);
  const rows = useMemo(() => all.filter(r => (!tipo || r.tipo === tipo) && (!estado || r.estado === estado)), [all, tipo, estado]);

  const kpis = {
    cfdiTotal: all.filter(r => r.tipo === "CFDI").length,
    cfdiOk: all.filter(r => r.tipo === "CFDI" && r.estado === "ACEPTADO").length,
    cfdiRej: all.filter(r => r.tipo === "CFDI" && r.estado === "RECHAZADO").length,
    repTotal: all.filter(r => r.tipo === "REP").length,
    repOk: all.filter(r => r.tipo === "REP" && r.estado === "ACEPTADO").length,
    repPen: all.filter(r => r.tipo === "REP" && r.estado === "PENDIENTE").length,
    saldo: all.filter(r => r.tipo === "REP" && r.estado === "PENDIENTE").reduce((a, r) => a + r.total, 0),
  };

  const alertas = [
    "CFDI OP2607150001 con FormaPago distinta a 99.",
    "REP 2/3 en operación OP2607120001 pendiente de validación.",
    "Coherencia fiscal baja detectada (< 50%) en 1 documento.",
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-yo-warn bg-[#FFFBEB] p-3">
        <p className="text-[12px] text-[#92400E]">
          CUMPLEX no emite CFDI ni REP. El vendedor los timbra en su PAC y los sube a la plataforma; nosotros validamos coherencia contra la operación.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="CFDI recibidos" value={String(kpis.cfdiTotal)} />
        <MetricCard label="CFDI aceptados" value={String(kpis.cfdiOk)} accent="ok" />
        <MetricCard label="CFDI rechazados" value={String(kpis.cfdiRej)} accent="err" />
        <MetricCard label="REP recibidos" value={String(kpis.repTotal)} />
        <MetricCard label="REP aceptados" value={String(kpis.repOk)} accent="ok" />
        <MetricCard label="REP pendientes" value={String(kpis.repPen)} accent="warn" />
        <MetricCard label="Saldo fiscal pendiente" value={fmtMoneyFull(kpis.saldo)} accent="warn" />
        <MetricCard label="Operaciones con fiscal completo" value="4" accent="ok" />
      </div>

      <ChartCard title="Alertas fiscales">
        {alertas.length === 0 ? (
          <EmptyState title="Sin alertas fiscales" description="Todos los documentos vigentes son coherentes con las operaciones." />
        ) : (
          <ul className="space-y-2">
            {alertas.map((a) => (
              <li key={a} className="flex items-start gap-2 rounded-md border border-yo-border bg-yo-raised/60 p-2.5 text-[12.5px] text-yo-txt-2">
                <span className="mt-1 size-1.5 rounded-full bg-yo-warn shrink-0" />{a}
              </li>
            ))}
          </ul>
        )}
      </ChartCard>

      <ChartCard
        title="CFDI / REP recibidos"
        action={<ExportCsvButton rows={rows.map(r => ({
          tipo: r.tipo, uuid: r.uuid, operacion: r.operacion, emisor: r.emisor, receptor: r.receptor,
          total: r.total, metodo: r.metodo, forma: r.forma, sat: r.sat, coherencia: r.coherencia,
          estado: r.estado, parcialidad: r.parcialidad ?? "",
        }))} filename="yokto-fiscal.csv" label="Exportar fiscal" />}
      >
        <div className="flex gap-2 mb-3 flex-wrap">
          <select value={tipo} onChange={e => setTipo(e.target.value as "" | "CFDI" | "REP")} className="h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-[12.5px]">
            <option value="">Todos</option><option value="CFDI">CFDI</option><option value="REP">REP</option>
          </select>
          <select value={estado} onChange={e => setEstado(e.target.value as FiscalRow["estado"] | "")} className="h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-[12.5px]">
            <option value="">Todos los estados</option>
            {Object.entries(YO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="rounded-lg border border-yo-border overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-yo-raised text-yo-txt-2">
              <tr>
                {["Tipo", "UUID", "Operación", "Emisor", "Total", "Método", "SAT", "Coherencia", "Estado CUMPLEX", "Parc.", ""].map(h =>
                  <th key={h} className="text-left px-3 py-2 font-semibold uppercase text-[11px]">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-yo-border hover:bg-yo-raised/40">
                  <td className="px-3 py-2"><DotBadge tone={r.tipo === "CFDI" ? "accent" : "info"}>{r.tipo}</DotBadge></td>
                  <td className="px-3 py-2 font-mono text-[11px] text-yo-txt-3 max-w-[140px] truncate">{r.uuid}</td>
                  <td className="px-3 py-2 font-mono">{r.operacion}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{r.emisor}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtMoneyFull(r.total)}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{r.metodo}/{r.forma}</td>
                  <td className="px-3 py-2"><DotBadge tone={SAT_CFG[r.sat].tone}>{SAT_CFG[r.sat].label}</DotBadge></td>
                  <td className="px-3 py-2 font-mono">
                    <span className={r.coherencia >= 80 ? "text-yo-ok" : r.coherencia >= 60 ? "text-yo-warn" : "text-yo-err"}>{r.coherencia}%</span>
                  </td>
                  <td className="px-3 py-2"><DotBadge tone={YO_CFG[r.estado].tone}>{YO_CFG[r.estado].label}</DotBadge></td>
                  <td className="px-3 py-2 font-mono text-[11px]">{r.parcialidad ?? "—"}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => setDetail(r)} className="text-yo-ac text-[12px] hover:underline">Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <AnalyticsLegalNote />

      {detail && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDetail(null)} />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-yo-surface border-l border-yo-border shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-yo-surface border-b border-yo-border px-5 py-4 flex items-center justify-between">
              <div>
                <div className="text-[12px] text-yo-txt-3">Documento fiscal</div>
                <div className="font-mono text-[11.5px] text-yo-txt truncate max-w-[280px]">{detail.uuid}</div>
              </div>
              <button onClick={() => setDetail(null)} className="size-8 grid place-items-center rounded-md hover:bg-yo-raised"><X className="size-4" /></button>
            </div>
            <div className="p-5 space-y-3 text-[13px]">
              <Row k="Tipo" v={detail.tipo} />
              <Row k="Operación" v={<span className="font-mono">{detail.operacion}</span>} />
              <Row k="Emisor RFC" v={<span className="font-mono">{detail.emisor}</span>} />
              <Row k="Receptor RFC" v={<span className="font-mono">{detail.receptor}</span>} />
              <Row k="Total" v={<span className="font-mono">{fmtMoneyFull(detail.total)}</span>} />
              <Row k="Método / Forma" v={<span className="font-mono">{detail.metodo} / {detail.forma}</span>} />
              <Row k="Estado SAT" v={<DotBadge tone={SAT_CFG[detail.sat].tone}>{SAT_CFG[detail.sat].label}</DotBadge>} />
              <Row k="Coherencia" v={<span className="font-mono">{detail.coherencia}%</span>} />
              <Row k="Estado CUMPLEX" v={<DotBadge tone={YO_CFG[detail.estado].tone}>{YO_CFG[detail.estado].label}</DotBadge>} />
              {detail.parcialidad && <Row k="Parcialidad" v={<span className="font-mono">{detail.parcialidad}</span>} />}
              <div className="flex gap-2 pt-3">
                <button className="flex-1 px-3 py-2 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-[12.5px]">Descargar XML</button>
                <button className="px-3 py-2 rounded-md border border-yo-border hover:bg-yo-raised text-[12.5px]">Descargar PDF</button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-3 border-b border-yo-border pb-2">
      <span className="text-[11px] uppercase tracking-[0.1em] text-yo-txt-3">{k}</span>
      <span className="text-[13px] text-yo-txt">{v}</span>
    </div>
  );
}
