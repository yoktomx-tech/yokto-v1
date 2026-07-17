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
          <p className="text-sm text-yo-txt-3 text-center py-8">Sin disputas activas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-yo-txt-3 uppercase">
              <tr className="text-left border-b border-yo-border">
                <th className="py-2">Número</th><th>Operación</th><th>Motivo</th><th>Estado</th><th>Resolución</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((d) => (
                <tr key={d.id} className="border-b border-yo-border">
                  <td className="py-2 text-yo-ac font-mono text-xs">{d.numero ?? d.id.slice(0, 8)}</td>
                  <td className="text-yo-txt-3 font-mono text-xs">{d.transaction_id?.slice(0, 8)}</td>
                  <td className="text-yo-txt-2">{d.reason_code}</td>
                  <td className="text-yellow-400">{d.status}</td>
                  <td className="text-yo-txt-3">{d.resolution ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminCard>
    </>
  );
}
