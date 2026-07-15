import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  MetricCard, ChartCard, ExportCsvButton, DotBadge, AnalyticsLegalNote, SectionTitle, EmptyState,
} from "@/components/analytics/analytics-shell";
import {
  operationsList, SECTOR_CFG, OP_STATUS_CFG, FISCAL_CFG, CONTRACT_CFG, fmtMoneyFull,
  type OperationRow, type SectorKey, type UiOpStatus,
} from "@/lib/analytics-mock";

export const Route = createFileRoute("/_authenticated/analytics/operaciones")({
  head: () => ({ meta: [{ title: "Operaciones — Analytics — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: OperacionesReport,
});

function OperacionesReport() {
  const all = operationsList();
  const [sector, setSector] = useState<SectorKey | "">("");
  const [status, setStatus] = useState<UiOpStatus | "">("");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<OperationRow | null>(null);

  const rows = useMemo(() => all.filter((r) =>
    (!sector || r.sector === sector) &&
    (!status || r.status === status) &&
    (!query || r.numero.toLowerCase().includes(query.toLowerCase()) || r.contraparte.toLowerCase().includes(query.toLowerCase()))
  ), [all, sector, status, query]);

  const kpis = {
    created: all.length,
    active: all.filter(r => ["ACTIVE", "HELD", "COMPLIANCE", "VERIFY"].includes(r.status)).length,
    completed: all.filter(r => r.status === "COMPLETED").length,
    canceled: all.filter(r => r.status === "CANCELED").length,
    monto: all.reduce((a, r) => a + r.amount, 0),
    avgHitos: (all.reduce((a, r) => a + r.hitos.total, 0) / all.length).toFixed(1),
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Creadas" value={String(kpis.created)} />
        <MetricCard label="Activas" value={String(kpis.active)} accent="info" />
        <MetricCard label="Completadas" value={String(kpis.completed)} accent="ok" />
        <MetricCard label="Canceladas" value={String(kpis.canceled)} accent="warn" />
        <MetricCard label="Monto total" value={fmtMoneyFull(kpis.monto)} />
        <MetricCard label="Hitos promedio" value={kpis.avgHitos} />
      </div>

      <ChartCard
        title="Reporte de operaciones"
        description="Filtra por sector, estado y contraparte. Los datos respetan la organización activa."
        action={<ExportCsvButton rows={rows} filename="yokto-operaciones.csv" />}
      >
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por operación o contraparte"
            className="flex-1 min-w-[200px] h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-[12.5px] text-yo-txt placeholder:text-yo-txt-3 focus:outline-none focus:border-yo-ac"
          />
          <select value={sector} onChange={(e) => setSector(e.target.value as SectorKey | "")} className="h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-[12.5px] text-yo-txt">
            <option value="">Todos los sectores</option>
            {Object.entries(SECTOR_CFG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as UiOpStatus | "")} className="h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-[12.5px] text-yo-txt">
            <option value="">Todos los estados</option>
            {Object.entries(OP_STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No hay operaciones que coincidan" description="Ajusta los filtros para ver resultados." />
        ) : (
          <div className="rounded-lg border border-yo-border overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-yo-raised text-yo-txt-2">
                <tr>
                  <Th>Operación</Th><Th>Sector</Th><Th>Rol</Th><Th>Estado</Th>
                  <Th className="text-right">Monto</Th><Th>Hitos</Th>
                  <Th>Fiscal</Th><Th>Contrato</Th><Th>Última</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = SECTOR_CFG[r.sector];
                  const st = OP_STATUS_CFG[r.status];
                  return (
                    <tr key={r.id} className="border-t border-yo-border hover:bg-yo-raised/40">
                      <Td><span className="font-mono">{r.numero}</span></Td>
                      <Td>{s.emoji} {s.label}</Td>
                      <Td>{r.rol === "buyer" ? "Comprador" : "Vendedor"}</Td>
                      <Td><DotBadge tone={st.tone}>{st.label}</DotBadge></Td>
                      <Td className="text-right font-mono tabular-nums">{fmtMoneyFull(r.amount)}</Td>
                      <Td className="font-mono">{r.hitos.done}/{r.hitos.total}</Td>
                      <Td><DotBadge tone={FISCAL_CFG[r.fiscal].tone}>{FISCAL_CFG[r.fiscal].label}</DotBadge></Td>
                      <Td><DotBadge tone={CONTRACT_CFG[r.contrato].tone}>{CONTRACT_CFG[r.contrato].label}</DotBadge></Td>
                      <Td className="text-yo-txt-3">{r.ultima}</Td>
                      <Td>
                        <button onClick={() => setDetail(r)} className="text-yo-ac hover:underline text-[12px]">Ver</button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      <AnalyticsLegalNote />

      {detail && <OperationDrawer op={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={"text-left font-semibold text-[11px] uppercase tracking-[0.08em] px-3 py-2 " + (className ?? "")}>{children}</th>;
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={"px-3 py-2 text-yo-txt " + (className ?? "")}>{children}</td>;
}

function OperationDrawer({ op, onClose }: { op: OperationRow; onClose: () => void }) {
  const s = SECTOR_CFG[op.sector];
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-yo-surface border-l border-yo-border shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-yo-surface border-b border-yo-border px-5 py-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-[13px] text-yo-txt">{op.numero}</div>
            <div className="text-[11px] text-yo-txt-3 mt-0.5">{s.emoji} {s.label}</div>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-md hover:bg-yo-raised"><X className="size-4" /></button>
        </div>
        <div className="p-5 space-y-4 text-[13px]">
          <div className="grid grid-cols-2 gap-3">
            <Kv label="Estado" value={<DotBadge tone={OP_STATUS_CFG[op.status].tone}>{OP_STATUS_CFG[op.status].label}</DotBadge>} />
            <Kv label="Monto" value={<span className="font-mono">{fmtMoneyFull(op.amount)}</span>} />
            <Kv label="Rol" value={op.rol === "buyer" ? "Comprador" : "Vendedor"} />
            <Kv label="Contraparte" value={op.contraparte} />
          </div>
          <SectionTitle title="Resumen" />
          <ul className="text-[12.5px] text-yo-txt-2 space-y-1.5 list-disc pl-5">
            <li>Hitos: {op.hitos.done}/{op.hitos.total} completados</li>
            <li>Fiscal: {FISCAL_CFG[op.fiscal].label}</li>
            <li>Contrato: {CONTRACT_CFG[op.contrato].label}</li>
            {op.disputa && <li className="text-yo-err">Disputa activa</li>}
          </ul>
          <div className="flex gap-2 pt-2">
            <button className="flex-1 px-3 py-2 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-[12.5px] font-medium">Ver operación</button>
            <button className="px-3 py-2 rounded-md border border-yo-border hover:bg-yo-raised text-[12.5px]">Exportar expediente</button>
          </div>
        </div>
      </aside>
    </>
  );
}

function Kv({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.1em] text-yo-txt-3 mb-0.5">{label}</div>
      <div className="text-[13px] text-yo-txt">{value}</div>
    </div>
  );
}
