import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";
import { adminDisputesQueue } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/_backoffice/admin/disputas")({
  component: AdminDisputas,
});

function AdminDisputas() {
  const fn = useServerFn(adminDisputesQueue);
  const { data } = useQuery({ queryKey: ["admin-disputas"], queryFn: () => fn() });
  return (
    <>
      <AdminPageHeader title="Cola de disputas" description="Agente Escrow · Mediación y resolución" />
      <AdminCard>
        {(data ?? []).length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Sin disputas activas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase">
              <tr className="text-left border-b border-white/10">
                <th className="py-2">Número</th><th>Operación</th><th>Motivo</th><th>Estado</th><th>Resolución</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((d) => (
                <tr key={d.id} className="border-b border-white/5">
                  <td className="py-2 text-[#A78BFA] font-mono text-xs">{d.numero ?? d.id.slice(0, 8)}</td>
                  <td className="text-gray-400 font-mono text-xs">{d.transaction_id?.slice(0, 8)}</td>
                  <td className="text-gray-300">{d.reason_code}</td>
                  <td className="text-yellow-400">{d.status}</td>
                  <td className="text-gray-400">{d.resolution ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminCard>
    </>
  );
}
