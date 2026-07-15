import { createFileRoute } from "@tanstack/react-router";
import {
  ChartCard, ExportCsvButton, AnalyticsLegalNote, SectionTitle,
} from "@/components/analytics/analytics-shell";
import { sectorBreakdown, SECTOR_CFG, fmtMoneyFull, fmtMoney, type SectorKey } from "@/lib/analytics-mock";

export const Route = createFileRoute("/_authenticated/analytics/sectores")({
  head: () => ({ meta: [{ title: "Sectores — Analytics — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: SectorsReport,
});

const SECTOR_KEY_DOCS: Record<SectorKey, string[]> = {
  AUTOTRANSPORTE: ["Carta Porte", "CFDI", "Evidencia GPS", "Fotos carga/descarga"],
  CONSTRUCCION: ["REPSE vigente", "Estimaciones", "Avance obra", "Bitácora"],
  COMERCIO_EXTERIOR: ["Pedimento", "BL", "Factura comercial", "Tracker embarque"],
  INMOBILIARIO: ["Escrituras", "Avalúo", "Libertad de gravamen", "Due diligence"],
  VEHICULOS: ["VIN", "REPUVE", "Checklist 96 puntos", "25 fotos"],
  SERVICIOS: ["Propuesta", "Entregables", "Aceptación final", "CFDI/REP"],
};

function SectorsReport() {
  const rows = sectorBreakdown();

  return (
    <div className="space-y-6">
      <ChartCard title="Desempeño por sector" action={<ExportCsvButton rows={rows.map(r => ({
        sector: SECTOR_CFG[r.sector].label, operaciones: r.ops, volumen: r.volume,
        cumplimiento: r.compliance, disputas: r.disputes, ticket: r.ticket, cierre_dias: r.cierre,
      }))} filename="yokto-sectores.csv" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => {
            const c = SECTOR_CFG[r.sector];
            return (
              <div key={r.sector} className="rounded-xl border border-yo-border bg-yo-surface p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{c.emoji}</span>
                  <div>
                    <div className="font-semibold text-[13.5px] text-yo-txt">{c.label}</div>
                    <div className="text-[11px] text-yo-txt-3 font-mono">{fmtMoney(r.volume)} · {r.ops} ops</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                  <Kv k="Ticket promedio" v={fmtMoneyFull(r.ticket)} />
                  <Kv k="Tiempo cierre" v={`${r.cierre} d`} />
                  <Kv k="Cumplimiento" v={`${r.compliance}%`} tone={r.compliance >= 90 ? "ok" : "warn"} />
                  <Kv k="Disputas" v={`${r.disputes}%`} tone={r.disputes <= 2 ? "ok" : "err"} />
                </div>
                <div className="mt-3 pt-3 border-t border-yo-border">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-yo-txt-3 mb-1.5">Documentos clave</div>
                  <div className="flex flex-wrap gap-1">
                    {SECTOR_KEY_DOCS[r.sector].map((d) => (
                      <span key={d} className="px-1.5 py-0.5 rounded bg-yo-raised text-[10.5px] text-yo-txt-2">{d}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>

      <div className="rounded-xl border border-yo-border bg-yo-surface p-5">
        <SectionTitle title="Comparativo rápido" />
        <div className="space-y-2">
          {rows.map((r) => {
            const c = SECTOR_CFG[r.sector];
            return (
              <div key={r.sector} className="flex items-center gap-3">
                <span className="w-40 text-[12.5px] text-yo-txt">{c.emoji} {c.label}</span>
                <div className="flex-1 h-2 bg-yo-raised rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: c.color }} />
                </div>
                <span className="w-24 text-right font-mono tabular-nums text-[12px] text-yo-txt-2">{r.pct}% · {fmtMoney(r.volume)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <AnalyticsLegalNote />
    </div>
  );
}

function Kv({ k, v, tone }: { k: string; v: string; tone?: "ok" | "warn" | "err" }) {
  const cls = tone === "ok" ? "text-yo-ok" : tone === "warn" ? "text-yo-warn" : tone === "err" ? "text-yo-err" : "text-yo-txt";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-yo-txt-3">{k}</div>
      <div className={`font-mono font-semibold ${cls}`}>{v}</div>
    </div>
  );
}
