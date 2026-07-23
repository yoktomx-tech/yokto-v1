import { createFileRoute, Link } from "@tanstack/react-router";
import { FileBarChart2, Download, Filter } from "lucide-react";
import { formatMoney } from "@/lib/teams-mock";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teams/reports")({
  component: TeamReportsPage,
});

const KPIS = [
  { l: "Volumen total del equipo", v: formatMoney(48_320_000) },
  { l: "Operaciones activas", v: "34" },
  { l: "Completadas (mes)", v: "72" },
  { l: "Fondos en retención", v: formatMoney(4_820_000) },
  { l: "Comisiones pagadas", v: formatMoney(432_180) },
  { l: "Disputas abiertas", v: "2" },
  { l: "CFDI/REP pendientes", v: "3", warn: true },
  { l: "Contratos por firmar", v: "5", warn: true },
];

const OPERACIONES = [
  { n: "OP2607190001", d: "Flete DF → Monterrey", sector: "Autotransporte", estado: "ACTIVA",     creado: "María G.",   monto: 320_000, retenido: 320_000, hitos: "3/4", ult: "hace 1h" },
  { n: "OP2607190002", d: "Consultoría fiscal",   sector: "Servicios",      estado: "EN_HITOS",   creado: "Juan M.",    monto: 180_000, retenido: 120_000, hitos: "2/3", ult: "hace 3h" },
  { n: "OP2607180001", d: "Materiales construc.", sector: "Construcción",   estado: "DISPUTA",    creado: "Juan M.",    monto: 940_000, retenido: 780_000, hitos: "5/7", ult: "ayer" },
  { n: "OP2607210001", d: "Contenedor import.",   sector: "Comercio ext.",  estado: "FONDEADA",   creado: "María G.",   monto: 2_100_000, retenido: 2_100_000, hitos: "0/6", ult: "hoy" },
  { n: "OP2607210002", d: "Suministro refacc.",   sector: "Autotransporte", estado: "LIBERADA",   creado: "Juan M.",    monto: 42_000,  retenido: 0,        hitos: "1/1", ult: "hoy" },
];

const ESTADO_TONE: Record<string, { bg: string; text: string }> = {
  ACTIVA:    { bg: "bg-emerald-50", text: "text-emerald-700" },
  EN_HITOS:  { bg: "bg-sky-50",     text: "text-sky-700" },
  DISPUTA:   { bg: "bg-red-50",     text: "text-red-700" },
  FONDEADA:  { bg: "bg-yo-ac-bg",   text: "text-yo-ac-txt" },
  LIBERADA:  { bg: "bg-yo-raised",  text: "text-yo-txt-2" },
};

function TeamReportsPage() {
  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KPIS.map(k => (
          <div key={k.l} className="rounded-lg bg-yo-surface border border-yo-border p-3 shadow-sm">
            <div className="text-[10.5px] uppercase tracking-wider text-yo-txt-3 font-semibold">{k.l}</div>
            <div className={cn("mt-1 font-mono text-[18px] font-bold tabular-nums", k.warn ? "text-amber-600" : "text-yo-txt")}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Filtros y exportaciones */}
      <div className="rounded-lg bg-yo-surface border border-yo-border p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="size-4 text-yo-txt-3" />
            {["Periodo: Este mes", "Miembro: Todos", "Sector: Todos", "Estado: Todos", "Rol: Comprador y Vendedor"].map(f => (
              <span key={f} className="inline-flex items-center px-2.5 py-1 rounded-full text-[11.5px] bg-yo-raised text-yo-txt-2">{f}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => toast.success("Exportando CSV…")} className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] rounded-md border border-yo-border hover:bg-yo-raised">
              <Download className="size-3.5" /> CSV operaciones
            </button>
            <button onClick={() => toast.success("Exportando XLSX…")} className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] rounded-md border border-yo-border hover:bg-yo-raised">
              <Download className="size-3.5" /> Excel multihoja
            </button>
            <button onClick={() => toast.success("Generando PDF ejecutivo…")} className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] rounded-md bg-yo-ac text-white hover:bg-yo-ac-h">
              <Download className="size-3.5" /> PDF ejecutivo
            </button>
          </div>
        </div>
      </div>

      {/* Tabla operaciones del equipo */}
      <section className="rounded-lg bg-yo-surface border border-yo-border shadow-sm overflow-hidden">
        <header className="px-5 py-3 border-b border-yo-border flex items-center gap-2">
          <FileBarChart2 className="size-4 text-yo-ac" />
          <h3 className="text-[14px] font-semibold text-yo-txt">Operaciones del equipo</h3>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[900px]">
            <thead className="bg-yo-raised text-yo-txt-3 uppercase text-[10.5px] tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Número</th>
                <th className="text-left px-3 py-2.5 font-semibold">Descripción</th>
                <th className="text-left px-3 py-2.5 font-semibold">Sector</th>
                <th className="text-left px-3 py-2.5 font-semibold">Estado</th>
                <th className="text-left px-3 py-2.5 font-semibold">Creado por</th>
                <th className="text-right px-3 py-2.5 font-semibold">Monto</th>
                <th className="text-right px-3 py-2.5 font-semibold">Retenido</th>
                <th className="text-center px-3 py-2.5 font-semibold">Hitos</th>
                <th className="text-left px-3 py-2.5 font-semibold">Últ. actividad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yo-border">
              {OPERACIONES.map(o => {
                const t = ESTADO_TONE[o.estado] || ESTADO_TONE.LIBERADA;
                return (
                  <tr key={o.n} className="hover:bg-yo-raised/60">
                    <td className="px-4 py-3 font-mono text-yo-txt">
                      <Link to="/transactions/$id/expediente" params={{ id: o.n }} className="hover:text-yo-ac">{o.n}</Link>
                    </td>
                    <td className="px-3 py-3 text-yo-txt-2">{o.d}</td>
                    <td className="px-3 py-3 text-yo-txt-2">{o.sector}</td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", t.bg, t.text)}>{o.estado}</span>
                    </td>
                    <td className="px-3 py-3 text-yo-txt-2">{o.creado}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-yo-txt">{formatMoney(o.monto)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-yo-txt-2">{formatMoney(o.retenido)}</td>
                    <td className="px-3 py-3 text-center font-mono text-[12px] text-yo-txt-2">{o.hitos}</td>
                    <td className="px-3 py-3 text-[11.5px] text-yo-txt-3">{o.ult}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-yo-txt-3">
        Los reportes consolidados reflejan operaciones registradas en CUMPLEX y documentos subidos por los usuarios.
      </p>
    </div>
  );
}
