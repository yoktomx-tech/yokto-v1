import { createFileRoute } from "@tanstack/react-router";
import {
  MetricCard, ChartCard, AnalyticsLegalNote, SectionTitle,
} from "@/components/analytics/analytics-shell";
import { scoreHistory, scoreBreakdown, scoreEvents } from "@/lib/analytics-mock";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/analytics/perfil-cumplimiento")({
  head: () => ({ meta: [{ title: "Perfil de cumplimiento — Analytics — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: ProfileReport,
});

function ProfileReport() {
  const history = scoreHistory();
  const breakdown = scoreBreakdown();
  const events = scoreEvents();
  const current = history[history.length - 1].score;
  const prev = history[history.length - 2].score;
  const delta = current - prev;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Score actual" value={String(current)} accent="indigo" />
        <MetricCard label="Delta periodo" value={`${delta >= 0 ? "+" : ""}${delta}`} accent={delta >= 0 ? "ok" : "err"} />
        <MetricCard label="Nivel" value={current >= 80 ? "Confiable" : current >= 60 ? "Verificado" : "En validación"} accent="info" />
        <MetricCard label="Eventos periodo" value={String(events.length)} />
      </div>

      <ChartCard title="Evolución del score de cumplimiento">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EBEBF0" vertical={false} />
            <XAxis dataKey="periodo" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={{ stroke: "#EBEBF0" }} />
            <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #EBEBF0", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="score" name="Score" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Desglose por dimensión">
          <div className="space-y-3">
            {breakdown.map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-yo-txt-2">{b.label}</span>
                  <span className="font-mono tabular-nums font-semibold">{b.value}</span>
                </div>
                <div className="h-1.5 bg-yo-raised rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${b.value}%`, background: b.value >= 90 ? "#059669" : b.value >= 75 ? "#4F46E5" : "#D97706" }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <div className="rounded-xl border border-yo-border bg-yo-surface p-5">
          <SectionTitle title="Eventos que impactan el score" />
          <ul className="space-y-2">
            {events.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-2 border-b border-yo-border pb-2 text-[12.5px]">
                <span className="text-yo-txt-2">{e.label}</span>
                <span className={`font-mono font-semibold ${e.delta >= 0 ? "text-yo-ok" : "text-yo-err"}`}>
                  {e.delta >= 0 ? "+" : ""}{e.delta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <AnalyticsLegalNote />
    </div>
  );
}
