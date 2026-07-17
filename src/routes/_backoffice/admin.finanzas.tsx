import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";
import { adminFinanzasOverview } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/_backoffice/admin/finanzas")({
  component: AdminFinanzas,
});

function AdminFinanzas() {
  const fn = useServerFn(adminFinanzasOverview);
  const { data } = useQuery({ queryKey: ["admin-finanzas"], queryFn: () => fn() });

  return (
    <>
      <AdminPageHeader title="Finanzas" description="Analista Financiero · Reconciliación y webhooks" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AdminCard>
          <h3 className="text-sm font-semibold text-white mb-3">Últimos payouts</h3>
          {(data?.payouts ?? []).length === 0 ? (
            <p className="text-xs text-gray-500">Sin payouts recientes.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {(data?.payouts ?? []).slice(0, 10).map((p: Record<string, unknown>) => (
                <li key={p.id as string} className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-gray-400 font-mono">{(p.id as string).slice(0, 8)}</span>
                  <span className="text-gray-200">${(p.amount_cents as number ?? 0) / 100}</span>
                  <span className="text-gray-500">{p.status as string}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
        <AdminCard>
          <h3 className="text-sm font-semibold text-white mb-3">Webhooks Stripe</h3>
          {(data?.webhooks ?? []).length === 0 ? (
            <p className="text-xs text-gray-500">Sin webhooks recientes.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {(data?.webhooks ?? []).slice(0, 10).map((w: Record<string, unknown>) => (
                <li key={w.id as string} className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-gray-300">{w.event_type as string}</span>
                  <span className={w.processed ? "text-green-400" : "text-yellow-400"}>
                    {w.processed ? "OK" : "pendiente"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </>
  );
}
