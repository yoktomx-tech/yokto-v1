import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard, Briefcase, PackageCheck, AlertTriangle, Banknote,
  Users, Users2, Star, Menu, X, ClipboardCheck, BarChart3,
} from "lucide-react";
import { YoktoLogo } from "@/components/logo";
import { OrgSwitcher } from "@/components/org-switcher";
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
  { to: "/relationships", icon: Users,           label: "CRM" },
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
  { to: "/relationships", icon: Users,           label: "CRM" },
  { to: "/teams",        icon: Users2,          label: "Equipo" },
  { to: "/score",        icon: Star,            label: "Score de confianza" },
];

export function AppShell({ children }: { children: React.ReactNode; sgyScore?: number; displayName?: string }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role, setRole } = useViewRole();
  const { userId, email } = useAuthUser();

  const nav = role === "seller" ? SELLER_NAV : BUYER_NAV;
  const profile = getMockProfile(role);

  const nav_ = nav;
  return (
    <div className="min-h-dvh flex bg-yo-bg">
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-yo-border bg-yo-surface sticky top-0 h-dvh">
        <SidebarContent pathname={pathname} nav={nav_} score={profile.score} level={profile.level} />
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
  pathname, nav, score, level, onNavigate,
}: {
  pathname: string;
  nav: NavItem[];
  score: number;
  level: import("@/lib/score-mock").ComplianceLevel;
  onNavigate?: () => void;
}) {
  const cfg = LEVEL_CFG[level];
  const tone = TONE_CLASSES[cfg.tone];
  const pct = Math.min(100, Math.max(0, score));

  return (
    <>
      <div className="px-5 py-5 border-b border-yo-border flex justify-center">
        <Link to="/dashboard" onClick={onNavigate} className="inline-flex items-center justify-center">
          <YoktoLogo variant="dark" className="h-6 w-auto" />
        </Link>
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
    </>
  );
}

