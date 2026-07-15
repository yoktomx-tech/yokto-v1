import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  MetricCard, ChartCard, DotBadge, ExportCsvButton, AnalyticsLegalNote,
} from "@/components/analytics/analytics-shell";
import {
  paymentsList, paymentsTipoLabel, paymentsEstadoCfg, fundsTrend, fmtMoneyFull, fmtMoney,
  type PaymentRow,
} from "@/lib/analytics-mock";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/analytics/pagos")({
  head: () => ({ meta: [{ title: "Pagos — Analytics — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: PagosReport,
});

function PagosReport() {
  const all = paymentsList();
  const [tipo, setTipo] = useState<PaymentRow["tipo"] | "">("");
  const [estado, setEstado] = useState<PaymentRow["estado"] | "">("");
  const rows = useMemo(() => all.filter(r => (!tipo || r.tipo === tipo) && (!estado || r.estado === estado)), [all, tipo, estado]);
  const funds = fundsTrend();

  const totals = {
    volume: all.filter(r => r.tipo === "DEPOSIT").reduce((a, r) => a + r.amount, 0),
    held: all.filter(r => r.tipo === "HOLD").reduce((a, r) => a + r.amount, 0),
    released: all.filter(r => r.tipo === "RELEASE" || r.tipo === "PARTIAL").reduce((a, r) => a + r.amount, 0),
    refunded: all.filter(r => r.tipo === "REFUND").reduce((a, r) => a + r.amount, 0),
    commission: all.filter(r => r.tipo === "COMMISSION").reduce((a, r) => a + r.amount, 0),
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-yo-info bg-[#F0F9FF] p-3">
        <p className="text-[12px] text-[#0C4A6E]">
          Los importes mostrados corresponden a operaciones procesadas y retenidas a través de la pasarela de pago integrada. <b>YOKTO no custodia fondos</b>.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MetricCard label="Volumen procesado" value={fmtMoney(totals.volume)} accent="indigo" />
        <MetricCard label="Retenidos" value={fmtMoney(totals.held)} accent="warn" />
        <MetricCard label="Liberados" value={fmtMoney(totals.released)} accent="ok" />
        <MetricCard label="Reembolsos" value={fmtMoney(totals.refunded)} accent="err" />
        <MetricCard label="Comisiones YOKTO" value={fmtMoney(totals.commission)} accent="info" />
      </div>

      <ChartCard title="Volumen por periodo">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={funds}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EBEBF0" vertical={false} />
            <XAxis dataKey="periodo" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={{ stroke: "#EBEBF0" }} />
            <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtMoney(Number(v))} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #EBEBF0", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => fmtMoney(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="retenido" name="Retenido" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            <Bar dataKey="liberado" name="Liberado" fill="#059669" radius={[4, 4, 0, 0]} />
            <Bar dataKey="disputa" name="Disputa" fill="#DC2626" radius={[4, 4, 0, 0]} />
            <Bar dataKey="reembolso" name="Reembolso" fill="#D97706" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Movimientos financieros"
        description="Depósitos, retenciones, liberaciones, reembolsos y comisiones."
        action={<ExportCsvButton rows={rows.map(r => ({
          fecha: r.fecha, operacion: r.operacion, tipo: paymentsTipoLabel(r.tipo), monto: r.amount,
          metodo: r.metodo, estado: paymentsEstadoCfg(r.estado).label, ref: r.ref, hito: r.hito ?? "",
        }))} filename="yokto-pagos.csv" />}
      >
        <div className="flex gap-2 mb-3 flex-wrap">
          <select value={tipo} onChange={e => setTipo(e.target.value as PaymentRow["tipo"] | "")} className="h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-[12.5px]">
            <option value="">Todos los tipos</option>
            {["DEPOSIT", "HOLD", "RELEASE", "PARTIAL", "REFUND", "COMMISSION", "VAT", "ADJUSTMENT"].map(t =>
              <option key={t} value={t}>{paymentsTipoLabel(t as PaymentRow["tipo"])}</option>
            )}
          </select>
          <select value={estado} onChange={e => setEstado(e.target.value as PaymentRow["estado"] | "")} className="h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-[12.5px]">
            <option value="">Todos los estados</option>
            {["PROCESSING", "COMPLETED", "FAILED", "REVERSED", "PENDING_RECON"].map(e =>
              <option key={e} value={e}>{paymentsEstadoCfg(e as PaymentRow["estado"]).label}</option>
            )}
          </select>
        </div>

        <div className="rounded-lg border border-yo-border overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-yo-raised text-yo-txt-2">
              <tr>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[11px]">Fecha</th>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[11px]">Operación</th>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[11px]">Tipo</th>
                <th className="text-right px-3 py-2 font-semibold uppercase text-[11px]">Monto</th>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[11px]">Método</th>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[11px]">Estado</th>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[11px]">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-yo-border hover:bg-yo-raised/40">
                  <td className="px-3 py-2 font-mono">{r.fecha}</td>
                  <td className="px-3 py-2 font-mono">{r.operacion}</td>
                  <td className="px-3 py-2">{paymentsTipoLabel(r.tipo)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtMoneyFull(r.amount)}</td>
                  <td className="px-3 py-2">{r.metodo}</td>
                  <td className="px-3 py-2"><DotBadge tone={paymentsEstadoCfg(r.estado).tone}>{paymentsEstadoCfg(r.estado).label}</DotBadge></td>
                  <td className="px-3 py-2 font-mono text-[11px] text-yo-txt-3">{r.ref}</td>
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
