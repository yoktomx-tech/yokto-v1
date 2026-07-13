import { formatMoney } from "@/lib/tx";

const SECTOR_META: Record<string, { emoji: string; color: string; label: string }> = {
  "Servicios profesionales": { emoji: "💼", color: "#DDA0DD", label: "Servicios" },
  "Construcción":            { emoji: "🏗️", color: "#FF6B35", label: "Construcción" },
  "Inmobiliario":            { emoji: "🏢", color: "#45B7D1", label: "Inmobiliario" },
  "Manufactura":             { emoji: "🏭", color: "#96CEB4", label: "Manufactura" },
  "Tecnología / SaaS":       { emoji: "💻", color: "#4ECDC4", label: "Tecnología" },
  "Comercio internacional":  { emoji: "🌐", color: "#4F46E5", label: "Comercio Ext." },
  "Marketing / Agencias":    { emoji: "📣", color: "#F43F5E", label: "Marketing" },
  "Otro":                    { emoji: "📦", color: "#A1A1AA", label: "Otro" },
};

export type SectorRow = { sector: string; count: number; total_cents: number };

export function SectorChart({ data }: { data: SectorRow[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-yo-txt-3">Sin actividad por sector.</p>
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-3">
      {data.map((row) => {
        const meta = SECTOR_META[row.sector] ?? { emoji: "📦", color: "#A1A1AA", label: row.sector };
        const pct = (row.count / max) * 100;
        return (
          <div key={row.sector} className="flex items-center gap-3">
            <div className="w-32 flex items-center gap-2 shrink-0">
              <span className="text-sm">{meta.emoji}</span>
              <span className="text-xs font-medium text-yo-txt-2 truncate">{meta.label}</span>
            </div>
            <div className="flex-1 h-6 rounded-md bg-yo-raised overflow-hidden">
              <div
                className="h-full rounded-md transition-all"
                style={{ width: `${pct}%`, backgroundColor: meta.color }}
              />
            </div>
            <div className="w-10 text-right text-sm font-bold tabular-nums text-yo-txt">{row.count}</div>
            <div className="w-24 text-right text-xs tabular-nums text-yo-txt-3">{formatMoney(row.total_cents)}</div>
          </div>
        );
      })}
    </div>
  );
}
