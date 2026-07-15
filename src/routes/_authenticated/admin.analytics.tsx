import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  MetricCard, ChartCard, AnalyticsLegalNote, SectionTitle,
} from "@/components/analytics/analytics-shell";
import { sectorBreakdown, SECTOR_CFG, fmtMoney, operationsTrend } from "@/lib/analytics-mock";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({ meta: [{ title: "Admin Analytics — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: AdminAnalytics,
});

const FUNNEL = [
  { step: "Registro", value: 2400 },
  { step: "KYC iniciado", value: 1900 },
  { step: "KYC aprobado", value: 1400 },
  { step: "Operación creada", value: 980 },
  { step: "Contrato firmado", value: 820 },
  { step: "Fondos retenidos", value: 760 },
  { step: "Primer hito liberado", value: 640 },
  { step: "Operación completada", value: 520 },
];

function AdminAnalytics() {
  const sectors = sectorBreakdown();
  const trend = operationsTrend();

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      <PageHeader
        icon={Shield}
        title="Admin Analytics"
        subtitle="Vista interna de plataforma. Solo Backoffice YOKTO."
      />

      <div className="rounded-lg border border-yo-err bg-[#FEF2F2] p-3">
        <p className="text-[12px] text-[#991B1B]">
          Panel restringido. Todo acceso registra <span className="font-mono">ADMIN_ANALYTICS_VIEWED</span>.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Usuarios activos" value="1,824" delta={9.4} positive accent="indigo" />
        <MetricCard label="Organizaciones" value="342" delta={4.1} positive />
        <MetricCard label="Operaciones creadas" value="4,120" delta={12.4} positive accent="info" />
        <MetricCard label="Volumen procesado" value={fmtMoney(48_200_000)} delta={18.3} positive accent="ok" />
        <MetricCard label="MRR estimado" value={fmtMoney(220_000)} accent="indigo" />
        <MetricCard label="Comisiones YOKTO" value={fmtMoney(870_000)} accent="ok" />
        <MetricCard label="Tasa activación" value="34%" delta={2.1} positive />
        <MetricCard label="Tasa de disputa global" value="1.9%" delta={-0.3} positive accent="warn" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Crecimiento de operaciones">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEBF0" vertical={false} />
              <XAxis dataKey="periodo" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={{ stroke: "#EBEBF0" }} />
              <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #EBEBF0", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="total" name="Total" stroke="#4F46E5" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Volumen por sector">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={sectors.map(s => ({ label: SECTOR_CFG[s.sector].label, volume: s.volume }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEBF0" vertical={false} />
              <XAxis dataKey="label" stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={{ stroke: "#EBEBF0" }} />
              <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtMoney(Number(v))} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #EBEBF0", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => fmtMoney(Number(v))} />
              <Bar dataKey="volume" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Embudo de activación">
        <div className="space-y-2">
          {FUNNEL.map((s, i) => {
            const pct = (s.value / FUNNEL[0].value) * 100;
            return (
              <div key={s.step} className="flex items-center gap-3">
                <span className="w-52 text-[12.5px] text-yo-txt">{i + 1}. {s.step}</span>
                <div className="flex-1 h-6 bg-yo-raised rounded overflow-hidden">
                  <div className="h-full bg-yo-ac flex items-center justify-end pr-2 text-white text-[11px] font-mono" style={{ width: `${pct}%` }}>
                    {s.value.toLocaleString()}
                  </div>
                </div>
                <span className="w-14 text-right font-mono text-[11.5px] text-yo-txt-2">{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
        <SectionTitle title="Nota interna" />
        <p className="text-[11.5px] text-yo-txt-3">
          El embudo mide la conversión desde el registro hasta la primera operación completada. Ideal para detectar dropoffs en KYC y firma contractual.
        </p>
      </ChartCard>

      <AnalyticsLegalNote />
    </div>
  );
}
