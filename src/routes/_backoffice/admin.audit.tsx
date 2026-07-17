import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";
import { adminAuditList } from "@/lib/admin/admin.functions";
import { INTERNAL_ROLE_LABEL, type InternalRole } from "@/lib/admin/permissions";

export const Route = createFileRoute("/_backoffice/admin/audit")({
  component: AdminAudit,
});

function AdminAudit() {
  const fn = useServerFn(adminAuditList);
  const { data } = useQuery({ queryKey: ["admin-audit"], queryFn: () => fn() });
  return (
    <>
      <AdminPageHeader title="Auditoría interna" description="Registro inmutable de acciones del staff" />
      <AdminCard>
        {(data ?? []).length === 0 ? (
          <p className="text-sm text-yo-txt-3 text-center py-8">Sin acciones registradas.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-[10px] text-yo-txt-3 uppercase">
              <tr className="text-left border-b border-yo-border">
                <th className="py-2">Fecha</th><th>Rol usado</th><th>Recurso</th><th>Acción</th><th>Entidad</th><th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((a) => (
                <tr key={a.id} className="border-b border-yo-border">
                  <td className="py-1.5 text-yo-txt-3">{new Date(a.created_at).toLocaleString("es-MX")}</td>
                  <td className="text-yo-ac">{INTERNAL_ROLE_LABEL[a.rol_usado as InternalRole]}</td>
                  <td className="text-yo-txt-2">{a.recurso}</td>
                  <td className="text-yo-txt font-mono">{a.accion}</td>
                  <td className="text-yo-txt-3 font-mono">{a.entidad_tipo ?? "—"}{a.entidad_id ? ":" + a.entidad_id.slice(0, 8) : ""}</td>
                  <td className="text-yo-txt-3 max-w-xs truncate">{a.motivo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminCard>
    </>
  );
}
