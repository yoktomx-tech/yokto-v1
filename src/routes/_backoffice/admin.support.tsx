import { createFileRoute } from "@tanstack/react-router";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";

export const Route = createFileRoute("/_backoffice/admin/support")({
  component: () => (
    <>
      <AdminPageHeader title="Soporte" description="Agente de Soporte — tickets y escalamientos" />
      <AdminCard>
        <p className="text-sm text-yo-txt-3">
          Sistema de tickets en preparación. Los usuarios pueden contactarse desde
          <span className="text-yo-ac"> /settings/support</span>. Aquí llegarán los tickets abiertos.
        </p>
        <p className="text-xs text-yo-txt-3 mt-3">
          Recordatorio: Soporte ve datos mínimos necesarios (nombre, correo, id de operación, estado y último error).
          No accede a INE, selfie, beneficiario controlador ni CLABE completa.
        </p>
      </AdminCard>
    </>
  ),
});
