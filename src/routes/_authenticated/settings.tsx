import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SettingsShell } from "@/components/settings/settings-shell";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configuración — CUMPLEX" }, { name: "robots", content: "noindex" }] }),
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        icon={Settings}
        title="Configuración"
        subtitle="Seguridad, sesiones, notificaciones, preferencias operativas, facturación e integraciones de tu cuenta y tu organización."
      />
      <SettingsShell>
        <Outlet />
      </SettingsShell>
    </div>
  );
}
