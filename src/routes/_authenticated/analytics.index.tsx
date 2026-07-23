import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Briefcase, Banknote, ShieldCheck, TrendingUp, TrendingDown, PercentIcon, Clock, Activity,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  MetricCard, ChartCard, PeriodSelector, ExportCsvButton, AnalyticsLegalNote, SectionTitle, DotBadge,
} from "@/components/analytics/analytics-shell";
import {
  overviewKpis, operationsTrend, sectorBreakdown, SECTOR_CFG, complianceHealth, topInsights,
  fundsTrend, fmtMoney, type Period,
} from "@/lib/analytics-mock";

export const Route = createFileRoute("/_authenticated/analytics/")({
  head: () => ({ meta: [{ title: "Resumen — Analytics — Cumplex" }, { name: "robots", content: "noindex" }] }),
  component: AnalyticsOverview,
});

const KPI_ICON = { ops_total: Briefcase, volume: Banknote, held: Clock, released: TrendingUp, compliance: ShieldCheck, disputes: TrendingDown, active: Activity, close_time: PercentIcon } as const;

function AnalyticsOverview() {
  const [period, setPeriod] = useState<Period>("30d");
  const kpis = overviewKpis();
  const trend = operationsTrend();
  const funds = fundsTrend();
  const sectors = sectorBreakdown();
  const health = complianceHealth();
  const insights = topInsights();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PeriodSelector value={period} onChange={setPeriod} />
        <ExportCsvButton rows={kpis.map(k => ({ metrica: k.label, valor: k.value }))} filename="yokto-resumen-kpis.csv" label="Exportar KPIs" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <MetricCard
            key={k.key}
            label={k.label}
            value={k.value}
            delta={k.delta}
            positive={k.positive}
            icon={KPI_ICON[k.key as keyof typeof KPI_ICON]}
            accent={k.key === "disputes" ? "err" : k.key === "compliance" ? "ok" : k.key === "held" ? "warn" : "indigo"}
          />
        ))}
      </div>

      {/* Resumen ejecutivo + insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-yo-border bg-yo-surface p-5">
          <SectionTitle title="Resumen ejecutivo" />
          <p className="text-[13.5px] text-yo-txt leading-relaxed">
            En los últimos <b>30 días</b> tu organización operó <b className="font-mono">$8.4M MXN</b> en{" "}
            <b>128 operaciones</b>. El <b>92%</b> de los hitos fueron cumplidos sin disputa. Hay{" "}
            <b>14 operaciones activas</b>, <b>3</b> con evidencia pendiente y <b>2</b> con documentación
            fiscal por corregir.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="px-3 py-1.5 text-[12px] rounded-md bg-yo-ac hover:bg-yo-ac-h text-white font-medium">Ver operaciones pendientes</button>
            <button className="px-3 py-1.5 text-[12px] rounded-md border border-yo-border bg-yo-surface hover:bg-yo-raised text-yo-txt font-medium">Exportar resumen</button>
          </div>
        </div>
        <div className="rounded-xl border border-yo-border bg-yo-surface p-5">
          <SectionTitle title="Top insights" />
          <ul className="space-y-2">
            {insights.map((t) => (
              <li key={t} className="flex gap-2 text-[12.5px] text-yo-txt-2">
                <span className="mt-1.5 size-1 rounded-full bg-yo-ac shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Tendencia de operaciones" description="Total vs completadas vs disputas">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEBF0" vertical={false} />
              <XAxis dataKey="periodo" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={{ stroke: "#EBEBF0" }} />
              <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #EBEBF0", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="total" name="Total" stroke="#4F46E5" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="completadas" name="Completadas" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="disputas" name="Disputas" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribución por sector" description="Volumen operado por vertical">
          <div className="space-y-3">
            {sectors.map((s) => {
              const cfg = SECTOR_CFG[s.sector];
              return (
                <div key={s.sector}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="flex items-center gap-2 text-yo-txt">
                      <span>{cfg.emoji}</span>
                      <span className="font-medium">{cfg.label}</span>
                    </span>
                    <span className="font-mono tabular-nums text-yo-txt-2">
                      {s.pct}% · {fmtMoney(s.volume)}
                    </span>
                  </div>
                  <div className="h-2 bg-yo-raised rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, background: cfg.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Fondos en el tiempo" description="Retenidos vs liberados vs disputa vs reembolsos (procesados por la pasarela)">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={funds}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EBEBF0" vertical={false} />
            <XAxis dataKey="periodo" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={{ stroke: "#EBEBF0" }} />
            <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtMoney(Number(v))} />
            <Tooltip
              contentStyle={{ background: "#fff", border: "1px solid #EBEBF0", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => fmtMoney(Number(v))}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="retenido" name="Retenido" stroke="#4F46E5" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="liberado" name="Liberado" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="disputa" name="Disputa" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="reembolso" name="Reembolso" stroke="#D97706" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Compliance health */}
      <div className="rounded-xl border border-yo-border bg-yo-surface p-5">
        <SectionTitle title="Salud de cumplimiento" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {health.map((h) => (
            <div key={h.label}>
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span className="text-yo-txt-2">{h.label}</span>
                <span className="font-mono tabular-nums text-yo-txt font-semibold">{h.pct}%</span>
              </div>
              <div className="h-1.5 bg-yo-raised rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${h.pct}%`,
                    background: h.pct >= 90 ? "#059669" : h.pct >= 75 ? "#4F46E5" : "#D97706",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <DotBadge tone="ok">92% hitos</DotBadge>
          <DotBadge tone="warn">76% fiscal completo</DotBadge>
          <DotBadge tone="err">2 CFDI rechazados</DotBadge>
        </div>
      </div>

      <AnalyticsLegalNote />
    </div>
  );
}
