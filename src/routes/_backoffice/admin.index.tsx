import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";
import { adminDashboardOverview } from "@/lib/admin/admin.functions";
import { INTERNAL_ROLE_LABEL } from "@/lib/admin/permissions";
import { UserCheck, FileSearch, Scale, Briefcase } from "lucide-react";

export const Route = createFileRoute("/_backoffice/admin/")({
  component: AdminIndex,
});

function AdminIndex() {
  const fn = useServerFn(adminDashboardOverview);
  const { data } = useQuery({ queryKey: ["admin-overview"], queryFn: () => fn() });

  const cards = [
    { icon: UserCheck, label: "KYC pendientes", value: data?.counts.kycPending ?? "—" },
    { icon: FileSearch, label: "Documentos por revisar", value: data?.counts.docPending ?? "—" },
    { icon: Scale, label: "Disputas abiertas", value: data?.counts.openDisputes ?? "—" },
    { icon: Briefcase, label: "Operaciones activas", value: data?.counts.activeTx ?? "—" },
  ];

  return (
    <>
      <AdminPageHeader
        title="Resumen operativo"
        description={data?.role ? `Vista para ${INTERNAL_ROLE_LABEL[data.role]}` : "Cargando..."}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <AdminCard key={c.label}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#7C3AED]/15 flex items-center justify-center">
                <c.icon className="w-5 h-5 text-[#A78BFA]" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">{c.label}</p>
                <p className="text-2xl font-semibold text-white mt-0.5">{c.value}</p>
              </div>
            </div>
          </AdminCard>
        ))}
      </div>

      <AdminCard className="mt-6">
        <h3 className="text-sm font-semibold text-white mb-2">Recordatorio de segregación</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Cada rol interno actúa solo en su cola. Las decisiones críticas requieren motivo y
          quedan registradas en <code className="text-[#A78BFA]">internal_action_log</code> junto
          con el rol usado al momento de la acción.
        </p>
      </AdminCard>
    </>
  );
}
