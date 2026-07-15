import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Workflow as WfIcon, Plus, Copy, Power, Pencil } from "lucide-react";
import { MOCK_WORKFLOWS, ROLE_LABEL, formatMoney, type Workflow } from "@/lib/teams-mock";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teams/workflows")({
  component: WorkflowsPage,
});

const ACTION_LABEL: Record<Workflow["action_type"], string> = {
  CREATE_OPERATION: "Crear operación",
  APPROVE_MILESTONE: "Aprobar hito",
  RELEASE_FUNDS: "Liberar fondos",
  REFUND_FUNDS: "Devolver fondos",
  RESOLVE_DISPUTE: "Resolver disputa",
};

function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>(MOCK_WORKFLOWS);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-yo-txt">Workflows de aprobación</h2>
          <p className="text-[12.5px] text-yo-txt-3">Reglas por monto, sector y acción. Solo los administradores pueden editarlos.</p>
        </div>
        <button
          onClick={() => toast.info("Constructor de workflow (mock)")}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-md bg-yo-ac text-white hover:bg-yo-ac-h"
        >
          <Plus className="size-3.5" /> Nuevo workflow
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {workflows.map(wf => (
          <article key={wf.id} className="relative rounded-lg bg-yo-surface border border-yo-border shadow-sm overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-0.5 bg-yo-ac" />
            <header className="px-5 pt-4 pb-3 border-b border-yo-border flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[14px] font-semibold text-yo-txt">{wf.nombre}</h3>
                  {wf.default && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yo-ac-bg text-yo-ac-txt uppercase tracking-wider">Default</span>}
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider",
                    wf.activo ? "bg-emerald-50 text-emerald-700" : "bg-yo-raised text-yo-txt-3"
                  )}>{wf.activo ? "Activo" : "Inactivo"}</span>
                </div>
                <p className="text-[12px] text-yo-txt-3 mt-1">{wf.descripcion}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-yo-raised text-yo-txt-2">
                    Acción: <span className="ml-1 font-semibold text-yo-txt">{ACTION_LABEL[wf.action_type]}</span>
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-yo-raised text-yo-txt-2">
                    Sectores: <span className="ml-1 font-semibold text-yo-txt">{wf.sectores.includes("*") ? "Todos" : wf.sectores.join(", ")}</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <IconBtn label="Editar" onClick={() => toast.info("Editar")}><Pencil className="size-3.5" /></IconBtn>
                <IconBtn label="Duplicar" onClick={() => toast.info("Duplicado")}><Copy className="size-3.5" /></IconBtn>
                <IconBtn
                  label="Activar/desactivar"
                  onClick={() => setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, activo: !w.activo } : w))}
                ><Power className="size-3.5" /></IconBtn>
              </div>
            </header>
            <ul className="divide-y divide-yo-border text-[12.5px]">
              {wf.reglas.map(r => (
                <li key={r.nivel} className="px-5 py-3 flex items-center gap-3">
                  <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-yo-txt-3">Nivel {r.nivel}</span>
                  <span className="flex-1 min-w-0 font-mono text-yo-txt">
                    {formatMoney(r.desde_mxn)} – {r.hasta_mxn === null ? "∞" : formatMoney(r.hasta_mxn)}
                  </span>
                  <span className="text-yo-txt-2 whitespace-nowrap">{ROLE_LABEL[r.rol]}</span>
                  <span className="text-yo-txt-3 whitespace-nowrap text-[11px]">SLA {r.sla_horas}h</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {/* Preview visual */}
      <section className="rounded-lg bg-yo-surface border border-yo-border p-5 shadow-sm">
        <h3 className="text-[14px] font-semibold text-yo-txt mb-3 flex items-center gap-2">
          <WfIcon className="size-4 text-yo-ac" />
          Vista previa de flujo por monto
        </h3>
        <div className="flex items-center gap-2 text-[12px] flex-wrap">
          {["Operador ($0–$50k)", "→", "Finanzas ($50k–$200k)", "→", "Admin (>$200k)"].map((s, i) => (
            <span key={i} className={cn(
              i % 2 === 0
                ? "px-3 py-1.5 rounded-md border border-yo-border bg-yo-raised text-yo-txt font-medium"
                : "text-yo-txt-3"
            )}>{s}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button aria-label={label} onClick={onClick} className="size-7 grid place-items-center rounded-md border border-yo-border hover:bg-yo-raised text-yo-txt-2">
      {children}
    </button>
  );
}
