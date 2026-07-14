import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard, Briefcase, ShieldCheck, AlertTriangle, Banknote,
  Users, Star, Menu, X, ClipboardCheck, ShoppingCart, Store,
} from "lucide-react";
import { YoktoLogo } from "@/components/logo";
import { useViewRole, type ViewRole } from "@/hooks/use-view-role";
import { cn } from "@/lib/utils";

type NavItem = { to: string; icon: typeof LayoutDashboard; label: string };

const SELLER_NAV: NavItem[] = [
  { to: "/dashboard",    icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: Briefcase,       label: "Mis Operaciones" },
  { to: "/compliance",   icon: ShieldCheck,     label: "Cumplimiento" },
  { to: "/disputes",     icon: AlertTriangle,   label: "Disputas" },
  { to: "/payments",     icon: Banknote,        label: "Pagos y retenciones" },
  { to: "/crm",          icon: Users,           label: "CRM" },
  { to: "/score",        icon: Star,            label: "Score de confianza" },
];

const BUYER_NAV: NavItem[] = [
  { to: "/dashboard",    icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: Briefcase,       label: "Mis Operaciones" },
  { to: "/approvals",    icon: ClipboardCheck,  label: "Aprobaciones" },
  { to: "/disputes",     icon: AlertTriangle,   label: "Disputas" },
  { to: "/payments",     icon: Banknote,        label: "Pagos y retenciones" },
  { to: "/crm",          icon: Users,           label: "CRM" },
  { to: "/score",        icon: Star,            label: "Score de confianza" },
];

export function AppShell({ children }: { children: React.ReactNode; sgyScore?: number; displayName?: string }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role, setRole } = useViewRole();

  const nav = role === "seller" ? SELLER_NAV : BUYER_NAV;

  return (
    <div className="min-h-dvh flex bg-yo-bg">
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-yo-border bg-yo-surface sticky top-0 h-dvh">
        <SidebarContent pathname={pathname} nav={nav} role={role} setRole={setRole} />
      </aside>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-yo-surface border-r border-yo-border flex flex-col md:hidden">
            <div className="flex justify-end p-2">
              <button
                onClick={() => setMobileOpen(false)}
                className="size-8 grid place-items-center rounded-md hover:bg-yo-raised"
                aria-label="Cerrar menú"
              >
                <X className="size-4" />
              </button>
            </div>
            <SidebarContent
              pathname={pathname}
              nav={nav}
              role={role}
              setRole={(r) => { setRole(r); }}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <button
          className="md:hidden fixed top-3 left-3 z-30 size-9 grid place-items-center rounded-md border border-yo-border bg-yo-surface shadow-sm"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu className="size-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function SidebarContent({
  pathname, nav, role, setRole, onNavigate,
}: {
  pathname: string;
  nav: NavItem[];
  role: ViewRole;
  setRole: (r: ViewRole) => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="px-5 py-5 border-b border-yo-border">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2">
          <YoktoLogo variant="dark" className="h-6 w-auto" />
        </Link>
      </div>

      {/* Role selector */}
      <div className="px-3 pt-3 pb-2">
        <p className="px-2 text-[10px] uppercase tracking-[0.14em] font-semibold text-yo-txt-3 mb-1.5">Vista actual</p>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-yo-bg border border-yo-border">
          <button
            onClick={() => setRole("seller")}
            className={cn(
              "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[12px] font-semibold transition",
              role === "seller" ? "bg-yo-ac text-white shadow-sm" : "text-yo-txt-2 hover:text-yo-txt"
            )}
          >
            <Store className="size-3.5" /> Vendedor
          </button>
          <button
            onClick={() => setRole("buyer")}
            className={cn(
              "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[12px] font-semibold transition",
              role === "buyer" ? "bg-yo-ac text-white shadow-sm" : "text-yo-txt-2 hover:text-yo-txt"
            )}
          >
            <ShoppingCart className="size-3.5" /> Comprador
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {nav.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition",
                active
                  ? "bg-yo-ac-bg text-yo-ac-txt"
                  : "text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised"
              )}
            >
              <Icon className={cn("size-4 shrink-0", active ? "text-yo-ac" : "text-yo-txt-3")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
