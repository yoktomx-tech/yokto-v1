import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, UserCheck, FileSearch, ShieldAlert, Scale, LifeBuoy,
  LineChart, Users, Settings2, Activity, ScrollText,
} from "lucide-react";
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
    <div className="min-h-screen bg-[#101014] text-[#FAFAFA]">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-[#0A0A0B] border-r border-white/10 flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-white/10">
          <span className="text-sm font-bold text-white tracking-tight">YOKTO</span>
          <span className="ml-2 text-[10px] font-semibold text-red-400 bg-red-950/60 px-2 py-0.5 rounded-full">
            PANEL INTERNO
          </span>
        </div>
        <nav className="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
          {visible.map((item) => {
            const active = pathname === item.to || (item.to !== "/admin" && pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition",
                  active
                    ? "bg-[#7C3AED]/15 text-[#A78BFA]"
                    : "text-gray-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mx-3 mb-4 px-3 py-3 bg-white/5 border border-white/10 rounded-xl">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Rol activo</p>
          <p className="text-xs text-gray-200 font-medium mt-1">{INTERNAL_ROLE_LABEL[role]}</p>
          <Link to="/dashboard" className="text-[11px] text-[#A78BFA] hover:underline mt-2 block">
            ← Volver a la app
          </Link>
        </div>
      </aside>

      <div className="pl-64">
        <header className="h-16 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Backoffice YOKTO</p>
            <h1 className="text-sm font-semibold text-white">Panel interno de operación</h1>
          </div>
          <div className="text-xs text-gray-400">
            Segregación estricta • Toda acción queda auditada
          </div>
        </header>
        <main className="p-6 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6 pb-4 border-b border-white/10">
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AdminCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-[#18181B] border border-white/10 rounded-xl p-5", className)}>{children}</div>
  );
}
