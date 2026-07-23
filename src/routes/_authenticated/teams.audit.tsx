import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { History, Download, Search, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { MOCK_AUDIT, ROLE_LABEL, ROLE_TONE, formatDateTime, type TeamRole } from "@/lib/teams-mock";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teams/audit")({
  component: AuditPage,
});

function AuditPage() {
  const [q, setQ] = useState("");
  const [rol, setRol] = useState<"ALL" | TeamRole>("ALL");
  const [result, setResult] = useState<"ALL" | "SUCCESS" | "DENIED" | "ERROR">("ALL");

  const rows = useMemo(() => MOCK_AUDIT.filter(e => {
    if (rol !== "ALL" && e.rol !== rol) return false;
    if (result !== "ALL" && e.result !== result) return false;
    if (q && !(e.actor + e.action + e.entity).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [q, rol, result]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-yo-txt-3" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar actor, acción u objeto…"
              className="pl-8 pr-3 h-9 w-72 text-[13px] rounded-md border border-yo-border bg-yo-surface focus:border-yo-ac focus:outline-none" />
          </div>
          <select value={rol} onChange={e => setRol(e.target.value as "ALL" | TeamRole)} className="h-9 px-2 text-[13px] rounded-md border border-yo-border bg-yo-surface">
            <option value="ALL">Todos los roles</option>
            {(["ADMIN","FINANZAS","OPERADOR","READONLY","AUDITOR"] as TeamRole[]).map(r =>
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            )}
          </select>
          <select value={result} onChange={e => setResult(e.target.value as "ALL" | "SUCCESS" | "DENIED" | "ERROR")} className="h-9 px-2 text-[13px] rounded-md border border-yo-border bg-yo-surface">
            <option value="ALL">Todos los resultados</option>
            <option value="SUCCESS">Exitosos</option>
            <option value="DENIED">Denegados</option>
            <option value="ERROR">Con error</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toast.success("Exportando CSV…")} className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] rounded-md border border-yo-border hover:bg-yo-raised">
            <Download className="size-3.5" /> CSV
          </button>
          <button onClick={() => toast.success("Generando PDF…")} className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] rounded-md border border-yo-border hover:bg-yo-raised">
            <Download className="size-3.5" /> PDF
          </button>
          <button onClick={() => toast.success("Exportando JSON…")} className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] rounded-md bg-yo-ac text-white hover:bg-yo-ac-h">
            <Download className="size-3.5" /> JSON Enterprise
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-yo-surface border border-yo-border shadow-sm overflow-hidden">
        <header className="px-5 py-3 border-b border-yo-border flex items-center gap-2">
          <History className="size-4 text-yo-ac" />
          <h3 className="text-[14px] font-semibold text-yo-txt">Registro de auditoría</h3>
          <span className="ml-auto text-[11.5px] text-yo-txt-3">{rows.length} eventos</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[900px]">
            <thead className="bg-yo-raised text-yo-txt-3 uppercase text-[10.5px] tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Fecha</th>
                <th className="text-left px-3 py-2.5 font-semibold">Actor</th>
                <th className="text-left px-3 py-2.5 font-semibold">Rol</th>
                <th className="text-left px-3 py-2.5 font-semibold">Acción</th>
                <th className="text-left px-3 py-2.5 font-semibold">Objeto</th>
                <th className="text-left px-3 py-2.5 font-semibold">IP</th>
                <th className="text-left px-3 py-2.5 font-semibold">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yo-border">
              {rows.map(e => (
                <tr key={e.id} className="hover:bg-yo-raised/60">
                  <td className="px-4 py-2.5 text-yo-txt-2 whitespace-nowrap">{formatDateTime(e.fecha)}</td>
                  <td className="px-3 py-2.5 text-yo-txt">{e.actor}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold", ROLE_TONE[e.rol])}>
                      {ROLE_LABEL[e.rol]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-yo-txt-2">{e.action}</td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-yo-txt-2">{e.entity}</td>
                  <td className="px-3 py-2.5 font-mono text-[11.5px] text-yo-txt-3">{e.ip}</td>
                  <td className="px-3 py-2.5">
                    {e.result === "SUCCESS" && <span className="inline-flex items-center gap-1 text-emerald-700 text-[11.5px] font-semibold"><CheckCircle2 className="size-3.5" /> Éxito</span>}
                    {e.result === "DENIED" && <span className="inline-flex items-center gap-1 text-amber-700 text-[11.5px] font-semibold"><AlertCircle className="size-3.5" /> Denegado</span>}
                    {e.result === "ERROR" && <span className="inline-flex items-center gap-1 text-red-700 text-[11.5px] font-semibold"><XCircle className="size-3.5" /> Error</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-yo-txt-3">
        CUMPLEX registra cada acción del equipo como parte del expediente auditable. La retención cumple con requisitos empresariales.
      </p>
    </div>
  );
}
