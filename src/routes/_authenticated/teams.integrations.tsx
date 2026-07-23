import { createFileRoute } from "@tanstack/react-router";
import { Puzzle, Settings, Eye } from "lucide-react";
import { MOCK_INTEGRATIONS, WEBHOOK_EVENTS } from "@/lib/teams-mock";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teams/integrations")({
  component: IntegrationsPage,
});

const TONE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  CONFIGURADO:    { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Configurado" },
  NO_CONFIGURADO: { bg: "bg-yo-raised",  text: "text-yo-txt-2",    dot: "bg-zinc-400",    label: "No configurado" },
  ERROR:          { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500",     label: "Con error" },
};

function IntegrationsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[15px] font-semibold text-yo-txt">Integraciones empresariales</h2>
        <p className="text-[12.5px] text-yo-txt-3">Conecta CUMPLEX con tu ecosistema operativo. Todas las integraciones registran auditoría.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_INTEGRATIONS.map(i => {
          const t = TONE[i.estado];
          return (
            <article key={i.id} className="relative rounded-lg bg-yo-surface border border-yo-border p-4 shadow-sm">
              <div className={cn("absolute top-0 inset-x-0 h-0.5", i.estado === "ERROR" ? "bg-red-500" : i.estado === "CONFIGURADO" ? "bg-yo-ac" : "bg-yo-border-s")} />
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Puzzle className="size-4 text-yo-ac" />
                  <h3 className="text-[14px] font-semibold text-yo-txt">{i.nombre}</h3>
                </div>
                <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold", t.bg, t.text)}>
                  <span className={cn("size-1.5 rounded-full", t.dot)} /> {t.label}
                </span>
              </div>
              <p className="text-[12px] text-yo-txt-2 mb-3">{i.descripcion}</p>
              {i.detalle && <p className="text-[11px] text-yo-txt-3 mb-3">{i.detalle}{i.eventos_activos ? ` · ${i.eventos_activos} eventos activos` : ""}</p>}
              <div className="flex gap-2">
                <button onClick={() => toast.info("Panel de configuración (mock)")} className="flex-1 h-8 text-[12px] rounded-md border border-yo-border hover:bg-yo-raised inline-flex items-center justify-center gap-1">
                  <Settings className="size-3.5" /> Configurar
                </button>
                <button onClick={() => toast.info("Logs de la integración")} className="flex-1 h-8 text-[12px] rounded-md border border-yo-border hover:bg-yo-raised inline-flex items-center justify-center gap-1">
                  <Eye className="size-3.5" /> Logs
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <section className="rounded-lg bg-yo-surface border border-yo-border p-5 shadow-sm">
        <h3 className="text-[14px] font-semibold text-yo-txt mb-3">Eventos webhook disponibles</h3>
        <div className="flex flex-wrap gap-1.5">
          {WEBHOOK_EVENTS.map(e => (
            <span key={e} className="font-mono text-[11px] px-2 py-1 rounded-md bg-yo-raised text-yo-txt-2 border border-yo-border">{e}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
