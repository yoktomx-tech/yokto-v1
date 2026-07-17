import { createFileRoute } from "@tanstack/react-router";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";

export const Route = createFileRoute("/_backoffice/admin/config")({
  component: () => (
    <>
      <AdminPageHeader title="Configuración de plataforma" description="Solo Super Administrador" />
      <AdminCard>
        <p className="text-sm text-yo-txt-3">Feature flags, comisiones y parámetros del sistema (próximamente).</p>
      </AdminCard>
    </>
  ),
});
