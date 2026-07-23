import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Briefcase, PackageCheck, AlertTriangle, Banknote,
  Users, Users2, Star, Menu, X, ClipboardCheck, BarChart3, Building2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { CumplexLogo } from "@/components/logo";
import { OrgSwitcher } from "@/components/org-switcher";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useViewRole } from "@/hooks/use-view-role";
import { useAuthUser } from "@/hooks/use-auth-user";
import { AppHeader } from "@/components/app-header";

import { cn } from "@/lib/utils";
import { getMockProfile, LEVEL_CFG, TONE_CLASSES } from "@/lib/score-mock";


type NavItem = { to: string; icon: typeof LayoutDashboard; label: string };

const SELLER_NAV: NavItem[] = [
  { to: "/dashboard",    icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: Briefcase,       label: "Mis Operaciones" },
  { to: "/cumplimiento", icon: PackageCheck,     label: "Cumplimiento" },
  { to: "/disputes",     icon: AlertTriangle,   label: "Disputas" },
  { to: "/payments",     icon: Banknote,        label: "Pagos y retenciones" },
  
  { to: "/analytics",    icon: BarChart3,       label: "Analytics" },
  { to: "/crm", icon: Users,           label: "Relaciones" },
  { to: "/teams",        icon: Users2,          label: "Equipo" },
  { to: "/score",        icon: Star,            label: "Score de confianza" },
];

const BUYER_NAV: NavItem[] = [
  { to: "/dashboard",    icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: Briefcase,       label: "Mis Operaciones" },
  { to: "/approvals",    icon: ClipboardCheck,  label: "Aprobaciones" },
  { to: "/disputes",     icon: AlertTriangle,   label: "Disputas" },
  { to: "/payments",     icon: Banknote,        label: "Pagos y retenciones" },
  { to: "/analytics",    icon: BarChart3,       label: "Analytics" },
  { to: "/crm", icon: Users,           label: "Relaciones" },
  { to: "/teams",        icon: Users2,          label: "Equipo" },
  { to: "/score",        icon: Star,            label: "Score de confianza" },
  
];

const COLLAPSE_KEY = "cumplex.sidebar.collapsed";

export function AppShell({ children }: { children: React.ReactNode; sgyScore?: number; displayName?: string }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const { role, setRole } = useViewRole();
  const { userId, email } = useAuthUser();

  useEffect(() => {
    try {
      const v = localStorage.getItem(COLLAPSE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const nav = role === "seller" ? SELLER_NAV : BUYER_NAV;
  const profile = getMockProfile(role);

  return (
    <div className="min-h-dvh flex bg-yo-bg">
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col border-r border-yo-border bg-yo-surface sticky top-0 h-dvh transition-[width] duration-200",
          collapsed ? "md:w-16" : "md:w-60 lg:w-64"
        )}
      >
        <SidebarContent
          pathname={pathname}
          nav={nav}
          score={profile.score}
          level={profile.level}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
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
              score={profile.score}
              level={profile.level}
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
        <AppHeader email={email} userId={userId} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
        
      </div>
    </div>
  );
}

function SidebarContent({
  pathname, nav, score, level, onNavigate, collapsed, onToggleCollapsed,
}: {
  pathname: string;
  nav: NavItem[];
  score: number;
  level: import("@/lib/score-mock").ComplianceLevel;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const cfg = LEVEL_CFG[level];
  const tone = TONE_CLASSES[cfg.tone];
  const pct = Math.min(100, Math.max(0, score));
  const { orgs, currentOrg } = useCurrentOrg();
  const orgCount = orgs.length;

  return (
    <>
      <div className={cn("relative px-5 py-5 flex items-center justify-center", collapsed && "px-2")}>
        <Link to="/dashboard" onClick={onNavigate} className="inline-flex items-center justify-center">
          {collapsed ? (
            <CumplexLogo variant="icon" className="h-8 w-8" />
          ) : (
            <CumplexLogo variant="auto" className="h-9 w-auto" />
          )}
        </Link>
        {onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            className="hidden md:grid absolute -right-3 top-1/2 -translate-y-1/2 size-6 place-items-center rounded-full border border-yo-border bg-yo-surface text-yo-txt-3 hover:text-yo-txt hover:bg-yo-raised shadow-sm z-10"
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
          </button>
        )}
      </div>


      <nav className={cn("flex-1 overflow-y-auto p-3 space-y-0.5", collapsed && "px-2")}>
        {nav.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md text-[13px] font-medium transition",
                collapsed ? "justify-center px-0 py-2" : "px-3 py-2",
                active
                  ? "bg-yo-ac-bg text-yo-ac-txt"
                  : "text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised"
              )}
            >
              <Icon className={cn("shrink-0", collapsed ? "size-5" : "size-4", active ? "text-yo-ac" : "text-yo-txt-3")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {collapsed ? (
        <div className="border-t border-yo-border p-2 flex flex-col items-center gap-2">
          <Link
            to="/settings/organization"
            onClick={onNavigate}
            title={`Espacios de trabajo: ${orgCount}${currentOrg ? ` · Actual: ${currentOrg.name}` : ""}`}
            className="relative size-10 grid place-items-center rounded-md border border-yo-border bg-yo-bg hover:bg-yo-raised transition"
          >
            <Building2 className="size-5 text-yo-txt-2" />
            <span className="absolute -bottom-1 -right-1 text-[10px] font-semibold px-1 rounded bg-yo-ac text-white">{orgCount}</span>
          </Link>
          <Link
            to="/score"
            onClick={onNavigate}
            title={`Score ${score}/100 · ${cfg.label}`}
            className="relative size-10 grid place-items-center rounded-md border border-yo-border bg-yo-bg hover:bg-yo-raised transition"
          >
            <Star className="size-5 text-yo-ac" />
            <span className={cn("absolute -bottom-1 -right-1 text-[10px] font-semibold px-1 rounded", tone.bg, tone.text)}>{score}</span>
          </Link>
        </div>
      ) : (
        <div className="border-t border-yo-border p-3 space-y-3">
          <div>
            <p className="px-1 text-[10px] uppercase tracking-[0.14em] font-semibold text-yo-txt-3 mb-1.5">Espacio de trabajo</p>
            <OrgSwitcher />
          </div>

          <div>
            <p className="px-1 text-[10px] uppercase tracking-[0.14em] font-semibold text-yo-txt-3 mb-1.5">Perfil de cumplimiento</p>
            <Link
              to="/score"
              onClick={onNavigate}
              className="block rounded-md border border-yo-border bg-yo-bg p-3 hover:bg-yo-raised transition"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Star className="size-3.5 text-yo-ac" />
                  <span className="text-[11px] font-medium text-yo-txt-2">Score</span>
                </div>
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", tone.bg, tone.text)}>{cfg.label}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-1.5">
                <span className="text-lg font-bold text-yo-txt tabular-nums">{score}</span>
                <span className="text-[10px] text-yo-txt-3">/ 100</span>
              </div>
              <div className="h-1 w-full rounded-full bg-yo-border overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", tone.dot)} style={{ width: `${pct}%` }} />
              </div>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
