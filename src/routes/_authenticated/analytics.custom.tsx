import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Check } from "lucide-react";
import {
  ChartCard, UpgradeGate, AnalyticsLegalNote, SectionTitle,
} from "@/components/analytics/analytics-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/analytics/custom")({
  head: () => ({ meta: [{ title: "Reportes custom — CUMPLEX" }, { name: "robots", content: "noindex" }] }),
  component: CustomReport,
});

const SOURCES = ["Operaciones", "Pagos", "Fiscal", "Contratos", "Cumplimiento", "Disputas", "Aprobaciones", "Equipo"];
const FIELDS = ["Operación", "Monto", "Sector", "Estado", "Comprador", "Vendedor", "Contrato", "Fiscal", "Fecha", "SLA"];
const FILTERS = ["Periodo", "Estado", "Sector", "Contraparte", "Monto mínimo", "Monto máximo", "Riesgo", "Fiscal", "Contrato"];
const FORMATS = ["CSV", "XLSX", "PDF", "API JSON"];

function CustomReport() {
  return (
    <UpgradeGate feature="ANALYTICS_CUSTOM" title="Constructor de reportes disponible en Enterprise" description="Crea reportes a la medida con fuentes, campos y filtros combinables.">
      <Builder />
    </UpgradeGate>
  );
}

function Builder() {
  const [source, setSource] = useState<string>("Operaciones");
  const [fields, setFields] = useState<string[]>(["Operación", "Monto", "Estado"]);
  const [filters, setFilters] = useState<string[]>(["Periodo"]);
  const [format, setFormat] = useState<string>("CSV");
  const [name, setName] = useState("Mi reporte custom");

  const toggle = (v: string, arr: string[], set: (a: string[]) => void) => {
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  };

  return (
    <div className="space-y-6">
      <ChartCard title="Constructor de reportes" description="Cinco pasos: fuente, campos, filtros, formato y guardar plantilla.">
        <div className="space-y-6">
          <Step n={1} title="Fuente de datos">
            <div className="flex flex-wrap gap-2">
              {SOURCES.map(s => (
                <Chip key={s} active={source === s} onClick={() => setSource(s)}>{s}</Chip>
              ))}
            </div>
          </Step>

          <Step n={2} title="Campos a incluir">
            <div className="flex flex-wrap gap-2">
              {FIELDS.map(f => (
                <Chip key={f} active={fields.includes(f)} onClick={() => toggle(f, fields, setFields)}>{f}</Chip>
              ))}
            </div>
          </Step>

          <Step n={3} title="Filtros">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map(f => (
                <Chip key={f} active={filters.includes(f)} onClick={() => toggle(f, filters, setFilters)}>{f}</Chip>
              ))}
            </div>
          </Step>

          <Step n={4} title="Formato">
            <div className="flex flex-wrap gap-2">
              {FORMATS.map(f => (
                <Chip key={f} active={format === f} onClick={() => setFormat(f)}>{f}</Chip>
              ))}
            </div>
          </Step>

          <Step n={5} title="Guardar plantilla">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full max-w-md h-9 px-3 rounded-md border border-yo-border bg-yo-surface text-[13px] text-yo-txt focus:outline-none focus:border-yo-ac"
              placeholder="Nombre del reporte"
            />
            <label className="flex items-center gap-2 text-[12px] text-yo-txt-2 mt-3">
              <input type="checkbox" className="accent-yo-ac" />
              Compartir con el equipo
            </label>
            <label className="flex items-center gap-2 text-[12px] text-yo-txt-2 mt-1">
              <input type="checkbox" className="accent-yo-ac" />
              Programar envío mensual por correo
            </label>
          </Step>

          <div className="rounded-lg border border-yo-border bg-yo-raised p-3">
            <SectionTitle icon={Sparkles} title="Vista previa" />
            <div className="text-[12px] text-yo-txt-2 space-y-1">
              <div><b>Fuente:</b> {source}</div>
              <div><b>Campos:</b> {fields.join(", ") || "—"}</div>
              <div><b>Filtros:</b> {filters.join(", ") || "—"}</div>
              <div><b>Formato:</b> {format}</div>
              <div><b>Nombre:</b> {name}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-[13px] font-medium">Generar reporte</button>
            <button className="px-4 py-2 rounded-md border border-yo-border hover:bg-yo-raised text-yo-txt text-[13px]">Guardar plantilla</button>
          </div>
        </div>
      </ChartCard>

      <AnalyticsLegalNote />
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="size-5 rounded-full bg-yo-ac text-white text-[11px] font-bold grid place-items-center">{n}</span>
        <h3 className="text-[13px] font-semibold text-yo-txt">{title}</h3>
      </div>
      <div className="pl-7">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition border",
        active
          ? "bg-yo-ac-bg text-yo-ac-txt border-yo-ac"
          : "bg-yo-surface text-yo-txt-2 border-yo-border hover:bg-yo-raised",
      )}
    >
      {active && <Check className="size-3" />}
      {children}
    </button>
  );
}
