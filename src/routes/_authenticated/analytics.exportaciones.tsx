import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw, Trash2, Download } from "lucide-react";
import {
  ChartCard, DotBadge, AnalyticsLegalNote, SectionTitle,
} from "@/components/analytics/analytics-shell";
import { exportsList, CURRENT_PLAN } from "@/lib/analytics-mock";

export const Route = createFileRoute("/_authenticated/analytics/exportaciones")({
  head: () => ({ meta: [{ title: "Exportaciones — Analytics — Cumplex" }, { name: "robots", content: "noindex" }] }),
  component: ExportsReport,
});

const E_CFG = {
  GENERANDO: { label: "Generando", tone: "info" as const },
  DISPONIBLE: { label: "Disponible", tone: "ok" as const },
  FALLIDO: { label: "Fallido", tone: "err" as const },
  EXPIRADO: { label: "Expirado", tone: "neutral" as const },
  CANCELADO: { label: "Cancelado", tone: "neutral" as const },
};

const PLAN_FORMATS: Record<string, string[]> = {
  BASICO: ["CSV operaciones"],
  PROFESIONAL: ["CSV operaciones", "CSV fiscal", "XLSX completo", "PDF ejecutivo"],
  ENTERPRISE: ["CSV operaciones", "CSV fiscal", "XLSX completo", "PDF ejecutivo", "ZIP expediente", "JSON API"],
};

function ExportsReport() {
  const rows = exportsList();
  return (
    <div className="space-y-6">
      <ChartCard title="Formatos disponibles en tu plan">
        <div className="flex flex-wrap gap-2">
          {PLAN_FORMATS[CURRENT_PLAN].map((f) => (
            <span key={f} className="px-2.5 py-1 rounded-full bg-yo-ac-bg text-yo-ac-txt text-[11.5px] font-medium">
              {f}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-yo-txt-3 mt-3">
          Plan actual: <b>{CURRENT_PLAN}</b>. Los archivos generados expiran a los 7 días y se guardan en un bucket privado.
        </p>
      </ChartCard>

      <ChartCard title="Historial de exportaciones">
        <div className="rounded-lg border border-yo-border overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-yo-raised text-yo-txt-2">
              <tr>{["Fecha", "Usuario", "Formato", "Reporte", "Periodo", "Estado", "Tamaño", "Expira", "Acciones"].map(h =>
                <th key={h} className="text-left px-3 py-2 font-semibold uppercase text-[11px]">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-yo-border hover:bg-yo-raised/40">
                  <td className="px-3 py-2 font-mono text-[11.5px]">{r.fecha}</td>
                  <td className="px-3 py-2">{r.usuario}</td>
                  <td className="px-3 py-2"><DotBadge tone="accent">{r.formato}</DotBadge></td>
                  <td className="px-3 py-2">{r.reporte}</td>
                  <td className="px-3 py-2 text-yo-txt-2">{r.periodo}</td>
                  <td className="px-3 py-2"><DotBadge tone={E_CFG[r.estado].tone}>{E_CFG[r.estado].label}</DotBadge></td>
                  <td className="px-3 py-2 font-mono">{r.size}</td>
                  <td className="px-3 py-2 text-[11.5px] text-yo-txt-3">{r.expira}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <IconBtn icon={Download} title="Descargar" disabled={r.estado !== "DISPONIBLE"} />
                      <IconBtn icon={RefreshCw} title="Regenerar" />
                      <IconBtn icon={Trash2} title="Eliminar" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SectionTitle title="Auditoría" />
        <p className="text-[11.5px] text-yo-txt-3">
          Cada exportación genera un evento (<span className="font-mono">ANALYTICS_EXPORT_REQUESTED</span> →{" "}
          <span className="font-mono">ANALYTICS_EXPORT_COMPLETED / FAILED</span>) con usuario, IP y hash del archivo.
        </p>
      </ChartCard>

      <AnalyticsLegalNote />
    </div>
  );
}

function IconBtn({ icon: Icon, title, disabled }: { icon: typeof Download; title: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      className={"size-7 grid place-items-center rounded-md border border-yo-border " + (disabled ? "text-yo-txt-4 cursor-not-allowed" : "text-yo-txt-2 hover:bg-yo-raised")}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
