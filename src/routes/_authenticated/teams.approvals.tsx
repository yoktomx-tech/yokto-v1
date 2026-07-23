import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClipboardCheck, Clock, CheckCircle2, XCircle, X, AlertTriangle } from "lucide-react";
import {
  MOCK_APPROVAL_INSTANCES, APPROVAL_STATUS_TONE, ROLE_LABEL, formatMoney, formatDateTime,
  type ApprovalInstance, type ApprovalInstanceStatus,
} from "@/lib/teams-mock";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teams/approvals")({
  component: TeamApprovalsPage,
});

const TABS: { key: "PENDIENTES" | "COMPLETADAS" | "TODAS"; label: string }[] = [
  { key: "PENDIENTES", label: "Pendientes" },
  { key: "COMPLETADAS", label: "Completadas" },
  { key: "TODAS", label: "Todas" },
];

function TeamApprovalsPage() {
  const [instances, setInstances] = useState<ApprovalInstance[]>(MOCK_APPROVAL_INSTANCES);
  const [tab, setTab] = useState<"PENDIENTES" | "COMPLETADAS" | "TODAS">("PENDIENTES");
  const [selected, setSelected] = useState<ApprovalInstance | null>(null);
  const [comment, setComment] = useState("");

  const filtered = useMemo(() => instances.filter(a => {
    if (tab === "PENDIENTES") return a.estado === "PENDIENTE" || a.estado === "EN_PROGRESO";
    if (tab === "COMPLETADAS") return a.estado === "APROBADO" || a.estado === "RECHAZADO" || a.estado === "EXPIRADO" || a.estado === "CANCELADO";
    return true;
  }), [instances, tab]);

  const decide = (id: string, ok: boolean) => {
    const next: ApprovalInstanceStatus = ok ? "APROBADO" : "RECHAZADO";
    setInstances(prev => prev.map(a => a.id === id ? { ...a, estado: next, sla_horas_restantes: 0 } : a));
    setSelected(null); setComment("");
    toast.success(ok ? "Aprobación registrada" : "Solicitud rechazada");
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-yo-border">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              "px-3 h-9 text-[13px] font-medium border-b-2 -mb-px",
              tab === t.key ? "border-yo-ac text-yo-ac" : "border-transparent text-yo-txt-2 hover:text-yo-txt"
            )}
          >{t.label}</button>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-lg bg-yo-surface border border-yo-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[900px]">
            <thead className="bg-yo-raised text-yo-txt-3 uppercase text-[10.5px] tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Solicitud</th>
                <th className="text-left px-3 py-2.5 font-semibold">Operación</th>
                <th className="text-left px-3 py-2.5 font-semibold">Solicitante</th>
                <th className="text-right px-3 py-2.5 font-semibold">Monto</th>
                <th className="text-center px-3 py-2.5 font-semibold">Nivel</th>
                <th className="text-left px-3 py-2.5 font-semibold">Aprobador</th>
                <th className="text-left px-3 py-2.5 font-semibold">SLA</th>
                <th className="text-left px-3 py-2.5 font-semibold">Estado</th>
                <th className="text-right px-3 py-2.5 font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yo-border">
              {filtered.map(a => {
                const s = APPROVAL_STATUS_TONE[a.estado];
                const slaTone = a.sla_horas_restantes < 0 ? "text-red-600" : a.sla_horas_restantes < 8 ? "text-amber-600" : "text-yo-txt-2";
                return (
                  <tr key={a.id} className="hover:bg-yo-raised/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-yo-txt">{a.action_label}</div>
                      <div className="text-[11px] text-yo-txt-3">{formatDateTime(a.created_at)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono text-[12.5px] text-yo-txt">{a.operacion_numero}</div>
                      <div className="text-[11px] text-yo-txt-3 truncate max-w-[220px]">{a.operacion_descripcion}</div>
                    </td>
                    <td className="px-3 py-3 text-yo-txt-2">{a.solicitante}</td>
                    <td className="px-3 py-3 text-right font-mono text-yo-txt tabular-nums font-semibold">{formatMoney(a.monto_mxn)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-yo-raised text-[11px] font-mono">
                        {a.nivel_actual}/{a.total_niveles}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-yo-txt-2">{ROLE_LABEL[a.aprobador_rol]}</td>
                    <td className={cn("px-3 py-3 font-medium", slaTone)}>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {a.sla_horas_restantes < 0 ? `Vencido ${-a.sla_horas_restantes}h` : `${a.sla_horas_restantes}h`}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", s.bg, s.text)}>
                        <span className={cn("size-1.5 rounded-full", s.dot)} /> {s.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => setSelected(a)}
                        className="h-7 px-2.5 text-[11.5px] font-medium rounded-md border border-yo-border hover:bg-yo-raised">
                        Revisar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-10 text-center">
            <ClipboardCheck className="size-8 text-yo-txt-3 mx-auto mb-2" />
            <p className="text-[13px] text-yo-txt-2">No hay solicitudes en esta pestaña.</p>
          </div>
        )}
      </div>

      <p className="text-[11px] text-yo-txt-3">
        Esta aprobación es interna de tu organización. No libera fondos hasta que se ejecute la aprobación externa de la operación.
      </p>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setSelected(null)}>
          <div className="ml-auto h-full w-full max-w-lg bg-yo-surface border-l border-yo-border shadow-lg flex flex-col" onClick={e => e.stopPropagation()}>
            <header className="px-5 py-4 border-b border-yo-border flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-yo-txt">Solicitud de aprobación</h3>
                <p className="text-[12px] text-yo-txt-3 mt-0.5">Nivel {selected.nivel_actual} de {selected.total_niveles} · Aprobador: {ROLE_LABEL[selected.aprobador_rol]}</p>
              </div>
              <button onClick={() => setSelected(null)} className="size-7 grid place-items-center rounded-md hover:bg-yo-raised"><X className="size-4" /></button>
            </header>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <Row k="Acción" v={selected.action_label} />
                <Row k="Operación" v={selected.operacion_numero} mono />
                <Row k="Solicitante" v={selected.solicitante} />
                <Row k="Monto" v={formatMoney(selected.monto_mxn)} mono />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-1.5">Motivo</div>
                <p className="text-[13px] text-yo-txt-2 bg-yo-raised rounded-md p-3">{selected.motivo}</p>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2">Checklist</div>
                <ul className="space-y-1.5">
                  {selected.checklist.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-[13px]">
                      {c.warn ? <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                        : c.ok ? <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                        : <XCircle className="size-4 text-red-500 shrink-0" />}
                      <span className={cn(c.warn ? "text-amber-700" : "text-yo-txt-2")}>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-1.5">Comentario del aprobador</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
                  placeholder="Justifica tu decisión…"
                  className="w-full px-3 py-2 text-[13px] rounded-md border border-yo-border focus:border-yo-ac focus:outline-none" />
              </div>
              <div className="rounded-md bg-yo-info-bg border border-yo-info/20 p-3 text-[11.5px] text-yo-txt-2">
                CUMPLEX registra esta acción como parte de la auditoría interna de tu equipo.
              </div>
            </div>
            <footer className="px-5 py-3 border-t border-yo-border flex justify-end gap-2">
              <button onClick={() => decide(selected.id, false)} className="h-9 px-3 text-[13px] rounded-md border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1.5">
                <XCircle className="size-3.5" /> Rechazar
              </button>
              <button onClick={() => decide(selected.id, true)} className="h-9 px-4 text-[13px] font-semibold rounded-md bg-yo-ac text-white hover:bg-yo-ac-h inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" /> Aprobar solicitud
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-yo-txt-3 font-semibold">{k}</div>
      <div className={cn("text-[13px] text-yo-txt font-medium mt-0.5", mono && "font-mono")}>{v}</div>
    </div>
  );
}
