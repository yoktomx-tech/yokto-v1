import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";
import { adminHealth } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/_backoffice/admin/health")({
  component: () => {
    const fn = useServerFn(adminHealth);
    const { data } = useQuery({ queryKey: ["admin-health"], queryFn: () => fn() });
    return (
      <>
        <AdminPageHeader title="Salud del sistema" />
        <AdminCard>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><p className="text-gray-500 text-xs uppercase">Base de datos</p><p className="text-green-400 mt-1">{data?.db ?? "..."}</p></div>
            <div><p className="text-gray-500 text-xs uppercase">Storage</p><p className="text-green-400 mt-1">{data?.storage ?? "..."}</p></div>
            <div><p className="text-gray-500 text-xs uppercase">Webhooks</p><p className="text-green-400 mt-1">{data?.webhooks ?? "..."}</p></div>
          </div>
          <p className="text-[10px] text-gray-500 mt-4">Última verificación: {data?.lastCheck}</p>
        </AdminCard>
      </>
    );
  },
});
