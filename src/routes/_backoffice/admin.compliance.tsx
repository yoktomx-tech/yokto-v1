import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";
import { adminComplianceQueue } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/_backoffice/admin/compliance")({
  component: AdminCompliance,
});

function AdminCompliance() {
  const fn = useServerFn(adminComplianceQueue);
  const { data } = useQuery({ queryKey: ["admin-compliance"], queryFn: () => fn() });

  return (
    <>
      <AdminPageHeader title="Cola PLD/FT" description="Oficial de Cumplimiento" />
      <AdminCard>
        {(data ?? []).length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Sin perfiles de riesgo en cola.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase">
              <tr className="text-left border-b border-white/10">
                <th className="py-2">Usuario</th><th>Score</th><th>Nivel</th><th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((p: Record<string, unknown>) => (
                <tr key={p.id as string} className="border-b border-white/5">
                  <td className="py-2 text-gray-300 font-mono text-xs">{(p.user_id as string)?.slice(0, 8)}</td>
                  <td className="text-white font-semibold">{p.score as number}</td>
                  <td>
                    <span className={
                      p.level === "inaceptable" ? "text-red-400" :
                      p.level === "alto" ? "text-orange-400" :
                      p.level === "medio" ? "text-yellow-400" : "text-green-400"
                    }>{p.level as string}</span>
                  </td>
                  <td className="text-gray-500 text-xs">{new Date(p.updated_at as string).toLocaleString("es-MX")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminCard>
    </>
  );
}
