import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";
import { listSupportQueue } from "@/lib/admin/support.functions";

export const Route = createFileRoute("/_backoffice/admin/support")({
  component: AdminSupportQueue,
});

const PRIO_CLS: Record<string, string> = {
  urgent: "bg-red-50 text-red-700", high: "bg-amber-50 text-amber-700",
  normal: "bg-slate-50 text-slate-700", low: "bg-slate-50 text-slate-500",
};

function AdminSupportQueue() {
  const [onlyEsc, setOnlyEsc] = useState(false);
  const fn = useServerFn(listSupportQueue);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-support", onlyEsc],
    queryFn: () => fn({ data: { escalated: onlyEsc } }),
    staleTime: 15_000,
  });

  return (
    <>
      <AdminPageHeader title="Soporte" description="Cola de tickets. Los tickets escalados requieren MFA para cerrarse." />

      <div className="mb-4 flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs text-yo-txt-2">
          <input type="checkbox" checked={onlyEsc} onChange={(e) => setOnlyEsc(e.target.checked)} />
          Solo escalados
        </label>
      </div>

      <AdminCard>
        {isLoading && <p className="text-sm text-yo-txt-3">Cargando cola…</p>}
        {!isLoading && !data?.length && <p className="text-sm text-yo-txt-3">Sin tickets en cola.</p>}
        {!!data?.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-yo-txt-3">
                <tr>
                  <th className="text-left px-2 py-2 font-medium">Número</th>
                  <th className="text-left px-2 py-2 font-medium">Asunto</th>
                  <th className="text-left px-2 py-2 font-medium">Módulo</th>
                  <th className="text-left px-2 py-2 font-medium">Prioridad</th>
                  <th className="text-left px-2 py-2 font-medium">Estado</th>
                  <th className="text-left px-2 py-2 font-medium">Escalamiento</th>
                  <th className="text-left px-2 py-2 font-medium">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yo-border">
                {data!.map((t) => (
                  <tr key={t.id} className="hover:bg-yo-raised/40">
                    <td className="px-2 py-2 font-mono text-xs">
                      <Link to="/admin/support/$id" params={{ id: t.id }} className="text-yo-ac hover:underline">{t.numero}</Link>
                    </td>
                    <td className="px-2 py-2">{t.subject}</td>
                    <td className="px-2 py-2 text-yo-txt-3">{t.module ?? "—"}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${PRIO_CLS[t.priority] ?? ""}`}>{t.priority}</span>
                    </td>
                    <td className="px-2 py-2 text-yo-txt-2">{t.status}</td>
                    <td className="px-2 py-2 text-yo-txt-2">{t.escalation}</td>
                    <td className="px-2 py-2 text-xs text-yo-txt-3 font-mono">{new Date(t.created_at).toLocaleDateString("es-MX")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <p className="text-[11px] text-yo-txt-3 mt-3">
        Soporte accede a datos mínimos necesarios (asunto, módulo, contexto). No visualiza INE, selfie, beneficiario controlador ni CLABE completa.
      </p>
    </>
  );
}
