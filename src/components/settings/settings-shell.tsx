import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Settings, Shield, Monitor, Bell, Sliders, Lock, CreditCard,
  Plug, Webhook, KeyRound, Users, History, LifeBuoy, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
};

export const SETTINGS_NAV: SettingsNavItem[] = [
  { to: "/settings", label: "Resumen", icon: Settings },
  { to: "/settings/security", label: "Seguridad", icon: Shield },
  { to: "/settings/sessions", label: "Sesiones activas", icon: Monitor },
  { to: "/settings/notifications", label: "Notificaciones", icon: Bell },
  { to: "/settings/preferences", label: "Preferencias", icon: Sliders },
  { to: "/settings/privacy", label: "Privacidad y datos", icon: Lock },
  { to: "/settings/billing", label: "Facturación", icon: CreditCard },
  { to: "/settings/integrations", label: "Integraciones", icon: Plug },
  { to: "/settings/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/settings/api-keys", label: "API keys", icon: KeyRound },
  { to: "/settings/team", label: "Equipo y políticas", icon: Users },
  { to: "/settings/audit", label: "Auditoría", icon: History },
  { to: "/settings/support", label: "Soporte", icon: LifeBuoy },
  { to: "/settings/danger-zone", label: "Zona de riesgo", icon: AlertTriangle, danger: true },
];

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="lg:w-64 shrink-0">
        <nav className="rounded-lg border border-yo-border bg-yo-surface p-2 sticky top-4">
          {/* Mobile: horizontal scroll */}
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {SETTINGS_NAV.map((item) => {
              const active =
                item.to === "/settings"
                  ? pathname === "/settings"
                  : pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium whitespace-nowrap transition",
                    active
                      ? item.danger
                        ? "bg-red-50 text-red-700"
                        : "bg-yo-ac-bg text-yo-ac"
                      : item.danger
                        ? "text-red-600 hover:bg-red-50"
                        : "text-yo-txt-2 hover:bg-yo-raised hover:text-yo-txt",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function SettingsCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  tone = "default",
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children?: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-yo-surface",
        tone === "danger" ? "border-red-200" : "border-yo-border",
      )}
    >
      <header className="flex items-start justify-between gap-4 p-5 border-b border-yo-border">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div
              className={cn(
                "shrink-0 size-9 rounded-md grid place-items-center",
                tone === "danger" ? "bg-red-50 text-red-600" : "bg-yo-ac-bg text-yo-ac",
              )}
            >
              <Icon className="size-4.5" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className={cn("text-[15px] font-semibold", tone === "danger" ? "text-red-700" : "text-yo-txt")}>{title}</h3>
            {description && <p className="text-[12.5px] text-yo-txt-3 mt-0.5 leading-relaxed">{description}</p>}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      {children && <div className="p-5">{children}</div>}
    </section>
  );
}

export function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-3 border-b border-yo-border last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-yo-txt">{label}</div>
        {hint && <div className="text-[12px] text-yo-txt-3 mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
