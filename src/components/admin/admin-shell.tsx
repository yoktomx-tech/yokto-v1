import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, UserCheck, FileSearch, ShieldAlert, Scale, LifeBuoy,
  LineChart, Users, Settings2, Activity, ScrollText, ShieldCheck,
} from "lucide-react";
import { CumplexLogo } from "@/components/logo";
import { hasPermission, INTERNAL_ROLE_LABEL, type InternalRole, type Resource } from "@/lib/admin/permissions";
import { cn } from "@/lib/utils";

const NAV: Array<{ to: string; label: string; icon: typeof LayoutDashboard; resource: Resource }> = [
  { to: "/admin",             label: "Resumen",       icon: LayoutDashboard, resource: "admin_dashboard" },
  { to: "/admin/kyc",         label: "KYC",           icon: UserCheck,       resource: "kyc" },
  { to: "/admin/documentos",  label: "Documentos",    icon: FileSearch,      resource: "documentos" },
  { to: "/admin/compliance",  label: "PLD/FT",        icon: ShieldAlert,     resource: "compliance" },
  { to: "/admin/disputas",    label: "Disputas",      icon: Scale,           resource: "disputas" },
  { to: "/admin/support",     label: "Soporte",       icon: LifeBuoy,        resource: "soporte" },
  { to: "/admin/finanzas",    label: "Finanzas",      icon: LineChart,       resource: "finanzas" },
  { to: "/admin/roles",       label: "Roles internos",icon: Users,           resource: "roles" },
  { to: "/admin/config",      label: "Configuración", icon: Settings2,       resource: "plataforma" },
  { to: "/admin/health",      label: "Salud",         icon: Activity,        resource: "health" },
  { to: "/admin/audit",       label: "Auditoría",     icon: ScrollText,      resource: "auditoria" },
];

export function AdminShell({ role, children }: { role: InternalRole; children: React.ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const visible = NAV.filter((n) => hasPermission(role, n.resource, "ver"));

  return (
    <div className="min-h-dvh flex bg-yo-bg text-yo-txt">
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-yo-border bg-yo-surface sticky top-0 h-dvh">
        <div className="px-5 py-5 border-b border-yo-border flex items-center justify-between gap-2">
          <Link to="/admin" className="inline-flex items-center">
            <CumplexLogo variant="auto" className="h-7 w-auto" />
          </Link>
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-yo-err bg-yo-err-bg border border-yo-err/25 px-1.5 py-0.5 rounded">
            <ShieldCheck className="size-3" />
            Interno
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {visible.map((item) => {
            const active = pathname === item.to || (item.to !== "/admin" && pathname.startsWith(item.to + "/"));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition",
                  active
                    ? "bg-yo-ac-bg text-yo-ac-txt"
                    : "text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-yo-ac" : "text-yo-txt-3")} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-yo-border p-3">
          <div className="rounded-md border border-yo-border bg-yo-bg p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-yo-txt-3">Rol activo</p>
            <p className="text-xs text-yo-txt font-medium mt-1">{INTERNAL_ROLE_LABEL[role]}</p>
            <Link to="/dashboard" className="text-[11px] text-yo-ac hover:underline mt-2 block">
              ← Volver a la app
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-yo-surface border-b border-yo-border flex items-center justify-between px-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-yo-txt-3">Backoffice Cumplex</p>
            <h1 className="text-sm font-semibold text-yo-txt">Panel interno de operación</h1>
          </div>
          <div className="text-[11px] text-yo-txt-3">
            Segregación estricta • Toda acción queda auditada
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-[1440px] w-full">{children}</main>
      </div>
    </div>
  );
}

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6 pb-4 border-b border-yo-border">
      <div>
        <h2 className="text-xl font-semibold text-yo-txt">{title}</h2>
        {description && <p className="text-sm text-yo-txt-2 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AdminCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-yo-surface border border-yo-border rounded-xl p-5", className)}>{children}</div>
  );
}
