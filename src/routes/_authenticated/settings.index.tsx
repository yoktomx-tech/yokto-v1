import { createFileRoute, Link } from "@tanstack/react-router";
import { SETTINGS_NAV } from "@/components/settings/settings-shell";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsIndex,
});

const DESCRIPTIONS: Record<string, string> = {
  "/settings/security": "Contraseña, MFA TOTP y códigos de recuperación.",
  "/settings/sessions": "Dispositivos conectados y cierre remoto de sesión.",
  "/settings/notifications": "Canales, categorías, quiet hours y resúmenes.",
  "/settings/preferences": "Rol por defecto, sector, densidad y confirmaciones.",
  "/settings/privacy": "Exportar datos, ARCO y política de retención.",
  "/settings/billing": "Plan activo, facturas y perfil fiscal de billing.",
  "/settings/integrations": "Conectores instalados y autorizaciones OAuth.",
  "/settings/webhooks": "Endpoints firmados con HMAC y reintentos.",
  "/settings/api-keys": "Credenciales con scopes y whitelist de IP.",
  "/settings/team": "Políticas globales: MFA, dominios, workflows.",
  "/settings/audit": "Bitácora de cambios en la configuración.",
  "/settings/support": "Contacto, diagnóstico y estado del servicio.",
  "/settings/danger-zone": "Cerrar todas las sesiones y cierre de cuenta.",
};

function SettingsIndex() {
  const items = SETTINGS_NAV.filter((i) => i.to !== "/settings");
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={`group rounded-lg border p-4 bg-yo-surface transition hover:border-yo-ac/40 hover:shadow-sm ${
            item.danger ? "border-red-200" : "border-yo-border"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`shrink-0 size-9 rounded-md grid place-items-center ${
                item.danger ? "bg-red-50 text-red-600" : "bg-yo-ac-bg text-yo-ac"
              }`}
            >
              <item.icon className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className={`text-[14px] font-semibold ${item.danger ? "text-red-700" : "text-yo-txt"}`}>
                {item.label}
              </div>
              <p className="text-[12.5px] text-yo-txt-3 mt-1 leading-relaxed">
                {DESCRIPTIONS[item.to] ?? ""}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
